#!/usr/bin/env node
// handoff.mjs — mécanique git déterministe du skill "handoff".
// Aucune dépendance externe. Toute la config vient de .claude/handoff.json (softcodé).
//
// Sous-commandes :
//   init                       Génère un .claude/handoff.json de départ (interactif léger via flags)
//   out  [--to <remote>] [-m "msg"]   Pousse le WIP sur une branche sûre + imprime la commande de reprise
//   in   [--from <remote>]            Récupère le WIP sur la machine d'arrivée + affiche le HANDOFF
//   status                     Montre branche courante, branche WIP cible, remotes connus
//
// Le script NE déduit jamais rien en dur : pattern de branche, branches protégées,
// hôtes SSH et chemins distants sont tous lus depuis la config du repo.

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------- utils ----------
const sh = (cmd, opts = {}) =>
  execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts }).trim();
const shLoud = (cmd) => execSync(cmd, { stdio: 'inherit' });
const die = (msg) => { console.error(`\n❌ ${msg}\n`); process.exit(1); };
const ok = (msg) => console.log(`✅ ${msg}`);
const info = (msg) => console.log(`   ${msg}`);

function parseFlags(argv) {
  const f = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--to' || a === '--from') f[a.slice(2)] = argv[++i];
    else if (a === '-m' || a === '--message') f.message = argv[++i];
    else if (a === '--exec') f.exec = true;
    else if (a === '--ssh') f.ssh = argv[++i];
    else if (a === '--repo') f.repo = argv[++i];
    else if (a === '--path') f.path = argv[++i];
    else if (a === '--task') f.task = argv[++i];
    else if (a === '--max-turns') f['max-turns'] = argv[++i];
    else f._.push(a);
  }
  return f;
}

function repoRoot() {
  try { return sh('git rev-parse --show-toplevel'); }
  catch { die('Pas dans un dépôt git.'); }
}

function configPath(root) { return join(root, '.claude', 'handoff.json'); }

function loadConfig(root) {
  const p = configPath(root);
  if (!existsSync(p)) die(`Config absente : ${p}\n   Lance d'abord :  node <skill>/scripts/handoff.mjs init`);
  try { return JSON.parse(readFileSync(p, 'utf8')); }
  catch (e) { die(`Config illisible (${p}) : ${e.message}`); }
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '')   // retire les accents
          .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function gitUser() {
  try { return slug(sh('git config user.name')) || 'user'; }
  catch { return slug(process.env.USER || 'user') || 'user'; }
}

function fillPattern(pattern, root) {
  const repo = root.split('/').pop();
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return pattern
    .replace(/\{repo\}/g, repo)
    .replace(/\{user\}/g, gitUser())
    .replace(/\{date\}/g, date);
}

function resolveRemote(cfg, name) {
  const remotes = cfg.remotes || {};
  const key = name || cfg.defaultRemote || Object.keys(remotes)[0];
  if (!key) return null;
  const r = remotes[key];
  if (!r) die(`Remote "${key}" inconnu. Connus : ${Object.keys(remotes).join(', ') || '(aucun)'}`);
  return { key, ...r };
}

function currentBranch() {
  try { const b = sh('git branch --show-current'); return b || '(aucun commit)'; }
  catch { return '(aucun commit)'; }
}
function branchExists(b) { try { sh(`git rev-parse --verify ${b}`); return true; } catch { return false; } }
function remoteBranchExists(b) { try { return !!sh(`git ls-remote --heads origin ${b}`); } catch { return false; } }

// ---------- init ----------
function cmdInit(root, flags) {
  const p = configPath(root);
  if (existsSync(p) && !flags._.includes('--force')) die(`${p} existe déjà (utilise --force pour écraser).`);
  mkdirSync(join(root, '.claude'), { recursive: true });
  const repo = root.split('/').pop();
  const cfg = {
    wipBranch: 'handoff/wip-{repo}-{user}',
    protectedBranches: ['main', 'master', 'production'],
    noDeployToBranches: ['main', 'master'],
    handoffFile: 'HANDOFF.md',
    defaultRemote: flags.to || 'remote',
    remotes: {
      [flags.to || 'remote']: {
        ssh: flags.ssh || 'user@host',
        path: flags.path || `~/${repo}`,
        claudeBin: 'claude',
        resumePrompt: 'Lis HANDOFF.md à la racine du repo et reprends le travail décrit. Vérifie le build avant de continuer.'
      }
    }
  };
  writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
  ok(`Config créée : ${p}`);
  info('Édite-la pour renseigner ssh/path de ta (tes) machine(s) distante(s).');
  info('Astuce : tu peux ajouter plusieurs remotes sous "remotes".');
}

// ---------- guards ----------
function guardBranch(cfg, wip) {
  const prot = new Set([...(cfg.protectedBranches || []), ...(cfg.noDeployToBranches || [])]);
  if (prot.has(wip))
    die(`La branche WIP calculée ("${wip}") est protégée / auto-déployée.\n   Le handoff ne pousse JAMAIS du WIP là-dessus. Change wipBranch dans la config.`);
}

// ---------- coeur partagé : pousser le WIP sur la branche sûre ----------
function ensureWipPushed(root, cfg, wip, message) {
  guardBranch(cfg, wip);
  const handoffFile = cfg.handoffFile || 'HANDOFF.md';
  if (!existsSync(join(root, handoffFile)))
    info(`⚠️  ${handoffFile} introuvable — idéalement le brief (état + prochaines étapes) y est écrit AVANT.`);

  // ⚠️ Sauvegarde NON DESTRUCTIVE — on ne fait JAMAIS `git checkout <wip>`.
  // Piège évité : une version qui bascule sur la branche WIP (checkout) pour y
  // commiter, puis qu'un autre processus revienne sur main, laisse le working tree
  // VIDÉ de tout le WIP non commité (il n'existe plus que sur la branche).
  // Désormais : on commite sur la branche COURANTE, on pousse ce commit
  // vers la branche WIP distante, puis on défait le commit local (reset --mixed) →
  // HEAD et working tree reviennent exactement à l'état d'avant, WIP intact et non
  // commité. La branche courante ne change jamais.
  // Compromis assumé : si la machine distante et la locale avancent toutes deux, il
  // faudra merger — bien préférable à perdre du travail local par surprise.
  const branchNow = currentBranch() || '(HEAD détaché)';
  if (!sh('git status --porcelain')) {
    info('Rien à sauvegarder (working tree propre).');
    shLoud(`git push -f origin HEAD:refs/heads/${wip}`);
    ok(`origin/${wip} aligné sur HEAD — branche courante "${branchNow}" inchangée.`);
    return;
  }
  const pre = sh('git rev-parse HEAD');
  shLoud('git add -A');
  const msg = (message || `handoff: WIP ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`).replace(/"/g, '\\"');
  shLoud(`git commit -q -m "${msg}"`);
  // Pousse le commit de snapshot vers la branche WIP distante (force : branche de
  // transport jetable entre machines). La machine distante fait ensuite
  // `git fetch && git checkout <wip>` pour la récupérer.
  shLoud(`git push -f origin HEAD:refs/heads/${wip}`);
  ok(`Poussé sur origin/${wip}`);
  // Restaure : HEAD et working tree exactement comme avant (WIP non commité).
  shLoud(`git reset -q --mixed ${pre}`);
  ok(`Working tree préservé sur "${branchNow}" — WIP non commité, intact.`);
}

// chemin de logs distant (HORS du repo, pour que l'agent ne le commite pas)
function remoteLogDir(root) { return `~/.handoff/${root.split('/').pop()}`; }
function shEsc(s) { return s.replace(/'/g, "'\\''"); }

// ---------- out (départ — reprise manuelle) ----------
function cmdOut(root, cfg, flags) {
  const wip = fillPattern(cfg.wipBranch || 'handoff/wip-{repo}-{user}', root);
  const remote = resolveRemote(cfg, flags.to);
  ensureWipPushed(root, cfg, wip, flags.message);

  if (remote) {
    const rp = shEsc(remote.resumePrompt || 'Lis HANDOFF.md et reprends le travail.');
    const claudeBin = remote.claudeBin || 'claude';
    const remoteCmd = `cd ${remote.path} && git fetch origin && git checkout ${wip} && git pull --ff-only && ${claudeBin} '${rp}'`;
    const sshCmd = `ssh -t ${remote.ssh} "${remoteCmd}"`;
    console.log('\n────────────────────────────────────────────');
    console.log(`📦 Reprendre sur "${remote.key}" (${remote.ssh}) — copie/colle :\n`);
    console.log('  ' + sshCmd + '\n');
    console.log('  Ou, depuis un shell déjà sur la machine distante :');
    console.log(`  ${remoteCmd}`);
    console.log('────────────────────────────────────────────\n');
    if (flags.exec) { info('--exec : lancement SSH…'); shLoud(sshCmd); }
  } else {
    console.log(`\n📦 Sur l'autre machine :  git fetch && git checkout ${wip} && git pull --ff-only\n`);
  }
}

// ---------- delegate (départ — exécution AUTONOME headless sur le VPS) ----------
function cmdDelegate(root, cfg, flags) {
  const task = flags.task || flags.message;
  if (!task) die('Précise la tâche : --task "ce que le VPS doit faire de façon autonome".');
  const wip = fillPattern(cfg.wipBranch || 'handoff/wip-{repo}-{user}', root);
  const remote = resolveRemote(cfg, flags.to);
  if (!remote) die('Aucun remote configuré (remotes / defaultRemote dans .claude/handoff.json).');

  // 1) brief versionné + push du WIP
  const handoffFile = cfg.handoffFile || 'HANDOFF.md';
  writeFileSync(join(root, handoffFile),
    `# HANDOFF — tâche déléguée au VPS\n\n**Tâche** : ${task}\n\n**Consigne** : exécuter de façon autonome sur la branche \`${wip}\`, puis commiter et pousser.\n`);
  ensureWipPushed(root, cfg, wip, flags.message || `delegate: ${task}`.slice(0, 72));

  // 2) prompt autonome
  const claudeBin = remote.claudeBin || 'claude';
  const dflags = remote.delegateFlags || '--allowedTools "Bash,Read,Write,Edit,Glob,Grep" --permission-mode acceptEdits';
  const maxTurns = ` --max-turns ${flags['max-turns'] || 40}`;
  const prompt = [
    `Tu es sur le VPS, dans un clone du repo, sur la branche git \`${wip}\`. Travaille de façon AUTONOME (aucun humain ne répondra).`,
    ``,
    `TÂCHE :`,
    task,
    ``,
    `CONSIGNES :`,
    `- Lis HANDOFF.md pour le contexte. Respecte les conventions du repo (CLAUDE.md s'il existe).`,
    `- Ne touche JAMAIS à la branche main. Reste sur \`${wip}\`.`,
    `- Quand tu as fini : commite avec un message clair puis « git push origin ${wip} ».`,
    `- Si tu te bloques ou t'arrêtes en cours : écris l'état restant dans HANDOFF.md, commite et pousse quand même.`
  ].join('\n');

  // 3) lancement détaché sur le VPS (survit à la déconnexion SSH)
  const logDir = remoteLogDir(root);
  const remoteScript = [
    `set -e`,
    `mkdir -p ${logDir}`,
    `cd ${remote.path}`,
    `git fetch -q origin && git checkout -qB ${wip} origin/${wip}`,  // clone jetable : force la branche locale = origin/wip
    `cat > ${logDir}/task.txt <<'HANDOFF_TASK'`,
    prompt,
    `HANDOFF_TASK`,
    `TS=$(date +%Y%m%d-%H%M%S)`,
    `LOG=${logDir}/run-$TS.log`,
    `setsid nohup ${claudeBin} -p "$(cat ${logDir}/task.txt)" ${dflags}${maxTurns} >"$LOG" 2>&1 </dev/null &`,
    `echo $! > ${logDir}/run.pid`,
    `echo "PID=$(cat ${logDir}/run.pid)"`,
    `echo "LOG=$LOG"`
  ].join('\n');

  console.log(`\n🤖 Délégation autonome → "${remote.key}" (${remote.ssh}), branche ${wip}`);
  const outp = sh(`ssh -o BatchMode=yes ${remote.ssh} 'bash -s'`, { input: remoteScript });
  console.log(outp);
  ok('Agent lancé sur le VPS (détaché). Il commitera/poussera son résultat sur la branche.');
  console.log(`\n   Suivre :   node <skill>/scripts/handoff.mjs delegate-status --to ${remote.key}`);
  console.log(`   Récupérer une fois fini :  git fetch && git checkout ${wip}\n`);
}

// ---------- delegate-status (surveillance) ----------
function cmdDelegateStatus(root, cfg, flags) {
  const wip = fillPattern(cfg.wipBranch || 'handoff/wip-{repo}-{user}', root);
  const remote = resolveRemote(cfg, flags.to);
  if (!remote) die('Aucun remote configuré.');
  const logDir = remoteLogDir(root);
  const remoteScript = [
    `cd ${remote.path} 2>/dev/null || exit 0`,
    `PID=$(cat ${logDir}/run.pid 2>/dev/null || echo "")`,
    `if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then echo "ÉTAT: EN COURS (pid $PID)"; else echo "ÉTAT: TERMINÉ"; fi`,
    `LOG=$(ls -t ${logDir}/run-*.log 2>/dev/null | head -1)`,
    `echo "--- dernières lignes du log ($LOG) ---"; tail -n 15 "$LOG" 2>/dev/null`,
    `echo "--- derniers commits sur ${wip} ---"; git log --oneline -5 ${wip} 2>/dev/null`
  ].join('\n');
  const outp = sh(`ssh -o BatchMode=yes ${remote.ssh} 'bash -s'`, { input: remoteScript });
  console.log(outp);
}

// ---------- in (arrivée) ----------
function cmdIn(root, cfg, flags) {
  // si --from désigne un remote, on en déduit juste la branche WIP (même pattern, même user attendu)
  const wip = flags._[1] && flags._[1].includes('/')
    ? flags._[1]
    : fillPattern(cfg.wipBranch || 'handoff/wip-{repo}-{user}', root);

  if (!remoteBranchExists(wip))
    die(`Branche distante origin/${wip} introuvable.\n   Vérifie le nom (wipBranch) ou que le 'out' a bien poussé.`);

  shLoud('git fetch origin');
  if (currentBranch() !== wip) shLoud(`git checkout ${wip}`);
  shLoud('git pull --ff-only');
  ok(`Repris sur ${wip}`);

  const handoffFile = cfg.handoffFile || 'HANDOFF.md';
  const hp = join(root, handoffFile);
  if (existsSync(hp)) {
    console.log(`\n──────── ${handoffFile} ────────\n`);
    console.log(readFileSync(hp, 'utf8'));
    console.log('────────────────────────────────\n');
  } else {
    info(`Pas de ${handoffFile} dans ce commit.`);
  }
}

// ---------- check (diagnostic des canaux de transmission sur la machine cible) ----------
// Sonde la cible : d'abord les canaux UNIVERSELS d'un handoff git (git, gh, accès au dépôt, node),
// puis les canaux ADDITIONNELS que l'utilisateur déclare dans cfg.checkChannels. AUCUN fournisseur
// n'est codé en dur — chacun décrit son propre stack (base, déploiement, stockage, secrets…).
function cmdCheck(root, flags) {
  const cfg = loadConfig(root);
  let sshTarget = flags.ssh, label = flags.ssh;
  if (!sshTarget) {
    const remote = resolveRemote(cfg, flags.to);
    if (!remote) die('Aucune cible : passe --ssh user@host ou configure un remote dans .claude/handoff.json.');
    sshTarget = remote.ssh; label = remote.key;
  }
  // repo de la tâche : la cible peut-elle le récupérer ? (origin du repo courant par défaut)
  let originUrl = flags.repo || '';
  if (!originUrl) { try { originUrl = sh('git remote get-url origin'); } catch {} }

  // Canaux additionnels, 100 % softcodés. Chaque entrée : { name, cmd, okWhen?, recommend? }.
  // `cmd` est exécuté sur la cible et doit imprimer un mot d'état (ex. "ok", une version, "absent").
  const channels = Array.isArray(cfg.checkChannels) ? cfg.checkChannels : [];

  const probe = [
    `emit(){ printf '%s=%s\\n' "$1" "$2"; }`,
    `command -v git >/dev/null && emit GIT "$(git --version 2>/dev/null | awk '{print $3}')" || emit GIT absent`,
    `if command -v gh >/dev/null; then gh auth status >/dev/null 2>&1 && emit GH ok || emit GH unauth; else emit GH absent; fi`,
    `git ls-remote https://github.com/git/git.git HEAD >/dev/null 2>&1 && emit GITHUB_NET ok || emit GITHUB_NET ko`,
    // -n : stdin depuis /dev/null, sinon ce ssh (s'il s'authentifie) avale le reste du script lu par « bash -s »
    `ssh -n -o BatchMode=yes -o ConnectTimeout=8 -o StrictHostKeyChecking=accept-new -T git@github.com >/dev/null 2>&1; [ $? -eq 1 ] && emit GITHUB_SSH ok || emit GITHUB_SSH denied`,
    originUrl
      ? `git ls-remote ${JSON.stringify(originUrl)} HEAD >/dev/null 2>&1 && emit REPO_ACCESS ok || emit REPO_ACCESS ko`
      : `emit REPO_ACCESS skip`,
    `command -v node >/dev/null && emit NODE "$(node --version 2>/dev/null)" || emit NODE absent`,
    ...channels.map((c, i) => `emit CH${i} "$(${c.cmd} 2>/dev/null || echo ko)"`)
  ].join('\n');

  let raw;
  try { raw = sh(`ssh -o BatchMode=yes -o ConnectTimeout=10 ${sshTarget} 'bash -s'`, { input: probe }); }
  catch (e) { die(`Impossible de joindre ${sshTarget} en SSH (BatchMode).\n   ${(e.stderr || e.message || '').toString().trim()}`); }
  const m = {};
  raw.split('\n').forEach(l => { const i = l.indexOf('='); if (i > 0) m[l.slice(0, i)] = l.slice(i + 1); });

  const Y = '✅', W = '⚠️ ', N = '❌';
  console.log(`\n🔍 Canaux de transmission — cible « ${label} » (${sshTarget})\n`);
  const line = (icon, name, detail) => console.log(`  ${icon} ${String(name).padEnd(26)} ${detail}`);

  // --- canaux universels (tout handoff git) ---
  if (m.REPO_ACCESS === 'ok') line(Y, 'Dépôt (ce repo git)', 'récupérable (git ls-remote OK)');
  else if (m.REPO_ACCESS === 'ko') line(N, 'Dépôt (ce repo git)', `INACCESSIBLE — ${originUrl} (clé/credential manquant)`);
  else line(W, 'Dépôt (ce repo git)', 'non testé (pas d\'origin local)');
  line(m.GITHUB_NET === 'ok' ? Y : N, 'Hôte git — réseau', m.GITHUB_NET === 'ok' ? 'joignable' : 'injoignable');
  line(m.GITHUB_SSH === 'ok' ? Y : W, 'Hôte git — clé SSH', m.GITHUB_SSH === 'ok' ? 'authentifiée' : 'pas de clé SSH générale');
  line(m.GH === 'ok' ? Y : W, 'gh CLI', m.GH === 'ok' ? 'authentifié' : (m.GH === 'unauth' ? 'présent, non authentifié' : 'absent'));
  line(m.NODE && m.NODE !== 'absent' ? Y : N, 'node (handoff.mjs)', m.NODE && m.NODE !== 'absent' ? m.NODE : 'absent');

  // --- canaux additionnels déclarés par l'utilisateur ---
  const channelGood = (c, v) => {
    if (c.okWhen !== undefined) return [].concat(c.okWhen).includes(v);
    return !!v && v !== 'ko' && v !== 'absent';
  };
  channels.forEach((c, i) => {
    const v = m[`CH${i}`] || '';
    line(channelGood(c, v) ? Y : W, c.name || `canal ${i + 1}`, v || '—');
  });

  const rec = [];
  if (m.REPO_ACCESS === 'ko')
    rec.push(`Dépôt INACCESSIBLE côté cible : le « in » échouera. Ajoute une deploy key (ssh-keygen + alias dans ~/.ssh/config + clé sur le repo) OU installe gh puis « gh auth login ».`);
  channels.forEach((c, i) => {
    if (!channelGood(c, m[`CH${i}`] || '') && c.recommend) rec.push(c.recommend);
  });
  rec.push(`Tout document qui ne vit que dans un stockage non monté sur la cible (cloud sans client, partage local) doit être relocalisé (git / bucket) AVANT le handoff.`);

  if (rec.length) {
    console.log(`\n📋 Préconisations :`);
    rec.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  }
  console.log('');
}

// ---------- status ----------
function cmdStatus(root, cfg) {
  const wip = fillPattern(cfg.wipBranch || 'handoff/wip-{repo}-{user}', root);
  console.log(`repo        : ${root.split('/').pop()}  (${root})`);
  console.log(`branche     : ${currentBranch()}`);
  console.log(`WIP cible   : ${wip}  ${remoteBranchExists(wip) ? '(existe sur origin)' : '(pas encore poussée)'}`);
  console.log(`handoffFile : ${cfg.handoffFile || 'HANDOFF.md'}`);
  console.log(`remotes     : ${Object.keys(cfg.remotes || {}).join(', ') || '(aucun)'}`);
  console.log(`default     : ${cfg.defaultRemote || '(aucun)'}`);
}

// ---------- main ----------
const flags = parseFlags(process.argv.slice(2));
const cmd = flags._[0];
const root = repoRoot();

switch (cmd) {
  case 'init':            cmdInit(root, flags); break;
  case 'out':             cmdOut(root, loadConfig(root), flags); break;
  case 'delegate':        cmdDelegate(root, loadConfig(root), flags); break;
  case 'delegate-status': cmdDelegateStatus(root, loadConfig(root), flags); break;
  case 'in':              cmdIn(root, loadConfig(root), flags); break;
  case 'check':           cmdCheck(root, flags); break;
  case 'status':          cmdStatus(root, loadConfig(root)); break;
  default:
    console.log(`handoff.mjs — handoff git d'une session Claude Code entre machines

  init             [--to <nom>] [--ssh user@host] [--path ~/repo]   crée .claude/handoff.json
  out              [--to <remote>] [-m "message"] [--exec]          pousse le WIP + commande de reprise (manuelle)
  delegate         --task "..." [--to <remote>] [--max-turns N]     pousse le WIP + lance un agent AUTONOME sur le VPS
  delegate-status  [--to <remote>]                                  état de l'agent distant (en cours / terminé + log)
  in               [<branche>] [--from <remote>]                    récupère le WIP + affiche HANDOFF
  check            [--to <remote>] [--ssh user@host] [--repo <url>] sonde les canaux de transmission de la cible + préconise
  status                                                   état courant

Config : .claude/handoff.json (par repo). Voir references/config-example.json.`);
}
