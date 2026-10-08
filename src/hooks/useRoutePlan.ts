"use client";

import { useMemo } from "react";
import { estimateBubbleSize, resolveBubblePlacements } from "@/lib/map-layout";
import { buildRecipeTree, buildSubtreeIndex, collectRecipeMaterials } from "@/lib/wiki/recipe";
import { buildRoutes } from "@/lib/wiki/routes";
import { buildAreaBubbles, type MapOverlayMode } from "@/lib/wiki/route";
import type {
  AreaSpawnRef,
  RecipeMaterial,
  WikiDataset,
  WikiItem,
} from "@/lib/wiki/types";

/**
 * Turns the active item into everything the map needs: the recipe tree, the
 * flat material list, the bubbles and their resolved positions.
 *
 * This is the one place that decides *what the island shows*. When the active
 * item has no recipe of its own, the item itself becomes the "material" so its
 * own spawn areas are mapped instead — see {@link MapOverlayMode}.
 */
export function useRoutePlan(
  dataset: WikiDataset,
  item: WikiItem | null,
  spawnRefs: AreaSpawnRef[],
) {
  // `item` is null while nothing is selected: every derived value collapses to
  // empty, which is what empties the island map.
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

  const overlayMode: MapOverlayMode = recipeMaterials.length > 0 ? "recipe" : "spawn";

  const materials = useMemo<RecipeMaterial[]>(() => {
    if (!item) return [];
    if (recipeMaterials.length > 0) return recipeMaterials;
    if (spawnRefs.length === 0) return [];
    return [{ item, quantity: 1, depth: 0, intermediate: false, areas: spawnRefs }];
  }, [recipeMaterials, item, spawnRefs]);

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

  /** Same, but recipe-only — the synthetic spawn-mode entry is excluded. */
  const recipeAreaCount = useMemo(() => {
    const ids = new Set<string>();
    for (const material of recipeMaterials) {
      for (const ref of material.areas) ids.add(ref.areaId);
    }
    return ids.size;
  }, [recipeMaterials]);

  /**
   * Routes that obtain the active item, fastest first. Built from the tree so
   * the OR structure survives: a craftable material may be gathered instead of
   * crafted, which is often the whole point of the fastest route.
   */
  const routes = useMemo(() => buildRoutes(dataset, tree), [dataset, tree]);

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
    routes,
  };
}
