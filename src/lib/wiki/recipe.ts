import type { RecipeMaterial, RecipeNode, WikiDataset, WikiItem } from "./types";

/**
 * Recipe-tree construction.
 *
 * `data.json` recipes are a flat list of ingredient ids with no quantities, and
 * they can nest (currently two levels deep). These helpers turn that into an
 * explicit tree plus a flattened material list for the map overlay.
 */

export interface RecipeTreeOptions {
  /** Safety valve against pathological or cyclic data. */
  maxDepth?: number;
}

const DEFAULT_MAX_DEPTH = 8;

function expand(
  item: WikiItem,
  quantity: number,
  depth: number,
  ancestors: ReadonlySet<string>,
  maxDepth: number,
  dataset: WikiDataset,
): RecipeNode {
  const cyclic = ancestors.has(item.id);
  const canExpand =
    item.recipe !== null && item.recipe.length > 0 && depth < maxDepth && !cyclic;

  const node: RecipeNode = {
    item,
    quantity,
    depth,
    children: [],
    expanded: canExpand,
    cyclic,
    areas: dataset.spawnsByItemId[item.id] ?? [],
  };
  if (!canExpand || !item.recipe) return node;

  const nextAncestors = new Set(ancestors);
  nextAncestors.add(item.id);

  node.children = item.recipe.flatMap((entry) => {
    const child = dataset.itemsById[entry.itemId];
    if (!child) return [];
    return [
      expand(child, quantity * entry.quantity, depth + 1, nextAncestors, maxDepth, dataset),
    ];
  });

  return node;
}

/**
 * Builds the full crafting tree for one item. Returns `null` when the id is
 * unknown. Leaf items (gathered resources) come back as a single node.
 */
export function buildRecipeTree(
  dataset: WikiDataset,
  rootItemId: string,
  options: RecipeTreeOptions = {},
): RecipeNode | null {
  const root = dataset.itemsById[rootItemId];
  if (!root) return null;

  return expand(
    root,
    1,
    0,
    new Set<string>(),
    options.maxDepth ?? DEFAULT_MAX_DEPTH,
    dataset,
  );
}

/**
 * Flattens every *descendant* of the tree into the materials you actually need
 * to gather, summing quantities across paths so diamond recipes are counted
 * once with the right total. The root item itself is excluded.
 */
export function collectRecipeMaterials(
  dataset: WikiDataset,
  tree: RecipeNode,
): RecipeMaterial[] {
  const accumulated = new Map<string, RecipeMaterial>();

  const walk = (node: RecipeNode) => {
    for (const child of node.children) {
      const existing = accumulated.get(child.item.id);
      if (existing) {
        existing.quantity += child.quantity;
        existing.depth = Math.min(existing.depth, child.depth);
      } else {
        accumulated.set(child.item.id, {
          item: child.item,
          quantity: child.quantity,
          depth: child.depth,
          intermediate: child.item.craftable,
          areas: dataset.spawnsByItemId[child.item.id] ?? [],
        });
      }
      walk(child);
    }
  };

  walk(tree);

  return [...accumulated.values()].sort(
    (a, b) => a.depth - b.depth || a.item.name.localeCompare(b.item.name),
  );
}

/**
 * Merges the material lists of several planned items (a selection plus its
 * bookmarks) into one, summing quantities for anything shared and keeping the
 * shallowest depth. Used by the island overlay, which maps the union.
 */
export function mergeMaterials(lists: RecipeMaterial[][]): RecipeMaterial[] {
  const merged = new Map<string, RecipeMaterial>();

  for (const list of lists) {
    for (const material of list) {
      const existing = merged.get(material.item.id);
      if (existing) {
        existing.quantity += material.quantity;
        existing.depth = Math.min(existing.depth, material.depth);
        continue;
      }
      merged.set(material.item.id, { ...material });
    }
  }

  return [...merged.values()].sort(
    (a, b) => a.depth - b.depth || a.item.name.localeCompare(b.item.name),
  );
}

/**
 * Materials that are obtainable somewhere on the island, i.e. the ones worth
 * drawing a bubble for. Sorted by the number of areas, most spread out first.
 */
export function gatherableMaterials(materials: RecipeMaterial[]): RecipeMaterial[] {
  return materials
    .filter((material) => material.areas.length > 0)
    .sort((a, b) => b.areas.length - a.areas.length || a.item.name.localeCompare(b.item.name));
}

/**
 * For every item in the tree, the ids of everything in its own subtree —
 * itself plus every ingredient needed to craft it.
 *
 * Used by the map: focusing one material highlights the areas holding it *and*
 * the areas holding the materials that lead to it. When an item appears at
 * several places in the tree (a diamond recipe) the subtrees are merged.
 */
export function buildSubtreeIndex(tree: RecipeNode): Record<string, string[]> {
  const index: Record<string, string[]> = {};

  const walk = (node: RecipeNode): string[] => {
    const ids = new Set<string>([node.item.id]);
    for (const child of node.children) {
      for (const id of walk(child)) ids.add(id);
    }

    const own = [...ids];
    const existing = index[node.item.id];
    if (existing) {
      for (const id of own) {
        if (!existing.includes(id)) existing.push(id);
      }
    } else {
      index[node.item.id] = own;
    }

    return own;
  };

  walk(tree);
  return index;
}

/** Total number of distinct crafted steps in a tree, the root included. */
export function countTreeNodes(node: RecipeNode): number {
  return 1 + node.children.reduce((total, child) => total + countTreeNodes(child), 0);
}
