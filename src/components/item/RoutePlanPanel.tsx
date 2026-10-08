"use client";

import { RoutePlanList } from "./RoutePlanList";
import { PaneDivider } from "@/components/ui/PaneDivider";
import { ItemSprite } from "@/components/ui/ItemSprite";
import type { RoutePlan } from "@/lib/wiki/routes";
import type { WikiItem } from "@/lib/wiki/types";

export interface RoutePlanPanelProps {
  /** Fastest ways to gather everything in the plan, best first. */
  routes: RoutePlan[];
  /** How many items the routes cover — the selection plus the bookmarks. */
  plannedCount: number;
  /** True when only the fastest slice of the routes is listed. */
  truncated: boolean;
  /** Names of planned items nothing can obtain, for the empty state. */
  unobtainableNames: string[];
  /** True when no route fits the six bag slots. */
  inventoryBlocked: boolean;
  activeRouteId: string | null;
  /** Resets the "show all" fold when the plan changes. */
  planKey: string;
  /** Armor the survivor starts wearing, or `null` when the pick is the default. */
  startingClothes: string | null;
  /** The clothes that can be picked as a starting piece. */
  startingOptions: WikiItem[];
  onStartingClothesChange: (itemId: string | null) => void;
  onHoverRoute: (routeId: string | null) => void;
  onSelectRoute: (routeId: string) => void;
  onSelectArea: (areaId: string) => void;
}

/**
 * Bottom of the rail: the ways to gather the whole plan.
 *
 * It sits outside the item detail on purpose — the routes answer for every
 * bookmarked item as well as the open one, so they stay on screen (and stay
 * computed) with nothing selected at all.
 */
export function RoutePlanPanel({
  routes,
  plannedCount,
  truncated,
  unobtainableNames,
  inventoryBlocked,
  activeRouteId,
  planKey,
  startingClothes,
  startingOptions,
  onStartingClothesChange,
  onHoverRoute,
  onSelectRoute,
  onSelectArea,
}: RoutePlanPanelProps) {
  const startingItem = startingClothes ? (startingOptions.find((item) => item.id === startingClothes) ?? null) : null;

  return (
    <section className="shrink-0 px-4 pb-6 sm:px-6">
      <PaneDivider label="Fastest routes" />

      {/* What the survivor is already wearing on the first move changes which
          areas are worth visiting, so it belongs with the routes, not with the
          item detail. */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
          Starting armor
        </span>
        {startingItem && (
          <span className="size-5 shrink-0">
            <ItemSprite item={startingItem} size="tile" bare />
          </span>
        )}
        <select
          value={startingClothes ?? ""}
          onChange={(event) => onStartingClothesChange(event.target.value || null)}
          aria-label="Starting armor"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-[11px] font-semibold text-stone-200 outline-none transition hover:border-white/20 focus:border-amber-300/50"
        >
          {/* A survivor always starts with one; "-" is the game's own unset marker. */}
          <option value="">-</option>
          {startingOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>

      <RoutePlanList
        key={planKey}
        routes={routes}
        plannedCount={plannedCount}
        truncated={truncated}
        unobtainableNames={unobtainableNames}
        inventoryBlocked={inventoryBlocked}
        activeRouteId={activeRouteId}
        startingItem={startingItem}
        onHoverRoute={onHoverRoute}
        onSelectRoute={onSelectRoute}
        onSelectArea={onSelectArea}
      />
    </section>
  );
}
