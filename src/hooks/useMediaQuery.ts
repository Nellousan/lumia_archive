"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches right now, tracked across resizes.
 *
 * `false` on the server and for the first client render, so both agree; the real
 * answer arrives with the subscription. Only reach for this when a layout
 * genuinely cannot be expressed in CSS — a breakpoint that changes *structure*
 * rather than styling, where the wrong answer would leave a pane mounted that the
 * stylesheet has no way to hide.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
