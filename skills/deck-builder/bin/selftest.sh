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

# le contraste doit rester MESURE sous un fond en degrade, et sur le pire arret
grad = [t for t in s[3].get("text", []) if "se noie" in (t.get("text") or "")]
if not grad:
    fails.append("slide 3: la sonde de degrade a disparu du fixture")
elif grad[0].get("contrast") is None:
    fails.append("slide 3: contraste non mesure sous un degrade (bgOf a renonce)")
elif grad[0]["contrast"] > 3.0:
    fails.append(f"slide 3: degrade mesure sur le meilleur arret, pas le pire ({grad[0]['contrast']})")

if s[3]["audit_deadspace"] is None: fails.append("slide 3: deadspace not measured")
if s[3]["space"]["occupancy"] <= 0: fails.append("slide 3: occupancy not measured")

if fails:
    print("SELFTEST: FAIL"); [print("  -", f) for f in fails]; sys.exit(1)
print(f"SELFTEST: PASS — 5 audits + la sonde de degrade tirent sur la slide piegee, "
      f"{len(s[3]['verdict']['hard'])} hard defects; slides 1-2 clean")
PY
rc=$?
rm -f "$OUT"
exit $rc
