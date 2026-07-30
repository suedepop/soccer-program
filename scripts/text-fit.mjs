#!/usr/bin/env node
/**
 * Regression test for message type: it must stay inside its box, and must not
 * strand a single word on the last line.
 *
 *   node scripts/text-fit.mjs <admin-email> <password>
 *
 * src/lib/fit.ts picks a size by *estimating* line counts from character
 * counts, which is what keeps the preview and the print render identical. The
 * estimate is deliberately approximate, so the only honest way to know it is
 * conservative enough is to render the thing and measure it — especially with
 * a manual size request pushing against the ceiling.
 */
import puppeteer from 'puppeteer';

const BASE = process.env.PRINT_BASE_URL || 'http://127.0.0.1:3000';
const [email, password] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/text-fit.mjs <admin-email> <password>');
  process.exit(1);
}

const CASES = [
  { size: 'quarter', layoutId: 'q-photo-top' },
  { size: 'half', layoutId: 'h-photos-left' },
  { size: 'full', layoutId: 'f-hero' },
];
// Message faces only — this script sizes the message, not the name.
const FONTS = ['montserrat', 'lora', 'special-elite'];
const SCALES = [0.7, 1, 1.4];
const MESSAGES = [
  'Go Red Riders!',
  'We are so proud of you this season.',
  'Kylie, we have loved watching you play over the years and can’t wait to see what the future holds.',
  'Kylie, we have loved watching you play over the years and can’t wait to see what the future holds. Keep smiling on and off the field, you are a joy to watch, and we could not be prouder of the young woman you have become.',
  'A message that ends on an intentionally elongated concluding terminology',
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

// One ad per size, re-patched between renders rather than created each time.
const ads = {};
for (const c of CASES) {
  const { id } = await json('/api/ads', 'POST', { size: c.size });
  ads[c.size] = id;
}

const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
await browser.setCookie({
  name: 'whs_session',
  value: cookie.slice('whs_session='.length),
  domain: new URL(BASE).hostname,
  path: '/',
});
const page = await browser.newPage();

const overflows = [];
const orphans = [];
let checked = 0;
let tightest = Infinity;

for (const c of CASES) {
  for (const bodyFont of FONTS) {
    for (const message of MESSAGES) {
      for (const textScale of SCALES) {
        const id = ads[c.size];
        await json(`/api/ads/${id}`, 'PATCH', {
          layoutId: c.layoutId,
          bodyFont,
          message,
          textScale,
          playerName: 'Kylie Marsh',
          attribution: 'Love, Mom and Dad',
        });

        await page.goto(`${BASE}/print/ad/${id}`, { waitUntil: 'networkidle0' });
        await page.evaluate(() => document.fonts.ready);

        const result = await page.evaluate(() => {
          const box = document.querySelector('[data-ad-text-box="message"]');
          const content = document.querySelector('[data-ad-text-content="message"]');
          const boxRect = box.getBoundingClientRect();
          const contentRect = content.getBoundingClientRect();

          // Group words into visual lines by their vertical position. Words
          // joined with a non-breaking space count as one token but two words,
          // which is exactly the orphan fix being verified.
          const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
          const tokens = [];
          let node;
          while ((node = walker.nextNode())) {
            const text = node.nodeValue ?? '';
            let i = 0;
            while (i < text.length) {
              while (i < text.length && text[i] === ' ') i += 1;
              if (i >= text.length) break;
              const start = i;
              while (i < text.length && text[i] !== ' ') i += 1;
              const range = document.createRange();
              range.setStart(node, start);
              range.setEnd(node, i);
              tokens.push({
                text: text.slice(start, i),
                top: Math.round(range.getBoundingClientRect().top),
              });
            }
          }

          const lines = [];
          for (const t of tokens) {
            const last = lines[lines.length - 1];
            if (last && Math.abs(last.top - t.top) < 2) last.tokens.push(t.text);
            else lines.push({ top: t.top, tokens: [t.text] });
          }

          const lastLine = lines[lines.length - 1];
          const wordsOnLastLine = lastLine
            ? lastLine.tokens.join(' ').split(/[\s ]+/).filter(Boolean).length
            : 0;

          return {
            slack: boxRect.height - contentRect.height,
            lineCount: lines.length,
            wordsOnLastLine,
            fontSize: parseFloat(getComputedStyle(content).fontSize),
          };
        });

        checked += 1;
        tightest = Math.min(tightest, result.slack);
        const label = `${c.size}/${bodyFont}/${textScale}x/${message.length}ch`;

        if (result.slack < -0.5) {
          overflows.push(`${label} overflows by ${(-result.slack).toFixed(1)}px @ ${result.fontSize}px`);
        }
        // Only meaningful when the text actually wraps.
        if (result.lineCount > 1 && result.wordsOnLastLine < 2) {
          orphans.push(`${label} last line has ${result.wordsOnLastLine} word`);
        }
      }
    }
  }
}

await browser.close();

console.log(`checked ${checked} combinations`);
console.log(`tightest fit: ${tightest.toFixed(1)}px of slack`);

if (overflows.length) {
  console.error(`\n${overflows.length} overflow(s):`);
  for (const o of overflows.slice(0, 12)) console.error('  ' + o);
}
if (orphans.length) {
  console.error(`\n${orphans.length} orphaned last line(s):`);
  for (const o of orphans.slice(0, 12)) console.error('  ' + o);
}
if (overflows.length || orphans.length) process.exit(1);
console.log('every message fits its box, and none ends on a lone word');
