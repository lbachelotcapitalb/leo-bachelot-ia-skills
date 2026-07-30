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
  floor_kicker: 26,      // px, canvas — kicker / eyebrow (capitales, interlettrage)
  large_text: 56,        // px, canvas — above this, WCAG "large"
  contrast_large: 3.0,
  contrast_small: 4.5,
  occupancy_min: 0,       // 0 = off. Un benchmark le règle (assets/benchmarks/).
  card_void_soft: 0.22,   // plus grand vide dans une vignette / aire de la vignette
  card_void_hard: 0.30,   // au-delà : défaut dur (« jamais de gros vide dans une vignette »)
  margin_tol: 6,          // px d'encre toleres dans la marge de la slide
  card_void_min_frac: 0.35, // un vide doit faire >=35% de la LARGEUR et de la HAUTEUR
  justify_min_cpl: 45,      // caracteres par ligne sous lesquels justifier est perdu d'avance
  justify_ratio_soft: 1.8,  // pire espace inter-mot / mediane
  justify_ratio_hard: 2.5,  // au-dela : rivieres, abandonner justify
  center_tol: 12,           // px d'ecart tolere entre les deux cotes
  center_fullwidth_frac: 0.92, // au-dela, le bloc occupe sa colonne : rien a centrer
  underuse_min_col: 1200,   // on ne juge la largeur perdue que dans une colonne large
  underuse_frac: 0.85,      // sous ce taux d'occupation de la colonne : bride sans raison
  card_min_px2: 90000,    // en dessous, c'est une pastille, pas une vignette
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

/* THE INK OF A TEXT ELEMENT IS ITS LINES, NOT ITS BOX.
   A <p> placed in a 1fr grid row is stretched to the full row height:
   its box fills the void the eye plainly sees, and every measurement
   built on that box reports a full card. Range.getClientRects() returns
   the real line boxes, so a 3-line paragraph in a 300 px slot measures
   3 lines. Same fix makes overlaps honest: a stretched box no longer
   collides with its neighbour on empty air. */
const lineRects = (el) => {
  const out = [];
  const rg = document.createRange();
  rg.selectNodeContents(el);
  for (const r of rg.getClientRects()) {
    if (r.width > 0.5 && r.height > 0.5) {
      out.push({ x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom });
    }
  }
  return out;
};
const union = (rs) => rs.reduce((a, r) => a ? {
  x: Math.min(a.x, r.x), y: Math.min(a.y, r.y),
  right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom),
} : { x: r.x, y: r.y, right: r.right, bottom: r.bottom }, null);
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
    const lines = isText ? lineRects(el) : [box];
    if (!lines.length) continue;
    const u = union(lines);
    items.push({
      el, kind: isText ? 'text' : 'media', sel: path(el),
      box: { ...u, w: u.right - u.x, h: u.bottom - u.y },
      lines,                                   // real line boxes, for the raster
      fs: parseFloat(cs.fontSize) || 0,
      color: parse(cs.color),
      text: isText ? el.textContent.trim().slice(0, 60) : '',
      elBox: box,
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
const scs = getComputedStyle(slide);
const safe = {
  l: parseFloat(scs.paddingLeft), t: parseFloat(scs.paddingTop),
  r: W - parseFloat(scs.paddingRight), b: H - parseFloat(scs.paddingBottom),
};
for (const it of items) {
  const er = it.el.getBoundingClientRect();
  const b = { x: er.x, y: er.y, right: er.right, bottom: er.bottom, w: er.width, h: er.height };
  if (b.x < -T.overflow_tol || b.y < -T.overflow_tol || b.right > W + T.overflow_tol || b.bottom > H + T.overflow_tol) {
    overflow.push({ sel: it.sel, kind: 'off-canvas', text: it.text,
      box: [Math.round(b.x), Math.round(b.y), Math.round(b.w), Math.round(b.h)] });
    continue;
  }
  const marg = Math.max(b.bottom - safe.b, safe.t - b.y, b.right - safe.r, safe.l - b.x);
  if (marg > T.margin_tol) {
    overflow.push({ sel: it.sel, kind: 'in-slide-margin', by_px: +marg.toFixed(1), text: it.text });
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
mark(inkGrid, items.flatMap(i => i.lines));
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

/* ---------- audit_card_voids ----------------------------------------
   « Jamais de gros vide dans une vignette » (Léo, 30/07). A card is
   sized BY ITS TEXT, not by the container it sits in — a card stretched
   to fill a band and left half empty is a defect, and it is the one the
   slide-level dead space misses: at slide scale the card reads as a
   full painted surface. So each card is re-rasterised on its own ink
   and measured against its OWN area. */
const cardVoids = [];
for (const el of slide.querySelectorAll('*')) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') continue;
  const bgc = parse(cs.backgroundColor);
  const isCard = (bgc && bgc.a > 0.02) || parseFloat(cs.borderTopWidth) > 0;
  if (!isCard) continue;
  const r = el.getBoundingClientRect();
  if (r.width * r.height < T.card_min_px2) continue;      // pills, chips, rules: not cards
  const inside = items.filter(i => el.contains(i.el) && i.el !== el);
  if (inside.length < 2) continue;                        // a plain banner is not a card
  const bb = {
    x0: Math.max(0, Math.floor(r.x / C)), y0: Math.max(0, Math.floor(r.y / C)),
    x1: Math.min(GW - 1, Math.ceil(r.right / C) - 1), y1: Math.min(GH - 1, Math.ceil(r.bottom / C) - 1),
  };
  if (bb.x1 <= bb.x0 || bb.y1 <= bb.y0) continue;
  const g = new Uint8Array(GW * GH);
  mark(g, inside.flatMap(i => i.lines.map(l => ({
    x: i.elBox.x, right: i.elBox.right, y: l.y, bottom: l.bottom }))));
  const v = largestEmpty(g, bb);
  const cw = (bb.x1 - bb.x0 + 1) * C, ch = (bb.y1 - bb.y0 + 1) * C;
  const twoD = v && v.rect_px &&
    v.rect_px[2] >= cw * T.card_void_min_frac && v.rect_px[3] >= ch * T.card_void_min_frac;
  if (v && twoD && v.frac >= T.card_void_soft) {
    cardVoids.push({ sel: path(el), frac: v.frac, rect_px: v.rect_px,
      card_px: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] });
  }
}

/* ---------- audit_justification --------------------------------------
   Le texte d'une vignette arbitre un compromis a plusieurs entrees :
   forme justifiee / espaces inter-mots qui ne se creusent pas /
   equidistance des lignes / meme taille d'une vignette a l'autre.
   La justification n'est legitime que si elle ne creuse pas de
   rivieres. On mesure la largeur de CHAQUE espace inter-mot : si le
   pire s'ecarte trop de la mediane, il faut deplacer le compromis
   (changer la taille, ou abandonner justify). La derniere ligne est
   exclue : elle est en drapeau par construction. */
const justify = [];
for (const it of items) {
  if (it.kind !== 'text') continue;
  if (getComputedStyle(it.el).textAlign !== 'justify') continue;
  const ws = [];
  for (const n of it.el.childNodes) {
    if (n.nodeType !== 3) continue;
    const t = n.textContent;
    for (let i = 0; i < t.length; i++) {
      if (t[i] !== ' ') continue;
      const rg = document.createRange();
      rg.setStart(n, i); rg.setEnd(n, i + 1);
      const rc = [...rg.getClientRects()].filter(r => r.width > 0.1);
      if (rc.length === 1) ws.push({ w: rc[0].width, y: Math.round(rc[0].y) });
    }
  }
  if (ws.length < 3) continue;
  const lines = [...new Set(ws.map(s => s.y))].sort((a, b) => a - b);
  const kept = ws.filter(s => s.y !== lines[lines.length - 1]).map(s => s.w).sort((a, b) => a - b);
  if (kept.length < 3) continue;
  const med = kept[Math.floor(kept.length / 2)];
  const max = kept[kept.length - 1];
  const chars = it.el.textContent.trim().length;
  justify.push({
    sel: it.sel, fs: +it.fs.toFixed(1), lines: lines.length,
    chars_per_line: Math.round(chars / lines.length),
    measure_px: Math.round(it.el.getBoundingClientRect().width),
    space_median_px: +med.toFixed(1), space_max_px: +max.toFixed(1),
    ratio: +(max / med).toFixed(2), text: it.text,
  });
}

/* ---------- audit_group_symmetry -------------------------------------
   « meme taille si elles font partie d'un meme groupe ». Dans une
   rangee de vignettes soeurs : meme boite, et un meme role (meme
   classe) porte la MEME taille de police partout. Une taille qui varie
   d'une vignette a l'autre casse la symetrie du groupe. */
const symmetry = [];
for (const row of slide.querySelectorAll('*')) {
  const kids = [...row.children].filter(k => {
    const cs = getComputedStyle(k);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const c = parse(cs.backgroundColor);
    return (c && c.a > 0.02) || parseFloat(cs.borderTopWidth) > 0;
  });
  if (kids.length < 2) continue;
  const boxes = kids.map(k => k.getBoundingClientRect());
  if (boxes.some(b => b.width * b.height < T.card_min_px2)) continue;
  const dims = [...new Set(boxes.map(b => Math.round(b.width) + 'x' + Math.round(b.height)))];
  if (dims.length > 1) symmetry.push({ group: path(row), role: 'taille de la vignette', values: dims });
  const byRole = {};
  for (const k of kids) {
    for (const el of k.querySelectorAll('*')) {
      if (!hasOwnText(el)) continue;
      const role = (el.className && String(el.className).trim()) || el.tagName.toLowerCase();
      const fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
      (byRole[role] = byRole[role] || []).push(fs);
    }
  }
  for (const [role, sizes] of Object.entries(byRole)) {
    const uniq = [...new Set(sizes)];
    if (uniq.length > 1) symmetry.push({ group: path(row), role, values: uniq.map(String) });
  }
}

/* ---------- audit_card_centering -------------------------------------
   « Les elements dans les vignettes doivent toujours etre centres, meme
   ecart des deux cotes, par controle maths. Sauf la numerotation, qui
   peut etre au milieu ou a une extremite. » (Leo, 30/07)
   Pour chaque vignette : on prend sa boite de CONTENU (padding deduit)
   et, pour chaque element d'encre, l'ecart a gauche et l'ecart a droite.
   Trois etats acceptes : pleine largeur (le bloc occupe sa colonne),
   centre (les deux ecarts se valent), ou exempte (numerotation, repere
   par une classe contenant « num » ou « n »). Tout le reste est un
   element pose d'un cote, et c'est un defaut. */
const centering = [];
for (const el of slide.querySelectorAll('*')) {
  const cs = getComputedStyle(el);
  if (cs.display === 'none' || cs.visibility === 'hidden') continue;
  const bgc = parse(cs.backgroundColor);
  if (!((bgc && bgc.a > 0.02) || parseFloat(cs.borderTopWidth) > 0)) continue;
  const r = el.getBoundingClientRect();
  if (r.width * r.height < T.card_min_px2) continue;
  const inside = items.filter(i => el.contains(i.el) && i.el !== el);
  if (inside.length < 2) continue;
  const cl = r.x + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
  const cr = r.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
  const cwid = cr - cl;
  if (cwid <= 0) continue;
  for (const it of inside) {
    if (getComputedStyle(it.el).display === 'inline') continue;      // inline dans une phrase
    const cls = String(it.el.className || '').toLowerCase();
    if (/num|chiffre|stat|hero|gain/.test(cls)) continue;             // numerotation : exemptee
    const u = union(it.lines);
    if (!u) continue;
    const gl = u.x - cl, gr = cr - u.right;
    if ((u.right - u.x) >= cwid * T.center_fullwidth_frac) continue; // occupe sa colonne
    if (Math.abs(gl - gr) <= T.center_tol) continue;                 // centre
    centering.push({ card: path(el), sel: it.sel,
      left_px: Math.round(gl), right_px: Math.round(gr),
      delta_px: Math.round(Math.abs(gl - gr)), text: it.text });
  }
}

/* ---------- audit_measure_underuse -----------------------------------
   « Le paragraphe s'arrete trop tot vers la droite, ca n'a pas de sens,
   il peut s'etendre davantage. » Un bloc de texte qui se plie sur
   plusieurs lignes alors que sa colonne est large gaspille la largeur :
   il a ete bride (max-width, width en dur) sans raison de lecture. On ne
   regarde que les colonnes vraiment larges, pour ne pas confondre avec
   une vignette etroite, qui est un choix de grille. */
const underuse = [];
for (const it of items) {
  if (it.kind !== 'text' || it.lines.length < 2) continue;
  const par = it.el.parentElement;
  if (!par) continue;
  const pcs = getComputedStyle(par);
  const pr = par.getBoundingClientRect();
  const avail = pr.width - parseFloat(pcs.paddingLeft) - parseFloat(pcs.paddingRight);
  if (avail < T.underuse_min_col) continue;
  const me = it.el.getBoundingClientRect();
  const sideBySide = [...par.children].some(sib => {
    if (sib === it.el) return false;
    const b = sib.getBoundingClientRect();
    if (b.width < 1 || b.height < 1) return false;
    const vOverlap = Math.min(me.bottom, b.bottom) - Math.max(me.y, b.y) > 4;
    const hDisjoint = b.right <= me.x + 4 || b.x >= me.right - 4;
    return vOverlap && hDisjoint;
  });
  if (sideBySide) continue;                 // la bande est partagee : rien de perdu
  const w = me.width;
  if (w >= avail * T.underuse_frac) continue;
  underuse.push({ sel: it.sel, width_px: Math.round(w), avail_px: Math.round(avail),
    used_pct: Math.round(w / avail * 100), lines: it.lines.length, text: it.text });
}

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
  audit_card_voids: cardVoids,
  audit_justification: justify,
  audit_group_symmetry: symmetry,
  audit_card_centering: centering,
  audit_measure_underuse: underuse,
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
    const ics = getComputedStyle(i.el);
    const ls = parseFloat(ics.letterSpacing);
    const kicker = ics.textTransform === 'uppercase' || (ls > 0 && ls >= i.fs * 0.04);
    const bg = bgOf(i.el);
    const fg = i.color ? (i.color.a < 1 && !bg.unknown ? over(i.color, bg) : i.color) : null;
    return {
      sel: i.sel, fs: +i.fs.toFixed(1), text: i.text, kicker,
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
    else if (o.kind === 'in-slide-margin') H.push(`overflow ${o.sel} entre de ${o.by_px}px dans la marge de la slide — "${o.text}"`)
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
  for (const v of (r.audit_card_voids || [])) {
    const msg = `vignette vide à ${Math.round(v.frac * 100)}% — ${v.sel} (vide [${v.rect_px}] dans une carte de ${v.card_px[2]}×${v.card_px[3]})`
    ;(v.frac >= T.card_void_hard ? H : S).push(msg)
  }
  for (const j of (r.audit_justification || [])) {
    if (j.ratio < T.justify_ratio_soft) continue
    const why = j.chars_per_line < T.justify_min_cpl
      ? ` — mesure trop étroite : ${j.chars_per_line} car./ligne sur ${j.measure_px}px (il en faut ≥${T.justify_min_cpl}). Élargir la colonne, ou passer en drapeau.`
      : ''
    const msg = `justification : espace inter-mot ×${j.ratio} (médiane ${j.space_median_px}px, pire ${j.space_max_px}px) à ${j.fs}px${why} — ${j.sel}`
    ;(j.ratio >= T.justify_ratio_hard ? H : S).push(msg)
  }
  for (const c of (r.audit_card_centering || [])) {
    H.push(`centrage vignette : ${c.sel} pose d'un cote — ${c.left_px}px a gauche vs ${c.right_px}px a droite (ecart ${c.delta_px}px) dans ${c.card} — "${c.text}"`)
  }
  for (const u of (r.audit_measure_underuse || [])) {
    H.push(`largeur perdue : ${u.sel} n'occupe que ${u.used_pct}% de sa colonne (${u.width_px}px sur ${u.avail_px}px) et se plie sur ${u.lines} lignes — "${u.text}"`)
  }
  for (const y of (r.audit_group_symmetry || [])) {
    H.push(`symétrie de groupe : « ${y.role} » varie dans ${y.group} → ${y.values.join(' / ')}`)
  }
  if (T.occupancy_min && r.space.occupancy < T.occupancy_min) {
    S.push(`occupation ${Math.round(r.space.occupancy * 100)}% < ${Math.round(T.occupancy_min * 100)}% attendu par le benchmark`)
  }
  for (const t of r.text) {
    const floor = t.kicker ? T.floor_kicker : T.floor_soft
    if (t.fs < T.floor_hard) H.push(`type ${t.fs}px < ${T.floor_hard} plancher absolu — ${t.sel} "${t.text}"`)
    else if (t.fs < floor) S.push(`type ${t.fs}px < ${floor} plancher ${t.kicker ? 'kicker' : 'de corps'} — ${t.sel} "${t.text}"`)
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
