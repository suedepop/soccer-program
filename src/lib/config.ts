/**
 * Everything the athletic boosters are likely to want to change year to year
 * lives here. No other file should hard-code prices, dates, or school names.
 */

export const SCHOOL = {
  name: 'Weir High School',
  program: 'Weir High Soccer',
  mascot: 'Red Riders',
  season: '2026 Season',
  contactEmail: 'soccerprogram@example.com',
  contactName: 'Weir High Soccer Boosters',
  /** Shown on the landing page and the checkout screen. */
  deadline: 'September 12, 2026',
  /** Payment instructions — we collect money off-site. */
  paymentInstructions: [
    'Make checks payable to **Weir High Soccer Boosters**.',
    'Mail or drop off at the high school office, attn: Soccer Boosters.',
    'Venmo: **@WeirHighSoccer** — include your name and player name in the note.',
  ],
} as const;

export type AdSize = 'full' | 'half' | 'quarter';

export const AD_SIZES: Record<
  AdSize,
  {
    id: AdSize;
    label: string;
    /** Finished trim size in inches. */
    widthIn: number;
    heightIn: number;
    maxPhotos: number;
    priceCents: number;
    blurb: string;
  }
> = {
  full: {
    id: 'full',
    label: 'Full Page',
    widthIn: 8.5,
    heightIn: 11,
    maxPhotos: 3,
    priceCents: 10000,
    blurb: 'The whole page. Up to 3 photos and plenty of room for a long message.',
  },
  half: {
    id: 'half',
    label: 'Half Page',
    widthIn: 8.5,
    heightIn: 5.5,
    maxPhotos: 2,
    priceCents: 6000,
    blurb: 'Landscape half page. Up to 2 photos.',
  },
  quarter: {
    id: 'quarter',
    label: 'Quarter Page',
    widthIn: 4.25,
    heightIn: 5.5,
    maxPhotos: 1,
    priceCents: 3500,
    blurb: 'A single photo and a short message. Our most popular option.',
  },
};

export const AD_SIZE_ORDER: AdSize[] = ['full', 'half', 'quarter'];

/**
 * How many photos one account may keep in its library. Photos are uploaded
 * once and then placed into any number of ads, so this is a per-person cap on
 * stored images, not on ads.
 */
export const MAX_LIBRARY_PHOTOS = 100;

/**
 * How far a photo may be zoomed inside its slot. 1 is "fill the slot exactly";
 * anything below that would expose the frame, so it is the hard floor.
 *
 * Zooming spends resolution — at 2x only half the source pixels cover the same
 * printed inch — so `photoQuality` divides effective DPI by the zoom.
 */
export const MIN_PHOTO_ZOOM = 1;
export const MAX_PHOTO_ZOOM = 4;

/**
 * Manual nudge on the message and "from" type size, on top of the automatic
 * fitting. 1 is whatever the fitter chose.
 *
 * It is a *request*, not an override: the fitter still refuses to overflow the
 * box, so asking for more than fits simply gets you the largest that does.
 */
export const MIN_TEXT_SCALE = 0.7;
export const MAX_TEXT_SCALE = 1.4;
export const TEXT_SCALE_STEP = 0.05;

/** Print resolution the printer wants. Drives every "photo too small" warning. */
export const PRINT_DPI = 300;

/** Screen CSS pixels per inch. 1in = 96px is the CSS spec; do not change. */
export const CSS_DPI = 96;

/**
 * Scale factor headless Chrome uses so an 8.5x11 page at 96dpi comes out as a
 * 2550x3300 pixel image.
 */
export const PRINT_SCALE = PRINT_DPI / CSS_DPI; // 3.125

export const TEAMS = [
  { id: 'boys', label: "Boys' Soccer" },
  { id: 'girls', label: "Girls' Soccer" },
  { id: 'both', label: 'Both Teams / General Supporter' },
] as const;

export type TeamId = (typeof TEAMS)[number]['id'];

export const AD_STATUS = {
  draft: { id: 'draft', label: 'Draft', tone: 'muted' },
  submitted: { id: 'submitted', label: 'Payment Due', tone: 'warn' },
  paid: { id: 'paid', label: 'Paid', tone: 'ok' },
  cancelled: { id: 'cancelled', label: 'Cancelled', tone: 'bad' },
} as const;

export type AdStatus = keyof typeof AD_STATUS;

export function formatMoney(cents: number): string {
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

/**
 * Text a new ad starts with, so the live preview shows a real, laid-out ad
 * from the first second instead of an empty frame.
 *
 * Because these are stored values rather than greyed-out hints, an untouched
 * ad would otherwise pass the "is it filled in?" check and go to print reading
 * "Lorem ipsum". `validateForSubmit` compares against them and refuses — see
 * the note there about which fields are treated as placeholders.
 */
export const DEFAULT_AD_TEXT = {
  playerName: 'Player Name',
  message:
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Suspendisse faucibus eget lorem sed tincidunt. Curabitur id libero sit amet magna lobortis gravida.',
  attribution: '- All of us at work',
} as const;

/** Limits on the text a parent can actually see — markup is not counted. */
export const TEXT_LIMITS = {
  playerName: 60,
  message: 600,
  attribution: 90,
} as const;

/**
 * What the column will hold. Bold/italic/underline markers are stored inline,
 * so the stored string is longer than the visible one. Generous headroom here
 * means formatting never quietly eats into a parent's character budget.
 */
export const STORAGE_LIMITS = {
  playerName: TEXT_LIMITS.playerName * 2 + 20,
  message: TEXT_LIMITS.message * 2 + 40,
  attribution: TEXT_LIMITS.attribution * 2 + 20,
} as const;
