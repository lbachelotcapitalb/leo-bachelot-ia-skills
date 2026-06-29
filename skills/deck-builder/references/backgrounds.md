# Background rhythm & moodboard-background recipes

Companion to SKILL.md **rule 7**. Use this when a deck feels monotonous (one flat
backdrop on every slide) or chaotic (a different look on every slide). The answer
is *section rhythm*: one background per coherent section, switched at section
boundaries, all sharing one moodboard.

## Method
1. **Map the sections.** Group slides into a handful of coherent runs
   (intro / offer / proof / closing …). Cover + contact stay on the hero bg.
2. **Assign ONE treatment per section.** Vary geometry, value, or accent — never
   the palette or motif family. A typical 20-slide deck wants ~4–6 backgrounds.
3. **Generate flat 1920×1080 PNGs** (recipes below). Keep them subtle.
4. **Apply** with `pptx_kit.set_slide_background(slide, png)` for each slide in
   the section.
5. **Light section?** Recolor the text on the bg (eyebrow/title/subtitle → dark);
   text inside dark cards stays light. Verify with a render — a pattern that
   crosses text or a white-on-white title is a hard defect.

Treatments that stay on one moodboard (palette `BASE` dark + one `ACCENT`):
- **Plexus / network** — thin lines connecting nodes (the usual baseline).
- **Low-poly facets** — jittered triangle grid, subtle navy shading.
- **Gradient + plexus** — diagonal value shift toward a tinted corner ("tech").
- **Accent halo** — base + a soft radial glow of the accent in one corner.
- **Light / inverted** — light base + faint dark motif (logos & shots pop).
- **Dot-grid** — regular dots instead of a network (alternative pattern).

## Keep it subtle (the #1 mistake)
A background must recede. If text — especially captions placed directly on the bg
with no card — loses contrast, the motif is too loud. Three levers, apply all:
1. **Drop alpha** — edge/line ~8–15/255, facet shade variation small.
2. **Veil** — composite a thin layer of the base color (~alpha 90/255) over the
   whole image to push the motif back.
3. **Clear the whole CENTRE, not just the title** — text lands anywhere: a
   right-hand paragraph, an on-bg caption, a wide title. Rejecting points only in
   the title corner is not enough — and plexus *lines* connect distant nodes, so
   a line can still span a "cleared" centre. The reliable fix is a CENTRE FADE:
   multiply the motif's alpha by an `edge_mask` that is 1 in the outer margins and
   0 across the central ~80%×84% (where all content sits). The motif then lives
   only at the edges/corners and no text is ever crossed — regardless of density.
   Keep a `top_scrim` too for the title band. To fix an ALREADY-FLATTENED bg you
   can't regenerate, use `center_veil` (composite the image's own base colour over
   the centre) — same result, preserves the approved edge look.

## Generator (PIL + numpy, theme-agnostic — pass your own hexes)
```python
import numpy as np, random
from PIL import Image, ImageDraw
W, H = 1920, 1080
def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

def solid(c):
    a = np.zeros((H, W, 3), np.uint8); a[:] = c; return a

def diag_grad(c1, c2):                      # value shift c1 -> c2 (tech feel)
    yy, xx = np.mgrid[0:H, 0:W]
    t = ((xx / W) * 0.55 + (yy / H) * 0.45)[..., None]
    return (np.array(c1) * (1 - t) + np.array(c2) * t).astype(np.uint8)

def radial_add(base, center, color, radius, strength):   # accent halo
    yy, xx = np.mgrid[0:H, 0:W]
    d = np.sqrt((xx - center[0]) ** 2 + (yy - center[1]) ** 2) / radius
    g = (np.clip(1 - d, 0, 1) ** 2 * strength)[..., None]
    return np.clip(base.astype(float) + np.array(color) * g, 0, 255).astype(np.uint8)

def plexus(base_arr, color, n=26, maxd=210, line_a=52, dot_a=66, dot_r=3, seed=1,
           clear=(0.62, 0.45)):                    # keep top-left title zone empty
    random.seed(seed)
    pts, tries = [], 0
    while len(pts) < n and tries < 2000:
        tries += 1
        x, y = random.uniform(0, W), random.uniform(0, H)
        if clear and x < clear[0]*W and y < clear[1]*H:   # reject points in title zone
            continue
        pts.append((x, y))
    img = Image.fromarray(base_arr).convert('RGBA'); d = ImageDraw.Draw(img)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            dd = ((pts[i][0]-pts[j][0])**2 + (pts[i][1]-pts[j][1])**2) ** .5
            if dd < maxd:
                d.line([pts[i], pts[j]], fill=color + (int(line_a*(1-dd/maxd)),), width=1)
    for p in pts:
        d.ellipse([p[0]-dot_r, p[1]-dot_r, p[0]+dot_r, p[1]+dot_r], fill=color + (dot_a,))
    return np.array(img.convert('RGB'))

def top_scrim(arr, color, max_a=105, frac=0.44):    # darken the title band so it always reads
    yy = np.arange(H)[:, None]
    a = (np.clip(1 - yy / (frac * H), 0, 1) * (max_a / 255))[..., None]
    return (arr * (1 - a) + np.array(color) * a).astype(np.uint8)

def edge_mask():                    # 1 in outer margins, 0 across the central content box
    yy, xx = np.mgrid[0:H, 0:W]
    fx = np.clip((np.abs(xx / W - 0.5) - 0.40) / 0.07, 0, 1)
    fy = np.clip((np.abs(yy / H - 0.5) - 0.42) / 0.06, 0, 1)
    return np.maximum(fx, fy)

def plexus_edge(base_arr, color, n=32, maxd=240, line_a=64, dot_a=78, dot_r=3, seed=1):
    """Plexus whose alpha FADES OUT across the centre (edge_mask) — motif only in
    the margins, so text placed anywhere on the bg is never crossed by a line."""
    random.seed(seed)
    pts = [(random.uniform(0, W), random.uniform(0, H)) for _ in range(n)]
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(layer)
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            dd = ((pts[i][0]-pts[j][0])**2 + (pts[i][1]-pts[j][1])**2) ** .5
            if dd < maxd:
                d.line([pts[i], pts[j]], fill=color + (int(line_a*(1-dd/maxd)),), width=1)
    for p in pts:
        d.ellipse([p[0]-dot_r, p[1]-dot_r, p[0]+dot_r, p[1]+dot_r], fill=color + (dot_a,))
    arr = np.array(layer).astype(float); arr[..., 3] *= edge_mask()
    base = Image.fromarray(base_arr).convert('RGBA')
    return np.array(Image.alpha_composite(base, Image.fromarray(arr.astype(np.uint8))).convert('RGB'))

def center_veil(img, strength=0.82):   # FIX a flattened bg: veil the centre with its own base colour
    arr = np.array(img.convert('RGB')).astype(float); H_, W_ = arr.shape[:2]
    base = np.median(arr.reshape(-1, 3), axis=0)
    yy, xx = np.mgrid[0:H_, 0:W_]
    fx = np.clip((np.abs(xx / W_ - 0.5) - 0.40) / 0.07, 0, 1)
    fy = np.clip((np.abs(yy / H_ - 0.5) - 0.42) / 0.06, 0, 1)
    a = ((1 - np.maximum(fx, fy)) * strength)[..., None]
    return Image.fromarray((arr * (1 - a) + base * a).astype(np.uint8))

def lowpoly(base, edge, cols=11, rows=6, shade=7, edge_a=8, veil_a=95, seed=3):
    random.seed(seed)
    img = Image.fromarray(solid(base)).convert('RGBA'); d = ImageDraw.Draw(img, 'RGBA')
    P = {(i, j): (i*W/cols + random.uniform(-42, 42), j*H/rows + random.uniform(-42, 42))
         for j in range(rows+1) for i in range(cols+1)}
    for j in range(rows):
        for i in range(cols):
            a, b, c, e = P[(i, j)], P[(i+1, j)], P[(i, j+1)], P[(i+1, j+1)]
            for tri in ([a, b, e], [a, e, c]):
                s = random.randint(0, shade)
                d.polygon(tri, fill=(base[0]+s, base[1]+s+random.randint(0,3), base[2]+s+random.randint(0,6)))
                d.line(tri + [tri[0]], fill=edge + (edge_a,), width=1)
    img = Image.alpha_composite(img, Image.new('RGBA', (W, H), base + (veil_a,)))  # veil = recede
    return img.convert('RGB')
```

### Example (a dark-moodboard section)
Prefer `plexus_edge` (centre-fade) over plain `plexus` for any section that
carries text on the bare background — it returns a numpy array → wrap in
`top_scrim(...)` then `Image.fromarray(...).save()`. `lowpoly` returns a PIL image.
```python
NAVY, TEAL, GOLD = rgb('0A1628'), rgb('5DD5E8'), rgb('F0B429')
lowpoly(NAVY, TEAL).save('bg_practices.png')                                   # facets, muted
Image.fromarray(top_scrim(plexus_edge(diag_grad(NAVY, rgb('0c3a4d')), TEAL, seed=7),
                          NAVY)).save('bg_tech.png')                           # gradient + edge-fade plexus
Image.fromarray(top_scrim(plexus_edge(radial_add(solid(NAVY), (W*.85, H*.16), GOLD, W*.5, .42),
                                 GOLD, seed=9), NAVY)).save('bg_engagement.png')  # accent halo
# light section (recolor on-bg text to dark):
Image.fromarray(plexus_edge(solid(rgb('F4F6FA')), rgb('20406a'), line_a=46, dot_a=52)).save('bg_light.png')
# fixing a bg you can't regenerate (already flattened):
center_veil(Image.open('bg_existing.png')).save('bg_existing_clean.png')
```
Use `plexus_edge` + `top_scrim` for every section with bare-bg text so the motif
stays in the margins and no line crosses a title or paragraph. The light variant
inverts value — pair it with a text recolor (eyebrow/title/subtitle → dark).

## Apply
```python
import pptx_kit as k
for si in range(6, 12):                       # a section, 1-based -> 0-based
    k.set_slide_background(prs.slides[si - 1], 'bg_practices.png')
```
`set_slide_background` strips any prior `<p:bg>` and any full-bleed background
picture before inserting the new stretched image, so it's safe to re-run while
dialing in the look.
