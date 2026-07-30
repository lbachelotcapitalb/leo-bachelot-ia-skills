#!/usr/bin/env python3
"""L3, repair 3 — anchor each model's type ladder on the 1920 canvas.

Freezing the viewport units (repair 1) exposes the real problem: these models
were authored fluid for ~1100-1400px screens, so their frozen body sizes land
around 15-20px. On a 1920x1080 slide canvas that is 7.5-10pt in pptx terms —
far under the house floor (28px body / 14pt). Shipping them as-is means every
generated deck fails audit_text_sizes.

Pixels don't travel, ratios do (visual-lab rule 2). So we do NOT rewrite the
document's numbers a second time — 1920px/1080px full-bleed values are
indistinguishable from ordinary sizes and a blanket multiply would break them.
Instead each model gets ONE factor k and a pre-computed on-canvas ladder,
written at the top of its design.md and into index.json.
"""
import json, re
from pathlib import Path

DST = Path.home() / ".claude/skills/deck-builder/assets/templates"
TARGET_BODY = 30.0          # px on the 1920 canvas (floor is 28)
ANCHOR_PREF = ["body", "body-md", "body-base", "body-roman", "body-text", "body-serif",
               "body-lg", "body-sm", "paragraph", "text"]
DISPLAY_CEILING = 420.0     # px: above this a "type size" is a graphic, not type
NOT_TEXT = re.compile(r"quote-mark|display|stat|counter|hero|numeral|metric-value|mono-tag", re.I)


def roles(fm: str) -> dict:
    """role -> px size, from the `typography:` block of the YAML frontmatter."""
    block = re.search(r"^typography:\n(.*?)(?=^\S|\Z)", fm + "\n", re.S | re.M)
    if not block:
        return {}
    out, cur = {}, None
    for line in block.group(1).splitlines():
        m = re.match(r"^  ([\w-]+):\s*$", line)
        if m:
            cur = m.group(1); continue
        m = re.match(r'^\s+fontSize:\s*"?([\d.]+)(?:px)?"?\s*$', line)
        if m and cur:
            out[cur] = float(m.group(1))
    return out


def pick_anchor(r: dict):
    for k in ANCHOR_PREF:
        if k in r:
            return k
    cands = {k: v for k, v in r.items() if not NOT_TEXT.search(k)}
    if not cands:
        cands = r
    ordered = sorted(cands.items(), key=lambda kv: kv[1])
    return ordered[len(ordered) // 2][0]


def main():
    idx = json.loads((DST / "index.json").read_text())
    report = []
    for m in idx["models"]:
        p = DST / m["slug"] / "design.md"
        text = p.read_text()
        fm = re.match(r"^---\n(.*?)\n---\n", text, re.S).group(1)
        r = roles(fm)
        if not r:
            report.append((m["slug"], "NO SIZES")); continue
        anchor = pick_anchor(r)
        k = max(1.0, round(TARGET_BODY / r[anchor], 3))
        # A uniform k is only legitimate while the model's own hierarchy stays type.
        # Some models pair a tiny reading body with a 400px graphic numeral; scaling
        # that numeral too would blow it off the canvas. Then scale reading roles only.
        mode = "uniform"
        if k > 1.0 and max(r.values()) * k > DISPLAY_CEILING:
            mode = "reading-only"
        ladder, scaled = {}, []
        for name, px in sorted(r.items(), key=lambda kv: -kv[1]):
            if mode == "uniform" or px * k <= DISPLAY_CEILING:
                ladder[name] = int(round(px * k)); scaled.append(name)
            else:
                ladder[name] = int(round(px))
        lines = "\n".join(
            f"| `{n}` | {r[n]:g} px | **{ladder[n]} px**{'' if n in scaled else ' — unchanged'} |"
            for n in ladder)
        floor_hits = [n for n, v in ladder.items() if v < 24]

        if k == 1.0:
            head = ("This model is **already authored at the 1920×1080 canvas** — its own sizes "
                    "are on scale (k = 1). Use them as written.\n")
        else:
            head = (f"This model was authored fluid for a ~{int(round(1920 / k))} px stage; its "
                    f"reading sizes land under the house floor (28 px body). One factor "
                    f"**k = {k}** re-anchors the ladder on the 1920×1080 canvas, anchored on "
                    f"`{anchor}` → {int(round(r[anchor] * k))} px. Ratios are preserved, so the "
                    f"model's hierarchy is intact.\n")
        if mode == "reading-only":
            head += (f"\n⚠️ **Partial scale.** This model pairs small reading type with graphic-"
                     f"scale display type. Roles that would pass {int(DISPLAY_CEILING)} px are left "
                     f"as written (marked *unchanged*) — they are already canvas-scale graphics, "
                     f"not text. Only the reading ladder moves.\n")

        note = (
            f"## Type scale on the 1920 canvas — USE THIS LADDER\n\n{head}\n"
            f"| role | model (frozen) | **on canvas — use this** |\n|---|---|---|\n{lines}\n\n"
            f"**Multiply the model's spacing, padding, radii, borders and component sizes by the "
            f"same k = {k}.** The exceptions are canvas-sized values: `1920px` (was `100vw`), "
            f"`1080px` (was `100vh`) and anything derived from them stay as written — they are "
            f"already expressed in canvas units.\n\n"
            f"Adjust the anchor, not the ratios: a dense reading deck may drop the body to 28 px, "
            f"a speaker-led deck may lift it to 36 px. Never go under 28 px body / 26 px kicker / "
            f"24 px absolute (doctrine rule 4).\n"
        )
        if floor_hits:
            note += (f"\n⚠️ Even re-anchored, these roles land under 24 px: "
                     f"{', '.join(floor_hits)}. Chrome only — never reading text.\n")
        text = text.replace("\n---\n", "\n---\n\n" + note, 1)
        p.write_text(text)
        m["canvas_scale"] = {"k": k, "mode": mode, "anchor_role": anchor,
                             "body_px": int(round(r[anchor] * k)),
                             "authored_width_px": int(round(1920 / k))}
        report.append((m["slug"], mode, anchor, r[anchor], k, int(round(r[anchor] * k)), len(ladder)))

    (DST / "index.json").write_text(json.dumps(idx, indent=1, ensure_ascii=False) + "\n")
    for row in report:
        print("  ".join(str(x) for x in row))


if __name__ == "__main__":
    main()
