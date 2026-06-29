---
name: contribuer
description: >-
  Préparer une contribution propre et adoptable à un repo dont tu n'es PAS mainteneur, de bout en
  bout : resync du fork, branche courte, respect des règles immuables et des conventions du projet,
  garde de validation (tests/lint/build), puis PR petite et prête à relire. Utilise ce skill quand
  tu commences à coder une feature ou un fix sur le repo de quelqu'un d'autre. Pendant « contributeur »
  du skill review-contrib (côté relecteur). Version exécutable d'un bon CONTRIBUTING.md.
---

# contribuer — faire une PR adoptée en minutes

Tu contribues à un repo dont **tu n'es pas le mainteneur**. Pars du principe que `main` =
**production** (souvent déployée automatiquement) : tu n'y touches **jamais** directement — tu
proposes via une **PR**, le mainteneur relit et merge. L'objectif n'est pas seulement que ça marche,
c'est que ce soit **adoptable sans friction** : petit, conforme aux règles du projet, vert.

> C'est le miroir du skill [[review-contrib]] (côté relecteur) : ce que le relecteur va vérifier,
> fais-le toi-même **avant** d'ouvrir la PR.

## 0. D'abord : lire le projet et te mettre à jour

Avant toute ligne de code, **découvre les règles du repo** — ne les devine pas :
```bash
# les docs qui dictent les conventions (lis ce qui existe)
ls CONTRIBUTING.md CLAUDE.md AGENTS.md README.md docs/ 2>/dev/null
```
Puis branche-toi sur une base à jour depuis l'upstream (le repo d'origine, pas ton fork) :
```bash
git remote add upstream https://github.com/<owner>/<repo>.git   # une seule fois
git fetch upstream
git checkout -b feat/<sujet> upstream/main                       # branche COURTE, dédiée
# installe + lance en local selon le repo (npm install && npm run dev, make, etc.)
```

**Une PR = une intention.** Une seule fonctionnalité ou un seul fix par branche — c'est ce qui
réduit les conflits et accélère la relecture.

## 1. Repérer les règles immuables — et ne JAMAIS les franchir

Tout repo sérieux a des **invariants** qu'on ne casse pas (sinon perte de données, rupture de compat,
build cassé). Ils sont en général écrits dans `CONTRIBUTING.md` / `CLAUDE.md` / `AGENTS.md`. Cherche
notamment :

| Type d'invariant | À quoi faire attention |
|---|---|
| **Clé de stockage / format persisté** | Ne jamais renommer une clé (localStorage/IndexedDB/DB) ni changer un format sérialisé sans migration. |
| **Version de schéma / migration** | N'incrémenter qu'en cas de rupture, **avec** la migration qui va avec. |
| **Actions destructives** | Respecter le garde-fou du repo (snapshot/undo avant, confirmation explicite plutôt qu'un dialogue natif). |
| **Budget de bundle / perf** | Une grosse dépendance doit être code-splitée, ou refusée. Vérifie l'impact. |
| **Données auto-générées** | Doivent rester idempotentes / régénérables (marqueur de source, id de lien) — pas de doublons. |

Si le repo liste ses propres règles, **ce sont elles qui priment** sur cette grille générique.

## 2. Épouser les conventions du projet

Le code doit se lire comme le code autour. Avant d'écrire :
- **Lis un fichier voisin** et imite sa structure (mono-fichier vs modules, où vivent les constantes,
  comment sont nommés les helpers).
- **Réutilise les helpers existants** plutôt que d'en réécrire (formatage des montants/dates,
  parsing, accès au state).
- **Respecte la locale et le formatage** du projet (séparateurs décimaux, dates, i18n).
- **Pas de valeurs en dur** là où le repo centralise (constantes, config, taux).

## 3. La garde — avant la PR

Lance la **commande de validation du repo** et exige du **100 % vert**. Cherche-la dans le
`package.json` / `Makefile` / la CI :
```bash
npm run audit     # ex. : tests + lint + build  (adapte au repo : npm test, make check, etc.)
```
Tu touches une logique sensible (calcul, persistance, sécurité) ? **Ajoute un test** sur le même
modèle que les tests existants. Un correctif sans test de non-régression est plus dur à adopter.

## 4. Auto-audit puis PR

Avant d'ouvrir, relis-toi comme le ferait le mainteneur :
- [ ] Validation **verte** ; règles immuables intactes ; conventions respectées.
- [ ] Diff **petit** et ciblé ; aucun secret ; pas de `console.log`/debug oublié ; branche rebasée sur `upstream/main`.
- [ ] Le commit explique **quoi & pourquoi**, pas seulement « fix ».

```bash
git push -u origin feat/<sujet>
gh pr create --repo <owner>/<repo> --base main
```

Remplis le template de PR du repo (quoi & pourquoi, comment tester, checklist). **Petit + vert +
conforme = mergé vite.** Une grosse PR fourre-tout qui touche aux invariants se fait renvoyer.
