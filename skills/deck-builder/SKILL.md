---
name: deck-builder
description: "Build or restructure polished, on-brand decks — as a self-contained HTML deck (1920×1080 fixed stage, PDF export) or as a PowerPoint .pptx. Use when creating, redesigning, de-cluttering, or fixing the layout of a deck/pitch/plaquette/presentation/slides — especially slides that feel empty, repetitive, or inconsistent, or when Léo asks for a vignette, a stat card, a slide element already seen in a reference. Léo names the output medium (« en HTML », « en pptx »); this skill never guesses it. Carries the layout doctrine shared by both media (fill the space, cross-card alignment, colour encodes category, type floor, one fact one home, assertion titles), a 34-model HTML design-system library, a measured geometry gate (overlap / overflow / dead space / balance / legibility), and a bridge to the visual-lab pattern library (~/visual-lab) — which also SOURCES free licensed photography (Pexels with the vault key, The Met without any key), downloaded and filtered by palette so a deck's images share one casting. Use it too when Léo asks for photos, visuals or images for a deck (« trouve-moi des photos », « il manque des visuels », « source des images »). Complements the base `pptx` skill."
---

# deck-builder

One skill, two output media. The **doctrine below is medium-agnostic** — it governs
what a good slide is, and it applies whether the slide ends up in a browser or in
PowerPoint. The medium-specific kit lives in a backend reference, loaded only once the
medium is known.

## Routing — Léo names the medium, never guess it

| Léo says | Backend | Read |
|---|---|---|
| « en HTML », « slides web », « une page », « un deck à partager par lien » | HTML | `references/backend-html.md` |
| « en pptx », « PowerPoint », « il faut que le client puisse éditer » | pptx | `references/backend-pptx.md` |
| nothing explicit | **ask, one question** | — |

Never infer the medium from the subject. A pitch deck is not more "HTML" than "pptx" —
the answer depends on who receives it and what they do with it, and that is Léo's call.
Two decks on the same subject in the two media is a legitimate ask, not a contradiction.

For the "quick deck, mostly images, nobody will read it twice" case, the **Gamma**
connector is already wired and is the right tool — HTML is for bespoke work. The two
coexist; say which one you are taking and why in one line.

## Chronologie de production (Léo, verbatim) — applies to BOTH backends

> 1. audit du besoin
> 2. réflexion / sourcing d'idées dans la base
> 3. rédaction du plan de production
> 4. soumission d'une première maquette pour proposition
> 5. validation ou itération avec l'humain (Léo)
> 6. production

This is the skeleton of every job. Concretely:

1. **Audit du besoin** — who is the audience, what decision must they make, what do they
   already know, how long do they have, is this read alone or narrated? A deck built
   before this is answered is a deck rebuilt.
2. **Réflexion / sourcing** — go find the substance in the real base before writing a
   word: `polar` (comm, SEO, stats), `karto` (the SI map), `methylen` (accounting
   figures), the repos, prior decks. **A number on a slide comes from a system, never
   from your head.** Also shop `~/visual-lab` at this point — see below.
3. **Plan de production** — one line per slide: assertion title + the single idea + the
   exhibit type. Run the ghost-deck test (rule 3) and build the one-fact-one-home map
   (rule 2). This is what Léo validates, and it is cheap to change here.
4. **Première maquette** — **ONE representative slide**, fully finished, not the deck.
   Pick the slide that carries the most design risk (the densest content slide, not the
   cover — a cover always looks good and proves nothing). Show, don't tell: generate the
   real thing rather than asking a question about taste.
5. **Validation ou itération** — Léo says go, gives a consigne to iterate on, or hands
   back his own version verbatim. Do not start step 6 before one of the three.
6. **Production** — build the whole deck, then **the gate**: no deck is handed back
   before the geometric audit passes (see "Vérification" below). Handing back a deck with
   an unmeasured overlap is the failure mode this skill exists to kill.

Steps 4 and 5 collapse into nothing when Léo has already validated a direction in a
previous session on the same deck — reuse it, don't re-ask.

## Use the library before inventing (visual-lab)

`~/visual-lab` holds vignettes reverse-engineered from real reference decks: each one is a
documented intention, a set of RATIOS, and a list of **benchmarks** — measurable assertions
(chamfer ÷ width, type-size jump, contrast, no-overflow) that the vignette must satisfy. They
exist so a slide element is never re-guessed twice, and so "it looks fine" is not the only
proof available. It is shared with the HTML/web side, so it serves both backends.

```bash
cd ~/visual-lab && node bin/index.mjs            # index ALWAYS regenerated first (see below)
grep -n "vignette\|stat\|card" INDEX.md          # what exists, with employer / éviter
node bin/search.mjs "stat accent"                # full-text, prints the HTML fragment
node bin/check.mjs pat-stat-block-accent         # the benchmarks, measured in a real browser
```

Three rules that make this work, all learned the hard way:

1. **The index is generated, never hand-edited.** `node bin/index.mjs` rewrites `INDEX.md` and
   `index.json` from `patterns/*.json`. Run it BEFORE reading the library and AFTER touching
   any pattern — `vl_pptx` reads `index.json`, so a stale index makes an emitter fail with a
   "geometry.<key> absent" error whose real cause is the missing re-index.
2. **Pixels don't travel, ratios do.** A fragment is tuned for a 1600px-wide slide; converted
   literally, its 17px body becomes 10.2pt — below the body floor. Anchor the scale on the
   body size and derive everything else from the pattern's ratios (`vl.scale()` on the pptx
   side). Never copy a px value from a fragment into a slide of a different width.
3. **Two checkers, one set of assertions.** `bin/check.mjs` measures the HTML in a browser,
   `vl.audit()` measures what was actually placed on a .pptx slide. When one catches something
   the other misses, add the assertion on BOTH sides — that is how the body contrast on the
   orange accent (2.77:1, below the 3:1 large-text floor) was caught: the .pptx audit had the
   check, the HTML harness didn't.

**Adding to the library is part of the job.** When you design a vignette that works and could
serve again, extract it: `patterns/<id>.json` (intent, when to use, when to AVOID, vars,
`geometry.root/ratios/type_px/pad_ratio`, `benchmarks`) + `<id>.html`, then `node bin/index.mjs`
(it refuses to index an incomplete pattern), `node bin/check.mjs <id>`, and a look at
`node bin/render.mjs --pattern <id>`. A vignette that only lives inside one deck is a vignette
you will rebuild by hand next quarter.

## Source real photography — free, licensed, palette-filtered (visual-lab/bin/photos.mjs)

A deck that needs photographs does NOT need a stock-photo browsing session, and it must never
hotlink a remote URL (a deck is a file that outlives the link). `~/visual-lab/bin/photos.mjs`
sources images, **downloads** them next to the deck material, and writes a `manifest.json`
carrying photographer, source URL and licence — the only thing you need if the deck is later
published.

```bash
cd ~/visual-lab
# Pexels — contemporary editorial photography. Key lives in Bitwarden, never in a settings file.
node ~/Documents/Claude/Projects/cartographie-it/bw-get.mjs \
  --item "Pexels — API" --field PEXELS_API_KEY --as PEXELS_API_KEY \
  --exec 'node bin/photos.mjs --slug <deck> --palette sys-10 --n 4 \
    --query "empty office golden hour" --query "hands on keyboard"'

# The Met — public-domain artworks (CC0). NO KEY. Texture, matter, backgrounds.
node bin/photos.mjs --provider met --slug <deck> --palette "#1B44D8" --query "ceramic glaze"

node bin/render.mjs assets/photos/<deck>/board.html 1600 1180   # look at the harvest
```

**Why the palette filter is the whole point.** What makes a set of images read as one deck is
not the quality of each photo, it is their shared CASTING. The tool scores every candidate by
ΔE76 in CIELAB against a target palette — pass it the deck's own palette (`--palette sys-NN`,
or the hex list of the design system in use) and the harvest comes back on-brand. `--tol`
loosens the seuil (42 by default), `--any` gives up sorting.

Two facts to keep in mind, both paid for:
- **A neutral target proves no casting.** Feeding the cream `#EDEAE3` of a system let a cold
  blue-grey photo through — a grey sits at moderate ΔE from every grey in the world. Low-chroma
  targets are dropped automatically; pass the ACCENTS, not the paper colour.
- **Pexels publishes `avg_color`, the Met does not.** So Pexels sorting costs 1 request per 80
  candidates, while the Met costs 1 detail request per candidate plus a thumbnail probe
  (`--scan` bounds it). Prefer Pexels when a key is available.

The `.jpg` files are gitignored in visual-lab (no binary weight in history) — the manifest is
what is versioned, and it is enough to re-download an identical harvest.

---

# The non-negotiable rules

These are hard constants, medium-agnostic. Apply them without being asked. Each backend
reference names the helper that enforces the rule in that medium.

## 1. FILL THE SPACE — no idle voids

Nothing justifies a large empty area inside a card/box/vignette. If content
floats at the top with a void below, you did it wrong. Fix by, in order:
1. **Grow the text/icon** so content fills the box.
2. **Distribute** remaining space as equal gaps (before/between/after) — never dump the
   slack at the bottom.
3. If still airy, **add substance** (a stat, a proof, a one-line punch).

Centering a small block in a big card is NOT filling — it just splits the void.

**Fill the SLIDE canvas, not just the cards.** The bottom-most module must reach the
standard bottom margin. If a large idle band sits at the bottom of the slide, LOWER
and/or ENLARGE the lowest module (bigger elements, more spacing, or vertically distribute
the sections across the full content height). A void at the slide's bottom edge is the
same defect as a void in a card. Check every slide's bottom strip before handing back.

**Balance the whitespace AROUND a block.** When a block (a grid, a logo wall, a card
cluster) sits in the free band between two fixed elements — header/intro above,
footer/testimonial below — the leftover vertical space must be split ROUGHLY EVENLY top
and bottom. A big void on ONE side while the other side is cramped reads as a bug, not a
choice. Centre it in its band, computing the position from the MEASURED header bottom —
never from a hardcoded content band that ignores where the header actually ends. If both
gaps are large, the block is too small → enlarge type/nodes/pitch to exploit the space.

**Cross-card alignment (a ROW of equal-size cards):** TOP-ALIGN to a SHARED grid, never
center each card independently. Icons on one line, labels on one line, titles on one line,
bodies starting on one line — across ALL cards. Reserve the title block at the MAX title
height over the set so a 2-line title on one card doesn't push its body below a 1-line
neighbour's. Variation in text length then shows ONLY at the bottom (correct + planned).
Cards are the same size → plan the bottom margin so short cards read balanced, not empty.
This applies to EVERY corresponding element, including a meta/footer line (a duration tag,
a price, a date, a stat) pinned near the card bottom: it must START on one SHARED baseline
across all cards — top-anchor it at a common offset and reserve the MAX height. NEVER
bottom-anchor a footer per-card: a 1-line tag then sits lower than a 2-line one and the row
of tags zig-zags — a visible asymmetry. **Same-start, grow-down.**

## 1b. SHAPE — AND COLOUR — ENCODE CATEGORY; don't imply false grouping

Same visual form = "same kind". So vary the form by category: items of one category share
a shape; a different-category item gets a different treatment (e.g. a transversal item
becomes a full-width banner under a grid, not a 6th identical cell). Conversely never split
same-category items into different shapes. Let the layout mirror the real categorisation.

**The same law governs COLOUR. A colour change must encode a real distinction — never
decorate.** Alternating accent colours card-by-card or column-by-column (teal, gold, teal,
gold…) with no underlying meaning is a DEFECT: it tells the reader "these differ" when they
don't. If items are the same kind, give them ONE accent. Use a second colour ONLY when it
maps to something (a genuine two-sided split like MÉTIER vs TECH, an emphasis/CTA, a key
figure, a transversal banner). Default: ONE structural accent, the second reserved for real
emphasis. When in doubt, uniform. (Léo, repeatedly: « une alternance de couleur doit avoir
une raison — sinon uniformise. »)

**Vary BY CHAPTER to fight monotony without breaking the line.** A deck where every slide is
the SAME accent reads as heavy; varying EVERY slide reads as random. The resolution: code
the accent by SECTION/CHAPTER — one identity per chapter, uniform within it, changing ONLY
at chapter boundaries (a real reason: narrative + wayfinding). Stay anchored on the brand's
1-2 colours; get variety from a SMALL fixed kit reused across the deck — the two anchors +
neutral white + treatments (filled / outline / deep shade). Map the arc to the story so the
colour shift MEANS something. Three hard constraints:

1. **Accent legibility follows BACKGROUND luminance.** A bright/warm accent reads on dark bg
   but dies on light: gold on navy = crisp; gold on ivory = muddy ochre. SAMPLE each
   section's bg luminance (light if >150/255) and pick the accent that survives it.
2. **Glyph ↔ chip contrast, and UNIFORM glyph colour per slide.** Navy glyph on a light chip,
   white glyph on a dark chip. Keep every glyph on a slide the SAME colour. Quick ratios:
   navy-on-gold ≈ 9.9:1 (great); WHITE-on-gold ≈ 1.9:1 (fails) — gold chips want navy glyphs.
3. **Watch SHARED icon/logo media** — recolouring one slide's glyph can leak onto another
   slide reusing the same file (see the pptx backend's gotchas; in HTML, a shared CSS class).

## 2. ONE FACT, ONE HOME — no repetition across slides

Before writing copy, map each recurring proof point (founding year, headline metric,
certification, award…) to exactly ONE slide. Remove it everywhere else. Repetition reads as
padding and erodes trust. See `references/structure.md`.

## 3. ASSERTION TITLES, not topic labels

Every content slide title is a short sentence stating the takeaway, not a noun label
("Power BI is the leader we standardised on", not "Power BI"). Reading the titles
top-to-bottom should tell the whole story (the "ghost-deck" test).

## 4. READABLE TYPE — a hard FLOOR; a container MUST CONTAIN its content

The floor is one physical size expressed in each medium's unit. A 16:9 pptx slide is
960 pt wide and the HTML stage is 1920 px wide, so **1 pt = 2 px exactly** — the same
floor, two units:

| role | pptx | HTML stage |
|---|---|---|
| body (hard floor) | 14 pt | 28 px |
| kicker / eyebrow | 13 pt | 26 px |
| absolute floor — nothing legible below | 12 pt | 24 px |
| titles | 28–36 pt | 56–72 px |

**These are floors, not suggestions.** If text must shrink below the floor to fit, **cut
content — don't shrink**. NEVER let text spill past its container's bottom. For a row of
equal cards, size all bodies at the one size at which the LONGEST body fits, applied
uniformly. If the longest body still overflows, the card is too small or the copy too long
→ shorten copy or enlarge the card.

## 4b. LEGIBLE LOGOS — a logo wall is proof, not a footnote

Client/partner logos must be clearly identifiable; a logo too small or too low-contrast to
read is the same hard defect as sub-floor text. (1) Make them BIG — size every logo to a
shared target HEIGHT (clamp very wide wordmarks by width) so all read at similar visual
weight. (2) Logos come with MIXED backgrounds (transparent, white boxes, colored squares) —
dropped straight onto a tinted/dark/ivory background, half vanish or clash. Put each on a
UNIFORM white tile of equal size: that is a clean logo board, NOT fussy per-item framing —
reserve that for a WALL of many mixed logos on a tinted background. For a SINGLE logo on a
dark card, do the opposite: strip its baked white background or use its self-contained
colored mark, and place it directly on the card. Strip ONLY a flat uniform backdrop behind a
self-contained mark; if the logo has MEANINGFUL interior white (a medal, a knockout, a badge
— e.g. EcoVadis), do NOT strip it (you gut the mark) — mount it on a clean rounded white
chip, an intentional badge. (3) Source REAL marks — extract them from elsewhere in the deck,
or fetch the official logo from the web (Wikipedia infobox image URL → `curl -A <ua>`;
network works). A typeset name is a last-resort fallback, never the goal. (4) A logo must
NEVER overlap text — give it its own zone; overlap is a hard defect. (5) VERIFY with a
faithful render that every mark is recognisable and clear of text.

## 5. CONSISTENT TOKENS

Pick ONE palette + ONE corner-radius style recipe (Sharp/Soft/Rounded/Pill) and apply
everywhere. Outer corner radius ≥ inner element radius. For a pill bar set radius so
corner == height/2. No stray colors. See `references/design_tokens.md`. On the HTML side the
chosen design system (one of the 34 models) IS the token set — do not mix two.

**Card-top accent bars must HUG the card's corners, not float.** A free pill bar laid on a
rounded card overhangs at the two top corners — a thin bar's radius caps at half its height,
smaller than the card's corner radius, so its corners poke past the card's contour. Don't fix
this by insetting the bar off the edges (looks detached). Make the accent flush to the card
top, span the FULL card width, and trace the card's exact corner arc on its top two corners
(square bottom) — the colour reads as the card's top edge "coloured in". (HTML: the accent is
a `::before` on the card with `border-radius: <r> <r> 0 0` and `overflow:hidden` on the card.)

## 6. NO running-footer clutter unless asked

Drop page-number / "COMPANY NAME" running footers; the logo top-left is enough. A slide
counter that lives OUTSIDE the stage (deck chrome, HTML backend) is fine — it is not printed
and not part of the design.

## 7. BACKGROUND RHYTHM — vary by section, never per slide; stay on-moodboard

One background on every content slide reads as monotonous; a different background on every
slide reads as chaos. The fix is SECTION RHYTHM: group slides into coherent sections and give
each section ONE background, switching only at section boundaries. Keep the cover and the
closing/contact slide on the hero background. Carry this into every multi-section deck —
actively decide where the background should turn over.

Vary the TREATMENT, never the moodboard. ONE palette + ONE motif family across the whole deck;
per section change only: motif geometry (network/plexus ↔ low-poly facets ↔ dot-grid), value
(dark ↔ light/inverted ↔ tinted), or a single accent glow. A light/inverted section is the
strongest breather and makes logos/screenshots pop — but you MUST recolor the text sitting
directly on it (eyebrow/title/subtitle → dark); text inside dark cards stays light.

Backgrounds must RECEDE: keep the motif subtle — low edge opacity, a slight veil — so it never
competes with the front. A pattern whose lines cross and reduce the legibility of text on top —
especially captions sitting directly on the background with no card behind them — is a hard
defect; fix by muting the motif, not by moving text. Clearing only the title corner is NOT
enough: text lands anywhere and plexus LINES span the slide. Keep the motif in the OUTER
MARGINS and fade it out across the central ~80% (a centre-fade) so no text is ever crossed.
Recipes are in `references/backgrounds.md` (written for pptx flat PNGs; on the HTML side the
same recipes are CSS gradients/masks, and the centre-fade is a `radial-gradient` mask).

**NON-NEGOTIABLE — the background must never reduce front-text legibility.** This is a hard
guarantee, not an aesthetic preference. (1) build every section bg motif-free across the
central content area BY CONSTRUCTION; (2) then VERIFY it in a faithful render and confirm no
motif line or node crosses any title, paragraph, or on-bg caption. A single crossed glyph is a
hard defect to fix before handing back — exactly like sub-floor text (rule 4).

---

# Vérification — the gate, both backends

**Nothing is handed back on "ça a l'air bien".** Geometry is measurable, so it gets measured.
The same four audits exist on both sides, under the same names:

| audit | what it proves |
|---|---|
| `audit_overlaps` | no two visible elements overlap by more than a threshold area |
| `audit_overflow` | no child box escapes its parent; no scrollable overflow |
| `audit_vbalance` | the void above a centred block ≈ the void below it (rule 1) |
| `audit_text_sizes` | no run below the type floor; contrast ≥ WCAG (rule 4) |

The HTML backend adds two that only a real browser can give: **dead space** (largest maximal
empty rectangle, the measured form of FILL THE SPACE) and **occupancy / centre-of-ink
symmetry**. Run them with `bin/gate.sh <deck.html>` — exit 1 on any hard defect, full JSON
report, and `bin/selftest.sh` proves the gate itself still fails when it should. Details in
`references/backend-html.md`.

The loop is **measure → fix → re-measure until zero hard defect**, with an iteration ceiling
and a log of the deltas, so a fix that breaks another slide is visible instead of looping.
A gate output is a deliverable (`/verify` doctrine): the proof Léo reads.

Aesthetic judgement ("ça rend mal") still needs a human look at a faithful render — the gate
buys the right to ask for that look, it does not replace it.

---

# Files in this skill

```
SKILL.md                     ← you are here: doctrine + chronology + routing
references/backend-pptx.md   ← the python-pptx kit (runtime, helpers, gotchas)
references/backend-html.md   ← the fixed-stage socle, the 34 models, the gate, the exports
references/structure.md      ← editorial rules (assertion titles, one-idea, de-dup)
references/design_tokens.md  ← palettes, style recipes, type/space scales
references/backgrounds.md    ← background recipes (plexus_edge, low-poly, centre-veil…)
pptx_kit.py svg_icons.py render_check.py   ← pptx backend code

assets/stage.css assets/stage.js   ← HTML: the ONE fixed-stage implementation
assets/deck.html                   ← HTML: the skeleton to copy
assets/templates/index.json        ← HTML: the 34 models, compact index — start here
assets/templates/<slug>/           ← HTML: preview.md (short) + design.md (full)
assets/fixture-deck.html           ← HTML: the gate's regression bench (known verdict)

bin/gate.sh  bin/gate.mjs          ← the geometry gate (ego-browser), exit 1 on hard defect
bin/selftest.sh                    ← proves the gate still fails when it should
bin/export-pdf.sh  bin/export-pdf.mjs   ← vector PDF, one slide per page
bin/import-templates.py  bin/anchor-scale.py   ← rebuild assets/templates/ from the source repo

~/visual-lab/                ← the pattern library, shared with the web side
```

## Attribution / licenses
- Design-token tables: MiniMax-AI/skills (MIT).
- Dynamic-fit & text-measurement ideas: GongRzhe/Office-PowerPoint-MCP-Server (MIT).
- HTML fixed-stage model + the 34 design-system models: `zarazhangrui/frontend-slides` (MIT),
  imported and repaired — see `references/backend-html.md` for what was changed and why.
- Structure principles: widely-known presentation practice (assertion titles / pyramid
  principle / one-idea-per-slide), written here in original form.
