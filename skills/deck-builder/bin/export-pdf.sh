#!/usr/bin/env bash
# deck-builder — export an HTML deck to a VECTOR pdf.
#   bin/export-pdf.sh /abs/deck.html [/abs/out.pdf]
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DECK="${1:?usage: export-pdf.sh /abs/deck.html [out.pdf]}"
case "$DECK" in /*) ;; *) DECK="$PWD/$DECK" ;; esac
OUT="${2:-${DECK%.html}.pdf}"
case "$OUT" in /*) ;; *) OUT="$PWD/$OUT" ;; esac
[ -f "$DECK" ] || { echo "export-pdf.sh: no such file: $DECK" >&2; exit 2; }
{
  printf 'globalThis.PDF_ARGS=%s;\n' \
    "$(python3 -c 'import json,sys;print(json.dumps({"deck":sys.argv[1],"out":sys.argv[2]}))' "$DECK" "$OUT")"
  cat "$DIR/export-pdf.mjs"
} | ego-browser nodejs
