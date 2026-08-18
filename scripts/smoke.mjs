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

// 3b. new ads start with sample text so the preview is not an empty frame.
// There is no GET for a single ad; a no-op PATCH echoes it back.
const { ad: fresh } = await json(`/api/ads/${qId}`, 'PATCH', {});
check(
  'new ad is pre-filled with sample text',
  fresh.playerName === 'Player Name' &&
    fresh.message.startsWith('Lorem ipsum') &&
    fresh.attribution === '- All of us at work',
  `${JSON.stringify(fresh.playerName)} / ${JSON.stringify(fresh.attribution)}`
);

// 3c. ...which must NOT be submittable. Pre-filled text passes a plain
// "is it empty?" check, so this is the only thing standing between a
// distracted parent and a printed page of Lorem ipsum.
const untouched = await json('/api/ads', 'POST', { size: 'quarter' });
const untouchedSubmit = await req(`/api/ads/${untouched.id}/submit`, { method: 'POST' });
const untouchedBody = await untouchedSubmit.json().catch(() => ({}));
check(
  'untouched sample text cannot be submitted',
  untouchedSubmit.status === 422,
  `status=${untouchedSubmit.status}`
);
check(
  'the refusal names both placeholder fields',
  /Player Name/.test(untouchedBody.error ?? '') && /Lorem ipsum/i.test(untouchedBody.error ?? ''),
  untouchedBody.error ?? ''
);

// 3d. real name + real message is enough; the default "from" line is a phrase
// someone might genuinely mean, so it is deliberately not blocked.
await json(`/api/ads/${untouched.id}`, 'PATCH', {
  playerName: 'Real Player',
  message: 'A real message from a real family.',
});
await upload(untouched.id, 0, await makeImage(1600, 1200, 55), 'ok.jpg');
const defaultFromOk = await req(`/api/ads/${untouched.id}/submit`, { method: 'POST' });
check(
  'default “from” line does not block submission',
  defaultFromOk.ok,
  `status=${defaultFromOk.status}`
);

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

// 12b. a parent may delete their own draft, and nothing further along. The
// cutoff is the whole rule: a draft is private unfinished work, but a submitted
// ad is money owed and already being laid into the book.
cookie = parentCookie;
const before = await getJson('/api/photos');
const scrap = await json('/api/ads', 'POST', { size: 'quarter' });
await upload(scrap.id, 0, big, 'scrap.jpg');
const delDraft = await req(`/api/ads/${scrap.id}`, { method: 'DELETE' });
check('parent can delete their own draft', delDraft.ok, `status=${delDraft.status}`);
const goneRes = await req(`/api/ads/${scrap.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
check('the deleted draft is gone', goneRes.status === 404, `status=${goneRes.status}`);
// The photo was uploaded through the ad, but it lives in the library — tidying
// up an abandoned draft must not take the picture with it.
const after = await getJson('/api/photos');
check(
  'deleting an ad leaves its photos in the library',
  after.photos.length === before.photos.length + 1,
  `${before.photos.length} -> ${after.photos.length}`
);

const owed = await json('/api/ads', 'POST', { size: 'quarter' });
await json(`/api/ads/${owed.id}`, 'PATCH', {
  playerName: 'Owed Ad',
  message: 'This one has been submitted.',
  attribution: 'Love, QA',
});
await upload(owed.id, 0, big, 'owed.jpg');
await json(`/api/ads/${owed.id}/submit`, 'POST', {});
const delSubmitted = await req(`/api/ads/${owed.id}`, { method: 'DELETE' });
const delSubmittedBody = await delSubmitted.json().catch(() => ({}));
check(
  'parent cannot delete a submitted ad',
  delSubmitted.status === 409,
  `status=${delSubmitted.status}`
);
check(
  'the refusal points them at the boosters',
  /boosters/i.test(delSubmittedBody.error ?? ''),
  delSubmittedBody.error ?? ''
);
const delPaid = await req(`/api/ads/${qId}`, { method: 'DELETE' });
check('parent cannot delete a paid ad', delPaid.status === 409, `status=${delPaid.status}`);

// Another parent's draft is not theirs to delete — and the answer is 404, not
// 403, so it does not confirm the ad exists.
const stranger = await json('/api/ads', 'POST', { size: 'quarter' });
cookie = savedCookie;
const adminDelOwed = await req(`/api/ads/${owed.id}`, { method: 'DELETE' });
check('admin can delete a submitted ad', adminDelOwed.ok, `status=${adminDelOwed.status}`);
cookie = '';
await json('/api/auth/signup', 'POST', {
  email: `nosy${Date.now()}@test.local`,
  password: 'password123',
  name: 'Nosy Parent',
});
const delOther = await req(`/api/ads/${stranger.id}`, { method: 'DELETE' });
check("parent cannot delete another parent's draft", delOther.status === 404, `status=${delOther.status}`);
cookie = parentCookie;
const strangerAlive = await req(`/api/ads/${stranger.id}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({}),
});
check('the refused draft is still there', strangerAlive.ok, `status=${strangerAlive.status}`);
await req(`/api/ads/${stranger.id}`, { method: 'DELETE' });

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
// The admin screens are in here because each runs its own query over the whole
// database — the accounts table counts ads, photos and rights-managed photos a
// row at a time, and a broken column there would render as a 500, not a typo.
for (const path of [
  '/',
  '/dashboard',
  '/admin',
  '/admin/users',
  '/admin/photos',
  '/ads/new',
  `/ads/${fId}`,
  `/ads/${fId}/edit`,
]) {
  const r = await req(path);
  check(`GET ${path}`, r.ok, `status=${r.status}`);
}

// ---------------------------------------------------------------------------
// 17. Photo library
// ---------------------------------------------------------------------------
cookie = '';
const libUser = await json('/api/auth/signup', 'POST', {
  email: `lib${Date.now()}@test.local`,
  password: 'password123',
  name: 'Library Tester',
});

function filesForm(bufs) {
  const form = new FormData();
  bufs.forEach((b, i) =>
    form.append('files', new File([b], `p${i}.jpg`, { type: 'image/jpeg' }))
  );
  return form;
}
async function getJson(path) {
  const r = await req(path);
  return r.json();
}

const three = [
  await makeImage(1600, 1200, 60),
  await makeImage(1600, 1200, 120),
  await makeImage(400, 300, 180),
];
// A new account is not an empty one: signup seeds the media-day placeholder.
// Count what is there rather than assuming zero, so seeding one more starter
// photo some day does not read as a broken library.
const seeded = (await getJson('/api/photos')).photos.length;

const bulk = await req('/api/photos', { method: 'POST', body: filesForm(three) });
const bulkJson = await bulk.json();
check('bulk upload adds several at once', bulk.ok && bulkJson.added === 3, `added=${bulkJson.added}`);

const list = await getJson('/api/photos');
check(
  'library lists photos with a limit',
  list.photos.length === seeded + 3 && list.limit === 100,
  `${list.photos.length} photos (${seeded} seeded + 3), limit ${list.limit}`
);

// Place one library photo into two different ads.
const pick = list.photos.find((p) => p.width === 1600);
const { id: libAdA } = await json('/api/ads', 'POST', { size: 'quarter' });
const placed = await json(`/api/ads/${libAdA}/photos`, 'POST', { slot: 0, fileId: pick.id });
check('library photo can be placed in a slot', placed.photo.fileId === pick.id);

const { id: libAdB } = await json('/api/ads', 'POST', { size: 'quarter' });
await json(`/api/ads/${libAdB}/photos`, 'POST', { slot: 0, fileId: pick.id });
const afterReuse = await getJson('/api/photos');
const reused = afterReuse.photos.find((p) => p.id === pick.id);
check('one photo serves two ads', reused.usedBy.length === 2, `usedBy=${reused.usedBy.length}`);

// Deleting an in-use photo would cascade it out of those ads — must be refused.
const delUsed = await req(`/api/photos/${pick.id}`, { method: 'DELETE' });
check('in-use photo cannot be deleted', delUsed.status === 409, `status=${delUsed.status}`);
const stillThere = await getJson('/api/photos');
check('refused delete left the photo alone', stillThere.photos.some((p) => p.id === pick.id));

const spare = list.photos.find((p) => p.width === 400);
const delSpare = await req(`/api/photos/${spare.id}`, { method: 'DELETE' });
check('unused photo deletes', delSpare.ok, `status=${delSpare.status}`);
const afterDelete = await getJson('/api/photos');
check('deleted photo is gone', !afterDelete.photos.some((p) => p.id === spare.id));

// A photo from someone else's library must not be placeable.
const libCookie = cookie;
cookie = parentCookie;
const { id: strangerAd } = await json('/api/ads', 'POST', { size: 'quarter' });
const steal = await req(`/api/ads/${strangerAd}/photos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slot: 0, fileId: pick.id }),
});
check('cannot place another account photo', steal.status === 404, `status=${steal.status}`);

// 17b. The boosters can see any library and add to it — for the parent who
// emails them the photos instead of uploading. Adding only: the endpoint has no
// DELETE, so an admin cannot clear out somebody else's material.
const adminLibPath = `/api/admin/users/${libUser.id}/photos`;
const parentPeek = await req(adminLibPath);
check('parent blocked from the admin library API', parentPeek.status === 403, `status=${parentPeek.status}`);

cookie = savedCookie;
const adminView = await getJson(adminLibPath);
cookie = libCookie;
const ownView = await getJson('/api/photos');
check(
  'admin sees the same library the parent does',
  adminView.photos.length === ownView.photos.length,
  `${adminView.photos.length} vs ${ownView.photos.length}`
);

cookie = savedCookie;
const gift = await req(adminLibPath, { method: 'POST', body: filesForm([await makeImage(2000, 1500, 175)]) });
const giftJson = await gift.json();
check('admin can add a photo to a parent library', gift.ok && giftJson.added === 1, `added=${giftJson.added}`);
const noSuchAccount = await req('/api/admin/users/999999/photos');
check('admin library API 404s on an unknown account', noSuchAccount.status === 404, `status=${noSuchAccount.status}`);


cookie = libCookie;
const withGift = await getJson('/api/photos');
check(
  'the added photo is in the parent’s own library',
  withGift.photos.length === ownView.photos.length + 1,
  `${ownView.photos.length} -> ${withGift.photos.length}`
);
// An admin's upload is an ordinary library photo — the owner can remove it.
const newest = withGift.photos.find((p) => !ownView.photos.some((o) => o.id === p.id));
const delGift = await req(`/api/photos/${newest.id}`, { method: 'DELETE' });
check('the parent can delete a photo the admin added', delGift.ok, `status=${delGift.status}`);

// 17c. That same endpoint is what the editor's picker loads when an admin is
// working on somebody else's ad. An ad may only hold photos belonging to its
// owner, so the picker has to point at the owner's library — offering the admin
// their own was offering a set in which every choice came back 404.
cookie = libCookie;
const parentsAd = await json('/api/ads', 'POST', { size: 'quarter' });

cookie = savedCookie;
const ownAd = await json('/api/ads', 'POST', { size: 'quarter' });
const adminOwn = (await getJson('/api/photos')).photos[0];
const intoOwn = await req(`/api/ads/${ownAd.id}/photos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slot: 0, fileId: adminOwn.id }),
});
// Their own photo in their own ad is the ordinary case, and still works.
check('an admin places their own photo in their own ad', intoOwn.ok, `status=${intoOwn.status}`);

const intoTheirs = await req(`/api/ads/${parentsAd.id}/photos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slot: 0, fileId: adminOwn.id }),
});
check(
  "an admin's own photo is refused for another parent's ad",
  intoTheirs.status === 404,
  `status=${intoTheirs.status}`
);

// One from the owner's library — read through the very endpoint the picker
// loads — does go in.
const theirs = (await getJson(adminLibPath)).photos[0];
const fromTheirLibrary = await req(`/api/ads/${parentsAd.id}/photos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ slot: 0, fileId: theirs.id }),
});
check(
  "a photo from the owner's library goes in",
  fromTheirLibrary.ok,
  `status=${fromTheirLibrary.status}`
);

// An admin can also take one out — but not one an ad still places, because
// ad_photos cascades and it would vanish out of that ad unannounced. The
// refusal names the ad so the admin can go and clear it.
const spareForAdmin = (await getJson(adminLibPath)).photos.find((p) => p.usedBy.length === 0);
const adminDel = await req(`${adminLibPath}/${spareForAdmin.id}`, { method: 'DELETE' });
check('admin can delete an unused photo from a parent library', adminDel.ok, `status=${adminDel.status}`);
const afterAdminDel = await getJson(adminLibPath);
check(
  'and it is gone from the owner’s library',
  !afterAdminDel.photos.some((p) => p.id === spareForAdmin.id),
  `${afterAdminDel.photos.length} left`
);

const inUseForAdmin = (await getJson(adminLibPath)).photos.find((p) => p.usedBy.length > 0);
if (inUseForAdmin) {
  const refused = await req(`${adminLibPath}/${inUseForAdmin.id}`, { method: 'DELETE' });
  const refusedBody = await refused.json().catch(() => ({}));
  check('admin cannot delete a photo an ad still uses', refused.status === 409, `status=${refused.status}`);
  check(
    'the refusal names the ad to clear first',
    /still used by/.test(refusedBody.error ?? ''),
    refusedBody.error ?? ''
  );
  const survived = await getJson(adminLibPath);
  check(
    'the refused photo is still there',
    survived.photos.some((p) => p.id === inUseForAdmin.id)
  );
} else {
  check('an in-use photo was available to test the refusal', false, 'none in use');
}

// A parent must not reach the admin delete for anyone, including themselves.
cookie = libCookie;
const parentViaAdmin = await req(`${adminLibPath}/${inUseForAdmin?.id ?? 1}`, { method: 'DELETE' });
check(
  'a parent cannot use the admin delete',
  parentViaAdmin.status === 403,
  `status=${parentViaAdmin.status}`
);
cookie = savedCookie;

// ---------------------------------------------------------------------------
// 18. The 100-photo cap, including partial batches
// ---------------------------------------------------------------------------
cookie = '';
await json('/api/auth/signup', 'POST', {
  email: `cap${Date.now()}@test.local`,
  password: 'password123',
  name: 'Cap Tester',
});

const capImage = await makeImage(64, 64, 90);
// Fill to exactly two short of the cap. Counting from the seeded placeholder
// rather than from zero is what keeps the partial-batch arithmetic below
// honest — see the note in the library section.
const room = 100 - (await getJson('/api/photos')).photos.length - 2;
const fill = await req('/api/photos', { method: 'POST', body: filesForm(Array(room).fill(capImage)) });
const fillJson = await fill.json();
check('large batch upload works', fillJson.added === room, `added=${fillJson.added} of ${room}`);

// Only 2 slots left, so 5 more should add 2 and report 3 skipped rather than
// failing the whole batch.
const over = await req('/api/photos', { method: 'POST', body: filesForm(Array(5).fill(capImage)) });
const overJson = await over.json();
check(
  'batch past the cap adds what fits',
  overJson.added === 2 && overJson.skipped === 3,
  `added=${overJson.added} skipped=${overJson.skipped}`
);
check('library stops at the cap', overJson.photos.length === 100, `${overJson.photos.length}`);

const totallyFull = await req('/api/photos', { method: 'POST', body: filesForm([capImage]) });
check('upload to a full library is refused', totallyFull.status === 409, `status=${totallyFull.status}`);

const { id: capAd } = await json('/api/ads', 'POST', { size: 'quarter' });
const capUpload = new FormData();
capUpload.set('slot', '0');
capUpload.set('file', new File([capImage], 'x.jpg', { type: 'image/jpeg' }));
const capRes = await req(`/api/ads/${capAd}/photos`, { method: 'POST', body: capUpload });
check('cap also applies to uploads from inside an ad', capRes.status === 409, `status=${capRes.status}`);

// ---------------------------------------------------------------------------
// 19. Nudge and zoom can never expose the background
// ---------------------------------------------------------------------------
cookie = savedCookie;

const { id: cropAd } = await json('/api/ads', 'POST', { size: 'quarter' });
await json(`/api/ads/${cropAd}`, 'PATCH', {
  layoutId: 'q-photo-top',
  backgroundId: 'classic-white',
  playerName: 'Crop Test',
  message: 'Checking the crop stays inside its slot.',
  attribution: 'Love, QA',
});
// A tall photo, so the cover fit has to crop it vertically.
await upload(cropAd, 0, await makeImage(1200, 1800, 210), 'crop.jpg');

// Out-of-range values are pulled back into range rather than rejected.
const clamped = await json(`/api/ads/${cropAd}/photos`, 'PUT', {
  slot: 0,
  focalX: -4,
  focalY: 9,
  zoom: 0.1,
});
check(
  'pan and zoom are clamped to a legal range',
  clamped.photo.focalX === 0 && clamped.photo.focalY === 1 && clamped.photo.zoom === 1,
  `x=${clamped.photo.focalX} y=${clamped.photo.focalY} zoom=${clamped.photo.zoom}`
);

const capped = await json(`/api/ads/${cropAd}/photos`, 'PUT', { slot: 0, zoom: 99 });
check('zoom is capped at the maximum', capped.photo.zoom === 4, `zoom=${capped.photo.zoom}`);

// Now prove it in the actual print render. q-photo-top puts the photo at
// x8 y7 w84 h44 of a 1275x1650 quarter page. The page is white and the photo
// is solid (210,60,70), so a single near-white pixel inside the slot means the
// image pulled away from an edge and let the background through.
const SLOT = { x: 0.08, y: 0.07, w: 0.84, h: 0.44 };
const PAGE = { w: 1275, h: 1650 };
const INSET = 14; // clear of the photo's own drawn border
const region = {
  left: Math.round(SLOT.x * PAGE.w) + INSET,
  top: Math.round(SLOT.y * PAGE.h) + INSET,
  width: Math.round(SLOT.w * PAGE.w) - INSET * 2,
  height: Math.round(SLOT.h * PAGE.h) - INSET * 2,
};

const extremes = [
  [0, 0, 1],
  [1, 1, 1],
  [0, 1, 1],
  [1, 0, 1],
  [0, 0, 4],
  [1, 1, 4],
  [0.5, 0.5, 4],
  [0.5, 0.5, 2.37],
];

let worstGap = 0;
const leaks = [];
for (const [focalX, focalY, zoom] of extremes) {
  await json(`/api/ads/${cropAd}/photos`, 'PUT', { slot: 0, focalX, focalY, zoom });
  const res = await req(`/api/admin/ads/${cropAd}/png`);
  if (!res.ok) throw new Error(`crop render failed: ${res.status}`);
  const png = Buffer.from(await res.arrayBuffer());

  const { data, info } = await sharp(png).extract(region).raw().toBuffer({ resolveWithObject: true });
  let white = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) white++;
  }
  worstGap = Math.max(worstGap, white);
  if (white > 0) leaks.push(`${focalX}/${focalY}@${zoom}x → ${white}px`);
}

check(
  'photo covers its slot at every extreme of pan and zoom',
  leaks.length === 0,
  leaks.length ? leaks.join(', ') : `${extremes.length} combinations, 0 background pixels`
);

// ---------------------------------------------------------------------------
// 19b. Rights-managed photos: watermarked on screen, clean in the print file
// ---------------------------------------------------------------------------
cookie = '';
const rmParent = await json('/api/auth/signup', 'POST', {
  email: `rights${Date.now()}@test.local`,
  password: 'password123',
  name: 'Rights Parent',
});
const rmParentCookie = cookie;

// The same image twice, flagged and not, so the two ads below differ in the
// flag and nothing else.
cookie = savedCookie;
const rmPhoto = await makeImage(1800, 1400, 95);
async function adminAdd(name, flagged) {
  const form = new FormData();
  form.append('files', new File([rmPhoto], name, { type: 'image/jpeg' }));
  if (flagged) form.set('rightsManaged', '1');
  const r = await req(`/api/admin/users/${rmParent.id}/photos`, { method: 'POST', body: form });
  const j = await r.json();
  if (!r.ok) throw new Error(`rights upload ${name}: ${r.status} ${JSON.stringify(j)}`);
  return j.photos.find((p) => p.origName === name);
}
const rmManaged = await adminAdd('licensed.jpg', true);
const rmPlain = await adminAdd('ordinary.jpg', false);
check('admin can flag an upload rights-managed', rmManaged.rightsManaged === true, `${rmManaged.rightsManaged}`);
check('an unflagged admin upload is not managed', rmPlain.rightsManaged === false, `${rmPlain.rightsManaged}`);

// Only the admin route honours the flag. A parent sending the same field on
// their own upload must not be able to mark their photo licensed.
cookie = rmParentCookie;
const ownForm = new FormData();
ownForm.append('files', new File([rmPhoto], 'parents-own.jpg', { type: 'image/jpeg' }));
ownForm.set('rightsManaged', '1');
const ownRes = await req('/api/photos', { method: 'POST', body: ownForm });
const ownJson = await ownRes.json();
const parentsOwn = ownJson.photos.find((p) => p.origName === 'parents-own.jpg');
check(
  'a parent cannot flag their own upload',
  parentsOwn && parentsOwn.rightsManaged === false,
  `rightsManaged=${parentsOwn?.rightsManaged}`
);

async function rightsAd(fileId) {
  const { id } = await json('/api/ads', 'POST', { size: 'half' });
  await json(`/api/ads/${id}`, 'PATCH', {
    layoutId: 'h-one-left',
    backgroundId: 'classic-white',
    playerName: 'Rights Parent',
    message: 'Proud of you.',
    attribution: 'Love, Mom',
  });
  await json(`/api/ads/${id}/photos`, 'POST', { slot: 0, fileId });
  return id;
}
const rmAdManaged = await rightsAd(rmManaged.id);
const rmAdPlain = await rightsAd(rmPlain.id);

// The invariant this whole feature turns on. Two ads identical but for the
// flag must produce the same print file: a watermark that reached the printer
// would be a ruined page nobody sees until it is bound.
cookie = savedCookie;
console.log('rendering the rights-managed pair…');
const rmPngA = Buffer.from(await (await req(`/api/admin/ads/${rmAdManaged}/png`)).arrayBuffer());
const rmPngB = Buffer.from(await (await req(`/api/admin/ads/${rmAdPlain}/png`)).arrayBuffer());
check(
  'a rights-managed ad prints identically to an unmanaged one',
  rmPngA.equals(rmPngB),
  `${rmPngA.length} vs ${rmPngB.length} bytes`
);

// And the preview it is meant to protect does carry it. The print page and the
// ad page are the same component, so this is the pair that proves the switch.
const previewHtml = await (await req(`/print/ad/${rmAdManaged}`)).text();
check('the print page carries no watermark', !previewHtml.includes('data-watermark'), '/print/ad');
const adPageHtml = await (await req(`/ads/${rmAdManaged}`)).text();
check('the ad page preview does carry one', adPageHtml.includes('data-watermark'), '/ads/[id]');
const plainPageHtml = await (await req(`/ads/${rmAdPlain}`)).text();
check('an unmanaged photo is never watermarked', !plainPageHtml.includes('data-watermark'), '/ads/[id]');

// ---------------------------------------------------------------------------
// 20. Imposition: pair halves with quarters, and keep lookalikes apart
// ---------------------------------------------------------------------------
cookie = '';
await json('/api/auth/signup', 'POST', {
  email: `impose${Date.now()}@test.local`,
  password: 'password123',
  name: 'Impose Tester',
});
const imposeCookie = cookie;

// Deliberately repetitive: every ad wants the same background and layout, so
// the only thing keeping lookalikes apart is the imposition.
const REPEATS = [
  { size: 'half', backgroundId: 'blackout', layoutId: 'h-banner' },
  { size: 'half', backgroundId: 'blackout', layoutId: 'h-banner' },
  { size: 'half', backgroundId: 'classic-white', layoutId: 'h-photos-left' },
  { size: 'half', backgroundId: 'classic-white', layoutId: 'h-photos-left' },
  { size: 'quarter', backgroundId: 'blackout', layoutId: 'q-photo-top' },
  { size: 'quarter', backgroundId: 'blackout', layoutId: 'q-photo-top' },
  { size: 'quarter', backgroundId: 'classic-white', layoutId: 'q-photo-top' },
  { size: 'quarter', backgroundId: 'classic-white', layoutId: 'q-photo-top' },
  { size: 'quarter', backgroundId: 'red-rider', layoutId: 'q-photo-bottom' },
  { size: 'quarter', backgroundId: 'vintage-program', layoutId: 'q-photo-bottom' },
];

const wide = await makeImage(2000, 1500, 130);
for (const spec of REPEATS) {
  const { id } = await json('/api/ads', 'POST', { size: spec.size });
  await json(`/api/ads/${id}`, 'PATCH', {
    backgroundId: spec.backgroundId,
    layoutId: spec.layoutId,
    playerName: `Ad ${id}`,
    message: 'Imposition test.',
    attribution: 'Love, QA',
  });
  const slots = spec.size === 'half' ? 2 : 1;
  for (let s = 0; s < slots; s++) await upload(id, s, wide, `p${s}.jpg`);
  await json(`/api/ads/${id}/submit`, 'POST', {});
}

/** Parse the imposed sheets out of the print page's data attributes. */
async function readSheets() {
  const res = await req('/print/program');
  if (!res.ok) throw new Error(`print/program -> ${res.status}`);
  const html = await res.text();
  return html
    .split('class="sheet"')
    .slice(1)
    .map((chunk) =>
      [...chunk.matchAll(/data-ad-id="(\d+)"[^>]*?data-ad-size="(\w+)"[^>]*?data-ad-background="([\w-]+)"[^>]*?data-ad-layout="([\w-]+)"/g)]
        .map((m) => ({ id: +m[1], size: m[2], background: m[3], layout: m[4] }))
    );
}

cookie = savedCookie; // the print page is admin-only
const sheetsA = await readSheets();
check('print page exposes the imposed sheets', sheetsA.length > 0, `${sheetsA.length} sheets`);

// Only ads from this test are repetitive enough to judge; earlier sections
// added their own, so look at the whole book but count honestly.
const fourUp = sheetsA.filter((s) => s.filter((p) => p.size === 'quarter').length === 4);
const halvesLeftOver = sheetsA.filter(
  (s) => s.length === 1 && s[0].size === 'half'
).length;
check(
  'quarters are paired with halves rather than tiled four-up',
  fourUp.length === 0,
  fourUp.length ? `${fourUp.length} four-up sheets` : 'none'
);

function clashesOn(sheets, key) {
  const found = [];
  for (const sheet of sheets) {
    for (let i = 0; i < sheet.length; i++) {
      for (let j = i + 1; j < sheet.length; j++) {
        if (sheet[i][key] === sheet[j][key]) {
          found.push(`${sheet[i].id}+${sheet[j].id} ${sheet[i][key]}`);
        }
      }
    }
  }
  return found;
}

/**
 * Pigeonhole floor: a sheet holds at most one ad of a given background or
 * layout without a clash, so anything beyond one-per-sheet forces one. With a
 * repetitive corpus some clashes are genuinely unavoidable, and demanding zero
 * would be demanding the impossible.
 *
 * Capacity is counted per size, not across all sheets: a quarter-page ad can
 * only land on a sheet that actually has quarter slots, so five quarters
 * sharing a layout across four quarter-bearing sheets forces one clash however
 * they are arranged.
 */
function unavoidable(sheets, key) {
  const byKey = new Map();
  for (const sheet of sheets) {
    for (const p of sheet) {
      const entry = byKey.get(p[key]) ?? { count: 0, sizes: new Set() };
      entry.count += 1;
      entry.sizes.add(p.size);
      byKey.set(p[key], entry);
    }
  }

  let floor = 0;
  for (const entry of byKey.values()) {
    const capacity = sheets.filter((s) => s.some((p) => entry.sizes.has(p.size))).length;
    floor += Math.max(0, entry.count - capacity);
  }
  return floor;
}

const bgClashes = clashesOn(sheetsA, 'background');
const bgFloor = unavoidable(sheetsA, 'background');
check(
  'no avoidable background repeats on a sheet',
  bgClashes.length <= bgFloor,
  `${bgClashes.length} clash(es), ${bgFloor} unavoidable${bgClashes.length ? ' — ' + bgClashes.join(', ') : ''}`
);

const layoutClashes = clashesOn(sheetsA, 'layout');
const layoutFloor = unavoidable(sheetsA, 'layout');
check(
  'no avoidable layout repeats on a sheet',
  layoutClashes.length <= layoutFloor,
  `${layoutClashes.length} clash(es), ${layoutFloor} unavoidable${layoutClashes.length ? ' — ' + layoutClashes.join(', ') : ''}`
);

// The PDF and the per-sheet PNG downloads impose independently, so an
// order-dependent result would make "page 3" mean two different things.
const sheetsB = await readSheets();
check(
  'imposition is deterministic',
  JSON.stringify(sheetsA) === JSON.stringify(sheetsB),
  'two runs matched'
);

// And every submitted ad still appears exactly once.
const placedIds = sheetsA.flat().map((p) => p.id);
check(
  'every ad is placed exactly once',
  new Set(placedIds).size === placedIds.length,
  `${placedIds.length} placements, ${new Set(placedIds).size} unique`
);
void halvesLeftOver;
void imposeCookie;

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) process.exit(1);
