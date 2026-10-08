import { ALL_GROUP_ID, CATEGORY_TABS, getCategoryTab, rarityRank } from "./taxonomy";
import type { WikiItem } from "./types";

/**
 * Pure catalog filtering/sorting. Kept out of the components so the rail stays
 * a thin rendering layer and the rules are easy to unit-test later.
 */

export interface CatalogQuery {
  /** `"all"` or one of `CATEGORY_TABS[].id`. */
  groupId: string;
  /** Raw type key, or `null` for "every type in the group". */
  typeKey: string | null;
  search: string;
}

export const DEFAULT_CATALOG_QUERY: CatalogQuery = {
  groupId: ALL_GROUP_ID,
  typeKey: null,
  search: "",
};

/** Case- and punctuation-insensitive comparison for search. */
export function normalizeSearchTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchesSearch(item: WikiItem, search: string): boolean {
  const term = normalizeSearchTerm(search);
  if (!term) return true;
  return normalizeSearchTerm(`${item.name} ${item.id} ${item.types.join(" ")}`).includes(term);
}

/**
 * Sub-tab keys for a group, in the order `taxonomy.ts` declares them — including
 * types that currently have no items, so the tab strip never reshuffles as the
 * dataset grows. "All" has no sub-tabs.
 */
export function subTypeKeys(groupId: string): string[] {
  return getCategoryTab(groupId).types;
}

/**
 * Catalog ordering: rarest first, then highest value, then alphabetical.
 * Items without a value in `data.json` sort after those that have one.
 */
export function compareForCatalog(a: WikiItem, b: WikiItem): number {
  const byRarity = rarityRank(a.rarity) - rarityRank(b.rarity);
  if (byRarity !== 0) return byRarity;

  const byValue = (b.value ?? -1) - (a.value ?? -1);
  if (byValue !== 0) return byValue;

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

export interface CategoryBucket {
  id: string;
  label: string;
  items: WikiItem[];
}

/**
 * Bucket sequence:
 *  - `tab` follows `CATEGORY_TABS` (Normal, Food, Gear, Weapon);
 *  - `reverse` puts the most actionable categories first, which is what the area
 *    panel uses (Weapon, Gear, Food, Normal).
 */
export type CategoryBucketOrder = "tab" | "reverse";

/**
 * Buckets items under the named top-level tabs, in tab order, each bucket sorted
 * by the catalog rule (rarest, then highest value, then alphabetical).
 *
 * An item whose types span several tabs lands in the first match, so it appears
 * exactly once. Items matching no tab — which the dataset already reports as a
 * data note — fall into an "Other" bucket rather than being dropped; with
 * `reverse` that bucket leads, since it is the least expected.
 */
export function groupByCategoryTab(
  items: WikiItem[],
  order: CategoryBucketOrder = "tab",
): CategoryBucket[] {
  const tabs = CATEGORY_TABS.filter((tab) => tab.types.length > 0);
  const buckets: CategoryBucket[] = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    items: [],
  }));
  const other: CategoryBucket = { id: "other", label: "Other", items: [] };

  for (const item of items) {
    const index = tabs.findIndex((tab) => item.types.some((type) => tab.types.includes(type)));
    (index === -1 ? other : buckets[index]).items.push(item);
  }

  const ordered = [...buckets, other]
    .filter((bucket) => bucket.items.length > 0)
    .map((bucket) => ({ ...bucket, items: [...bucket.items].sort(compareForCatalog) }));

  return order === "reverse" ? ordered.reverse() : ordered;
}

/** Applies group, type and search filters, then sorts for display. */
export function filterCatalog(items: WikiItem[], query: CatalogQuery): WikiItem[] {
  const tab = getCategoryTab(query.groupId);
  const term = query.search.trim();

  return items
    .filter((item) => {
      if (tab.types.length > 0 && !item.types.some((type) => tab.types.includes(type))) {
        return false;
      }
      if (query.typeKey && !item.types.includes(query.typeKey)) return false;
      return matchesSearch(item, term);
    })
    .sort(compareForCatalog);
}

/**
 * Keeps the active type filter honest when the group changes: a type that is not
 * part of the new group silently resets to "all types".
 */
export function reconcileQuery(items: WikiItem[], query: CatalogQuery): CatalogQuery {
  if (!query.typeKey) return query;
  const valid = subTypeKeys(query.groupId).includes(query.typeKey);
  return valid ? query : { ...query, typeKey: null };
}
