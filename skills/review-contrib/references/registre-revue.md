# Registre de revue — `<collab>` / `<repo>`

> Gabarit du skill `review-contrib` (§9). À copier **hors du dépôt**, dans un DOSSIER
> (`~/<dossier-de-travail>/<repo>-revue-<collab>/registre.md`) : c'est un document
> de travail, pas du code, et il ne doit pas partir dans un commit. Le dossier accueillera
> aussi le prompt de reprise et les notes du tour.
>
> Deux sections seulement : l'**état** (qui survit entre les tours) et le **message**
> (régénéré à chaque tour, collable tel quel en commentaire de PR).

---

## État

| Champ | Valeur |
|---|---|
| Branche | `<collab>/<branche>` @ `<sha>` |
| Base mesurée | `main` = `<sha>` · ahead `<N>` / behind `<N>` — mesuré le `<date>` |
| Tour | `<N>` — dernier fetch le `<date>` |
| Feu vert ? | ❌ non / ✅ oui (les 5 critères de §9.4) |
| Rapport envoyé | ❌ pas encore — **en attente d'accord explicite du mainteneur** / ✅ le `<date>` |

**Ne jamais mettre à jour ce tableau depuis une déclaration du contributeur.** Re-fetch,
re-mesure, puis on écrit. `behind` en particulier bouge tout seul quand `main` avance.

```bash
cd <repo> && git fetch <collab> && git rev-list --left-right --count <collab>/<branche>...main
```

### Défauts

Identifiant stable : `B<n>` bloquant · `I<n>` important · `M<n>` mineur. **On ne renumérote
jamais** — c'est ce qui permet de dire « B1 corrigé, I3 toujours ouvert » d'un tour à l'autre.

| Id | Où (sa branche) | Attendu vs obtenu | Reproduire | Vérifier | Statut | Tour |
|---|---|---|---|---|---|---|
| B1 | `src/lib/x.js:52` | 31,4 % attendu, 30 % obtenu | 10 000 € → 3 000 € au lieu de 3 140 € | `npm run test:baremes` | ouvert | 1 |
| I3 | `src/lib/y.js:180` | 1 594 € attendu, 31 865 € obtenu | lien = petit-enfant, bien 200 k€ | test à écrire + contre-épreuve « enfant » | contesté | 1 |

Statuts : `ouvert` · `corrigé` (**vérifié par nous**) · `contesté` (noter sa raison, elle peut
être bonne) · `reporté` (accepté pour plus tard, avec la raison et l'accord du mainteneur).

**Les chiffres de la colonne « attendu vs obtenu » sont MESURÉS**, pas estimés : probe Node sur
une copie de ses libs pures, dans le scratchpad. Un écart calculé de tête se fait contester au
tour suivant, et c'est nous qui perdons la main.

**Marquer explicitement les défauts qui ne sont PAS à sa charge.** Un refactor rend souvent
visible un bug préexistant sur `main`. Statut à part (`à trancher côté mainteneur`), et on lui demande
un commentaire de doute dans le code — pas une correction à l'aveugle sur une valeur dont
personne n'a la source.

### Collisions à préserver (§2bis)

| Branche du mainteneur en attente | Commits | Fichiers en collision | Ce qu'on lui demande |
|---|---|---|---|
| `wip/…` | `<N>` | `src/lib/z.js` | ne pas y toucher, ou rebaser après son atterrissage |

⚠️ Le piège : un fichier qui **s'auto-merge proprement contre `main`** peut conflituer avec une
branche en attente. Invisible sans le croisement — donc à écrire ici, sinon personne ne s'en
souviendra au tour 3.

### Décisions déjà prises (ne pas re-litiger)

- <merger / ne pas merger, et le repli si le mainteneur veut la valeur tout de suite>
- Rien n'est poussé, rien n'est mergé, **aucun message ne part sans accord explicite du mainteneur**.

### Journal

| Tour | Date | Envoyé | Reçu | Ce qui a bougé |
|---|---|---|---|---|
| 1 | | revue initiale | — | 5 B, 8 I ouverts |

### Artefacts du tour

| Fichier | Pour qui | Rôle |
|---|---|---|
| `~/Desktop/revue-<collab>.html` | le mainteneur | décider — captures réelles, glossaire, coût de chaque défaut |
| `~/Desktop/revue-<collab>-POUR-<COLLAB>.md` | le contributeur **et son IA** | corriger — collable en PR |
| `~/Desktop/revue-<collab>-POUR-<COLLAB>.html` | le contributeur | même contenu, **généré** depuis le `.md` |
| ce fichier | le mainteneur, entre les tours | suivre les statuts |

```bash
node ~/.claude/skills/review-contrib/references/md2page.mjs \
  ~/Desktop/revue-<collab>-POUR-<COLLAB>.md ~/Desktop/revue-<collab>-POUR-<COLLAB>.html "<titre>"
```

---

## Message à envoyer (markdown brut — régénérer à chaque tour)

> Relire avant envoi : aucun chemin de worktree local, aucun `~/…`, aucun port, aucune capture
> — il n'a rien de tout ça. Que des chemins de SA branche. **Envoi sur accord explicite du mainteneur.**
>
> Ce message est le **résumé** ; le détail actionnable vit dans le rapport `.md` joint (§9.3).
> Ne pas recopier les 15 fiches ici : un mail illisible ne se corrige pas.

```markdown
Salut <prénom>,

J'ai passé ta branche en revue en la faisant tourner, pas seulement en la lisant.

Ce que je retiens d'abord : <modules>, c'est du bon travail — <ce qui est réellement neuf et
pourquoi ça vaut le coup>. <Nommer le module sans aucune réserve, s'il y en a un.>

**Le point structurel, à traiter avant le reste.** Ta branche part de <date> et `main` a avancé
de <N> commits depuis. <Ce qui a changé dans l'amont et que la branche réécrase, avec la valeur
et la date d'effet.> <Et le cas échéant : le test qui verrouille l'ancienne valeur, donc « tes
tests sont verts » ne prouve rien ici.> Corriger les points ci-dessous avant de rebaser te
ferait travailler deux fois : rebase d'abord, en dropant <les commits déjà refaits de mon côté>.

Je t'envoie le détail complet en pièce jointe (markdown + HTML) : pour chacun des <N> points, le
code fautif cité, la correction en code, un cas de repro chiffré mesuré sur ta branche, et le
test qui doit passer au vert. Le rapport contient aussi **ce que tu ne peux pas deviner depuis
ton fork** : <les constantes qui ont changé>, <les exports que main attend de tes fichiers>,
<la liste de tests complète>.

Les <N> bloquants en une ligne chacun :
- **B1** `src/lib/x.js:52` — <ce qui ne va pas, valeur attendue>.
- **B2** `…` — <idem>

**À ne pas toucher :** <fichiers en collision avec du travail en attente de mon côté>. <Pourquoi
rien ne le lui signalera.> <Le fichier à rebaser en dernier.>

**Ce qu'il me faut pour merger :** zéro bloquant ouvert, les importants corrigés ou explicitement
reportés, `npm run audit` vert avec la liste de tests complète (pas la liste réduite), et un
`merge-tree` propre. Une PR depuis ton fork plutôt qu'une branche à récupérer à la main, si tu
peux — la CI tourne et les tours suivants sont beaucoup plus rapides.

<S'il y a un défaut qui est le NÔTRE :> Un point où c'est moi qui dois trancher, pas toi :
**I9** <le décrire>. Le défaut préexiste chez moi, ton refactor n'a fait que le rendre visible.
Pose juste un commentaire de doute, je reviens vers toi avec la source.

Merci — ping-moi si un point n'est pas clair, plusieurs sont discutables et un « pas d'accord,
voilà pourquoi » est une réponse valable. Cite les identifiants (B1, I3…), ils ne bougeront pas
d'un tour à l'autre.
```
