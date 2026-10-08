"use client";

import { ItemFactsGrid, type ItemFact } from "./ItemFactsGrid";
import { ItemTypeBadges } from "./ItemTypeBadges";
import { RarityBadge } from "./RarityBadge";
import { RecipeTree } from "./RecipeTree";
import { RoutePlanList } from "./RoutePlanList";
import { ItemSprite } from "@/components/ui/ItemSprite";
import { PaneDivider } from "@/components/ui/PaneDivider";
import type { RoutePlan } from "@/lib/wiki/routes";
import type { AreaSpawnRef, RecipeNode, WikiItem } from "@/lib/wiki/types";

export interface ItemDetailPanelProps {
  /** `null` while nothing is selected. */
  item: WikiItem | null;
  tree: RecipeNode | null;
  materialCount: number;
  areaCount: number;
  spawnRefs: AreaSpawnRef[];
  /** Fastest ways to gather everything the item needs, best first. */
  routes: RoutePlan[];
  activeRouteId: string | null;
  focusedMaterialId: string | null;
  onHoverMaterial: (itemId: string | null) => void;
  onHoverRoute: (routeId: string | null) => void;
  onSelectRoute: (routeId: string) => void;
  onSelectItem: (itemId: string) => void;
  onSelectArea: (areaId: string) => void;
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
  spawnRefs,
  routes,
  activeRouteId,
  focusedMaterialId,
  onHoverMaterial,
  onHoverRoute,
  onSelectRoute,
  onSelectItem,
  onSelectArea,
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

  const facts: ItemFact[] = [
    {
      label: "Default qty",
      value: String(item.defaultQuantity),
      hint: "defaultQuantity from data.json.",
    },
    {
      label: "Found in",
      value: spawnRefs.length === 0 ? "—" : `${spawnRefs.length}`,
      hint: "Number of areas on Lumia Island containing this item.",
    },
    {
      label: "Recipe",
      value: item.craftable ? `${item.recipe?.length ?? 0} steps` : "Gathered",
      hint: "Direct ingredients, or 'Gathered' when the item has no recipe.",
    },
  ];

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

          {/* Value sits with the identity rather than in the facts grid, so the
              headline block reads as name / id / worth. */}
          <p className="mt-2 flex items-baseline gap-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-600">
              Value
            </span>
            <span className="font-mono text-base font-bold leading-none text-amber-300">
              {item.value === null ? "—" : item.value}
            </span>
          </p>
        </div>

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

      <ItemFactsGrid facts={facts} />

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

      <PaneDivider label="Fastest routes" />
      {/* Keyed by item so the "show all" fold resets when the selection moves on. */}
      <RoutePlanList
        key={item.id}
        routes={routes}
        activeRouteId={activeRouteId}
        onHoverRoute={onHoverRoute}
        onSelectRoute={onSelectRoute}
        onSelectArea={onSelectArea}
      />
    </div>
  );
}
