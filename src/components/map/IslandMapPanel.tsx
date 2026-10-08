"use client";

import { AreaDetailPanel } from "@/components/area/AreaDetailPanel";
import type { BookmarkEntry } from "@/components/bookmarks/BookmarkBar";
import { BookmarkBar } from "@/components/bookmarks/BookmarkBar";
import { IslandMap } from "./IslandMap";
import { ClearSelectionButton } from "@/components/ui/ClearSelectionButton";
import type { StepOverlay } from "@/hooks/useStepOverlay";
import type { BubblePlacement } from "@/lib/map-layout";
import type { AreaBubble, MapFocus, MapOverlayMode } from "@/lib/wiki/route";
import type { RoutePlan } from "@/lib/wiki/routes";
import type { AreaItemRef, MapImage, RecipeMaterial, WikiArea } from "@/lib/wiki/types";

export interface IslandMapPanelProps {
  map: MapImage;
  areas: WikiArea[];
  bubbles: AreaBubble[];
  placements: Record<string, BubblePlacement>;
  /** Materials driving the bubbles; also marks the area panel's "recipe" rows. */
  materials: RecipeMaterial[];
  overlayMode: MapOverlayMode;
  /** False when the plan is empty: the island shows no bubbles at all. */
  hasPlan: boolean;
  focus: MapFocus | null;
  /** Route hovered or pinned in the rail, drawn over the island. */
  activeRoute: RoutePlan | null;
  /** The active route's steps, whose bubbles replace the material ones. */
  stepOverlay: StepOverlay | null;
  activeItemId: string | null;
  /** The planning set, shown above the island. */
  bookmarks: BookmarkEntry[];
  onBookmarkEntryClick: (itemId: string) => void;
  onClearBookmarks: () => void;
  hoveredAreaId: string | null;
  onHoverArea: (areaId: string | null) => void;
  onHoverMaterial: (itemId: string | null) => void;
  onSelectItem: (itemId: string) => void;
  onSelectArea: (areaId: string) => void;
  /** Drops the selection so the map is emptied of bubbles. */
  onClearSelection: () => void;
  selectedArea: WikiArea | null;
  selectedAreaItems: AreaItemRef[];
  onCloseArea: () => void;
}

/** Right-hand pane: island artwork, area overlay and bubbles. */
export function IslandMapPanel({
  map,
  areas,
  bubbles,
  placements,
  materials,
  overlayMode,
  hasPlan,
  focus,
  activeRoute,
  stepOverlay,
  activeItemId,
  bookmarks,
  onBookmarkEntryClick,
  onClearBookmarks,
  hoveredAreaId,
  onHoverArea,
  onHoverMaterial,
  onSelectItem,
  onSelectArea,
  onClearSelection,
  selectedArea,
  selectedAreaItems,
  onCloseArea,
}: IslandMapPanelProps) {
  return (
    <section className="relative flex min-h-[560px] flex-1 flex-col bg-ink-850">
      <div className="pointer-events-none absolute inset-0 map-grid opacity-30" />

      <div className="relative z-10 flex flex-col gap-3 px-4 pb-1 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            {/* Two words carry what the removed caption used to say: bubbles either
                trace a recipe's materials or the items' own spawn areas — and with
                an empty plan there is no overlay at all. */}
            {!hasPlan ? "Island overview" : overlayMode === "recipe" ? "Live resource map" : "Item spawn map"}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-100">
            Lumia Island
          </h1>
        </div>

        <ClearSelectionButton
          label="Clear item"
          disabled={activeItemId === null}
          hint={
            bookmarks.length > 1
              ? "Deselect the item — the bookmarked items stay in the plan"
              : "Deselect the item, emptying the island"
          }
          onClear={onClearSelection}
        />
      </div>

      <BookmarkBar
        entries={bookmarks}
        onEntryClick={onBookmarkEntryClick}
        onClearBookmarks={onClearBookmarks}
      />

      <div className="relative z-10 flex min-h-0 flex-1 px-3 pb-3 pt-2 sm:px-4">
        <div className="m-auto w-full">
          <IslandMap
            map={map}
            areas={areas}
            bubbles={bubbles}
            placements={placements}
            focus={focus}
            activeRoute={activeRoute}
            stepOverlay={stepOverlay}
            hoveredAreaId={hoveredAreaId}
            activeAreaId={selectedArea?.id ?? null}
            onHoverArea={onHoverArea}
            onSelectArea={onSelectArea}
            onHoverMaterial={onHoverMaterial}
            onSelectItem={onSelectItem}
          />
        </div>
      </div>

      {selectedArea && (
        <AreaDetailPanel
          area={selectedArea}
          items={selectedAreaItems}
          activeItemId={activeItemId}
          relevantItemIds={materials.map((material) => material.item.id)}
          onSelectItem={onSelectItem}
          onClose={onCloseArea}
        />
      )}
    </section>
  );
}
