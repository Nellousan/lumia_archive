"use client";

import { useEffect, useMemo, useState } from "react";
import {
  bubbleScaleFor,
  estimateBubbleSize,
  estimateStepBubbleSize,
  resolveBubblePlacements,
} from "@/lib/map-layout";
import {
  buildRecipeTree,
  buildSubtreeIndex,
  collectRecipeMaterials,
  mergeMaterials,
} from "@/lib/wiki/recipe";
import { planTrees } from "@/lib/wiki/plan";
import {
  DEFAULT_LOOK_AHEAD,
  buildManualRoute,
  buildRoutesCached,
  type RouteModeChoice,
  type RoutePlan,
  type RoutePlanSet,
} from "@/lib/wiki/routes";
import { solveRoutes } from "@/lib/wiki/route-pool";
import { buildAreaBubbles, type MapOverlayMode } from "@/lib/wiki/route";
import type { RecipeMaterial, RecipeNode, WikiDataset, WikiItem } from "@/lib/wiki/types";

/** Stable empties, so a plan with nothing to show does not churn identities. */
const NO_AREAS: string[] = [];
const NO_ROUTES: RoutePlan[] = [];
const NO_ITEMS: WikiItem[] = [];

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
export interface RoutePlanOptions {
  /** Clothes picked before the match; null means the survivor starts bare. */
  startingClothes?: string | null;
  mode?: RouteModeChoice;
  lookAhead?: number;
  /**
   * Rendered width of the island, in CSS pixels, measured by the map. The bubble
   * sizes below depend on it, so the boxes the layout solver spaces apart are the
   * boxes the browser actually draws. Unknown (`null`) until the map is on
   * screen, which only costs one layout pass.
   */
  islandWidth?: number | null;
  /**
   * Whether the island also shows what wild animals can drop. Off by default;
   * the routes ignore animal loot either way.
   */
  showAnimalDrops?: boolean;
  /**
   * The areas the reader has clicked in `manual` mode, in visit order. Ignored
   * in the other modes.
   */
  manualAreaIds?: string[];
  /**
   * True while a manual walk is held down. A locked walk is read rather than
   * drawn, so the island answers like a computed route — including the hover that
   * asks where else a material is, which needs the whole map of where things are
   * rather than only what is left to collect.
   */
  manualLocked?: boolean;
}

export function useRoutePlan(
  dataset: WikiDataset,
  item: WikiItem | null,
  plannedItems: WikiItem[],
  options: RoutePlanOptions = {},
) {
  const {
    startingClothes = null,
    mode = "fastest",
    lookAhead = DEFAULT_LOOK_AHEAD,
    islandWidth = null,
    showAnimalDrops = false,
    manualAreaIds = NO_AREAS,
    manualLocked = false,
  } = options;
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
  const plannedTrees = useMemo(() => planTrees(dataset, plannedItems), [dataset, plannedItems]);

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

      // A plan item with no recipe is mapped through its own sourcing: its loot
      // slots, or failing that the animals that drop it.
      const spawns = dataset.spawnsByItemId[planned.id] ?? [];
      const animalDrops = dataset.animalDropsByItemId[planned.id] ?? [];
      if (spawns.length > 0 || animalDrops.length > 0) {
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

  /**
   * The stops the reader clicked, walked like a route. `null` outside manual mode;
   * inside it, `route` is `null` until the first stop exists while `required` — the
   * plan's own gathering requirement — is there from the first render, so the island
   * can say what a walk would have to collect before there is one.
   */
  const manual = useMemo(
    () =>
      mode === "manual" && plannedTrees.length > 0
        ? buildManualRoute(dataset, plannedTrees, manualAreaIds, { startingClothes })
        : null,
    [dataset, manualAreaIds, mode, plannedTrees, startingClothes],
  );

  /**
   * What the island still has to show in manual mode: a material the walk has
   * collected as much of as the plan needs comes off every bubble that held it —
   * the area it was collected in included, which is the point, since what is left
   * to collect is what the bubbles are for. An area left with no cards loses its
   * bubble with them; a traced stop that emptied its own area gets its bubble back
   * below, because the stop is on the map either way.
   *
   * The count is against the *plan's* requirement, not the material list's totals.
   * That list walks the whole recipe tree — both a craftable node and the
   * ingredients it could be built from, once per planned item that wants it — so it
   * is a map of where things are, not a shopping list; comparing a walk's pickups
   * against it left materials the walk had already collected sitting on every other
   * bubble. A material with no requirement at all is not something the walk
   * collects — an intermediate it builds, or the armor the survivor walks in with —
   * so it is not on the island while a walk is being drawn.
   */
  const mapMaterials = useMemo(() => {
    if (!manual || manualLocked) return materials;
    return materials.filter((material) => {
      const collected = manual.gathered[material.item.id] ?? 0;
      const needed = manual.required[material.item.id] ?? 0;
      return collected < needed;
    });
  }, [manual, manualLocked, materials]);

  const bubbles = useMemo(
    () => buildAreaBubbles(dataset, mapMaterials, { includeAnimalDrops: showAnimalDrops }),
    [dataset, mapMaterials, showAnimalDrops],
  );

  /**
   * Where every box on the island goes.
   *
   * Both shapes are solved together, because an area is one box: a stop of the walk
   * is drawn as a step — the numbered header, the cards on one line — so it is
   * reserved the step's size, and every other area keeps the material bubble's
   * pinned width, where the cards wrap. Solving them in one pass is also what keeps
   * them apart: an area is never both, so no two boxes can claim the same id.
   */
  const placements = useMemo(() => {
    const bubbleScale = bubbleScaleFor(islandWidth, dataset.map.width);
    const steps = manual?.route?.steps ?? [];
    const stepAreaIds = new Set(steps.map((step) => step.area.id));
    return resolveBubblePlacements(
      [
        ...steps.map((step) => ({
          id: step.area.id,
          x: step.area.anchor.x,
          y: step.area.anchor.y,
          ...estimateStepBubbleSize(step, bubbleScale),
        })),
        ...bubbles
          .filter((bubble) => !stepAreaIds.has(bubble.area.id))
          .map((bubble) => ({
            id: bubble.area.id,
            x: bubble.area.anchor.x,
            y: bubble.area.anchor.y,
            ...estimateBubbleSize(bubble, bubbleScale),
          })),
      ],
      { mapWidth: dataset.map.width, mapHeight: dataset.map.height },
    );
  }, [bubbles, dataset.map.height, dataset.map.width, islandWidth, manual]);

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
   *
   * `manual` is not a way of ranking, so it solves as `fastest`: the rail shows
   * the trace instead of the list, but the empty states above it — and the number
   * a trace is read against — should still describe the shortest walk there is.
   *
   * The solve is the one thing on this screen that is expensive (a wide plan costs
   * a few hundred milliseconds), so it does not happen here: it is asked for, off
   * the main thread, and lands in state a moment later. Nothing else in this hook
   * waits for it — the material list, the bubbles, their placement and the reader's
   * own trace are all derived on the spot — so the island is live while the route
   * section says it is still working.
   *
   * The answer is held **with the key it was asked for**, so a stale one can never
   * be read: a plan is whatever its trees and settings say it is, and when they
   * move the old answer stops matching the key and the section goes back to solving.
   * The pool behind `solveRoutes` caches by that same key, in flight included, so
   * switching mode and back is free.
   */
  const plannedKey = useMemo(
    () =>
      `${plannedTrees.map((tree) => `${tree.item.id}x${tree.quantity}`).join("|")}#${startingClothes ?? ""}#${
        mode === "manual" ? "fastest" : mode
      }#${lookAhead}`,
    [lookAhead, mode, plannedTrees, startingClothes],
  );
  const [solved, setSolved] = useState<{ key: string; plans: RoutePlanSet } | null>(null);

  useEffect(() => {
    if (plannedTrees.length === 0) return;
    let live = true;
    void solveRoutes(dataset, plannedTrees, {
      startingClothes,
      mode: mode === "manual" ? "fastest" : mode,
      lookAhead,
    }).then((plans) => {
      if (live) setSolved({ key: plannedKey, plans });
    });
    return () => {
      live = false;
    };
  }, [dataset, lookAhead, mode, plannedKey, plannedTrees, startingClothes]);

  const routePlans = solved !== null && solved.key === plannedKey ? solved.plans : null;
  /** True while the routes for what is on screen have not arrived yet. */
  const solving = plannedTrees.length > 0 && routePlans === null;

  /**
   * Planned items nothing can obtain. Components the island has no location for
   * are assumed to be carried rather than blocking the plan, so this now only
   * catches genuinely broken data (an item the loader could not resolve). Kept as
   * a safety net so a future dataset cannot produce a silently empty route list.
   */
  const unobtainable = useMemo(() => {
    if (routePlans === null || routePlans.routes.length > 0 || routePlans.inventoryBlocked) {
      return [];
    }
    return plannedItems.filter((planned) => {
      const plannedTree = buildRecipeTree(dataset, planned.id);
      return (
        plannedTree !== null &&
        buildRoutesCached(dataset, [plannedTree], { startingClothes }).routes.length === 0
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
    routes: routePlans?.routes ?? NO_ROUTES,
    /** The reader's own trace, in `manual` mode; `null` otherwise. */
    manualRoute: manual?.route ?? null,
    /** True when that trace finishes the plan. */
    manualComplete: manual?.complete ?? false,
    routesTruncated: routePlans?.truncated ?? false,
    inventoryBlocked: routePlans?.inventoryBlocked ?? false,
    assumed: routePlans?.assumed ?? NO_ITEMS,
    nothingToGather: routePlans?.nothingToGather ?? false,
    /** True while the routes for the plan on screen are still being solved. */
    solving,
    unobtainable,
  };
}
