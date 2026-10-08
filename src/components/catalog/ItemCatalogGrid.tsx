"use client";

import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { ItemCard } from "@/components/ui/ItemCard";
import type { WikiItem } from "@/lib/wiki/types";

export interface ItemCatalogGridProps {
  items: WikiItem[];
  activeItemId: string | null;
  bookmarkedIds: string[];
  onSelect: (itemId: string) => void;
  onToggleBookmark: (itemId: string) => void;
}

/** Four columns of {@link ItemCard}, scrollable so the rail stays a fixed height. */
export function ItemCatalogGrid({
  items,
  activeItemId,
  bookmarkedIds,
  onSelect,
  onToggleBookmark,
}: ItemCatalogGridProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm text-stone-500">
        No items match this filter.
      </div>
    );
  }

  const bookmarked = new Set(bookmarkedIds);

  return (
    <div className="grid max-h-[330px] grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
      {items.map((item) => (
        // The star is a sibling of the card rather than a child: a button cannot
        // nest inside the card's own button, and this way its click never
        // reaches the card's select handler.
        <div key={item.id} className="group relative">
          <ItemCard
            item={item}
            selected={item.id === activeItemId}
            onSelect={onSelect}
          />
          <BookmarkButton
            variant="overlay"
            itemName={item.name}
            bookmarked={bookmarked.has(item.id)}
            onToggle={() => onToggleBookmark(item.id)}
          />
        </div>
      ))}
    </div>
  );
}
