#!/usr/bin/env python3
"""L3 — import the 34 design-system models into the deck-builder skill.

Two repairs applied at import (the point being that they are done ONCE here,
not re-derived at every deck generation):
  R1  viewport units frozen to px on the 1920x1080 canvas
      (1vw = 19.2px, 1vh = 10.8px, 1rem = 16px, clamp/min/max/calc resolved).
  R2  the dangling `template.html` reference (35 mentions, file never shipped)
      repointed at assets/deck.html, the skeleton that does exist.
Also: the 4-paragraph "Fixed-Stage Policy" boilerplate is replaced by a short
note saying the translation it asks for has already been done.
"""
import json, re, shutil, sys
from pathlib import Path

SRC = Path.home() / "Documents/Claude/Projects/deck-html/ref-frontend-slides"
DST = Path.home() / ".claude/skills/deck-builder/assets/templates"

VW, VH, REM = 19.2, 10.8, 16.0

POLICY_NOTE = """## Fixed-stage policy — already applied

This deck system is used at a **fixed 1920×1080 stage** scaled as a whole to the
viewport (see `assets/stage.css` / `assets/stage.js`). Every length below has
already been frozen to px on that canvas at import time: `vw`, `vh`, `rem`,
`clamp()`, `min()`, `max()` and `calc()` were resolved once (1vw = 19.2px,
1vh = 10.8px, 1rem = 16px). **Use the numbers as written.** Do not re-derive
them, and do not put a viewport unit back into a generated deck — the stage is
the unit. If a later section of this file describes the source template as
"viewport-fluid", that is source history, not the generation model.
"""

POLICY_RE = re.compile(
    r"## Frontend Slides Fixed-Stage Policy\n.*?verify rendered screenshots for both text overflow and panel overlap\.\n",
    re.S,
)

NUM = r"[+-]?(?:\d+\.?\d*|\.\d+)"
UNIT_RE = re.compile(rf"({NUM})\s*(vw|vh|rem)\b", re.I)
# innermost clamp/min/max/calc: no nested parenthesis inside
FN_RE = re.compile(r"\b(clamp|min|max|calc)\(([^()]*)\)", re.I)


def fmt(px: float) -> str:
    r = round(px, 1)
    return f"{int(r)}px" if r == int(r) else f"{r}px"


def to_px(tok: str):
    """Resolve a single length token to px, or None."""
    tok = tok.strip()
    m = re.fullmatch(rf"({NUM})\s*(px|vw|vh|rem)", tok, re.I)
    if m:
        n, u = float(m.group(1)), m.group(2).lower()
        return n * {"px": 1.0, "vw": VW, "vh": VH, "rem": REM}[u]
    if re.fullmatch(NUM, tok):
        return float(tok)
    return None


def resolve_fn(name: str, inner: str):
    name = name.lower()
    if name == "calc":
        expr = UNIT_RE.sub(lambda m: str(float(m.group(1)) * {"vw": VW, "vh": VH, "rem": REM}[m.group(2).lower()]), inner)
        expr = re.sub(rf"({NUM})\s*px\b", r"\1", expr, flags=re.I)
        if not re.fullmatch(r"[\d\s.+\-*/]+", expr):
            return None                      # %, em, var() … leave alone
        try:
            return fmt(eval(expr, {"__builtins__": {}}, {}))  # arithmetic only
        except Exception:
            return None
    args = [to_px(a) for a in inner.split(",")]
    if any(a is None for a in args):
        return None
    if name == "clamp":
        if len(args) != 3:
            return None
        lo, val, hi = args
        return fmt(min(max(lo, val), hi))
    if name == "min":
        return fmt(min(args))
    if name == "max":
        return fmt(max(args))
    return None


def freeze(text: str) -> tuple[str, int]:
    n = 0
    for _ in range(12):                       # depth of nesting
        out, changed = [], False
        pos = 0
        for m in FN_RE.finditer(text):
            r = resolve_fn(m.group(1), m.group(2))
            if r is None:
                continue
            out.append(text[pos:m.start()]); out.append(r)
            pos = m.end(); changed = True; n += 1
        out.append(text[pos:])
        text = "".join(out)
        if not changed:
            break

    def sub_unit(m):
        nonlocal n
        n += 1
        return fmt(float(m.group(1)) * {"vw": VW, "vh": VH, "rem": REM}[m.group(2).lower()])

    text = UNIT_RE.sub(sub_unit, text)
    return text, n


def fix_template_html(text: str) -> tuple[str, int]:
    n = text.count("template.html")
    text = re.sub(
        r"- Do not read `template\.html` for preview generation\.\n", "", text)
    text = re.sub(
        r"[^\n]*`template\.html`[^\n]*\n",
        "- There is no per-model `template.html` in this import (the source repo referenced one "
        "it never shipped). The implementation skeleton is `assets/deck.html`.\n",
        text)
    return text, n


def main():
    idx = json.loads((SRC / "bold-template-pack/selection-index.json").read_text())
    if DST.exists():
        shutil.rmtree(DST)
    DST.mkdir(parents=True)

    stats = {"vw": 0, "tpl": 0, "policy": 0}
    models = []
    for t in idx["templates"]:
        slug = t["slug"]
        d = DST / slug
        d.mkdir()
        for kind, key in (("design.md", "design_md"), ("preview.md", "preview_md")):
            raw = (SRC / t[key]).read_text()
            raw, k = POLICY_RE.subn(POLICY_NOTE, raw)
            stats["policy"] += k
            raw, n = freeze(raw)
            stats["vw"] += n
            raw, m = fix_template_html(raw)
            stats["tpl"] += m
            (d / kind).write_text(raw)
        models.append({
            "slug": slug, "name": t["name"], "tagline": t["tagline"],
            "mood": t["mood"], "tone": t["tone"], "formality": t["formality"],
            "density": t["density"], "scheme": t["scheme"],
            "best_for": t["best_for"], "avoid_for": t["avoid_for"],
            "preview": f"assets/templates/{slug}/preview.md",
            "design": f"assets/templates/{slug}/design.md",
        })

    out = {
        "schema_version": 2,
        "source": "zarazhangrui/frontend-slides — bold-template-pack (MIT), imported "
                  "and repaired for deck-builder",
        "canvas": {"w": 1920, "h": 1080, "units": "px, frozen at import"},
        "reading_protocol": [
            "1. read THIS file only — never bulk-read design.md",
            "2. shortlist 2-3 models on mood / formality / density / scheme / avoid_for",
            "3. read only the shortlisted models' preview.md, and build the maquette from it",
            "4. read the full design.md of the ONE model Léo picked, then build the deck",
        ],
        "count": len(models),
        "models": models,
    }
    (DST / "index.json").write_text(json.dumps(out, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps({**stats, "models": len(models)}, indent=1))


if __name__ == "__main__":
    main()
