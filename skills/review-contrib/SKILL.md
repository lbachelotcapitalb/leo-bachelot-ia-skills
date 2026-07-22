---
name: review-contrib
description: >-
  Contrôler, auditer et intégrer proprement le commit/la branche/la PR d'un collaborateur
  (souvent depuis un fork) avant merge dans main. Utilise-le quand Leo dit « un collaborateur
  a poussé un commit », « regarde la branche/PR de X », « audite/teste cette contribution »,
  « comment adopter ce commit », ou veut un workflow de revue rapide. Couvre : découverte du
  commit (fork/branche/PR), audit de conflits (merge-tree), validation (npm run audit : lint +
  secrets + tests + build + bundle), audit de code par sous-agent, test isolé en worktree
  (jamais sur main = prod), puis ajustement et merge final. Softcodé par repo.
---

# review-contrib — adopter vite & sûrement les contributions d'un collaborateur

## Principe immuable
**On ne teste / n'ajuste JAMAIS sur `main`.** Sur les repos de Leo, `main` = production
(auto-deploy Netlify). Toute revue se fait sur une **branche `review/*` dans un worktree
séparé** (un 2ᵉ dossier ; le checkout principal reste sur `main`, intact). Le merge dans
`main` n'arrive **qu'une fois tout vert et validé par Leo**. Pas de « pousser sur main puis
nettoyer » — ça publierait du non-validé.

## Le cycle de vie d'une contribution
`fork/branche du collab` → fetch → **audit conflits** → worktree de revue (merge) →
**`npm run audit`** → **audit de code (sous-agent)** → **test manuel (dev server)** →
ajustements sur `review/*` → **merge dans `main`** (= go prod).

---

## 1. Découvrir le commit (il n'est pas toujours là où on croit)
Un collab pousse souvent sur **son fork** sans ouvrir de PR → invisible dans `git log`.
```bash
gh pr list --state all --limit 20                          # PR ouvertes ?
gh api repos/<owner>/<repo>/collaborators --jq '.[].login' # qui a accès
gh api repos/<owner>/<repo>/forks --jq '.[].full_name'     # forks
gh api repos/<fork>/<repo>/branches --jq '.[].name'        # branches du fork
```
Puis compare sans rien cloner :
```bash
gh api repos/<owner>/<repo>/compare/main...<fork_owner>:<branche> \
  --jq '{ahead:.ahead_by, behind:.behind_by, status:.status,
          commits:[.commits[]|"\(.sha[0:9]) \(.commit.author.name): \(.commit.message|split("\n")[0])"],
          files:[.files[]|"\(.status) +\(.additions)/-\(.deletions) \(.filename)"]}'
```

## 2. Récupérer en local + auditer les conflits (sans rien modifier)
```bash
git remote add <collab> https://github.com/<fork_owner>/<repo>.git 2>/dev/null \
  || git remote set-url <collab> https://github.com/<fork_owner>/<repo>.git
git fetch <collab> <branche>
MB=$(git merge-base main <collab>/<branche>)         # point de divergence
git log --oneline $MB..main                          # ce que main a en plus (risque conflit)
git merge-tree --write-tree --no-messages main <collab>/<branche> >/tmp/mt.txt; echo "exit=$?"
# exit=0 → fusion propre ; exit=1 → conflits. Les lignes "1/2/3 <fichier>" listent les fichiers en conflit.
```

## 3. Worktree de revue + fusion (main reste intact)
```bash
git worktree add -f ../<repo>-review main
cd ../<repo>-review
git checkout -b review/<sujet>
git merge --no-ff --no-commit <collab>/<branche>     # résoudre les conflits ici
git diff --name-only --diff-filter=U                 # fichiers en conflit
# … résoudre (souvent trivial sur le mono-fichier : un calcul UI, etc.) …
npm install                                          # si nouvelle dépendance
```

## 4. Validation automatique (la garde)
```bash
npm run audit        # = lint + secrets:scan + test + build (cf. package.json)
npm run build        # relire la sortie : un gros chunk doit être code-splité (await import),
                     # pas dans le bundle initial. Refuser un ajout lourd au bundle initial.
```
Comparer le diff aux périmètres sensibles : `SCHEMA_VERSION` (migration), `storage key`,
edge functions / RLS, secrets.

## 5. Audit de code (sous-agent, en français, concis)
Déléguer à un sous-agent une revue ciblée sur les **fichiers ajoutés/modifiés** (récupérer le
diff exact via `git diff $MB <collab>/<branche> -- <fichiers>`). Faire chercher, par priorité :
corrections (edge cases, null, parsing FR virgule), **sécurité** (injection formule Excel/CSV si
valeurs commençant par `= + - @`, XSS, fuite PII, affaiblissement d'un scanner), persistance/
migration, conventions du repo (mono-fichier, `formatEur`, réutilisation des helpers), qualité
(code mort, try/catch manquant, console.log). **Vérifier soi-même** chaque BLOQUANT/IMPORTANT
avant de le rapporter comme fait (les sous-agents se trompent de base de diff) — puis restituer
à Leo sous forme de **vrai tableau markdown**, pas de puces ni de prose :

| Fichier:ligne | Sévérité | Problème | Correctif |
|---|---|---|---|
| `App.jsx:8563` | IMPORTANT | … | … |

Une ligne = un problème, une phrase courte par colonne. Si un point est « à confirmer sur un cas
concret » plutôt que certain, le dire dans la colonne Sévérité (`IMPORTANT (à confirmer)`) plutôt
que noyer la nuance dans une parenthèse de prose.

## 5bis. Vue d'ensemble « en attente » (quand plusieurs sources/branches coexistent)
Dès qu'il y a plus d'une contribution ou plus d'un repo/remote en jeu (preview, prod, forks
multiples), donner à Leo un **tableau d'état** avant de détailler quoi que ce soit — ça répond
tout de suite à « qu'est-ce qui attend d'être poussé où » sans qu'il ait à le redemander :

| Où | Contenu | Statut | Action |
|---|---|---|---|
| `main` ↔ preview ↔ prod | — | ✅ synchronisés / ⚠️ désynchronisés (préciser le delta) | … |
| Branche locale/fork X | résumé en 3-5 mots | ⏳ non auditée / ✅ auditée / 🗑️ obsolète | à auditer / à corriger / supprimable |

Vérifier les remotes de déploiement (`git remote -v`, comparer les HEAD de `main`, `preview`,
`prod`) avant d'affirmer qu'ils sont synchronisés — ne pas supposer.

## 6. Test manuel par Leo (le « avant » du merge)
```bash
cd ../<repo>-review && npm run dev      # localhost — main n'est pas touché, rien n'est déployé
```
Donner l'URL à Leo + la **liste des bugs connus** (issus de l'étape 5) pour qu'il teste en
connaissance de cause. Il valide la feature **sur cette branche**, pas sur main.

## 7. Ajuster puis merger
Appliquer les correctifs (BLOQUANT + IMPORTANT) sur `review/<sujet>`, relancer `npm run audit`.
Quand Leo dit OK :
```bash
git checkout main && git merge --no-ff review/<sujet>   # go prod (Netlify) — UNIQUEMENT validé
git push origin main                                    # seulement sur accord explicite de Leo
git worktree remove ../<repo>-review                    # nettoyage
```
Alternative sans merge immédiat : pousser `review/<sujet>` et **ouvrir une PR** pour garder la
trace / laisser Netlify faire une preview deploy.

## Industrialiser (pour que ça arrive tout cuit la prochaine fois)
Demander aux collab d'**ouvrir une PR** depuis leur fork (l'unité de revue). Côté repo :
- **CI** : un workflow GitHub Actions qui lance `npm run audit` sur chaque PR → gate vert obligatoire.
- **`.github/CODEOWNERS`** : exiger la revue de Leo avant merge.
Une PR + CI verte + revue assistée = adoption en minutes.

## Garde-fous Leo
- `main` = prod Netlify → jamais de WIP/non-validé dessus, jamais de `push origin main` sans accord explicite.
- Worktree de revue = dossier jetable à côté ; `git worktree remove` à la fin.
- Une nouvelle dépendance lourde n'est acceptable que **code-splitée en import dynamique** (impact bundle initial nul).
