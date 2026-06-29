---
name: deck-builder
description: "Build or restructure polished, on-brand PowerPoint (.pptx) decks programmatically. Use when creating, redesigning, de-cluttering, or fixing the layout of a deck/pitch/plaquette — especially slides that feel empty, repetitive, or inconsistent. Provides a python-pptx kit, a fill-the-space layout rule, SVG icon embedding, and a local render-to-PNG check. Complements the base `pptx` skill."
---

# deck-builder

A reusable toolkit for generating decks that are **structured** (one idea per slide,
assertion titles, no repetition) and **designed** (filled cards, readable type,
consistent tokens, crisp vector icons). Theme-agnostic; works for any brand.

Read this file fully, then use the helper modules in this folder.

## Files in this skill
- `pptx_kit.py` — build helpers (text, shapes, discs, grid, the FILL RULE, icons, footer removal).
- `svg_icons.py` — attach true vector SVG bodies (PNG fallback) to icon pictures.
- `render_check.py` — render slides to PNG locally to self-verify (CLI: `python render_check.py deck.pptx 2,3 /tmp`).
- `references/structure.md` — editorial rules (assertion titles, one-idea, de-dup, deck architecture).
- `references/design_tokens.md` — palettes, style recipes, type/space scales (adapted from MiniMax-AI/skills, MIT).

## The non-negotiable rules

These are hard constants. Apply them without being asked.

### 1. FILL THE SPACE — no idle voids
Nothing justifies a large empty area inside a card/box/vignette. If content
floats at the top with a void below, you did it wrong. Fix by, in order:
1. **Grow the text/icon** so content fills the box (use `pptx_kit.fit_size`).
2. **Distribute** remaining space as equal gaps (before/between/after) with
   `pptx_kit.stack_fill` — never dump the slack at the bottom.
3. If still airy, **add substance** (a stat, a proof, a one-line punch).
Centering a small block in a big card is NOT filling — it just splits the void.

**Fill the SLIDE canvas, not just the cards.** The bottom-most module must reach
the standard bottom margin (~0.45–0.5"). If a large idle band sits at the bottom
of the slide, LOWER and/or ENLARGE the lowest module (bigger elements, more
spacing, or vertically distribute the sections across the full content height
2.3"→~7.0"). A void at the slide's bottom edge is the same defect as a void in a
card. Check every slide's bottom strip before handing back.

**Balance the whitespace AROUND a block.** When a block (a grid, a logo wall, a
card cluster) sits in the free band between two fixed elements — header/intro
above, footer/testimonial below — the leftover vertical space must be split
ROUGHLY EVENLY top and bottom. A big void on ONE side while the other side is
cramped reads as a bug, not a choice. Don't leave the block floating high under
the title with no room below, nor pushed down against the footer with a gap above
— centre it in its band (`pptx_kit.place_block(band_top, band_bottom, block_h)`;
nudge `bias<0.5` to sit slightly higher). Before handing back, eyeball each
slide: gap-above ≈ gap-below around every standalone block.

**Cross-card alignment (a ROW of equal-size cards):** TOP-ALIGN to a SHARED grid,
never center each card independently. Icons on one line, labels on one line,
titles on one line, bodies starting on one line — across ALL cards. Reserve the
title block at the MAX title height over the set (`max_lines`) so a 2-line title
on one card doesn't push its body below a 1-line neighbour's. Variation in text
length then shows ONLY at the bottom (correct + planned). Use `stack_top` with
shared heights for rows; `stack_fill`/centering is for a SINGLE standalone card
only. Cards are the same size → plan the bottom margin so short cards read
balanced, not empty.
This applies to EVERY corresponding element, including a meta/footer line (a
duration tag, a price, a date, a stat) pinned near the card bottom: it must START
on one SHARED baseline across all cards — top-anchor it at a common offset and
reserve the MAX height (e.g. 2 lines). NEVER bottom-anchor a footer per-card
(`MSO_ANCHOR.BOTTOM` independently): a 1-line tag then sits lower than a 2-line
one and the row of tags zig-zags — a visible asymmetry. Same-start, grow-down.

### 1b. SHAPE — AND COLOUR — ENCODE CATEGORY; don't imply false grouping
Same visual form = "same kind". So vary the form by category: items of one
category share a shape; a different-category item gets a different treatment
(e.g. a transversal/cross-cutting item becomes a full-width banner under a grid,
not a 6th identical cell). Conversely never split same-category items into
different shapes. Let the layout mirror the real categorisation.

**The same law governs COLOUR. A colour change must encode a real distinction —
never decorate.** Alternating accent colours card-by-card or column-by-column
(teal, gold, teal, gold…) with no underlying meaning is a DEFECT: it tells the
reader "these differ" when they don't. If items are the same kind, give them ONE
accent — uniform reads as intentional; arbitrary alternation reads as noise. Use
a second colour ONLY when it maps to something (a genuine two-sided split like
MÉTIER vs TECH, an emphasis/CTA, a key figure, a transversal banner). Default:
pick ONE structural accent (e.g. teal) and reserve the second (e.g. gold) for
real emphasis. When in doubt, uniform. (Rule of thumb: a colour alternation must
have a reason — otherwise make it uniform.)

**Vary BY CHAPTER to fight monotony without breaking the line.** A deck where
every slide is the SAME accent reads as heavy/repetitive; varying EVERY slide
reads as random. The resolution: code the accent by SECTION/CHAPTER — one
identity per chapter, uniform within it, changing ONLY at chapter boundaries (a
real reason: narrative + wayfinding). Stay anchored on the brand's 1-2 colours
(the "ligne directrice"); get variety from a SMALL fixed kit reused across the
deck — the two anchors + neutral white + treatments (filled / outline / deep
shade). Map the arc to the story (e.g. cool teal for the expertise chapters →
warm gold for the proof/contact finale) so the colour shift MEANS something.
Three hard constraints when doing this:
1. **Accent legibility follows BACKGROUND luminance.** A bright/warm accent
   reads on dark bg but dies on light: gold on navy = crisp; gold on ivory =
   muddy ochre. SAMPLE each section's bg luminance (light if >150/255) and pick
   the accent that survives it — on ivory sections keep the dark shade
   (dark-teal), not the bright/gold. Don't force a chapter colour that the bg
   kills.
2. **Glyph ↔ chip contrast, and UNIFORM glyph colour per slide.** When you set a
   chip/accent fill, set the glyph for contrast: navy glyph on a light/white
   chip, white glyph on a dark/deep chip. Keep every glyph on a slide the SAME
   colour. Quick ratios: navy-on-gold ≈ 9.9:1 (great); WHITE-on-gold ≈ 1.9:1
   (washed, fails) — so gold chips want navy glyphs, never white.
3. **Watch SHARED icon/logo media (see Gotchas).** Recolouring one slide's glyph
   can leak onto another slide reusing the same media file.

### 2. ONE FACT, ONE HOME — no repetition across slides
Before writing copy, map each recurring proof point (founding year, headline
metric, certification, award…) to exactly ONE slide. Remove it everywhere else.
Repetition reads as padding and erodes trust. See `references/structure.md`.

### 3. ASSERTION TITLES, not topic labels
Every content slide title is a short sentence stating the takeaway, not a noun
label ("Power BI is the leader we standardised on", not "Power BI"). Reading the
titles top-to-bottom should tell the whole story (the "ghost-deck" test).

### 4. READABLE TYPE — enforce a hard FLOOR; a card MUST CONTAIN its content
Body text ≥ 14pt (prefer 15–18), titles 28–36pt, kickers ~13pt. **These are
floors, not suggestions** — `pptx_kit.FLOOR_BODY_PT` (14), `FLOOR_KICKER_PT`
(13), `ABS_FLOOR_PT` (12, nothing legible ever below it). If text must shrink
below the floor to fit, **cut content — don't shrink**.
NEVER let text spill past a card's bottom. For a row of equal cards, size all
bodies with `fit_all(bodies, body_w, body_avail_h)` where `body_avail_h =
card_bottom - body_top - bottom_pad` — this picks the one size at which the
LONGEST body fits, applied uniformly. `fit_size`/`fit_all` default `minimum` to
the body floor and never return less, so if the longest body still overflows,
the card is too small or the copy too long → shorten copy or enlarge the card.
**Before handing ANY deck back, run `pptx_kit.audit_text_sizes(prs)` silently**:
it returns every run below the floor (`level:'hard'` = illegible, must fix;
`'soft'` = sub-floor body/caption, fix unless it's a genuine kicker ≥13pt). The
list must be empty (modulo legit kickers). Also verify with a silent
render_check; overflow and sub-floor text are both hard defects.

### 4b. LEGIBLE LOGOS — a logo wall is proof, not a footnote
Client/partner logos must be clearly identifiable; a logo too small or too
low-contrast to read is the same hard defect as sub-floor text. (1) Make them
BIG — size every logo to a shared target HEIGHT (clamp very wide wordmarks by
width) so all read at similar visual weight; tiny marks crammed into pills are a
fail. (2) Logos come with MIXED backgrounds (transparent, white boxes, colored
squares) — dropped straight onto a tinted/dark/ivory background, half vanish or
clash. Put each on a UNIFORM white tile of equal size: that is a clean logo board
(consistent contrast + rhythm), NOT the fussy per-item framing to avoid — that is
for a WALL of many mixed logos on a tinted background. For a SINGLE logo on a dark
card, do the opposite: strip its baked white background (make near-white
transparent) or use its self-contained colored mark, and place it directly on the
card — a white tile is only for logos that would otherwise vanish. Strip ONLY a
flat uniform backdrop behind a self-contained mark; if the logo has MEANINGFUL
interior white (a medal, a knockout, a badge — e.g. EcoVadis), do NOT strip it
(you gut the mark) — mount it on a clean rounded white chip, an intentional badge.
(3) Source REAL
marks — extract them from elsewhere in the deck, or fetch the official logo from
the web (Wikipedia infobox image URL via WebFetch → `curl -A <ua>`; network
works). A typeset name is a last-resort fallback, never the goal. (4) A logo must
NEVER overlap text — give it its own zone (e.g. bottom-centred, below the copy);
overlap is a hard defect. (5) VERIFY with a faithful render that every mark is
recognisable and clear of text.

### 5. CONSISTENT TOKENS
Pick ONE palette + ONE corner-radius style recipe (Sharp/Soft/Rounded/Pill) and
apply everywhere. Outer corner radius ≥ inner element radius. For a pill bar set
radius so corner == height/2. No stray colors. See `references/design_tokens.md`.

**Card-top accent bars must HUG the card's corners, not float.** A free pill bar
laid on a rounded card overhangs at the two top corners — a thin bar's radius caps
at half its height, smaller than the card's corner radius, so its corners poke
past the card's contour. Don't fix this by insetting the bar off the edges (looks
detached). Make the accent flush to the card top, span the FULL card width, and
trace the card's exact corner arc on its top two corners (square bottom) — the
colour reads as the card's top edge "coloured in", stopping at the contour. Use
`pptx_kit.hug_card_top(strip, card_l, card_t, card_w, card_h, radius_frac, thickness)`,
which rewrites the bar to a custom geometry that follows the arc.

### 6. NO running-footer clutter unless asked
Drop page-number / "COMPANY NAME" running footers; the logo top-left is enough.
`pptx_kit.remove_footers(prs)`.

### 7. BACKGROUND RHYTHM — vary by section, never per slide; stay on-moodboard
One background on every content slide reads as monotonous; a different background
on every slide reads as chaos. The fix is SECTION RHYTHM: group slides into
coherent sections and give each section ONE background, switching only at section
boundaries. Keep the cover and the closing/contact slide on the hero background.
Carry this awareness into every multi-section deck — actively decide where the
background should turn over, don't default to a single flat backdrop throughout.

Vary the TREATMENT, never the moodboard. ONE palette + ONE motif family across
the whole deck; per section change only: motif geometry (network/plexus ↔
low-poly facets ↔ dot-grid), value (dark ↔ light/inverted ↔ tinted), or a single
accent glow (e.g. a warm halo for an "engagement" section). A light/inverted
section is the strongest breather and makes logos/screenshots pop — but you MUST
recolor the text sitting directly on it (eyebrow/title/subtitle → dark); text
inside dark cards stays light.

Backgrounds must RECEDE: bake them as FLAT 1920×1080 images (not live effects)
and keep the motif subtle — low edge opacity, a slight veil — so it never
competes with the front. A pattern whose lines cross and reduce the legibility of
text on top — especially captions sitting directly on the background with no card
behind them — is a hard defect; fix by muting the motif, not by moving text.
Clearing only the title corner is NOT enough: text lands anywhere (right-hand
paragraphs, on-bg captions) and plexus LINES span the slide. Keep the motif in
the OUTER MARGINS and fade it out across the central ~80% (a centre-fade) so no
text is ever crossed — `plexus_edge`/`edge_mask` when generating, or `center_veil`
to fix a flattened bg. Apply with `pptx_kit.set_slide_background(slide, png)`.
Recipes (plexus_edge, low-poly, gradient, accent-halo, light, center_veil) are in
`references/backgrounds.md`.

**NON-NEGOTIABLE — the background must never reduce front-text legibility.** This
is a hard guarantee, not an aesthetic preference. Whenever you add, change, or
inherit a background: (1) build every section bg motif-free across the central
content area by construction (`plexus_edge`/`center_veil`); (2) then VERIFY it —
render EVERY background slide (LibreOffice → PDF → `pdftoppm`, the faithful path;
the PIL proxy doesn't draw lines/outlines) and confirm no motif line or node
crosses any title, paragraph, or on-bg caption. A single crossed glyph is a hard
defect to fix before handing back — exactly like sub-floor text (rule 4).

## Workflow

1. **Read** `references/structure.md` and `references/design_tokens.md`.
2. **Outline** the deck: for each slide write its assertion title + the single
   idea + the exhibit type. Run the ghost-deck test. Build the de-dup map
   (one-fact-one-home). Confirm with the user if > ~10 slides.
3. **Choose tokens**: palette + style recipe + type scale. State them.
4. **Build** with `pptx_kit` (one helper call per element). Apply the FILL RULE
   to every card via `stack_fill` / `fit_size`. Vary layouts across slide
   archetypes (cards / split / timeline / big-stat / logo-wall / quote) — never
   the same grid on every slide.
5. **Icons**: draw simple line SVGs (24×24, single stroke color), rasterize to
   PNG (`rsvg-convert -w 400`), place with `pptx_kit.icon(..., key="x")`, then
   `prs.save()`, then `svg_icons.embed_svgs(path, svg_dir)`.
   ⚠️ After ANY `prs.save()` that follows an embed, run
   `svg_icons.fix_svg_content_type(path)` — python-pptx drops the svg Default.
6. **Edit directly in the .pptx; the user reviews in PowerPoint.** Do NOT drop
   preview PNGs next to the deck (clutter) and do NOT present the low-fi proxy
   render as a deliverable — it isn't faithful enough (it misses color/weight,
   shows SVG blips as fallback). `render_check.py` to `/tmp` stays available as a
   SILENT internal sanity check only when geometry is tricky (catch gross
   overlap/overflow/voids) — never surfaced, never saved in the deck folder.
   Default: make the change, let the user judge the real render in PowerPoint.
7. **Verify before handing back** — the autonomous QA gate (silent). Run the
   programmatic audits, THEN confirm their suspects in a faithful render:
   - `pptx_kit.audit_text_sizes(prs)` — no sub-floor text (rule 4).
   - `pptx_kit.audit_overlaps(prs)` — no picture colliding with text/another
     picture (rule 4b / the logo-on-copy class). 'hard' hits are high-signal;
     'soft' text↔text hits are often the name+year-on-one-line pattern (benign).
   - `pptx_kit.audit_vbalance(prs)` — MANDATORY for any slide that is a single
     content block under a header (TOC, feature list, centred grid). Catches VOID
     ASYMMETRY: the empty gap header→content must equal the gap content→slide
     bottom. It reports `{top_gap_in, bottom_gap_in, delta_in}`; a delta beyond
     tol is a defect (e.g. a 0.83" top void vs 0.61" bottom void on a contents
     slide). `vmeasure(prs, i)` gives the raw numbers. THE FIX — never hardcode
     a content band (CT/CB) that ignores where the header ends: measure the
     header bottom, compute the block's true height, and position it with
     `place_block(header_bottom, slide_height, block_h, 0.5)` so the two voids are
     equal BY CONSTRUCTION. If both gaps are large, the block is too small →
     enlarge type/nodes/pitch to exploit the space. (Heuristic header/content
     split → a slide that is deliberately not one centred block may false-flag;
     confirm in render.)
   - `pptx_kit.audit_overflow(prs)` — MANDATORY whenever you add/extend/append
     text in fixed-height cards. audit_overlaps does NOT see text spilling past
     its OWN container: a 3-line description, an appended duration/badge line, or
     any copy longer than one card in a row of equal cards renders PAST the card's
     bottom edge into the gap/card below. This estimates rendered text height
     (wrapped lines × line-height at the paragraph's largest run + space_before +
     frame margins), finds the containing filled panel, and flags text whose
     bottom passes the card bottom. The classic miss: cards in a row share a
     height sized for the SHORTEST copy → the longest one overflows. Fix by
     enlarging+reflowing the cards (more height, shift rows) or `fit_all` the
     bodies to the real `card_bottom − body_top − pad`; don't just shrink one box.
   - For any deck with section backgrounds, a faithful LibreOffice render
     (`soffice --headless --convert-to pdf` → `pdftoppm`) of every changed slide,
     AT ≥180 DPI AND ZOOMED INTO THE DENSEST CARDS (a 110-DPI full-slide thumbnail
     hides a few-px spill — that is exactly how an overflow ships). Confirm the
     motif never crosses text (rule 7) AND that each audit suspect is a REAL
     defect — geometry flags candidates, but z-order/visibility is only knowable
     from the render (a flagged overlap can be a hidden shape).
   This audit→render→fix loop catches the computable defects autonomously; pure
   aesthetic judgement ("ça rend mal") still needs the render look. All hard hits
   are gates: fix, don't ship.

## Inserting a slide at a position
python-pptx appends; reorder via the slide id list:
```python
sld = prs.slides._sldIdLst; ids = list(sld)
sld.remove(ids[-1]); sld.insert(2, ids[-1])   # move new slide to position 3
```
New slides don't inherit a per-slide background image — add the bg as a
full-bleed picture (extract it from a sibling content slide's `<p:bg>` blip).

## Gotchas (learned the hard way)
- ⚠️ NEVER edit a .pptx while it's OPEN in PowerPoint — a save collision corrupts
  the zip (bad CRC on media) AND can revert content to PowerPoint's older copy.
  Protocol: the user closes the file before prompting. Before editing, just verify
  it isn't held (`lsof file.pptx`) — if held, STOP and ask them to close it
  (Cmd+Q if a stale handle lingers). Do NOT litter the folder with per-edit backup
  copies (the user dislikes it); work on the single file. If recovery is ever
  needed, the rebuild scripts + the source deck regenerate it.
- python-pptx `save()` strips the svg content-type → always `fix_svg_content_type`.
- ⚠️ SHARED ICON/LOGO MEDIA — recolour LEAKS across slides. A deck reuses the same
  `ppt/media/imageN.svg` (and its PNG fallback) on multiple slides. If you recolour
  that media in place to fit ONE slide's chip (e.g. whiten a glyph for a deep-teal
  chip), EVERY other slide using that file changes too — you get one odd-coloured
  glyph among its neighbours (this exact bug: image9.svg shared S4↔S6, whitened for
  S4's deep-teal chips → showed white on S6's gold chips). BEFORE a per-slide glyph
  recolour, map each picture's `a:blip`/`asvg:svgBlip` `r:embed` → media partname
  and check for reuse on other slides. If shared: DUPLICATE the media to a
  slide-unique file (`image9_s6.svg`), add a `<Relationship>` in that slide's
  `_rels`, repoint that picture's blip(s) to the copy, THEN recolour the copy.
  Never recolour shared media in place. (Same caution applies before deleting media.)
- The renderer can't rasterize SVG blips; it shows the PNG fallback (fine for QA).
- `stack_fill` needs real element heights — measure desc lines with `n_lines`.
- Pill accent bars must be inset past the card's corner radius or they overhang
  the rounded corners (rule 5).

## Attribution / licenses
- Design-token tables: MiniMax-AI/skills (MIT).
- Dynamic-fit & text-measurement ideas: GongRzhe/Office-PowerPoint-MCP-Server (MIT).
- Structure principles: widely-known presentation practice (assertion titles /
  pyramid principle / one-idea-per-slide), written here in original form.
