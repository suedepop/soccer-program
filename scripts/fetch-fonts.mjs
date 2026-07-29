#!/usr/bin/env node
/**
 * Downloads the ad fonts into public/fonts/ and regenerates src/app/fonts.css.
 *
 *   node scripts/fetch-fonts.mjs
 *
 * The fonts are self-hosted on purpose. The parent's preview runs in their
 * browser and the 300 DPI render runs in headless Chrome on the server; if a
 * family were only installed on one of them, the printed ad would quietly
 * differ from the one that got approved. Serving the same woff2 files to both
 * removes that whole class of bug — and keeps the app working offline.
 *
 * Only the `latin` subset is fetched. It covers English plus the curly quotes
 * and dashes parents actually type (U+2000–206F).
 *
 * Run this only when adding or removing a family; the files are committed.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT_DIR = path.join(ROOT, 'public', 'fonts');
const CSS_PATH = path.join(ROOT, 'src', 'app', 'fonts.css');

// A modern desktop UA is required or the API serves ttf instead of woff2.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * id must match the ids in src/lib/fonts.ts.
 *
 * Weights are requested as RANGES (`400..900`) rather than discrete values.
 * Google serves these families as variable fonts, so a range yields one file
 * per style declared `font-weight: 400 900` — which lets a player name render
 * at a genuinely heavy 800 instead of a browser-synthesised fake bold.
 */
const FAMILIES = [
  { id: 'playfair', family: 'Playfair Display', axis: 'ital,wght@0,400..900;1,400..900' },
  { id: 'lora', family: 'Lora', axis: 'ital,wght@0,400..700;1,400..700' },
  { id: 'montserrat', family: 'Montserrat', axis: 'ital,wght@0,400..900;1,400..900' },
  { id: 'nunito', family: 'Nunito', axis: 'ital,wght@0,400..1000;1,400..1000' },
  { id: 'oswald', family: 'Oswald', axis: 'wght@400..700' },
  { id: 'anton', family: 'Anton', axis: null },
  { id: 'bebas', family: 'Bebas Neue', axis: null },
  { id: 'dancing', family: 'Dancing Script', axis: 'wght@400..700' },
  { id: 'special-elite', family: 'Special Elite', axis: null },
];

await fs.mkdir(OUT_DIR, { recursive: true });

/** Pulls the `latin` @font-face blocks out of a Google Fonts CSS response. */
function latinFaces(css) {
  const faces = [];
  const re = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const [, subset, body] = m;
    if (subset !== 'latin') continue;
    const style = /font-style:\s*([\w]+)/.exec(body)?.[1] ?? 'normal';
    // Keep the whole descriptor — for variable faces this is a range such as
    // "400 900", and truncating it to the first number would pin the font to a
    // single instance and silently kill the heavier weights.
    const weight = (/font-weight:\s*([^;]+)/.exec(body)?.[1] ?? '400').trim();
    const url = /src:\s*url\(([^)]+)\)/.exec(body)?.[1];
    if (url) faces.push({ style, weight, url });
  }
  return faces;
}

const rules = [];
let total = 0;

for (const { id, family, axis } of FAMILIES) {
  const spec = axis ? `${family.replace(/ /g, '+')}:${axis}` : family.replace(/ /g, '+');
  const url = `https://fonts.googleapis.com/css2?family=${spec}&display=block`;

  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${family}: css request failed (${res.status})`);
  const faces = latinFaces(await res.text());
  if (!faces.length) throw new Error(`${family}: no latin faces found`);

  // With ranges there is normally one file per style. Download each distinct
  // URL once; only fall back to a weight-qualified name if a family really does
  // ship separate files per weight.
  const byUrl = new Map();
  const claimed = new Map();

  for (const face of faces) {
    const base = `${id}${face.style === 'italic' ? '-italic' : ''}`;
    const owner = claimed.get(base);
    let file;
    if (owner === undefined || owner === face.url) {
      claimed.set(base, face.url);
      file = `${base}.woff2`;
    } else {
      file = `${base}-${face.weight.replace(/\s+/g, '_')}.woff2`;
    }

    if (!byUrl.has(face.url)) {
      const bin = await fetch(face.url, { headers: { 'User-Agent': UA } });
      if (!bin.ok) throw new Error(`${family} ${face.weight} ${face.style}: download failed`);
      const buf = Buffer.from(await bin.arrayBuffer());
      await fs.writeFile(path.join(OUT_DIR, file), buf);
      byUrl.set(face.url, file);
      total += buf.byteLength;
      console.log(`  ${file}  weight ${face.weight}  ${(buf.byteLength / 1024).toFixed(1)} KB`);
    }

    rules.push(
      `@font-face {\n` +
        `  font-family: '${family}';\n` +
        `  font-style: ${face.style};\n` +
        `  font-weight: ${face.weight};\n` +
        // `block` rather than `swap`: a screenshot must never catch the
        // fallback face mid-load. Paired with the document.fonts.ready wait
        // in src/lib/render.ts, nothing renders until the real font is in.
        `  font-display: block;\n` +
        `  src: url('/fonts/${byUrl.get(face.url)}') format('woff2');\n` +
        `}`
    );
  }
  console.log(`${family}: ${faces.length} face(s)`);
}

const header =
  `/*\n` +
  ` * Generated by scripts/fetch-fonts.mjs — do not edit by hand.\n` +
  ` *\n` +
  ` * Self-hosted so the browser preview and the headless-Chrome print render\n` +
  ` * load byte-identical files. Add a family in that script and in\n` +
  ` * src/lib/fonts.ts, then re-run it.\n` +
  ` */\n\n`;

await fs.writeFile(CSS_PATH, header + rules.join('\n\n') + '\n');

console.log(`\nWrote ${rules.length} faces (${(total / 1024).toFixed(0)} KB) to public/fonts/`);
console.log(`Wrote ${path.relative(ROOT, CSS_PATH)}`);
