"use client";

import { ItemSprite } from "@/components/ui/ItemSprite";
import { BUBBLE_CARD_WIDTH, toLayerPosition, type BubblePlacement } from "@/lib/map-layout";
import { stepCrafts, stepGathers, type RouteStep } from "@/lib/wiki/routes";
import type { WikiItem } from "@/lib/wiki/types";

export interface RouteStepBubbleCardProps {
  step: RouteStep;
  placement: BubblePlacement;
  /** Cap the overlay is drawn at; see {@link toLayerPosition}. */
  bubbleScale: number;
  /** True when this step's area panel is open. */
  active: boolean;
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  onSelectItem: (itemId: string) => void;
}

interface StepCardProps {
  itemId: string;
  name: string;
  item: WikiItem;
  quantity: number;
  /** True for something built here, false for something picked up. */
  built: boolean;
  onSelectItem: (itemId: string) => void;
}

function StepCard({ item, quantity, built, onSelectItem }: StepCardProps) {
  const label = built
    ? `Build ${item.name}${quantity > 1 ? ` ×${quantity}` : ""} here`
    : `Pick up ${item.name} ×${quantity} here`;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onSelectItem(item.id);
      }}
      style={{ width: BUBBLE_CARD_WIDTH }}
      className={`flex shrink-0 flex-col items-center gap-[2px] rounded-[13px] inset-ring-1 px-[4px] pb-[4px] pt-[7px] transition ${
        built
          ? "inset-ring-amber-300/50 bg-amber-300/10 hover:inset-ring-amber-200/70 hover:bg-amber-300/20"
          : "inset-ring-white/[0.08] bg-black/30 hover:inset-ring-emerald-300/40 hover:bg-black/45"
      }`}
    >
      <ItemSprite item={item} size="tile" bare />
      {built ? (
        // Same marker as the route list: a build, not a pickup.
        <span aria-hidden="true" className="text-[21px] leading-none text-amber-300">
          ✦
        </span>
      ) : (
        <span className="font-mono text-[20px] font-bold leading-none text-emerald-300">
          ×{quantity}
        </span>
      )}
    </button>
  );
}

/**
 * The bubble for one step of a highlighted route.
 *
 * It replaces the material bubble while a route is highlighted: the header names
 * the area and its place in the walk, the amber cards marked with a star are what
 * gets built once those materials are in the pack, and the plain cards are what
 * gets picked up.
 */
export function RouteStepBubbleCard({
  step,
  placement,
  bubbleScale,
  active,
  onHoverArea,
  onSelectArea,
  onSelectItem,
}: RouteStepBubbleCardProps) {
  const { left, top } = toLayerPosition(placement, bubbleScale);
  const gathers = stepGathers(step);
  const crafts = stepCrafts(step);
  const total = gathers.length + crafts.length;

  return (
    <div
      className="pointer-events-auto absolute z-20"
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
              itemId={built.item.id}
              name={built.item.name}
              item={built.item}
              quantity={built.quantity}
              built
              onSelectItem={onSelectItem}
            />
          ))}
          {gathers.map((picked) => (
            <StepCard
              key={`pick-${picked.item.id}`}
              itemId={picked.item.id}
              name={picked.item.name}
              item={picked.item}
              quantity={picked.quantity}
              built={false}
              onSelectItem={onSelectItem}
            />
          ))}
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
