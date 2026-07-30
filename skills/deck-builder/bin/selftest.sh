#!/usr/bin/env bash
# deck-builder — prove the geometry gate still measures what it claims.
# assets/fixture-deck.html carries three slides with a KNOWN verdict:
#   1 & 2  clean       → 0 hard
#   3      booby-trapped → one defect per audit
# Run this after any edit to gate.mjs. A gate that cannot fail is not a gate.
set -uo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FIX="$DIR/../assets/fixture-deck.html"
OUT="$(mktemp -t deckselftest).json"

"$DIR/gate.sh" "$FIX" --out "$OUT" >/dev/null 2>&1

python3 - "$OUT" <<'PY'
import json, sys
r = json.load(open(sys.argv[1]))
s = {x["index"] + 1: x for x in r["slides"]}
fails = []

for i in (1, 2):
    h = s[i]["verdict"]["hard"]
    if h: fails.append(f"slide {i} should be clean, got {len(h)} hard: {h[:2]}")

hard = "\n".join(s[3]["verdict"]["hard"])
for audit, needle in [
    ("audit_overlaps",   "overlap "),
    ("audit_overflow (clipped)",  "clips its own content"),
    ("audit_overflow (escapes)",  "escapes "),
    ("audit_text_sizes (floor)",  " plancher absolu — "),
    ("audit_text_sizes (contrast)", "contrast "),
]:
    if needle not in hard: fails.append(f"slide 3: {audit} did not fire")

if s[3]["audit_deadspace"] is None: fails.append("slide 3: deadspace not measured")
if s[3]["space"]["occupancy"] <= 0: fails.append("slide 3: occupancy not measured")

if fails:
    print("SELFTEST: FAIL"); [print("  -", f) for f in fails]; sys.exit(1)
print(f"SELFTEST: PASS — 5 audits fire on the trap slide, "
      f"{len(s[3]['verdict']['hard'])} hard defects; slides 1-2 clean")
PY
rc=$?
rm -f "$OUT"
exit $rc
