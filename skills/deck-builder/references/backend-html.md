# Backend HTML — fixed stage, 34 design systems, geometry gate, exports

Read this only once Léo has said the output is **HTML**. The doctrine (the 7 rules, the
6-step chronology, the visual-lab bridge) is in `SKILL.md` and still applies — this file
is the kit that enforces it in a browser.

Output is **one self-contained .html file**: all CSS and JS inline, no npm, no build step,
no CDN except the font stylesheet. It opens by double-click, travels by AirDrop, and prints
to a vector PDF.

---

## 1. The socle — a fixed 1920×1080 stage

Every slide is drawn inside a rectangle of exactly 1920×1080 px. That whole rectangle is
scaled by ONE `transform` to fill the window; nothing inside ever reflows. If the window
isn't 16:9 you get letterbox/pillarbox bands — never a re-layout.

**This is not a preference, it is the precondition for everything else.** The gate measures
positions in px; a layout that changes shape with the window has no positions to measure,
and the 34 models' numbers would mean nothing. So: **no `vw`, `vh`, `%`-of-viewport,
`clamp()` or media-query re-layout inside the stage.** The stage IS the unit.

```
assets/stage.css   ~150 lines — paste the FULL contents into the deck's <style>
assets/stage.js    ~110 lines — paste the FULL contents into the deck's <script>
assets/deck.html   the skeleton to copy: tokens, slide grammar, both pastes marked
```

`stage.js` gives keyboard (arrows / space / PageUp-Down / Home / End), wheel (one notch =
one slide, 450 ms cooldown so a trackpad flick doesn't skip five), swipe, and `#3`-style
deep links. `stage.css` gives the print rules (one slide = one page → the vector PDF) and
`prefers-reduced-motion`.

**There is exactly ONE scaler in a deck.** The source repo shipped a 619-line `deck-stage.js`
that was never wired up, competing with an inline scaler in its own template — two
implementations, neither authoritative. Only `stage.js` survives. Do not add a second.

### The two traps this socle is built around

1. **Never hide an inactive slide with `display:none`.** Use `visibility` + `opacity` +
   `pointer-events`, as `stage.css` does. A later rule such as `.slide-content{display:flex}`
   — or any descendant selector that also matches a slide — overrides `display` and the whole
   deck appears stacked on one screen. `visibility` cannot be clobbered that way by accident.
2. **Never negate a CSS function directly.** `-clamp(...)`, `-min(...)`, `-max(...)` are
   silently ignored. Write `calc(-1 * …)`.

### Motion is OPT-IN — frozen by default

**Productions are FIGÉES.** Animation happens only when Léo asks for it, and then it is the
same file: add `data-motion="on"` on `<body>`. One codebase, two states — never two files.

A frozen deck must be **fully legible in its final state**: no information may depend on a
movement to be readable. Design for the end state, then let motion be a bonus on top. This is
why `.reveal` is a no-op by default and only becomes a transition under `data-motion="on"`.

The gate sets `data-gate` on `<body>`, which force-freezes every transform/transition/animation
so a measurement is never taken mid-flight.

---

## 2. The 34 design systems

`assets/templates/` — imported from `zarazhangrui/frontend-slides` (MIT) and repaired.

These are **complete design systems**, not colour themes: palette, type faces and their
roles, scale, margins, shapes, signature moves, and an explicit *what this model is not for*.
Until the L4 house charters exist, they play the role of the charter.

### Reading protocol — this is a context budget, not a style tip

The corpus is ~20 000 lines. Reading it whole burns a deck's worth of context before a single
slide exists. Progressive disclosure, three levels:

```
1. assets/templates/index.json     ← ALWAYS, and alone: 34 compact cards
                                     (mood, tone, formality, density, scheme,
                                      best_for, avoid_for, canvas_scale)
2. <slug>/preview.md    (~55 lines) ← only the 2-3 shortlisted models,
                                     enough to build the step-4 maquette
3. <slug>/design.md    (~600 lines) ← ONE model only, the one Léo picked
```

Never bulk-read `design.md`. Never read a second model's `design.md` "to compare".

Sober models that work today for Finengy / Capital B: **blue-professional** (cream + cobalt,
consulting-grade), **monochrome**, **swiss-modern**-adjacent choices such as **studio** and
**signal**. Check `avoid_for` before proposing one.

### What was repaired at import (`bin/import-templates.py`, `bin/anchor-scale.py`)

| defect in the source | repair |
|---|---|
| 941 `vw` / `vh` / `rem` values + `clamp()` / `min()` / `max()` / `calc()` on a px canvas — every generation had to re-resolve them by hand | **frozen once**: 1543 values resolved to px at 1920×1080 (1vw = 19.2 px, 1vh = 10.8 px, 1rem = 16 px) |
| 35 references to a `template.html` the repo never shipped | repointed to `assets/deck.html`, which exists |
| a 4-paragraph "translate the viewport units yourself" boilerplate in all 34 files | replaced by a note saying the translation is already done |
| **frozen sizes land at 15-20 px body — under the 28 px floor (rule 4)** | each model gets one factor **k** and a pre-computed on-canvas ladder at the top of its `design.md` |

That last one is the one to understand. The models were authored fluid for ~1075-1400 px
screens. Frozen literally, `blue-professional`'s body is 16.8 px — 8.4 pt in pptx terms, half
the legibility floor. Pixels don't travel, ratios do: **k re-anchors the whole ladder on the
1920 canvas with the ratios intact** (blue-professional: k = 1.786, body → 30 px, h1 → 120 px).

- Use the **"Type scale on the 1920 canvas — USE THIS LADDER"** table at the top of the
  model's `design.md`. It is authoritative over any size later in the file.
- Multiply the model's spacing, padding, radii and component sizes by the same k. The
  exceptions are canvas-sized values: `1920px` (was `100vw`) and `1080px` (was `100vh`)
  stay as written.
- Some models (`long-table`, `bold-poster`, …) are flagged **partial scale**: they pair small
  reading type with graphic-scale display type, so roles above 420 px are left unchanged —
  they are graphics, not text.
- Adjust the anchor, not the ratios: reading deck → body 28 px, speaker deck → body 36 px.

The two import scripts live in `bin/`; the import is reproducible, and re-running them
rebuilds `assets/templates/` from the source repo.

---

## 3. The gate — `bin/gate.sh`

The source repo said "verify overflow" and shipped no way to do it. This is that way.

```bash
bin/gate.sh /abs/path/deck.html                      # every slide
bin/gate.sh /abs/deck.html --slides 3,7              # only those
bin/gate.sh /abs/deck.html --benchmark lecture-dense # a calibrated threshold set
bin/gate.sh /abs/deck.html --strict                  # dead space + vbalance also gate
bin/gate.sh /abs/deck.html --set floor_soft=32       # move one threshold
bin/selftest.sh                                      # prove the gate itself still works
```

### Benchmarks — the thresholds depend on the kind of deck

`assets/benchmarks/<name>.json` holds a named threshold set, its `when` (which kind of deck it
describes), and what it was `calibrated_on`. A reading deck and a speaker deck do not want the
same numbers: 17 % dead space is a defect in a dense report and a deliberate breath in a keynote.

| benchmark | for | key values |
|---|---|---|
| `lecture-dense` | report, review, diagnostic, client deliverable — read alone | body ≥ 28 px, dead ≤ 12 %, occupancy ≥ 55 % |
| `orateur` | projected and narrated, one idea per slide | body ≥ 36 px, dead ≤ 30 %, occupancy ≥ 20 % |

`lecture-dense` is calibrated on a real deck (`decks/sante-si-karto.html`, 10 slides) and its
`observed` block records the distribution it came from. `orateur` is a starting guess and says
so — **correct it against the first real speaker deck rather than trusting it.** Adding a
benchmark is copying a file and writing down what it was measured on; a benchmark with no
`calibrated_on` is an opinion wearing a number.

Exit 0 = PASS, 1 = at least one HARD defect. Full JSON in `/tmp/deck-gate.json` (`--out`).

It drives **ego-browser** (already installed: 0.4.5.8, chromium 150) — no Playwright, no
150 MB Chromium download. It sets a real 1920×1080 viewport, un-scales the stage and freezes
motion, so every `getBoundingClientRect()` is read **in canvas px**, the same unit the deck is
written in.

### What it measures

| audit | severity | how |
|---|---|---|
| `audit_overlaps` | **hard** | intersection area of every pair of visible INK elements (text-bearing elements + img/svg/video/canvas). Exhaustive, no sampling. DOM nesting is excluded — a child inside its parent is not an overlap. Fires above 400 px² AND 2 % of the smaller element. |
| `audit_overflow` | **hard** | three ways out: a container clipping its own content (`scrollHeight > clientHeight` — the classic card swallowing its copy), a child escaping its container's padding box, anything leaving the 1920×1080 canvas. |
| `audit_text_sizes` | **hard** below 24 px, soft 24-28 | computed font-size per text element, against the floors of rule 4. |
| contrast | **hard** | WCAG ratio, foreground composited over the real effective background (walks up the ancestors). ≥ 4.5:1, or 3:1 above 56 px. If a gradient or image is in the way it reports `null` — it says "I don't know" rather than inventing a number. |
| `audit_deadspace` | soft (hard with `--strict`) | the slide is rasterised on a 20 px grid, ink cells marked, then the **largest maximal empty rectangle inside the ink bounding box** is found. This is FILL THE SPACE, measured. Reported as a fraction and as `[x, y, w, h]` so it is actionable. |
| `audit_vbalance` | soft (hard with `--strict`) | the void above the ink vs the void below it, in px (rule 1). |
| occupancy / margins / centre-of-ink | reported | painted-surface occupancy, the four margins, left-right symmetry, and the offset between the ink's centre of gravity and the canvas centre. |

**Why dead space and vbalance don't gate by default.** They are the two metrics that encode
taste: a corner-anchored cover is mostly void *on purpose*. They are always measured and always
printed — they earn a look at the render, they do not block on their own. Everything else is an
objective defect and blocks. `--strict` promotes them when you want a deck to be tight.

### The loop

**measure → fix → re-measure, until zero hard defect.** Not measure-then-report.

- Cap the iterations (5 is plenty) and keep the deltas: a fix that repairs slide 3 and breaks
  slide 7 is only visible if you compare runs. If two consecutive runs trade the same two
  defects, stop and change the layout instead of nudging numbers.
- Re-run the whole deck at the end, not just the slide you touched — a shared class travels.
- The gate output is a deliverable, not a chore: it is the proof Léo reads (`/verify`
  doctrine). Hand back the final PASS line, not a claim.

### What the gate CANNOT see — always look at the render

Two defects shipped past a full PASS on the first real deck, and both are invisible to geometry:

1. **An element that renders but paints nothing.** `<span class="fill">` inside a bar track is an
   *inline* element, so `height: 100%` does nothing: twelve bars measured perfectly and showed
   empty. Geometry was valid, the chart was blank.
2. **A proportional element whose length does not match its value.** `flex: 39` on a child of a
   `display: grid` is ignored, so a 39/14/7/1 stacked bar rendered as four equal blocks. The slide
   was geometrically flawless and numerically false.

The gate measures where things are, not whether they say the truth. **A slide carrying a
proportion always gets a human look**, and the proportion gets checked against the source number.

Then, and only then, look at a render. `Page.captureScreenshot` at 1920×1080 gives a faithful
image; the gate buys the right to ask "does it read well?", it does not answer it.

### The bench

`assets/fixture-deck.html` is a 3-slide deck with a **known** verdict: slides 1-2 clean,
slide 3 booby-trapped with one defect per audit (a stamp overlapping two cards, a card
clipping its copy, text escaping, 17 px type, 1.07:1 contrast). `bin/selftest.sh` asserts all
five audits fire and that the clean slides stay clean. Run it after any edit to `gate.mjs` —
**a gate that cannot fail is not a gate.**

---

## 4. Exports — `bin/export-pdf.sh`

```bash
bin/export-pdf.sh /abs/deck.html [/abs/out.pdf]
```

`Page.printToPDF` prints the deck's `@media print` rules: **one 1920×1080 slide per page,
text stays text** — selectable, searchable, ~50 KB per slide (the 3-slide bench is 143 KB).
Do not "export" by stacking screenshots: that is how the source repo shipped ~20 MB for 18
slides with dead text.

PPTX when the recipient must edit the file — then it is the pptx backend's job, from the same
outline, not a conversion of the HTML.

**No external publication without an explicit order from Léo.** No Vercel, no deploy, no
shared link on your own initiative. The deliverable is a file on disk.

---

## 5. Components

Default frozen (see §1). SVG + CSS written by hand, zero dependency, authored at 1920×1080.

There is no free component library that is simultaneously zero-dependency, on-charter and
1920×1080 — so the method is **capitalisation**: produce a batch, show a local gallery, Léo
keeps or throws, what survives is versioned and reused. Anything that survives and could serve
twice belongs in `~/visual-lab` with its benchmarks (see `SKILL.md`).

The first batch under consideration: big number, radial gauge, timeline, step pipeline,
before/after, and the charts (bars, line, donut, radar). **The charts are wired to real data**
— polar, karto, methylen — and never to invented figures.
