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
- Gate obligatoire AVANT tout commit : `{{GATE}}` doit passer (exit 0). Si rouge et non réparable proprement dans l'itération ⇒ revert le step, `STATE: BLOCKED`, sortir.
- UN step cohérent par itération, puis commit + MAJ ce fichier + relance session neuve.
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

## Journal des itérations (append-only, le plus récent en HAUT)
<!-- format : - [YYYY-MM-DD hh:mm] STEP · résultat gate · commit · note -->
- (vide — première itération à venir)
