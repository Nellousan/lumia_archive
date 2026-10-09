"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * The rendered width of an element, in CSS pixels, tracked across resizes.
 *
 * `null` until the first measurement: the caller can then hold back work that
 * depends on it rather than rendering it at a guessed size for a frame. Sub-pixel
 * jitter is ignored so a resize cannot loop through state forever.
 */
export function useElementWidth<T extends HTMLElement>(ref: RefObject<T | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[entries.length - 1];
      if (!entry) return;

      const measured = entry.contentRect.width;
      setWidth((current) => (current !== null && Math.abs(current - measured) < 0.5 ? current : measured));
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}
