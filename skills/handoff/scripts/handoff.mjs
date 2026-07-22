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
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROADMAP_TPL = join(SKILL_DIR, 'references', 'roadmap');

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
    else if (a === '--branch') f.branch = argv[++i];
    else if (a === '--model') f.model = argv[++i];
    else if (a === '--title') f.title = argv[++i];
    else if (a === '--objectif') f.objectif = argv[++i];
    else if (a === '--gate') f.gate = argv[++i];
    else if (a === '--step') f.step = argv[++i];
    else if (a === '--decision') f.decision = argv[++i];
    else if (a === '--repo-path') f['repo-path'] = argv[++i];
    else if (a === '--repo-ssh') f['repo-ssh'] = argv[++i];
    else if (a === '--force') f.force = true;
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
  // Bug du 23/06/2026 : l'ancienne version basculait sur la branche WIP (checkout)
  // pour y commiter ; le setup « session nuit » revenait ensuite sur main, laissant
  // le working tree VIDÉ de tout le WIP non commité (il n'existait plus que sur la
  // branche). Désormais : on commite sur la branche COURANTE, on pousse ce commit
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
// Sonde la cible et dit, canal par canal, si les docs/déps de la tâche peuvent y être
// transmis. iCloud est TOUJOURS marqué exclu (pas de client Linux). Produit des préconisations.
function cmdCheck(root, flags) {
  let sshTarget = flags.ssh, label = flags.ssh;
  if (!sshTarget) {
    const remote = resolveRemote(loadConfig(root), flags.to);
    if (!remote) die('Aucune cible : passe --ssh user@host ou configure un remote dans .claude/handoff.json.');
    sshTarget = remote.ssh; label = remote.key;
  }
  // repo de la tâche : la cible peut-elle le récupérer ? (origin du repo courant par défaut)
  let originUrl = flags.repo || '';
  if (!originUrl) { try { originUrl = sh('git remote get-url origin'); } catch {} }

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
    `if command -v supabase >/dev/null; then emit SUPABASE_CLI "$(supabase --version 2>/dev/null | head -1)"; else emit SUPABASE_CLI absent; fi`,
    `curl -s -o /dev/null --max-time 8 https://api.supabase.com && emit SUPABASE_NET ok || emit SUPABASE_NET ko`,
    `if command -v netlify >/dev/null; then emit NETLIFY_CLI "$(netlify --version 2>/dev/null | head -1)"; else emit NETLIFY_CLI absent; fi`,
    `curl -s -o /dev/null --max-time 8 https://api.netlify.com && emit NETLIFY_NET ok || emit NETLIFY_NET ko`,
    `if command -v rclone >/dev/null; then emit RCLONE present; emit RCLONE_REMOTES "$(rclone listremotes 2>/dev/null | paste -sd, -)"; else emit RCLONE absent; emit RCLONE_REMOTES ""; fi`,
    `command -v bw >/dev/null && emit BW present || emit BW absent`,
    `command -v node >/dev/null && emit NODE "$(node --version 2>/dev/null)" || emit NODE absent`
  ].join('\n');

  let raw;
  try { raw = sh(`ssh -o BatchMode=yes -o ConnectTimeout=10 ${sshTarget} 'bash -s'`, { input: probe }); }
  catch (e) { die(`Impossible de joindre ${sshTarget} en SSH (BatchMode).\n   ${(e.stderr || e.message || '').toString().trim()}`); }
  const m = {};
  raw.split('\n').forEach(l => { const i = l.indexOf('='); if (i > 0) m[l.slice(0, i)] = l.slice(i + 1); });

  const Y = '✅', W = '⚠️ ', N = '❌';
  console.log(`\n🔍 Canaux de transmission — cible « ${label} » (${sshTarget})\n`);
  const line = (icon, name, detail) => console.log(`  ${icon} ${name.padEnd(24)} ${detail}`);

  if (m.REPO_ACCESS === 'ok') line(Y, 'GitHub — ce repo', 'récupérable (git ls-remote OK)');
  else if (m.REPO_ACCESS === 'ko') line(N, 'GitHub — ce repo', `INACCESSIBLE — ${originUrl} (clé/credential manquant)`);
  else line(W, 'GitHub — ce repo', 'non testé (pas d\'origin local)');
  line(m.GITHUB_NET === 'ok' ? Y : N, 'GitHub — réseau', m.GITHUB_NET === 'ok' ? 'joignable' : 'injoignable');
  line(m.GITHUB_SSH === 'ok' ? Y : W, 'GitHub — clé SSH gén.', m.GITHUB_SSH === 'ok' ? 'authentifiée' : 'pas de clé git@github.com générale');
  line(m.GH === 'ok' ? Y : W, 'gh CLI', m.GH === 'ok' ? 'authentifié' : (m.GH === 'unauth' ? 'présent, non authentifié' : 'absent'));
  line(m.SUPABASE_NET === 'ok' ? Y : N, 'Supabase — réseau', m.SUPABASE_NET === 'ok' ? 'joignable' : 'injoignable');
  line(m.SUPABASE_CLI && m.SUPABASE_CLI !== 'absent' ? Y : W, 'Supabase — CLI', m.SUPABASE_CLI && m.SUPABASE_CLI !== 'absent' ? m.SUPABASE_CLI : 'absent (clés via .env du projet)');
  line(m.NETLIFY_NET === 'ok' ? Y : N, 'Netlify — réseau', m.NETLIFY_NET === 'ok' ? 'joignable' : 'injoignable');
  line(m.NETLIFY_CLI && m.NETLIFY_CLI !== 'absent' ? Y : W, 'Netlify — CLI', m.NETLIFY_CLI && m.NETLIFY_CLI !== 'absent' ? m.NETLIFY_CLI : 'absent (deploy via merge sur main)');
  const remotes = (m.RCLONE_REMOTES || '').trim();
  if (m.RCLONE === 'present') line(remotes ? Y : W, 'Google Drive (rclone)', remotes ? `remotes: ${remotes}` : 'rclone présent, aucun remote');
  else line(N, 'Google Drive (rclone)', 'rclone absent — pas de Drive monté');
  line(m.BW === 'present' ? Y : W, 'Bitwarden CLI', m.BW === 'present' ? 'présent' : 'absent (secrets via .env locaux)');
  line(m.NODE && m.NODE !== 'absent' ? Y : N, 'node (handoff.mjs)', m.NODE && m.NODE !== 'absent' ? m.NODE : 'absent');
  line(N, 'iCloud', 'non supporté sur Linux — relocalise les docs (git / bucket / Drive)');

  const rec = [];
  if (m.REPO_ACCESS === 'ko')
    rec.push(`Repo INACCESSIBLE côté cible : le « in » échouera. Ajoute une deploy key (ssh-keygen + alias dans ~/.ssh/config + clé sur le repo GitHub) OU installe gh puis « gh auth login ».`);
  if (m.RCLONE === 'absent')
    rec.push(`Si la tâche dépend de fichiers Google Drive : installe rclone (« curl https://rclone.org/install.sh | sudo bash ») + « rclone config » ; sinon relocalise ces docs dans le repo ou un bucket (Supabase Storage / R2).`);
  if (m.SUPABASE_CLI === 'absent')
    rec.push(`Migrations Supabase : « npm i -g supabase » sur la cible, ou applique-les via le .env du projet déjà présent.`);
  if (m.BW === 'absent')
    rec.push(`Pas de Bitwarden CLI sur la cible : les secrets doivent venir des .env déjà déposés, pas du coffre.`);
  rec.push(`iCloud n'est jamais un canal vers ce serveur : tout doc « iCloud-only » doit être relocalisé AVANT le handoff.`);

  console.log(`\n📋 Préconisations :`);
  rec.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
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

// ============================================================================
// ROADMAP DRIVER — exécution autonome multi-steps sur le VPS avec AUTO-CONTINUATION.
//
// Modèle (choix Léo : « auto-continuation », pas de driver tmux) :
//   • Le kit vit DANS le repo, versionné : scripts/roadmap/{PROGRESS.md, CONTINUATION_PROMPT.md, next.sh}.
//   • On itère la roadmap sur le desktop (ici), on commit, on pousse.
//   • `roadmap launch` bootstrappe le repo+branche sur le VPS et démarre la 1re session.
//   • Chaque session fait UN step, commit, MAJ PROGRESS.md, puis appelle next.sh → détache une
//     session `claude -p` FRAÎCHE (Opus + skip-permissions) qui relit CONTINUATION_PROMPT.md.
//   • Chaque passe = une session distincte sous ~/.claude/projects → visible dans cloudcode.
//   • Halt volontaire à STATE = AWAITING_DECISION / BLOCKED / DONE (next.sh ne relance pas).
// ============================================================================

function roadmapCfg(remote) {
  const r = (remote && remote.roadmap) || {};
  return {
    model: r.model || 'opus',
    kitDir: r.kitDir || 'scripts/roadmap',
    progressFile: r.progressFile || 'scripts/roadmap/PROGRESS.md',
    promptFile: r.promptFile || 'scripts/roadmap/CONTINUATION_PROMPT.md',
    nextFile: r.nextFile || 'scripts/roadmap/next.sh',
  };
}
// URL cloudcode d'affichage (softcodée : remote.cloudcodeUrl, sinon rien).
function cloudcodeUrl(remote) { return remote && remote.cloudcodeUrl; }

// Petite exécution SSH en shell de LOGIN (indispensable : ~/.profile met claude sur le PATH
// et exporte CLAUDE_CODE_OAUTH_TOKEN, hérité par la session détachée).
function sshLogin(sshTarget, script) {
  return sh(`ssh -o BatchMode=yes -o ConnectTimeout=12 ${sshTarget} 'bash -ls'`, { input: script });
}

// ---------- roadmap init (scaffolding LOCAL du kit dans le repo) ----------
function cmdRoadmapInit(root, flags) {
  const kitDir = join(root, 'scripts', 'roadmap');
  mkdirSync(kitDir, { recursive: true });

  // next.sh : mécanisme d'auto-continuation. Toujours (re)copié depuis le template du skill.
  const nextDst = join(kitDir, 'next.sh');
  copyFileSync(join(ROADMAP_TPL, 'next.sh'), nextDst);
  try { chmodSync(nextDst, 0o755); } catch {}
  ok(`Écrit scripts/roadmap/next.sh (mécanisme d'auto-continuation).`);

  const subst = (s) => s
    .replace(/\{\{TITRE\}\}/g, flags.title || root.split('/').pop() + ' — roadmap autonome')
    .replace(/\{\{OBJECTIF\}\}/g, flags.objectif || flags.title || 'la roadmap')
    .replace(/\{\{BRANCHE\}\}/g, flags.branch || currentBranch())
    .replace(/\{\{GATE\}\}/g, flags.gate || 'npm run audit')
    .replace(/\{\{PREMIER_STEP\}\}/g, flags.step || 'S1')
    .replace(/\{\{DESCRIPTION\}\}/g, 'décris le premier step')
    .replace(/\{\{AUTRES_TESTS\}\}/g, '(liste les tests/oracle exécutables sur la cible)');

  for (const [tpl, dst, label] of [
    ['PROGRESS.template.md', 'PROGRESS.md', "l'état vivant"],
    ['CONTINUATION_PROMPT.template.md', 'CONTINUATION_PROMPT.md', 'le prompt de reprise'],
  ]) {
    const d = join(kitDir, dst);
    if (existsSync(d) && !flags.force) { info(`scripts/roadmap/${dst} existe déjà — laissé tel quel (--force pour écraser).`); continue; }
    writeFileSync(d, subst(readFileSync(join(ROADMAP_TPL, tpl), 'utf8')));
    ok(`Écrit scripts/roadmap/${dst} (${label}).`);
  }
  console.log('\n   Édite PROGRESS.md (checklist des steps) et CONTINUATION_PROMPT.md, commite, pousse,');
  console.log('   puis :  node <skill>/scripts/handoff.mjs roadmap launch --to <remote>\n');
}

// ---------- roadmap launch (desktop → VPS : bootstrap + démarre la 1re session) ----------
function cmdRoadmapLaunch(root, cfg, flags) {
  const remote = resolveRemote(cfg, flags.to);
  if (!remote) die('Aucun remote configuré (remotes / defaultRemote dans .claude/handoff.json).');
  if (!remote.repoPath) die(`Le remote "${remote.key}" n'a pas de repoPath (chemin du repo sur la cible).`);
  const rc = roadmapCfg(remote);
  const branch = flags.branch || currentBranch();
  const model = flags.model || rc.model;
  const repoSsh = remote.repoSsh || flags['repo-ssh'] || '';

  // Le kit doit exister localement et être commité (il voyage par git).
  if (!existsSync(join(root, rc.nextFile)))
    die(`${rc.nextFile} absent en local. Lance d'abord :  node <skill>/scripts/handoff.mjs roadmap init`);

  // Pousser la branche sur origin pour que le VPS la récupère (jamais forcé : branche de travail réelle).
  info(`Pousse ${branch} sur origin…`);
  try { shLoud(`git push origin ${branch}`); }
  catch { die(`git push origin ${branch} a échoué (divergence ?). Résous en local avant de lancer.`); }

  const RP = remote.repoPath;
  // Doctrine « tout online » : GitHub = source unique de vérité. Le dossier VPS est un CACHE
  // JETABLE, resynchronisé DUR sur origin à chaque lancement (git reset --hard). Rien de valeur
  // n'y vit jamais seul — chaque step commit+push vers la branche (voir CONTINUATION_PROMPT).
  const script = [
    `set -e`,
    `command -v claude >/dev/null || { echo "❌ claude absent du PATH (shell login ?)"; exit 1; }`,
    `if [ ! -d "${RP}/.git" ]; then`,
    repoSsh ? `  echo "→ clone ${repoSsh} dans ${RP} (cache jetable)"; git clone -q "${repoSsh}" "${RP}";`
            : `  echo "❌ ${RP} absent et repoSsh non configuré (clone impossible)"; exit 1;`,
    `fi`,
    `cd "${RP}"`,
    `git fetch -q origin`,
    `git checkout -q ${branch} 2>/dev/null || git checkout -q -b ${branch} origin/${branch}`,
    `git reset -q --hard origin/${branch}   # VPS = exactement l'état GitHub (cache jetable, zéro dérive)`,
    `chmod +x ${rc.nextFile} 2>/dev/null || true`,
    `[ -f "${rc.promptFile}" ] || { echo "❌ ${rc.promptFile} absent après checkout"; exit 1; }`,
    `grep -qE '^STATE:[[:space:]]*RUNNING' ${rc.progressFile} || echo "⚠️  STATE n'est pas RUNNING dans ${rc.progressFile} — next.sh ne relancera pas"`,
    `echo "→ démarrage de la 1re session (model=${model})"`,
    `ROADMAP_MODEL=${model} bash ${rc.nextFile}`,
    `echo "PROJECT_SLUG=$(pwd | sed 's#/#-#g')"`,
  ].join('\n');

  console.log(`\n🚀 Roadmap launch → "${remote.key}" (${remote.ssh}), branche ${branch}`);
  let outp;
  try { outp = sshLogin(remote.ssh, script); }
  catch (e) { die(`SSH/lancement a échoué :\n   ${(e.stderr || e.message || '').toString().trim()}`); }
  console.log(outp);
  ok('Chaîne autonome démarrée sur le VPS (auto-continuation via next.sh).');
  const url = cloudcodeUrl(remote);
  if (url) console.log(`\n   👀 Suivre depuis le téléphone : ${url}`);
  console.log(`   État :   node <skill>/scripts/handoff.mjs roadmap status --to ${remote.key}`);
  console.log(`   Sessions : node <skill>/scripts/handoff.mjs roadmap sessions --to ${remote.key}\n`);
}

// ---------- roadmap status (état du driver sur le VPS) ----------
function cmdRoadmapStatus(root, cfg, flags) {
  const remote = resolveRemote(cfg, flags.to);
  if (!remote) die('Aucun remote configuré.');
  if (!remote.repoPath) die(`Le remote "${remote.key}" n'a pas de repoPath.`);
  const rc = roadmapCfg(remote);
  const RP = remote.repoPath;
  const script = [
    `cd "${RP}" 2>/dev/null || { echo "REPO_ABSENT"; exit 0; }`,
    `echo "=== STATE ==="`,
    `grep -E '^(STATE|CURRENT_STEP|LAST_COMMIT|UPDATED):' ${rc.progressFile} 2>/dev/null || echo "(pas de PROGRESS.md)"`,
    `echo "=== RUNNING ==="`,
    `RP="$(pwd)"; found=""`,
    `for pid in $(pgrep -x claude 2>/dev/null); do c=$(readlink /proc/$pid/cwd 2>/dev/null); [ "$c" = "$RP" ] && { echo "session claude EN COURS (pid $pid)"; found=1; }; done`,
    `[ -z "$found" ] && echo "aucune session claude active dans ce repo"`,
    `echo "=== 3 derniers commits ==="`,
    `git log --oneline -3 2>/dev/null`,
    `echo "=== tail dernier log roadmap ==="`,
    `L=$(ls -t ~/.handoff/$(basename "$RP")/roadmap-*.log 2>/dev/null | head -1); [ -n "$L" ] && tail -n 8 "$L" || echo "(aucun log)"`,
  ].join('\n');
  console.log(`\n📍 Roadmap status — "${remote.key}" (${RP})`);
  console.log(sshLogin(remote.ssh, script));
}

// ---------- roadmap sessions (tableau synthétique des sessions Claude du VPS) ----------
function cmdRoadmapSessions(root, cfg, flags) {
  const remote = resolveRemote(cfg, flags.to);
  if (!remote) die('Aucun remote configuré.');
  // Émet des lignes machine : P|slug|nSessions|lastSid|lastEpoch|lastTurns  et  R|pid|cwd
  const script = [
    `for d in ~/.claude/projects/*/; do`,
    `  [ -d "$d" ] || continue`,
    `  slug=$(basename "$d")`,
    `  n=$(ls "$d"*.jsonl 2>/dev/null | wc -l | tr -d ' ')`,
    `  [ "$n" = "0" ] && continue`,
    `  f=$(ls -t "$d"*.jsonl 2>/dev/null | head -1)`,
    `  printf 'P|%s|%s|%s|%s|%s\\n' "$slug" "$n" "$(basename "$f" .jsonl)" "$(stat -c %Y "$f")" "$(wc -l < "$f" | tr -d ' ')"`,
    `done`,
    `for pid in $(pgrep -x claude 2>/dev/null); do printf 'R|%s|%s\\n' "$pid" "$(readlink /proc/$pid/cwd 2>/dev/null)"; done`,
    `printf 'NOW|%s\\n' "$(date +%s)"`,
  ].join('\n');
  let raw;
  try { raw = sshLogin(remote.ssh, script); }
  catch (e) { die(`SSH a échoué :\n   ${(e.stderr || e.message || '').toString().trim()}`); }

  const projects = [];
  const running = new Set(); // slugs
  let now = Math.floor(Date.now() / 1000);
  for (const l of raw.split('\n')) {
    const p = l.split('|');
    if (p[0] === 'P') projects.push({ slug: p[1], n: +p[2], sid: p[3], epoch: +p[4], turns: +p[5] });
    else if (p[0] === 'R' && p[2]) running.add(p[2].replace(/\//g, '-'));
    else if (p[0] === 'NOW') now = +p[1];
  }
  if (!projects.length) { console.log('\n(aucune session Claude sur le VPS)\n'); return; }

  const ago = (e) => {
    const s = Math.max(0, now - e);
    if (s < 3600) return `${Math.floor(s / 60)} min`;
    if (s < 86400) return `${Math.floor(s / 3600)} h`;
    return `${Math.floor(s / 86400)} j`;
  };
  const nice = (slug) => slug.replace(/^-home-leo-?/, '') || '(racine ~)';
  projects.sort((a, b) => b.epoch - a.epoch);

  const rows = projects.map(p => ({
    proj: nice(p.slug),
    run: running.has(p.slug) ? '🟢 oui' : '—',
    sid: p.sid.slice(0, 8),
    last: ago(p.epoch),
    turns: String(p.turns),
    n: String(p.n),
  }));
  const cols = [
    ['Projet', 'proj'], ['En cours', 'run'], ['Dernière session', 'sid'],
    ['Activité', 'last'], ['Tours', 'turns'], ['# sess.', 'n'],
  ];
  const w = cols.map(([h, k]) => Math.max(h.length, ...rows.map(r => r[k].length)));
  const fmt = (cells) => '| ' + cells.map((c, i) => c.padEnd(w[i])).join(' | ') + ' |';
  console.log(`\n🖥️  Sessions Claude — VPS "${remote.key}"\n`);
  console.log(fmt(cols.map(c => c[0])));
  console.log('| ' + w.map(x => '-'.repeat(x)).join(' | ') + ' |');
  rows.forEach(r => console.log(fmt(cols.map(c => r[c[1]]))));
  const active = rows.filter(r => r.run !== '—').length;
  console.log(`\n   ${projects.length} projet(s), ${active} session(s) active(s).\n`);
}

// ---------- roadmap stop (arrête la chaîne autonome pour ce repo) ----------
function cmdRoadmapStop(root, cfg, flags) {
  const remote = resolveRemote(cfg, flags.to);
  if (!remote) die('Aucun remote configuré.');
  if (!remote.repoPath) die(`Le remote "${remote.key}" n'a pas de repoPath.`);
  const RP = remote.repoPath;
  const script = [
    `RP=$(cd "${RP}" 2>/dev/null && pwd)`,
    `[ -z "$RP" ] && { echo "REPO_ABSENT"; exit 0; }`,
    `k=0`,
    `for pid in $(pgrep -x claude 2>/dev/null); do c=$(readlink /proc/$pid/cwd 2>/dev/null); [ "$c" = "$RP" ] && { kill "$pid" && echo "arrêté pid $pid"; k=1; }; done`,
    `[ "$k" = "0" ] && echo "aucune session claude active dans $RP (rien à arrêter)"`,
  ].join('\n');
  console.log(`\n🛑 Roadmap stop — "${remote.key}" (${RP})`);
  console.log(sshLogin(remote.ssh, script));
  info('La chaîne ne se relancera pas (une session tuée en cours de step n\'appelle pas next.sh).');
}

// ---------- roadmap answer (injecte la réponse de Léo à une frontière + relance) ----------
function cmdRoadmapAnswer(root, cfg, flags) {
  const remote = resolveRemote(cfg, flags.to);
  if (!remote) die('Aucun remote configuré.');
  if (!remote.repoPath) die(`Le remote "${remote.key}" n'a pas de repoPath.`);
  if (!flags.decision) die('Précise la réponse : --decision "go reco 1, choix B pour 2, …".');
  const rc = roadmapCfg(remote);
  const branch = flags.branch || currentBranch();
  const model = flags.model || rc.model;
  const RP = remote.repoPath;
  const ansFile = join(rc.kitDir, 'DECISIONS_ANSWERED.md');
  const decision = shEsc(flags.decision);
  const script = [
    `cd "${RP}" 2>/dev/null || { echo "REPO_ABSENT"; exit 1; }`,
    `git checkout -q ${branch} 2>/dev/null || true`,
    `{ echo ""; echo "## Réponse Léo $(date '+%Y-%m-%d %H:%M')"; echo '${decision}'; } >> ${ansFile}`,
    `sed -i -E 's/^STATE:.*/STATE: RUNNING/' ${rc.progressFile}`,
    `git add -A && git commit -q -m "roadmap: réponse frontière de Léo" || true`,
    `echo "→ relance session fraîche (model=${model})"`,
    `ROADMAP_MODEL=${model} bash ${rc.nextFile}`,
  ].join('\n');
  console.log(`\n💬 Réponse frontière → "${remote.key}", branche ${branch}`);
  console.log(sshLogin(remote.ssh, script));
  ok('Réponse injectée, STATE=RUNNING, chaîne relancée.');
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
  case 'roadmap': {
    const sub = flags._[1];
    const cfg = () => loadConfig(root);
    switch (sub) {
      case 'init':     cmdRoadmapInit(root, flags); break;
      case 'launch':   cmdRoadmapLaunch(root, cfg(), flags); break;
      case 'status':   cmdRoadmapStatus(root, cfg(), flags); break;
      case 'sessions': cmdRoadmapSessions(root, cfg(), flags); break;
      case 'stop':     cmdRoadmapStop(root, cfg(), flags); break;
      case 'answer':   cmdRoadmapAnswer(root, cfg(), flags); break;
      default:
        console.log(`roadmap — exécution autonome multi-steps sur le VPS (auto-continuation)

  roadmap init                                       scaffold scripts/roadmap/{PROGRESS,CONTINUATION_PROMPT,next.sh}
                   [--title ..] [--objectif ..] [--branch ..] [--gate ..] [--step ..] [--force]
  roadmap launch   [--to <remote>] [--branch ..] [--model opus]   bootstrap repo+branche sur le VPS + démarre la 1re session
  roadmap status   [--to <remote>]                   STATE/CURRENT_STEP + session active + derniers commits + log
  roadmap sessions [--to <remote>]                   tableau synthétique des sessions Claude du VPS
  roadmap answer   --decision "..." [--to <remote>]  injecte la réponse à une frontière + relance la chaîne
  roadmap stop     [--to <remote>]                   arrête la chaîne autonome pour ce repo`);
    }
    break;
  }
  default:
    console.log(`handoff.mjs — handoff git d'une session Claude Code entre machines

  init             [--to <nom>] [--ssh user@host] [--path ~/repo]   crée .claude/handoff.json
  out              [--to <remote>] [-m "message"] [--exec]          pousse le WIP + commande de reprise (manuelle)
  delegate         --task "..." [--to <remote>] [--max-turns N]     pousse le WIP + lance un agent AUTONOME sur le VPS
  delegate-status  [--to <remote>]                                  état de l'agent distant (en cours / terminé + log)
  in               [<branche>] [--from <remote>]                    récupère le WIP + affiche HANDOFF
  check            [--to <remote>] [--ssh user@host] [--repo <url>] sonde les canaux de transmission de la cible + préconise
  status                                                   état courant
  roadmap <sub>    init|launch|status|sessions|answer|stop         exécution autonome multi-steps sur le VPS (auto-continuation)

Config : .claude/handoff.json (par repo). Voir references/config-example.json.`);
}
