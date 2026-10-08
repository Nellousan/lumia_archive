"use client";

import type { BubblePlacement } from "@/lib/map-layout";
import { toPercentPosition } from "@/lib/map-layout";
import type { MapImage, WikiArea } from "@/lib/wiki/types";

export interface MapTooltipProps {
  area: WikiArea;
  anchor: BubblePlacement;
  map: MapImage;
  /** Names of recipe materials found in this area, if any. */
  materialNames: string[];
}

/**
 * Lightweight hover card for areas that have no bubble of their own, so every
 * polygon still explains itself without cluttering the island.
 */
export function MapTooltip({ area, anchor, map, materialNames }: MapTooltipProps) {
  const { left, top } = toPercentPosition(anchor, map.width, map.height);

  return (
    <div
      className="pointer-events-none absolute z-30 w-max max-w-[240px] -translate-x-1/2 -translate-y-[135%]"
      style={{ left, top }}
      role="status"
    >
      <div className="rounded-xl border border-white/10 bg-ink-950/95 px-3 py-2 text-center shadow-2xl backdrop-blur-md">
        <div className="font-display text-[13px] font-bold uppercase tracking-[0.08em] text-stone-100">
          {area.name}
        </div>
        {materialNames.length > 0 ? (
          <p className="mt-1 text-[11px] leading-snug text-emerald-300">
            {materialNames.join(" · ")}
          </p>
        ) : (
          <p className="mt-1 text-[11px] leading-snug text-stone-500">
            {area.empty
              ? "No recorded loot in data.json"
              : `${area.spawns.length} items · none needed for this craft`}
          </p>
        )}
      </div>
    </div>
  );
}
