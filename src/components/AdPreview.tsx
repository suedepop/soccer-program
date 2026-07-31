'use client';

import AdCanvas from '@/components/AdCanvas';
import { useFitScale } from '@/components/useFitScale';
import { AD_SIZES, CSS_DPI } from '@/lib/config';
import type { AdView } from '@/lib/types';

/**
 * An ad at whatever size the space allows, never above `maxWidth` and never
 * above 1:1.
 *
 * A server page cannot know how wide the screen is, so the detail page used to
 * draw its preview at a flat 520px. On a phone that made the whole document
 * wider than the viewport — the page needed pinching to read, and the nav bar,
 * being viewport-wide, ended halfway across the content.
 */
export default function AdPreview({ ad, maxWidth = 520 }: { ad: AdView; maxWidth?: number }) {
  const naturalWidth = AD_SIZES[ad.size].widthIn * CSS_DPI;
  const { ref, scale } = useFitScale(naturalWidth, Math.min(1, maxWidth / naturalWidth));

  return (
    <div className="preview-stage" ref={ref}>
      <AdCanvas ad={ad} scale={scale} showEmptySlots />
    </div>
  );
}
