'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Measures a container and returns the scale that fits `naturalWidth` inside
 * it (never above 1:1). Keeps the preview honest on phones and wide monitors.
 */
export function useFitScale(naturalWidth: number, maxScale = 1) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      // clientWidth includes padding, and every stage this measures has some.
      // Scaling to it makes the ad wider than the box it sits in — by 24px on
      // the editor's stage — which is how a page ends up wider than the phone.
      const cs = getComputedStyle(el);
      const available =
        el.clientWidth - parseFloat(cs.paddingLeft || '0') - parseFloat(cs.paddingRight || '0');
      if (available > 0) setScale(Math.min(maxScale, available / naturalWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth, maxScale]);

  return { ref, scale };
}
