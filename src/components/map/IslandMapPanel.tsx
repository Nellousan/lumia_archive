"use client";

import { AreaDetailPanel } from "@/components/area/AreaDetailPanel";
import type { BookmarkEntry } from "@/components/bookmarks/BookmarkBar";
import { BookmarkBar } from "@/components/bookmarks/BookmarkBar";
import { IslandMap } from "./IslandMap";
import type { StepOverlay } from "@/hooks/useStepOverlay";
import type { BubblePlacement } from "@/lib/map-layout";
import type { AreaBubble, MapFocus, MapOverlayMode } from "@/lib/wiki/route";
import type { RoutePlan } from "@/lib/wiki/routes";
import type { AreaItemRef, MapImage, WikiAnimal, WikiArea, WikiItem } from "@/lib/wiki/types";

export interface IslandMapPanelProps {
  /**
   * Display classes for the pane. The explorer swaps them to hide the map behind
   * the mobile tabs; laid out on its own it is simply a flex column.
   */
  className?: string;
  /** The items with no fixed area, listed in the island's own box. */
  randomSpawnItems: WikiItem[];
  /** item id -> the animals that can drop it; the box names the source. */
  dropAnimalsByItemId: Record<string, WikiAnimal[]>;
  /** Ids of the items the current plan needs; the box highlights them. */
  plannedItemIds: string[];
  /** True when the island is also showing what wild animals can drop. */
  animalDrops: boolean;
  onToggleAnimalDrops: () => void;
  /** Rendered width of the island, in CSS pixels; null before it is measured. */
  renderWidth: number | null;
  onRenderWidthChange: (width: number) => void;
  map: MapImage;
  areas: WikiArea[];
  bubbles: AreaBubble[];
  placements: Record<string, BubblePlacement>;
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
  selectedArea: WikiArea | null;
  selectedAreaItems: AreaItemRef[];
  /** Wild animals living in the selected area; the panel shows their cards. */
  selectedAreaAnimals: WikiAnimal[];
  onCloseArea: () => void;
}

/** Right-hand pane: island artwork, area overlay and bubbles. */
export function IslandMapPanel({
  className = "flex",
  randomSpawnItems,
  dropAnimalsByItemId,
  plannedItemIds,
  animalDrops,
  onToggleAnimalDrops,
  renderWidth,
  onRenderWidthChange,
  map,
  areas,
  bubbles,
  placements,
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
  selectedArea,
  selectedAreaItems,
  selectedAreaAnimals,
  onCloseArea,
}: IslandMapPanelProps) {
  return (
    <section
      id="pane-map"
      role="tabpanel"
      aria-labelledby="tab-map"
      className={`relative min-h-0 flex-1 flex-col bg-ink-850 ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 map-grid opacity-30" />

      <div className="relative z-10 flex shrink-0 flex-col gap-3 px-4 pb-1 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-5">
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

      </div>

      <BookmarkBar
        entries={bookmarks}
        onEntryClick={onBookmarkEntryClick}
        onClearBookmarks={onClearBookmarks}
      />

      {/*
       * Pans when the island cannot fit at a legible size; `IslandMap` sets the
       * minimum width, so the map is never squeezed into unreadable bubbles.
       * `max-h-full` keeps the scroller inside the pane on a short screen —
       * `m-auto` alone would let it grow to the island's height instead, and the
       * bottom of the map would be clipped with no way to reach it.
       */}
      <div className="relative z-10 flex min-h-0 flex-1 px-3 pb-3 pt-2 sm:px-4">
        <div className="m-auto max-h-full w-full overflow-auto">
          <IslandMap
            renderWidth={renderWidth}
            onRenderWidthChange={onRenderWidthChange}
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
            randomSpawnItems={randomSpawnItems}
            dropAnimalsByItemId={dropAnimalsByItemId}
            plannedItemIds={plannedItemIds}
            animalDrops={animalDrops}
            onToggleAnimalDrops={onToggleAnimalDrops}
          />
        </div>
      </div>

      {selectedArea && (
        <>
          {/* The island behind the panel is a click away from closing it. It is
              invisible — the map is worth reading while the panel is open — so it
              only catches the click; the ✕ above stays for the keyboard. */}
          <div
            aria-hidden="true"
            onClick={onCloseArea}
            className="absolute inset-0 z-30"
          />
          <AreaDetailPanel
            area={selectedArea}
            animals={selectedAreaAnimals}
            items={selectedAreaItems}
            activeItemId={activeItemId}
            onSelectItem={onSelectItem}
            onClose={onCloseArea}
          />
        </>
      )}
    </section>
  );
}
