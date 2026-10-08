"use client";

import { ItemCard } from "@/components/ui/ItemCard";
import type { RecipeNode } from "@/lib/wiki/types";

const RAIL = "bg-white/[0.18]";

export interface RecipeBranchProps {
  /** Sibling ingredients at one level of the tree. */
  nodes: RecipeNode[];
  focusedMaterialId: string | null;
  onHoverMaterial: (itemId: string | null) => void;
  onSelectItem: (itemId: string) => void;
}

/**
 * One level of the crafting tree.
 *
 * Siblings sit side by side, joined to their parent by a horizontal rail with a
 * vertical stub down into each card. Each card then renders its own branch
 * underneath, so the whole chain reads as a tree.
 *
 * The rail is drawn per column as two half-width segments: every column except
 * the first contributes the left half, every column except the last contributes
 * the right half. Because the columns are adjacent, the halves meet exactly at
 * the boundary between two cards — which is also where the parent's stub lands
 * for an even number of children.
 *
 * Columns are equal-width and uncapped, so the branch fills the panel. Every
 * recipe in `data.json` has exactly two direct ingredients, which puts the
 * sub-ingredients at half the width — about the size of a catalog card.
 */
export function RecipeBranch({
  nodes,
  focusedMaterialId,
  onHoverMaterial,
  onSelectItem,
}: RecipeBranchProps) {
  if (nodes.length === 0) return null;

  const lastIndex = nodes.length - 1;

  return (
    <div className="flex w-full flex-col items-center">
      {/* Drop from the parent card down to the rail. */}
      <span aria-hidden="true" className={`h-3 w-px ${RAIL}`} />

      <div className="flex w-full items-stretch justify-center">
        {nodes.map((node, index) => (
          <div key={node.item.id} className="relative min-w-0 flex-1 px-1">
            {index > 0 && (
              <span aria-hidden="true" className={`absolute left-0 top-0 h-px w-1/2 ${RAIL}`} />
            )}
            {index < lastIndex && (
              <span aria-hidden="true" className={`absolute left-1/2 top-0 h-px w-1/2 ${RAIL}`} />
            )}
            {/* Stub down into this card. */}
            <span
              aria-hidden="true"
              className={`absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 ${RAIL}`}
            />

            <div className="pt-3">
              <ItemCard
                item={node.item}
                focused={focusedMaterialId === node.item.id}
                onSelect={onSelectItem}
                onHover={onHoverMaterial}
              />

              {node.children.length > 0 && (
                <RecipeBranch
                  nodes={node.children}
                  focusedMaterialId={focusedMaterialId}
                  onHoverMaterial={onHoverMaterial}
                  onSelectItem={onSelectItem}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
