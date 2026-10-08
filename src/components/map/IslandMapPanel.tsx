"use client";

import { AreaDetailPanel } from "@/components/area/AreaDetailPanel";
import { DataNotes } from "@/components/layout/DataNotes";
import { IslandMap } from "./IslandMap";
import { ClearSelectionButton } from "@/components/ui/ClearSelectionButton";
import type { BubblePlacement } from "@/lib/map-layout";
import type { AreaBubble, MapFocus, MapOverlayMode } from "@/lib/wiki/route";
import type { AreaItemRef, MapImage, RecipeMaterial, WikiArea } from "@/lib/wiki/types";

export interface IslandMapPanelProps {
  map: MapImage;
  areas: WikiArea[];
  bubbles: AreaBubble[];
  placements: Record<string, BubblePlacement>;
  /** Materials driving the bubbles; also marks the area panel's "recipe" rows. */
  materials: RecipeMaterial[];
  overlayMode: MapOverlayMode;
  focus: MapFocus | null;
  activeItemId: string | null;
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
  warnings: string[];
}

/** Right-hand pane: island artwork, area overlay and bubbles. */
export function IslandMapPanel({
  map,
  areas,
  bubbles,
  placements,
  materials,
  overlayMode,
  focus,
  activeItemId,
  hoveredAreaId,
  onHoverArea,
  onHoverMaterial,
  onSelectItem,
  onSelectArea,
  onClearSelection,
  selectedArea,
  selectedAreaItems,
  onCloseArea,
  warnings,
}: IslandMapPanelProps) {
  return (
    <section className="relative flex min-h-[560px] flex-1 flex-col bg-ink-850">
      <div className="pointer-events-none absolute inset-0 map-grid opacity-30" />

      <div className="relative z-10 flex flex-col gap-3 px-4 pb-1 pt-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:pt-5">
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
            {/* Two words carry what the removed caption used to say: bubbles either
                trace a recipe's materials or the item's own spawn areas — and with
                nothing selected there is no overlay at all. */}
            {activeItemId === null
              ? "Island overview"
              : overlayMode === "recipe"
                ? "Live resource map"
                : "Item spawn map"}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-stone-100">
            Lumia Island
          </h1>
        </div>

        <ClearSelectionButton
          label="Clear map"
          disabled={activeItemId === null}
          onClear={onClearSelection}
        />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 px-3 pb-3 pt-2 sm:px-4">
        <div className="m-auto w-full">
          <IslandMap
            map={map}
            areas={areas}
            bubbles={bubbles}
            placements={placements}
            focus={focus}
            hoveredAreaId={hoveredAreaId}
            activeAreaId={selectedArea?.id ?? null}
            onHoverArea={onHoverArea}
            onSelectArea={onSelectArea}
            onHoverMaterial={onHoverMaterial}
            onSelectItem={onSelectItem}
          />
        </div>
      </div>

      <DataNotes warnings={warnings} />

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
