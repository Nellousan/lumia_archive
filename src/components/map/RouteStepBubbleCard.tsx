"use client";

import { BubbleMaterialCard } from "./BubbleMaterialCard";
import { StepCard } from "./StepCard";
import { toLayerPosition, type BubblePlacement } from "@/lib/map-layout";
import { stepCrafts, stepGathers, type RouteStep } from "@/lib/wiki/routes";
import type { BubbleCard, MapFocus } from "@/lib/wiki/route";

export interface RouteStepBubbleCardProps {
  step: RouteStep;
  placement: BubblePlacement;
  /** Cap the overlay is drawn at; see {@link toLayerPosition}. */
  bubbleScale: number;
  /** True when this step's area panel is open. */
  active: boolean;
  /** The material the pointer is on, if any; draws this card's own focus ring. */
  focus: MapFocus | null;
  /**
   * The focused material's card in this step's area, when the route does not pick
   * it up here. The item is often found on more than one stop and gathered at only
   * one of them, and the hover is precisely the question "where else is this?" — so
   * a stop that holds it says so while the pointer stays on it.
   */
  foundCard: BubbleCard | null;
  /**
   * What this stop's area holds, straight from the plan's material view.
   *
   * A pickup card's number is the amount the *route* needs, which is not the amount
   * lying in the area — so the bubble reads the area's own card for it too, and a
   * card being pointed at can report the area's number instead. See {@link StepCard}.
   */
  areaCards: BubbleCard[];
  /**
   * True while a material is focused that this step has nothing to do with. The
   * step fades back rather than leaving, so the route stays on screen while the
   * island answers about one of its stops.
   */
  dimmed: boolean;
  /**
   * True when the step is an answer rather than a control, so the pointer falls
   * straight through it — the manual trace's stops, where the polygons are the only
   * thing a click may reach, and the entry that fades a bubble has to reach it too.
   * Its header is then drawn as text rather than as a button only the keyboard
   * could reach.
   */
  passThrough?: boolean;
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  /** Focuses the item while the pointer is on its card; see below. */
  onHoverItem: (itemId: string | null) => void;
}

/**
 * The bubble for one step of a highlighted route.
 *
 * It replaces the material bubble while a route is highlighted: the header names
 * the area and its place in the walk, the amber cards marked with a sparkle are what
 * gets built once those materials are in the pack, and the plain cards are what
 * gets picked up.
 *
 * Hovering a card focuses its item, which is the same answer the material cards
 * give with no route on screen: every other area holding it lights up and gets its
 * material bubble back. A stop that holds the focused item but does not gather it
 * shows the item as well — see {@link RouteStepBubbleCardProps.foundCard} — so the
 * answer covers the route's own stops too, not only the areas beside them: the item
 * a reader is following is on several of them, and the route only stops for one.
 *
 * The route stays readable while it is answered, because the numbered stops are
 * drawn over the areas rather than in them.
 */
export function RouteStepBubbleCard({
  step,
  placement,
  bubbleScale,
  active,
  focus,
  foundCard,
  areaCards,
  dimmed,
  passThrough = false,
  onHoverArea,
  onSelectArea,
  onHoverItem,
}: RouteStepBubbleCardProps) {
  const { left, top } = toLayerPosition(placement, bubbleScale);
  const gathers = stepGathers(step);
  const crafts = stepCrafts(step);
  const total = gathers.length + crafts.length + (foundCard ? 1 : 0);

  /** What the area holds of this item, or null when its view has no card for it. */
  const areaQuantityOf = (itemId: string) =>
    areaCards.find((card) => card.material.item.id === itemId)?.quantityInArea ?? null;

  /**
   * Where in the walk this stop is, what happens there, and how many cards say so —
   * the same header whether it is a button or the text a traced stop draws.
   */
  const header = (
    <>
      <span className="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-amber-300/90 font-mono text-[16px] font-bold text-ink-950">
        {step.number}
      </span>
      <span className="min-w-0 flex-1 truncate font-display text-[21px] font-bold uppercase tracking-[0.1em] text-stone-100">
        {step.area.name}
      </span>
      <span className="shrink-0 font-mono text-[18px] text-emerald-300/90">{total}</span>
    </>
  );

  return (
    <div
      className={`${passThrough ? "pointer-events-none" : "pointer-events-auto"} absolute z-20 transition-opacity ${
        dimmed ? "opacity-35" : "opacity-100"
      }`}
      style={{
        left,
        top,
        // Centred on the area; the layer it sits in already carries the scaling.
        transform: "translate(-50%, -50%)",
      }}
      onMouseEnter={() => onHoverArea(step.area.id)}
      onMouseLeave={() => onHoverArea(null)}
    >
      <div
        className={`rounded-[20px] border p-[6px] shadow-[0_18px_36px_rgba(0,0,0,0.55)] backdrop-blur-md transition ${
          active ? "border-amber-300/70 bg-ink-950/92" : "border-amber-300/45 bg-ink-950/88"
        }`}
      >
        {passThrough ? (
          <div className="flex w-full items-center gap-[10px] rounded-[13px] px-[10px] py-[3px] text-left">
            {header}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelectArea(step.area.id)}
            className="flex w-full items-center gap-[10px] rounded-[13px] px-[10px] py-[3px] text-left transition hover:bg-white/[0.06]"
          >
            {header}
          </button>
        )}

        <div className="mt-[6px] flex flex-wrap justify-center gap-[8px]">
          {crafts.map((built) => (
            <StepCard
              key={`build-${built.item.id}`}
              item={built.item}
              quantity={built.quantity}
              areaQuantity={areaQuantityOf(built.item.id)}
              built
              focused={focus?.itemId === built.item.id}
              onHoverItem={onHoverItem}
            />
          ))}
          {gathers.map((picked) => (
            <StepCard
              key={`pick-${picked.item.id}`}
              item={picked.item}
              quantity={picked.quantity}
              areaQuantity={areaQuantityOf(picked.item.id)}
              built={false}
              focused={focus?.itemId === picked.item.id}
              onHoverItem={onHoverItem}
            />
          ))}
          {foundCard && (
            // The same card the area's own bubble would draw, because it says the
            // same thing: this area holds that many. Not a step card — nothing
            // happens with it here — so hovering it only keeps the answer alive.
            <BubbleMaterialCard
              key={`found-${foundCard.material.item.id}`}
              material={foundCard.material}
              quantityInArea={foundCard.quantityInArea}
              source={foundCard.source}
              animals={foundCard.animals}
              focused={focus?.itemId === foundCard.material.item.id}
              related={
                focus !== null &&
                focus.itemId !== foundCard.material.item.id &&
                focus.subtreeIds.includes(foundCard.material.item.id)
              }
              onHover={onHoverItem}
            />
          )}
        </div>

        {crafts.length === 0 && (
          <p className="mt-[6px] px-[6px] text-center text-[15px] uppercase tracking-wider text-stone-500">
            nothing built here
          </p>
        )}
      </div>

      <span
        aria-hidden="true"
        className="absolute left-1/2 top-full size-[10px] -translate-x-1/2 rounded-full bg-amber-300/70"
      />
    </div>
  );
}
