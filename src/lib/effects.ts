import type { CSSProperties } from 'react';

/**
 * Optional treatments for the player's name.
 *
 * Every effect is expressed as a multiple of the font size, so it looks the
 * same on a quarter page as on a full page and survives the preview →
 * 300 DPI scale-up unchanged. Outlines are built from stacked text-shadows
 * rather than -webkit-text-stroke: a stroke is painted centred over the glyph
 * and eats into the letterforms, whereas shadows sit cleanly behind them and
 * render identically in Chrome's screenshot and PDF paths.
 *
 * Colours come from the chosen background, so an effect never has to guess
 * whether it is sitting on white or black.
 */

export interface EffectColors {
  heading: string;
  accent: string;
  dark: boolean;
}

export interface NameEffect {
  id: string;
  name: string;
  blurb: string;
  /**
   * `ink` overrides the colour the effect would pick for itself. Undefined —
   * the default — means "work it out from the background", which is what every
   * ad got before the colour was offered, and what the Automatic option
   * restores.
   */
  style(fontSize: number, colors: EffectColors, ink?: string): CSSProperties;
}

/** The Red Riders' red and the near-black everything else is drawn in. */
const RED = '#C8102E';
const INK = '#12100F';

/**
 * Effect colours contrast with the *lettering*, which is what a ring or a
 * shadow actually touches — not with the background. Picking by background is
 * the obvious-looking mistake: it yields a dark ring on a dark page and a white
 * ring on a white one, both invisible.
 *
 * Which leaves two colours, and they are not interchangeable:
 *
 * - **Outlines are red** on the white lettering the dark backgrounds use. Ink
 *   would be the safe contrast against white, but it is the page's own colour —
 *   the ring vanishes into it. Red reads against both, and it is the jersey
 *   look the whole book is set in.
 * - **Shadows and glows are black** there. A shadow is meant to be read as
 *   depth rather than as a second colour, and on the photographic backgrounds
 *   it is what stops white type from dissolving into a bright patch of turf.
 *
 * Dark lettering on a light page is the mirror image and needs neither rule:
 * the accent (red) reads against it, and ink covers the backgrounds whose
 * accent *is* their lettering colour.
 */
function isLight(color: string): boolean {
  return lightness(color) > 0.6;
}

/** Ring colour: red around pale lettering, the accent around dark lettering. */
function outlineInk(colors: EffectColors): string {
  if (isLight(colors.heading)) {
    // A pale accent — the pinks two of the photographic backgrounds carry —
    // is no more visible on white lettering than white would be.
    return isLight(colors.accent) ? RED : colors.accent;
  }
  return colors.accent.toLowerCase() === colors.heading.toLowerCase() ? INK : colors.accent;
}

/** Shadow and halo colour: black behind pale lettering, otherwise as above. */
function shadowInk(colors: EffectColors): string {
  return isLight(colors.heading) ? INK : outlineInk(colors);
}

/** #rgb / #rrggbb to its three 0–255 channels. */
function channels(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full =
    h.length === 3
      ? h
          .split('')
          .map((c) => c + c)
          .join('')
      : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Perceived lightness of a #rgb / #rrggbb colour, 0 (black) to 1 (white). */
function lightness(hex: string): number {
  const [r, g, b] = channels(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** The same colour at partial opacity — soft shadows and haloes are not solid. */
function withAlpha(hex: string, alpha: number): string {
  const [r, g, b] = channels(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * The colours a parent may pick for an effect, on top of Automatic. Deliberately
 * the program's own palette rather than a free colour wheel: these ads are
 * printed side by side in one book, and a hand-mixed lime green would be
 * somebody else's page as much as their own.
 */
export interface NameEffectColor {
  id: string;
  name: string;
  hex: string;
}

export const NAME_EFFECT_COLORS: NameEffectColor[] = [
  { id: 'red', name: 'Red', hex: RED },
  { id: 'deep-red', name: 'Deep Red', hex: '#8E0B20' },
  { id: 'black', name: 'Black', hex: INK },
  { id: 'white', name: 'White', hex: '#FFFFFF' },
  { id: 'cream', name: 'Cream', hex: '#F8F4EA' },
];

/** '' is Automatic — the colour the effect works out from the background. */
export const DEFAULT_NAME_EFFECT_COLOR = '';

export function isNameEffectColorId(id: string): boolean {
  return id === '' || NAME_EFFECT_COLORS.some((c) => c.id === id);
}

/** The hex for a stored id, or undefined for Automatic / anything unknown. */
export function getNameEffectColor(id: string | undefined): string | undefined {
  return NAME_EFFECT_COLORS.find((c) => c.id === id)?.hex;
}

/**
 * Ring of shadow copies around the glyph — a clean outline with no erosion.
 *
 * The copies are point offsets rather than a true dilation, so a wide ring
 * needs both more of them and a second ring at half the radius: past a few
 * pixels the band would otherwise open up where a letter thins to a hairline.
 */
function ring(radius: number, color: string): string {
  const radii = radius > 3 ? [radius, radius * 0.5] : [radius];
  const offsets: string[] = [];
  for (const r of radii) {
    const steps = r > 3 ? 16 : 8;
    for (let i = 0; i < steps; i++) {
      const angle = (i / steps) * Math.PI * 2;
      const x = +(Math.cos(angle) * r).toFixed(2);
      const y = +(Math.sin(angle) * r).toFixed(2);
      offsets.push(`${x}px ${y}px 0 ${color}`);
    }
  }
  return offsets.join(', ');
}

export const NAME_EFFECTS: NameEffect[] = [
  {
    id: '',
    name: 'None',
    blurb: 'Just the letters.',
    style: () => ({}),
  },
  {
    id: 'soft-shadow',
    name: 'Soft Shadow',
    blurb: 'A gentle drop shadow. Adds depth without shouting.',
    style: (f, c, ink) => {
      const alpha = c.dark ? 0.75 : 0.4;
      return {
        textShadow: `0 ${(f * 0.05).toFixed(2)}px ${(f * 0.1).toFixed(2)}px ${
          ink ? withAlpha(ink, alpha) : `rgba(0,0,0,${alpha})`
        }`,
      };
    },
  },
  {
    id: 'hard-shadow',
    name: 'Hard Shadow',
    blurb: 'Solid offset shadow, like a jersey number.',
    style: (f, c, ink) => {
      const offset = (f * 0.055).toFixed(2);
      return { textShadow: `${offset}px ${offset}px 0 ${ink ?? shadowInk(c)}` };
    },
  },
  {
    id: 'glow',
    name: 'Glow',
    blurb: 'A soft halo. Best on the darker backgrounds.',
    style: (f, c, ink) => {
      // Soft enough to spread rather than ring, but the same black a shadow
      // uses — keying the halo off the background instead is what put a white
      // glow on the white names of every dark background, where it did nothing.
      const halo = ink
        ? withAlpha(ink, 0.8)
        : isLight(c.heading)
          ? 'rgba(0,0,0,0.8)'
          : shadowInk(c);
      return {
        textShadow: `0 0 ${(f * 0.08).toFixed(2)}px ${halo}, 0 0 ${(f * 0.22).toFixed(
          2
        )}px ${halo}, 0 0 ${(f * 0.45).toFixed(2)}px ${halo}`,
      };
    },
  },
  {
    id: 'outline',
    name: 'Outline',
    blurb: 'A crisp edge around every letter.',
    style: (f, c, ink) => ({
      textShadow: ring(Math.max(1, f * 0.03), ink ?? outlineInk(c)),
    }),
  },
  {
    id: 'thick-outline',
    name: 'Thick Outline',
    blurb: 'Twice the edge — a bold border around every letter.',
    style: (f, c, ink) => ({
      textShadow: ring(Math.max(2, f * 0.06), ink ?? outlineInk(c)),
    }),
  },
  {
    id: 'outline-glow',
    name: 'Outline + Glow',
    blurb: 'Outlined and lit. The most dramatic option.',
    style: (f, c, ink) => {
      const r = Math.max(1, f * 0.03);
      // A picked colour goes on the ring; the glow beyond it stays dark either
      // way, because it is depth around the ring rather than a second colour
      // competing with it.
      const halo = isLight(c.heading) ? 'rgba(0,0,0,0.85)' : INK;
      return {
        textShadow: `${ring(r, ink ?? outlineInk(c))}, 0 0 ${(f * 0.32).toFixed(2)}px ${halo}`,
      };
    },
  },
];

export const DEFAULT_NAME_EFFECT = '';

export function getNameEffect(id: string): NameEffect {
  return NAME_EFFECTS.find((e) => e.id === id) ?? NAME_EFFECTS[0];
}

export function isNameEffectId(id: string): boolean {
  return NAME_EFFECTS.some((e) => e.id === id);
}
