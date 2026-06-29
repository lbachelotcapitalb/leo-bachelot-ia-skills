#!/usr/bin/env node
// secret-agent.mjs — agent de secrets ÉPHÉMÈRE, en RAM uniquement (modèle ssh-agent).
//
// Détient des secrets (clé → valeur) avec un TTL plafonné à 24 h, derrière une socket Unix 0600.
// RIEN n'est jamais écrit sur disque : seul le fichier-socket (point de rendez-vous, 0 octet de
// secret) existe sur le système de fichiers ; la valeur ne vit que dans le tas de CE processus.
// Auto-extinction dès que le magasin est vide (expiration, drop, flush) et au plus tard à 24 h 05.
//
// Sous-commandes :
//   node secret-agent.mjs serve              → démarre le daemon (auto-spawné par `set` au besoin)
//   node secret-agent.mjs get   <clé>        → imprime le secret sur stdout (exit 0) | exit 3 si absent
//   echo -n secret | … set <clé> <ttl_sec>   → mémorise (ttl plafonné 86400 ; 0 = ne rien garder)
//   node secret-agent.mjs drop  <clé>        → oublie une clé
//   node secret-agent.mjs flush              → oublie tout (extinction)
//   node secret-agent.mjs status             → nombre de secrets en mémoire
//
// Le secret transite en base64 sur la socket (pas de souci de délimiteur) et n'est JAMAIS passé
// en argv (lu sur stdin pour `set`, imprimé sur stdout pour `get`). Jamais loggé.
import net from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_TTL = 86400;                                           // plafond dur : 24 heures
const SOCK = path.join(os.tmpdir(), `.secret-agent-${process.getuid?.() ?? 'u'}.sock`);
const SELF = fileURLToPath(import.meta.url);

const b64e = (s) => Buffer.from(s, 'utf8').toString('base64');
const b64d = (s) => Buffer.from(s, 'base64').toString('utf8');

if (process.argv[2] === 'serve') serve();
else client(process.argv[2], process.argv.slice(3));

// --- daemon ----------------------------------------------------------------
function serve() {
  const store = new Map();                                       // clé → { secret, expiry(ms) }
  let dead = false;
  const stop = () => { if (dead) return; dead = true; try { fs.unlinkSync(SOCK); } catch {} process.exit(0); };
  const sweep = () => {
    const now = Date.now();
    for (const [k, v] of store) if (v.expiry <= now) store.delete(k);
    if (store.size === 0) stop();
  };
  setInterval(sweep, 3000).unref();
  setTimeout(stop, (MAX_TTL + 300) * 1000).unref();              // filet : extinction forcée à 24 h 05

  try { fs.unlinkSync(SOCK); } catch {}
  const server = net.createServer((c) => {
    let buf = '';
    c.on('data', (d) => {
      buf += d.toString('utf8');
      const nl = buf.indexOf('\n'); if (nl < 0) return;
      const [op, key, ttlStr, payload] = buf.slice(0, nl).split('\t');
      let reply = 'ERR';
      if (op === 'GET') {
        const v = store.get(key);
        if (v && v.expiry > Date.now()) reply = 'OK\t' + b64e(v.secret);
        else { if (v) store.delete(key); reply = 'MISS'; }
      } else if (op === 'SET') {
        const ttl = Math.min(Math.max(parseInt(ttlStr, 10) || 0, 0), MAX_TTL);
        if (ttl > 0 && payload) store.set(key, { secret: b64d(payload), expiry: Date.now() + ttl * 1000 });
        reply = 'OK';                                            // ttl 0 ⇒ on ne garde rien
      } else if (op === 'DROP') { store.delete(key); reply = 'OK'; }
      else if (op === 'FLUSH') { store.clear(); reply = 'OK'; }
      else if (op === 'STATUS') { reply = 'OK\t' + store.size; }
      c.end(reply + '\n');
      if ((op === 'DROP' || op === 'FLUSH') && store.size === 0) stop();
    });
    c.on('error', () => {});
  });
  server.on('error', () => stop());                              // socket déjà prise → un autre daemon vit
  server.listen(SOCK, () => { try { fs.chmodSync(SOCK, 0o600); } catch {} });
}

// --- client ----------------------------------------------------------------
function send(line) {
  return new Promise((resolve, reject) => {
    const c = net.connect(SOCK);
    let buf = '', done = false;
    const ok = () => { if (!done) { done = true; resolve(buf.replace(/\n+$/, '')); } };
    c.on('connect', () => c.write(line + '\n'));
    c.on('data', (d) => { buf += d.toString('utf8'); });
    c.on('end', ok);
    c.on('close', ok);
    c.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}

async function waitSock(ms) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { await send('STATUS'); return true; } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

async function client(cmd, args) {
  try {
    if (cmd === 'get') {
      let reply;
      try { reply = await send('GET\t' + (args[0] || '')); } catch { process.exit(3); }   // pas de daemon ⇒ miss
      if (reply.startsWith('OK\t')) { process.stdout.write(b64d(reply.slice(3))); process.exit(0); }
      process.exit(3);
    }
    if (cmd === 'set') {
      const payload = ['SET', args[0] || '', args[1] || '0', b64e(fs.readFileSync(0, 'utf8'))].join('\t');
      try { await send(payload); }
      catch { spawn(process.execPath, [SELF, 'serve'], { detached: true, stdio: 'ignore' }).unref();
              if (await waitSock(3000)) await send(payload); }
      process.exit(0);
    }
    if (cmd === 'drop')  { try { await send('DROP\t' + (args[0] || '')); } catch {} process.exit(0); }
    if (cmd === 'flush') { try { await send('FLUSH'); } catch {} process.exit(0); }
    if (cmd === 'status') {
      try { const r = await send('STATUS'); process.stdout.write((r.split('\t')[1] || '0') + '\n'); }
      catch { process.stdout.write('0\n'); }
      process.exit(0);
    }
    process.stderr.write('usage: secret-agent.mjs serve|get|set|drop|flush|status\n');
    process.exit(2);
  } catch (e) { process.stderr.write('secret-agent: ' + (e?.message || e) + '\n'); process.exit(2); }
}
