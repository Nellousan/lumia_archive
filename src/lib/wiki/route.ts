import { gatherableMaterials } from "./recipe";
import type { RecipeMaterial, WikiArea, WikiDataset } from "./types";

/**
 * The island overlay model: which areas matter for the selected item, and what
 * should be shown on the bubble anchored to each one.
 */

/**
 * What the bubbles represent:
 *  - `recipe`: areas holding materials of the active item's crafting recipe.
 *  - `spawn`: the active item has no recipe, so the areas that hold the item
 *    itself are shown instead — otherwise the map would sit empty for the ~160
 *    gatherable items.
 */
export type MapOverlayMode = "recipe" | "spawn";

/**
 * A material focus on the map.
 *
 * Focusing one material highlights the areas holding it *and* the areas holding
 * everything needed to craft it, so the whole chain behind an ingredient lights
 * up rather than a single scattered area.
 */
export interface MapFocus {
  /** The material the pointer is on. */
  itemId: string;
  /** `itemId` plus every ingredient in its recipe subtree. */
  subtreeIds: string[];
}

export interface BubbleCard {
  material: RecipeMaterial;
  /** How many of this material the area contains. */
  quantityInArea: number;
}

export interface AreaBubble {
  area: WikiArea;
  cards: BubbleCard[];
  /** Total quantity of recipe materials available in this area. */
  totalQuantity: number;
}

/**
 * Intersects the materials of a recipe tree with the areas that contain them.
 *
 * One bubble per matching area; one card per material of the tree that spawns
 * there. Cards are keyed by area + item and their quantities summed, so a
 * material held in several loot slots of the same area still yields a single
 * card (which is the whole point of the bubble: how much is there in total).
 */
export function buildAreaBubbles(
  dataset: WikiDataset,
  materials: RecipeMaterial[],
): AreaBubble[] {
  const buckets = new Map<
    string,
    { area: WikiArea; cards: Map<string, BubbleCard>; totalQuantity: number }
  >();

  for (const material of gatherableMaterials(materials)) {
    for (const spawnRef of material.areas) {
      const area = dataset.areasById[spawnRef.areaId];
      if (!area || !area.mapped) continue;

      let bucket = buckets.get(area.id);
      if (!bucket) {
        bucket = { area, cards: new Map(), totalQuantity: 0 };
        buckets.set(area.id, bucket);
      }

      const existing = bucket.cards.get(material.item.id);
      if (existing) {
        existing.quantityInArea += spawnRef.quantity;
      } else {
        bucket.cards.set(material.item.id, {
          material,
          quantityInArea: spawnRef.quantity,
        });
      }
      bucket.totalQuantity += spawnRef.quantity;
    }
  }

  return [...buckets.values()]
    .map((bucket) => ({
      area: bucket.area,
      totalQuantity: bucket.totalQuantity,
      cards: [...bucket.cards.values()].sort(
        (a, b) =>
          a.material.depth - b.material.depth ||
          a.material.item.name.localeCompare(b.material.item.name),
      ),
    }))
    // Most rewarding areas first, then a stable alphabetical fallback.
    .sort(
      (a, b) =>
        b.cards.length - a.cards.length ||
        b.totalQuantity - a.totalQuantity ||
        a.area.name.localeCompare(b.area.name),
    );
}

/** Every area that contains at least one material of the tree (no card detail). */
export function areasForMaterials(materials: RecipeMaterial[]): Set<string> {
  const areaIds = new Set<string>();
  for (const material of materials) {
    for (const ref of material.areas) areaIds.add(ref.areaId);
  }
  return areaIds;
}
