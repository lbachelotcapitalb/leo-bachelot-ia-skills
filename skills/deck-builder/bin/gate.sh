#!/usr/bin/env bash
# deck-builder — run the geometry gate on an HTML deck.
#
#   bin/gate.sh /abs/path/deck.html [--slides 3,7] [--out /tmp/r.json] [--strict] [--benchmark NAME] [--set key=val]...
#
# Exits 1 on any HARD defect, so it can gate a loop.
# ego-browser's heredoc runtime has no argv and no env channel: parameters are
# injected by prepending a GATE_ARGS assignment to the script.
set -uo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK=""; SLIDES="[]"; OUT="/tmp/deck-gate.json"; THRESH="{}"; STRICT="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --slides) SLIDES="[$(echo "$2" | tr -d ' ')]"; shift 2 ;;
    --out)    OUT="$2"; shift 2 ;;
    --strict) STRICT="true"; shift ;;
    --benchmark|--bench)
              B="$DIR/../assets/benchmarks/$2.json"
              [ -f "$B" ] || { echo "gate.sh: benchmark inconnu: $2 (voir assets/benchmarks/)" >&2; exit 2; }
              THRESH="$(python3 -c 'import json,sys;print(json.dumps(json.load(open(sys.argv[1]))["thresholds"]))' "$B")"
              shift 2 ;;
    --set)    k="${2%%=*}"; v="${2#*=}"
              THRESH="$(python3 -c 'import json,sys;d=json.loads(sys.argv[1]);d[sys.argv[2]]=float(sys.argv[3]);print(json.dumps(d))' "$THRESH" "$k" "$v")"
              shift 2 ;;
    *)        DECK="$1"; shift ;;
  esac
done

[ -n "$DECK" ] || { echo "usage: gate.sh /abs/path/deck.html [--slides 1,2] [--out f.json] [--strict] [--benchmark NAME] [--set k=v]" >&2; exit 2; }
case "$DECK" in /*) ;; *) DECK="$PWD/$DECK" ;; esac
[ -f "$DECK" ] || { echo "gate.sh: no such file: $DECK" >&2; exit 2; }

LOG="$(mktemp -t deckgate)"
{
  printf 'globalThis.GATE_ARGS=%s;\n' \
    "$(python3 -c 'import json,sys;print(json.dumps({"deck":sys.argv[1],"slides":json.loads(sys.argv[2]),"out":sys.argv[3],"thresholds":json.loads(sys.argv[4]),"strict":sys.argv[5]=="true"}))' \
        "$DECK" "$SLIDES" "$OUT" "$THRESH" "$STRICT")"
  cat "$DIR/gate.mjs"
} | ego-browser nodejs 2>&1 | tee "$LOG"

grep -q 'GATE: PASS' "$LOG" && { rm -f "$LOG"; exit 0; }
rm -f "$LOG"
exit 1
