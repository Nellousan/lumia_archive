"use client";

import { ItemSprite } from "@/components/ui/ItemSprite";
import { BUBBLE_CARD_WIDTH, toPercentPosition, type BubblePlacement } from "@/lib/map-layout";
import type { RouteStep } from "@/lib/wiki/routes";
import type { MapImage } from "@/lib/wiki/types";

export interface RouteStepBubbleCardProps {
  step: RouteStep;
  placement: BubblePlacement;
  map: MapImage;
  /** True when this step's area panel is open. */
  active: boolean;
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  onSelectItem: (itemId: string) => void;
}

interface StepCardProps {
  itemId: string;
  name: string;
  item: RouteStep["craft"][number]["item"];
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
      className={`flex shrink-0 flex-col items-center gap-px rounded-lg border px-0.5 pb-0.5 pt-1 transition ${
        built
          ? "border-amber-300/50 bg-amber-300/10 hover:border-amber-200/70 hover:bg-amber-300/20"
          : "border-white/[0.08] bg-black/30 hover:border-emerald-300/40 hover:bg-black/45"
      }`}
    >
      <ItemSprite item={item} size="tile" bare />
      {built ? (
        <span className="font-mono text-[9px] font-bold uppercase leading-none text-amber-200">
          build
        </span>
      ) : (
        <span className="font-mono text-[12px] font-bold leading-none text-emerald-300">
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
 * the area and its place in the walk, the amber cards are what gets built once
 * those materials are in the pack, and the plain cards are what gets picked up.
 */
export function RouteStepBubbleCard({
  step,
  placement,
  map,
  active,
  onHoverArea,
  onSelectArea,
  onSelectItem,
}: RouteStepBubbleCardProps) {
  const { left, top } = toPercentPosition(placement, map.width, map.height);
  const total = step.gather.length + step.craft.length;

  return (
    <div
      className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
      style={{ left, top }}
      onMouseEnter={() => onHoverArea(step.area.id)}
      onMouseLeave={() => onHoverArea(null)}
    >
      <div
        className={`rounded-xl border p-1 shadow-[0_18px_36px_rgba(0,0,0,0.55)] backdrop-blur-md transition ${
          active ? "border-amber-300/70 bg-ink-950/92" : "border-amber-300/45 bg-ink-950/88"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectArea(step.area.id)}
          className="flex w-full items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left transition hover:bg-white/[0.06]"
        >
          <span className="grid size-4 shrink-0 place-items-center rounded bg-amber-300/90 font-mono text-[10px] font-bold text-ink-950">
            {step.number}
          </span>
          <span className="min-w-0 flex-1 truncate font-display text-[13px] font-bold uppercase tracking-[0.1em] text-stone-100">
            {step.area.name}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-emerald-300/90">{total}</span>
        </button>

        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {step.craft.map((built) => (
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
          {step.gather.map((picked) => (
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

        {step.craft.length === 0 && (
          <p className="mt-1 px-1 text-center text-[9px] uppercase tracking-wider text-stone-500">
            nothing built here
          </p>
        )}
      </div>

      <span
        aria-hidden="true"
        className="absolute left-1/2 top-full size-1.5 -translate-x-1/2 rounded-full bg-amber-300/70"
      />
    </div>
  );
}
