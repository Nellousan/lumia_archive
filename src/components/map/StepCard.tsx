"use client";

import { useState } from "react";
import { ItemFrame } from "@/components/ui/ItemFrame";
import { BUBBLE_CARD_WIDTH } from "@/lib/map-layout";
import type { WikiItem } from "@/lib/wiki/types";

export interface StepCardProps {
  item: WikiItem;
  /** How much the route needs here: the number a route card carries. */
  quantity: number;
  /**
   * How much the area holds, from the plan's material view — or `null` when that
   * view has no card for this item, which happens for anything the plan assumes is
   * carried rather than found, and for a material the trace has already taken in
   * full.
   */
  areaQuantity: number | null;
  /** True for something built here, false for something picked up. */
  built: boolean;
  /** True while this card's own item is the focused one. */
  focused: boolean;
  onHoverItem: (itemId: string | null) => void;
}

/**
 * One thing a walk does at a stop: a pickup, or a build.
 *
 * Shared by the two bubbles that draw a walk — the step bubble of a highlighted
 * route and the traced area bubble of manual mode — because both are answering the
 * same question and must answer it the same way.
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
export function StepCard({
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
