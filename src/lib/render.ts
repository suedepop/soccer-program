import 'server-only';
import type { Browser } from 'puppeteer';
import { AD_SIZES, CSS_DPI, PRINT_SCALE, type AdSize } from './config';

/**
 * Print rendering works by pointing headless Chrome at our own /print routes
 * and screenshotting them at a 3.125x device scale factor, which turns the
 * 96dpi CSS layout into a 300dpi image. The parent's preview and the printer's
 * file are literally the same DOM.
 */

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () => {
      const puppeteer = (await import('puppeteer')).default;
      return puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--font-render-hinting=none'],
      });
    })().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close();
  }
}

function baseUrl(): string {
  return (process.env.PRINT_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

async function withPage<T>(
  sessionCookie: string,
  fn: (page: import('puppeteer').Page) => Promise<T>
): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const { hostname } = new URL(baseUrl());
    await browser.setCookie({
      name: 'whs_session',
      value: sessionCookie,
      domain: hostname,
      path: '/',
      httpOnly: true,
    });
    return await fn(page);
  } finally {
    await page.close();
  }
}

async function settle(page: import('puppeteer').Page) {
  await page.waitForSelector('[data-print-ready]', { timeout: 30_000 });
  await page.evaluate(async () => {
    await (document as Document & { fonts: FontFaceSet }).fonts.ready;
    const imgs = Array.from(document.images);
    await Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise((res) => {
              img.addEventListener('load', res, { once: true });
              img.addEventListener('error', res, { once: true });
            })
      )
    );
  });
}

/** One ad as a print-resolution PNG (300 DPI at its trim size). */
export async function renderAdPng(adId: number, size: AdSize, sessionCookie: string) {
  const spec = AD_SIZES[size];
  const width = Math.round(spec.widthIn * CSS_DPI);
  const height = Math.round(spec.heightIn * CSS_DPI);

  return withPage(sessionCookie, async (page) => {
    await page.setViewport({ width, height, deviceScaleFactor: PRINT_SCALE });
    await page.goto(`${baseUrl()}/print/ad/${adId}`, {
      waitUntil: 'networkidle0',
      timeout: 60_000,
    });
    await settle(page);
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return Buffer.from(buf);
  });
}

/** The assembled book: every ad packed onto 8.5x11 sheets, as a PDF. */
export async function renderProgramPdf(sessionCookie: string, opts?: { paidOnly?: boolean }) {
  const qs = opts?.paidOnly ? '?paidOnly=1' : '';
  return withPage(sessionCookie, async (page) => {
    await page.setViewport({ width: 816, height: 1056, deviceScaleFactor: 1 });
    await page.goto(`${baseUrl()}/print/program${qs}`, {
      waitUntil: 'networkidle0',
      timeout: 120_000,
    });
    await settle(page);
    const buf = await page.pdf({
      width: '8.5in',
      height: '11in',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    });
    return Buffer.from(buf);
  });
}

/** A single sheet of the assembled book, as a 300 DPI PNG. */
export async function renderProgramPagePng(
  pageIndex: number,
  sessionCookie: string,
  opts?: { paidOnly?: boolean }
) {
  const width = 816;
  const height = 1056;
  const qs = new URLSearchParams({ page: String(pageIndex) });
  if (opts?.paidOnly) qs.set('paidOnly', '1');

  return withPage(sessionCookie, async (page) => {
    await page.setViewport({ width, height, deviceScaleFactor: PRINT_SCALE });
    await page.goto(`${baseUrl()}/print/program?${qs}`, {
      waitUntil: 'networkidle0',
      timeout: 60_000,
    });
    await settle(page);
    const buf = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width, height } });
    return Buffer.from(buf);
  });
}
