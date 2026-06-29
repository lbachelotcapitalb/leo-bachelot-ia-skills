# deck-builder

> Build or restructure polished, on-brand **PowerPoint (.pptx)** decks programmatically.

A reusable toolkit for generating decks that are **structured** (one idea per slide, assertion
titles, no repetition) and **designed** (filled cards, readable type, consistent tokens, crisp
vector icons). Theme-agnostic — works for any brand. It complements Anthropic's base `pptx` skill
by adding opinionated layout/design rules and a self-verification loop.

## Why it exists

LLM-generated decks tend to drift into the same failure modes: half-empty cards, text spilling past
boxes, the same grid on every slide, decorative colour with no meaning, topic-label titles that say
nothing. This skill encodes hard rules against each of those and gives Claude the helpers + audits
to enforce them **before handing the deck back**.

## What's inside

| File | Role |
|---|---|
| `SKILL.md` | The full instruction set — non-negotiable layout/design rules + the build & QA workflow. |
| `pptx_kit.py` | Build helpers: text, shapes, discs, grids, the **fill rule** (`stack_fill`, `fit_size`, `fit_all`), icons, footer removal, and silent audits (`audit_text_sizes`, `audit_overlaps`, `audit_vbalance`, `audit_overflow`). |
| `svg_icons.py` | Embed true vector **SVG** icon bodies into the .pptx (with PNG fallback). |
| `render_check.py` | Render slides to PNG locally for a silent sanity check. CLI: `python render_check.py deck.pptx 2,3 /tmp` |
| `references/structure.md` | Editorial rules: assertion titles, one-idea-per-slide, de-duplication, deck architecture. |
| `references/design_tokens.md` | Palettes, style recipes, type/space scales. |
| `references/backgrounds.md` | Section-background recipes (plexus-edge, low-poly, gradient, accent-halo, centre-veil). |

## The core rules (enforced automatically)

1. **Fill the space** — no idle voids in a card or at the slide's bottom edge; balance whitespace around blocks; top-align rows of cards to a shared grid.
2. **Shape *and* colour encode category** — never alternate accent colours for decoration; a colour change must map to a real distinction.
3. **One fact, one home** — each proof point lives on exactly one slide.
4. **Assertion titles** — every title is a takeaway sentence, not a noun label.
5. **Readable type floors** — body ≥ 14pt, enforced; cut copy instead of shrinking below the floor.
6. **Consistent tokens** — one palette, one corner-radius recipe.
7. **Background rhythm** — vary by section, never per slide; the motif must never reduce front-text legibility.

## Requirements

- Python 3 with [`python-pptx`](https://python-pptx.readthedocs.io/) and [Pillow](https://pillow.readthedocs.io/).
- For SVG icons: `rsvg-convert` (librsvg).
- For the faithful render check: LibreOffice (`soffice`) + `pdftoppm` (poppler).

```bash
pip install python-pptx pillow
# macOS: brew install librsvg poppler --quiet ; brew install --cask libreoffice
```

## Usage

Just ask Claude to build, redesign, de-clutter or fix the layout of a deck — it reads `SKILL.md`
and drives the kit. The helpers are also usable directly from Python if you want to script a deck
yourself; start by reading `SKILL.md` for the API surface.

## Attribution

Design-token tables adapted from `MiniMax-AI/skills` (MIT); dynamic-fit & text-measurement ideas
from `GongRzhe/Office-PowerPoint-MCP-Server` (MIT). Full notes in `SKILL.md`.
