"use client";

import { useCallback, useMemo, useState } from "react";

export interface BookmarksState {
  /** Bookmarked item ids, in the order they were added. */
  ids: string[];
  isBookmarked: (itemId: string) => boolean;
  toggleBookmark: (itemId: string) => void;
  clearBookmarks: () => void;
}

/**
 * The items kept in the plan.
 *
 * Insertion order is the display order: the bar reads left to right in the order
 * the reader built the plan, so adding a fourth bookmark never reshuffles the
 * first three.
 */
export function useBookmarks(): BookmarksState {
  const [ids, setIds] = useState<string[]>([]);

  const toggleBookmark = useCallback((itemId: string) => {
    setIds((previous) =>
      previous.includes(itemId) ? previous.filter((id) => id !== itemId) : [...previous, itemId],
    );
  }, []);

  const clearBookmarks = useCallback(() => setIds([]), []);

  const bookmarked = useMemo(() => new Set(ids), [ids]);
  const isBookmarked = useCallback((itemId: string) => bookmarked.has(itemId), [bookmarked]);

  return { ids, isBookmarked, toggleBookmark, clearBookmarks };
}
