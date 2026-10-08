"use client";

import { useMemo } from "react";
import { estimateStepBubbleSize, resolveBubblePlacements } from "@/lib/map-layout";
import type { BubblePlacement } from "@/lib/map-layout";
import type { RoutePlan } from "@/lib/wiki/routes";
import type { MapImage } from "@/lib/wiki/types";

export interface StepOverlay {
  route: RoutePlan;
  /** Resolved bubble centres per step, in base-map pixels. */
  placements: Record<string, BubblePlacement>;
}

/**
 * The route steps to draw over the island, with their bubbles placed.
 *
 * Only a highlighted route gets one: with nothing hovered or pinned the island
 * keeps showing the plan's material bubbles, which are about *where things are*
 * rather than *what happens next*.
 */
export function useStepOverlay(route: RoutePlan | null, map: MapImage): StepOverlay | null {
  return useMemo(() => {
    if (!route || route.steps.length === 0) return null;

    return {
      route,
      placements: resolveBubblePlacements(
        route.steps.map((step) => ({
          id: step.area.id,
          x: step.area.anchor.x,
          y: step.area.anchor.y,
          ...estimateStepBubbleSize(step),
        })),
        { mapWidth: map.width, mapHeight: map.height },
      ),
    };
  }, [map.height, map.width, route]);
}
