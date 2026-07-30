import type { CSSProperties } from 'react';

/**
 * Backgrounds are CSS first (gradients + inline SVG data URIs): headless Chrome
 * renders those identically to the browser preview with no asset loading, so
 * the print file always matches what the parent saw.
 *
 * A background may also name a photographic {@link Background.image}. That one
 * *is* a loaded asset, so it is painted as a real <img> element rather than a
 * CSS background-image — src/lib/render.ts waits on `document.images` before
 * screenshotting, and CSS background layers are not in that collection. An
 * image background must still set a `base` colour that its text reads against,
 * so a slow or missing asset degrades to a plain field instead of unreadable
 * copy.
 *
 * Each photo ships as a light/dark pair with the scrim already baked into the
 * asset — the dark master pushed down so white type reads, the light one washed
 * out so ink type reads. That beats scrimming a full-strength master with a CSS
 * gradient: the gradient has to be retuned per photo, it can only ever produce
 * a dark field, and it costs a compositing pass on every ad in the book. The
 * measured worst-case contrast for each pair is noted on its entries below.
 */

export interface Background {
  id: string;
  name: string;
  /** Base fill for the whole ad. */
  base: CSSProperties;
  /**
   * Photographic fill, drawn over the base and under everything else. Cropped
   * to the ad with object-fit: cover, so one portrait master serves the two
   * portrait formats and the landscape half page takes a band out of it. The
   * master carries its own scrim — see the note at the top of this file.
   */
  image?: {
    src: string;
    /** Small stand-in for the editor swatch grids. Falls back to `src`. */
    thumbSrc?: string;
    /** object-position, when the interesting part is not the centre. */
    position?: string;
  };
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
  /**
   * Coarse colour family. Two ads with the same tone read as "a matching pair"
   * when they land side by side on a printed sheet, so the imposition in
   * src/lib/impose.ts uses this to space them apart.
   */
  tone: 'light' | 'red' | 'dark';
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
    tone: 'light',
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
    tone: 'red',
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
    fonts: { heading: 'antonio', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'blackout',
    name: 'Blackout',
    tone: 'dark',
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
    tone: 'light',
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
    fonts: { heading: 'roboto-condensed', body: 'montserrat' },
    dark: false,
  },
  {
    id: 'pitch-lines',
    name: 'Pitch Lines',
    tone: 'dark',
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
    fonts: { heading: 'antonio', body: 'nunito' },
    dark: true,
  },
  {
    id: 'corner-chevrons',
    name: 'Corner Chevrons',
    tone: 'light',
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
    tone: 'red',
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
    tone: 'light',
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
    fonts: { heading: 'cinzel', body: 'lora' },
    dark: false,
  },
  {
    id: 'stadium-lights',
    name: 'Stadium Lights',
    tone: 'dark',
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
    tone: 'light',
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
    fonts: { heading: 'outfit', body: 'nunito' },
    dark: false,
  },
  {
    id: 'red-black-split',
    name: 'Red & Black Split',
    tone: 'dark',
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
    fonts: { heading: 'big-shoulders-stencil', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'chalk-script',
    name: 'Chalkboard',
    tone: 'dark',
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

  // ---------------------------------------------------------------------------
  // Photographic backgrounds. Three subjects, each as a light/dark pair off one
  // portrait master. The light halves put ink type on a washed-out field, which
  // no CSS background in the set does — those are all either flat light or
  // photo-less dark. Deep red carries the headings there rather than ink: at
  // display size it clears the 3:1 large-text bar against the pale field, while
  // ink takes the body and the attribution, which are too small to risk it.
  // ---------------------------------------------------------------------------
  {
    id: 'turf-light',
    name: 'Turf Light',
    tone: 'light',
    // Mean colour of the master, so a slow asset degrades to the same field.
    base: { background: '#A1A79D' },
    image: {
      src: '/fonts/backgrounds/turf-light.jpg',
      thumbSrc: '/fonts/backgrounds/turf-light-thumb.jpg',
    },
    // Ink holds 6.3:1 across the whole frame and 6.4:1 in the top and bottom
    // bands, where every layout puts the name and the attribution.
    frame: { inset: '2.5%', border: `2px solid rgba(18,16,15,0.5)` },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.25)',
    },
    fonts: { heading: 'antonio', body: 'nunito' },
    dark: false,
  },
  {
    id: 'turf-dark',
    name: 'Turf Dark',
    tone: 'dark',
    base: { background: '#2C3922' },
    image: {
      src: '/fonts/backgrounds/turf-dark.jpg',
      thumbSrc: '/fonts/backgrounds/turf-dark-thumb.jpg',
    },
    // White holds 7.2:1 at the brightest blades and 8.3:1 in the text bands —
    // the baked scrim beats the CSS gradient this pair replaced, which only got
    // the worst case to about 5:1.
    // Reads as a pitch line rather than a picture frame.
    frame: { inset: '2.5%', border: '2px solid rgba(255,255,255,0.85)' },
    colors: {
      heading: '#FFFFFF',
      text: '#FFFFFF',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.5)',
    },
    fonts: { heading: 'roboto-condensed', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'home-field-light',
    name: 'Home Field Light',
    tone: 'light',
    base: { background: '#AEAEAD' },
    // Asset is stadium-light.jpg; the id says home-field so it cannot be
    // confused with the CSS 'stadium-lights' background above.
    image: {
      src: '/fonts/backgrounds/stadium-light.jpg',
      thumbSrc: '/fonts/backgrounds/stadium-light-thumb.jpg',
    },
    // The palest of the three: ink holds 8.2:1, the best in the photo set.
    frame: { inset: '3%', border: `2px solid ${DEEP_RED}` },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.22)',
    },
    fonts: { heading: 'inter-tight', body: 'montserrat' },
    dark: false,
  },
  {
    id: 'home-field-dark',
    name: 'Home Field Dark',
    tone: 'dark',
    base: { background: '#070806' },
    image: {
      src: '/fonts/backgrounds/stadium-dark.jpg',
      thumbSrc: '/fonts/backgrounds/stadium-dark-thumb.jpg',
    },
    // Type is in no danger here — white holds 13:1, the most headroom in the
    // set. The risk is the other way: the median pixel is near black, so the
    // pitch and the crowd read on screen but the treeline and the track are
    // already at the bottom of the range and will go solid on paper. Worth a
    // press proof before this one goes in a book.
    frame: { inset: '3%', border: '1px solid rgba(255,249,236,0.55)' },
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
    id: 'soccerball-light',
    name: 'Soccer Ball Light',
    tone: 'light',
    base: { background: '#A8A9A6' },
    image: {
      src: '/fonts/backgrounds/soccerball-light.jpg',
      thumbSrc: '/fonts/backgrounds/soccerball-light-thumb.jpg',
    },
    // Ink holds 6.9:1. The panel seams are the only structure in the frame, so
    // this one takes a hairline rule and lets the photo carry the edge.
    frame: { inset: '2.8%', border: `1px solid rgba(18,16,15,0.45)` },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.25)',
    },
    fonts: { heading: 'montserrat', body: 'lora' },
    dark: false,
  },
  {
    id: 'soccerball-dark',
    name: 'Soccer Ball Dark',
    tone: 'dark',
    base: { background: '#2D2D2C' },
    image: {
      src: '/fonts/backgrounds/soccerball-dark.jpg',
      thumbSrc: '/fonts/backgrounds/soccerball-dark-thumb.jpg',
    },
    // White holds 12.7:1 on an almost perfectly even field.
    frame: { inset: '2.8%', border: `2px solid ${RED}` },
    colors: {
      heading: '#FFFFFF',
      text: '#F2F2F0',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.55)',
    },
    fonts: { heading: 'outfit', body: 'nunito' },
    dark: true,
  },
  // ---------------------------------------------------------------------------
  // Textures and places. Same baked-scrim convention as the pairs above, but
  // most of these are a single treatment rather than a light/dark pair — only
  // the goal net comes in both. Ids match their filenames.
  //
  // The light ones take a deep red heading where the photo's darkest patches
  // still clear the 3:1 large-text bar against it, and ink where they do not.
  // Ink carries the message and the "from" line throughout, because `accent` is
  // the attribution colour and that is small text needing the full 4.5:1.
  // ---------------------------------------------------------------------------
  {
    id: 'wall-light',
    name: 'Concrete Wall',
    tone: 'light',
    base: { background: '#F1EDE5' },
    image: {
      src: '/fonts/backgrounds/wall-light.jpg',
      thumbSrc: '/fonts/backgrounds/wall-light-thumb.jpg',
    },
    // The most forgiving photo in the set: ink holds 12.7:1 and even the deep
    // red heading gets 6.3:1, because there is no dark patch anywhere in it.
    frame: { inset: '2.5%', border: `3px solid ${RED}` },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.2)',
    },
    fonts: { heading: 'outfit', body: 'montserrat' },
    dark: false,
  },
  {
    id: 'wood-light',
    name: 'Whitewashed Wood',
    tone: 'light',
    base: { background: '#E0DBD8' },
    image: {
      src: '/fonts/backgrounds/wood-light.jpg',
      thumbSrc: '/fonts/backgrounds/wood-light-thumb.jpg',
    },
    // Ink 9.3:1, deep red 4.6:1.
    frame: { inset: '3%', border: `2px solid ${INK}` },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.22)',
    },
    fonts: { heading: 'smooch-sans', body: 'lora' },
    dark: false,
  },
  {
    id: 'canvas-light',
    name: 'Painted Canvas',
    // Reads pink rather than neutral, so the imposition treats it as part of
    // the red family and keeps it away from the other reds on a sheet.
    tone: 'red',
    base: { background: '#C7A29F' },
    image: {
      src: '/fonts/backgrounds/canvas-light.jpg',
      thumbSrc: '/fonts/backgrounds/canvas-light-thumb.jpg',
    },
    // Ink 6.0:1. The deep red heading is the tightest in the set at almost
    // exactly 3:1 on the darkest patches — fine for display type, and the
    // reason the body copy is ink rather than a second red.
    frame: { inset: '3%', border: `2px double ${DEEP_RED}` },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(80,40,40,0.25)',
    },
    fonts: { heading: 'cinzel', body: 'lora' },
    dark: false,
  },
  {
    id: 'blurredlights-light',
    name: 'Bokeh Lights',
    tone: 'light',
    base: { background: '#CCC6C0' },
    image: {
      src: '/fonts/backgrounds/blurredlights-light.jpg',
      thumbSrc: '/fonts/backgrounds/blurredlights-light-thumb.jpg',
    },
    // Ink 6.9:1, deep red 3.4:1. The bright discs are where white type would
    // vanish, which is why this one is a light treatment and not a dark.
    frame: { inset: '3%', border: '1px solid rgba(18,16,15,0.4)' },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.22)',
    },
    fonts: { heading: 'raleway', body: 'lora' },
    dark: false,
  },
  {
    id: 'net-light',
    name: 'Goal Net Light',
    tone: 'light',
    base: { background: '#C9C7C5' },
    image: {
      src: '/fonts/backgrounds/net-light.jpg',
      thumbSrc: '/fonts/backgrounds/net-light-thumb.jpg',
    },
    // Ink 6.7:1, deep red 3.4:1.
    frame: { inset: '2.5%', border: '2px solid rgba(18,16,15,0.5)' },
    colors: {
      heading: DEEP_RED,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.22)',
    },
    fonts: { heading: 'inter-tight', body: 'nunito' },
    dark: false,
  },
  {
    id: 'pitch-light',
    name: 'Empty Pitch',
    tone: 'light',
    base: { background: '#BFC0B7' },
    image: {
      src: '/fonts/backgrounds/pitch-light.jpg',
      thumbSrc: '/fonts/backgrounds/pitch-light-thumb.jpg',
    },
    /**
     * Ink only. The grass keeps enough of its own darkness that deep red drops
     * to 2.4:1 on it, under even the large-text bar, so the heading is ink like
     * everything else. That makes `accent` equal to `heading`, which mutes the
     * name effects — src/lib/effects.ts falls back to ink for its outlines and
     * an ink ring round ink letters just reads as slightly bolder. Ink at 4.7:1
     * is still the best any colour manages here, so legibility wins.
     */
    colors: {
      heading: INK,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.25)',
    },
    fonts: { heading: 'roboto-condensed', body: 'nunito' },
    dark: false,
  },
  {
    id: 'corner-light',
    name: 'Corner Flag',
    tone: 'light',
    base: { background: '#A6AE99' },
    image: {
      src: '/fonts/backgrounds/corner-light.jpg',
      thumbSrc: '/fonts/backgrounds/corner-light-thumb.jpg',
    },
    /**
     * The one background in the set that does not reach 4.5:1 for small text.
     * Ink gets 4.3:1 across the frame and 4.1:1 in the bands, and nothing else
     * does better — the darkest grass needs a text colour darker than ink to
     * clear AA, which does not exist. Shipped because a heading and a short
     * message are still comfortably readable at this contrast; re-export the
     * master a stop or two lighter if you want it to pass outright.
     */
    colors: {
      heading: INK,
      text: INK,
      accent: INK,
      photoFrame: INK,
      photoShadow: 'rgba(0,0,0,0.25)',
    },
    fonts: { heading: 'antonio', body: 'montserrat' },
    dark: false,
  },
  {
    id: 'charcoal-dark',
    name: 'Charred Wood',
    tone: 'dark',
    base: { background: '#080909' },
    image: {
      src: '/fonts/backgrounds/charcoal-dark.jpg',
      thumbSrc: '/fonts/backgrounds/charcoal-dark-thumb.jpg',
    },
    // White holds 14.9:1. Nearly black, so the grain will close up on press —
    // it is a texture rather than a picture, so there is nothing to lose.
    frame: { inset: '2.5%', border: `2px solid ${RED}` },
    colors: {
      heading: '#FFFFFF',
      text: '#F2F2F0',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.6)',
    },
    fonts: { heading: 'big-shoulders-stencil', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'corrosion-dark',
    name: 'Corrosion',
    tone: 'dark',
    base: { background: '#0D0F0B' },
    image: {
      src: '/fonts/backgrounds/corrosion-dark.jpg',
      thumbSrc: '/fonts/backgrounds/corrosion-dark-thumb.jpg',
    },
    // White holds 14.1:1.
    frame: { inset: '2.5%', border: '1px solid rgba(255,255,255,0.5)' },
    colors: {
      heading: '#FFFFFF',
      text: '#EDEBE9',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.6)',
    },
    fonts: { heading: 'big-shoulders-inline', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'gravel-dark',
    name: 'Gravel',
    tone: 'dark',
    base: { background: '#060808' },
    image: {
      src: '/fonts/backgrounds/gravel-dark.jpg',
      thumbSrc: '/fonts/backgrounds/gravel-dark-thumb.jpg',
    },
    // The speckles push the brightest pixels up, so white is 7.7:1 across the
    // whole frame — but 16.2:1 in the top and bottom bands, which is where the
    // type actually sits.
    frame: { inset: '2.8%', border: `2px solid ${RED}` },
    colors: {
      heading: '#FFFFFF',
      text: '#F2F2F0',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.6)',
    },
    fonts: { heading: 'roboto-condensed', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'stitches-dark',
    name: 'Red Stitching',
    tone: 'dark',
    base: { background: '#050504' },
    image: {
      src: '/fonts/backgrounds/stitches-dark.jpg',
      thumbSrc: '/fonts/backgrounds/stitches-dark-thumb.jpg',
    },
    // White holds 15.5:1, the most headroom of any photo here.
    // A dashed rule, because the photo is a seam.
    frame: { inset: '3%', border: '1px dashed rgba(255,255,255,0.55)' },
    colors: {
      heading: '#FFFFFF',
      text: '#F2F2F0',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.6)',
    },
    fonts: { heading: 'strichpunkt-sans', body: 'montserrat' },
    dark: true,
  },
  {
    id: 'net-dark',
    name: 'Goal Net Dark',
    tone: 'dark',
    base: { background: '#1F1E1D' },
    image: {
      src: '/fonts/backgrounds/net-dark.jpg',
      thumbSrc: '/fonts/backgrounds/net-dark-thumb.jpg',
    },
    // White holds 11.6:1.
    frame: { inset: '2.5%', border: '2px solid rgba(255,255,255,0.8)' },
    colors: {
      heading: '#FFFFFF',
      text: '#F2F2F0',
      accent: '#FFFFFF',
      photoFrame: '#FFFFFF',
      photoShadow: 'rgba(0,0,0,0.55)',
    },
    fonts: { heading: 'inter-tight', body: 'nunito' },
    dark: true,
  },
  {
    id: 'largestadium-dark',
    name: 'Under the Lights',
    tone: 'dark',
    base: { background: '#060706' },
    image: {
      src: '/fonts/backgrounds/largestadium-dark.jpg',
      thumbSrc: '/fonts/backgrounds/largestadium-dark-thumb.jpg',
      // The floodlights sit in the upper third. A centred crop keeps them on
      // the two portrait sizes but loses them on the landscape half page, which
      // takes a band out of the middle — biasing upwards keeps the lights in
      // shot at every size, and they are the whole point of the picture.
      position: 'center 28%',
    },
    // White holds 10.4:1 overall and 20.6:1 in the text bands.
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
];

export const DEFAULT_BACKGROUND_ID = 'classic-white';

export function getBackground(id: string): Background {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
