"use client";

import type { RefObject } from "react";
import { CategoryTabs } from "./CategoryTabs";
import { ItemCatalogGrid } from "./ItemCatalogGrid";
import { SearchField } from "./SearchField";
import { isCatalogSearching, type CatalogQuery } from "@/lib/wiki/catalog";
import { ALL_GROUP_ID } from "@/lib/wiki/taxonomy";
import type { WikiItem } from "@/lib/wiki/types";

export interface CatalogPanelProps {
  /** Items on the current page (already filtered, ordered and sliced). */
  items: WikiItem[];
  /** How many items the filter matches in total, across every page. */
  matchedCount: number;
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
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
  matchedCount,
  page,
  pageCount,
  onPageChange,
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
  /**
   * A search reads the whole compendium, so the tabs are not applied while there
   * is a term. Showing "All" as the active one is the honest picture of that, and
   * picking any tab ends the search: the reader has chosen a shelf to browse
   * instead of a word to find.
   */
  const searching = isCatalogSearching(query);

  /** Picking a shelf is leaving the search: the box empties as the tab opens. */
  const selectGroup = (groupId: string) =>
    onQueryChange(searching ? { groupId, typeKey: null, search: "" } : { groupId, typeKey: null });

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
            activeGroupId={searching ? ALL_GROUP_ID : query.groupId}
            activeTypeKey={searching ? null : query.typeKey}
            groupCounts={groupCounts}
            typeCounts={typeCounts}
            onSelectGroup={selectGroup}
            onSelectType={(typeKey) => onQueryChange({ typeKey })}
          />

          {searching && (
            <p className="mt-2 text-[10px] leading-relaxed text-stone-600">
              Searching every category · a tab clears the search and opens that shelf
            </p>
          )}
        </div>
      </div>

      <div className="p-4 sm:px-6 sm:py-5">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
            Select item
          </span>
          <span className="shrink-0 font-mono text-[11px] text-stone-600">
            {matchedCount} / {totalCount}
          </span>
        </div>

        <ItemCatalogGrid
          items={items}
          activeItemId={activeItemId}
          bookmarkedIds={bookmarkedIds}
          page={page}
          pageCount={pageCount}
          onSelect={onSelectItem}
          onToggleBookmark={onToggleBookmark}
          onPageChange={onPageChange}
        />
      </div>
    </div>
  );
}
