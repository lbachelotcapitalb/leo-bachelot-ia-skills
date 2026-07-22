#!/usr/bin/env bash
# next.sh — auto-continuation d'une roadmap autonome (mécanisme concret de l'étape « change de session »).
#
# Rôle : relancer une session Claude Code FRAÎCHE (contexte propre) pour le step suivant,
# en réinjectant CONTINUATION_PROMPT.md. La session courante appelle ce script en TOUT
# DERNIER geste quand STATE: RUNNING, puis se termine → la fenêtre de contexte repart à zéro
# et chaque passe apparaît comme une session distincte dans cloudcode.
#
# Softcodé : aucune valeur en dur. Le repo, la branche et le prompt viennent de l'arbo.
# Réglages par variables d'env (défauts entre {}) :
#   ROADMAP_MODEL   {opus}                 modèle de la session relancée
#   ROADMAP_PROMPT  {scripts/roadmap/CONTINUATION_PROMPT.md}  prompt de reprise
#   ROADMAP_PERM    {--dangerously-skip-permissions}          posture permissions
#
# Ce script ne DÉCIDE rien : il relance. C'est le prompt de reprise qui décide de l'appeler
# (RUNNING) ou pas (AWAITING_DECISION / BLOCKED / DONE → on ne relance pas, on s'arrête).
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

MODEL="${ROADMAP_MODEL:-opus}"
PROMPT_FILE="${ROADMAP_PROMPT:-scripts/roadmap/CONTINUATION_PROMPT.md}"
PERM="${ROADMAP_PERM:---dangerously-skip-permissions}"

# Garde-fou anti-emballement EN PREMIER : ne pas relancer si l'état n'est pas RUNNING (halt propre).
# (Le prompt est censé déjà l'avoir vérifié ; double sécurité côté mécanisme.)
PROGRESS="$(dirname "$PROMPT_FILE")/PROGRESS.md"
if [ -f "$PROGRESS" ] && grep -qE '^STATE:[[:space:]]*(AWAITING_DECISION|BLOCKED|DONE)' "$PROGRESS"; then
  echo "next.sh: STATE non-RUNNING → pas de relance (halt volontaire)." >&2
  exit 0
fi

[ -f "$PROMPT_FILE" ] || { echo "next.sh: prompt introuvable: $PROMPT_FILE" >&2; exit 1; }
command -v claude >/dev/null || { echo "next.sh: binaire 'claude' introuvable" >&2; exit 1; }

LOGDIR="$HOME/.handoff/$(basename "$ROOT")"
mkdir -p "$LOGDIR"
TS="$(date +%Y%m%d-%H%M%S)"
LOG="$LOGDIR/roadmap-$TS.log"

# setsid + nohup : la nouvelle session survit à la fin de la session courante et à toute
# déconnexion SSH. </dev/null : pas de stdin (headless). Elle réécrit son propre transcript
# sous ~/.claude/projects → visible dans cloudcode.
setsid nohup claude -p "$(cat "$PROMPT_FILE")" \
  --model "$MODEL" \
  $PERM \
  --output-format text \
  >"$LOG" 2>&1 </dev/null &

echo "next.sh: session fraîche relancée (model=$MODEL) → $LOG"
