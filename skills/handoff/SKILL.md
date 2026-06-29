---
name: handoff
description: >-
  Passer une session de travail Claude Code d'une machine à une autre via git : commit du WIP
  sur une branche sûre + brief HANDOFF.md + commande de reprise prête à coller. Utilise-le quand
  l'utilisateur veut déléguer ou continuer le travail ailleurs (« reprends sur le VPS »,
  « bascule sur ma machine distante ») ou le récupérer (« récupère le travail du VPS »).
  Softcodé via .claude/handoff.json — marche pour tout couple de machines partageant le même remote.
---

# Handoff — déléguer/reprendre une session entre machines

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
3. **Donne la commande de reprise à l'utilisateur** (le bloc imprimé). Si la
   connexion SSH demande un mot de passe, propose de l'exécuter toi-même via le
   skill [[autocli-password]] (fenêtre masquée, secret en RAM seulement) plutôt
   que de lui faire coller quoi que ce soit. Sinon il colle le bloc lui-même.

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
  WIP tombe dans `noDeployToBranches`/`protectedBranches` (cas typique : `main`
  déclenche un déploiement). C'est volontaire — ne contourne pas, corrige la config.
- **Pas de session transférée.** N'annonce pas que « la conversation continue » :
  c'est le code + le brief qui voyagent. Si l'utilisateur veut vraiment l'historique
  littéral du chat, c'est une autre approche (copie du transcript `.jsonl` avec
  slug de chemin identique) — hors périmètre de ce skill.
- **Conflits.** `in` fait un `pull --ff-only` : s'il échoue, il y a divergence —
  préviens l'utilisateur et propose un rebase manuel plutôt que de forcer.

## Commandes
- `init` — crée `.claude/handoff.json`.
- `out [--to <remote>] [-m "msg"] [--exec]` — pousse le WIP + commande de reprise (`--exec` lance le SSH directement).
- `in [<branche>] [--from <remote>]` — récupère le WIP + affiche le brief.
- `check [--to <remote>] [--ssh user@host] [--repo <url>]` — sonde les canaux de transmission de la cible (GitHub/Supabase/Netlify/Drive/secrets) + préconise. iCloud toujours marqué exclu.
- `status` — branche courante, branche WIP cible, remotes connus.

Tout passe par `scripts/handoff.mjs` (Node, zéro dépendance).
