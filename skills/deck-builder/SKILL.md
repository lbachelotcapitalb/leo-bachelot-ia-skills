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

7. **Argumentaire** — ship, alongside the deck, a `<deck>.ARGUMENTAIRE.md` that justifies
   **every element, one by one** (Léo, 6th review, 30/07/2026: « tu dois toujours pouvoir
   argumenter ce que tu produis, chaque élément que tu poses »). See the next section.

Steps 4 and 5 collapse into nothing when Léo has already validated a direction in a
previous session on the same deck — reuse it, don't re-ask. Step 7 never collapses.

## L'ARGUMENTAIRE — every element defended, one by one

**A deck is not handed back with only a gate report.** The gate proves nothing overlaps; it
says nothing about WHY this background, this colour, this size, this shape on this slide.
Léo reviews decisions, not pixels, and a decision he cannot interrogate is a decision he
cannot overrule. So the deliverable is a pair: `deck.html` + `deck.ARGUMENTAIRE.md`.

Write it **as you build**, not after — an argument reconstructed at the end is a
justification, and a justification hides the choices that were never made deliberately.
The test: if an element cannot be defended in one line, it should not be on the slide.

Structure (one file, in this order):

| section | what it holds |
|---|---|
| 0 · Socle | canvas, scale factor k, template, type scale, palette tokens — each token with its reason and its measured value |
| 1 · Règles transverses | the doctrine rules actually load-bearing in THIS deck, each with the slide that forced it |
| 2 · Rythme | the section cut and why each section carries the background it carries |
| 3 · Slide par slide | one block per slide: every element (eyebrow, pill, title, exhibit, each card, each colour) → what it is, why it's there, why THAT colour/size/shape |
| 4 · Valeurs calibrées | every number found by measurement rather than choice (a padding, a font-size), with the sweep that produced it |
| 5 · Refusé | what was considered and rejected, and why — the most useful section on re-read |

**And it is REPLAYED against the deck, in a loop, until the two agree.** (Léo, 6th review:
« loop check de l'argument jusqu'à modification visuelle et argumentation rattachée
cohérente ».) Ship a small checker beside the deck that re-asserts every claim against the
source — the CSS cascade (read the LAST declaration, not the first, or you argue about a dead
rule), the gate's JSON, and the slide markup — then look at the rendered pages with the
argument in hand. Loop: fix the deck OR fix the argument, re-measure, re-render, re-read.

The three kinds of gap it finds, none of which the gate can see:
1. **A figure quoted from memory.** Four were wrong on the reference deck (53 vs 59-75
   car./line, 66 vs ~90, 9,34:1 vs 11,2, a worst-contrast that only held for reading text).
2. **An argument that does not describe the render.** « symmetric with slide 4 » — one slide
   grouped its cards in a panel, the other didn't. The diptych was claimed, not built.
3. **An exhibit whose numbers don't add up to the figure beside it.** A big « 61/154 » sat
   next to a list totalling 93. The eye reads a list beside a figure as ITS breakdown; this
   one wasn't. Assert the sum in the checker — it is the cheapest lie to ship and the most
   expensive to be caught on.

Three rules for the content:
- **A colour is argued per slide, not once globally.** « accent = cobalt » is a token, not an
  argument. Why THIS figure is green on THIS slide, and why the neighbouring one is not, is.
- **Cite the measurement when one exists** (« 3.72:1 under card+panel », « the only padding
  where the five labels hold on 4 lines »). A calibrated value is stated as calibrated —
  never dressed up as taste.
- **Say what was refused.** Numbering that would have implied a false order, a `min-height`
  that would only have silenced an audit, a centring that would have broken the reading edge.

## Use the library before inventing (visual-lab)

`~/visual-lab` holds vignettes reverse-engineered from real reference decks: each one is a
documented intention, a set of RATIOS, and a list of **benchmarks** — measurable assertions
(chamfer ÷ width, type-size jump, contrast, no-overflow) that the vignette must satisfy. They
exist so a slide element is never re-guessed twice, and so "it looks fine" is not the only
proof available. It is shared with the HTML/web side, so it serves both backends.

```bash
cd ~/visual-lab && node bin/index.mjs            # index ALWAYS regenerated first (see below)
sed -n "/## Catalogue/,/## Détail/p" INDEX.md     # the routing table: one line per pattern
node bin/search.mjs "stat accent"                # full-text, prints the HTML fragment
node bin/check.mjs card-03-stat-accent           # the benchmarks, measured in a real browser
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
  --exec 'node bin/photos.mjs --slug <deck> --palette ref-10-campaign-board-red --n 4 \
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

> **The laws themselves are the house's, not this skill's.** They are listed once, medium-free,
> in [`~/visual-lab/DOCTRINE.md`](../../../visual-lab/DOCTRINE.md) — which also names, per law,
> what measures it in each medium (and where nothing does yet). What follows here is their SLIDE
> application: the thresholds, the units, the `bin/gate.sh` audits. Read DOCTRINE.md when you
> produce anything that is not a slide — a mailing, a flyer, a post — so the same laws travel
> without dragging the slide numbers with them.

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

**A VIGNETTE IS SIZED BY ITS TEXT, NEVER BY THE BAND IT SITS IN.** (Léo, 30/07/2026:
« jamais de gros vide dans des vignettes, il faut les calibrer en fonction de la taille des
textes ».) The reflex of stretching a card row to fill the content band produces a row of
tall half-empty cards — the card reads as a full painted surface at slide scale, so the
slide-level dead-space measure misses it entirely. Three consequences, all mandatory:

1. **Do not stretch the row to the band.** Let the cards take their natural height and
   centre the row in the band. If that leaves a large slide-level void, the fix is to grow
   the type and add substance INSIDE the cards until they legitimately fill it — not to
   stretch them.
2. **Same group = same size.** Every card of one row/section is identical in size. The
   tallest content sets the height for all.
3. **To equalise, pin the PARAGRAPH to the card's BOTTOM** (`align-self: end`). All the
   paragraphs of the group then share their last baseline and the variation in length shows
   as a small gap ABOVE the paragraph, never as a ragged row of feet. Better still, write
   the copy so every card has the same number of lines — equalise by the text first, by the
   CSS second.

`bin/gate.sh` measures this: `audit_card_voids` re-rasterises each card on its own ink and
flags a card that is more than ~22 % empty (hard past 30 %).

**3-bis. A VIGNETTE NEEDS AIR ABOVE IT — and the amount is measured, not eyeballed.**
(Léo, 01/08/2026: « les 2 vignettes sont trop proches du texte du dessus, le contrôle maths
du skill doit permettre d'écarter un peu plus ».) A card row tucked under a heading or a lede
reads as the continuation of that paragraph; the blank is what says *the sentence ended, an
object begins*. `audit_breathing` measures the gap between each card and the nearest text
sitting **directly on the slide** (not inside another card), and requires
`max(0.60 × the size of that text, 1 × the slide's body size)` — 37 px under a 62 px title,
30 px under a 26 px source line.

Three things that rule learnt the hard way, all of them still in the gate:

- **The ratio is SUB-LINEAR.** The first cut asked 1.25 × the text above — 78 px under a
  62 px title. On a 1080 px stage that is not "more air", it is a ban on density: it lit up
  32 reserves across a deck that had been validated by eye. Space after a heading follows
  its size *at a distance*, and there is a floor below which no blank separates anything.
- **A CAPTION IS NOT "the text above".** A label posted just over its own object — same
  parent, one unit of composition — must stay stuck to it. Demanding air there means
  detaching a legend from its figure. Siblings are excluded.
- **Soft, with a hard tier far below.** A dense slide arbitrates between air and content
  every time; the reserve names the arbitrage, it doesn't forbid it. Only under 0.35 × is
  there no arbitrage left — the card is touching the text.

Beware the shape of the container when you widen the gap: under `justify-content: center`
in a `flex: 1` band, a top margin only moves the box. If the content already overflows that
box, centring pushes it back UP and the gap **shrinks**. Cut content, or reclaim the head
reserve — and re-measure rather than assume the margin landed.

**4. INSIDE a vignette, every element is CENTRED — equal gap on both sides, checked
arithmetically.** (Léo, 30/07/2026.) The only exception is **numbering**, which may sit centred
or at one extremity. **What is centred is the BLOCK, not the words.** A paragraph KEEPS its
reading direction — left-aligned, or justified when the measure allows — and it is its BOX that
sits equidistant from both edges. (Léo, 4th review, 30/07/2026: « garder justifié + gauche les
paragraphes dans les vignettes, c'est la LOCALISATION qui est au milieu, à équidistance de chaque
extrémité — ou presque si non justifié. »)

A paragraph that fills its column is therefore centred by construction: the two gaps ARE the
card's padding, and nothing else is required. Reaching for `text-align: center` on a body
paragraph to "make the gaps equal" is the trap this rule was misread into once — it centres the
words, destroys the left reading edge, and answers a measurement artefact rather than the
instruction. Centre the words only for a SHORT label or caption that fits on one line, where the
line IS the block. `audit_card_centering` measures accordingly: the BOX of any block of two lines
or more, the ink only for a single line — with a widened tolerance there, which is the « ou
presque » of a ragged line.

**4-bis. THE SLIDE TITLE CARRIES THE SLIDE — don't shrink it to make room.** (Léo, 5th review:
« les titres doivent être plus gros ».) On the 1920 canvas an assertion title sits at **≈78 px**
and must not fall below ~72 px; it is the first thing read and the only line that states the
finding. **Hierarchy does not have to be dimensional**: an eyebrow separates itself by case,
colour and letter-spacing, not by being small, and a subtitle carrying a strong message may sit
at nearly the title's size. Concretely, on the 1920 canvas: **the slide's section kicker/eyebrow sits at
≈46 px and never below 44; a kicker INSIDE a card at ≈36** (Léo, three times: « les petits
titres sont toujours trop petits… je vois pas de différence »), and the pill facing the eyebrow
follows at ≈40. A kicker is the slide's SECTION MARKER, not a legal notice — at 29 px under a
78 px title it vanishes. **Move it in one step, not two**: 29 → 38 was a real +31 % and still
read as "no change"; it took 29 → 46 (+59 %) to land. When a correction is about presence,
half a step reads as no step. The gate's 26 px kicker floor is a floor, not a target; same for
a caption under a hero figure (40 px there) and a citation source (34). Rank by weight, colour and position before reaching for a size step
— but never let the title itself get small in the process. When the bigger title costs height,
pay it on that slide's supporting blocks (banner padding, card padding, row gaps), never by
letting ink drift into the margin, and re-measure: on the reference deck +14 px of title cost
one figure 8 px and three paddings.

**5. A TEXT BLOCK MUST USE ITS COLUMN.** A paragraph that folds onto several lines while its
column is wide has been capped (a `max-width`, a hard `width`) for no reading reason: the eye
sees a block that stops short and a band of nothing to its right. `audit_measure_underuse`
flags a block using less than 85 % of a column wider than 1200 px — it ignores bands shared
with a sibling, where the reduced width IS the grid. This caught a closing paragraph capped at
1300 px on a 1646 px column, at 34 px where 46 px was available.

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

**6. AN IRREDUCIBLE VOID TAKES A HAND, NOT CONTENT.** (Léo, 01/08/2026: « identifie les
espaces un peu gros mais qu'on ne peut combler proprement sans casser le reste et ajoute-y
des éléments style dessin brouillon en rapport avec le sujet ».) Some voids are structural:
six table-of-contents entries do not fill a 1920×1080 stage, and stretching them turns a
contents list into a row of cards. Rule 1 still comes first — grow, distribute, add
substance — but when all three would break the slide, the answer is **a pencil mark, not
invented content**: a sketched circle, a brace, a curved arrow, in the deck's own ink,
always an open stroke, never filled, at ~0.75–0.85 opacity.

The mark must **say something the reader could not deduce** — on the contents page, an arrow
to a section number captioned « chaque ligne est un lien » ; on the cover, a brace under two
diagrams captioned « les deux moitiés du même métier ». A doodle that only decorates is
padding with a costume on. Keep it to one per slide, and only on slides the measurement
actually flags (`audit_deadspace` ≳ 8 %) — a deck sprinkled with hand-drawn marks stops
looking annotated and starts looking unfinished.

**7. THE COVER IS AN ENTRY, NOT A SUMMARY — keep it lighter than everything after it.**
(Léo, 01/08/2026: « je ne veux pas ces 2 vignettes, elles surchargent trop la 1ère slide de
couverture qui doit toujours être plus allégée, c'est une entrée en matière tranquille ».)
A cover carries a title, **one fuller paragraph**, and at most one visual figure — never a
card row, never a feature list. Rule 1 (fill the space) applies to the slides that argue;
on the cover, the empty space IS the composition. When the cover looks thin, the answer is
a longer paragraph and a bigger figure, not more objects.

Two figures are allowed when they are **the two halves of one subject** — and then they are
separated by a single full-height slash, not boxed side by side, and they SHARE THEIR CELL
SIZE so both look cut from the same paper. A caption over each, one legend under each, and
nothing else.

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

## 1c. SURFACE, RELIEF, GROUPING — the three levers that stop a deck reading flat

A deck built only of flat tinted cards on one background reads as a wireframe, not a document.
(Léo, 4th review, 30/07/2026: « il est trop simpliste ».) Three levers, all measured, none
optional once a deck is beyond a draft:

**a. A card is a SURFACE, not a tint.** Give it a gradient and a lit edge — the light comes
from the top, so the top border is the densest. **On a light background the card must be
LIGHTER than the page, not darker**: a cobalt-tinted gradient on cream turns every card
grey-lavender and the whole deck looks dirty (measured and rejected, 30/07). Use warm white
→ a whisper of accent; keep the accent border to draw the edge. On a dark section the rule
inverts: a light veil on the ink. **This costs contrast** — the gradient's darkest stop is
what the body text actually sits on, and stacking a card over a grouping panel stacks two
veils. The gate now reads gradients (worst stop wins) instead of giving up, and it caught
body text at 3.72:1 under exactly that stack.

**b. Numbering belongs in a round chip in a top corner** (left or right — vary it between
slides), NOT in a row of the card's grid: it frees a whole line of height. Two constraints:
(i) the card MUST reserve the space — a chip laid over a kicker is a hard overlap, and even
when the boxes clear each other a chip 20 px from a long kicker reads as glued to it, so
shorten the kicker or reserve the padding; (ii) **only number what is actually ordered.** A
sequence of actions, yes. Four measurements of the same fact, no — a numbered chip claims an
order that isn't there (rule 1b). Name the class with `num` in it: the centring audit exempts
numbering by design, which is Léo's own carve-out.

**b-bis. MATCH THE COLOURS, and check the match — every stacked surface at once.** Léo, 5th
review: « il faut toujours contrôler le matching couleur jusqu'à l'acceptable ». Background,
panel and card are read TOGETHER, so they must be ONE family in three densities — never three
different hues. The failure to avoid: a cobalt veil on a warm cream page. Cobalt at 3-5 % over
cream reads as GREY, so the panel and the bottom of every card turn cold while the page stays
warm, and the slide looks soiled even though each colour is individually fine. **The panel
marries the BACKGROUND** (the same hue, one notch denser), **not the cards**; the cards climb
toward WHITE (warm white → the page's own cream), never toward grey. The only cold thing on a
warm page is the accent itself, as a hairline border or a chip — there it is deliberate.
Practically, per section: page = mid tone, panel = page darkened ~4 %, card = near-white.
Invert all three on an ink section, same rule.

**c. A light PANEL groups what belongs together** — three cover stats, a bar plus its legend,
five green dimensions. It sits ABOVE the slide background and BELOW the elements, so it must
be PALER than the cards it holds, and its radius ≥ theirs. Budget its cost: a panel spends
~52 px of height (padding + rule), and that height is taken from the slide it sits on — pay
it back on that slide's own cards, never by letting ink drift into the margin.

## 2. ONE FACT, ONE HOME — no repetition across slides

Before writing copy, map each recurring proof point (founding year, headline metric,
certification, award…) to exactly ONE slide. Remove it everywhere else. Repetition reads as
padding and erodes trust. See `references/structure.md`.

## 3. ASSERTION TITLES, not topic labels

Every content slide title is a short sentence stating the takeaway, not a noun label
("Power BI is the leader we standardised on", not "Power BI"). Reading the titles
top-to-bottom should tell the whole story (the "ghost-deck" test).

**3-bis. NO STACK OF LABELS — count the type ranks before the slide is built.** (Léo, 01/08/2026:
« trop de titres / sous-titres à la suite… tu dois à un moment donné te poser cette question, lors
du plan et de l'argumentaire des éléments. ») A chrome strip, then a kicker, then a title, then a
subtitle is FOUR ranks of heading before the first fact — and the reader has read the same thing
four times in four sizes. The trap is that each one is individually defensible; only the stack is
the defect, so it is invisible while you write and obvious once rendered.

The reflex, applied at the PLAN (rule 3) and re-asserted per slide in the ARGUMENTAIRE: **list
every heading-rank element the slide carries, in order, and delete any that a neighbour already
says.** On the reference cover, `FINENGY ADVISORY — APPEL D'OFFRES` in the chrome already named
the genre, so the `PROPOSITION` kicker under it said nothing: cut. Concretely:

- **Two heading ranks in a row is the ceiling** before something that is not a heading (a figure,
  an exhibit, a paragraph, a rule). Three is a defect to argue explicitly or remove.
- **A kicker is only earned when it adds a coordinate the title cannot carry** — a section
  number, a date, a scope (`25 collaborateurs · tarif catalogue`). A kicker that paraphrases the
  title, or that repeats the chrome, is padding wearing letter-spacing.
- **What the cut buys is substance, not air.** Removing a rank frees height: spend it growing the
  paragraph below and adding a real fact, never on white space (rule 1).

## 3-ter. A QUOTE HAS A CHRONOLOGY, AND PRICE COMES LAST

For any deck that proposes work and names a price — a devis, a proposal, a bid — the order is not
a matter of taste. (Léo, 01/08/2026.)

> **the offer → the functional comparison → the price comparison, MY PRICE ON THAT SAME SLIDE →
> the proof I can build it.**

Four rules carry it, and they hold for every quote deck:

1. **NEVER a price on the cover or in the opening slides — always at the end.** A figure read
   before the scope is understood is a figure with nothing to weigh against; the reader prices
   the unknown and it always looks expensive. The cover states what the thing IS and for whom,
   nothing else. The corollary is generous: the space the price line was eating goes into the
   opening synthesis of what is delivered — the cover gets *more* substance, not less.
2. **The competitor is met on FEATURES before being met on COST.** Show your own offer in full
   first, then the feature-by-feature comparison, then the money. Leading with money before the
   scope invites the reader to compare two prices instead of two perimeters, which is the one
   comparison a bespoke offer loses.
3. **Your price does NOT get a slide of its own — it lives ON the price-comparison slide.**
   (Léo, 01/08/2026, correcting the first draft of this rule.) A dedicated price slide makes the
   reader weigh your figure against nothing; put it beside the competitor's and the comparison
   does the arguing for you. So the competitor is worth exactly **two** slides — one on features,
   one on cost — and the second carries the long-term cumulative chart, the short-term (1 and
   3 year) comparison, **and** your own fee. Dense on purpose: it is the decision slide.
4. **After that slide, prove the capability** — one or two slides of comparable work already in
   production, screenshots included. It answers the question the price has just raised ("can he
   actually build this?") at the exact moment it is asked.

**And the commercial move worth reusing: the CUMULATIVE-COST slide.** A per-seat subscription
compared to a one-off fee over 1 / 3 / 5 / 10 years, with the gap stated as a single figure and
the effect of headcount growth spelled out. It converts a monthly price the reader has normalised
into a total they have not. Pair it with the honest framing (a low and a high licensing
hypothesis, what is excluded, what the vendor has not disclosed) — the credibility is what makes
the number land. `chart-04-unit-textured-bar` in `~/visual-lab` is the exhibit built for it.

**Source every claim about a competitor, on the slide that makes it.** A comparison table asserting
what a vendor does or does not cover is the most attackable slide in the deck: it gets one small
line naming where the claim comes from (the vendor's commercial pack, the pages consulted and the
date). Not a footnote elsewhere, not the appendix — on the slide. An unsourced competitor claim
costs the whole deck its credibility the moment one line is challenged.

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

**These are floors, not TARGETS.** A number that merely clears the floor is not thereby
legible: 30 px under a 120 px figure on a cover reads as small, because the eye compares it to
its neighbour, not to a table. Two consequences (Léo, 30/07/2026: « il faut un seuil minimum de
taille pour la lisibilité du lecteur ; il faut construire des choses visuelles surtout, ça peut
être plus gros ») :

- **A stand-alone caption — under a big figure, on a cover, in a hero band — belongs to the
  display ladder, not the body ladder: ≥ 40 px.** The body floor governs text inside a card,
  where the reader is already close in.
- **Build visual objects, not loose text.** A figure + a caption floating on the background is
  weaker and smaller than the same content as a real vignette (surface, border, its own
  padding). When a slide feels thin, turn the content into components and let them grow — do
  not simply nudge the type up two points.

If text must shrink below the floor to fit, **cut content — don't shrink**.

### 4c. JUSTIFIED TEXT — an arbitrage, decided by measurement

Setting a paragraph flush on both edges puts four requirements in competition: the justified
form itself, inter-word spaces that stay even, regular line rhythm, and one shared type size
across all the vignettes of a group. They cannot all win. **Work the micro (the size) from the
macro (the grid), and if the justified form is unreachable, drop IT and spend the compromise on
the other three** — never the reverse, because a river of white is more visible than a ragged
right edge.

The arbitration is measured, not eyeballed. `bin/gate.sh` reports, per justified paragraph, the
**measure in characters per line** and the ratio of the widest inter-word space to the median:

- **below ~45 characters per line, justification is lost before it starts.** A 4-up vignette row
  on the 1920 canvas gives 16-20 characters — measured ×3.29, a 70 px hole between two words.
  Either widen the column (a macro change: 4 cards → 2) or set ragged-right.
- above that measure it usually costs nothing: the same deck's full-width banners justify at
  59-75 characters per line with a ratio of ×1.00 — no river at all.
- the ratio decides, the character count explains. A narrow-ish callout at 35 characters and
  ×1.17 is fine; the guideline flags the risk, the measurement settles it.

Loop it micro ↔ macro: change the size, re-measure; if the size cannot save it, change the grid;
if the grid must stay, abandon the justified form. NEVER let text spill past its container's bottom. For a row of
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

**A FOLIO GOES TO THE CORNER, AND PAGE FURNITURE IS EXEMPT FROM THE MARGIN RULE.**
(Léo, 01/08/2026: « la numérotation des slides doit toujours être plus proche de l'extrémité
bas droite de la slide ».) When a printed page number IS wanted, it belongs at the very
angle — outside the bottom rule, ~30 px from the right edge, ~20 px from the bottom — not
lined up on the editorial axis. Sat at the text margin it reads as a content line someone
forgot to align; pushed into the corner it goes back to being a reference mark.

**If the folio gets a ring, the ring is DRAWN, and it is on EVERY page.** (Léo, 01/08/2026:
« tu as entouré la numérotation trop brouillon et ça chevauche un autre élément ».) A
hand-drawn circle around the number on the cover alone fails twice: it clipped the bottom
rule, and a reference mark that changes from page to page stops being a reference mark. Use
a real ring — `border-radius:50%` on a fixed square, one ink-step thick, the same weight as
the frame rules — and push the folio far enough into the angle that no edge of the circle
crosses the bottom rule (which stops at the `--edge` margin). Same ring, all pages.

That puts it, by design, inside the slide margin — and the gate's `in-slide-margin` check
would call every one of them a hard defect (16 on a 16-slide deck). Page furniture is
therefore exempt, via `T.chrome_sel` (`.folio, .topbar, .rule-t, .rule-b, .doodle,
.doodle-note, [data-chrome]`, plus anything you mark `data-chrome`). **Exempt from the
margin, and from nothing else** — type floor, contrast and overlap still apply to it.

**A CONTENTS PAGE IS CLICKABLE, AND IT MUST SURVIVE THE PDF.** Chrome writes an internal
link annotation only for an anchor pointing at a **real id present in the document** — so
give each slide `id="sN"` and target `href="#sN"`. The screen controller in `assets/stage.js`
accepts both `#7` and `#s7` for exactly this reason (the gate and the screenshot scripts use
the bare number). Numbering a contents page in the mono face makes it read as tabular data
at the same rank as the folio; set it in the **serif, at ≈60 px**, and it takes the rank of
the title it numbers.

## 6b. A SEPARATOR IS JUDGED BY ITS TWO GAPS — and the gate now measures them

(Léo, 01/08/2026 : « le slash apparaît trop proche du schéma "Les Affaires", ça rend mal ; le
skill doit pouvoir contrôler ceci et rechercher une meilleure harmonie ».)

A rule set BETWEEN two blocks says *this on one side, that on the other*. It is therefore
judged neither on its length nor on its position but on its **two clearances**: if it grazes
one of the two blocks it stops separating and starts belonging. Two numbers, one idea — the
smaller of the two gaps, and the **equality** of the two.

**A long separator is a bad separator.** A tilted rule's horizontal reach grows with its
length (`reach = length × sin θ`), so a bar stretched across the whole column has to lean far
into both neighbours to exist. Cut it down to the band the two blocks actually SHARE and the
reach collapses — on this deck, 417 px → 172 px took the clearance from 11 px to 34 px a
side, with nothing else changed.

**Carry the diagonal with the BLOCKS, not with the rule.** Offset one column by one grid
cell: that opens a void top-right and a void bottom-left, and each end of the "/" now
terminates in empty space instead of alongside dense ink. The rule then only has to inhabit
the overlap. Shift the SHORTER column so the pair does not grow and nothing overflows.

`audit_separator` in `bin/gate.mjs` measures this. It only looks at ink that is thin
(`sep_thick`), elongated (`sep_ratio`), sitting **on the slide** (a hairline inside a card is
an ornament of that card), **alone in its slot** (a chart bar shares its slot with its value
label; a trailing caption rule shares its slot with the label — neither separates anything),
and with ink on **both** sides of its own band. It then reports `sep_min_gap` (default 20 px)
and the skew between the two gaps (`sep_skew_px` / `sep_skew_frac`).

### Two blind spots this uncovered — both now closed, both general

1. **Ink drawn by a `::before` is invisible to the gate.** The census walks
   `querySelectorAll('*')`; no pseudo-element ever enters it. The slash was a `::before`, so
   *no* audit could see it — not overlap, not margin, not clearance. **Anything that carries
   the composition must be a real element**; `::before` is for ornament you accept never to
   measure.
2. **The gate's freeze erased authored geometry.** `body[data-gate] * { transform: none
   !important }` was there to force the end state of the `.reveal` entrance — but it also
   killed every static transform, so a tilted 5 px bar was measured as a straight 5 px bar
   and its real 84 px footprint was never seen. The reset is now scoped to `.reveal` in
   `assets/stage.css`. **Freeze motion, never geometry** — otherwise the gate measures a
   layout no reader will ever see.

**Eval before trusting a new audit.** A control that never fires looks exactly like a control
that passes. Rebuild the *defective* geometry and check the audit fires on it, then check it
stays silent on the fix — and that it flags nothing else in the deck. Both blind spots above
were found by that eval, not by reading the code: the first version of this audit was silent
on the very defect it was written for.

## 7. BACKGROUND RHYTHM — vary by section, never per slide; stay on-moodboard

One background on every content slide reads as monotonous; a different background on every
slide reads as chaos. The fix is SECTION RHYTHM: group slides into coherent sections and give
each section ONE background, switching only at section boundaries. Keep the cover and the
closing/contact slide on the hero background. Carry this into every multi-section deck —
actively decide where the background should turn over.

**AN ASIDE CHANGES TEMPERATURE, NOT SIZE.** (Léo, 01/08/2026, on two slides that show where
the method comes from rather than answering the brief: « elles ne traitent pas du sujet
directement, on peut les démarquer du flux d'info principal en changeant la colorimétrie
background et en ajustant en conséquence les couches supérieures. À retenir pour le skill :
des formes d'apartés ou d'annexes peuvent être démarquées esthétiquement du reste en
changeant certaines variables comme la colorimétrie. ») An annex, an aside, a "how we know
this" detour is taken OUT of the main flow by shifting the paper's temperature — the reader
sees *different chapter* before reading a word. Never by shrinking it, never by greying it:
that demotes the content instead of relocating it.

Do it through **variables, never a second set of rules**: the section overrides the paper,
its shade, the top of the card gradient and the mockup surfaces, and every component
inherits — including ones written afterwards. That only works if no component hardcodes a
tint; hoist any literal into a token FIRST. Two traps, both silent: define the token with
its own literal value (`--card-top: #F7F3E8`) and not with itself — a blanket search that
rewrites the declaration into `--card-top: var(--card-top)` makes every gradient in the deck
resolve to nothing, and cards keep their border so it looks almost right. And re-label the
running head (`04 —` → `APARTÉ —`) so the topbar tells the same story as the paper.

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
