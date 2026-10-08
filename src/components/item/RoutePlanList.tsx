"use client";

import { Fragment, useState } from "react";
import type { RoutePlan } from "@/lib/wiki/routes";

export interface RoutePlanListProps {
  routes: RoutePlan[];
  /** Route currently highlighted on the map — hovered, or pinned by a click. */
  activeRouteId: string | null;
  onHoverRoute: (routeId: string | null) => void;
  /** Pins a route, or unpins it when clicked again. */
  onSelectRoute: (routeId: string) => void;
  onSelectArea: (areaId: string) => void;
}

/** Routes shown before the "show all" fold; the tail is usually near-identical. */
const COLLAPSED_COUNT = 6;

function movesLabel(route: RoutePlan): string {
  const areas = `${route.stops.length} area${route.stops.length === 1 ? "" : "s"}`;
  if (route.moves === 0) return `${areas} · no travel`;
  return `${route.moves} move${route.moves === 1 ? "" : "s"} · ${areas}`;
}

/**
 * Every fastest way to gather the active item, best first.
 *
 * A route is a set of areas to visit; because any hop between two areas costs
 * the same, rank order is purely the number of hops (`stops - 1`), and only
 * routes with no spare area are listed. Hovering a row highlights its path on
 * the island, clicking pins it.
 */
export function RoutePlanList({
  routes,
  activeRouteId,
  onHoverRoute,
  onSelectRoute,
  onSelectArea,
}: RoutePlanListProps) {
  const [expanded, setExpanded] = useState(false);

  if (routes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
        No route can gather this item — nothing on Lumia Island holds it, so it only exists as the
        result of a craft.
      </p>
    );
  }

  const visible = expanded ? routes : routes.slice(0, COLLAPSED_COUNT);
  const fastest = routes[0];

  return (
    <div>
      <p className="mb-2.5 text-[11px] leading-relaxed text-stone-500">
        Fewest areas to gather everything — every move between two areas costs the same, so the
        fastest route is the shortest list.{" "}
        <span className="text-stone-400">
          {routes.length} route{routes.length === 1 ? "" : "s"}
          {routes.length > 1 && ` · from ${fastest.moves} move${fastest.moves === 1 ? "" : "s"}`}
        </span>
      </p>

      <ul className="space-y-1.5">
        {visible.map((route, index) => {
          const active = route.id === activeRouteId;
          return (
            <li key={route.id}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={active}
                aria-label={`Route ${index + 1}: ${movesLabel(route)} — ${route.stops
                  .map((stop) => stop.area.name)
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
                  <span className="ml-auto shrink-0 font-mono text-[10px] text-stone-600">
                    {route.materialCount} item{route.materialCount === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-x-1 gap-y-1 pl-7">
                  {route.stops.map((stop, stopIndex) => (
                    <Fragment key={stop.area.id}>
                      {stopIndex > 0 && (
                        <span aria-hidden="true" className="text-[10px] text-stone-600">
                          →
                        </span>
                      )}
                      <button
                        type="button"
                        title={
                          stop.collects.length === 0
                            ? stop.area.name
                            : `${stop.area.name} — ${stop.collects
                                .map((collect) => `${collect.item.name} ×${collect.quantity}`)
                                .join(", ")}`
                        }
                        onClick={(event) => {
                          event.stopPropagation();
                          onSelectArea(stop.area.id);
                        }}
                        className={`rounded-md border px-1.5 py-0.5 text-[11px] font-semibold transition ${
                          active
                            ? "border-amber-300/40 text-amber-100 hover:bg-amber-300/15"
                            : "border-white/10 text-stone-300 hover:border-emerald-400/40 hover:text-white"
                        }`}
                      >
                        {stop.area.name}
                      </button>
                    </Fragment>
                  ))}
                </div>
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
          {expanded ? "Show fewer routes" : `Show all ${routes.length} routes`}
        </button>
      )}
    </div>
  );
}
