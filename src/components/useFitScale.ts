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
      const available = el.clientWidth;
      if (available > 0) setScale(Math.min(maxScale, available / naturalWidth));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth, maxScale]);

  return { ref, scale };
}
