/* ============================================================
   deck-builder — GEOMETRY GATE (L6)
   Runs inside `ego-browser nodejs`. Do not run with plain node.
   Invoke through bin/gate.sh, which prepends GATE_ARGS.

   It MEASURES a deck; it never judges it. Every number below is
   read off a real Chromium layout at the authored 1920×1080
   canvas, with motion frozen and the stage un-scaled, so a
   measurement is in canvas px — the same unit the deck is
   written in.

   Audits (same names as the pptx backend):
     audit_overlaps    two ink elements sharing area
     audit_overflow    ink escaping its container / the canvas
     audit_deadspace   largest empty rectangle inside the ink bbox
     audit_vbalance    void above a block vs void below it
     audit_text_sizes  type floor + WCAG contrast
   plus occupancy / margins / centre-of-ink symmetry.
   ============================================================ */

const A = globalThis.GATE_ARGS || {}
const DECK = A.deck
const OUT = A.out || '/tmp/deck-gate.json'
const STRICT = !!A.strict     // --strict promotes deadspace/vbalance to hard
const T = Object.assign({
  cell: 20,              // rasterisation cell, px
  overlap_min_px2: 400,  // ignore hairline touches
  overlap_min_frac: 0.02,// … and < 2% of the smaller element
  overflow_tol: 2,
  deadspace_soft: 0.15,  // largest empty rect / ink bbox area
  deadspace_hard: 0.30,  // gates only with --strict (see below)
  vbalance_soft: 40,     // px delta between top and bottom void
  vbalance_hard: 120,    // idem
  floor_hard: 24,        // px, canvas — nothing legible below
  floor_soft: 28,        // px, canvas — body floor (rule 4)
  large_text: 56,        // px, canvas — above this, WCAG "large"
  contrast_large: 3.0,
  contrast_small: 4.5,
}, A.thresholds || {})

if (!DECK) { cliLog('GATE: FAIL — no deck path in GATE_ARGS'); }

/* ---------- the whole measurement, as one browser-side IIFE ---------- */
const MEASURE = (i) => String.raw`(() => {
const T = ${JSON.stringify(T)};
const SLIDE_I = ${i};
const W = 1920, H = 1080;

/* --- activate the slide we are measuring, freeze motion --- */
const slides = [...document.querySelectorAll('.slide')];
const slide = slides[SLIDE_I];
if (!slide) return { error: 'no such slide' };
if (window.__deck && window.__deck.gateOn) { window.__deck.gateOn(); window.__deck.go(SLIDE_I); }
else {
  document.body.setAttribute('data-gate', '');
  const st = document.querySelector('.deck-stage'); if (st) st.style.transform = 'none';
  slides.forEach((s, j) => s.classList.toggle('active', j === SLIDE_I));
}
slide.getBoundingClientRect();   // force layout

/* --- colour helpers ------------------------------------------------- */
const parse = (c) => {
  const m = /rgba?\(([^)]+)\)/.exec(c || '');
  if (!m) return null;
  const p = m[1].split(',').map(s => parseFloat(s));
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
};
const over = (fg, bg) => ({            // fg composited onto opaque bg
  r: fg.r * fg.a + bg.r * (1 - fg.a),
  g: fg.g * fg.a + bg.g * (1 - fg.a),
  b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1,
});
const lum = (c) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
};
const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]; return (hi + 0.05) / (lo + 0.05); };

/* effective background under an element: walk up, composite, and give
   up honestly if a gradient/image is in the way rather than guessing */
const bgOf = (el) => {
  const stack = [];
  let n = el;
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n);
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return { unknown: true };
    const c = parse(cs.backgroundColor);
    if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
    n = n.parentElement;
  }
  let base = { r: 255, g: 255, b: 255, a: 1 };
  for (let k = stack.length - 1; k >= 0; k--) base = over(stack[k], base);
  return base;
};

/* --- element census -------------------------------------------------- */
const hasOwnText = (el) => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length);
const MEDIA = new Set(['IMG', 'SVG', 'VIDEO', 'CANVAS', 'PICTURE']);
const path = (el) => {
  const bits = []; let n = el;
  while (n && n !== slide && bits.length < 4) {
    let s = n.tagName.toLowerCase();
    if (n.id) s += '#' + n.id;
    else if (n.classList.length) s += '.' + [...n.classList].slice(0, 2).join('.');
    bits.unshift(s); n = n.parentElement;
  }
  return bits.join(' > ');
};

const items = [];   // ink: carries information
const paint = [];   // ink + painted surfaces: carries the design
const clipped = []; // any element swallowing its own content
for (const el of slide.querySelectorAll('*')) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) continue;
  const r = el.getBoundingClientRect();
  if (r.width < 1 || r.height < 1) continue;

  const isText = hasOwnText(el);
  const isMedia = MEDIA.has(el.tagName);
  const bgc = parse(cs.backgroundColor);
  const painted = (bgc && bgc.a > 0.02) ||
                  (cs.backgroundImage && cs.backgroundImage !== 'none') ||
                  (parseFloat(cs.borderTopWidth) + parseFloat(cs.borderLeftWidth) > 0);

  const box = { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };

  /* Clipping is checked on EVERY element, not only on ink: the classic
     defect is a CARD with overflow:hidden swallowing the tail of its own
     copy. The card carries no text of its own, so an ink-only census
     would never look at it. */
  if (cs.overflow !== 'visible' &&
      (el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1)) {
    clipped.push({
      sel: path(el),
      by_px: Math.max(el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth),
      text: el.textContent.trim().slice(0, 60),
    });
  }

  if (isText || isMedia) {
    items.push({
      el, box, kind: isText ? 'text' : 'media', sel: path(el),
      fs: parseFloat(cs.fontSize) || 0,
      color: parse(cs.color),
      text: isText ? el.textContent.trim().slice(0, 60) : '',
    });
  }
  if (isText || isMedia || painted) paint.push(box);
}

/* ---------- audit_overlaps ------------------------------------------ */
const inter = (a, b) => {
  const w = Math.min(a.right, b.right) - Math.max(a.x, b.x);
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
};
const overlaps = [];
for (let i = 0; i < items.length; i++) {
  for (let j = i + 1; j < items.length; j++) {
    const A = items[i], B = items[j];
    if (A.el.contains(B.el) || B.el.contains(A.el)) continue;   // nesting is not overlap
    const ar = inter(A.box, B.box);
    if (ar < T.overlap_min_px2) continue;
    const small = Math.min(A.box.w * A.box.h, B.box.w * B.box.h);
    if (ar / small < T.overlap_min_frac) continue;
    overlaps.push({
      a: A.sel, b: B.sel, area_px2: Math.round(ar),
      frac_of_smaller: +(ar / small).toFixed(3),
      kinds: A.kind + '/' + B.kind,
      a_text: A.text, b_text: B.text,
    });
  }
}

/* ---------- audit_overflow ------------------------------------------ */
const isContainer = (el) => {
  if (el === slide) return true;
  const cs = getComputedStyle(el);
  const bgc = parse(cs.backgroundColor);
  return (bgc && bgc.a > 0.02) || cs.overflow !== 'visible' ||
         parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
};
const overflow = clipped.map(c => ({ kind: 'clipped', sel: c.sel, by_px: c.by_px, text: c.text }));
for (const it of items) {
  const b = it.box;
  if (b.x < -T.overflow_tol || b.y < -T.overflow_tol || b.right > W + T.overflow_tol || b.bottom > H + T.overflow_tol) {
    overflow.push({ sel: it.sel, kind: 'off-canvas', text: it.text,
      box: [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)] });
    continue;
  }
  let p = it.el.parentElement, host = null;
  while (p && p !== slide) { if (isContainer(p)) { host = p; break; } p = p.parentElement; }
  if (!host) continue;
  const hr = host.getBoundingClientRect();
  const hcs = getComputedStyle(host);
  const pad = {
    l: hr.x + parseFloat(hcs.borderLeftWidth), t: hr.y + parseFloat(hcs.borderTopWidth),
    r: hr.right - parseFloat(hcs.borderRightWidth), b: hr.bottom - parseFloat(hcs.borderBottomWidth),
  };
  const out = {
    bottom: +(b.bottom - pad.b).toFixed(1), right: +(b.right - pad.r).toFixed(1),
    top: +(pad.t - b.y).toFixed(1), left: +(pad.l - b.x).toFixed(1),
  };
  const worst = Object.entries(out).sort((x, y) => y[1] - x[1])[0];
  if (worst[1] > T.overflow_tol) {
    overflow.push({ sel: it.sel, kind: 'escapes-container', side: worst[0],
      by_px: worst[1], host: path(host), text: it.text });
  }
}

/* ---------- rasterise: ink grid + paint grid ------------------------ */
const C = T.cell, GW = Math.ceil(W / C), GH = Math.ceil(H / C);
const mark = (grid, boxes) => {
  for (const b of boxes) {
    const x0 = Math.max(0, Math.floor(b.x / C)), x1 = Math.min(GW - 1, Math.ceil(b.right / C) - 1);
    const y0 = Math.max(0, Math.floor(b.y / C)), y1 = Math.min(GH - 1, Math.ceil(b.bottom / C) - 1);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) grid[y * GW + x] = 1;
  }
};
const inkGrid = new Uint8Array(GW * GH), paintGrid = new Uint8Array(GW * GH);
mark(inkGrid, items.map(i => i.box));
mark(paintGrid, paint);

const bboxOf = (grid) => {
  let x0 = GW, y0 = GH, x1 = -1, y1 = -1;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (grid[y * GW + x]) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 };
};
const ink = bboxOf(inkGrid);

/* ---------- audit_deadspace: largest maximal empty rectangle --------
   inside the bounding box — margins are design, internal voids are the
   defect rule 1 describes. Classic histogram + stack, O(cells).

   Measured on BOTH grids, because they answer different questions and
   a real deck proved it: a bar chart's bars are PAINTED surfaces with
   no text, so the ink grid reads a full chart as 43 % empty. The
   verdict therefore follows the PAINT grid (what a reader sees as an
   empty area); the ink figure is reported beside it, because that one
   is what catches a small block floating in a big card. */
const largestEmpty = (grid, bb) => {
  if (!bb) return null;
  const bw = bb.x1 - bb.x0 + 1, bh = bb.y1 - bb.y0 + 1;
  const hgt = new Int32Array(bw);
  let best = { area: 0 };
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) hgt[x] = grid[(bb.y0 + y) * GW + (bb.x0 + x)] ? 0 : hgt[x] + 1;
    const st = [];
    for (let x = 0; x <= bw; x++) {
      const h = x === bw ? 0 : hgt[x];
      let start = x;
      while (st.length && st[st.length - 1].h >= h) {
        const top = st.pop();
        const area = top.h * (x - top.x);
        if (area > best.area) best = { area, x: top.x, y: y - top.h + 1, w: x - top.x, h: top.h };
        start = top.x;
      }
      st.push({ x: start, h });
    }
  }
  return {
    frac: +(best.area / (bw * bh)).toFixed(3),
    rect_px: best.area ? [(bb.x0 + best.x) * C, (bb.y0 + best.y) * C, best.w * C, best.h * C] : null,
  };
};
const deadPaint = largestEmpty(paintGrid, bboxOf(paintGrid));
const deadInk = largestEmpty(inkGrid, ink);
const dead = deadPaint ? { ...deadPaint, ink_frac: deadInk ? deadInk.frac : null } : null;

/* ---------- occupancy, margins, symmetry, vbalance ------------------ */
let occ = 0; for (let k = 0; k < paintGrid.length; k++) occ += paintGrid[k];
let sx = 0, sy = 0, n = 0;
for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (inkGrid[y * GW + x]) { sx += x + .5; sy += y + .5; n++; }

const m = ink ? {
  left: ink.x0 * C,
  right: W - (ink.x1 + 1) * C,
  top: ink.y0 * C,
  bottom: H - (ink.y1 + 1) * C,
} : null;

return {
  index: SLIDE_I,
  counts: { ink: items.length, painted: paint.length },
  audit_overlaps: overlaps,
  audit_overflow: overflow,
  audit_deadspace: dead,
  audit_vbalance: m ? { top_px: m.top, bottom_px: m.bottom, delta_px: Math.abs(m.top - m.bottom) } : null,
  space: {
    occupancy: +(occ / (GW * GH)).toFixed(3),
    margins_px: m,
    hsym_delta_px: m ? Math.abs(m.left - m.right) : null,
    ink_center_off_px: n ? {
      x: Math.round(sx / n * C - W / 2), y: Math.round(sy / n * C - H / 2),
    } : null,
  },
  text: items.filter(i => i.kind === 'text').map(i => {
    const bg = bgOf(i.el);
    const fg = i.color ? (i.color.a < 1 && !bg.unknown ? over(i.color, bg) : i.color) : null;
    return {
      sel: i.sel, fs: +i.fs.toFixed(1), text: i.text,
      contrast: (bg.unknown || !fg) ? null : +ratio(fg, bg).toFixed(2),
    };
  }),
};
})()`

/* ---------- driver --------------------------------------------------- */
const task = await useOrCreateTaskSpace('deck geometry gate')
await openOrReuseTab('file://' + DECK, { wait: true, timeout: 30 })
await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await wait(0.4)

const n = await js(String.raw`document.querySelectorAll('.slide').length`)
if (!n) { cliLog('GATE: FAIL — no .slide found in ' + DECK) }

const want = A.slides && A.slides.length ? A.slides.map(x => x - 1) : [...Array(n).keys()]
const report = { deck: DECK, slide_count: n, thresholds: T, slides: [] }
let hard = 0, soft = 0
const lines = []

for (const i of want) {
  const r = await js(MEASURE(i))
  if (!r || r.error) { cliLog(`slide ${i + 1}: ${r && r.error}`); continue }

  const H = [], S = []
  for (const o of r.audit_overlaps) {
    (o.kinds === 'text/text' && o.frac_of_smaller < 0.12 ? S : H)
      .push(`overlap ${o.kinds} ${o.area_px2}px² (${Math.round(o.frac_of_smaller * 100)}% of smaller) — ${o.a} × ${o.b}`)
  }
  for (const o of r.audit_overflow) {
    if (o.kind === 'escapes-container') H.push(`overflow ${o.sel} escapes ${o.host} by ${o.by_px}px (${o.side}) — "${o.text}"`)
    else if (o.kind === 'clipped') H.push(`overflow ${o.sel} clips its own content by ${o.by_px}px — "${o.text}"`)
    else H.push(`overflow ${o.kind}: ${o.sel} — "${o.text}"`)
  }
  /* Dead space and vertical balance are the two metrics that encode TASTE:
     a corner-anchored cover is mostly void ON PURPOSE. They are always
     measured and always reported, but they gate only under --strict —
     they earn a look at the render, they do not block on their own. */
  if (r.audit_deadspace && r.audit_deadspace.frac >= T.deadspace_soft) {
    const msg = `dead space ${Math.round(r.audit_deadspace.frac * 100)}% of the painted area`
      + (r.audit_deadspace.ink_frac !== null ? ` (${Math.round(r.audit_deadspace.ink_frac * 100)}% of the ink area)` : '')
      + ` at [${r.audit_deadspace.rect_px}]`
    ;(STRICT && r.audit_deadspace.frac >= T.deadspace_hard ? H : S).push(msg)
  }
  if (r.audit_vbalance && r.audit_vbalance.delta_px >= T.vbalance_soft) {
    const v = r.audit_vbalance
    ;(STRICT && v.delta_px >= T.vbalance_hard ? H : S)
      .push(`vbalance top ${v.top_px}px vs bottom ${v.bottom_px}px — delta ${v.delta_px}px`)
  }
  for (const t of r.text) {
    if (t.fs < T.floor_hard) H.push(`type ${t.fs}px < ${T.floor_hard} floor — ${t.sel} "${t.text}"`)
    else if (t.fs < T.floor_soft) S.push(`type ${t.fs}px < ${T.floor_soft} body floor (ok if a real kicker) — ${t.sel} "${t.text}"`)
    if (t.contrast !== null) {
      const need = t.fs >= T.large_text ? T.contrast_large : T.contrast_small
      if (t.contrast < need) H.push(`contrast ${t.contrast}:1 < ${need}:1 at ${t.fs}px — ${t.sel} "${t.text}"`)
    }
  }

  hard += H.length; soft += S.length
  report.slides.push({ ...r, verdict: { hard: H, soft: S } })
  lines.push(`slide ${String(i + 1).padStart(2)} · ${H.length ? '✗ ' + H.length + ' hard' : '✓'}${S.length ? ' · ' + S.length + ' soft' : ''}` +
    (r.space.margins_px ? ` · occ ${Math.round(r.space.occupancy * 100)}% · dead ${Math.round((r.audit_deadspace?.frac || 0) * 100)}%` : ''))
  for (const h of H) lines.push('        HARD  ' + h)
  for (const s of S) lines.push('        soft  ' + s)
}

report.summary = { hard, soft, slides_measured: report.slides.length }
const fs = await import('node:fs')
fs.writeFileSync(OUT, JSON.stringify(report, null, 1))

cliLog(lines.join('\n'))
cliLog(`\nreport: ${OUT}`)
cliLog(`GATE: ${hard ? 'FAIL' : 'PASS'} — ${hard} hard, ${soft} soft, ${report.slides.length} slides`)

await completeTaskSpace(task.id, { keep: false })
