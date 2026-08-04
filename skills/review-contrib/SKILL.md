---
name: review-contrib
description: >-
  Contrôler, auditer, RESTITUER et intégrer proprement le commit/la branche/la PR d'un
  collaborateur (souvent depuis un fork) avant merge dans main. Utilise-le quand le mainteneur dit « un
  collaborateur a poussé un commit », « regarde la branche/PR de X », « audite/teste cette
  contribution », « passe-moi en revue les commits de X », « comment adopter ce commit », ou
  veut un workflow de revue rapide — et quand une revue s'appuie sur une RÈGLE EXTÉRIEURE au
  dépôt (taux fiscal, plafond légal, barème, seuil réglementaire, date d'effet, limite d'une API
  tierce) qu'il faut sourcer avant de la reprocher à quelqu'un : « vérifie ce qu'on lui dit »,
  « c'est sourcé ? », « d'où sort ce chiffre » — et AUSSI quand il demande à VOIR la contribution :
  « fais-moi un HTML de ses commits », « une synthèse avec des captures », « montre-moi ce que
  ça donne », « simule ses commits dans le navigateur », « qu'est-ce que ça apporte vraiment » —
  et quand il faut RENDRE COMPTE au contributeur : « écris-lui le retour », « fais un rapport
  qu'il puisse corriger », « son IA doit pouvoir tout comprendre », « où en est la revue de X ».
  Couvre : découverte du commit (fork/branche/PR), audit de conflits (merge-tree), validation
  (npm run audit : lint + secrets + tests + build + bundle), audit de code par sous-agent,
  boucle de fact-check des règles extérieures sur source primaire AVANT de produire les
  livrables, banc de démonstration isolé + page HTML de revue à captures réelles, commune au mainteneur
  et au contributeur,
  test manuel en worktree (jamais sur main = prod), confrontation fonctionnelle des zones que main a
  fait évoluer en parallèle, rapport de correction exhaustif écrit pour l'IA du contributeur,
  registre de suivi à identifiants stables entre les tours, puis ajustement et merge final.
  Softcodé par repo.
---

# review-contrib — adopter vite & sûrement les contributions d'un collaborateur

## Principe immuable
**On ne teste / n'ajuste JAMAIS sur `main`.** Pars du principe que `main` = production
(déploiement automatique — **vérifier par quel remote** : `git remote -v`, ce n'est pas toujours
l'hébergeur annoncé dans la doc, et un même repo peut déployer par un remote dédié). Toute revue
se fait sur une **branche `review/*` dans un worktree séparé** (un 2ᵉ dossier ; le checkout
principal reste sur `main`, intact). Le merge dans `main` n'arrive **qu'une fois tout vert et
validé par le mainteneur**. Pas de « pousser sur main puis nettoyer » — ça publierait du
non-validé.

## Le cycle de vie d'une contribution
`fork/branche du collab` → fetch → **borner à SES commits (§1bis)** → **audit conflits, y
compris contre le travail non mergé du mainteneur (§2, §2bis)** → worktree de revue → **`npm run
audit`** → **audit de code (sous-agent)** → **🔒 fact-check des règles extérieures (§5ter)** →
**banc + HTML de revue (§6)** → **test manuel**

puis, tant que ce n'est pas mergeable : **↻ boucle de correction (§9)** — message au
contributeur → il corrige → re-fetch → **re-mesure** → jusqu'au feu vert (§9.4)

et seulement là : ajustements sur `review/*` → **merge dans `main`** (= go prod).

Trois erreurs de cadrage tuent la revue avant qu'elle commence : **auditer du code qui n'est pas
de lui** (§1bis) ; **ne comparer qu'à `main`** en ignorant ce que le mainteneur a en attente (§2bis) — ce
qui fait valider un travail qui sera à refaire dans deux semaines ; et **affirmer une règle
extérieure sans l'avoir lue à la source** (§5ter) — ce qui fait corriger le contributeur dans le
mauvais sens, avec notre signature dessus.

Les deux worktrees ne servent pas à la même chose et ne se confondent pas :

| Worktree | Base | Sert à | Merge ? |
|---|---|---|---|
| `<repo>-review` | `main` + merge de la branche | valider, corriger, merger | oui |
| `<repo>-<collab>` | branche du collab **telle quelle** (detached) | **montrer** ce que ça fait | **non** |

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

### 1bis. Borner le périmètre : ses commits, et rien que les siens
On audite **le travail du contributeur**, pas celui du mainteneur. Une branche de fork contient souvent
des commits qui ne sont pas de lui : un `git merge main` qu'il a fait pour se rattraper, des
commits repris, ses propres merges de PR internes. Les auditer, c'est reprocher à quelqu'un du
code qu'il n'a pas écrit — et gonfler la revue de bruit.
```bash
MB=$(git merge-base main <collab>/<branche>)
git log --format='%an' $MB..<collab>/<branche> | sort | uniq -c | sort -rn   # qui a écrit quoi
git log --format='%h %an %s' --merges $MB..<collab>/<branche>                # ses merges internes
# ce qui n'est PAS de lui (à exclure de l'audit) — adapter les identités, il en a souvent deux
# (le nom civil des commits locaux, et le login de la forge quand il commite depuis l'interface web)
git log --format='%h %an %s' $MB..<collab>/<branche> \
  --perl-regexp --author='^(?!<Prénom Nom>|<login>)'
```
Le diff à auditer reste `$MB..<branche>`, mais **le commentaire au contributeur ne cite que les
lignes qu'il a écrites**. Et un commit de merge n'est jamais un défaut : c'est de la plomberie.

Vérifie aussi que les branches « en attente » côté `origin` sont bien du mainteneur : une branche
`origin/review/<sujet>-<collab>` porte le nom du contributeur et contient SES commits — la ranger
avec le travail du mainteneur fausserait le croisement de §2bis.

## 2. Récupérer en local + auditer les conflits (sans rien modifier)
```bash
git remote add <collab> https://github.com/<fork_owner>/<repo>.git 2>/dev/null \
  || git remote set-url <collab> https://github.com/<fork_owner>/<repo>.git
git fetch <collab> <branche>
MB=$(git merge-base main <collab>/<branche>)         # point de divergence
git log --oneline $MB..main                          # ce que main a en plus (risque conflit)
git merge-tree --write-tree --no-messages main <collab>/<branche> >/tmp/mt.txt; echo "exit=$?"
# exit=0 → fusion propre ; exit=1 → conflits.
# Le chemin est SÉPARÉ PAR UNE TABULATION (format "<mode> <oid> <stage>\t<path>") :
# un awk sur les espaces rend une liste vide et fait croire à un faux positif silencieux.
grep -E '^[0-7]{6} [0-9a-f]{40} [123]' /tmp/mt.txt | cut -f2 | sort -u
```

### 2ter. « Déjà refait de notre côté » ne se décrète pas — ça se confronte

Sur une branche en retard, une partie des commits recouvre des zones que `main` a fait évoluer en
parallèle. Le réflexe est de les classer « déjà fait, à droper ». **C'est presque toujours faux**, et
c'est l'erreur la plus coûteuse de la revue : elle jette du travail utile, et elle se voit — le
contributeur, lui, sait ce qu'il a écrit.

Un compteur d'occurrences (`git grep -c "<terme métier>" main` → 37) ne prouve **rien** : il dit que le
sujet existe des deux côtés, pas que les implémentations se recouvrent. Deux versions du même écran
sont le plus souvent **complémentaires** — l'une a l'analyse fine, l'autre la lecture immédiate.

La confrontation, par zone recouverte :

```bash
# 1. Quels fichiers chaque lot touche vraiment
git show --name-only --format="" <ses commits du lot> | sort -u

# 2. Les exports diffèrent-ils ? (le squelette avant le détail)
diff <(git show main:$f | grep '^export') <(git show $C/$b:$f | grep '^export')

# 3. Ses libellés / identifiants : lesquels sont ABSENTS de main ?
#    C'est LA question. Un identifiant à 0 occurrence sur main = un apport réel.
for k in "<libellé d'écran>" "<nom de variable>" "<id d'onglet>"; do
  printf "%-24s main=%s\n" "$k" "$(git grep -c -F "$k" main -- src | awk -F: '{s+=$NF} END{print s+0}')"
done

# 4. Ce que SA version SUPPRIME de main (le sens inverse — celui qu'on oublie)
git diff main:$f $C/$b:$f | grep '^-' | grep -E 'export|import'
```

Trois issues, à distinguer explicitement dans le rapport :
- **apport** — absent de `main`, à conserver. Lui donner un identifiant stable (`A1`, `A2`…) au même
  titre qu'un défaut : le tour suivant doit pouvoir dire « A3 repris, A5 abandonné ».
- **régression** — sa version fait disparaître quelque chose de `main` (un import, un drapeau, une
  branche de calcul). Ça devient un défaut ordinaire (`I<n>`).
- **acquis** — le fichier fusionne sans conflit **et** le blob résultant porte les deux jeux de
  fonctions. À vérifier, pas à supposer :
  ```bash
  T=$(head -1 mt.txt); git ls-tree $T <path>          # récupérer l'OID du blob fusionné
  git cat-file -p <oid> | grep '^export'              # les exports des DEUX côtés y sont-ils ?
  ```
  Un `merge-tree` sans conflit ne dit pas que rien n'est perdu — il dit que git n'a pas eu à
  arbitrer. Lire le résultat.

Le cas le plus intéressant à chercher : un apport qui **corrige une incohérence de `main`** (deux
modules qui calculent la même grandeur sur deux bases différentes). Il n'est visible que depuis ce
croisement, et c'est l'argument qui fait accepter la contribution.

### 2bis. Croiser avec le travail non mergé du mainteneur — les collisions à venir
`merge-tree` contre `main` ne voit qu'une partie du risque. Ce qui fera vraiment mal, c'est la
branche du mainteneur **encore en attente** qui touche les mêmes zones : au moment où elle atterrira,
le travail du contributeur sera à refaire. Il faut le dire **avant** de lui demander un rebase.
```bash
# Ce que le mainteneur a en attente : branches non mergées + WIP non commité
for b in $(git for-each-ref --format='%(refname:short)' refs/heads refs/remotes/origin \
           | grep -v 'origin/HEAD'); do
  a=$(git rev-list --count main..$b 2>/dev/null)
  [ "${a:-0}" -gt 0 ] && echo "$b : $a commit(s) en attente"
done | sort -u
git status --porcelain | grep -v '^??'        # WIP non commité = collision invisible à git

# Collision par fichier — ne compter QUE les commits réellement en attente (main..$b),
# pas tout le diff depuis le merge-base, qui réinclut ce que main a déjà repris.
git diff --name-only $MB <collab>/<branche> | sort > /tmp/f_contrib.txt
git log main..$b --name-only --format= | sort -u | grep . > /tmp/f_b.txt
comm -12 /tmp/f_contrib.txt /tmp/f_b.txt

# Conflit réel entre les deux branches (le fichier commun ne prouve pas le conflit)
git merge-tree --write-tree --no-messages $b <collab>/<branche> >/tmp/mt2.txt; echo "exit=$?"
```
Mesuré sur un cas réel : le merge contre `main` seul annonçait 7 fichiers en conflit, mais deux
branches encore en attente en ajoutaient un 8ᵉ (un module de calcul partagé) — invisible tant
qu'on ne croise pas. Ce genre de fichier doit partir dans le message au
contributeur comme « zone à ne pas retoucher / à rebaser en dernier ».

Restituer en tableau, une ligne par branche en attente :

| Branche du mainteneur en attente | Commits | Fichiers en commun | Conflit réel | Ce qu'on demande au contributeur |
|---|---|---|---|---|
| `wip/<sujet>` | 8 | 6 | ⚠️ `<module>.js` en plus | ne pas toucher ce module, ou rebaser après |

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
au mainteneur sous forme de **vrai tableau markdown**, pas de puces ni de prose :

| Fichier:ligne | Sévérité | Problème | Correctif |
|---|---|---|---|
| `App.jsx:8563` | IMPORTANT | … | … |

Une ligne = un problème, une phrase courte par colonne. Si un point est « à confirmer sur un cas
concret » plutôt que certain, le dire dans la colonne Sévérité (`IMPORTANT (à confirmer)`) plutôt
que noyer la nuance dans une parenthèse de prose.

## 5bis. Vue d'ensemble « en attente » (quand plusieurs sources/branches coexistent)
Dès qu'il y a plus d'une contribution ou plus d'un repo/remote en jeu (preview, prod, forks
multiples), donner au mainteneur un **tableau d'état** avant de détailler quoi que ce soit — ça répond
tout de suite à « qu'est-ce qui attend d'être poussé où » sans qu'il ait à le redemander :

| Où | Contenu | Statut | Action |
|---|---|---|---|
| `main` ↔ preview ↔ prod | — | ✅ synchronisés / ⚠️ désynchronisés (préciser le delta) | … |
| Branche locale/fork X | résumé en 3-5 mots | ⏳ non auditée / ✅ auditée / 🗑️ obsolète | à auditer / à corriger / supprimable |

Vérifier les remotes de déploiement (`git remote -v`, comparer les HEAD de `main`, `preview`,
`prod`) avant d'affirmer qu'ils sont synchronisés — ne pas supposer.

## 5ter. Fact-check des règles extérieures — la boucle, AVANT de produire

Dès que la revue s'appuie sur une **règle qui ne vient pas du dépôt** — un taux fiscal, un plafond
légal, un seuil réglementaire, un barème, une date d'effet, une norme, une limite d'API tierce — cette
règle doit être **lue à la source** avant d'entrer dans un document qui part chez le contributeur.

C'est la doctrine du fact-check éditorial transposée à la revue de code : **le contrôle se
fait au sourcing, pas à la production.** Ici, le sourcing c'est l'audit (§1 à §5), la production c'est
la page (§6) et le rapport (§9.3). Vérifier au moment d'écrire le rapport, c'est découvrir l'erreur
quand le document est déjà rédigé — trop tard pour autre chose que tout reprendre.

**Pourquoi c'est plus grave ici que dans une newsletter.** Une valeur fausse dans un rapport de revue
n'est pas lue puis oubliée : le contributeur (ou son IA) **l'applique**, elle devient une constante, elle
part en prod, et elle porte notre signature. On lui aura fait écrire un bug en lui reprochant le sien.

### La boucle

```
1. RECENSER  toute assertion extérieure du futur rapport → une ligne dans un registre d'assertions
2. SOURCER   chacune : ouvrir le TEXTE, pas un commentaire du texte
3. TRANCHER  vrai · faux · non_source, avec un NIVEAU de confiance
4. CORRIGER  nos documents ET, si besoin, le tableau des défauts (le nôtre bouge aussi)
5. RE-VÉRIFIER ce qu'on vient d'écrire — les corrections introduisent leurs propres erreurs
   ↻ borner à 2 tours ; au 3ᵉ, on sort ce qu'on a en étiquetant ce qui reste douteux
```

### Les trois verdicts, et ce qu'ils commandent

La distinction paraît scolaire ; elle a été payée cher :

| Verdict | Définition | Effet |
|---|---|---|
| `vrai` | le texte confirme | passe |
| `faux` | **une source contredit** — l'erreur est prouvée | **bloque** : aucun document ne sort avec un `faux` ouvert |
| `non_source` | rien ne l'établit — absence de preuve, pas preuve d'erreur | **ne bloque pas**, mais **doit être étiqueté dans le document lui-même** |

Et deux niveaux de confiance, à afficher :

- **P** — source primaire atteinte : Légifrance, BOFiP, le JO, la doc officielle de l'éditeur.
- **S** — sources professionnelles concordantes, texte cité mais non lu. **Jamais présenté comme une
  certitude**, ni au contributeur ni au mainteneur.

`non_source` ne doit **jamais** vouloir dire « je n'ai pas su ouvrir le document » : épuiser d'abord le
PDF illisible → la page HTML du même texte → un autre hébergeur du même texte. Et **`PARTIEL` n'est pas
vert** : une assertion jamais regardée n'est pas une assertion saine.

### Les cinq pièges, tous rencontrés en vrai (revue à contenu réglementaire, 08/2026)

1. **Une source secondaire peut dire l'exact inverse du texte.** Trois commentaires professionnels
   concordants annonçaient « les PEL/CEL ouverts *depuis* 2018 restent au taux réduit ». Le code de la
   sécurité sociale vise les CEL ouverts *jusqu'au* 31/12/2017. On s'apprêtait à envoyer à un tiers une
   règle retournée. **La concordance de sources secondaires n'est pas une preuve** — elles se recopient.
2. **Un texte qui renvoie n'est pas sourcé tant que le renvoi n'est pas ouvert.** L'article portait
   « les revenus mentionnés au a du I de l'article L. 136-6 » : tant qu'on n'a pas lu L. 136-6, on n'a
   rien lu. Décoder les renvois est la moitié du travail, et c'est là que se cachent les exclusions.
3. **Lire la DATE DE VERSION du texte, toujours.** L'article avait été modifié par une loi de juin,
   postérieure à celle que toutes les analyses commentaient. Un socle sourcé il y a six mois est un
   socle périmé : **re-vérifier à chaque tour de la boucle §9**, pas une fois pour toutes.
4. **Une liste limitative se vérifie dans les deux sens.** Un item annoncé par une source (« les
   plus-values professionnelles à long terme sont exclues ») était simplement absent du texte. Compter
   les items, pas seulement reconnaître ceux qu'on cherchait.
5. **Un taux unique dans le code est un signal d'alerte.** Quand une règle se met à dépendre du support
   (l'enveloppe, le millésime, le statut), une constante unique réutilisée partout devient fausse
   silencieusement dans la moitié des cas. Le chercher explicitement : `grep` sur la constante, puis
   vérifier **chaque** appelant contre la règle.

### Le registre d'assertions

Il vit à côté du registre de revue (§9.2), dans le même dossier, et **survit entre les tours** :

```bash
D=~/<dossier-de-travail>/<repo>-revue-<collab>
# une ligne par assertion extérieure du rapport
```

| Assertion | Où elle sert | Source | Niveau | Verdict | Re-vérifiée le |
|---|---|---|---|---|---|
| PS immobilier maintenus à 17,2 % | `B3`, `I11`, page §fiscal | L. 136-8, IV CSS (v. 27/06/2026) | **P** | vrai | 04/08 |
| dates d'effet distinctes patrimoine / placement | `.md` §2.2 | art. 12, II LFSS 2026 | **S** | vrai | 04/08 |

Ce registre est ce qui permet, trois tours plus tard, de répondre « d'où sort ce chiffre » sans
refaire l'enquête — et de repérer d'un coup d'œil les lignes **S** qu'on n'a jamais durcies.

### Ce qui entre dans les documents sortants

- **Le rapport (§9.3)** cite la source **dans la fiche du défaut** : texte, article, date de version.
  Une correction chiffrée sans sa source est une correction que son IA n'a aucun moyen d'arbitrer.
- **La page (§6)** ne porte pas les références juridiques dans le tableau des défauts — elles
  l'alourdiraient — mais **le glossaire les porte**, en une ligne par terme.
- **Ce qui reste en `S` est dit comme tel**, dans le document, à l'endroit où c'est utilisé. « Je n'ai
  pas lu le texte lui-même » est une phrase acceptable ; laisser croire au contraire ne l'est pas.
- **Ne jamais faire inventer une valeur au contributeur.** Sans source, on demande un marqueur de doute
  dans le code, pas une correction (cf. §9.3, « cinq réflexes »).

## 6. Restituer : le banc de démonstration + la page HTML commune

Un tableau de défauts dit ce qui cloche ; il ne dit pas **ce que la contribution apporte**.
Quand le mainteneur demande à voir (« fais-moi un HTML », « montre-moi ce que ça donne »), la réponse
n'est ni un tableau ni une maquette : c'est **sa branche qui tourne, capturée**. Une capture
inventée serait un mensonge sur un travail qu'on s'apprête à juger.

### 6.1 Monter la branche TELLE QUELLE — surtout ne pas merger
Pour *montrer*, on n'a besoin d'aucune fusion. Un worktree en detached sur sa branche évite
d'un coup tous les conflits (17 blocs sur un cas réel) :
```bash
git worktree add -f ../<repo>-<collab> <collab>/<branche>   # detached, aucun merge
cd ../<repo>-<collab> && npm install
```

### 6.2 Isoler de la production — non négociable
Le worktree n'hérite pas du `.env` (gitignoré), donc l'app affichera son écran « config
manquante ». La tentation est de copier le vrai `.env` : **jamais**. Une branche de collab
peut bumper `SCHEMA_VERSION` et l'autosave réécrira des données réelles dans le
nouveau format. Deux gestes (adapter les noms de variables à ceux du repo) :
```bash
cat > .env <<'EOF'
<PREFIX>_API_URL=http://127.0.0.1:9         # port fermé → échec immédiat, pas de timeout
<PREFIX>_API_KEY=demo-non-fonctionnelle
<PREFIX>_DEMO_LOCAL=1
EOF
```
puis, dans le worktree seulement, un court-circuit gardé par `DEMO_LOCAL` : le fournisseur d'auth
rend une session factice, l'effet de chargement injecte un dossier fictif, **et l'effet
d'autosave sort en premier** (`if (DEMO_LOCAL) return;`). Commenter ces patchs comme jetables.

### 6.3 Un dossier fictif, sinon les écrans sont vides
Un dossier vierge affiche 0 € partout : illisible et sans intérêt. Écrire un `src/demoState.js`
**partiel** — la fonction `migrate()` de l'app le fusionne sur `defaultState()`, inutile de
reconstruire tout le schéma. Trois pièges :
- **Les modules filtrent leurs items.** Un élément n'apparaît pas parce qu'un drapeau manque
  (`<module>Active`). Lire le collecteur (`isActive`, `aggregate*`) et les champs
  réellement consommés par le module de calcul — ne pas deviner les noms.
- **Certains onglets sont gatés `isAdmin`.** Passer le profil démo en `admin` pour les voir…
  mais l'app atterrit alors sur l'écran d'administration, vide sans backend : forcer l'onglet
  initial sur l'écran de synthèse en mode démo.
- **Fabriquer le cas qui fait apparaître le défaut.** C'est le vrai gain du banc : une donation
  datée hors du délai de rappel a transformé « le filtre des 15 ans semble absent » (lecture de
  code) en « l'app affiche 65 000 € au lieu de 60 000 » (preuve à l'écran, chiffrable).

### 6.4 Capturer
Le navigateur intégré **n'écrit pas de fichier** ; Playwright si, mais il est confiné à des
racines autorisées (le cwd de la session et `.playwright-mcp/`) — viser le scratchpad échoue.
Naviguer entre onglets sans dépendre des coordonnées :
```js
window.__nav = (l) => { const b=[...document.querySelectorAll('button')]
  .find(x=>x.textContent.trim().replace(/^[^\p{L}]+/u,'')===l); if(b){b.click();window.scrollTo(0,0);} };
```
`fullPage: true` pour un écran dense, viewport + `scrollIntoView` pour cadrer un bloc précis.

### 6.5 Assembler la page — l'outillage est fourni, ne pas le réécrire
Les PNG pleine page pèsent ~500 ko pièce → un HTML de 6 Mo. On les réduit (JPEG, largeur
1240) et on les inline en `data:` URI, pour une page autonome ouvrable sans serveur. Le
template porte des marqueurs `__IMG_01__…` qu'un script substitue : c'est ce qui permet de
retoucher le texte et de reconstruire, sans jamais manipuler 2 Mo de base64 à la main.

```bash
S=~/.claude/skills/review-contrib/references
cp $S/page-revue.template.html ./revue.template.html   # squelette : CSS + structure + zoom au clic
# … remplir le contenu, garder les marqueurs __IMG_xx__ …
node $S/build-page.mjs ./captures ./revue.template.html ~/Desktop/revue-<collab>.html
```
Les captures sont appariées **par ordre alphabétique** (`01-*.png` → `__IMG_01__`) : d'où le
préfixe numérique au moment de capturer. Le script signale les marqueurs d'image non
substitués et les placeholders de texte encore vides — lire sa sortie, c'est la seule chose
qui rattrape un « __POURQUOI__ » laissé dans un document qu'on s'apprête à donner.

**UNE seule page, adressée au contributeur, que le mainteneur lit par-dessus son épaule.** C'est la forme
arbitrée après avoir essayé la version « une page pour lui, une pour l'autre » :
deux pages qui racontent la même chose divergent au premier correctif, et le mainteneur n'a pas de raison de
lire un résumé de ce qu'il va de toute façon envoyer. Écrire à la 2ᵉ personne (« ta branche »),
et étiqueter explicitement le peu qui relève de la décision interne.

Il reste **deux** documents, pas trois : cette page (les deux humains) et le rapport technique du
§9.3 (le contributeur et son IA).

**C'est un tableau de bord, pas un rapport.** Une page qu'on parcourt en diagonale — viser
~6 000 px de haut, pas 30 000. Fond **blanc**, couleur réservée aux **voyants** (rouge / orange /
vert) : sur un écran chargé, c'est la pastille qu'on lit, pas le paragraphe. Le code, les correctifs
et les tests **sortent de cette page** : ils n'ont qu'un lecteur utile, l'IA qui corrigera (§9.3).

Le piège à éviter : croire qu'exhaustif = utile. Un document où tout est écrit ne se lit pas, donc
ne décide rien.

Ce que la page doit porter, dans cet ordre :
1. **Verdict en tête** — fusionnable ou non, et pourquoi en une phrase. Le formuler sur le travail,
   jamais sur la personne : « le problème n'est pas ta façon de coder, c'est l'écart de base ».
2. **Une rangée de voyants** — 4 à 6 cartes : valeur apportée, sécurité, fraîcheur de branche,
   exactitude métier, filet de tests. Chacune : un état en 3 mots + une ligne d'explication.
   Ça remplace les compteurs bruts (commits, fichiers), qui ne se hiérarchisent pas.
3. **« En 30 secondes »** — 4 phrases numérotées. Qui ne lit que ça doit pouvoir trancher.
4. **Ce qui est retenu / ce qui se recoupe** — un tableau, une ligne par module, avec le voyant qui
   tranche. Décrire chaque module par **ce qu'il fait en clientèle**, pas par son API.
5. **Les recouvrements triés** (§2ter) — les apports `A<n>` à conserver, les régressions à écarter.
   Ne jamais écrire « déjà fait, à droper » sans avoir confronté : c'est l'erreur qui jette du
   travail utile, et le contributeur la voit immédiatement.
6. **Ce qu'il ne peut pas deviner depuis son fork** — la version courte de §9.3 : les constantes qui
   ont changé, les API que `main` attend, la liste de tests. Utile aux deux : c'est aussi ce qui
   explique le problème au mainteneur.
7. **Le vocabulaire employé** — une ligne par terme métier, en français, sans article de loi en
   titre. C'est ce qui rend la page relisable dans six mois, ou par quelqu'un d'autre.
8. **Le tableau des défauts, en clair** : voyant · référence stable (`B1`) · ce qui se passe en une
   phrase sans jargon · **ce que ça coûte** en euros ou en risque. Le `fichier:ligne` en sous-titre
   discret, pour qu'il s'y rende. Pas de colonne « correctif » : elle vit dans le rapport technique.
9. **La preuve mesurée** — le calcul attendu vs affiché, quand le banc a fait sortir un défaut.
10. **Les captures en vignettes** cliquables : elles prouvent que ça tourne, elles ne portent pas
    l'argumentation. Zoom au clic obligatoire — réduites, les chiffres ne se lisent pas.
11. **L'ordre de travail** en 4-5 étapes, et **le critère de sortie** (§9.4) annoncé d'avance :
    sans critère écrit, la boucle ne se ferme jamais et personne ne sait ce qu'on attend.
12. **Un encart de fin** : les zones à ne pas toucher (§2bis), le rappel que plusieurs points sont
    discutables, et l'état d'envoi (rien n'est parti tant que le mainteneur n'a pas dit oui).

Un défaut ne se raconte pas par sa cause technique : ce qui compte, c'est **ce que ça coûte** — en
euros quand il fausse un montant, en risque quand il casse autre chose. « La constante est périmée »
ne se hiérarchise pas, « 1 400 € par 100 k€ de plus-value » si.

Le template fourni (`page-revue.template.html`) porte déjà cette forme : fond blanc, rangée de
voyants, tableaux compacts, vignettes. Le remplir, ne pas le refondre.

Livrer le fichier hors du dépôt (`~/Desktop/…`) — c'est un document de travail, pas du code. Et
**vérifier le rendu avant de le donner**. Mesurer plutôt que regarder : un `browser_evaluate` qui
compte les images cassées, les cellules de tableau vides et le débordement horizontal attrape ce que
l'œil laisse passer dans une page de plusieurs milliers de pixels. Servir le fichier en local
(`python3 -m http.server --bind 127.0.0.1`) — Playwright refuse le protocole `file:`.

Dernier contrôle, non négociable puisque la page part chez un tiers :
```bash
grep -nE "~/|/Users/|localhost|127\.0\.0\.1|:5[0-9]{3}|worktree" <la page>   # doit être VIDE
```

## 7. Test manuel par le mainteneur (le « avant » du merge)
```bash
cd ../<repo>-review && npm run dev      # localhost — main n'est pas touché, rien n'est déployé
```
Donner l'URL au mainteneur + la **liste des bugs connus** (issus de l'étape 5) pour qu'il teste en
connaissance de cause. Il valide la feature **sur cette branche**, pas sur main.

## 8. Ajuster puis merger
Appliquer les correctifs (BLOQUANT + IMPORTANT) sur `review/<sujet>`, relancer `npm run audit`.
Quand le mainteneur dit OK :
```bash
git checkout main && git merge --no-ff review/<sujet>   # go prod — UNIQUEMENT validé
git push origin main                                    # seulement sur accord explicite du mainteneur
git worktree remove ../<repo>-review                    # nettoyage
git worktree remove --force ../<repo>-<collab>          # le banc : patchs jetables, rien à sauver
```
Alternative sans merge immédiat : pousser `review/<sujet>` et **ouvrir une PR** pour garder la
trace / laisser Netlify faire une preview deploy.

## 9. La boucle de correction avec le contributeur (jusqu'au feu vert)

La revue n'est pas un verdict, c'est **un aller-retour qu'on rejoue jusqu'à ce que ce soit
mergeable**. Ça impose trois choses que la revue d'un seul tour n'a pas besoin d'avoir.

### 9.1 Chaque défaut doit être actionnable SANS le contexte de la session
Le contributeur n'a ni le banc, ni le worktree, ni la conversation. Un défaut qui ne dit que
« le 757 B est faux » lui coûtera une demi-journée à retrouver. Le format minimal, quatre champs :

| Champ | Pourquoi il est obligatoire |
|---|---|
| **Où** | `fichier:ligne` sur SA branche (pas sur `main`, qu'il n'a pas) |
| **Attendu vs obtenu** | des chiffres, pas une opinion — « 52 094 € au lieu de 0 € » |
| **Comment reproduire** | le cas exact qui le déclenche (le dossier du banc sert à ça) |
| **Comment vérifier** | le test à écrire ou la commande qui doit passer au vert |

Sans le « comment vérifier », le tour suivant se rejoue à l'aveugle et on repart pour un cycle.

### 9.2 Un registre qui survit entre les tours
Sans état, le tour 2 ne sait pas ce qui a été corrigé, ce qui a été refusé, ni pourquoi. Tenir
`revue-<collab>.md` **hors du dépôt** (dans un dossier de travail dédié) :
```bash
D=~/<dossier-de-travail>/<repo>-revue-<collab>   # un DOSSIER : le registre y côtoiera
mkdir -p $D                                           # le prompt de reprise et les notes du tour
cp ~/.claude/skills/review-contrib/references/registre-revue.md $D/registre.md
```
Le gabarit porte l'état (branche, tour, défauts, collisions, journal) **et** le message à
envoyer. Identifiant stable par défaut (`B1`, `I3`), jamais renuméroté : c'est la seule chose
qui permette de dire « B1 corrigé, I3 toujours ouvert » sans tout recopier.

Statuts : `ouvert` · `corrigé` (vérifié par nous, pas déclaré par lui) · `contesté` (il a une
raison — la noter, elle peut être bonne) · `reporté` (accepté pour plus tard, avec la raison).

**Un défaut ne passe à `corrigé` qu'après re-fetch et re-mesure.** « Il dit que c'est fait »
n'est pas une preuve : c'est exactement le piège du voyant vert que personne ne relit.

### 9.3 Le rapport au contributeur — écrit pour SON IA, pas pour lui seul

**Trois livrables au total, deux seulement partent chez le contributeur :**

| Livrable | Pour qui | Rôle |
|---|---|---|
| la page HTML de §6 (à captures, voyants) | **le mainteneur ET le contributeur** | comprendre et décider |
| `revue-<collab>-POUR-<COLLAB>.md` | le contributeur **et son assistant de code** | **corriger** |
| le registre de §9.2 | le mainteneur, entre les tours | **suivre** les statuts |

Le contributeur corrigera presque certainement **avec une IA**. C'est ça le vrai lecteur du `.md`,
et ça change tout : elle n'a ni `main`, ni le banc, ni la conversation, ni le droit fiscal qui a
bougé. Un rapport « suffisant pour un humain qui connaît le projet » la fera corriger de
travers, et on repart pour un tour complet.

Le `.md` **peut** être rendu en HTML si le contributeur n'a pas d'éditeur markdown, avec
`references/md2page.mjs` (convertisseur maison, sans dépendance ni réseau, ancre `id="B1"` par
fiche). Ce n'est pas le cas par défaut : depuis que la page de §6 est commune aux deux, un
troisième document fait doublon. **Le `.md` reste la source unique** — jamais deux versions du même
contenu maintenues à la main, elles divergent au premier correctif.
```bash
node ~/.claude/skills/review-contrib/references/md2page.mjs <rapport>.md <sortie>.html "<titre>"
```

#### L'ordre du rapport
1. **Comment lire ce document** — les `fichier:ligne` désignent SA branche au SHA mesuré ;
   quand on cite l'amont, on le préfixe (`amont:src/…`). Les identifiants sont stables.
2. **Ce qui est retenu**, nommé et argumenté. Une revue qui n'ouvre que sur des reproches fait
   perdre un contributeur ; dire que ses 4 modules sont bons coûte deux lignes.
3. **Le blocage structurel** — « ta branche a N commits de retard » — et l'ordre de travail :
   rebase d'abord, corrections ensuite. Sinon il corrige sur une base qui va bouger.
4. **L'état de l'amont qu'il ne peut pas deviner** ← *la section décisive, voir plus bas.*
5. Les bloquants, puis les importants, puis les mineurs, au format ci-dessous.
6. Ce qu'on lui demande de **ne pas** toucher (les collisions de §2bis).
7. Le critère de sortie (§9.4), et un récapitulatif en tableau.

#### La section qui décide de tout : « ce que tu ne peux pas deviner »
Son code n'est presque jamais faux dans l'absolu — il est **juste pour l'état du dépôt au jour
de sa divergence**. Écris noir sur blanc, avec les valeurs et les numéros de ligne de l'amont :
- **les constantes/règles métier qui ont changé depuis**, et *pourquoi* (la source, la date
  d'effet). Et surtout les **exceptions contre-intuitives** — c'est là qu'un refactor bien
  intentionné casse quelque chose. *(Ici : le taux global monte, mais une base précise est
  exclue de la hausse — deux constantes distinctes que sa refonte a fusionnées.)*
- **les API que l'amont attend de ses fichiers** : quel export, importé par quel fichier. Sans
  ça, un conflit `add/add` se « résout » en supprimant une fonctionnalité entière.
- **la liste de tests / la config de l'amont**, quand la sienne est plus courte : dire lesquels
  manquent, nommément, et que la résolution est une **union**.
- **les numéros de version** (schéma de données, format d'export) des deux côtés.

Sans cette section, chaque correction est un pari. Avec elle, son IA a de quoi trancher seule.

#### Le format d'une fiche — sept champs, pas quatre
§9.1 donne le minimum pour un humain. Pour une IA tierce, il faut :

| Champ | Ce qu'il évite |
|---|---|
| **Où** | `fichier:ligne` sur SA branche |
| **Code actuel, cité** | qu'elle cherche — et qu'elle patche le mauvais bloc |
| **Ce qui ne va pas** | l'ambiguïté sur l'intention |
| **Le contexte de l'amont** | qu'elle corrige dans le mauvais sens |
| **La correction, en code** | qu'elle réinvente une API qui ne collera pas au reste |
| **Le repro chiffré** | entrées → obtenu → attendu → écart. Sans écart, pas de priorité |
| **Comment vérifier** | le test à écrire, **avec sa contre-épreuve** |

**La contre-épreuve est le champ qu'on oublie.** « Le conjoint doit sortir à 0 € » se satisfait
en exonérant tout le monde. Le test qui compte est le second : « et un enfant doit toujours
sortir à 52 094 € ». Toute correction d'un cas particulier se double d'un test de
non-régression sur le cas général.

#### Cinq réflexes qui font gagner un tour entier
- **Mesurer, jamais estimer.** Copie ses libs *pures* dans le scratchpad, écris un probe Node,
  et mets dans le rapport **les nombres que sa branche produit vraiment**. Dis-le explicitement
  (« mesuré en exécutant ton code ») : c'est ce qui rend le repro incontestable. Ne fais jamais
  ça sur un script de `scripts/` — un import exécute le top-level.
- **Regrouper par cause racine.** Trois symptômes issus d'une même erreur de structure se
  corrigent avec **un seul bloc de code** donné une fois, référencé par les deux autres fiches.
  Trois correctifs séparés produisent trois patchs qui se marchent dessus.
- **Séparer ses défauts des nôtres.** Un refactor rend souvent visible un bug **préexistant sur
  `main`**. Ne le lui facture pas : dis que c'est à nous, demande-lui un **commentaire de doute
  dans le code**, et tranche de notre côté.
- **Ne jamais lui faire inventer une valeur.** Si on n'a pas la source, on demande un marqueur,
  pas une correction. Une correction plausible mais fausse est pire que le doute documenté. Et la
  source, **on la lit** (§5ter) : une règle extérieure recopiée d'un commentaire professionnel peut
  dire l'exact inverse du texte — c'est arrivé, sur un rapport prêt à partir.
- **Étiqueter ce qui est invisible depuis sa branche.** « Ça compile chez toi, ça casse au
  merge » : sans cette phrase, il conclut qu'on s'est trompés et ne corrige pas.

#### Contrôle anti-contamination avant envoi
Les deux documents partent chez un tiers. Un chemin `~/…`, un port de dev, un « cf. le banc » y
suffit à trahir un contexte qu'il n'a pas — et à le perdre. Sur **la page ET le `.md`** :
```bash
grep -nE "~/|/Users/|localhost|127\.0\.0\.1|:5[0-9]{3}|worktree" <les deux fichiers>  # doit être VIDE
```
(Mentionner le banc en une ligne de pied de page est légitime et même rassurant — « aucune base
réelle accessible, dossier fictif » — à condition de ne citer ni chemin ni port.)
Puis vérifier le rendu HTML (`md2page.mjs` ne prévient pas d'un markdown mal formé) : aucun
`**` ni backtick résiduel hors des blocs de code, une ancre par fiche, tables complètes.

Ne jamais envoyer sans l'accord du mainteneur : c'est un message sortant, vers un tiers.

### 9.4 Le critère de sortie, annoncé dès le premier tour
Sans critère écrit, la boucle ne se ferme jamais. Feu vert = les six à la fois :
- zéro `ouvert` en sévérité BLOQUANT ;
- **zéro assertion extérieure en `faux` ou jamais vérifiée** (§5ter), et les règles re-vérifiées à ce
  tour — un texte modifié entre deux tours périme silencieusement une correction déjà envoyée ;
- les IMPORTANT sont soit `corrigé`, soit `reporté` avec une raison acceptée par le mainteneur ;
- `npm run audit` vert sur la branche rebasée, **avec la liste de tests de `main`** (§4) ;
- `merge-tree` contre `main` ET contre les branches en attente : propre, ou conflits assumés ;
- le banc rejoué : les défauts prouvés à l'écran ne se reproduisent plus.

Puis on reprend le cycle normal à §3 (worktree de revue, merge, `npm run audit`, §8).

## Industrialiser (pour que ça arrive tout cuit la prochaine fois)
Demander aux collab d'**ouvrir une PR** depuis leur fork (l'unité de revue). Côté repo :
- **CI** : un workflow GitHub Actions qui lance `npm run audit` sur chaque PR → gate vert obligatoire.
- **`.github/CODEOWNERS`** : exiger la revue du mainteneur avant merge.
Une PR + CI verte + revue assistée = adoption en minutes.

## Garde-fous du mainteneur
- `main` = prod → jamais de WIP/non-validé dessus, jamais de `push origin main` sans accord explicite.
- Worktrees = dossiers jetables à côté ; `git worktree remove` à la fin.
- Une nouvelle dépendance lourde n'est acceptable que **code-splitée en import dynamique** (impact bundle initial nul).
- **Le banc de démonstration ne touche jamais une base réelle** : env injoignable + autosave coupé.
  Une branche de collab peut porter une migration de schéma ; la laisser écrire, c'est corrompre
  des données de production pour une capture d'écran.
- Les patchs du banc (auth court-circuitée, `demoState.js`, onglet forcé) **ne sont jamais commités**.

## Orchestration
- Miroir côté contributeur : le skill `contribuer` — ce que cette revue va vérifier, il le fait
  lui-même avant d'ouvrir la PR. Le donner au collaborateur fait gagner un tour entier.
- Clôture par la preuve (skill `verify`, si tu l'as) : la preuve qu'on rend est le livrable que le
  mainteneur review, il ne retestera pas lui-même. Ici la preuve, ce sont les captures — donc
  jamais de maquette.
- Le §5ter est la transposition à la revue d'une doctrine de fact-check éditorial : même logique,
  autre objet — ici ce n'est pas une publication qu'on désarme, c'est un rapport qu'on refuse
  d'envoyer tant qu'une règle extérieure y est fausse.
