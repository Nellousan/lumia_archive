"use client";

import { Fragment, useState } from "react";
import { BAG_SLOTS } from "@/lib/wiki/inventory";
import type { RoutePlan, RouteStep } from "@/lib/wiki/routes";
import type { WikiItem } from "@/lib/wiki/types";

export interface RoutePlanListProps {
  routes: RoutePlan[];
  /** How many items the routes must cover — the selection plus the bookmarks. */
  plannedCount: number;
  /** True when only the fastest {@link RoutePlan} slice is shown. */
  truncated: boolean;
  /** Names of planned items nothing can obtain; only used by the empty state. */
  unobtainableNames: string[];
  /** True when covers exist but the pack cannot hold the job. */
  inventoryBlocked: boolean;
  /** Components the plan is handed instead of finding: no area holds them. */
  assumed: WikiItem[];
  /** True when the plan needs no walking at all. */
  nothingToGather: boolean;
  /** Route currently highlighted on the map — hovered, or pinned by a click. */
  activeRouteId: string | null;
  /** Clothes worn from the first move, when one was picked. */
  startingItem: WikiItem | null;
  onHoverRoute: (routeId: string | null) => void;
  /** Pins a route, or unpins it when clicked again. */
  onSelectRoute: (routeId: string) => void;
  onSelectArea: (areaId: string) => void;
}

/** Routes shown before the "show all" fold; steps make each row tall. */
const COLLAPSED_COUNT = 4;

function itemNames(items: { item: { name: string }; quantity: number }[]): string {
  return items
    .map((entry) => (entry.quantity > 1 ? `${entry.item.name} ×${entry.quantity}` : entry.item.name))
    .join(", ");
}

function movesLabel(route: RoutePlan): string {
  const areas = `${route.steps.length} area${route.steps.length === 1 ? "" : "s"}`;
  if (route.moves === 0) return `${areas} · no travel`;
  return `${route.moves} move${route.moves === 1 ? "" : "s"} · ${areas}`;
}

/** Highest number of bag slots the route ever has filled. */
function peakBagUse(route: RoutePlan): number {
  return route.steps.reduce((peak, step) => Math.max(peak, step.bagUsed), 0);
}

/**
 * One step of a route: where it happens, what is picked up, what gets built.
 *
 * The build column is the point of the list — intermediates appear at the first
 * stop whose materials complete them, which is also what keeps the pack inside
 * its six bag slots.
 */
function StepRow({
  step,
  active,
  onSelectArea,
}: {
  step: RouteStep;
  active: boolean;
  onSelectArea: (areaId: string) => void;
}) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
      <span className="w-3 shrink-0 font-mono text-[10px] text-stone-600">{step.number}</span>

      <button
        type="button"
        title={
          step.gather.length === 0
            ? step.area.name
            : `${step.area.name} — pick up ${step.gather
                .map((entry) => `${entry.item.name} ×${entry.quantity}`)
                .join(", ")}`
        }
        onClick={(event) => {
          event.stopPropagation();
          onSelectArea(step.area.id);
        }}
        className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition ${
          active
            ? "border-amber-300/40 text-amber-100 hover:bg-amber-300/15"
            : "border-white/10 text-stone-300 hover:border-emerald-400/40 hover:text-white"
        }`}
      >
        {step.area.name}
      </button>

      {step.gather.length > 0 && (
        <span className="text-[10px] text-stone-500">pick up {itemNames(step.gather)}</span>
      )}

      {step.craft.length > 0 ? (
        <span className="text-[10px] font-semibold text-amber-200/90">
          {step.gather.length > 0 ? "· " : ""}build {itemNames(step.craft)}
        </span>
      ) : (
        step.gather.length === 0 && <span className="text-[10px] text-stone-600">nothing needed</span>
      )}
    </li>
  );
}

/**
 * Every fastest way to gather the active plan, best first.
 *
 * A route is an ordered set of areas; because any hop between two areas costs the
 * same, rank order is purely the number of hops, and only routes with no spare
 * area are listed. Each step shows what is picked up there and what can be built
 * once those materials are in the pack. Hovering a row highlights its path on the
 * island, clicking pins it.
 */
export function RoutePlanList({
  routes,
  plannedCount,
  truncated,
  unobtainableNames,
  inventoryBlocked,
  assumed,
  nothingToGather,
  activeRouteId,
  startingItem,
  onHoverRoute,
  onSelectRoute,
  onSelectArea,
}: RoutePlanListProps) {
  const [expanded, setExpanded] = useState(false);

  if (routes.length === 0 && nothingToGather) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
        Nothing to gather: {assumed.map((item) => item.name).join(", ")}{" "}
        {assumed.length > 1 ? "are" : "is"} assumed to be in the pack already — no area on Lumia
        Island holds {assumed.length > 1 ? "them" : "it"} and no recipe makes{" "}
        {assumed.length > 1 ? "them" : "it"}.
      </p>
    );
  }

  if (routes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
        {unobtainableNames.length > 0 ? (
          <>
            <span className="text-stone-400">{unobtainableNames.join(", ")}</span> cannot be obtained
            on Lumia Island — nothing holds {unobtainableNames.length > 1 ? "them" : "it"} and no
            recipe leads there. Remove {unobtainableNames.length > 1 ? "them" : "it"} from the plan to
            get a route.
          </>
        ) : inventoryBlocked ? (
          <>
            No route fits the pack. Every way of covering this plan needs more than the{" "}
            {BAG_SLOTS} bag slots at once, in any order — drop an item from the plan, or aim for
            something less greedy.
          </>
        ) : (
          <>No route gathers everything in the plan.</>
        )}
      </p>
    );
  }

  const visible = expanded ? routes : routes.slice(0, COLLAPSED_COUNT);
  const fastest = routes[0];
  const target =
    plannedCount > 1 ? `all ${plannedCount} items in the plan` : "everything this item needs";

  return (
    <div>
      <p className="mb-2.5 text-[11px] leading-relaxed text-stone-500">
        Fewest areas to gather {target}, building each part as soon as its materials are in the pack —
        every move between two areas costs the same, so the fastest route is the shortest list.
        {startingItem && (
          <>
            {" "}
            <span className="text-stone-400">{startingItem.name}</span> is worn from the start, so no
            route has to find it.
          </>
        )}
        {assumed.length > 0 && (
          <>
            {" "}
            <span className="text-stone-400">{assumed.map((item) => item.name).join(", ")}</span>{" "}
            {assumed.length > 1 ? "are" : "is"} assumed to be carried — nothing on the island holds{" "}
            {assumed.length > 1 ? "them" : "it"}.
          </>
        )}{" "}
        <span className="text-stone-400">
          {truncated
            ? `fastest ${routes.length} routes`
            : `${routes.length} route${routes.length === 1 ? "" : "s"}`}
          {routes.length > 1 && ` · from ${fastest.moves} move${fastest.moves === 1 ? "" : "s"}`}
        </span>
      </p>

      <ul className="space-y-1.5">
        {visible.map((route, index) => {
          const active = route.id === activeRouteId;
          const peak = peakBagUse(route);
          return (
            <li key={route.id}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={`Route ${index + 1}: ${movesLabel(route)} — ${route.steps
                  .map(
                    (step) =>
                      `${step.area.name}${step.craft.length > 0 ? `, build ${itemNames(step.craft)}` : ""}`,
                  )
                  .join(", then ")}`}
                onMouseEnter={() => onHoverRoute(route.id)}
                onMouseLeave={() => onHoverRoute(null)}
                onFocus={() => onHoverRoute(route.id)}
                onBlur={() => onHoverRoute(null)}
                onClick={() => onSelectRoute(route.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectRoute(route.id);
                  }
                }}
                className={`cursor-pointer rounded-lg border px-2.5 py-2 transition outline-none ${
                  active
                    ? "border-amber-300/60 bg-amber-300/[0.07]"
                    : "border-white/[0.07] bg-white/[0.025] hover:border-amber-300/30 hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-md font-mono text-[10px] font-bold ${
                      active ? "bg-amber-300/90 text-ink-950" : "bg-white/[0.06] text-stone-400"
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span
                    className={`text-[11px] font-semibold ${active ? "text-amber-200" : "text-stone-400"}`}
                  >
                    {movesLabel(route)}
                  </span>
                  <span
                    className="ml-auto shrink-0 font-mono text-[10px] text-stone-600"
                    title={`Builds ${route.craftCount} distinct item${route.craftCount === 1 ? "" : "s"} · pack peaks at ${peak} of ${BAG_SLOTS} bag slots`}
                  >
                    {route.craftCount} built · pack {peak}/{BAG_SLOTS}
                  </span>
                </div>

                <ol className="mt-1.5 space-y-1 border-l border-white/[0.07] pl-1.5">
                  {route.steps.map((step) => (
                    <Fragment key={step.area.id}>
                      <StepRow step={step} active={active} onSelectArea={onSelectArea} />
                    </Fragment>
                  ))}
                </ol>
              </div>
            </li>
          );
        })}
      </ul>

      {routes.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="mt-2 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-stone-400 transition hover:border-white/20 hover:text-stone-100"
        >
          {expanded
            ? "Show fewer routes"
            : truncated
              ? `Show the fastest ${routes.length}`
              : `Show all ${routes.length} routes`}
        </button>
      )}
    </div>
  );
}
