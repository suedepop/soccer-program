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
  /** The parent's manual size request. 1 leaves the fitting alone. */
  scale?: number;
}

export interface Fit {
  fontSize: number;
  lineHeight: number;
  /**
   * True when the box, not the request, decided the size — i.e. asking for
   * bigger would change nothing. Lets the editor disable its "+" button rather
   * than leaving a control that silently does nothing.
   */
  capped: boolean;
}

/**
 * Nothing readable lives below this. The search runs all the way down to it so
 * that a fit always exists: returning an over-large size "because the floor
 * said so" would spill text across the rest of the ad.
 */
const ABSOLUTE_MIN = 6;

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
  const {
    avgGlyph = DEFAULT_GLYPH,
    minRatio = 0.5,
    maxRatio = 1.35,
    lineHeight = 1.4,
    scale = 1,
  } = opts;

  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  // The manual scale moves the whole band the fitter searches, so at scale 1
  // the result is exactly what it always was.
  const nominal = baseSize * scale;
  const requested = nominal * maxRatio;

  const linesAt = (size: number) => {
    const charsPerLine = Math.max(6, Math.floor(boxW / (size * avgGlyph)));
    let lines = 0;
    for (const p of paragraphs) {
      const trimmed = p.trim();
      if (!trimmed) {
        lines += 1;
        continue;
      }
      // Text wraps at spaces, so a line stops as soon as the next word will
      // not fit — losing up to a whole word off the end. Dividing by the raw
      // character limit under-counts lines, which is how a long message could
      // be sized to "fit" and then spill out of its box.
      //
      // One average word is the allowance that matched real rendered line
      // counts across scripts/text-fit.mjs; half a word was measurably too
      // optimistic on narrow columns.
      const words = trimmed.split(/\s+/).length;
      const averageWord = trimmed.length / words;
      const usable = Math.max(4, charsPerLine - averageWord);
      lines += Math.max(1, Math.ceil(trimmed.length / usable));
    }
    return lines;
  };

  for (let size = requested; size >= ABSOLUTE_MIN; size -= 0.5) {
    // Growing past the nominal size has to leave breathing room, or short
    // messages end up jammed against whatever sits below them.
    const ceiling = size > nominal ? boxH * 0.8 : boxH;
    if (linesAt(size) * size * lineHeight <= ceiling) {
      return {
        fontSize: round(size),
        lineHeight,
        // Only "capped" if we had to come down from what was asked for.
        capped: size < requested - 0.001,
      };
    }
  }

  return { fontSize: ABSOLUTE_MIN, lineHeight: Math.min(lineHeight, 1.2), capped: true };
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
      return { fontSize: round(size), lineHeight: NAME_LINE_HEIGHT, capped: size < baseSize };
    }
  }

  // Nothing fit even at the floor — shrink to whatever keeps it on the page.
  const fallback = Math.min(
    min,
    (boxW * MAX_NAME_LINES) / (len * avgGlyph * CAPS_ALLOWANCE),
    boxH / (MAX_NAME_LINES * NAME_LINE_HEIGHT)
  );
  return {
    fontSize: round(Math.max(4, fallback)),
    lineHeight: NAME_LINE_HEIGHT,
    capped: true,
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
