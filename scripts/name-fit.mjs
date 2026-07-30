#!/usr/bin/env node
/**
 * Regression test for the player-name type size.
 *
 *   node scripts/name-fit.mjs <admin-email> <password>
 *
 * src/lib/fit.ts sizes names from character counts and per-family metrics in
 * src/lib/fonts.ts — it never measures text, so the preview and the 300 DPI
 * render agree exactly. The price is that the estimate can be wrong, and the
 * risk is real every time a font is added or a name box is resized.
 *
 * Two ways it can be wrong, both checked here:
 *   - too big for the page: the name crosses the trim edge and the ad is ruined.
 *   - too big for its box: the name stays on the page but grows into whatever
 *     the layout put next to it. Only reachable by layouts that set
 *     nameMaxScale, which let the name grow to fill a tall box.
 *
 * This measures the rendered name element in the browser rather than probing
 * pixels: backgrounds paint their own frames right at the trim edge, and a
 * pixel check cannot tell that chrome apart from a name that has overflowed.
 *
 * Checks deliberately brutal names against every layout x every font. The
 * wide-lettered ones matter as much as the long ones: avgGlyph is a mean over a
 * prose sample, and "Mummaw" in Montserrat's 900 weight runs about 0.85 em a
 * character against the family's 0.539, so it beats the estimate at a length
 * the character count calls comfortable.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.PRINT_BASE_URL || 'http://127.0.0.1:3000';
const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/name-fit.mjs <admin-email> <password>');
  process.exit(1);
}

const LAYOUTS = {
  full: ['f-hero', 'f-triptych', 'f-stacked-left', 'f-collage', 'f-medallion', 'f-magazine', 'f-full-bleed'],
  half: ['h-photos-left', 'h-photos-right', 'h-banner', 'h-split-center', 'h-feature-inset', 'h-text-top'],
  quarter: ['q-photo-top', 'q-photo-bottom', 'q-portrait-circle', 'q-side-by-side'],
};
// Every face offered for a name — NAME_FONT_IDS in src/lib/fonts.ts. This is
// 23 families now rather than 9, so a full run is a few thousand renders and
// takes a while; it is a pre-release check, not something to run per commit.
const FONTS = [
  'google-sans-flex', 'roboto', 'inter', 'montserrat', 'roboto-condensed',
  'raleway', 'rubik', 'outfit', 'smooch-sans', 'libre-baskerville',
  'orbitron', 'noto-sans-display', 'antonio', 'strichpunkt-sans', 'doto',
  'jaro', 'big-shoulders-stencil', 'inter-tight', 'cinzel',
  'big-shoulders-inline', 'bebas', 'playfair', 'dancing',
];
const NAMES = [
  'Jo Ng',
  'Kylie Marsh',
  'Alexandria Vandenberghe-Whitfield',
  // Wide letters, ordinary length — the case a mean-advance estimate misses.
  'Willow Mummaw',
  'Emma Wollowmowski',
];

let cookie = '';
async function req(p, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + p, { ...opts, headers, redirect: 'manual' });
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(';');
    if (pair.startsWith('whs_session=')) cookie = pair;
  }
  return res;
}
async function json(p, method, body) {
  const r = await req(p, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p} -> ${r.status} ${JSON.stringify(j)}`);
  return j;
}

await json('/api/auth/login', 'POST', { email, password });

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
await browser.setCookie({
  name: 'whs_session',
  value: cookie.slice('whs_session='.length),
  domain: new URL(BASE).hostname,
  path: '/',
});

const failures = [];
let checked = 0;
let tightest = Infinity;

for (const [size, layoutIds] of Object.entries(LAYOUTS)) {
  for (const layoutId of layoutIds) {
    for (const headingFont of FONTS) {
      for (const playerName of NAMES) {
        const { id } = await json('/api/ads', 'POST', { size });
        await json(`/api/ads/${id}`, 'PATCH', {
          layoutId,
          headingFont,
          backgroundId: 'classic-white',
          playerName,
          message: 'Short message.',
          attribution: 'Love, Mom and Dad',
        });

        const page = await browser.newPage();
        await page.goto(`${BASE}/print/ad/${id}`, { waitUntil: 'networkidle0' });
        await page.waitForSelector('[data-ad-name]');
        await page.evaluate(() => document.fonts.ready);

        const result = await page.evaluate(() => {
          const canvas = document.querySelector('[data-ad-canvas]').getBoundingClientRect();
          const el = document.querySelector('[data-ad-name]');
          const name = el.getBoundingClientRect();
          // The name's own box is the element the layout positioned, which is
          // this one's parent — see the player-name block in AdCanvas.
          const nameBox = el.parentElement.getBoundingClientRect();
          const style = getComputedStyle(el);
          return {
            leftSlack: name.left - canvas.left,
            rightSlack: canvas.right - name.right,
            overflowsBox: name.height - nameBox.height,
            lines: Math.max(1, Math.round(el.offsetHeight / parseFloat(style.lineHeight))),
            fontSize: parseFloat(style.fontSize),
          };
        });
        await page.close();

        checked++;
        const slack = Math.min(result.leftSlack, result.rightSlack);
        tightest = Math.min(tightest, slack);
        // The name must stay inside the trim, with a little room for the
        // outline/glow effects which paint a few percent beyond the glyphs.
        if (slack < 4) {
          failures.push(
            `${size}/${layoutId}/${headingFont} "${playerName}" slack=${slack.toFixed(1)}px @ ${result.fontSize}px`
          );
        }
        // A name taller than the box the layout gave it is growing into its
        // neighbours, even though it is still comfortably inside the trim.
        if (result.overflowsBox > 1) {
          failures.push(
            `${size}/${layoutId}/${headingFont} "${playerName}" overflows its name box by ` +
              `${result.overflowsBox.toFixed(1)}px (${result.lines} lines @ ${result.fontSize}px)`
          );
        }
      }
    }
  }
}

await browser.close();

console.log(`checked ${checked} combinations`);
console.log(`tightest margin to the trim edge: ${tightest.toFixed(1)}px`);
if (failures.length) {
  console.error(`\n${failures.length} name(s) overflow:`);
  for (const f of failures) console.error('  ' + f);
  process.exit(1);
}
console.log('every name fits inside the page');
