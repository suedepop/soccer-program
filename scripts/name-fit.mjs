#!/usr/bin/env node
/**
 * Regression test for the player-name type size.
 *
 *   node scripts/name-fit.mjs <admin-email> <password>
 *
 * Names are drawn with `white-space: nowrap`, so if src/lib/fit.ts ever
 * under-shrinks one it runs straight off the trim edge and the printed ad is
 * ruined. src/lib/fonts.ts feeds that estimate per family, which means the risk
 * is real every time a font is added or a name box is resized.
 *
 * This measures the rendered name element in the browser rather than probing
 * pixels: backgrounds paint their own frames right at the trim edge, and a
 * pixel check cannot tell that chrome apart from a name that has overflowed.
 *
 * Checks a deliberately brutal name against every layout x every font.
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
const FONTS = ['montserrat', 'oswald', 'anton', 'bebas', 'nunito', 'playfair', 'lora', 'dancing', 'special-elite'];
const NAMES = ['Jo Ng', 'Kylie Marsh', 'Alexandria Vandenberghe-Whitfield'];

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
          const name = document.querySelector('[data-ad-name]').getBoundingClientRect();
          return {
            leftSlack: name.left - canvas.left,
            rightSlack: canvas.right - name.right,
            fontSize: parseFloat(getComputedStyle(document.querySelector('[data-ad-name]')).fontSize),
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
