"use client";

import { useMemo } from "react";
import { estimateBubbleSize, resolveBubblePlacements } from "@/lib/map-layout";
import {
  buildRecipeTree,
  buildSubtreeIndex,
  collectRecipeMaterials,
  mergeMaterials,
} from "@/lib/wiki/recipe";
import { buildRoutes } from "@/lib/wiki/routes";
import { buildAreaBubbles, type MapOverlayMode } from "@/lib/wiki/route";
import type { RecipeMaterial, RecipeNode, WikiDataset, WikiItem } from "@/lib/wiki/types";

/**
 * Turns the planning set — the selected item plus every bookmark — into
 * everything the island needs: the material list, the bubbles and their resolved
 * positions, plus the routes that gather it all.
 *
 * This is the one place that decides *what the island shows*. An item with no
 * recipe of its own contributes itself as a "material", so its own spawn areas
 * are mapped instead — see {@link MapOverlayMode}.
 *
 * The selected item's own tree is kept separately for the detail panel, which
 * still shows that one item's crafting chain and facts.
 */
export function useRoutePlan(
  dataset: WikiDataset,
  item: WikiItem | null,
  plannedItems: WikiItem[],
  startingClothes: string | null = null,
) {
  // `item` is null while nothing is selected: the detail-panel values collapse
  // to empty, which is what empties that half of the rail.
  const tree = useMemo(() => (item ? buildRecipeTree(dataset, item.id) : null), [dataset, item]);

  const recipeMaterials = useMemo(
    () => (tree ? collectRecipeMaterials(dataset, tree) : []),
    [dataset, tree],
  );

  /**
   * item id -> itself plus every ingredient needed to craft it. The map uses it
   * to widen a material focus up the crafting chain.
   */
  const subtreeByItemId = useMemo(() => (tree ? buildSubtreeIndex(tree) : {}), [tree]);

  /** One tree per planned item; the routes have to satisfy all of them. */
  const plannedTrees = useMemo(
    () =>
      plannedItems
        .map((planned) => buildRecipeTree(dataset, planned.id))
        .filter((planned): planned is RecipeNode => planned !== null),
    [dataset, plannedItems],
  );

  /**
   * Everything the island maps: each planned item contributes its recipe
   * materials, or itself when it is simply gathered. Shared materials — Scrap
   * Metal needed by three crafts — collapse into one bubble card with the summed
   * quantity.
   */
  const materials = useMemo<RecipeMaterial[]>(() => {
    const lists: RecipeMaterial[][] = [];

    for (const planned of plannedItems) {
      const plannedTree = buildRecipeTree(dataset, planned.id);
      if (!plannedTree) continue;

      const gathered = collectRecipeMaterials(dataset, plannedTree);
      if (gathered.length > 0) {
        lists.push(gathered);
        continue;
      }

      const spawns = dataset.spawnsByItemId[planned.id] ?? [];
      if (spawns.length > 0) {
        lists.push([
          { item: planned, quantity: 1, depth: 0, intermediate: false, areas: spawns },
        ]);
      }
    }

    return mergeMaterials(lists);
  }, [dataset, plannedItems]);

  // Depth 0 means "the planned item itself", i.e. a gather-only plan; anything
  // deeper came from a recipe.
  const overlayMode: MapOverlayMode = materials.some((material) => material.depth > 0)
    ? "recipe"
    : "spawn";

  const bubbles = useMemo(() => buildAreaBubbles(dataset, materials), [dataset, materials]);

  const placements = useMemo(
    () =>
      resolveBubblePlacements(
        bubbles.map((bubble) => ({
          id: bubble.area.id,
          x: bubble.area.anchor.x,
          y: bubble.area.anchor.y,
          ...estimateBubbleSize(bubble),
        })),
        { mapWidth: dataset.map.width, mapHeight: dataset.map.height },
      ),
    [bubbles, dataset.map.height, dataset.map.width],
  );

  /** Distinct areas that hold at least one material. */
  const areaCount = useMemo(() => {
    const ids = new Set<string>();
    for (const material of materials) {
      for (const ref of material.areas) ids.add(ref.areaId);
    }
    return ids.size;
  }, [materials]);

  /** Same, but the selected item's recipe only — the detail panel's fact. */
  const recipeAreaCount = useMemo(() => {
    const ids = new Set<string>();
    for (const material of recipeMaterials) {
      for (const ref of material.areas) ids.add(ref.areaId);
    }
    return ids.size;
  }, [recipeMaterials]);

  /**
   * Routes that obtain every planned item, fastest first. Built from the trees
   * so the OR structure survives: a craftable material may be gathered instead
   * of crafted, which is often the whole point of the fastest route.
   */
  const routePlans = useMemo(
    () => buildRoutes(dataset, plannedTrees, { startingClothes }),
    [dataset, plannedTrees, startingClothes],
  );

  /**
   * Planned items nothing can obtain — an item that spawns nowhere and has no
   * recipe, or whose ingredients hit the same dead end. Only resolved when the
   * plan has no route at all, so the rail can name the culprit instead of
   * leaving the reader to guess. Skipped when the failure was the pack, not the
   * island: everything in that plan is obtainable, just not carriable.
   */
  const unobtainable = useMemo(() => {
    if (routePlans.routes.length > 0 || routePlans.inventoryBlocked) return [];
    return plannedItems.filter((planned) => {
      const plannedTree = buildRecipeTree(dataset, planned.id);
      return (
        plannedTree !== null &&
        buildRoutes(dataset, [plannedTree], { startingClothes }).routes.length === 0
      );
    });
  }, [dataset, plannedItems, routePlans, startingClothes]);

  return {
    tree,
    subtreeByItemId,
    materials,
    recipeMaterials,
    overlayMode,
    bubbles,
    placements,
    areaCount,
    recipeAreaCount,
    routes: routePlans.routes,
    routesTruncated: routePlans.truncated,
    inventoryBlocked: routePlans.inventoryBlocked,
    unobtainable,
  };
}
