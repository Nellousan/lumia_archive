"use client";

import { ItemCard } from "@/components/ui/ItemCard";
import type { WikiItem } from "@/lib/wiki/types";

/** Fixed card width inside the horizontal strip; the card itself is `w-full`. */
const STRIP_CARD_WIDTH = 88;

export interface UsedToCraftPanelProps {
  /** Items whose recipe consumes the active item, alphabetically. */
  items: WikiItem[];
  activeItemId: string;
  onSelect: (itemId: string) => void;
}

/**
 * Reverse-recipe strip: everything the active item is an ingredient for.
 *
 * Sits between the item picker and the item detail so a material can be followed
 * upwards through the crafting chain, the same way `RecipeTree` follows it down.
 * Shown even when empty — a stable rail beats one that jumps as you browse.
 */
export function UsedToCraftPanel({ items, activeItemId, onSelect }: UsedToCraftPanelProps) {
  return (
    <div className="border-b border-white/[0.07] px-4 py-3 sm:px-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
          Used to craft
        </span>
        <span className="shrink-0 font-mono text-[11px] text-stone-600">{items.length}</span>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-white/10 px-3 py-2 text-[11px] text-stone-500">
          No recipe consumes this item.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
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
