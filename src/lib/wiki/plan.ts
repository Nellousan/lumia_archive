import { buildRecipeTree } from "./recipe";
import type { RecipeNode, WikiDataset, WikiItem } from "./types";

/**
 * The plan, as the routes and the map see it: which items are being gathered, in
 * which order, and how the solver is asked to cover them.
 *
 * This is deliberately tiny and dependency-free — the browser island, the URL
 * codec and the server-rendered link preview all have to agree on it, and the only
 * way to be sure they do is to have one implementation. It matters most for the
 * *order*: the recipe requirements reach the solver in sequence, so a plan listing
 * its items differently can rank its routes differently.
 */

/**
 * The items a plan gathers: the open item first — so it heads the plan bar — then
 * every bookmark in the order it was added, with the repeat dropped.
 *
 * Ids the dataset does not know are skipped rather than failing: a link from
 * another build may name an item this one no longer carries.
 */
export function plannedItemsFor(
  itemsById: Record<string, WikiItem>,
  itemId: string | null,
  bookmarkIds: string[],
): WikiItem[] {
  const planned: WikiItem[] = [];
  const selected = itemId === null ? null : (itemsById[itemId] ?? null);
  if (selected) planned.push(selected);

  for (const id of bookmarkIds) {
    if (id === selected?.id) continue;
    const item = itemsById[id];
    if (item) planned.push(item);
  }

  return planned;
}

/**
 * One recipe tree per planned item. The routes have to satisfy all of them, and an
 * item with no recipe of its own contributes nothing here — it is gathered, so the
 * map handles it through where it spawns.
 */
export function planTrees(dataset: WikiDataset, plannedItems: WikiItem[]): RecipeNode[] {
  return plannedItems
    .map((planned) => buildRecipeTree(dataset, planned.id))
    .filter((planned): planned is RecipeNode => planned !== null);
}

/** How a plan reads in a title: `1 item`, `3 items`. */
export function itemCountLabel(count: number): string {
  return `${count} item${count === 1 ? "" : "s"}`;
}

/** And an area count: `1 Area`, `3 Areas`. */
export function areaCountLabel(count: number): string {
  return `${count} Area${count === 1 ? "" : "s"}`;
}
