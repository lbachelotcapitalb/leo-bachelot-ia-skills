#!/usr/bin/env node
// ───────────────────────────────────────────────────────────────
// build-page.mjs — assemble la page HTML de revue (skill review-contrib, §6.5)
//
// Pourquoi un script : les captures pèsent lourd une fois en base64. Éditer un
// fichier qui en contient 2 Mo est impraticable — on écrit donc un TEMPLATE avec
// des marqueurs `__IMG_xx__`, et on reconstruit après chaque retouche de texte.
//
//   1. cp references/page-revue.template.html <travail>/revue.template.html
//   2. remplir le template (le contenu, pas le CSS) ; garder les marqueurs __IMG_xx__
//   3. node build-page.mjs <dossier-captures> <template.html> <sortie.html>
//
// Les captures sont appariées par ORDRE ALPHABÉTIQUE de nom de fichier :
// 01-xxx.png → __IMG_01__, 02-yyy.png → __IMG_02__… d'où le préfixe numérique.
// Les PNG sont convertis en JPEG (sips, macOS) : ~4× plus léger, invisible à l'œil.
// ───────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, basename, extname } from 'node:path';
import { tmpdir } from 'node:os';

const [dirShots, tpl, out] = process.argv.slice(2);
if (!dirShots || !tpl || !out) {
  console.error('usage: build-page.mjs <dossier-captures> <template.html> <sortie.html>');
  process.exit(1);
}

const LARGEUR = 1240;   // au-delà, on paie des octets que personne ne voit
const QUALITE = 78;

const tmp = mkdtempSync(join(tmpdir(), 'revue-'));
const fichiers = readdirSync(dirShots)
  .filter((f) => /\.(png|jpe?g)$/i.test(f))
  .sort();

if (!fichiers.length) { console.error(`aucune capture dans ${dirShots}`); process.exit(1); }

let html = readFileSync(tpl, 'utf8');
const rapport = [];

fichiers.forEach((f, i) => {
  const marqueur = `__IMG_${String(i + 1).padStart(2, '0')}__`;
  if (!html.includes(marqueur)) { rapport.push(`~ ${f} → ${marqueur} absent du template (ignorée)`); return; }

  let src = join(dirShots, f);
  if (extname(f).toLowerCase() === '.png') {
    const jpg = join(tmp, basename(f, extname(f)) + '.jpg');
    // sips est livré avec macOS : pas de dépendance à installer pour une revue ponctuelle.
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', String(QUALITE),
      '--resampleWidth', String(LARGEUR), src, '--out', jpg], { stdio: 'ignore' });
    src = jpg;
  }
  const uri = 'data:image/jpeg;base64,' + readFileSync(src).toString('base64');
  html = html.split(marqueur).join(uri);
  rapport.push(`✓ ${f} → ${marqueur}  (${(statSync(src).size / 1024).toFixed(0)} ko)`);
});

// Un marqueur oublié laisse une image cassée dans un document qu'on va donner à
// On le signale fort plutôt que de le laisser passer.
const restants = [...new Set(html.match(/__IMG_\d+__/g) || [])];
const placeholders = [...new Set(html.match(/__[A-ZÉÈÀÇ_]{3,}__/g) || [])].filter((p) => !/^__IMG_/.test(p));

writeFileSync(out, html);
console.log(rapport.join('\n'));
console.log(`\n→ ${out}  (${(statSync(out).size / 1048576).toFixed(2)} Mo)`);
if (restants.length) console.log(`\n⚠ marqueurs d'image NON substitués : ${restants.join(', ')}`);
if (placeholders.length) console.log(`⚠ texte encore à remplir : ${placeholders.slice(0, 12).join(', ')}${placeholders.length > 12 ? '…' : ''}`);
if (!restants.length && !placeholders.length) console.log('\nAucun marqueur résiduel. Reste à VÉRIFIER LE RENDU dans un navigateur.');
