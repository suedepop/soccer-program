/**
 * The fonts parents can pick for an ad.
 *
 * Every family here is self-hosted from public/fonts (see
 * scripts/fetch-fonts.mjs) so the browser preview and the headless-Chrome print
 * render load identical files. Never add a family that is only assumed to be
 * installed — that is how a preview and a print file silently diverge.
 *
 * `avgGlyph` and `boldRatio` are measured, not guessed:
 *
 *   node scripts/measure-fonts.mjs
 *
 * src/lib/fit.ts sizes text by counting characters instead of measuring it, so
 * these constants are what keep the fitting honest across families. Re-run the
 * script and paste the numbers back in whenever the font list changes.
 */

export type FontCategory = 'serif' | 'sans' | 'display' | 'script';

export interface AdFont {
  id: string;
  /** Shown to parents in the picker. */
  name: string;
  blurb: string;
  category: FontCategory;
  /** CSS font-family, with system fallbacks if the woff2 ever fails to load. */
  stack: string;
  /** Mean glyph advance as a fraction of the em, at weight 400. */
  avgGlyph: number;
  /** How much wider the same text runs at weight 700. */
  boldRatio: number;
  /**
   * Weight used for the player's name. These are real instances of the
   * variable font, not browser-synthesised bold.
   */
  headingWeight: number;
  /**
   * Mean glyph advance at {@link headingWeight}. Heavier weights are wider —
   * Montserrat gains 11% from 400 to 900 — so names must be fitted with this,
   * not avgGlyph, or long ones overflow their box.
   */
  headingGlyph: number;
  /** No true bold in the family — Chrome synthesises one. */
  syntheticBold?: boolean;
  /** Optical correction so families read at a similar size at the same px. */
  scale: number;
  /** Families with tall ascenders or long descenders need more leading. */
  lineHeight: number;
}

export const FONTS: AdFont[] = [
  {
    id: 'montserrat',
    name: 'Montserrat',
    blurb: 'Clean modern sans. Wide and confident.',
    category: 'sans',
    stack: "'Montserrat', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.487,
    boldRatio: 1.06,
    headingWeight: 900,
    headingGlyph: 0.539,
    scale: 1,
    lineHeight: 1.4,
  },
  {
    id: 'oswald',
    name: 'Oswald',
    blurb: 'Tall and condensed. Reads like a team jersey.',
    category: 'display',
    stack: "'Oswald', 'Arial Narrow', Impact, sans-serif",
    avgGlyph: 0.352,
    boldRatio: 1.13,
    headingWeight: 700,
    headingGlyph: 0.398,
    scale: 0.96,
    lineHeight: 1.34,
  },
  {
    id: 'anton',
    name: 'Anton',
    blurb: 'Heavy poster sans. The loudest name on the page.',
    category: 'display',
    stack: "'Anton', 'Arial Narrow', Impact, sans-serif",
    avgGlyph: 0.397,
    boldRatio: 1.0,
    headingWeight: 400,
    headingGlyph: 0.397,
    syntheticBold: true,
    scale: 0.98,
    lineHeight: 1.22,
  },
  {
    id: 'bebas',
    name: 'Bebas Neue',
    blurb: 'All caps, poster style. Best for names, not paragraphs.',
    category: 'display',
    stack: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
    avgGlyph: 0.332,
    boldRatio: 1.0,
    headingWeight: 400,
    headingGlyph: 0.332,
    syntheticBold: true,
    scale: 0.98,
    lineHeight: 1.18,
  },
  {
    id: 'nunito',
    name: 'Nunito',
    blurb: 'Rounded and friendly. Good for underclassmen.',
    category: 'sans',
    stack: "'Nunito', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.44,
    boldRatio: 1.04,
    headingWeight: 1000,
    headingGlyph: 0.491,
    scale: 1,
    lineHeight: 1.42,
  },
  {
    id: 'playfair',
    name: 'Playfair',
    blurb: 'Elegant, high-contrast serif. Dressy.',
    category: 'serif',
    stack: "'Playfair Display', Georgia, 'Times New Roman', serif",
    avgGlyph: 0.433,
    boldRatio: 1.019,
    headingWeight: 900,
    headingGlyph: 0.447,
    scale: 1,
    lineHeight: 1.4,
  },
  {
    id: 'lora',
    name: 'Lora',
    blurb: 'Warm book serif. Easy to read in long messages.',
    category: 'serif',
    stack: "'Lora', Georgia, 'Times New Roman', serif",
    avgGlyph: 0.454,
    boldRatio: 1.025,
    headingWeight: 700,
    headingGlyph: 0.465,
    scale: 1,
    lineHeight: 1.42,
  },
  {
    id: 'dancing',
    name: 'Dancing Script',
    blurb: 'Handwritten. Lovely for “Love, Mom and Dad”.',
    category: 'script',
    stack: "'Dancing Script', 'Segoe Script', cursive",
    avgGlyph: 0.351,
    boldRatio: 1.025,
    headingWeight: 700,
    headingGlyph: 0.36,
    scale: 1.18,
    lineHeight: 1.5,
  },
  {
    id: 'special-elite',
    name: 'Typewriter',
    blurb: 'Vintage typewriter. Pairs with the older backgrounds.',
    category: 'display',
    stack: "'Special Elite', 'Courier New', monospace",
    avgGlyph: 0.508,
    boldRatio: 1.0,
    headingWeight: 400,
    headingGlyph: 0.508,
    syntheticBold: true,
    scale: 1.02,
    lineHeight: 1.45,
  },
];

/** Sentinel meaning "whatever the chosen background pairs with". */
export const FONT_INHERIT = '';

export function getFont(id: string): AdFont {
  return FONTS.find((f) => f.id === id) ?? FONTS[0];
}

/** Resolves an ad's override against the background's default. */
export function resolveFont(override: string | undefined | null, fallbackId: string): AdFont {
  if (override && FONTS.some((f) => f.id === override)) return getFont(override);
  return getFont(fallbackId);
}

export function isFontId(id: string): boolean {
  return FONTS.some((f) => f.id === id);
}
