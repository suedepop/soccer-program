#!/usr/bin/env node
/**
 * Measures the average glyph advance of each ad font, as a fraction of the em.
 *
 *   node scripts/measure-fonts.mjs
 *
 * src/lib/fit.ts sizes text by counting characters rather than measuring it, so
 * that the browser preview and the headless-Chrome print render always agree.
 * That trick only works if the per-family constant it divides by is accurate —
 * Bebas Neue fits far more characters per line than Montserrat. Run this after
 * changing the font list and paste the numbers into FONTS in src/lib/fonts.ts.
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FONT_DIR = path.join(ROOT, 'public', 'fonts');

/**
 * [id, css family, upright file, italic file, [axis min, axis max], heading weight]
 *
 * The heading weight is the one FONTS actually draws names at, not the family's
 * axis maximum. They are usually the same but not always — Smooch Sans is drawn
 * at 740 of a 900 axis — and headingGlyph has to be measured at the weight that
 * will really be rendered or fit.ts sizes every name in that family wrongly.
 */
const FAMILIES = [
  ['google-sans-flex', 'Google Sans Flex', 'google-sans-flex.woff2', null, [1, 1000], 900],
  ['roboto', 'Roboto', 'roboto.woff2', null, [100, 900], 900],
  ['inter', 'Inter', 'inter.woff2', null, [100, 900], 900],
  ['roboto-condensed', 'Roboto Condensed', 'roboto-condensed.woff2', null, [100, 900], 900],
  ['raleway', 'Raleway', 'raleway.woff2', null, [100, 900], 900],
  ['rubik', 'Rubik', 'rubik.woff2', null, [300, 900], 900],
  ['outfit', 'Outfit', 'outfit.woff2', null, [100, 900], 900],
  ['smooch-sans', 'Smooch Sans', 'smooch-sans.woff2', null, [100, 900], 740],
  ['libre-baskerville', 'Libre Baskerville', 'libre-baskerville.woff2', null, [400, 700], 700],
  ['orbitron', 'Orbitron', 'orbitron.woff2', null, [400, 900], 900],
  ['noto-sans-display', 'Noto Sans Display', 'noto-sans-display.woff2', null, [100, 900], 800],
  ['antonio', 'Antonio', 'antonio.woff2', null, [100, 700], 700],
  ['strichpunkt-sans', 'Strichpunkt Sans', 'strichpunkt-sans.woff2', null, [400, 900], 740],
  ['doto', 'Doto', 'doto.woff2', null, [100, 900], 900],
  ['big-shoulders-stencil', 'Big Shoulders Stencil', 'big-shoulders-stencil.woff2', null, [100, 900], 800],
  ['inter-tight', 'Inter Tight', 'inter-tight.woff2', null, [100, 900], 800],
  ['cinzel', 'Cinzel', 'cinzel.woff2', null, [400, 900], 900],
  ['big-shoulders-inline', 'Big Shoulders Inline', 'big-shoulders-inline.woff2', null, [100, 900], 900],
  ['jaro', 'Jaro', 'jaro.woff2', null, [400, 400], 400],
  ['bebas', 'Bebas Neue', 'bebas.woff2', null, [400, 400], 400],
  ['montserrat', 'Montserrat', 'montserrat.woff2', 'montserrat-italic.woff2', [100, 900], 900],
  ['playfair', 'Playfair Display', 'playfair.woff2', 'playfair-italic.woff2', [400, 900], 900],
  ['dancing', 'Dancing Script', 'dancing.woff2', null, [400, 700], 700],
  ['nunito', 'Nunito', 'nunito.woff2', 'nunito-italic.woff2', [200, 1000], 1000],
  ['lora', 'Lora', 'lora.woff2', 'lora-italic.woff2', [400, 700], 700],
  ['special-elite', 'Special Elite', 'special-elite.woff2', null, [400, 400], 400],
];

/**
 * Families whose advance width does not change with weight, by design.
 *
 * The pinned-weight check below assumes a heavier weight draws wider, which is
 * true of every proportional face here. Doto is a dot matrix on a fixed grid:
 * weight controls how fat each dot is, not how far the pen moves, so 100 and
 * 900 measure identically while looking nothing alike. Verified by rendering
 * it and counting ink — 0.9% of pixels at weight 100 against 14.1% at 900.
 */
const FIXED_ADVANCE = new Set(['doto']);

// Representative of what parents actually write.
const SAMPLE =
  'Kylie, we have loved watching you play over the years and can’t wait to see ' +
  'what the future holds. Keep smiling on and off the field, you are a joy to watch.';
const SIZE = 100;

// Served over HTTP from a throwaway server: Chrome treats webfonts as
// CORS-restricted, so neither about:blank (setContent) nor file:// will load
// them — every family would silently measure as the same fallback face.
const faces = FAMILIES.flatMap(([, family, file, italic, [min, max]]) => [
  `@font-face { font-family: '${family}'; font-weight: ${min} ${max}; font-style: normal; src: url('${file}'); }`,
  italic
    ? `@font-face { font-family: '${family}'; font-weight: ${min} ${max}; font-style: italic; src: url('${italic}'); }`
    : '',
]).join('\n');

const html = `<!doctype html><meta charset="utf-8"><style>
${faces}
body { margin: 0; }
span { font-size: ${SIZE}px; white-space: pre; display: inline-block; }
</style><div id="host"></div>`;

const server = http.createServer(async (req, res) => {
  const name = decodeURIComponent((req.url ?? '/').split('?')[0].replace(/^\//, ''));
  if (!name || name === 'index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    return;
  }
  try {
    const body = await fs.readFile(path.join(FONT_DIR, path.basename(name)));
    res.writeHead(200, { 'Content-Type': 'font/woff2' }).end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const { port } = server.address();

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });

const rows = await page.evaluate(
  async (families, sample, size) => {
    // fonts.ready only waits for faces already in use, and nothing has used
    // these yet — so ask for each one explicitly and wait for it to arrive.
    for (const [, family, , , , headingWeight] of families) {
      await Promise.all(
        [400, 700, headingWeight].map((w) =>
          document.fonts.load(`${w} ${size}px '${family}'`)
        )
      ).catch(() => {});
    }
    await document.fonts.ready;

    const host = document.getElementById('host');
    const out = [];
    for (const [id, family, , , [axisMin, axisMax], headingWeight] of families) {
      const measure = (weight) => {
        const el = document.createElement('span');
        el.style.fontFamily = `'${family}'`;
        el.style.fontWeight = String(weight);
        el.textContent = sample;
        host.appendChild(el);
        const w = el.getBoundingClientRect().width;
        el.remove();
        return w;
      };
      const normal = measure(400);
      const bold = measure(700);
      const heading = measure(headingWeight);
      out.push({
        id,
        family,
        headingWeight,
        // False means the @font-face never loaded and this row is measuring
        // a fallback face — the numbers would be worthless.
        loaded: document.fonts.check(`400 100px '${family}'`),
        avgGlyph: normal / (sample.length * size),
        boldRatio: bold / normal,
        headingGlyph: heading / (sample.length * size),
        // A real axis makes the heading weight wider than 400. If they match
        // when they should not, the file is pinned and the weight does nothing.
        // Families with no axis, or drawn at 400 on purpose, are exempt.
        headingIsReal:
          headingWeight === 400 || axisMin === axisMax || Math.abs(heading - normal) > 0.5,
      });
    }
    return out;
  },
  FAMILIES,
  SAMPLE,
  SIZE
);

await browser.close();
server.close();

console.log('id                       avgGlyph  boldRatio  headWt  headingGlyph  loaded  weight-is-real');
for (const r of rows) {
  console.log(
    [
      r.id.padEnd(24),
      r.avgGlyph.toFixed(3).padStart(8),
      r.boldRatio.toFixed(3).padStart(10),
      String(r.headingWeight).padStart(7),
      r.headingGlyph.toFixed(3).padStart(13),
      (r.loaded ? 'yes' : 'NO!').padStart(8),
      (r.headingIsReal ? 'yes' : 'NO — pinned!').padStart(15),
    ].join('')
  );
}

if (rows.some((r) => !r.loaded)) {
  console.error('\nSome faces fell back to a system font.');
  process.exit(1);
}
const pinned = rows.filter((r) => !r.headingIsReal && !FIXED_ADVANCE.has(r.id));
if (pinned.length) {
  console.error(
    '\nSome families ignore their heading weight — check the @font-face ranges: ' +
      pinned.map((r) => r.id).join(', ')
  );
  process.exit(1);
}
for (const r of rows) {
  if (!r.headingIsReal) {
    console.log(`\n${r.id}: same advance at every weight, expected for a fixed-grid face.`);
  }
}

const distinct = new Set(rows.map((r) => r.avgGlyph.toFixed(4))).size;
if (distinct < rows.length / 2) {
  console.error('\nToo many identical widths — the fonts are not loading.');
  process.exit(1);
}
