---
name: handoff
description: >-
  Passer une session de travail Claude Code d'une machine à une autre via git, ET piloter une
  roadmap autonome multi-steps sur le VPS avec auto-continuation. Utilise-le quand Leo veut :
  déléguer/reprendre le travail ailleurs (« reprends sur le VPS », « bascule sur ma machine ») ;
  lancer une roadmap autonome sur le VPS depuis le desktop (« lance la roadmap sur le VPS »,
  « exécute ces steps en autonomie », session visible dans code.capitalb.fr) ; ou faire un état
  des lieux des sessions Claude du VPS (« montre-moi les sessions du VPS », « tableau des sessions »).
  Softcodé via .claude/handoff.json — marche pour tout couple de machines partageant le même remote.
---

# Handoff — déléguer/reprendre une session entre machines

## Deux modes
- **Handoff git** (`out`/`in`/`check`, `delegate`) : transporter le code + un brief entre machines. Sections juste en dessous.
- **Roadmap driver** (`roadmap …`) : exécution AUTONOME multi-steps sur le VPS, avec auto-continuation
  (chaque step relance une session fraîche) + tableau de sessions. **→ Section « Mode roadmap driver » en bas.**

## Quand l'utiliser
Deux Claude Code auto-hébergés (ton Mac, un VPS, un autre poste) **ne partagent
aucune synchro cloud**. Ce skill réalise le handoff par **git** : on transporte
le **code** (commit/push WIP) et un **brief de reprise** (`HANDOFF.md`). La
conversation elle-même ne migre pas — on la reconstitue via le brief, ce qui est
le plus robuste (chemins absolus, MCP et checkpoints diffèrent d'une machine à
l'autre).

Déclenche-le dans deux situations symétriques :
- **Départ** : l'utilisateur part / veut continuer ailleurs → `out`.
- **Arrivée** : on démarre Claude Code sur l'autre machine et on reprend → `in`.

## Pré-requis : la config softcodée
Tout est piloté par `.claude/handoff.json` à la racine du repo (jamais de valeurs
en dur dans le skill, pour qu'il soit partageable). Schéma commenté :
`references/config-example.json`.

Si le fichier est absent, **propose de le créer** :
```bash
node ~/.claude/skills/handoff/scripts/handoff.mjs init --to <nom> --ssh user@host --path '~/<repo>'
```
Puis ouvre `.claude/handoff.json` et confirme `ssh` / `path` avec l'utilisateur
(ne devine pas l'hôte). Plusieurs machines = plusieurs entrées sous `remotes`.

Champs clés : `wipBranch` (pattern, placeholders `{repo}` `{user}` `{date}`),
`noDeployToBranches` (branches auto-déployées comme `main`+Netlify — le skill
**refuse** d'y pousser du WIP), `handoffFile`, `remotes`, `defaultRemote`.

## Transmission des docs de la tâche (identifier + préconiser)
Avant de partir, **inventorie ce dont la tâche a besoin** et vérifie que la machine
cible peut l'atteindre. Le handoff transporte le **code + le brief** par git ; tout
le reste, la cible y **accède à distance** — il faut donc le constater, pas le supposer.

Lance le diagnostic automatique :
```bash
node ~/.claude/skills/handoff/scripts/handoff.mjs check --to <remote>
# ou sans config :  … check --ssh user@host [--repo <git-url>]
```
Il sonde la cible canal par canal et **imprime des préconisations**. Grille de lecture :

| Canal | Comment ça se transmet | Si la cible n'y a pas accès |
|---|---|---|
| **Code (GitHub)** | `push`/`pull` sur le remote partagé — le cœur du skill. | Deploy key du repo (alias `~/.ssh/config`) ou `gh auth login`. Sans ça, `in` échoue. |
| **Supabase** | base cloud commune ; la cible se connecte via URL+clés. Schéma = **migrations commitées**. | Clés via `.env` du projet sur la cible, ou `npm i -g supabase`. |
| **Netlify** | rien à transmettre : deploy auto au merge sur `main`. Build = `netlify.toml` commité. | Token seulement si la tâche modifie le dashboard. |
| **Google Drive** | montable sur la cible via `rclone` (mount/sync). | Installer rclone, **ou** relocaliser les docs dans git / un bucket (Supabase Storage, R2). |
| **iCloud** | ❌ **jamais** vers un serveur Linux (pas de client Apple). | **Relocaliser** les docs « iCloud-only » dans git / bucket / Drive **avant** le handoff. |
| **Secrets** | jamais commités ; la cible lit ses `.env` locaux. | Pas de Bitwarden CLI sur le VPS → déposer le `.env` requis d'abord. |

Règle : **tout doc qui ne vit que dans iCloud (ou un drive non monté sur la cible)
doit être relocalisé avant le `out`** — sinon le `claude` distant ne pourra pas le lire.
Si `check` remonte un canal manquant pour la tâche, **préconise le correctif** (le
montrer, pas l'appliquer en douce) avant de poursuivre.

## Procédure — DÉPART (déléguer le travail)
Le point délicat n'est pas git, c'est le **brief**. Le `claude` distant repart
sans contexte : la qualité de la reprise dépend entièrement de `HANDOFF.md`.

0. **`check` la cible** (section ci-dessus) si la tâche touche autre chose que le code
   (Supabase, Drive, secrets…). Relocalise / provisionne ce qui manque avant de continuer.
1. **Écris `HANDOFF.md` à la racine du repo** avant tout. Sois concret et bref :
   - **Objectif** : ce qu'on cherche à faire (1-2 phrases).
   - **Fait** : ce qui est déjà en place dans ce WIP.
   - **À faire ensuite** : la prochaine action précise, fichiers/`fichier:ligne` concernés.
   - **Vérifier** : la commande qui prouve que ça marche (`npm run build`, tests…).
   - **Pièges** : ce qui casserait si on l'ignore (ex. ne pas pousser sur `main`).
2. **Lance le push** :
   ```bash
   node ~/.claude/skills/handoff/scripts/handoff.mjs out --to <remote> -m "WIP: <résumé>"
   ```
   Le script bascule sur la branche WIP (la crée si besoin), commite tout
   (HANDOFF.md inclus), pousse sur `origin`, et **imprime la commande SSH de
   reprise** prête à coller sur la machine distante.
3. **Donne la commande de reprise à l'utilisateur** (le bloc imprimé). Pour Leo,
   la connexion SSH demande un mot de passe : propose de l'exécuter toi-même via
   le skill `autocli-password` (fenêtre macOS masquée, secret en RAM seulement)
   plutôt que de lui faire coller quoi que ce soit. Sinon il colle le bloc lui-même.

## Procédure — ARRIVÉE (reprendre le travail)
Quand Claude Code tourne sur la machine d'arrivée (VPS ou retour Mac) :
```bash
node ~/.claude/skills/handoff/scripts/handoff.mjs in --from <remote>
```
Le script fait `fetch` + `checkout` de la branche WIP + `pull`, puis **affiche
`HANDOFF.md`**. Lis-le, résume l'état à l'utilisateur, et **enchaîne sur la
prochaine action** indiquée — vérifie le build avant d'aller plus loin.

Le retour (VPS → Mac) est strictement symétrique : un `out` depuis le VPS, un
`in` depuis le Mac, sur la même branche WIP.

## Garde-fous (importants)
- **Jamais de WIP sur une branche auto-déployée.** Le script refuse si la branche
  WIP tombe dans `noDeployToBranches`/`protectedBranches` (cas typique de Leo :
  `main` déclenche Netlify). C'est volontaire — ne contourne pas, corrige la config.
- **Pas de session transférée.** N'annonce pas que « la conversation continue » :
  c'est le code + le brief qui voyagent. Si l'utilisateur veut vraiment l'historique
  littéral du chat, c'est une autre approche (copie du transcript `.jsonl` avec
  slug de chemin identique) — hors périmètre de ce skill.
- **Conflits.** `in` fait un `pull --ff-only` : s'il échoue, il y a divergence —
  préviens l'utilisateur et propose un rebase manuel plutôt que de forcer.

## Commandes (handoff git)
- `init` — crée `.claude/handoff.json`.
- `out [--to <remote>] [-m "msg"] [--exec]` — pousse le WIP + commande de reprise (`--exec` lance le SSH directement).
- `in [<branche>] [--from <remote>]` — récupère le WIP + affiche le brief.
- `check [--to <remote>] [--ssh user@host] [--repo <url>]` — sonde les canaux de transmission de la cible (GitHub/Supabase/Netlify/Drive/secrets) + préconise. iCloud toujours marqué exclu.
- `status` — branche courante, branche WIP cible, remotes connus.

Tout passe par `scripts/handoff.mjs` (Node, zéro dépendance).

---

# Mode roadmap driver — exécution autonome multi-steps sur le VPS

## L'idée
Une grosse tâche (refactor en N étages) sature vite la fenêtre de contexte d'une seule session.
Ce mode l'exécute sur le VPS en **auto-continuation** : on itère la roadmap **ici (desktop)**, on la
lance sur le VPS, et chaque session y fait **UN step** puis **relance une session fraîche** pour le
suivant. Chaque passe apparaît comme une session dans **code.capitalb.fr** (cloudcode lit
`~/.claude/projects`) → Léo suit depuis son téléphone et n'intervient qu'aux **frontières** (décisions).

Deux choix de conception assumés (Léo) :
- **Auto-continuation, pas de driver tmux/loop externe** : c'est la session elle-même qui relance la
  suivante via `scripts/roadmap/next.sh`.
- **Tout online, GitHub = source unique de vérité** : le dossier sur le VPS est un **cache jetable**, pas
  du « dev qui vit sur le VPS ». Claude Code a besoin d'un working tree sur disque (il n'édite pas GitHub
  par API), et la seule machine qui exécute la chaîne est le VPS — donc un checkout y est inévitable ;
  mais il est **resynchronisé DUR depuis GitHub au début de chaque session** (`git fetch && git reset
  --hard origin/<branche>`) et **poussé à la fin de chaque step** (`git commit && git push origin
  <branche>`). Rien de valeur ne vit jamais seul sur le VPS ; on peut supprimer le dossier à tout moment
  (`launch` le recrée). Corollaire : **depuis le desktop tu suis toute la progression par `git fetch`**
  sur la branche, sans SSH (SSH seulement pour lancer/piloter). Pousser une **branche isolée ≠ deploy**
  (deploy = merge main → `deploy-vps.sh`), donc c'est sûr.

## Le kit (versionné DANS le repo cible : `scripts/roadmap/`)
- **`PROGRESS.md`** — l'état vivant : `STATE` (RUNNING / AWAITING_DECISION / BLOCKED / DONE),
  `CURRENT_STEP`, la checklist des steps, les règles dures (branche, gate), le **checkpoint intra-step**
  (sous-checklist du step en cours, pour reprendre mi-step après un crash) et le journal append-only.
- **`CONTINUATION_PROMPT.md`** — le prompt de reprise que chaque session relit : charge l'état → fait
  1 step → gate → commit → MAJ PROGRESS → `bash next.sh` si `RUNNING`, sinon halt.
- **`next.sh`** — le **mécanisme concret** d'auto-continuation : détache une `claude -p` FRAÎCHE avec
  `--model opus --dangerously-skip-permissions` (Opus + ignore-permissions **automatiques**), lisant
  CONTINUATION_PROMPT.md. Garde-fou : ne relance pas si STATE ≠ RUNNING.

Tout est softcodé via `.claude/handoff.json` → `remotes.<nom>` : `repoPath` (chemin VPS, cloné à la
volée si absent), `repoSsh` (URL de clone SSH — privé ⇒ pas d'HTTPS), `cloudcodeUrl`, et `roadmap`
(`model`, chemins du kit).

## Workflow
1. **Itérer la roadmap ici (desktop).** Rédige/ajuste `PROGRESS.md` (la checklist des steps, bornés à
   un étage cohérent chacun, avec les FRONTIÈRES marquées) et `CONTINUATION_PROMPT.md`. Si le kit
   n'existe pas encore :
   ```bash
   node ~/.claude/skills/handoff/scripts/handoff.mjs roadmap init \
     --title "…" --objectif "…" --branch <branche> --gate "npm run audit" --step S1
   ```
   Puis **commit + push** la branche (le kit voyage par git).
2. **Lancer sur le VPS** (desktop → VPS : bootstrap repo+branche+kit, démarre la 1re session) :
   ```bash
   node ~/.claude/skills/handoff/scripts/handoff.mjs roadmap launch --to vps --branch <branche>
   ```
   Ça clone le repo sur le VPS si absent, checkout la branche, `chmod +x next.sh`, et démarre. Donne à
   Léo l'URL cloudcode pour suivre. **La chaîne tourne ensuite seule** step après step.
3. **État des lieux** — à la demande, tableau synthétique des sessions Claude du VPS :
   ```bash
   node ~/.claude/skills/handoff/scripts/handoff.mjs roadmap sessions --to vps
   ```
   (Projet · en cours 🟢 · dernière session · activité · tours · nb de sessions.) Et l'état du driver :
   ```bash
   node ~/.claude/skills/handoff/scripts/handoff.mjs roadmap status --to vps
   ```
4. **Frontière (décision de Léo).** Quand STATE passe à `AWAITING_DECISION`, la session s'arrête en
   laissant un tableau markdown (dans `DECISIONS_PENDING.md` + dernier message). Léo répond soit **dans
   la session cloudcode** (elle reprend en interactif), soit **via toi** :
   ```bash
   node ~/.claude/skills/handoff/scripts/handoff.mjs roadmap answer --to vps --decision "go reco 1 ; option B pour 2"
   ```
   (injecte la réponse, remet `STATE: RUNNING`, relance la chaîne).
5. **Arrêter** si besoin : `roadmap stop --to vps` (tue la session claude du repo ; la chaîne ne se
   relance pas).

## Garde-fous roadmap (importants)
- **Branche isolée uniquement.** La roadmap encode ses propres règles dures dans PROGRESS.md : jamais
  `git checkout main`, jamais merge main, jamais `git push`/deploy sauf demande explicite de Léo
  (aligné sur la doctrine « sessions de nuit auto VPS »). Ne les contourne pas.
- **Gate avant chaque commit.** Chaque step passe le gate (ex. `npm run audit` exit 0) sinon revert +
  `STATE: BLOCKED` + halt. Le VPS ne lance QUE le gate synthétique ; la certification sur données/livres
  réels reste desktop (cf. PROGRESS.md du refactor bilan).
- **Ignore-permissions + Opus = choix assumé sur box exposée.** `next.sh` bypasse les permissions et
  force Opus. C'est voulu (fluidité autonome) ; la seule barrière restante est le mot de passe cloudcode.
  Ne l'active que pour une branche isolée avec des règles dures claires.
- **Fin de chaîne silencieuse.** Si une session meurt (blip API) avant d'appeler `next.sh`, la chaîne
  s'arrête **proprement** (rien ne relance) — c'est un halt, pas une corruption. `roadmap status` le
  montre ; relancer = `roadmap launch` (idempotent : reprend depuis CURRENT_STEP, et **mi-step** grâce au
  checkpoint intra-step — les sous-tâches déjà poussées en `wip(…)` ne sont pas refaites ni repayées).

## Commandes (roadmap)
- `roadmap init [--title ..] [--objectif ..] [--branch ..] [--gate ..] [--step ..] [--force]` — scaffold le kit dans `scripts/roadmap/`.
- `roadmap launch [--to <remote>] [--branch ..] [--model opus]` — bootstrap repo+branche sur le VPS + démarre la 1re session.
- `roadmap status [--to <remote>]` — STATE/CURRENT_STEP + session active + derniers commits + tail log.
- `roadmap sessions [--to <remote>]` — tableau synthétique des sessions Claude du VPS.
- `roadmap answer --decision "..." [--to <remote>] [--branch ..]` — injecte la réponse à une frontière + relance.
- `roadmap stop [--to <remote>]` — arrête la chaîne autonome pour ce repo.
