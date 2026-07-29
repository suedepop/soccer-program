/**
 * Deterministic type fitting.
 *
 * The preview in the browser and the 300 DPI render in headless Chrome must
 * agree exactly, so we never measure text — we estimate from character counts
 * using per-family constants from src/lib/fonts.ts. Same input, same font size,
 * every time.
 *
 * Pass the *visible* text (run it through stripMarkup first); the markup
 * characters are not drawn and must not count towards the fit.
 */

/** Fallback advance width if no font is supplied. Roughly Arial. */
const DEFAULT_GLYPH = 0.435;

export interface FitOptions {
  /** Mean glyph advance as a fraction of the em — AdFont.avgGlyph. */
  avgGlyph?: number;
  /** Floor as a multiple of the base size. */
  minRatio?: number;
  /** Ceiling as a multiple of the base size. */
  maxRatio?: number;
  lineHeight?: number;
}

export interface Fit {
  fontSize: number;
  lineHeight: number;
}

/**
 * Picks the largest size that fits. Short messages grow into the space instead
 * of stranding a couple of lines in the middle of a big box; long ones shrink.
 */
export function fitBodyText(
  text: string,
  boxW: number,
  boxH: number,
  baseSize: number,
  opts: FitOptions = {}
): Fit {
  const { avgGlyph = DEFAULT_GLYPH, minRatio = 0.5, maxRatio = 1.35, lineHeight = 1.4 } = opts;

  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const min = baseSize * minRatio;

  for (let size = baseSize * maxRatio; size >= min; size -= 0.5) {
    const charsPerLine = Math.max(6, Math.floor(boxW / (size * avgGlyph)));
    let lines = 0;
    for (const p of paragraphs) {
      lines += Math.max(1, Math.ceil(p.trim().length / charsPerLine));
    }
    // Growing past the base size has to leave breathing room, or short
    // messages end up jammed against whatever sits below them.
    const ceiling = size > baseSize ? boxH * 0.8 : boxH;
    if (lines * size * lineHeight <= ceiling) {
      return { fontSize: round(size), lineHeight };
    }
  }
  return { fontSize: round(min), lineHeight: Math.min(lineHeight, 1.3) };
}

/** Names are mostly capitals, which run wider than the measured prose sample. */
const CAPS_ALLOWANCE = 1.15;

/** Names longer than one line fall back to two rather than shrinking to nothing. */
const MAX_NAME_LINES = 2;
const NAME_LINE_HEIGHT = 1.12;

/**
 * Fits the player's name, preferring one big line.
 *
 * Pass `avgGlyph: font.headingGlyph` — names are drawn at the family's heavy
 * weight, which is materially wider than its 400.
 *
 * A single forced line is the wrong answer for a long name in a narrow column:
 * the size collapses until it is unreadable, and once it hits the floor it
 * stops shrinking and runs off the trim edge instead. So the search takes the
 * largest size that fits in at most two lines, which keeps
 * "Alexandria Vandenberghe-Whitfield" legible in a quarter-page side column.
 */
export function fitHeading(
  text: string,
  boxW: number,
  boxH: number,
  baseSize: number,
  opts: FitOptions = {}
): Fit {
  const { avgGlyph = DEFAULT_GLYPH, minRatio = 0.42 } = opts;

  const len = Math.max(1, text.trim().length);
  const min = baseSize * minRatio;

  for (let size = baseSize; size >= min; size -= 0.5) {
    const charsPerLine = Math.max(4, Math.floor(boxW / (size * avgGlyph * CAPS_ALLOWANCE)));
    const lines = Math.ceil(len / charsPerLine);
    if (lines <= MAX_NAME_LINES && lines * size * NAME_LINE_HEIGHT <= boxH) {
      return { fontSize: round(size), lineHeight: NAME_LINE_HEIGHT };
    }
  }

  // Nothing fit even at the floor — shrink to whatever keeps it on the page.
  const fallback = Math.min(
    min,
    (boxW * MAX_NAME_LINES) / (len * avgGlyph * CAPS_ALLOWANCE),
    boxH / (MAX_NAME_LINES * NAME_LINE_HEIGHT)
  );
  return { fontSize: round(Math.max(4, fallback)), lineHeight: NAME_LINE_HEIGHT };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
