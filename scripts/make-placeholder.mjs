#!/usr/bin/env node
/**
 * Draws the stand-in photo every new library starts with, and writes it to
 * public/placeholder/media-day-photo.png.
 *
 *   node scripts/make-placeholder.mjs
 *
 * Run it when the artwork should change; the PNG is committed, so nothing
 * renders this at runtime. Headless Chrome rather than sharp's SVG path
 * because this has text on it, and Chrome is the one renderer in this project
 * already guaranteed to have fonts.
 *
 * 2400x3200 (3:4 portrait) is deliberate: at 300 DPI that is 8x10.6 inches, so
 * it grades "sharp" in every slot the layouts offer and a parent never sees a
 * resolution warning on a picture we gave them.
 *
 * The figure and the words are kept tight and central on purpose. A landscape
 * slot crops a 3:4 portrait to its middle ~40%, and the first version lost the
 * word "[Placeholder]" off the bottom edge — which is the one word that has to
 * survive being dropped into an ad.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const OUT = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'placeholder',
  'media-day-photo.png'
);

const WIDTH = 1200;
const HEIGHT = 1600;

const html = `
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    background: #c9c5c1;
    font-family: "Segoe UI", Inter, Helvetica, Arial, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 40px;
    color: #57514d;
  }
  /* A dashed inset reads as "not a real photo" at a glance, even as a
     thumbnail where the words are too small to make out. */
  .frame {
    position: absolute;
    inset: 44px;
    border: 6px dashed #a8a29d;
    border-radius: 18px;
  }
  .figure { display: block; }
  .caption { text-align: center; line-height: 1.25; }
  .caption .title {
    font-size: 84px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .caption .sub {
    font-size: 62px;
    font-weight: 600;
    color: #7d7773;
    margin-top: 14px;
  }
</style>
<div class="frame"></div>
<svg class="figure" width="320" height="342" viewBox="0 0 88 94" fill="#8d8884" aria-hidden="true">
  <circle cx="44" cy="26" r="24" />
  <path d="M4 94c0-20.5 17.9-33 40-33s40 12.5 40 33z" />
</svg>
<div class="caption">
  <div class="title">Media Day Photo</div>
  <div class="sub">[Placeholder]</div>
</div>
`;

const browser = await puppeteer.launch();
const page = await browser.newPage();
// deviceScaleFactor 2 turns the 1200x1600 layout into a 2400x3200 file.
await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 2 });
await page.setContent(html, { waitUntil: 'load' });
await fs.mkdir(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, type: 'png' });
await browser.close();

const { size } = await fs.stat(OUT);
console.log(`Wrote ${OUT} (${WIDTH * 2}x${HEIGHT * 2}, ${Math.round(size / 1024)} KB)`);
