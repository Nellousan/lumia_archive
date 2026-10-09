"use client";

import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { ItemCard } from "@/components/ui/ItemCard";
import type { WikiItem } from "@/lib/wiki/types";

export interface ItemCatalogGridProps {
  /** The current page: at most {@link ITEMS_PER_PAGE} items. */
  items: WikiItem[];
  activeItemId: string | null;
  bookmarkedIds: string[];
  /** Current page, 0-based, out of `pageCount`. */
  page: number;
  pageCount: number;
  onSelect: (itemId: string) => void;
  onToggleBookmark: (itemId: string) => void;
  onPageChange: (page: number) => void;
}

/** Small square pager control. */
function PageButton({
  direction,
  disabled,
  onClick,
}: {
  direction: "previous" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={direction === "previous" ? "Previous page" : "Next page"}
      className={`grid size-7 place-items-center rounded-lg border text-stone-300 transition ${
        disabled
          ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-stone-700"
          : "border-white/15 bg-white/[0.04] hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-200"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d={direction === "previous" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} />
      </svg>
    </button>
  );
}

/**
 * One page of {@link ItemCard}s: four columns of three rows, with the pager under
 * it. Paging rather than scrolling keeps the rail a predictable height and makes
 * the catalog look like shelves instead of a list.
 */
export function ItemCatalogGrid({
  items,
  activeItemId,
  bookmarkedIds,
  page,
  pageCount,
  onSelect,
  onToggleBookmark,
  onPageChange,
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
    <div>
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => (
        // The star is a sibling of the card rather than a child: a button cannot
        // nest inside the card's own button, and this way its click never
        // reaches the card's select handler.
          <div key={item.id} className="group relative">
            <ItemCard item={item} selected={item.id === activeItemId} onSelect={onSelect} />
            <BookmarkButton
              variant="overlay"
              itemName={item.name}
              bookmarked={bookmarked.has(item.id)}
              onToggle={() => onToggleBookmark(item.id)}
            />
          </div>
        ))}
      </div>

      {pageCount > 1 && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <PageButton
            direction="previous"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          />
          <span className="font-mono text-[11px] text-stone-500">
            page {page + 1} / {pageCount}
          </span>
          <PageButton
            direction="next"
            disabled={page >= pageCount - 1}
            onClick={() => onPageChange(page + 1)}
          />
        </div>
      )}
    </div>
  );
}
