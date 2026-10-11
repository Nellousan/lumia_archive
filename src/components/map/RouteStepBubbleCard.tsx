"use client";

import { useState } from "react";
import { BubbleMaterialCard } from "./BubbleMaterialCard";
import { ItemFrame } from "@/components/ui/ItemFrame";
import { BUBBLE_CARD_WIDTH, toLayerPosition, type BubblePlacement } from "@/lib/map-layout";
import { stepCrafts, stepGathers, type RouteStep } from "@/lib/wiki/routes";
import type { BubbleCard, MapFocus } from "@/lib/wiki/route";
import type { WikiItem } from "@/lib/wiki/types";

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
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  /** Focuses the item while the pointer is on its card; see below. */
  onHoverItem: (itemId: string | null) => void;
}

interface StepCardProps {
  item: WikiItem;
  /** How much the route needs here: the number a route card carries. */
  quantity: number;
  /**
   * How much the area holds, from the plan's material view — or `null` when that
   * view has no card for this item, which happens for anything the plan assumes is
   * carried rather than found.
   */
  areaQuantity: number | null;
  /** True for something built here, false for something picked up. */
  built: boolean;
  /** True while this card's own item is the focused one. */
  focused: boolean;
  onHoverItem: (itemId: string | null) => void;
}

/**
 * One thing the route does at a stop: a pickup, or a build.
 *
 * The number under a pickup is the amount the *route* needs there, which is not the
 * amount the area holds — the two are different numbers that used to be the same
 * colour, so a reader comparing cards could not tell which question a `×1` was
 * answering. They are told apart by colour: amber is what the route needs, emerald
 * is what the area holds, and that holds across the app — the material cards on the
 * island are emerald for the same reason.
 *
 * Pointing at a card settles it: the number becomes the area's, in emerald, so that
 * everything on screen while a material is hovered is answering the same question.
 * Letting go puts the route's number and its amber back.
 *
 * The accessible name does not switch with it. It stays the action ("Pick up Iron
 * Ore ×2 here"), which is what the card reports.
 *
 * The card is drawn through the same {@link ItemFrame} as a material card, and for
 * the same reason it takes no `onSelect`: a bubble card is something to point at,
 * never something to activate. Clicking one used to open the item in the rail, which
 * made the same gesture mean two different things depending on whether a route was
 * highlighted — a card that answers "where else is this?" while the pointer is on it
 * should not also navigate when the hand moves a pixel first.
 */
function StepCard({
  item,
  quantity,
  areaQuantity,
  built,
  focused,
  onHoverItem,
}: StepCardProps) {
  const [pointing, setPointing] = useState(false);
  const label = built
    ? `Build ${item.name}${quantity > 1 ? ` ×${quantity}` : ""} here`
    : `Pick up ${item.name} ×${quantity} here`;
  // An item the plan assumes is carried has no card in the area's view, so there is
  // no area number to borrow and the route's stands.
  const showsArea = pointing && areaQuantity !== null;
  const amount = showsArea ? areaQuantity : quantity;

  return (
    <ItemFrame
      item={item}
      label={label}
      tone={
        focused
          ? "inset-ring-amber-300/70 bg-amber-300/20"
          : built
            ? "inset-ring-amber-300/50 bg-amber-300/10 hover:inset-ring-amber-200/70 hover:bg-amber-300/20"
            : "inset-ring-white/[0.08] bg-black/30 hover:inset-ring-emerald-300/40 hover:bg-black/45"
      }
      className="gap-[2px] px-[4px] pb-[4px] pt-[7px]"
      style={{ width: BUBBLE_CARD_WIDTH }}
      onHover={(itemId) => {
        // Entering is a non-null id and leaving is null, which is all the pointing
        // state needs — the frame reports both.
        setPointing(itemId !== null);
        onHoverItem(itemId);
      }}
      footnote={
        built ? (
          // Same marker as the route list: a build, not a pickup.
          <span aria-hidden="true" className="text-[21px] leading-none text-amber-300">
            ✦
          </span>
        ) : (
          <span
            className={`font-mono text-[20px] font-bold leading-none transition-colors ${
              showsArea ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            ×{amount}
          </span>
        )
      }
    />
  );
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

  return (
    <div
      className={`pointer-events-auto absolute z-20 transition-opacity ${
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
        <button
          type="button"
          onClick={() => onSelectArea(step.area.id)}
          className="flex w-full items-center gap-[10px] rounded-[13px] px-[10px] py-[3px] text-left transition hover:bg-white/[0.06]"
        >
          <span className="grid size-[26px] shrink-0 place-items-center rounded-[7px] bg-amber-300/90 font-mono text-[16px] font-bold text-ink-950">
            {step.number}
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[21px] font-bold uppercase tracking-[0.1em] text-stone-100">
            {step.area.name}
          </span>
          <span className="shrink-0 font-mono text-[18px] text-emerald-300/90">{total}</span>
        </button>

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
