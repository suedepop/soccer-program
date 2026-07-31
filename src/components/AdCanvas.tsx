import type { CSSProperties, ReactNode } from 'react';
import { AD_SIZES, CSS_DPI } from '@/lib/config';
import BackgroundArt from '@/components/BackgroundArt';
import { getBackground } from '@/lib/backgrounds';
import { getNameEffect, getNameEffectColor } from '@/lib/effects';
import { resolveFont, type AdFont } from '@/lib/fonts';
import { getLayout, placePhoto, TYPE_BASE, type Box, type PhotoSlot } from '@/lib/layouts';
import { fitBodyText, fitHeading } from '@/lib/fit';
import { boldFraction, preventOrphans, stripMarkup } from '@/lib/richtext';
import RichText from '@/components/RichText';
import type { AdView } from '@/lib/types';

export interface AdCanvasProps {
  ad: Pick<
    AdView,
    | 'size'
    | 'layoutId'
    | 'backgroundId'
    | 'playerName'
    | 'message'
    | 'attribution'
    | 'photos'
  > &
    Partial<
      Pick<AdView, 'headingFont' | 'bodyFont' | 'nameEffect' | 'nameEffectColor' | 'textScale'>
    >;
  /** 1 = actual print size on a 96dpi screen. Preview uses e.g. 0.45. */
  scale?: number;
  /** Render dashed drop targets for empty slots (editor only). */
  showEmptySlots?: boolean;
  /** Overlay injected into each photo slot — used by the editor for controls. */
  slotOverlay?: (slotIndex: number, slot: PhotoSlot) => ReactNode;
  className?: string;
}

function pct(box: Box): CSSProperties {
  return {
    position: 'absolute',
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.w}%`,
    height: `${box.h}%`,
  };
}

/**
 * Bold glyphs are wider, so a heavily bolded message needs a slightly more
 * pessimistic advance width or it will overflow its box.
 */
function effectiveGlyph(font: AdFont, source: string): number {
  return font.avgGlyph * (1 + (font.boldRatio - 1) * boldFraction(source));
}

/**
 * Renders one ad at its true trim size, then scales the whole thing with a CSS
 * transform. Because every dimension inside is a percentage or a px value
 * derived from the trim size, the preview and the print render are the same
 * drawing at different zoom levels.
 */
export default function AdCanvas({
  ad,
  scale = 1,
  showEmptySlots = false,
  slotOverlay,
  className,
}: AdCanvasProps) {
  const spec = AD_SIZES[ad.size];
  const W = spec.widthIn * CSS_DPI;
  const H = spec.heightIn * CSS_DPI;

  const layout = getLayout(ad.layoutId, ad.size);
  const bg = getBackground(ad.backgroundId, ad.size);
  const type = TYPE_BASE[ad.size];

  const headingFont = resolveFont(ad.headingFont, bg.fonts.heading);
  const bodyFont = resolveFont(ad.bodyFont, bg.fonts.body);

  const nameSource = ad.playerName || 'Player Name';
  const messageSource = ad.message || 'Your message will appear here.';
  const attributionSource = ad.attribution || 'Love, Mom and Dad';

  // Fitting works on the visible text; the markup characters are never drawn.
  const namePlain = stripMarkup(nameSource);
  const messagePlain = stripMarkup(messageSource);
  const attributionPlain = stripMarkup(attributionSource);

  const nameFit = fitHeading(
    namePlain,
    (layout.playerName.w / 100) * W,
    // The accent rule lives inside the name box, so it has to come out of the
    // height the name is allowed to claim.
    (layout.playerName.h / 100) * H * (layout.rule ? 0.76 : 1),
    type.name * (layout.nameScale ?? 1) * headingFont.scale,
    { avgGlyph: headingFont.headingGlyph, maxRatio: layout.nameMaxScale ?? 1 }
  );
  const textScale = ad.textScale ?? 1;
  const messageFit = fitBodyText(
    messagePlain,
    (layout.message.w / 100) * W,
    (layout.message.h / 100) * H,
    type.message * (layout.messageScale ?? 1) * bodyFont.scale,
    {
      avgGlyph: effectiveGlyph(bodyFont, messageSource),
      lineHeight: bodyFont.lineHeight,
      scale: textScale,
    }
  );
  const attributionFit = fitBodyText(
    attributionPlain,
    (layout.attribution.w / 100) * W,
    (layout.attribution.h / 100) * H,
    type.attribution * (layout.attributionScale ?? 1) * bodyFont.scale,
    {
      avgGlyph: effectiveGlyph(bodyFont, attributionSource),
      lineHeight: bodyFont.lineHeight,
      minRatio: 0.6,
      maxRatio: 1.1,
      scale: textScale,
    }
  );

  // Names use the family's real heavy instance; inline **bold** inside body
  // copy stays at 700 (or a gentler 600 where Chrome has to synthesise it).
  /**
   * How long the glued last-two-words may be, as a share of one line. A fixed
   * character count cannot work: 22 characters is comfortable on a full-page
   * line and wider than a quarter-page one, and an over-long unbreakable run
   * would rather overflow the box than wrap.
   *
   * The pair only has to fit *within* a line, so 0.85 is the right order of
   * magnitude — it leaves room for the character-width estimate being
   * approximate without refusing to glue ordinary pairs of longish words.
   */
  const glueLimit = (boxWidthPercent: number, fontSize: number) =>
    Math.floor((((boxWidthPercent / 100) * W) / (fontSize * bodyFont.avgGlyph)) * 0.85);

  const messageGlue = glueLimit(layout.message.w, messageFit.fontSize);
  const attributionGlue = glueLimit(layout.attribution.w, attributionFit.fontSize);

  const headingWeight = headingFont.headingWeight;
  const bodyBold = bodyFont.syntheticBold ? 600 : 700;

  const effect = getNameEffect(ad.nameEffect ?? '');
  const effectStyle = effect.style(
    nameFit.fontSize,
    {
      heading: bg.colors.heading,
      accent: bg.colors.accent,
      dark: bg.dark,
    },
    getNameEffectColor(ad.nameEffectColor)
  );

  const bySlot = new Map(ad.photos.map((p) => [p.slot, p]));

  return (
    <div
      className={className}
      style={{
        width: W * scale,
        height: H * scale,
        position: 'relative',
        overflow: 'hidden',
        flex: '0 0 auto',
      }}
    >
      <div
        data-ad-canvas
        style={{
          width: W,
          height: H,
          position: 'absolute',
          top: 0,
          left: 0,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
          ...bg.base,
        }}
      >
        <BackgroundArt bg={bg} />
        {bg.frame && (
          <div style={{ position: 'absolute', pointerEvents: 'none', ...bg.frame }} />
        )}

        {layout.photos.map((slot, i) => {
          const photo = bySlot.get(i);
          const circle = slot.shape === 'circle';
          const frameStyle: CSSProperties = slot.bleed
            ? {}
            : {
                border: `${Math.max(2, W * 0.005)}px solid ${bg.colors.photoFrame}`,
                boxShadow: `0 ${W * 0.006}px ${W * 0.018}px ${bg.colors.photoShadow}`,
              };
          return (
            <div
              key={i}
              style={{
                ...pct(slot),
                borderRadius: circle ? '50%' : 0,
                overflow: 'hidden',
                background: photo ? 'transparent' : 'rgba(127,127,127,0.14)',
                ...(photo || !showEmptySlots ? frameStyle : {}),
                ...(photo
                  ? {}
                  : showEmptySlots
                    ? {
                        border: `2px dashed ${bg.dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.35)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }
                    : {}),
              }}
            >
              {photo ? (
                (() => {
                  // Absolute placement rather than object-fit, because zoom
                  // needs an explicit drawn size. placePhoto guarantees the
                  // image still covers the slot at every pan and zoom.
                  const place = placePhoto(
                    (slot.w / 100) * W,
                    (slot.h / 100) * H,
                    photo.width,
                    photo.height,
                    photo.focalX,
                    photo.focalY,
                    photo.zoom ?? 1
                  );
                  return (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={photo.url}
                      alt=""
                      style={{
                        position: 'absolute',
                        width: place.drawW,
                        height: place.drawH,
                        left: place.left,
                        top: place.top,
                        maxWidth: 'none',
                        display: 'block',
                      }}
                    />
                  );
                })()
              ) : showEmptySlots ? (
                <span
                  style={{
                    font: `600 ${Math.max(11, W * 0.018)}px ${bodyFont.stack}`,
                    color: bg.dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.55)',
                    textAlign: 'center',
                    padding: 6,
                  }}
                >
                  Photo {i + 1}
                </span>
              ) : null}
              {slotOverlay?.(i, slot)}
            </div>
          );
        })}

        {/* Player name */}
        <div
          style={{
            ...pct(layout.playerName),
            display: 'flex',
            flexDirection: 'column',
            alignItems:
              layout.align === 'center'
                ? 'center'
                : layout.align === 'right'
                  ? 'flex-end'
                  : 'flex-start',
            justifyContent: 'center',
            textAlign: layout.align,
          }}
        >
          <div
            // Handle for the layout regression test in scripts/name-fit.mjs,
            // which measures this box against the trim edge.
            data-ad-name
            style={{
              fontFamily: headingFont.stack,
              fontWeight: headingWeight,
              fontSize: nameFit.fontSize,
              lineHeight: nameFit.lineHeight,
              color: bg.colors.heading,
              letterSpacing: '0.01em',
              opacity: ad.playerName ? 1 : 0.45,
              // Long names wrap to a second line rather than being forced onto
              // one and shrinking past legibility — see fitHeading.
              overflowWrap: 'break-word',
              ...effectStyle,
            }}
          >
            <RichText source={nameSource} boldWeight={headingWeight} />
          </div>
          {layout.rule && (
            <div
              style={{
                marginTop: nameFit.fontSize * 0.22,
                width: `${Math.min(72, Math.max(28, namePlain.length * 2.6))}%`,
                height: Math.max(2, W * 0.004),
                background: bg.colors.accent,
              }}
            />
          )}
        </div>

        {/* Message */}
        <div
          data-ad-text-box="message"
          style={{
            ...pct(layout.message),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            textAlign: layout.align,
          }}
        >
          <div
            data-ad-text-content="message"
            style={{
              fontFamily: bodyFont.stack,
              fontWeight: 400,
              fontSize: messageFit.fontSize,
              lineHeight: messageFit.lineHeight,
              color: bg.colors.text,
              whiteSpace: 'pre-wrap',
              opacity: ad.message ? 1 : 0.45,
            }}
          >
            <RichText source={preventOrphans(messageSource, messageGlue)} boldWeight={bodyBold} />
          </div>
        </div>

        {/* Attribution */}
        <div
          data-ad-text-box="attribution"
          style={{
            ...pct(layout.attribution),
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            textAlign: layout.align,
          }}
        >
          <div
            data-ad-text-content="attribution"
            style={{
              fontFamily: bodyFont.stack,
              fontWeight: 600,
              fontSize: attributionFit.fontSize,
              lineHeight: attributionFit.lineHeight,
              color: bg.colors.accent,
              whiteSpace: 'pre-wrap',
              opacity: ad.attribution ? 1 : 0.45,
            }}
          >
            <RichText
              source={preventOrphans(attributionSource, attributionGlue)}
              boldWeight={bodyBold}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
