'use client';

import { AD_SIZES, CSS_DPI, MAX_TEXT_SCALE, MIN_TEXT_SCALE, TEXT_SCALE_STEP } from '@/lib/config';
import { getBackground } from '@/lib/backgrounds';
import { resolveFont } from '@/lib/fonts';
import { getLayout, TYPE_BASE } from '@/lib/layouts';
import { fitBodyText } from '@/lib/fit';
import { boldFraction, stripMarkup } from '@/lib/richtext';
import type { AdView } from '@/lib/types';

/**
 * Grow / shrink the message and "from" type.
 *
 * The buttons run the real fitter at the next step up or down, so a step that
 * the box would refuse is disabled rather than being a control that silently
 * does nothing. That is also how "stays within bounds" is honest here: the
 * request only ever selects among sizes that already fit.
 */
export default function TextSizeControl({
  ad,
  onChange,
}: {
  ad: AdView;
  onChange: (textScale: number) => void;
}) {
  const scale = ad.textScale ?? 1;
  const sizeAt = (s: number) => measure(ad, s);

  const current = sizeAt(scale);
  const larger = Math.min(MAX_TEXT_SCALE, scale + TEXT_SCALE_STEP);
  const smaller = Math.max(MIN_TEXT_SCALE, scale - TEXT_SCALE_STEP);

  const canGrow = scale < MAX_TEXT_SCALE && sizeAt(larger) > current;
  const canShrink = scale > MIN_TEXT_SCALE && sizeAt(smaller) < current;
  const atBoxLimit = scale < MAX_TEXT_SCALE && !canGrow;

  return (
    <div>
      <label>Text size</label>
      <div className="row" style={{ gap: 6 }}>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => onChange(smaller)}
          disabled={!canShrink}
          aria-label="Smaller text"
        >
          −
        </button>
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => onChange(larger)}
          disabled={!canGrow}
          aria-label="Larger text"
        >
          +
        </button>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => onChange(1)}
          disabled={Math.abs(scale - 1) < 0.001}
        >
          Reset
        </button>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {scale === 1 ? 'Automatic' : `${scale > 1 ? '+' : ''}${Math.round((scale - 1) * 100)}%`}
        </span>
      </div>
      <div className="hint">
        {atBoxLimit
          ? 'This is as large as the message fits in this layout. Shorten it, or pick a layout with more room.'
          : 'Applies to your message and the “from” line. The type never grows past what fits.'}
      </div>
    </div>
  );
}

/** The size the renderer would actually use at a given request. */
function measure(ad: AdView, scale: number): number {
  const spec = AD_SIZES[ad.size];
  const W = spec.widthIn * CSS_DPI;
  const H = spec.heightIn * CSS_DPI;
  const layout = getLayout(ad.layoutId, ad.size);
  const bg = getBackground(ad.backgroundId);
  const font = resolveFont(ad.bodyFont, bg.fonts.body);
  const source = ad.message || 'Your message will appear here.';

  return fitBodyText(
    stripMarkup(source),
    (layout.message.w / 100) * W,
    (layout.message.h / 100) * H,
    TYPE_BASE[ad.size].message * (layout.messageScale ?? 1) * font.scale,
    {
      avgGlyph: font.avgGlyph * (1 + (font.boldRatio - 1) * boldFraction(source)),
      lineHeight: font.lineHeight,
      scale,
    }
  ).fontSize;
}
