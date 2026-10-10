"use client";

import type { RefObject } from "react";
import { ItemCard } from "@/components/ui/ItemCard";
import type { WikiItem } from "@/lib/wiki/types";

/** Fixed card width inside the horizontal strip; the card itself is `w-full`. */
const STRIP_CARD_WIDTH = 88;

/**
 * Height of the strip, in pixels: one card at {@link STRIP_CARD_WIDTH}, plus the
 * room the horizontal scrollbar wants. Reserved for the empty state when the
 * caller asks for it, so the panel is the same size either way.
 */
const STRIP_HEIGHT = 95;

export interface UsedToCraftPanelProps {
  /** Items whose recipe consumes the active item, alphabetically. */
  items: WikiItem[];
  activeItemId: string;
  onSelect: (itemId: string) => void;
  /**
   * Keeps the panel's size when there is nothing to list, by holding the strip's
   * height with the empty message centred in it. Hidden-island mode asks for
   * this: the strip sits at the top of a column whose next section would
   * otherwise start at a different place for every item browsed.
   */
  reserveHeight?: boolean;
  /**
   * The panel's own element, so a link that opens an item can bring this section
   * to the top of the rail. A ref rather than an id: only the explorer ever needs
   * to find it, and it is not a landmark anyone else should link to.
   */
  sectionRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Reverse-recipe strip: everything the active item is an ingredient for.
 *
 * Sits between the item picker and the item detail so a material can be followed
 * upwards through the crafting chain, the same way `RecipeTree` follows it down.
 * Shown even when empty — a stable rail beats one that jumps as you browse.
 */
export function UsedToCraftPanel({
  items,
  activeItemId,
  onSelect,
  reserveHeight = false,
  sectionRef,
}: UsedToCraftPanelProps) {
  return (
    <div ref={sectionRef} className="border-b border-white/[0.07] px-4 py-3 sm:px-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
          Used to craft
        </span>
        <span className="shrink-0 font-mono text-[11px] text-stone-600">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <div
          className={`flex ${reserveHeight ? "items-center" : ""}`}
          style={reserveHeight ? { height: STRIP_HEIGHT } : undefined}
        >
          <p className="w-full rounded-lg border border-dashed border-white/10 px-3 py-2 text-center text-[11px] text-stone-500">
            No recipe consumes this item.
          </p>
        </div>
      ) : (
        <div
          className="flex gap-2 overflow-x-auto pb-1"
          style={reserveHeight ? { minHeight: STRIP_HEIGHT } : undefined}
        >
          {items.map((item) => (
            <div key={item.id} className="shrink-0" style={{ width: STRIP_CARD_WIDTH }}>
              <ItemCard item={item} selected={item.id === activeItemId} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
