import type { CSSProperties } from 'react';

/**
 * Backgrounds are pure CSS (gradients + inline SVG data URIs) on purpose:
 * headless Chrome renders them identically to the browser preview with no
 * asset loading, so the print file always matches what the parent saw.
 */

export interface Background {
  id: string;
  name: string;
  /** Base fill for the whole ad. */
  base: CSSProperties;
  /** Decorative layer painted over the base, under the content. */
  overlay?: CSSProperties;
  /** Inset rule/frame drawn inside the trim edge. */
  frame?: CSSProperties;
  colors: {
    heading: string;
    text: string;
    accent: string;
    /** Border drawn around photos. */
    photoFrame: string;
    photoShadow: string;
  };
  /**
   * Default type pairing — ids from src/lib/fonts.ts. Parents can override
   * either one per ad; these are just the starting point.
   */
  fonts: { heading: string; body: string };
  /** True when the field is dark — used to pick contrasting UI chrome. */
  dark: boolean;
}

const RED = '#C8102E';
const DEEP_RED = '#8E0B20';
const INK = '#12100F';
const CREAM = '#F8F4EA';

function svg(markup: string): string {
  return `url("data:image/svg+xml,${encodeURIComponent(markup)}")`;
}

export const BACKGROUNDS: Background[] = [
  {
    id: 'classic-white',
    name: 'Classic White',
    base: { background: '#FFFFFF' },
    frame: {
      inset: '2.2%',
      border: `3px solid ${RED}`,
      outline: `1px solid ${INK}`,
      outlineOffset: '5px',
    },
    colors: {
      heading: RED,
      text: INK,
      accent: RED,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.18)',
    },
    fonts: { heading: 'montserrat', body: 'lora' },
    dark: false,
  },
  {
    id: 'red-rider',
    name: 'Red Rider',
    base: {
      background: `linear-gradient(160deg, ${RED} 0%, ${RED} 45%, ${DEEP_RED} 100%)`,
    },
    overlay: {
      background:
        'repeating-linear-gradient(115deg, rgba(255,255,255,0.05) 0 2px, rgba(255,255,255,0) 2px 22px)',
    },
    frame: { inset: '2.5%', border: '2px solid rgba(255,255,255,0.8)' },
    colors: {
      heading: '#FFFFFF',
      text: '#FDF3F4',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.35)',
    },
    fonts: { heading: 'oswald', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'blackout',
    name: 'Blackout',
    base: { background: '#0B0B0C' },
    overlay: {
      background: `radial-gradient(120% 70% at 50% 0%, rgba(200,16,46,0.55) 0%, rgba(200,16,46,0.12) 45%, rgba(0,0,0,0) 75%)`,
    },
    frame: { inset: '2.5%', border: `2px solid ${RED}` },
    colors: {
      heading: '#FFFFFF',
      text: '#E9E6E4',
      accent: RED,
      photoFrame: RED,
      photoShadow: 'rgba(0,0,0,0.6)',
    },
    fonts: { heading: 'bebas', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'jersey-stripes',
    name: 'Jersey Stripes',
    base: { background: '#FFFFFF' },
    overlay: {
      background: `
        repeating-linear-gradient(45deg, ${RED} 0 14px, ${INK} 14px 28px, transparent 28px 29px),
        repeating-linear-gradient(45deg, transparent 0 100%)`,
      WebkitMaskImage:
        'linear-gradient(to bottom, #000 0 7%, transparent 7% 93%, #000 93% 100%)',
      maskImage: 'linear-gradient(to bottom, #000 0 7%, transparent 7% 93%, #000 93% 100%)',
    },
    colors: {
      heading: INK,
      text: '#221F1E',
      accent: RED,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.2)',
    },
    fonts: { heading: 'oswald', body: 'montserrat' },
    dark: false,
  },
  {
    id: 'pitch-lines',
    name: 'Pitch Lines',
    base: { background: `linear-gradient(180deg, #16151A 0%, #0B0B0C 100%)` },
    overlay: {
      backgroundImage: svg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="2"><rect x="14" y="14" width="372" height="492"/><line x1="14" y1="260" x2="386" y2="260"/><circle cx="200" cy="260" r="66"/><circle cx="200" cy="260" r="4" fill="rgba(255,255,255,0.22)" stroke="none"/><rect x="104" y="14" width="192" height="76"/><rect x="104" y="430" width="192" height="76"/><path d="M14 44 A30 30 0 0 0 44 14"/><path d="M386 44 A30 30 0 0 1 356 14"/><path d="M14 476 A30 30 0 0 1 44 506"/><path d="M386 476 A30 30 0 0 0 356 506"/></svg>`
      ),
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
      opacity: 0.85,
    },
    colors: {
      heading: '#FFFFFF',
      text: '#EDEBE9',
      accent: RED,
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.55)',
    },
    fonts: { heading: 'oswald', body: 'nunito' },
    dark: true,
  },
  {
    id: 'corner-chevrons',
    name: 'Corner Chevrons',
    base: { background: '#FFFFFF' },
    overlay: {
      backgroundImage: svg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520"><path d="M0 0 L100 0 L0 112 Z" fill="${RED}"/><path d="M0 0 L56 0 L0 63 Z" fill="${INK}"/><path d="M400 520 L300 520 L400 408 Z" fill="${RED}"/><path d="M400 520 L344 520 L400 457 Z" fill="${INK}"/></svg>`
      ),
      backgroundSize: '100% 100%',
      backgroundRepeat: 'no-repeat',
    },
    colors: {
      heading: INK,
      text: '#232020',
      accent: RED,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.2)',
    },
    fonts: { heading: 'montserrat', body: 'nunito' },
    dark: false,
  },
  {
    id: 'halftone-fade',
    name: 'Halftone Fade',
    base: { background: `linear-gradient(200deg, ${RED} 0%, ${DEEP_RED} 55%, ${INK} 100%)` },
    overlay: {
      backgroundImage:
        'radial-gradient(rgba(255,255,255,0.35) 1.4px, transparent 1.6px)',
      backgroundSize: '11px 11px',
      WebkitMaskImage: 'linear-gradient(200deg, #000 0%, transparent 70%)',
      maskImage: 'linear-gradient(200deg, #000 0%, transparent 70%)',
    },
    frame: { inset: '3%', border: '1px solid rgba(255,255,255,0.55)' },
    colors: {
      heading: '#FFFFFF',
      text: '#F7EFEF',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.4)',
    },
    fonts: { heading: 'montserrat', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'vintage-program',
    name: 'Vintage Program',
    base: { background: CREAM },
    overlay: {
      backgroundImage:
        'radial-gradient(rgba(140,110,80,0.10) 1px, transparent 1.2px), radial-gradient(120% 90% at 50% 50%, rgba(0,0,0,0) 55%, rgba(90,60,30,0.14) 100%)',
      backgroundSize: '5px 5px, 100% 100%',
    },
    frame: {
      inset: '3%',
      border: `2px double ${DEEP_RED}`,
      outline: `1px solid rgba(30,20,10,0.35)`,
      outlineOffset: '6px',
    },
    colors: {
      heading: DEEP_RED,
      text: '#2C241C',
      accent: DEEP_RED,
      photoFrame: '#2C241C',
      photoShadow: 'rgba(70,50,30,0.25)',
    },
    fonts: { heading: 'oswald', body: 'lora' },
    dark: false,
  },
  {
    id: 'stadium-lights',
    name: 'Stadium Lights',
    base: { background: '#0A0A0B' },
    overlay: {
      background: `
        radial-gradient(70% 50% at 50% 38%, rgba(255,250,235,0.30) 0%, rgba(255,250,235,0.06) 45%, rgba(0,0,0,0) 72%),
        radial-gradient(140% 100% at 50% 120%, rgba(200,16,46,0.35) 0%, rgba(0,0,0,0) 60%)`,
    },
    colors: {
      heading: '#FFF9EC',
      text: '#E6E1D8',
      accent: '#FFC7CF',
      photoFrame: 'rgba(255,249,236,0.9)',
      photoShadow: 'rgba(0,0,0,0.65)',
    },
    fonts: { heading: 'bebas', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'hex-ball',
    name: 'Hex Ball',
    base: { background: '#FBFBFB' },
    overlay: {
      backgroundImage: svg(
        `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="70" viewBox="0 0 60 70"><g fill="none" stroke="rgba(18,16,15,0.13)" stroke-width="2"><polygon points="30,2 56,17 56,47 30,62 4,47 4,17"/></g></svg>`
      ),
      backgroundSize: '58px 68px',
      opacity: 0.9,
    },
    frame: { inset: '2.8%', border: `4px solid ${RED}` },
    colors: {
      heading: INK,
      text: '#1F1C1B',
      accent: RED,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.18)',
    },
    fonts: { heading: 'anton', body: 'nunito' },
    dark: false,
  },
  {
    id: 'red-black-split',
    name: 'Red & Black Split',
    base: {
      background: `linear-gradient(118deg, ${INK} 0%, ${INK} 46%, ${DEEP_RED} 46.5%, ${DEEP_RED} 100%)`,
    },
    // Both fields are dark, and the divider is faint, so white copy stays
    // readable wherever a layout happens to put it.
    overlay: {
      background:
        'linear-gradient(118deg, rgba(0,0,0,0) 45.4%, rgba(255,255,255,0.28) 45.9%, rgba(255,255,255,0.28) 46.6%, rgba(0,0,0,0) 47.1%)',
    },
    colors: {
      heading: '#FFFFFF',
      text: '#F5F2F1',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.45)',
    },
    fonts: { heading: 'oswald', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'chalk-script',
    name: 'Chalkboard',
    base: { background: '#1C1B1A' },
    overlay: {
      backgroundImage:
        'radial-gradient(rgba(255,255,255,0.045) 1px, transparent 1.3px), radial-gradient(90% 70% at 30% 20%, rgba(255,255,255,0.07), rgba(0,0,0,0) 70%)',
      backgroundSize: '7px 7px, 100% 100%',
    },
    frame: { inset: '3.2%', border: '2px solid rgba(255,255,255,0.45)' },
    colors: {
      heading: '#FFFFFF',
      text: '#DEDAD4',
      accent: '#FF6B7F',
      photoFrame: 'rgba(255,255,255,0.85)',
      photoShadow: 'rgba(0,0,0,0.6)',
    },
    fonts: { heading: 'bebas', body: 'lora' },
    dark: true,
  },
];

export const DEFAULT_BACKGROUND_ID = 'classic-white';

export function getBackground(id: string): Background {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
