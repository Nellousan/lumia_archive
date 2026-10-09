"use client";

import { ItemTypeBadges } from "./ItemTypeBadges";
import { RarityBadge } from "./RarityBadge";
import { RecipeTree } from "./RecipeTree";
import { BookmarkButton } from "@/components/ui/BookmarkButton";
import { ItemSprite } from "@/components/ui/ItemSprite";
import { PaneDivider } from "@/components/ui/PaneDivider";
import type { RecipeNode, WikiItem } from "@/lib/wiki/types";

export interface ItemDetailPanelProps {
  /** `null` while nothing is selected. */
  item: WikiItem | null;
  tree: RecipeNode | null;
  materialCount: number;
  areaCount: number;
  /** True when the open item is part of the plan. */
  bookmarked: boolean;
  focusedMaterialId: string | null;
  onHoverMaterial: (itemId: string | null) => void;
  onSelectItem: (itemId: string) => void;
  onSelectArea: (areaId: string) => void;
  onToggleBookmark: (itemId: string) => void;
  canGoBack: boolean;
  onGoBack: () => void;
  /** Drops the selection so the map is emptied of bubbles. */
  onClearSelection: () => void;
}

/**
 * Left rail, bottom pane: everything `data.json` knows about the active item.
 * Only real fields are shown — the dataset has no description or flavour text.
 */
export function ItemDetailPanel({
  item,
  tree,
  materialCount,
  areaCount,
  bookmarked,
  focusedMaterialId,
  onHoverMaterial,
  onSelectItem,
  onSelectArea,
  onToggleBookmark,
  canGoBack,
  onGoBack,
  onClearSelection,
}: ItemDetailPanelProps) {
  // Nothing selected: the rail keeps the picker, the map stays empty.
  if (!item) {
    return (
      <div className="flex-1 p-4 sm:px-6 sm:py-5">
        <p className="rounded-xl border border-dashed border-white/10 p-5 text-center text-sm leading-relaxed text-stone-500">
          No item selected.
          <span className="mt-1 block text-xs text-stone-600">
            Pick one from the list above to map its crafting route.
          </span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:px-6 sm:py-5">
      {canGoBack && (
        <div className="mb-3">
          <button
            type="button"
            onClick={onGoBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-[11px] font-semibold text-stone-400 transition hover:border-white/20 hover:text-stone-100"
          >
            ← Back
          </button>
        </div>
      )}

      {/* The cross sits on the identity row rather than in a row of its own, so
          it never pushes the details down. */}
      <div className="flex items-start gap-4">
        <div className="grid shrink-0 place-items-center rounded-2xl border border-amber-200/25 bg-gradient-to-br from-amber-300/20 to-emerald-400/5 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,.08)]">
          <ItemSprite item={item} size="hero" bare />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <RarityBadge rarity={item.rarity} />
            <ItemTypeBadges types={item.types} />
          </div>
          <h2 className="mt-2 font-display text-2xl font-semibold leading-tight text-white">
            {item.name}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-stone-600">{item.id}</p>

          {/* Value sits with the identity rather than in a facts grid, so the
              headline block reads as name / id / worth — and what one craft
              hands over sits beside it, which is the other number the data
              actually carries. */}
          <p className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="flex items-baseline gap-2">
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-600">
                Value
              </span>
              <span className="font-mono text-base font-bold leading-none text-amber-300">
                {item.value === null ? "—" : item.value}
              </span>
            </span>

            <span
              title="How many units one craft hands over — defaultQuantity in data.json."
              className="flex items-baseline gap-2"
            >
              <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-600">
                Default qty
              </span>
              <span className="font-mono text-base font-bold leading-none text-stone-300">
                {item.defaultQuantity}
              </span>
            </span>
          </p>
        </div>

        <div className="flex shrink-0 flex-col gap-1">
          <BookmarkButton
            itemName={item.name}
            bookmarked={bookmarked}
            onToggle={() => onToggleBookmark(item.id)}
          />

          <button
            type="button"
            onClick={onClearSelection}
            aria-label="Unselect item"
            title="Deselect the item and empty the island map"
            className="grid size-7 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/[0.03] text-stone-400 transition hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-200"
          >
            <svg
              aria-hidden="true"
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>

      <PaneDivider label="Crafting recipe" />
      {tree ? (
        <RecipeTree
          tree={tree}
          materialCount={materialCount}
          areaCount={areaCount}
          focusedMaterialId={focusedMaterialId}
          onHoverMaterial={onHoverMaterial}
          onSelectItem={onSelectItem}
        />
      ) : (
        <p className="text-xs text-stone-500">Recipe data unavailable for this item.</p>
      )}

    </div>
  );
}
