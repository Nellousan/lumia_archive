"use client";

import { Fragment, useState } from "react";
import { ItemSprite } from "@/components/ui/ItemSprite";
import { BAG_SLOTS } from "@/lib/wiki/inventory";
import {
  stepCrafts,
  stepGathers,
  type RouteMode,
  type RoutePlan,
  type RouteStep,
} from "@/lib/wiki/routes";
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
  /** What the list is ranked by, and how far greedy looks ahead. */
  mode: RouteMode;
  lookAhead: number;
  onHoverRoute: (routeId: string | null) => void;
  /** Pins a route, or unpins it when clicked again. */
  onSelectRoute: (routeId: string) => void;
  onSelectArea: (areaId: string) => void;
}

/** Routes shown before the "show all" fold; steps make each row tall. */
const COLLAPSED_COUNT = 4;

/**
 * Height shared by the area chip and every item card on its line.
 *
 * Fixed rather than left to the text: the chip's natural height is its
 * line-height plus padding plus border, which nothing else can match by
 * accident. One constant keeps the strip even, and square cards mean only the
 * height is ever written down.
 *
 * Taller on the stacked layout, where the rail is the whole screen: the artwork
 * on a step is how one pickup is told from another, and at 28px on a phone it is
 * a smudge.
 */
const STEP_CONTROL_HEIGHT = "h-10 lg:h-7";

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
 * The pack at one step: one dot per bag slot, filled for the slots in use.
 *
 * Worn gear does not take a slot, so this counts what the survivor is carrying
 * and nothing else — the same number the route header reports as its peak.
 */
function BagSlots({ used }: { used: number }) {
  const label = `${used} of ${BAG_SLOTS} bag slots used`;

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="ml-auto flex shrink-0 items-center gap-1 pl-2 lg:gap-0.5"
    >
      {Array.from({ length: BAG_SLOTS }, (_, slot) => (
        <span
          key={slot}
          className={`size-2 rounded-full lg:size-1.5 ${
            slot < used ? "bg-amber-300" : "border border-white/20"
          }`}
        />
      ))}
    </span>
  );
}

/**
 * One step of a route: where it happens, what is picked up, what gets built.
 *
 * The build column is the point of the list — intermediates appear at the first
 * stop whose materials complete them, which is also what keeps the pack inside
 * its six bag slots.
 */
/**
 * One thing a step does, as a small card of artwork.
 *
 * No marker for a build here: the builds have their own line under the area, so
 * the amber contour says it on its own. (The map's step bubbles mix both kinds on
 * one row, which is why they keep the star.)
 */
function StepItemCard({
  item,
  quantity,
  built,
}: {
  item: WikiItem;
  quantity: number;
  built: boolean;
}) {
  const label = built
    ? `Build ${item.name}${quantity > 1 ? ` ×${quantity}` : ""} here`
    : `Pick up ${item.name} ×${quantity} here`;

  return (
    <span
      title={label}
      aria-label={label}
      role="img"
      className={`grid ${STEP_CONTROL_HEIGHT} aspect-square shrink-0 place-items-center rounded-md border p-0.5 ${
        built ? "border-amber-300/50 bg-amber-300/[0.08]" : "border-white/15 bg-white/[0.03]"
      }`}
    >
      <ItemSprite item={item} size="tile" bare />
    </span>
  );
}

/**
 * One step of a route: where it happens, how full the pack is when leaving, and
 * what happens there.
 *
 * The area and the pack dots share the first line so the dots line up down the
 * list whatever is built; the items sit underneath, in the order they are picked
 * up or built — the order is the point of a step, not a detail of it.
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
  const gathers = stepGathers(step);
  const crafts = stepCrafts(step);
  const wornValue = step.equipped.reduce((total, item) => total + (item.value ?? 0), 0);

  return (
    <li className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="w-4 shrink-0 font-mono text-[13px] text-stone-600 lg:w-3 lg:text-[11px]">
          {step.number}
        </span>

        <button
          type="button"
          title={
            gathers.length === 0
              ? step.area.name
              : `${step.area.name} — pick up ${gathers
                  .map((entry) => `${entry.item.name} ×${entry.quantity}`)
                  .join(", ")}`
          }
          onClick={(event) => {
            event.stopPropagation();
            onSelectArea(step.area.id);
          }}
          className={`inline-flex ${STEP_CONTROL_HEIGHT} shrink-0 items-center rounded-md border px-2 text-[15px] font-semibold transition lg:text-[13px] ${
            active
              ? "border-amber-300/40 text-amber-100 hover:bg-amber-300/15"
              : "border-white/10 text-stone-300 hover:border-emerald-400/40 hover:text-white"
          }`}
        >
          {step.area.name}
        </button>

        {/* Pickups sit beside the area they come from; only builds drop a line. */}
        {gathers.map((entry) => (
          <StepItemCard
            key={entry.item.id}
            item={entry.item}
            quantity={entry.quantity}
            built={false}
          />
        ))}

        <span className="ml-auto flex items-center gap-2">
          {/* What the survivor is worth when leaving here — the curve greedy ranks. */}
          <span
            title={`value worn when leaving: ${wornValue}`}
            className={`font-mono text-[12px] lg:text-[10px] ${
              wornValue > 0 ? "text-amber-300/80" : "text-stone-600"
            }`}
          >
            {wornValue}
          </span>
          <BagSlots used={step.bagUsed} />
        </span>
      </div>

      {crafts.length > 0 && (
        // Indented to sit under the area chip rather than under the step number.
        <div className="flex flex-wrap items-center gap-1 pl-[22px] lg:pl-[18px]">
          {crafts.map((entry) => (
            <StepItemCard key={entry.item.id} item={entry.item} quantity={entry.quantity} built />
          ))}
        </div>
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
  mode,
  lookAhead,
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
        {mode === "greedy" ? (
          <>
            Best equipped soonest: at every step, the most value worn within the next {lookAhead} area
            {lookAhead === 1 ? "" : "s"}, compared step by step — the fewest areas then breaking ties.
            Gathering {target}, building each part as soon as its materials are in the pack.
          </>
        ) : (
          <>Fewest areas to gather {target}, building each part as soon as its materials are in the pack.</>
        )}
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
                  .map((step) => {
                    const crafts = stepCrafts(step);
                    return `${step.area.name}${crafts.length > 0 ? `, build ${itemNames(crafts)}` : ""}`;
                  })
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
