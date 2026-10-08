"use client";

import { useCallback, useMemo, useState } from "react";
import type { WikiItem } from "@/lib/wiki/types";

export interface SelectionState {
  /** `null` when nothing is selected and the map is empty. */
  currentId: string | null;
  /** Items visited via recipe links, oldest first. */
  history: string[];
}

/**
 * The rail's click rule, kept pure: picking a new item opens it and starts a
 * fresh trail, picking the item that is already open closes it again.
 */
export function selectionAfterCatalogClick(
  previous: SelectionState,
  itemId: string,
): SelectionState {
  return previous.currentId === itemId
    ? { currentId: null, history: [] }
    : { currentId: itemId, history: [] };
}

/**
 * Owns which item is open, if any.
 *
 * Three ways in and out:
 *  - {@link toggleFromCatalog} picks from the rail, and unpicks the same item on a
 *    second click;
 *  - {@link followLink} pushes onto the trail so the detail panel can offer a
 *    "back" step through the crafting chain (a no-op on the already-open item,
 *    which is what spawn-mode bubbles point at);
 *  - {@link clearSelection} empties the selection — and with it the island map.
 */
export function useItemSelection(items: WikiItem[], initialItemId?: string) {
  const itemsById = useMemo(
    () => Object.fromEntries(items.map((item) => [item.id, item])) as Record<string, WikiItem>,
    [items],
  );

  const [selection, setSelection] = useState<SelectionState>(() => ({
    currentId: initialItemId ?? items[0]?.id ?? null,
    history: [],
  }));

  /** Picking from the rail. Clicking the open item again clears it. */
  const toggleFromCatalog = useCallback((itemId: string) => {
    setSelection((previous) => selectionAfterCatalogClick(previous, itemId));
  }, []);

  const followLink = useCallback((itemId: string) => {
    setSelection((previous) =>
      previous.currentId === itemId
        ? previous
        : {
            currentId: itemId,
            history: previous.currentId
              ? [...previous.history, previous.currentId]
              : previous.history,
          },
    );
  }, []);

  const goBack = useCallback(() => {
    setSelection((previous) => {
      if (previous.history.length === 0) return previous;
      const history = [...previous.history];
      return { currentId: history.pop() ?? null, history };
    });
  }, []);

  /** Drops the selection entirely, clearing the map. */
  const clearSelection = useCallback(() => {
    setSelection({ currentId: null, history: [] });
  }, []);

  const item = selection.currentId ? (itemsById[selection.currentId] ?? null) : null;

  return {
    item,
    canGoBack: selection.history.length > 0,
    toggleFromCatalog,
    followLink,
    goBack,
    clearSelection,
  };
}
