"use client";

import { toLayerPosition, type BubblePlacement } from "@/lib/map-layout";
import type { WikiArea } from "@/lib/wiki/types";

export interface MapTooltipProps {
  area: WikiArea;
  anchor: BubblePlacement;
  /** Cap the overlay is drawn at; see {@link toLayerPosition}. */
  bubbleScale: number;
  /** Names of recipe materials found in this area, if any. */
  materialNames: string[];
}

/**
 * Lightweight hover card for areas that have no bubble of their own, so every
 * polygon still explains itself without cluttering the island.
 *
 * Sized in island pixels like the bubbles it stands in for, so it scales with the
 * map rather than with the window.
 */
export function MapTooltip({ area, anchor, bubbleScale, materialNames }: MapTooltipProps) {
  const { left, top } = toLayerPosition(anchor, bubbleScale);

  return (
    <div
      // The padding is the gap above the area: scaling from the bottom edge keeps
      // the card sitting just over its anchor whatever the bubble scale is.
      className="pointer-events-none absolute z-40 w-max max-w-[394px] pb-[14px]"
      style={{
        left,
        top,
        transformOrigin: "bottom center",
        transform: "translate(-50%, -100%)",
      }}
      role="status"
    >
      <div className="rounded-[20px] border border-white/10 bg-ink-950/95 px-[20px] py-[13px] text-center shadow-2xl backdrop-blur-md">
        <div className="font-display text-[21px] font-bold uppercase tracking-[0.08em] text-stone-100">
          {area.name}
        </div>
        {materialNames.length > 0 ? (
          <p className="mt-[6px] text-[18px] leading-snug text-emerald-300">
            {materialNames.join(" · ")}
          </p>
        ) : (
          <p className="mt-[6px] text-[18px] leading-snug text-stone-500">
            {area.empty
              ? "No recorded loot in data.json"
              : `${area.spawns.length} items · none needed for this craft`}
          </p>
        )}
      </div>
    </div>
  );
}
