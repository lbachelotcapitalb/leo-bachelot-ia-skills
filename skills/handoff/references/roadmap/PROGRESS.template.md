# PROGRESS — {{TITRE}} · exécution autonome

<!-- ÉTAT VIVANT. Chaque session fraîche lit ce fichier, fait UN step, le met à jour, commit,
     puis se relance en session neuve via scripts/roadmap/next.sh (cf. CONTINUATION_PROMPT.md). -->

STATE: RUNNING
<!-- RUNNING (continue) | AWAITING_DECISION (halt, présenter le tableau à Léo) | BLOCKED (gate rouge, halt) | DONE (fini) -->

CURRENT_STEP: {{PREMIER_STEP}}
LAST_COMMIT: (aucun encore)
UPDATED: (à stamper par l'itération)

---

## Règles dures (chaque itération DOIT les respecter)
- **GitHub = source unique de vérité** : ce dossier est un cache jetable. Début de step : `git fetch && git reset --hard origin/{{BRANCHE}}`. Fin de step : `git commit && git push origin {{BRANCHE}}`.
- Branche = `{{BRANCHE}}` UNIQUEMENT. Push sur CETTE branche à chaque step (voulu). Jamais `git checkout main`, jamais merge main, jamais deploy (sauf demande explicite de Léo). Pousser une branche isolée ≠ deploy.
- Gate obligatoire AVANT le commit FINAL du step : `{{GATE}}` doit passer (exit 0). Si rouge et non réparable proprement dans l'itération ⇒ revert le step, `STATE: BLOCKED`, sortir. (Les commits `wip(…)` de checkpoint sont exemptés — voir ci-dessous.)
- UN step cohérent par itération, puis commit + MAJ ce fichier + relance session neuve.
- **Checkpoint intra-step** : sur un step multi-gestes, après CHAQUE sous-tâche cohérente ⇒ `git commit -m "wip(<step>): …" && git push` + coche la sous-checklist « Checkpoint intra-step ». Un crash mi-step ne coûte alors que la dernière sous-tâche, jamais le step entier.
- Toute décision de modèle (ambiguïté, choix de représentation, écart non trivial) ⇒ tableau dans DECISIONS_PENDING.md + `STATE: AWAITING_DECISION`, halt.

## Oracle / gate disponibles
<!-- Liste ici les commandes de vérification exécutables SUR LA CIBLE (ce que le VPS peut lancer). -->
- `{{GATE}}`
- {{AUTRES_TESTS}}

---

## Steps (checklist ordonnée)
<!-- Un `[ ]` par step. Le premier non coché depuis CURRENT_STEP = le prochain à faire.
     Marque FRONTIÈRE les steps qui demandent une décision de Léo (halt + tableau). -->
- [ ] {{PREMIER_STEP}} — {{DESCRIPTION}}
- [ ] ...

---

## Checkpoint intra-step (reprise après crash)
<!-- Sous-checklist du step EN COURS. Vide si le step est mono-geste ou pas commencé.
     La session la remplit au DÉBUT d'un step multi-gestes (commit+push), coche + commit/push
     « wip(<step>): … » après CHAQUE sous-tâche, puis la VIDE au commit final du step.
     Une session fraîche qui trouve des cases ici reprend à la première NON cochée :
     le travail coché est déjà dans les commits wip poussés — ne PAS refaire le step de zéro. -->
CHECKPOINT_STEP: (aucun)
- (vide)

---

## Journal des itérations (append-only, le plus récent en HAUT)
<!-- format : - [YYYY-MM-DD hh:mm] STEP · résultat gate · commit · note -->
- (vide — première itération à venir)
