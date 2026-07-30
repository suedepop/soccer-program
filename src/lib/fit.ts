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

/**
 * Extra allowance for the single widest word in a name.
 *
 * avgGlyph is a mean over a prose sample, and one short word can sit a long way
 * above it: "Cromwell" in Montserrat's 900 weight averages about 0.63 em against
 * the family's 0.539, because m and w are far wider than the mean and there is
 * no long tail of narrow letters to pull it back. The mean is the right estimate
 * for a whole line of text and the wrong one for a single word.
 *
 * Tuned against measured renders of all nine families against the name corpus in
 * scripts/name-fit.mjs. Leaving it at CAPS_ALLOWANCE wrapped 65 of them to a
 * third line; 1.3 brings that to 19. It does not reach zero at any usable value
 * — an all-wide word like "Mummaw" needs about 1.6, and by then ordinary names
 * are being sized *smaller* than they were before they could grow at all, which
 * defeats the point. So this covers the common wide surname, and the growth path
 * below budgets a spare line for the rest rather than inflating this further.
 */
const WORD_ALLOWANCE = 1.3;

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
 *
 * `maxRatio` lets a layout with a tall name box grow the name past its nominal
 * size instead of stranding it in the top fifth of the box. It defaults to 1 —
 * never grow — because most name boxes are a single line's worth of height and
 * growing into them would push the name into the message.
 */
export function fitHeading(
  text: string,
  boxW: number,
  boxH: number,
  baseSize: number,
  opts: FitOptions = {}
): Fit {
  const { avgGlyph = DEFAULT_GLYPH, minRatio = 0.42, maxRatio = 1 } = opts;

  const plain = text.trim();
  const len = Math.max(1, plain.length);
  /**
   * Lines break at spaces, so the longest single word — not the average — is
   * what decides whether a line can hold its share of the name. Dividing the
   * character count by a character limit quietly assumes the text can break
   * anywhere: "Ava Kimberley" is 13 characters, which looks like two 7s, but
   * the second line has to carry all 9 of "Kimberley". That assumption is
   * harmless at the sizes this used to search and overflows the box once the
   * name is allowed to grow.
   */
  const longestWord = plain.split(/\s+/).reduce((n, w) => Math.max(n, w.length), 1);
  const min = baseSize * minRatio;
  const requested = baseSize * maxRatio;

  for (let size = requested; size >= min; size -= 0.5) {
    const em = size * avgGlyph * CAPS_ALLOWANCE;
    const charsPerLine = Math.max(4, Math.floor(boxW / em));
    const lines = Math.ceil(len / charsPerLine);
    /**
     * Growing is only safe if the box can absorb one more line than we think we
     * need. Everything here is an estimate from character counts, and the words
     * that beat it are exactly the wide ones — Montserrat's 900 weight draws
     * "Mummaw" at about 0.85 em a character against the family's 0.539 mean, so
     * a name the estimate puts on two lines can really take three. At the
     * nominal size that costs a slightly cramped look; grown to fill a tall box
     * it would push the name clear out of its box and into the message. Budget
     * for the extra line instead, which also leaves the two-line case the
     * breathing room it wants.
     */
    const budget = size > baseSize ? MAX_NAME_LINES + 1 : lines;
    if (
      lines <= MAX_NAME_LINES &&
      longestWord * size * avgGlyph * WORD_ALLOWANCE <= boxW &&
      budget * size * NAME_LINE_HEIGHT <= boxH
    ) {
      return { fontSize: round(size), lineHeight: NAME_LINE_HEIGHT, capped: size < requested };
    }
  }

  // Nothing fit even at the floor — shrink to whatever keeps it on the page.
  const fallback = Math.min(
    min,
    (boxW * MAX_NAME_LINES) / (len * avgGlyph * CAPS_ALLOWANCE),
    boxW / (longestWord * avgGlyph * WORD_ALLOWANCE),
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
