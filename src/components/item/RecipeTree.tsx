"use client";

import { RecipeBranch } from "./RecipeBranch";
import type { RecipeNode } from "@/lib/wiki/types";

export interface RecipeTreeProps {
  /** Tree rooted at the active item; the root itself is rendered by the detail header. */
  tree: RecipeNode;
  /** Distinct materials in the tree, root excluded. */
  materialCount: number;
  /** Distinct areas those materials can be gathered from. */
  areaCount: number;
  focusedMaterialId: string | null;
  onHoverMaterial: (itemId: string | null) => void;
  onSelectItem: (itemId: string) => void;
}

/**
 * Full crafting chain drawn as a tree — siblings side by side, each connected to
 * its parent by a rail. Recursion is bounded and cycle-guarded in
 * `lib/wiki/recipe.ts`, so nothing here assumes a depth.
 */
export function RecipeTree({
  tree,
  materialCount,
  areaCount,
  focusedMaterialId,
  onHoverMaterial,
  onSelectItem,
}: RecipeTreeProps) {
  if (tree.children.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
        No crafting recipe — this item is gathered directly on Lumia Island.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="font-mono text-[11px] text-stone-500">
          {materialCount} material{materialCount === 1 ? "" : "s"} · {areaCount} area
          {areaCount === 1 ? "" : "s"}
        </p>
        <p className="text-[10px] text-stone-600">hover to focus on the map · click to open</p>
      </div>

      <RecipeBranch
        nodes={tree.children}
        focusedMaterialId={focusedMaterialId}
        onHoverMaterial={onHoverMaterial}
        onSelectItem={onSelectItem}
      />
    </div>
  );
}
