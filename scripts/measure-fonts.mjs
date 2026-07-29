#!/usr/bin/env node
/**
 * Measures the average glyph advance of each ad font, as a fraction of the em.
 *
 *   node scripts/measure-fonts.mjs
 *
 * src/lib/fit.ts sizes text by counting characters rather than measuring it, so
 * that the browser preview and the headless-Chrome print render always agree.
 * That trick only works if the per-family constant it divides by is accurate —
 * Oswald fits far more characters per line than Montserrat. Run this after
 * changing the font list and paste the numbers into FONTS in src/lib/fonts.ts.
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const FONT_DIR = path.join(ROOT, 'public', 'fonts');

/** [id, css family, upright file, italic file, max real weight] */
const FAMILIES = [
  ['playfair', 'Playfair Display', 'playfair.woff2', 'playfair-italic.woff2', 900],
  ['lora', 'Lora', 'lora.woff2', 'lora-italic.woff2', 700],
  ['montserrat', 'Montserrat', 'montserrat.woff2', 'montserrat-italic.woff2', 900],
  ['nunito', 'Nunito', 'nunito.woff2', 'nunito-italic.woff2', 1000],
  ['oswald', 'Oswald', 'oswald.woff2', null, 700],
  ['anton', 'Anton', 'anton.woff2', null, 400],
  ['bebas', 'Bebas Neue', 'bebas.woff2', null, 400],
  ['dancing', 'Dancing Script', 'dancing.woff2', null, 700],
  ['special-elite', 'Special Elite', 'special-elite.woff2', null, 400],
];

// Representative of what parents actually write.
const SAMPLE =
  'Kylie, we have loved watching you play over the years and can’t wait to see ' +
  'what the future holds. Keep smiling on and off the field, you are a joy to watch.';
const SIZE = 100;

// Served over HTTP from a throwaway server: Chrome treats webfonts as
// CORS-restricted, so neither about:blank (setContent) nor file:// will load
// them — every family would silently measure as the same fallback face.
const faces = FAMILIES.flatMap(([, family, file, italic, maxWeight]) => [
  `@font-face { font-family: '${family}'; font-weight: 400 ${maxWeight}; font-style: normal; src: url('${file}'); }`,
  italic
    ? `@font-face { font-family: '${family}'; font-weight: 400 ${maxWeight}; font-style: italic; src: url('${italic}'); }`
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
    for (const [, family, , , maxWeight] of families) {
      await Promise.all(
        [400, 700, maxWeight].map((w) =>
          document.fonts.load(`${w} ${size}px '${family}'`)
        )
      ).catch(() => {});
    }
    await document.fonts.ready;

    const host = document.getElementById('host');
    const out = [];
    for (const [id, family, , , maxWeight] of families) {
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
      const heavy = measure(maxWeight);
      out.push({
        id,
        family,
        maxWeight,
        // False means the @font-face never loaded and this row is measuring
        // a fallback face — the numbers would be worthless.
        loaded: document.fonts.check(`400 100px '${family}'`),
        avgGlyph: normal / (sample.length * size),
        boldRatio: bold / normal,
        heavyGlyph: heavy / (sample.length * size),
        // A real variable axis makes the heaviest weight wider than 400. If
        // these match, the font is pinned and the weight is doing nothing.
        heavyIsReal: maxWeight === 400 || Math.abs(heavy - normal) > 0.5,
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

console.log('id              avgGlyph  boldRatio  maxWt  heavyGlyph  loaded  heavy-is-real');
for (const r of rows) {
  console.log(
    [
      r.id.padEnd(15),
      r.avgGlyph.toFixed(3).padStart(8),
      r.boldRatio.toFixed(3).padStart(10),
      String(r.maxWeight).padStart(6),
      r.heavyGlyph.toFixed(3).padStart(11),
      (r.loaded ? 'yes' : 'NO!').padStart(7),
      (r.heavyIsReal ? 'yes' : 'NO — pinned!').padStart(14),
    ].join('')
  );
}

if (rows.some((r) => !r.loaded)) {
  console.error('\nSome faces fell back to a system font.');
  process.exit(1);
}
if (rows.some((r) => !r.heavyIsReal)) {
  console.error('\nSome families ignore their heavy weight — check the @font-face ranges.');
  process.exit(1);
}

const distinct = new Set(rows.map((r) => r.avgGlyph.toFixed(4))).size;
if (distinct < rows.length / 2) {
  console.error('\nToo many identical widths — the fonts are not loading.');
  process.exit(1);
}
