#!/usr/bin/env node
/**
 * Development aid: creates one ad for every layout, renders each at print
 * resolution, and tiles them into contact-sheet PNGs so you can eyeball all
 * the designs at once. Requires the app to be running and an admin account.
 *
 *   node scripts/contact-sheet.mjs <admin-email> <password> [outDir]
 */
import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.PRINT_BASE_URL || 'http://127.0.0.1:3000';
const [email, password, outDir = './contact-sheets'] = process.argv.slice(2);
if (!email || !password) {
  console.error('Usage: node scripts/contact-sheet.mjs <admin-email> <password> [outDir]');
  process.exit(1);
}

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
  const res = await req(p, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${p} -> ${res.status} ${JSON.stringify(j)}`);
  return j;
}

const LAYOUTS = {
  full: ['f-hero', 'f-triptych', 'f-stacked-left', 'f-collage', 'f-medallion', 'f-magazine', 'f-full-bleed'],
  half: ['h-photos-left', 'h-photos-right', 'h-banner', 'h-split-center', 'h-feature-inset', 'h-text-top'],
  quarter: ['q-photo-top', 'q-photo-bottom', 'q-portrait-circle', 'q-side-by-side'],
};
const BACKGROUNDS = [
  'classic-white', 'red-rider', 'blackout', 'jersey-stripes', 'pitch-lines', 'corner-chevrons',
  'halftone-fade', 'vintage-program', 'stadium-lights', 'hex-ball',
  'chalk-script',
  // Photographic — worth proofing at print size, since the type sits on a busy
  // field rather than a flat one.
  'turf-light', 'turf-dark', 'home-field-light', 'home-field-dark',
  'soccerball-light', 'soccerball-dark',
  'wall-light', 'wood-light', 'canvas-light', 'blurredlights-light',
  'net-light', 'pitch-light', 'corner-light',
  'charcoal-dark', 'corrosion-dark', 'gravel-dark', 'stitches-dark',
  'net-dark', 'largestadium-dark',
];
// Designs that assume a portrait page — see `sizes` in src/lib/backgrounds.ts.
// The app coerces these away on a half page, so pairing one with a half layout
// would silently proof Classic White instead of what the label claims.
const PORTRAIT_ONLY = new Set(['corner-chevrons']);
const backgroundsForSize = (size) =>
  size === 'half' ? BACKGROUNDS.filter((b) => !PORTRAIT_ONLY.has(b)) : BACKGROUNDS;
// Keep in step with NAME_FONT_IDS / MESSAGE_FONT_IDS in src/lib/fonts.ts. The
// two are proofed separately because they are no longer the same list: setting a
// message in Big Shoulders Inline would prove nothing about a face that is only
// ever offered for a name.
const NAME_FONTS = [
  'google-sans-flex', 'roboto', 'inter', 'montserrat', 'roboto-condensed',
  'raleway', 'rubik', 'outfit', 'smooch-sans', 'libre-baskerville',
  'orbitron', 'noto-sans-display', 'antonio', 'strichpunkt-sans', 'doto',
  'jaro', 'big-shoulders-stencil', 'inter-tight', 'cinzel',
  'big-shoulders-inline', 'bebas', 'playfair', 'dancing',
];
const MESSAGE_FONTS = ['montserrat', 'nunito', 'playfair', 'lora', 'dancing', 'special-elite'];
const EFFECTS = ['', 'soft-shadow', 'hard-shadow', 'glow', 'outline', 'outline-glow'];
const COPY = {
  playerName: 'Kylie Marsh',
  message:
    'Kylie, we have **loved** watching you play over the years and can’t wait to see what the future holds. Keep smiling on and off the field, __you are a joy to watch__.',
  attribution: '*Love, Mom and Dad*',
};

/** Numbered placeholder so you can tell which slot is which. */
async function placeholder(n, w = 1800, h = 1400) {
  const colors = ['#4a6b8a', '#8a5a4a', '#4a8a63'];
  return sharp({
    create: { width: w, height: h, channels: 3, background: colors[n % 3] },
  })
    .composite([
      {
        input: Buffer.from(
          `<svg width="${w}" height="${h}"><text x="50%" y="50%" font-size="${h / 4}" fill="rgba(255,255,255,.6)" font-family="Arial" text-anchor="middle" dominant-baseline="central">${n + 1}</text></svg>`
        ),
        top: 0,
        left: 0,
      },
    ])
    .jpeg()
    .toBuffer();
}

async function upload(adId, slot, buf) {
  const form = new FormData();
  form.set('slot', String(slot));
  form.set('file', new File([buf], `p${slot}.jpg`, { type: 'image/jpeg' }));
  const res = await req(`/api/ads/${adId}/photos`, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`upload slot ${slot}: ${res.status}`);
}

await json('/api/auth/login', 'POST', { email, password });
await fs.mkdir(outDir, { recursive: true });

const photos = await Promise.all([0, 1, 2].map((n) => placeholder(n)));
const TILE = 420;

/** Each pass is a set of (size, layout, background) combinations to tile. */
const passes = [
  ...Object.entries(LAYOUTS).map(([size, layoutIds]) => ({
    name: `${size}-layouts`,
    size,
    combos: layoutIds.map((layoutId, i) => {
      const allowed = backgroundsForSize(size);
      return { layoutId, backgroundId: allowed[i % allowed.length] };
    }),
  })),
  {
    name: 'backgrounds',
    size: 'quarter',
    combos: BACKGROUNDS.map((backgroundId) => ({ layoutId: 'q-photo-top', backgroundId })),
  },
  {
    name: 'name-fonts',
    size: 'quarter',
    combos: NAME_FONTS.map((f) => ({
      layoutId: 'q-photo-top',
      backgroundId: 'classic-white',
      label: f,
      patch: { headingFont: f },
    })),
  },
  {
    name: 'message-fonts',
    size: 'quarter',
    combos: MESSAGE_FONTS.map((f) => ({
      layoutId: 'q-photo-top',
      backgroundId: 'classic-white',
      label: f,
      patch: { bodyFont: f },
    })),
  },
  // Effects on a light background and again on a dark one — they take their
  // colours from the background, so both need eyeballing.
  {
    name: 'effects-light',
    size: 'quarter',
    combos: EFFECTS.map((e) => ({
      layoutId: 'q-photo-top',
      backgroundId: 'classic-white',
      label: e || 'none',
      patch: { nameEffect: e, headingFont: 'montserrat' },
    })),
  },
  {
    name: 'effects-dark',
    size: 'quarter',
    combos: EFFECTS.map((e) => ({
      layoutId: 'q-photo-top',
      backgroundId: 'blackout',
      label: e || 'none',
      patch: { nameEffect: e, headingFont: 'antonio' },
    })),
  },
];

for (const pass of passes) {
  const { size } = pass;
  const tiles = [];
  for (const { layoutId, backgroundId, patch, label } of pass.combos) {
    const { id } = await json('/api/ads', 'POST', { size });
    await json(`/api/ads/${id}`, 'PATCH', { ...COPY, layoutId, backgroundId, ...patch });

    const slots = { full: 3, half: 2, quarter: 1 }[size];
    for (let s = 0; s < slots; s++) await upload(id, s, photos[s]);

    const res = await req(`/api/admin/ads/${id}/png`);
    if (!res.ok) throw new Error(`render ${layoutId}: ${res.status}`);
    const png = Buffer.from(await res.arrayBuffer());
    tiles.push({
      label: label ?? `${layoutId} / ${backgroundId}`,
      buf: await sharp(png).resize({ width: TILE }).png().toBuffer(),
    });
    console.log(`rendered ${label ?? layoutId} on ${backgroundId}`);
  }

  const metas = await Promise.all(tiles.map((t) => sharp(t.buf).metadata()));
  const cols = size === 'quarter' ? 4 : size === 'half' ? 2 : 4;
  const rowH = Math.max(...metas.map((m) => m.height)) + 26;
  const rows = Math.ceil(tiles.length / cols);

  const canvas = sharp({
    create: {
      width: cols * (TILE + 16) + 16,
      height: rows * (rowH + 16) + 16,
      channels: 3,
      background: '#d9d5d2',
    },
  });
  const composites = tiles.flatMap((t, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const left = 16 + c * (TILE + 16);
    const top = 16 + r * (rowH + 16);
    return [
      { input: t.buf, left, top },
      {
        input: Buffer.from(
          `<svg width="${TILE}" height="22"><text x="0" y="15" font-size="13" font-family="Arial" fill="#222">${t.label}</text></svg>`
        ),
        left,
        top: top + rowH - 22,
      },
    ];
  });

  const outPath = path.join(outDir, `${pass.name}.png`);
  await canvas.composite(composites).png().toFile(outPath);
  console.log(`wrote ${outPath}`);
}
