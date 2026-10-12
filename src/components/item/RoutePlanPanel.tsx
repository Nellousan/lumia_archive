"use client";

import { RoutePlanList } from "./RoutePlanList";
import { PaneDivider } from "@/components/ui/PaneDivider";
import { ItemSprite } from "@/components/ui/ItemSprite";
import { MAX_LOOK_AHEAD, type RouteModeChoice, type RoutePlan } from "@/lib/wiki/routes";
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
  /** Components carried from the start because no area holds them. */
  assumed: WikiItem[];
  /** True when the whole plan is already in the pack: nowhere to walk. */
  nothingToGather: boolean;
  activeRouteId: string | null;
  /** Resets the "show all" fold when the plan changes. */
  planKey: string;
  /** Armor the survivor starts wearing, or `null` when the pick is the default. */
  startingClothes: string | null;
  /** The clothes that can be picked as a starting piece. */
  startingOptions: WikiItem[];
  onStartingClothesChange: (itemId: string | null) => void;
  /** `fastest` walks the fewest areas; `greedy` gets value worn soonest; `manual` is the reader's own trace. */
  mode: RouteModeChoice;
  onModeChange: (mode: RouteModeChoice) => void;
  /** The stops the reader clicked, in `manual` mode. `null` before the first. */
  manualRoute: RoutePlan | null;
  /** True when that trace finishes the plan. */
  manualComplete: boolean;
  /** Empties the trace. */
  onClearManual: () => void;
  /** True on the visit that arrived on a link naming a walk; see the list. */
  revealWalk: boolean;
  /** True while the routes for the plan on screen are still being solved. */
  solving: boolean;
  /** How many areas greedy looks ahead, counting the first. */
  lookAhead: number;
  onLookAheadChange: (lookAhead: number) => void;
  onHoverRoute: (routeId: string | null) => void;
  onSelectRoute: (routeId: string) => void;
  onSelectArea: (areaId: string) => void;
  /** Opens a food from a route's "also cookable" row. */
  onSelectItem: (itemId: string) => void;
  /**
   * Copies a link to one walk, named by its areas.
   *
   * Areas rather than a rank: the link has to mean the same thing in a build that
   * ranks routes differently, which a position in the list cannot promise.
   */
  onShareRoute: (routeAreaIds: string[]) => Promise<boolean>;
  /** Hands one computed walk to the manual mode, as the trace to start editing from. */
  onOpenManual: (routeAreaIds: string[]) => void;
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
  assumed,
  nothingToGather,
  activeRouteId,
  planKey,
  startingClothes,
  startingOptions,
  onStartingClothesChange,
  mode,
  onModeChange,
  manualRoute,
  manualComplete,
  onClearManual,
  revealWalk,
  solving,
  lookAhead,
  onLookAheadChange,
  onHoverRoute,
  onSelectRoute,
  onSelectArea,
  onSelectItem,
  onShareRoute,
  onOpenManual,
}: RoutePlanPanelProps) {
  const startingItem = startingClothes ? (startingOptions.find((item) => item.id === startingClothes) ?? null) : null;
  const lookAheadOptions = Array.from({ length: MAX_LOOK_AHEAD }, (_, index) => index + 1);
  const manual = mode === "manual";

  return (
    <section className="shrink-0 px-4 pb-6 sm:px-6">
      <PaneDivider
        label={manual ? "Manual route" : mode === "greedy" ? "Greedy routes" : "Fastest routes"}
      />

      {/* What the survivor is already wearing on the first move changes which
          areas are worth visiting, so it belongs with the routes, not with the
          item detail. */}
      {/* Route settings: what to wear from the start, and what "best" means. */}
      <div className="mb-3 space-y-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
      <div className="flex items-center gap-2">
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

        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
            Route
          </span>
          <div className="flex flex-1 gap-1">
            {(
              [
                ["fastest", "Fastest"],
                ["greedy", "Greedy"],
                ["manual", "Manual"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => onModeChange(value)}
                aria-pressed={mode === value}
                title={
                  value === "fastest"
                    ? "Walk the fewest areas"
                    : value === "greedy"
                      ? "Be worth the most, soonest — a longer walk can win"
                      : "Trace your own route by clicking areas on the island"
                }
                className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition ${
                  mode === value
                    ? "border-amber-300/60 bg-amber-300/15 text-amber-100"
                    : "border-white/10 text-stone-400 hover:border-white/20 hover:text-stone-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "greedy" && (
            <label className="flex shrink-0 items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-600">
                Look ahead
              </span>
              <select
                value={lookAhead}
                onChange={(event) => onLookAheadChange(Number(event.target.value))}
                aria-label="Areas greedy looks ahead"
                className="rounded-md border border-white/10 bg-ink-900 px-2 py-1 text-[11px] font-semibold text-stone-200 outline-none transition hover:border-white/20 focus:border-amber-300/50"
              >
                {lookAheadOptions.map((areas) => (
                  <option key={areas} value={areas}>
                    {areas} area{areas === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <RoutePlanList
        // The plan is the identity: a new one starts on its own fold, rather than
        // inheriting the one the reader left open on the plan before it.
        key={planKey}
        routes={manual ? (manualRoute ? [manualRoute] : []) : routes}
        plannedCount={plannedCount}
        truncated={manual ? false : truncated}
        unobtainableNames={unobtainableNames}
        inventoryBlocked={inventoryBlocked}
        assumed={assumed}
        nothingToGather={nothingToGather}
        solving={manual ? false : solving}
        solvingKey={`${planKey}#${mode}#${lookAhead}#${startingClothes ?? ""}`}
        activeRouteId={manual ? (manualRoute?.id ?? null) : activeRouteId}
        startingItem={startingItem}
        mode={mode}
        lookAhead={lookAhead}
        onHoverRoute={onHoverRoute}
        onSelectRoute={onSelectRoute}
        onSelectArea={onSelectArea}
        onSelectItem={onSelectItem}
        onShareRoute={onShareRoute}
        onOpenManual={onOpenManual}
        revealWalk={revealWalk}
        manual={manual}
        manualComplete={manualComplete}
        onClearManual={onClearManual}
      />
    </section>
  );
}
