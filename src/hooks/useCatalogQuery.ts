"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_CATALOG_QUERY,
  filterCatalog,
  paginate,
  reconcileQuery,
  subTypeKeys,
  type CatalogQuery,
} from "@/lib/wiki/catalog";
import { ALL_GROUP_ID, CATEGORY_TABS } from "@/lib/wiki/taxonomy";
import type { WikiItem } from "@/lib/wiki/types";

/**
 * Owns the catalog filter state (tab, sub-tab, search) and every derived count
 * the rail needs. The components stay presentational: they render the numbers,
 * they do not compute them.
 */
export function useCatalogQuery(items: WikiItem[]) {
  const [rawQuery, setRawQuery] = useState<CatalogQuery>(DEFAULT_CATALOG_QUERY);

  // Guards against a stale type filter when the tab changes underneath it.
  const query = useMemo(() => reconcileQuery(items, rawQuery), [items, rawQuery]);

  const updateQuery = useCallback((patch: Partial<CatalogQuery>) => {
    setRawQuery((previous) => ({ ...previous, ...patch }));
  }, []);

  const resetQuery = useCallback(() => setRawQuery(DEFAULT_CATALOG_QUERY), []);

  /** Items matching tab + search, ignoring the sub-tab filter. */
  const scopedItems = useMemo(
    () => filterCatalog(items, { ...query, typeKey: null }),
    [items, query],
  );

  /** Items matching the whole query, before paging. */
  const visibleItems = useMemo(() => filterCatalog(items, query), [items, query]);

  /**
   * The page being read, remembered together with the filter it belongs to: any
   * change of tab, sub-tab or search starts a new key and lands back on page one,
   * without an effect that would fight the render.
   */
  const [paging, setPaging] = useState<{ key: string; page: number } | null>(null);
  const pageKey = `${query.groupId}|${query.typeKey ?? ""}|${query.search}`;
  const page = useMemo(
    () => paginate(visibleItems, paging?.key === pageKey ? paging.page : 0),
    [pageKey, paging, visibleItems],
  );

  const goToPage = useCallback(
    (next: number) => setPaging({ key: pageKey, page: next }),
    [pageKey],
  );

  /** Sub-tab keys for the active tab, in declared order. */
  const typeKeys = useMemo(() => subTypeKeys(query.groupId), [query.groupId]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const typeKey of typeKeys) {
      counts[typeKey] = scopedItems.filter((item) => item.types.includes(typeKey)).length;
    }
    return counts;
  }, [typeKeys, scopedItems]);

  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { [ALL_GROUP_ID]: items.length };
    for (const tab of CATEGORY_TABS) {
      if (tab.types.length === 0) continue;
      counts[tab.id] = items.filter((item) =>
        item.types.some((type) => tab.types.includes(type)),
      ).length;
    }
    return counts;
  }, [items]);

  return {
    query,
    updateQuery,
    resetQuery,
    visibleItems,
    /** The 12 items of the current page. */
    pageItems: page.items,
    page: page.page,
    pageCount: page.pageCount,
    goToPage,
    typeKeys,
    typeCounts,
    groupCounts,
  };
}
