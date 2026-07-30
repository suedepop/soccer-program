/**
 * The fonts parents can pick for an ad.
 *
 * Every family here is self-hosted from public/fonts (see
 * scripts/fetch-fonts.mjs) so the browser preview and the headless-Chrome print
 * render load identical files. Never add a family that is only assumed to be
 * installed — that is how a preview and a print file silently diverge.
 *
 * `avgGlyph`, `boldRatio` and `headingGlyph` are measured, not guessed:
 *
 *   node scripts/measure-fonts.mjs
 *
 * src/lib/fit.ts sizes text by counting characters instead of measuring it, so
 * these constants are what keep the fitting honest across families. Re-run the
 * script and paste the numbers back in whenever the font list changes.
 *
 * A family is offered for the player's name, for the message, or both — see
 * {@link NAME_FONT_IDS} and {@link MESSAGE_FONT_IDS}. The two jobs want
 * different things: a name wants a heavy weight and can be all caps, while a
 * message has to stay readable at 13px in four-point type on a quarter page.
 * Everything stays in one registry so an id stored on an ad keeps resolving
 * even if that family is later dropped from one of the lists.
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

/**
 * The registry, in the order the name picker lists them, with the
 * message-only families last.
 *
 * `scale` for the display families is the ratio of Montserrat's cap height to
 * theirs, measured at 200px, so a name set in Antonio — whose caps are 23%
 * taller than Montserrat's — does not tower over the same name in the family
 * next to it in the picker. The message families keep the values they were
 * already tuned with; those are judged on lowercase, not caps, and Bebas Neue
 * is the proof that cap height alone is the wrong measure for them (its 'x' is
 * a capital, so an x-height model puts it 10% out).
 */
export const FONTS: AdFont[] = [
  {
    id: 'google-sans-flex',
    name: 'Google Sans',
    blurb: 'Neutral and modern. Nothing shouts.',
    category: 'sans',
    stack: "'Google Sans Flex', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.436,
    boldRatio: 1.084,
    headingWeight: 900,
    headingGlyph: 0.495,
    scale: 0.97,
    lineHeight: 1.43,
  },
  {
    id: 'roboto',
    name: 'Roboto',
    blurb: 'Plain and dependable. Gets out of the way.',
    category: 'sans',
    stack: "'Roboto', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.431,
    boldRatio: 1.016,
    headingWeight: 900,
    headingGlyph: 0.441,
    scale: 0.99,
    lineHeight: 1.38,
  },
  {
    id: 'inter',
    name: 'Inter',
    blurb: 'Crisp and even. Very legible at any size.',
    category: 'sans',
    stack: "'Inter', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.464,
    boldRatio: 1.026,
    headingWeight: 900,
    headingGlyph: 0.487,
    scale: 0.96,
    lineHeight: 1.39,
  },
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
    id: 'roboto-condensed',
    name: 'Roboto Condensed',
    blurb: 'Narrow. Fits a long name without shrinking it.',
    category: 'sans',
    stack: "'Roboto Condensed', 'Arial Narrow', Arial, sans-serif",
    avgGlyph: 0.384,
    boldRatio: 1.018,
    headingWeight: 900,
    headingGlyph: 0.394,
    scale: 0.99,
    lineHeight: 1.38,
  },
  {
    id: 'raleway',
    name: 'Raleway',
    blurb: 'Elegant sans with a little flourish in the W.',
    category: 'sans',
    stack: "'Raleway', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.447,
    boldRatio: 1.037,
    headingWeight: 900,
    headingGlyph: 0.478,
    scale: 0.99,
    lineHeight: 1.35,
  },
  {
    id: 'rubik',
    name: 'Rubik',
    blurb: 'Softened corners. Sturdy but friendly.',
    category: 'sans',
    stack: "'Rubik', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.45,
    boldRatio: 1.064,
    headingWeight: 900,
    headingGlyph: 0.504,
    scale: 1,
    lineHeight: 1.36,
  },
  {
    id: 'outfit',
    name: 'Outfit',
    blurb: 'Geometric and even. Very clean set large.',
    category: 'sans',
    stack: "'Outfit', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.428,
    boldRatio: 1.034,
    headingWeight: 900,
    headingGlyph: 0.456,
    scale: 1.01,
    lineHeight: 1.45,
  },
  {
    id: 'smooch-sans',
    name: 'Smooch Sans',
    blurb: 'Tall and airy. Understated for a big name.',
    category: 'display',
    stack: "'Smooch Sans', 'Arial Narrow', Arial, sans-serif",
    avgGlyph: 0.303,
    boldRatio: 1.027,
    // Asked for 740 of a 100–900 axis, so this is a real instance, not the
    // family's maximum — headingGlyph is measured at 740 to match.
    headingWeight: 740,
    headingGlyph: 0.312,
    scale: 1.13,
    lineHeight: 1.38,
  },
  {
    id: 'libre-baskerville',
    name: 'Libre Baskerville',
    blurb: 'Sturdy book serif. Traditional and warm.',
    category: 'serif',
    stack: "'Libre Baskerville', Georgia, 'Times New Roman', serif",
    avgGlyph: 0.496,
    boldRatio: 1.021,
    headingWeight: 700,
    headingGlyph: 0.506,
    scale: 0.91,
    lineHeight: 1.42,
  },
  {
    id: 'orbitron',
    name: 'Orbitron',
    blurb: 'Square and technical. Looks fast.',
    category: 'display',
    stack: "'Orbitron', 'Trebuchet MS', Arial, sans-serif",
    avgGlyph: 0.537,
    boldRatio: 1.022,
    headingWeight: 900,
    headingGlyph: 0.554,
    scale: 0.97,
    lineHeight: 1.44,
  },
  {
    id: 'noto-sans-display',
    name: 'Noto Sans Display',
    blurb: 'Neutral sans drawn for headlines.',
    category: 'sans',
    stack: "'Noto Sans Display', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.434,
    boldRatio: 1.083,
    headingWeight: 800,
    headingGlyph: 0.478,
    scale: 0.98,
    lineHeight: 1.57,
  },
  {
    id: 'antonio',
    name: 'Antonio',
    blurb: 'Tall and condensed. Reads like a team jersey.',
    category: 'display',
    stack: "'Antonio', 'Arial Narrow', Impact, sans-serif",
    avgGlyph: 0.367,
    boldRatio: 1.024,
    // Antonio's weight axis stops at 700. Asking for 900 would have Chrome
    // smear a fake bold over it, which at print resolution looks like a
    // printing fault rather than a heavier font.
    headingWeight: 700,
    headingGlyph: 0.376,
    // Its caps are 23% taller than Montserrat's — the largest correction in
    // the set, and without it every Antonio name dwarfs its neighbours.
    scale: 0.81,
    lineHeight: 1.49,
  },
  {
    id: 'strichpunkt-sans',
    name: 'Strichpunkt Sans',
    blurb: 'Swiss-style grotesque. Precise and quiet.',
    category: 'sans',
    stack: "'Strichpunkt Sans', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.436,
    boldRatio: 1.036,
    headingWeight: 740,
    headingGlyph: 0.454,
    scale: 1,
    lineHeight: 1.49,
  },
  {
    id: 'doto',
    name: 'Doto',
    blurb: 'Dot matrix, like a scoreboard.',
    category: 'display',
    stack: "'Doto', 'Courier New', monospace",
    // Every glyph sits on the same grid, so the advance never changes: this is
    // the one family whose bold and heading widths equal its 400 width. The
    // weight is real all the same — it fattens each dot, taking the ink from
    // 0.9% of the pixels at 100 to 14.1% at 900.
    avgGlyph: 0.6,
    boldRatio: 1,
    headingWeight: 900,
    headingGlyph: 0.6,
    scale: 1.03,
    lineHeight: 1.38,
  },
  {
    id: 'jaro',
    name: 'Jaro',
    blurb: 'Soft and wide. Playful without being cute.',
    category: 'display',
    stack: "'Jaro', 'Trebuchet MS', Arial, sans-serif",
    avgGlyph: 0.4,
    boldRatio: 1,
    // One weight only, and it is the one asked for.
    headingWeight: 400,
    headingGlyph: 0.4,
    syntheticBold: true,
    scale: 1.04,
    lineHeight: 1.43,
  },
  {
    id: 'big-shoulders-stencil',
    name: 'Big Shoulders Stencil',
    blurb: 'Condensed stencil. Cut out like a kit bag.',
    category: 'display',
    stack: "'Big Shoulders Stencil', 'Arial Narrow', Impact, sans-serif",
    avgGlyph: 0.328,
    boldRatio: 1.164,
    headingWeight: 800,
    headingGlyph: 0.395,
    scale: 0.88,
    lineHeight: 1.38,
  },
  {
    id: 'inter-tight',
    name: 'Inter Tight',
    blurb: 'Inter packed closer. Good for long names.',
    category: 'sans',
    stack: "'Inter Tight', 'Helvetica Neue', Arial, sans-serif",
    avgGlyph: 0.418,
    boldRatio: 1.064,
    headingWeight: 800,
    headingGlyph: 0.453,
    scale: 0.96,
    lineHeight: 1.39,
  },
  {
    id: 'cinzel',
    name: 'Cinzel',
    blurb: 'Roman capitals. Carved and formal.',
    category: 'serif',
    stack: "'Cinzel', Georgia, 'Times New Roman', serif",
    avgGlyph: 0.539,
    boldRatio: 1.017,
    headingWeight: 900,
    headingGlyph: 0.554,
    scale: 1,
    lineHeight: 1.54,
  },
  {
    id: 'big-shoulders-inline',
    name: 'Big Shoulders Inline',
    blurb: 'Condensed with a stripe through it. Varsity.',
    category: 'display',
    stack: "'Big Shoulders Inline', 'Arial Narrow', Impact, sans-serif",
    avgGlyph: 0.329,
    boldRatio: 1.167,
    headingWeight: 900,
    headingGlyph: 0.41,
    scale: 0.88,
    lineHeight: 1.38,
  },
  {
    id: 'bebas',
    name: 'Bebas Neue',
    blurb: 'All caps, poster style. Best for names, not paragraphs.',
    category: 'display',
    stack: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
    avgGlyph: 0.332,
    boldRatio: 1.0,
    // Bebas Neue ships as a single 400 weight. 600 would be a synthesised
    // smear, so the name is drawn at the weight the family actually has.
    headingWeight: 400,
    headingGlyph: 0.332,
    syntheticBold: true,
    scale: 0.98,
    lineHeight: 1.18,
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

  // ---- message only ----
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

/**
 * Offered for the player's name, in picker order.
 *
 * Heavy weights and all-caps faces belong here and nowhere else: Big Shoulders
 * Inline has a stripe through every stroke, which is a name at 40px and an
 * unreadable mess in a 13px message.
 */
export const NAME_FONT_IDS = [
  'google-sans-flex',
  'roboto',
  'inter',
  'montserrat',
  'roboto-condensed',
  'raleway',
  'rubik',
  'outfit',
  'smooch-sans',
  'libre-baskerville',
  'orbitron',
  'noto-sans-display',
  'antonio',
  'strichpunkt-sans',
  'doto',
  'jaro',
  'big-shoulders-stencil',
  'inter-tight',
  'cinzel',
  'big-shoulders-inline',
  'bebas',
  'playfair',
  'dancing',
] as const;

/** Offered for the message and the "from" line, in picker order. */
export const MESSAGE_FONT_IDS = [
  'montserrat',
  'nunito',
  'playfair',
  'lora',
  'dancing',
  'special-elite',
] as const;

export type FontRole = 'name' | 'message';

/** The families a given picker should offer, in order. */
export function fontsFor(role: FontRole): AdFont[] {
  const ids: readonly string[] = role === 'name' ? NAME_FONT_IDS : MESSAGE_FONT_IDS;
  return ids.map((id) => getFont(id));
}

/** Sentinel meaning "whatever the chosen background pairs with". */
export const FONT_INHERIT = '';

/**
 * Last resort when an id matches nothing — an ad saved against a family that
 * has since been removed. Named rather than positional so reordering FONTS
 * cannot quietly change what a broken id falls back to.
 */
export const FALLBACK_FONT_ID = 'montserrat';

export function getFont(id: string): AdFont {
  return (
    FONTS.find((f) => f.id === id) ??
    FONTS.find((f) => f.id === FALLBACK_FONT_ID) ??
    FONTS[0]
  );
}

/** Resolves an ad's override against the background's default. */
export function resolveFont(override: string | undefined | null, fallbackId: string): AdFont {
  if (override && FONTS.some((f) => f.id === override)) return getFont(override);
  return getFont(fallbackId);
}

export function isFontId(id: string): boolean {
  return FONTS.some((f) => f.id === id);
}
