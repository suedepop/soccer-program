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
  style(fontSize: number, colors: EffectColors): CSSProperties;
}

/**
 * A colour that reads against the *lettering*, which is what an outline or a
 * hard shadow has to contrast with — not against the background. Picking by
 * background is the obvious-looking mistake: it yields a dark ring on a dark
 * page and a white ring on a white one, both invisible.
 *
 * The background's accent is the first choice (red rims on white lettering,
 * exactly the jersey look); when the accent is the lettering colour, fall back
 * to ink, which reads against every heading colour in the set.
 */
function contrastInk(colors: EffectColors): string {
  return colors.accent.toLowerCase() === colors.heading.toLowerCase()
    ? '#12100F'
    : colors.accent;
}

/** Eight-way shadow ring — a clean outline with no glyph erosion. */
function ring(radius: number, color: string): string {
  const steps = 8;
  const offsets: string[] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    const x = +(Math.cos(angle) * radius).toFixed(2);
    const y = +(Math.sin(angle) * radius).toFixed(2);
    offsets.push(`${x}px ${y}px 0 ${color}`);
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
    style: (f, c) => ({
      textShadow: `0 ${(f * 0.05).toFixed(2)}px ${(f * 0.1).toFixed(2)}px rgba(0,0,0,${
        c.dark ? 0.75 : 0.4
      })`,
    }),
  },
  {
    id: 'hard-shadow',
    name: 'Hard Shadow',
    blurb: 'Solid offset shadow, like a jersey number.',
    style: (f, c) => {
      const offset = (f * 0.055).toFixed(2);
      return { textShadow: `${offset}px ${offset}px 0 ${contrastInk(c)}` };
    },
  },
  {
    id: 'glow',
    name: 'Glow',
    blurb: 'A soft halo. Best on the darker backgrounds.',
    style: (f, c) => {
      const halo = c.dark ? 'rgba(255,255,255,0.55)' : c.accent;
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
    style: (f, c) => ({
      textShadow: ring(Math.max(1, f * 0.03), contrastInk(c)),
    }),
  },
  {
    id: 'outline-glow',
    name: 'Outline + Glow',
    blurb: 'Outlined and lit. The most dramatic option.',
    style: (f, c) => {
      const r = Math.max(1, f * 0.03);
      const halo = c.dark ? 'rgba(255,255,255,0.55)' : '#12100F';
      return {
        textShadow: `${ring(r, contrastInk(c))}, 0 0 ${(f * 0.32).toFixed(2)}px ${halo}`,
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
