/* deck-builder — L7: vector PDF export.
   Runs inside `ego-browser nodejs` (see export-pdf.sh).

   Page.printToPDF prints the deck's @media print rules: one 1920×1080 slide
   per page, TEXT STAYS TEXT (selectable, searchable, a few hundred KB).
   Do not "export" a deck by stacking full-page screenshots — that is how the
   source repo shipped ~20 MB for 18 slides, with dead text. */

const A = globalThis.PDF_ARGS || {}
const DECK = A.deck, OUT = A.out || '/tmp/deck.pdf'

const task = await useOrCreateTaskSpace('deck pdf export')
await openOrReuseTab('file://' + DECK, { wait: true, timeout: 30 })
await cdp('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
await wait(0.6)

// 1920×1080 css px at 96 dpi = 20in × 11.25in. Motion frozen so no slide is
// captured mid-transition; print CSS already un-hides every slide.
await js(String.raw`(() => { document.body.setAttribute('data-gate',''); return 1 })()`)

const r = await cdp('Page.printToPDF', {
  landscape: false,
  printBackground: true,
  paperWidth: 20,
  paperHeight: 11.25,
  marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0,
  preferCSSPageSize: false,
  transferMode: 'ReturnAsBase64',
})

const fs = await import('node:fs')
fs.writeFileSync(OUT, Buffer.from(r.data, 'base64'))
const kb = Math.round(fs.statSync(OUT).size / 1024)
cliLog(`PDF: ${OUT} — ${kb} KB`)

await completeTaskSpace(task.id, { keep: false })
