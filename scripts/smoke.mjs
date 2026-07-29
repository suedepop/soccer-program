import sharp from 'sharp';
import fs from 'node:fs/promises';

const BASE = 'http://127.0.0.1:3000';
let cookie = '';

function grab(res) {
  const sc = res.headers.getSetCookie?.() ?? [];
  for (const c of sc) {
    const [pair] = c.split(';');
    if (pair.startsWith('whs_session=')) cookie = pair;
  }
}

async function req(path, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + path, { ...opts, headers, redirect: 'manual' });
  grab(res);
  return res;
}

async function json(path, method, body) {
  const res = await req(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(j)}`);
  return j;
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('server never came up');
}

async function makeImage(w, h, hue) {
  return sharp({
    create: { width: w, height: h, channels: 3, background: { r: hue, g: 60, b: 70 } },
  })
    .jpeg()
    .toBuffer();
}

const results = [];
function check(name, cond, extra = '') {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
}

await waitForServer();

// 1. signup (first user becomes admin)
const email = `admin${Date.now()}@test.local`;
const signup = await json('/api/auth/signup', 'POST', {
  email,
  password: 'password123',
  name: 'Test Admin',
  phone: '555-0100',
});
check('signup returns admin for first user', signup.isAdmin === true, `isAdmin=${signup.isAdmin}`);

// 2. second user is NOT admin
const savedCookie = cookie;
cookie = '';
const parent = await json('/api/auth/signup', 'POST', {
  email: `parent${Date.now()}@test.local`,
  password: 'password123',
  name: 'Parent Person',
});
check('second signup is not admin', parent.isAdmin === false);
const parentCookie = cookie;

// 3. parent creates a quarter ad
const { id: qId } = await json('/api/ads', 'POST', { size: 'quarter' });
check('created quarter ad', !!qId, `id=${qId}`);

// 4. upload a big photo + a tiny photo, check metadata round-trips
const big = await makeImage(3000, 2400, 200);
const tiny = await makeImage(320, 240, 90);

async function upload(adId, slot, buf, name) {
  const form = new FormData();
  form.set('slot', String(slot));
  form.set('file', new File([buf], name, { type: 'image/jpeg' }));
  const res = await req(`/api/ads/${adId}/photos`, { method: 'POST', body: form });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`upload -> ${res.status} ${JSON.stringify(j)}`);
  return j.photo;
}

const p1 = await upload(qId, 0, big, 'big.jpg');
check('big upload stored with dimensions', p1.width === 3000 && p1.height === 2400,
  `${p1.width}x${p1.height}`);

// 5. fill in text, including inline formatting marks
await json(`/api/ads/${qId}`, 'PATCH', {
  playerName: 'Kylie Marsh',
  message: 'Kylie, we have **loved** watching you play over the years and can’t wait to see what the future holds. Keep smiling on and off the field, __you are a joy to watch__.',
  attribution: '*Love, Mom and Dad*',
  backgroundId: 'vintage-program',
  layoutId: 'q-portrait-circle',
});

// 5b. fonts round-trip, and a bogus id is ignored rather than stored
const fontSet = await json(`/api/ads/${qId}`, 'PATCH', {
  headingFont: 'dancing',
  bodyFont: 'lora',
});
check('font choices persist', fontSet.ad.headingFont === 'dancing' && fontSet.ad.bodyFont === 'lora',
  `${fontSet.ad.headingFont}/${fontSet.ad.bodyFont}`);

const bogus = await json(`/api/ads/${qId}`, 'PATCH', { headingFont: 'comic-sans-deluxe' });
check('unknown font id rejected', bogus.ad.headingFont === 'dancing', bogus.ad.headingFont);

const cleared = await json(`/api/ads/${qId}`, 'PATCH', { headingFont: '' });
check('font can be reset to the background default', cleared.ad.headingFont === '');
await json(`/api/ads/${qId}`, 'PATCH', { headingFont: 'dancing' });

// 5c. a field holding only formatting marks is still empty
const blankAd = await json('/api/ads', 'POST', { size: 'quarter' });
await json(`/api/ads/${blankAd.id}`, 'PATCH', {
  playerName: 'Test',
  message: '****',
  attribution: 'Love, Mom',
});
const blankRes = await req(`/api/ads/${blankAd.id}/submit`, { method: 'POST' });
check('markup-only message fails validation', blankRes.status === 422, `status=${blankRes.status}`);

// 5d. every self-hosted font file referenced by fonts.css is actually served.
// Read the paths out of the stylesheet rather than hardcoding them, so
// renaming a font file can never leave this check silently passing.
const css = await fs.readFile(new URL('../src/app/fonts.css', import.meta.url), 'utf8');
const fontUrls = [...new Set([...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]))];
check('fonts.css references font files', fontUrls.length > 0, `${fontUrls.length} files`);

const fontResults = await Promise.all(
  fontUrls.map(async (u) => {
    const r = await req(u);
    return { u, ok: r.ok && (r.headers.get('content-type') ?? '').includes('font') };
  })
);
const badFonts = fontResults.filter((r) => !r.ok);
check('every woff2 is served', badFonts.length === 0, badFonts.map((r) => r.u).join(' ') || '');

// 6. submit
const sub = await json(`/api/ads/${qId}/submit`, 'POST', {});
check('submit moves ad to Payment Due', sub.status === 'submitted', sub.status);

// 7. a full-page ad with 3 photos, one deliberately too small
const { id: fId } = await json('/api/ads', 'POST', { size: 'full' });
await json(`/api/ads/${fId}`, 'PATCH', {
  layoutId: 'f-hero',
  backgroundId: 'blackout',
  playerName: 'Bill Hendricks',
  message: 'Have a great season, Bill! We can’t wait to cheer you on! Go Weir!',
  attribution: '— Missy, Bill, and Jen',
});
await upload(fId, 0, big, 'big.jpg');
await upload(fId, 1, await makeImage(1600, 1200, 40), 'mid.jpg');
const smallPhoto = await upload(fId, 2, tiny, 'tiny.jpg');
check('tiny upload stored', smallPhoto.width === 320);
const fSub = await json(`/api/ads/${fId}/submit`, 'POST', {});
check('full ad submitted', fSub.status === 'submitted');

// 8. half-page ads so imposition has something to pack
for (const bgId of ['red-rider', 'jersey-stripes']) {
  const { id } = await json('/api/ads', 'POST', { size: 'half' });
  await json(`/api/ads/${id}`, 'PATCH', {
    layoutId: 'h-photos-left',
    backgroundId: bgId,
    playerName: 'Sam Rivera',
    message: 'So proud of you. Go Red Riders!',
    attribution: 'Love, Grandma',
  });
  await upload(id, 0, big, 'big.jpg');
  await upload(id, 1, await makeImage(1400, 1400, 150), 'sq.jpg');
  await json(`/api/ads/${id}/submit`, 'POST', {});
}

// 9. parent cannot reach admin API
const forbidden = await req(`/api/admin/ads/${qId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ status: 'paid' }),
});
check('non-admin blocked from admin API', forbidden.status === 403, `status=${forbidden.status}`);

// 10. parent cannot read another user's file — switch to admin, upload, switch back
cookie = savedCookie;
const adminAd = await json('/api/ads', 'POST', { size: 'quarter' });
const adminPhoto = await upload(adminAd.id, 0, big, 'admins.jpg');
cookie = parentCookie;
const leak = await req(`/api/files/${adminPhoto.id}`);
check('cross-account photo access blocked', leak.status === 404, `status=${leak.status}`);

// 11. admin marks paid
cookie = savedCookie;
const paid = await json(`/api/admin/ads/${qId}`, 'PATCH', { status: 'paid', adminNotes: 'Check #1042' });
check('admin can mark paid', paid.ad.status === 'paid' && !!paid.ad.paidAt, paid.ad.paidAt ?? '');

// 12. locked ad rejects edits
cookie = parentCookie;
const locked = await req(`/api/ads/${qId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ playerName: 'Nope' }),
});
check('paid ad is locked from edits', locked.status === 409, `status=${locked.status}`);

// 13. print PNG at 300 DPI
cookie = savedCookie;
console.log('rendering PNG…');
const pngRes = await req(`/api/admin/ads/${fId}/png`);
check('png endpoint ok', pngRes.ok, `status=${pngRes.status}`);
if (pngRes.ok) {
  const buf = Buffer.from(await pngRes.arrayBuffer());
  const meta = await sharp(buf).metadata();
  check('full-page PNG is 2550x3300', meta.width === 2550 && meta.height === 3300,
    `${meta.width}x${meta.height}`);
  await fs.writeFile(new URL('./out-full.png', import.meta.url), buf);
}

const qPngRes = await req(`/api/admin/ads/${qId}/png`);
if (qPngRes.ok) {
  const buf = Buffer.from(await qPngRes.arrayBuffer());
  const meta = await sharp(buf).metadata();
  check('quarter-page PNG is 1275x1650', meta.width === 1275 && meta.height === 1650,
    `${meta.width}x${meta.height}`);
  await fs.writeFile(new URL('./out-quarter.png', import.meta.url), buf);
} else {
  check('quarter png endpoint ok', false, `status=${qPngRes.status}`);
}

// 13b. The print render must use the chosen webfont, not a fallback. If the
// woff2 files failed to load in headless Chrome, every family would collapse to
// the same substitute and these two renders would come out byte-identical.
async function renderWith(fonts) {
  await json(`/api/ads/${fId}`, 'PATCH', fonts);
  const r = await req(`/api/admin/ads/${fId}/png`);
  if (!r.ok) throw new Error(`render failed: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}
const asBebas = await renderWith({ headingFont: 'bebas', bodyFont: 'montserrat' });
const asDancing = await renderWith({ headingFont: 'dancing', bodyFont: 'lora' });
check('print render honours the font choice', !asBebas.equals(asDancing));

// And formatting must change the pixels too.
const plain = await renderWith({ headingFont: 'lora', bodyFont: 'lora' });
await json(`/api/ads/${fId}`, 'PATCH', {
  message: 'Have a great season, **Bill**! We can’t wait to cheer you on! Go Weir!',
});
const formatted = Buffer.from(await (await req(`/api/admin/ads/${fId}/png`)).arrayBuffer());
check('bold markup changes the print render', !plain.equals(formatted));

// 14. program PDF
console.log('rendering PDF…');
const pdfRes = await req('/api/admin/program/pdf');
check('pdf endpoint ok', pdfRes.ok, `status=${pdfRes.status}`);
if (pdfRes.ok) {
  const buf = Buffer.from(await pdfRes.arrayBuffer());
  check('pdf has PDF magic bytes', buf.subarray(0, 4).toString() === '%PDF');
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  check('pdf has multiple pages', pages >= 2, `pages=${pages}`);
  await fs.writeFile(new URL('./out-program.pdf', import.meta.url), buf);
}

// 15. program page PNG
const pageRes = await req('/api/admin/program/page/0');
if (pageRes.ok) {
  const buf = Buffer.from(await pageRes.arrayBuffer());
  const meta = await sharp(buf).metadata();
  check('program sheet PNG is 2550x3300', meta.width === 2550 && meta.height === 3300,
    `${meta.width}x${meta.height}`);
  await fs.writeFile(new URL('./out-sheet0.png', import.meta.url), buf);
} else {
  check('program page endpoint ok', false, `status=${pageRes.status}`);
}

// 16. pages render
for (const path of ['/', '/dashboard', '/admin', '/ads/new', `/ads/${fId}`, `/ads/${fId}/edit`]) {
  const r = await req(path);
  check(`GET ${path}`, r.ok, `status=${r.status}`);
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
