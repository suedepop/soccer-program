import {
  AD_SIZES,
  MAX_PHOTO_ZOOM,
  MIN_PHOTO_ZOOM,
  PRINT_DPI,
  type AdSize,
} from './config';

/** All geometry is a percentage of the ad's own trim box. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PhotoSlot extends Box {
  shape?: 'rect' | 'circle';
  /** Photo runs to the trim edge — no frame, no shadow. */
  bleed?: boolean;
}

export type Align = 'left' | 'center' | 'right';

export interface Layout {
  id: string;
  size: AdSize;
  name: string;
  description: string;
  photos: PhotoSlot[];
  playerName: Box;
  message: Box;
  attribution: Box;
  align: Align;
  /** Multipliers applied to the size's base type scale. */
  nameScale?: number;
  messageScale?: number;
  attributionScale?: number;
  /**
   * How far past {@link nameScale} the name may grow when its box has the room.
   * Only for layouts whose name box is deliberately several lines tall — a name
   * in a one-line box must stay at its nominal size or it runs into the message.
   */
  nameMaxScale?: number;
  /** Draw a short rule under the player name. */
  rule?: boolean;
}

/**
 * Base type sizes in CSS px (96dpi), before per-layout scaling.
 *
 * The name is deliberately much larger than the body — it is the thing people
 * scan the program for. At 300 DPI a 66px full-page name prints at ~50pt.
 * The name boxes below are sized to give these a home; shrink one and the
 * fitter will quietly cap the name to whatever the box allows.
 */
export const TYPE_BASE: Record<AdSize, { name: number; message: number; attribution: number }> = {
  full: { name: 66, message: 25, attribution: 26 },
  half: { name: 46, message: 19, attribution: 21 },
  quarter: { name: 32, message: 13.5, attribution: 15 },
};

// ---------------------------------------------------------------- quarter --

const QUARTER: Layout[] = [
  {
    id: 'q-photo-top',
    size: 'quarter',
    name: 'Photo on Top',
    description: 'Landscape photo above the message. The safe, classic choice.',
    photos: [{ x: 8, y: 7, w: 84, h: 44 }],
    playerName: { x: 6, y: 53, w: 88, h: 9.5 },
    message: { x: 9, y: 63.5, w: 82, h: 22 },
    attribution: { x: 9, y: 86, w: 82, h: 7 },
    align: 'center',
    rule: true,
  },
  {
    id: 'q-photo-bottom',
    size: 'quarter',
    name: 'Message First',
    description: 'Name and message up top, photo anchoring the bottom.',
    photos: [{ x: 8, y: 45, w: 84, h: 41 }],
    playerName: { x: 6, y: 5, w: 88, h: 9.5 },
    message: { x: 9, y: 16, w: 82, h: 26 },
    attribution: { x: 9, y: 87.5, w: 82, h: 7 },
    align: 'center',
    rule: true,
  },
  {
    id: 'q-portrait-circle',
    size: 'quarter',
    name: 'Portrait Medallion',
    description: 'A round cropped portrait — great for a single headshot.',
    photos: [{ x: 17, y: 5, w: 66, h: 51, shape: 'circle' }],
    playerName: { x: 6, y: 57.5, w: 88, h: 9.5 },
    message: { x: 9, y: 68.5, w: 82, h: 18 },
    attribution: { x: 9, y: 87, w: 82, h: 7 },
    align: 'center',
  },
  {
    id: 'q-side-by-side',
    size: 'quarter',
    name: 'Photo & Name Side by Side',
    description: 'Photo top-left with the name beside it, message underneath.',
    photos: [{ x: 6, y: 7, w: 42, h: 38 }],
    playerName: { x: 51, y: 11, w: 43, h: 30 },
    message: { x: 6, y: 49, w: 88, h: 34 },
    attribution: { x: 6, y: 85, w: 88, h: 8 },
    align: 'left',
    nameScale: 0.86,
    /**
     * The only name box in the set that is a column rather than a line: it is
     * three lines tall so the name can stack beside the photo. At the nominal
     * size the name filled a fifth of it and read as an afterthought next to
     * the picture, so it grows until a two-line stack fills the column. 2 is
     * where a first-and-last name lands on two lines in every family without
     * the short ones ballooning.
     */
    nameMaxScale: 2,
  },
];

// ------------------------------------------------------------------- half --

const HALF: Layout[] = [
  {
    id: 'h-photos-left',
    size: 'half',
    name: 'Photos Left',
    description: 'Two stacked photos on the left, message filling the right.',
    // Photos run to x=36.2; the text column starts at 40 to keep the same
    // gutter it had when they were narrower.
    photos: [
      { x: 5, y: 8, w: 31.2, h: 40 },
      { x: 5, y: 52, w: 31.2, h: 40 },
    ],
    playerName: { x: 40, y: 9, w: 55, h: 15 },
    message: { x: 40, y: 26, w: 55, h: 52 },
    attribution: { x: 40, y: 80, w: 55, h: 11 },
    align: 'left',
    rule: true,
  },
  {
    id: 'h-photos-right',
    size: 'half',
    name: 'Photos Right',
    description: 'Mirror of Photos Left — message reads first.',
    // Mirrored: photos still end at x=95, so they start further left and the
    // text column narrows to match.
    photos: [
      { x: 63.8, y: 8, w: 31.2, h: 40 },
      { x: 63.8, y: 52, w: 31.2, h: 40 },
    ],
    playerName: { x: 5, y: 9, w: 55, h: 15 },
    message: { x: 5, y: 26, w: 55, h: 52 },
    attribution: { x: 5, y: 80, w: 55, h: 11 },
    align: 'left',
    rule: true,
  },
  {
    id: 'h-one-left',
    size: 'half',
    name: 'One Photo, Left',
    description: 'A single tall photo down the left, name and message beside it.',
    // The margins are symmetric with One Photo, Right: picture 4->45, a 4-wide
    // gutter, text 49->96. Mirroring the pair swaps the two columns and nothing
    // else, so the two cards in the picker read as the same design either way.
    photos: [{ x: 4, y: 8, w: 41, h: 84 }],
    playerName: { x: 49, y: 9, w: 47, h: 15 },
    message: { x: 49, y: 26, w: 47, h: 52 },
    attribution: { x: 49, y: 80, w: 47, h: 11 },
    align: 'left',
    rule: true,
  },
  {
    id: 'h-one-right',
    size: 'half',
    name: 'One Photo, Right',
    description: 'Mirror of One Photo, Left — the message reads first.',
    photos: [{ x: 55, y: 8, w: 41, h: 84 }],
    playerName: { x: 4, y: 9, w: 47, h: 15 },
    message: { x: 4, y: 26, w: 47, h: 52 },
    attribution: { x: 4, y: 80, w: 47, h: 11 },
    align: 'left',
    rule: true,
  },
  {
    id: 'h-banner',
    size: 'half',
    name: 'Banner',
    description: 'Two photos side by side across the top, centered message below.',
    photos: [
      { x: 5, y: 7, w: 44, h: 48 },
      { x: 51, y: 7, w: 44, h: 48 },
    ],
    playerName: { x: 5, y: 58, w: 90, h: 11 },
    message: { x: 10, y: 70, w: 80, h: 19 },
    attribution: { x: 10, y: 89.5, w: 80, h: 7 },
    align: 'center',
  },
  {
    id: 'h-split-center',
    size: 'half',
    name: 'Bookends',
    description: 'A tall photo on each side with the message centered between.',
    photos: [
      { x: 4, y: 11, w: 24, h: 72 },
      { x: 72, y: 11, w: 24, h: 72 },
    ],
    playerName: { x: 30, y: 12, w: 40, h: 14 },
    message: { x: 30, y: 28, w: 40, h: 46 },
    attribution: { x: 30, y: 76, w: 40, h: 10 },
    align: 'center',
    nameScale: 0.9,
  },
  {
    id: 'h-feature-inset',
    size: 'half',
    name: 'Feature & Inset',
    description: 'One big feature photo with a smaller candid tucked beside the message.',
    photos: [
      { x: 4, y: 8, w: 38, h: 84 },
      { x: 45, y: 70, w: 51, h: 22 },
    ],
    playerName: { x: 45, y: 9, w: 51, h: 13 },
    message: { x: 45, y: 23, w: 51, h: 35 },
    attribution: { x: 45, y: 59, w: 51, h: 9 },
    align: 'left',
    nameScale: 0.9,
    rule: true,
  },
  {
    id: 'h-text-top',
    size: 'half',
    name: 'Message First',
    description: 'Name and message up top, two photos across the bottom.',
    photos: [
      { x: 5, y: 52, w: 44, h: 41 },
      { x: 51, y: 52, w: 44, h: 41 },
    ],
    playerName: { x: 5, y: 6, w: 90, h: 12 },
    message: { x: 10, y: 19.5, w: 80, h: 22 },
    attribution: { x: 10, y: 42, w: 80, h: 8 },
    align: 'center',
  },
];

// ------------------------------------------------------------------- full --

const FULL: Layout[] = [
  {
    id: 'f-hero',
    size: 'full',
    name: 'Hero',
    description: 'One large photo up top, two supporting shots at the bottom.',
    photos: [
      { x: 6, y: 5, w: 88, h: 38 },
      { x: 6, y: 75, w: 43, h: 20 },
      { x: 51, y: 75, w: 43, h: 20 },
    ],
    playerName: { x: 6, y: 44, w: 88, h: 9.5 },
    message: { x: 11, y: 54.5, w: 78, h: 13 },
    attribution: { x: 11, y: 68.5, w: 78, h: 5 },
    align: 'center',
    rule: true,
  },
  {
    id: 'f-one-top',
    size: 'full',
    name: 'One Photo, Top',
    description: 'One big photo across the top, and the rest of the page for your message.',
    // Nearly five inches tall and seven and a half wide: with no second photo to
    // sit beside, the picture takes the whole top of the page and the message
    // gets a taller box than any other full-page layout except the Triptych.
    photos: [{ x: 6, y: 5, w: 88, h: 45 }],
    playerName: { x: 6, y: 52.5, w: 88, h: 10 },
    message: { x: 11, y: 64, w: 78, h: 24 },
    attribution: { x: 11, y: 89.5, w: 78, h: 6 },
    align: 'center',
    rule: true,
  },
  {
    id: 'f-triptych',
    size: 'full',
    name: 'Triptych',
    description: 'Three equal photos in a row with a long message beneath.',
    photos: [
      { x: 5, y: 15, w: 29.3, h: 26 },
      { x: 35.35, y: 15, w: 29.3, h: 26 },
      { x: 65.7, y: 15, w: 29.3, h: 26 },
    ],
    playerName: { x: 6, y: 4.5, w: 88, h: 9 },
    message: { x: 11, y: 44, w: 78, h: 36 },
    attribution: { x: 11, y: 81.5, w: 78, h: 7 },
    align: 'center',
  },
  {
    id: 'f-stacked-left',
    size: 'full',
    name: 'Photo Column',
    description: 'Three photos stacked down the left, message running alongside.',
    photos: [
      { x: 5, y: 6, w: 34, h: 26 },
      { x: 5, y: 34, w: 34, h: 26 },
      { x: 5, y: 62, w: 34, h: 26 },
    ],
    playerName: { x: 42, y: 7.5, w: 53, h: 11 },
    message: { x: 42, y: 20, w: 53, h: 52 },
    attribution: { x: 42, y: 74, w: 53, h: 12 },
    align: 'left',
    nameScale: 0.9,
    rule: true,
  },
  {
    id: 'f-collage',
    size: 'full',
    name: 'Collage',
    description: 'A wide photo with two smaller ones stacked to its right.',
    photos: [
      { x: 5, y: 6, w: 56, h: 32 },
      { x: 63, y: 6, w: 32, h: 15.4 },
      { x: 63, y: 22.6, w: 32, h: 15.4 },
    ],
    playerName: { x: 6, y: 39.5, w: 88, h: 9.5 },
    message: { x: 11, y: 50.5, w: 78, h: 32 },
    attribution: { x: 11, y: 84, w: 78, h: 8 },
    align: 'center',
    rule: true,
  },
  {
    id: 'f-medallion',
    size: 'full',
    name: 'Portrait Medallion',
    description: 'A big round portrait, with two candids across the bottom.',
    photos: [
      { x: 24.5, y: 4, w: 51, h: 39.4, shape: 'circle' },
      { x: 12, y: 80.5, w: 32, h: 15 },
      { x: 56, y: 80.5, w: 32, h: 15 },
    ],
    playerName: { x: 6, y: 45.5, w: 88, h: 9.5 },
    message: { x: 13, y: 56.5, w: 74, h: 17.5 },
    attribution: { x: 13, y: 75.5, w: 74, h: 5 },
    align: 'center',
  },
  {
    id: 'f-magazine',
    size: 'full',
    name: 'Magazine',
    description: 'Two photos across the top, message in the middle, wide photo below.',
    photos: [
      { x: 5, y: 5, w: 43.5, h: 26 },
      { x: 51.5, y: 5, w: 43.5, h: 26 },
      { x: 5, y: 72, w: 90, h: 23 },
    ],
    playerName: { x: 6, y: 32.5, w: 88, h: 9.5 },
    message: { x: 11, y: 43.5, w: 78, h: 19 },
    attribution: { x: 11, y: 64.5, w: 78, h: 6 },
    align: 'center',
    rule: true,
  },
  {
    id: 'f-full-bleed',
    size: 'full',
    name: 'Full Bleed',
    description: 'Top photo runs edge to edge — the most dramatic option.',
    photos: [
      { x: 0, y: 0, w: 100, h: 50, bleed: true },
      { x: 12, y: 81, w: 30, h: 14 },
      { x: 58, y: 81, w: 30, h: 14 },
    ],
    playerName: { x: 6, y: 51.5, w: 88, h: 9 },
    message: { x: 11, y: 61, w: 78, h: 13 },
    attribution: { x: 11, y: 75.5, w: 78, h: 5 },
    align: 'center',
    rule: true,
  },
];

export const LAYOUTS: Layout[] = [...FULL, ...HALF, ...QUARTER];

export function layoutsFor(size: AdSize): Layout[] {
  return LAYOUTS.filter((l) => l.size === size);
}

export function getLayout(id: string, size?: AdSize): Layout {
  const found = LAYOUTS.find((l) => l.id === id && (!size || l.size === size));
  if (found) return found;
  return layoutsFor(size ?? 'quarter')[0];
}

export function defaultLayoutId(size: AdSize): string {
  return layoutsFor(size)[0].id;
}

/** Pixels a photo needs to hit {@link PRINT_DPI} in the given slot. */
export function requiredPixels(size: AdSize, slot: Box): { w: number; h: number } {
  const spec = AD_SIZES[size];
  return {
    w: Math.round((slot.w / 100) * spec.widthIn * PRINT_DPI),
    h: Math.round((slot.h / 100) * spec.heightIn * PRINT_DPI),
  };
}

export interface PhotoPlacement {
  /** Drawn size of the image, in the same units as slotW/slotH. */
  drawW: number;
  drawH: number;
  /** Offset of the image relative to the slot's top-left. Never positive. */
  left: number;
  top: number;
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return MIN_PHOTO_ZOOM;
  return Math.min(MAX_PHOTO_ZOOM, Math.max(MIN_PHOTO_ZOOM, zoom));
}

export function clampPan(value: number): number {
  if (!Number.isFinite(value)) return 0.5;
  return Math.min(1, Math.max(0, value));
}

/**
 * Works out where to draw a photo inside its slot.
 *
 * The image is first scaled to *cover* the slot, then multiplied by the zoom.
 * Because the cover scale already makes it at least as large as the slot and
 * zoom is clamped to >= 1, the drawn image is never smaller than the slot on
 * either axis — so `left`/`top` are always <= 0 and the overhang is always >= 0.
 * Panning only ever redistributes that overhang, which is what makes it
 * impossible to nudge the picture out of frame and expose the background.
 */
export function placePhoto(
  slotW: number,
  slotH: number,
  imgW: number,
  imgH: number,
  focalX: number,
  focalY: number,
  zoom: number
): PhotoPlacement {
  // A missing or unreadable image would divide by zero; fall back to the slot.
  if (!(imgW > 0) || !(imgH > 0)) {
    return { drawW: slotW, drawH: slotH, left: 0, top: 0 };
  }

  const cover = Math.max(slotW / imgW, slotH / imgH);
  const scale = cover * clampZoom(zoom);
  const drawW = imgW * scale;
  const drawH = imgH * scale;

  // Rounding can leave the drawn size a hair under the slot; never let the
  // overhang go negative or a sliver of background would show through.
  const overhangX = Math.max(0, drawW - slotW);
  const overhangY = Math.max(0, drawH - slotH);

  return {
    drawW,
    drawH,
    left: -overhangX * clampPan(focalX),
    top: -overhangY * clampPan(focalY),
  };
}

export type PhotoQuality = 'good' | 'fair' | 'low';

/**
 * A photo is scaled to *cover* its slot, so the binding constraint is whichever
 * axis has to stretch further. `fair` is the "it will print, but softly" band.
 *
 * Zoom spends resolution: at 2x, half as many source pixels cover the same
 * printed inch. Ignoring it would let a heavily cropped photo keep claiming to
 * be sharp right up until it came back blurry from the printer.
 */
export function photoQuality(
  size: AdSize,
  slot: Box,
  photo: { width: number; height: number },
  zoom = 1
): { quality: PhotoQuality; effectiveDpi: number; required: { w: number; h: number } } {
  const required = requiredPixels(size, slot);
  const ratio =
    Math.min(photo.width / required.w, photo.height / required.h) / clampZoom(zoom);
  const effectiveDpi = Math.round(PRINT_DPI * ratio);
  const quality: PhotoQuality = ratio >= 0.99 ? 'good' : ratio >= 0.66 ? 'fair' : 'low';
  return { quality, effectiveDpi, required };
}
