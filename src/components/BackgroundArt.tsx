import type { Background } from '@/lib/backgrounds';

/**
 * The photo and decorative layers of a background, in paint order, for the ad
 * canvas and for the editor's swatch grids. Both live here so a background can
 * never end up with its scrim under its photo in one place and over it in
 * another.
 *
 * The photo is an <img>, not a CSS background-image: src/lib/render.ts waits on
 * `document.images` before it screenshots for print, and CSS background layers
 * are not in that collection.
 */
export default function BackgroundArt({
  bg,
  thumb = false,
}: {
  bg: Background;
  /** Prefer the small stand-in — for the swatch grids. */
  thumb?: boolean;
}) {
  return (
    <>
      {bg.image && (
        <img
          src={thumb ? (bg.image.thumbSrc ?? bg.image.src) : bg.image.src}
          alt=""
          aria-hidden
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: bg.image.position ?? 'center',
            pointerEvents: 'none',
          }}
        />
      )}
      {bg.overlay && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...bg.overlay }} />
      )}
    </>
  );
}
