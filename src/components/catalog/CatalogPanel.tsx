"use client";

import type { RefObject } from "react";
import { CategoryTabs } from "./CategoryTabs";
import { ItemCatalogGrid } from "./ItemCatalogGrid";
import { SearchField } from "./SearchField";
import type { CatalogQuery } from "@/lib/wiki/catalog";
import type { WikiItem } from "@/lib/wiki/types";

export interface CatalogPanelProps {
  /** Currently visible (already filtered and ordered) items. */
  items: WikiItem[];
  /** Total number of items in the dataset, for the "x of y" counter. */
  totalCount: number;
  query: CatalogQuery;
  onQueryChange: (patch: Partial<CatalogQuery>) => void;
  groupCounts: Record<string, number>;
  typeCounts: Record<string, number>;
  /** `null` while nothing is selected, so no card reads as active. */
  activeItemId: string | null;
  /** Items in the plan, so their cards can show a filled star. */
  bookmarkedIds: string[];
  onSelectItem: (itemId: string) => void;
  onToggleBookmark: (itemId: string) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

/** Left rail, top pane: search, the two-level category tabs and the item grid. */
export function CatalogPanel({
  items,
  totalCount,
  query,
  onQueryChange,
  groupCounts,
  typeCounts,
  activeItemId,
  bookmarkedIds,
  onSelectItem,
  onToggleBookmark,
  searchInputRef,
}: CatalogPanelProps) {
  return (
    <div className="border-b border-white/[0.07]">
      <div className="border-b border-white/[0.07] p-4 sm:px-6 sm:py-5">
        <div className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
          Survival compendium / Items
        </div>

        <SearchField
          value={query.search}
          onChange={(search) => onQueryChange({ search })}
          inputRef={searchInputRef}
        />

        <div className="mt-3">
          <CategoryTabs
            activeGroupId={query.groupId}
            activeTypeKey={query.typeKey}
            groupCounts={groupCounts}
            typeCounts={typeCounts}
            onSelectGroup={(groupId) => onQueryChange({ groupId, typeKey: null })}
            onSelectType={(typeKey) => onQueryChange({ typeKey })}
          />
        </div>
      </div>

      <div className="p-4 sm:px-6 sm:py-5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
            Select item
          </span>
          <span className="shrink-0 font-mono text-[11px] text-stone-600">
            {items.length} / {totalCount}
          </span>
        </div>

        <ItemCatalogGrid
          items={items}
          activeItemId={activeItemId}
          bookmarkedIds={bookmarkedIds}
          onSelect={onSelectItem}
          onToggleBookmark={onToggleBookmark}
        />
      </div>
    </div>
  );
}
