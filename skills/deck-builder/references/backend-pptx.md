# Backend pptx — the python-pptx kit

Read this only once Léo has said the output is a **.pptx**. The medium-agnostic doctrine
(the 7 rules, the chronology, the visual-lab bridge) is in `SKILL.md` and still applies —
this file is the kit that enforces it in PowerPoint.

Nothing here changed when the HTML backend was added.

## Runtime

`python-pptx` is NOT in the system python (PEP 668 blocks installing into it). Use the
dedicated venv: `~/.venvs/deck-builder/bin/python`. If it is missing, recreate it with
`python3 -m venv ~/.venvs/deck-builder && ~/.venvs/deck-builder/bin/pip install python-pptx pillow`.

## Files

- `../pptx_kit.py` — build helpers (text, shapes, discs, grid, the FILL RULE, icons, footer removal).
- `../svg_icons.py` — attach true vector SVG bodies (PNG fallback) to icon pictures.
- `../render_check.py` — render slides to PNG locally to self-verify
  (CLI: `python render_check.py deck.pptx 2,3 /tmp`).

## Where each doctrine rule lives in the kit

| Rule (SKILL.md) | pptx helper |
|---|---|
| 1 — fill the space | `fit_size`, `stack_fill`, `place_block(band_top, band_bottom, block_h)` |
| 1 — cross-card alignment | `stack_top` with shared heights, `max_lines` for the title block |
| 4 — type floor | `FLOOR_BODY_PT` (14), `FLOOR_KICKER_PT` (13), `ABS_FLOOR_PT` (12), `fit_all` |
| 5 — card-top accent | `hug_card_top(strip, card_l, card_t, card_w, card_h, radius_frac, thickness)` |
| 6 — no running footer | `remove_footers(prs)` |
| 7 — backgrounds | `set_slide_background(slide, png)`, recipes in `backgrounds.md` |

`fit_size`/`fit_all` default `minimum` to the body floor and never return less, so if the
longest body still overflows, the card is too small or the copy too long.

For a row of equal cards: `body_avail_h = card_bottom - body_top - bottom_pad`, then
`fit_all(bodies, body_w, body_avail_h)` — one size, applied uniformly.

## Building

1. **Shop the library first** — `cd ~/visual-lab && node bin/index.mjs && cat INDEX.md`. If a
   pattern covers the element you need, use its emitter from `kit/vl_pptx.py` rather than
   laying out shapes by hand — you inherit its ratios AND its benchmarks.
   ```python
   import sys; sys.path.insert(0, str(Path.home() / "visual-lab" / "kit"))
   import vl_pptx as vl
   m = vl.stat_block(slide, 0.6, 2.6, 3.6, 2.9, "Potential", "156%", "Compound growth …")
   vl.audit([m])          # raises on any deviation from the pattern's benchmarks
   ```
2. **Read** `structure.md` and `design_tokens.md`.
3. **Choose tokens**: palette + style recipe + type scale. State them.
4. **Build** with `pptx_kit` (one helper call per element). Apply the FILL RULE to every card.
   Vary layouts across slide archetypes (cards / split / timeline / big-stat / logo-wall /
   quote) — never the same grid on every slide.
5. **Icons**: draw simple line SVGs (24×24, single stroke color), rasterize to PNG
   (`rsvg-convert -w 400`), place with `pptx_kit.icon(..., key="x")`, then `prs.save()`, then
   `svg_icons.embed_svgs(path, svg_dir)`.
   ⚠️ After ANY `prs.save()` that follows an embed, run `svg_icons.fix_svg_content_type(path)`
   — python-pptx drops the svg Default.
6. **Edit directly in the .pptx; Léo reviews in PowerPoint.** Do NOT drop preview PNGs next to
   the deck (clutter) and do NOT present the low-fi proxy render as a deliverable — it isn't
   faithful enough (it misses color/weight, shows SVG blips as fallback). `render_check.py` to
   `/tmp` stays available as a SILENT internal sanity check when geometry is tricky — never
   surfaced, never saved in the deck folder.

## The gate (rule: nothing ships unmeasured)

Run the programmatic audits, THEN confirm their suspects in a faithful render.

- `vl_pptx.audit(measures)` — MANDATORY whenever a visual-lab emitter was used. It replays the
  pattern's own benchmarks against what you actually placed (ratios, contrast, type floor,
  chamfer vs the card's short side) and RAISES on the first deviation. Fix and re-run: this is
  a loop, not a report. It is the only audit that knows the reference charter's proportions.
- `pptx_kit.audit_text_sizes(prs)` — no sub-floor text (rule 4). `level:'hard'` = illegible,
  must fix; `'soft'` = sub-floor body/caption, fix unless it's a genuine kicker ≥13pt.
- `pptx_kit.audit_overlaps(prs)` — no picture colliding with text/another picture (rule 4b).
  'hard' hits are high-signal; 'soft' text↔text hits are often the name+year-on-one-line
  pattern (benign).
- `pptx_kit.audit_vbalance(prs)` — MANDATORY for any slide that is a single content block under
  a header (TOC, feature list, centred grid). Catches VOID ASYMMETRY: the gap header→content
  must equal the gap content→slide bottom. Reports `{top_gap_in, bottom_gap_in, delta_in}`;
  a delta beyond tol is a defect (Léo caught a 0.83" top void vs 0.61" bottom void on a
  sommaire). `vmeasure(prs, i)` gives the raw numbers. THE FIX — never hardcode a content band
  that ignores where the header ends: measure the header bottom, compute the block's true
  height, and position it with `place_block(header_bottom, slide_height, block_h, 0.5)` so the
  two voids are equal BY CONSTRUCTION. If both gaps are large, the block is too small → enlarge
  type/nodes/pitch. (Heuristic header/content split → a slide that is deliberately not one
  centred block may false-flag; confirm in render.)
- `pptx_kit.audit_overflow(prs)` — MANDATORY whenever you add/extend/append text in
  fixed-height cards. `audit_overlaps` does NOT see text spilling past its OWN container: a
  3-line description, an appended duration/badge line, or any copy longer than one card in a
  row of equal cards renders PAST the card's bottom edge. This estimates rendered text height
  (wrapped lines × line-height at the paragraph's largest run + space_before + frame margins),
  finds the containing filled panel, and flags text whose bottom passes the card bottom. The
  classic miss: cards in a row share a height sized for the SHORTEST copy → the longest one
  overflows. Fix by enlarging+reflowing the cards or `fit_all` the bodies to the real
  `card_bottom − body_top − pad`; don't just shrink one box.
- For any deck with section backgrounds, a faithful LibreOffice render
  (`soffice --headless --convert-to pdf` → `pdftoppm`) of every changed slide, **AT ≥180 DPI
  AND ZOOMED INTO THE DENSEST CARDS** (a 110-DPI full-slide thumbnail hides a few-px spill —
  that is exactly how an overflow ships). Confirm the motif never crosses text (rule 7) AND
  that each audit suspect is a REAL defect — geometry flags candidates, but z-order/visibility
  is only knowable from the render (a flagged overlap can be a hidden shape).

All hard hits are gates: fix, don't ship.

## Inserting a slide at a position

python-pptx appends; reorder via the slide id list:

```python
sld = prs.slides._sldIdLst; ids = list(sld)
sld.remove(ids[-1]); sld.insert(2, ids[-1])   # move new slide to position 3
```

New slides don't inherit a per-slide background image — add the bg as a full-bleed picture
(extract it from a sibling content slide's `<p:bg>` blip).

## Gotchas (learned the hard way)

- ⚠️ NEVER edit a .pptx while it's OPEN in PowerPoint — a save collision corrupts the zip (bad
  CRC on media) AND can revert content to PowerPoint's older copy. Protocol: Léo closes the
  file before prompting. Before editing, verify it isn't held (`lsof file.pptx`) — if held,
  STOP and ask him to close it (Cmd+Q if a stale handle lingers). Do NOT litter the folder with
  per-edit backup copies (he dislikes it); work on the single file. If recovery is ever needed,
  the rebuild scripts + the source deck regenerate it.
- python-pptx `save()` strips the svg content-type → always `fix_svg_content_type`.
- ⚠️ `shape.shadow.inherit = False` does NOT remove the drop shadow. It writes an empty
  `<a:effectLst/>`, but python-pptx also emits a `<p:style>` whose `effectRef` points at the
  theme's shadow — LibreOffice (and PowerPoint themes) apply it, and every flat card ships with
  a grey shadow on its bottom-right. On a sharp-cornered charter that reads as a defect. Remove
  the `<p:style>` element itself (`vl_pptx.flatten()` does fill + no line + no shadow + style
  removal in one call). Caught on a faithful render, invisible in the PIL proxy.
- ⚠️ SHARED ICON/LOGO MEDIA — recolour LEAKS across slides. A deck reuses the same
  `ppt/media/imageN.svg` (and its PNG fallback) on multiple slides. If you recolour that media
  in place to fit ONE slide's chip, EVERY other slide using that file changes too (this exact
  bug: image9.svg shared S4↔S6, whitened for S4's deep-teal chips → showed white on S6's gold
  chips). BEFORE a per-slide glyph recolour, map each picture's `a:blip`/`asvg:svgBlip`
  `r:embed` → media partname and check for reuse. If shared: DUPLICATE the media to a
  slide-unique file (`image9_s6.svg`), add a `<Relationship>` in that slide's `_rels`, repoint
  that picture's blip(s) to the copy, THEN recolour the copy. Never recolour shared media in
  place. (Same caution before deleting media.)
- The renderer can't rasterize SVG blips; it shows the PNG fallback (fine for QA).
- `stack_fill` needs real element heights — measure desc lines with `n_lines`.
- Pill accent bars must be inset past the card's corner radius or they overhang the rounded
  corners → use `hug_card_top` instead (rule 5).
