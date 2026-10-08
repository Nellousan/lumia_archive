"use client";

import { ItemCard } from "@/components/ui/ItemCard";
import type { WikiItem } from "@/lib/wiki/types";

export interface ItemCatalogGridProps {
  items: WikiItem[];
  activeItemId: string | null;
  onSelect: (itemId: string) => void;
}

/** Four columns of {@link ItemCard}, scrollable so the rail stays a fixed height. */
export function ItemCatalogGrid({ items, activeItemId, onSelect }: ItemCatalogGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-stone-500">
        No items match this filter.
      </div>
    );
  }

  return (
    <div className="grid max-h-[330px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          item={item}
          selected={item.id === activeItemId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
