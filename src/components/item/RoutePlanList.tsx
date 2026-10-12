"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ItemSprite } from "@/components/ui/ItemSprite";
import { Spinner } from "@/components/ui/Spinner";
import { scrollWithinScroller } from "@/lib/scroll";
import { BAG_SLOTS } from "@/lib/wiki/inventory";
import { RARITY_META, itemTypeLabel } from "@/lib/wiki/taxonomy";
import {
  stepCrafts,
  stepGathers,
  type CookableFood,
  type RouteModeChoice,
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
  /**
   * True while the routes for the plan on screen are still being solved.
   *
   * The solve is off the main thread, so this is not a frozen page: it is the route
   * section saying that its list is the one thing that has to wait, while the island
   * and everything above stay live.
   */
  solving: boolean;
  /** Identity of the solve in flight — what the delay below is measured against. */
  solvingKey: string;
  /** Route currently highlighted on the map — hovered, or pinned by a click. */
  activeRouteId: string | null;
  /** Clothes worn from the first move, when one was picked. */
  startingItem: WikiItem | null;
  /** What the list is ranked by, and how far greedy looks ahead. */
  mode: RouteModeChoice;
  lookAhead: number;
  onHoverRoute: (routeId: string | null) => void;
  /** Pins a route, or unpins it when clicked again. */
  onSelectRoute: (routeId: string) => void;
  onSelectArea: (areaId: string) => void;
  /** Opens a food from a route's "also cookable" row in the item detail. */
  onSelectItem: (itemId: string) => void;
  /**
   * Copies a link to one walk, named by its areas, reporting whether it took.
   *
   * The walk itself rather than its rank: the same plan and settings used to
   * identify a route by where it sat in the list, which made the link a promise
   * about how the list is computed.
   */
  onShareRoute: (routeAreaIds: string[]) => Promise<boolean>;
  /**
   * Hands one computed walk to the manual mode, as the trace to start editing from.
   *
   * It is the same areas the Share control would put in a link: a route the solver
   * found is a perfectly good first draft of the reader's own.
   */
  onOpenManual: (routeAreaIds: string[]) => void;
  /**
   * True while the plan is still the one an arriving link named a walk for: the
   * trace row is what that link is about, so it is brought into view — once, on
   * arrival. Adding a bookmark moves the plan on, which spends the reveal, so the
   * rail is never pulled down again by the reader's own edits.
   */
  revealWalk?: boolean;
  /**
   * The row is the reader's own trace rather than a computed route: one stop per
   * click, taken out by clicking it again, and nothing to compare it against.
   */
  manual?: boolean;
  /** True when that trace finishes the plan. */
  manualComplete?: boolean;
  /** Empties the trace. */
  onClearManual?: () => void;
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
 * one row, which is why they keep the sparkle.)
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
 * Rarities kept out of the cookable row: the bottom of the ladder is a Pill, and
 * the row exists to point at what is worth noticing.
 */
const HIDDEN_RARITIES = new Set<WikiItem["rarity"]>(["common"]);

/**
 * What else these areas could supply, as a row of artwork under the steps.
 *
 * Sprite-only, like the map's bubbles and the step cards, so a route that could
 * cook fourteen things still costs a single line — the name, the type, the value
 * and the ingredients are on hover, and clicking one opens it. Rarity tints the
 * frame, which is what keeps the ordering legible without labels: the row runs
 * from violet at the front to emerald at the back.
 *
 * Nothing here is part of the plan, and the row says so: it is what the ground
 * offers, not what the route came for.
 */
function CookableRow({
  foods,
  onSelectItem,
}: {
  foods: CookableFood[];
  onSelectItem: (itemId: string) => void;
}) {
  const visible = foods.filter((food) => !HIDDEN_RARITIES.has(food.item.rarity));
  if (visible.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1 border-t border-white/[0.05] pt-1.5 pl-[22px] lg:pl-[18px]">
      <span
        title="Food and stamina these areas could also supply — none of it is part of the plan"
        className="shrink-0 pr-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-stone-600"
      >
        Also cookable
      </span>

      {visible.map(({ item, ingredients }) => {
        const rarity = RARITY_META[item.rarity];
        const typeLabel = item.types.map(itemTypeLabel).join(" / ") || "Unclassified";
        const label = `${item.name} — ${typeLabel} (${rarity.label})${
          item.value !== null ? ` · value ${item.value}` : ""
        }${ingredients.length > 0 ? ` · ${ingredients.map((one) => one.name).join(" + ")}` : ""}`;

        return (
          <button
            key={item.id}
            type="button"
            title={label}
            aria-label={label}
            onClick={(event) => {
              event.stopPropagation();
              onSelectItem(item.id);
            }}
            className={`grid size-6 shrink-0 place-items-center rounded-md border p-0.5 transition hover:brightness-125 sm:size-7 ${rarity.badge}`}
          >
            <ItemSprite item={item} size="tile" bare />
          </button>
        );
      })}
    </div>
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

/** The chain-link glyph on the share control. */
function LinkGlyph({ className = "size-2.5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

/**
 * Copies a link to one walk — a computed route or the reader's own trace.
 *
 * The link carries the walk's areas, so it says the same thing in a build that
 * ranks routes differently; see `lib/wiki/share.ts`. `label` only names the walk
 * in the receipt the button reads out, which is what "your trace" is for.
 *
 * It lives inside the row, which is itself a click target, so it takes the click
 * for itself: asking for the link is not choosing the route.
 */
function ShareRouteButton({
  areaIds,
  label,
  onShare,
}: {
  areaIds: string[];
  label: string;
  onShare: (routeAreaIds: string[]) => Promise<boolean>;
}) {
  const [outcome, setOutcome] = useState<"idle" | "copied" | "failed">("idle");

  // A receipt rather than a state: it says what happened, then gets out of the way.
  useEffect(() => {
    if (outcome === "idle") return;
    const timer = window.setTimeout(() => setOutcome("idle"), 1800);
    return () => window.clearTimeout(timer);
  }, [outcome]);

  const short = outcome === "copied" ? "Copied" : outcome === "failed" ? "Failed" : "Share";
  const spoken =
    outcome === "copied"
      ? `Link to ${label} copied`
      : outcome === "failed"
        ? `Could not copy a link to ${label}`
        : `Copy a link to ${label}`;

  return (
    <button
      type="button"
      title={spoken}
      aria-label={spoken}
      onClick={async (event) => {
        event.stopPropagation();
        setOutcome((await onShare(areaIds)) ? "copied" : "failed");
      }}
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold transition ${
        outcome === "copied"
          ? "border-emerald-400/50 bg-emerald-400/10 text-emerald-200"
          : outcome === "failed"
            ? "border-rose-400/50 text-rose-200"
            : "border-white/10 text-stone-500 hover:border-amber-300/40 hover:bg-white/[0.04] hover:text-amber-200"
      }`}
    >
      <LinkGlyph />
      {short}
      <span role="status" className="sr-only">
        {outcome === "idle" ? "" : spoken}
      </span>
    </button>
  );
}

/**
 * Hands a route the solver found to the manual mode.
 *
 * The rail's two modes are not rivals: a reader who likes the shape of a computed
 * route but wants to change one stop should not have to click the whole walk back
 * in. This takes the row's areas and makes them the trace, which is the same thing
 * a link to that route opens.
 */
function OpenManualButton({
  areaIds,
  label,
  onOpen,
}: {
  areaIds: string[];
  /** How the row is named in the receipt the reader hears: "route 3". */
  label: string;
  onOpen: (routeAreaIds: string[]) => void;
}) {
  return (
    <button
      type="button"
      title={`Take ${label} into manual mode and edit it`}
      aria-label={`Open ${label} in manual mode`}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(areaIds);
      }}
      className="inline-flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 transition hover:border-amber-300/40 hover:bg-white/[0.04] hover:text-amber-200"
    >
      <TraceGlyph />
      Open in manual
    </button>
  );
}

/** A walk being drawn by hand: nodes on a line. */
function TraceGlyph({ className = "size-2.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M1.6 9.4 5 6.2l2 1.6 3.4-3.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="1.6" cy="9.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="4.2" r="1.1" fill="currentColor" stroke="none" />
    </svg>
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
  solving,
  solvingKey,
  activeRouteId,
  startingItem,
  mode,
  lookAhead,
  onHoverRoute,
  onSelectRoute,
  onSelectArea,
  onSelectItem,
  onShareRoute,
  onOpenManual,
  revealWalk = false,
  manual = false,
  manualComplete = false,
  onClearManual,
}: RoutePlanListProps) {
  const [expanded, setExpanded] = useState(false);
  /**
   * Whether the spinner has earned its place yet.
   *
   * A one-item plan is solved before this fires, so the common case never flashes a
   * "solving" row at all; a wide plan is still thinking a fifth of a second in, and
   * by then the row is the honest thing to show. The placeholder in the meantime is
   * the same box without its text, so nothing jumps when the spinner arrives.
   */
  const [spinnerFor, setSpinnerFor] = useState<string | null>(null);
  /** The row the arriving link names, so it can be brought into view. */
  const walkRowRef = useRef<HTMLLIElement | null>(null);
  /** Set once the arrival has been scrolled to, so nothing pulls the rail back. */
  const revealed = useRef(false);

  /*
   * A link that names a walk is opened *to*: the trace is the thing it carries, and
   * it sits below the crafting half of the rail, so without this the reader lands on
   * an item's recipe with their own route somewhere off screen below. The scroll is
   * confined to the pane the row lives in — `scrollIntoView` would move the document
   * and land the row under the header instead of against it — and it is spent on
   * arrival, so browsing on from there never pulls it back.
   */
  useEffect(() => {
    if (!solving) return;
    const timer = setTimeout(() => setSpinnerFor(solvingKey), 140);
    return () => clearTimeout(timer);
  }, [solving, solvingKey]);
  const showSolving = solving && spinnerFor === solvingKey;

  useEffect(() => {
    if (!manual || !revealWalk || revealed.current) return;
    const row = walkRowRef.current;
    if (!row) return;
    revealed.current = true;
    scrollWithinScroller(row, "center");
  }, [manual, revealWalk]);

  if (manual && routes.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
        <span className="text-stone-400">Trace your own route.</span> Click an area on the island to
        add it as a stop, and click it again to take it out. Stops connect in the order you click
        them, and what a stop picks up comes off the other bubbles.
      </p>
    );
  }

  /*
   * The list is the one part of this screen that is computed elsewhere, so it is the
   * one part that can be waited for. It says so itself rather than falling through to
   * an empty state: "no route gathers this plan" is a claim, and it must not be made
   * by a section whose answer has not arrived yet. A trace already on screen is never
   * replaced by this — the reader's own walk is theirs.
   */
  if (routes.length === 0 && solving) {
    return showSolving ? (
      <p className="flex items-center gap-2.5 rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
        <Spinner className="size-3.5 shrink-0 text-amber-300/80" />
        <span>
          <span className="text-stone-400">Solving the walk…</span> {plannedCount} item
          {plannedCount === 1 ? "" : "s"} to cover, every set of areas weighed against the others.
        </span>
      </p>
    ) : (
      <p aria-hidden="true" className="h-[52px] rounded-xl border border-dashed border-white/10" />
    );
  }

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
        {manual ? (
          <>
            Your own route, walked in the order you clicked it — each stop picking up what it holds
            and building what its materials allow, exactly like a computed one. Gathering {target}.
          </>
        ) : mode === "greedy" ? (
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
          {manual
            ? `${fastest.moves} move${fastest.moves === 1 ? "" : "s"} · ${
                manualComplete ? "everything in the plan gathered" : "plan not finished yet"
              }`
            : truncated
              ? `fastest ${routes.length} routes`
              : `${routes.length} route${routes.length === 1 ? "" : "s"}`}
          {!manual && routes.length > 1 && ` · from ${fastest.moves} move${fastest.moves === 1 ? "" : "s"}`}
        </span>
      </p>

      {manual && onClearManual && (
        <button
          type="button"
          onClick={onClearManual}
          className="mb-2.5 w-full rounded-lg border border-white/10 bg-white/[0.02] px-3 py-1.5 text-[11px] font-semibold text-stone-400 transition hover:border-white/20 hover:text-stone-100"
        >
          Clear the trace
        </button>
      )}

      <ul className="space-y-1.5">
        {visible.map((route, index) => {
          const active = route.id === activeRouteId;
          const peak = peakBagUse(route);
          const walk =
            `Route ${index + 1}: ${movesLabel(route)} — ` +
            route.steps
              .map((step) => {
                const crafts = stepCrafts(step);
                return `${step.area.name}${crafts.length > 0 ? `, build ${itemNames(crafts)}` : ""}`;
              })
              .join(", then ");
          return (
            <li key={route.id} ref={manual ? walkRowRef : undefined}>
              <div
                /*
                 * A trace is the reader's own walk, not a candidate to pin: it is
                 * already what the island is drawing, and there is no second copy
                 * of it to compare against. So it is a summary rather than a
                 * control — no hover, no click, nothing to press.
                 */
                role={manual ? undefined : "button"}
                tabIndex={manual ? undefined : 0}
                aria-pressed={manual ? undefined : active}
                aria-label={manual ? `Your route: ${movesLabel(route)}` : walk}
                onMouseEnter={manual ? undefined : () => onHoverRoute(route.id)}
                onMouseLeave={manual ? undefined : () => onHoverRoute(null)}
                onFocus={manual ? undefined : () => onHoverRoute(route.id)}
                onBlur={manual ? undefined : () => onHoverRoute(null)}
                onClick={manual ? undefined : () => onSelectRoute(route.id)}
                onKeyDown={
                  manual
                    ? undefined
                    : (event) => {
                        // The chips, the cookable food and the share control inside
                        // this row are focusable too, and their keys must not reach
                        // the row.
                        if (event.target !== event.currentTarget) return;
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelectRoute(route.id);
                        }
                      }
                }
                className={`rounded-lg border px-2.5 py-2 transition outline-none ${
                  active
                    ? "border-amber-300/60 bg-amber-300/[0.07]"
                    : "border-white/[0.07] bg-white/[0.025]"
                } ${manual ? "" : "cursor-pointer hover:border-amber-300/30 hover:bg-white/[0.05]"}`}
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

                <CookableRow foods={route.cookable} onSelectItem={onSelectItem} />

                {/* Bottom right of the row, under everything the walk does. A
                    trace is shareable like any other walk — the link carries the
                    stops, which is exactly what the trace is — and a computed walk
                    can be handed to the manual mode to be edited. */}
                <div className="mt-1.5 flex items-center justify-end gap-1.5">
                  {!manual && (
                    <OpenManualButton
                      areaIds={route.areaIds}
                      label={`route ${index + 1}`}
                      onOpen={onOpenManual}
                    />
                  )}
                  <ShareRouteButton
                    areaIds={route.areaIds}
                    label={manual ? "your trace" : `route ${index + 1}`}
                    onShare={onShareRoute}
                  />
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
