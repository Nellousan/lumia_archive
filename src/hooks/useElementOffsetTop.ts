"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * The offset of an element from its offset parent's padding box, tracked across
 * layout changes.
 *
 * For lining a floating control up with a box that is centred by auto margins:
 * the control cannot sit in the flow beside it (it would take space) and cannot
 * live inside it (it would scroll away), so it is placed from a measured offset
 * instead of a guessed one.
 *
 * The element's own box and its parent's are both watched — the element moves
 * when the thing it is centred in changes size, and also when a sibling above it
 * grows, which only shows up as the parent resizing.
 */
export function useElementOffsetTop(ref: RefObject<HTMLElement | null>): number | null {
  const [offset, setOffset] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const read = () => {
      const next = element.offsetTop;
      setOffset((current) => (current !== null && Math.abs(current - next) < 0.5 ? current : next));
    };

    const observer = new ResizeObserver(read);
    observer.observe(element);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", read);
    read();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", read);
    };
  }, [ref]);

  return offset;
}
