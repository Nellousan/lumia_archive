"use client";

import { BubbleMaterialCard } from "./BubbleMaterialCard";
import { BUBBLE_WIDTH, toLayerPosition, type BubblePlacement } from "@/lib/map-layout";
import type { AreaBubble, MapFocus } from "@/lib/wiki/route";

export interface AreaBubbleCardProps {
  bubble: AreaBubble;
  placement: BubblePlacement;
  /** Cap the overlay is drawn at; see {@link toLayerPosition}. */
  bubbleScale: number;
  /** True when this bubble belongs to the area whose detail panel is open. */
  active: boolean;
  focus: MapFocus | null;
  /** True while a route is highlighted on the map. */
  routeActive: boolean;
  /** True when this bubble's area is one of the active route's stops. */
  inRoute: boolean;
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  onHoverMaterial: (itemId: string | null) => void;
  onSelectItem: (itemId: string) => void;
}

/**
 * Floating card anchored over an area that holds materials of the active
 * recipe. Its header names the area and opens the area panel; its body lists one
 * card per recipe material found there, with the quantity.
 *
 * Every size below is in island pixels: the card is drawn inside the map's own
 * coordinate layer, so these numbers are also what the placement solver spaces
 * bubbles by.
 */
export function AreaBubbleCard({
  bubble,
  placement,
  bubbleScale,
  active,
  focus,
  routeActive,
  inRoute,
  onHoverArea,
  onSelectArea,
  onHoverMaterial,
  onSelectItem,
}: AreaBubbleCardProps) {
  const { left, top } = toLayerPosition(placement, bubbleScale);
  const containsFocused = bubble.cards.some((card) => card.material.item.id === focus?.itemId);
  // A bubble also counts as relevant when it holds anything needed to craft the
  // focused material, not just the material itself.
  const containsSupport =
    focus !== null && bubble.cards.some((card) => focus.subtreeIds.includes(card.material.item.id));
  // A highlighted route overrides the material focus: everything off the route
  // fades back, so the path reads at a glance.
  const dimmed = routeActive ? !inRoute : focus !== null && !containsSupport;

  return (
    <div
      className={`pointer-events-auto absolute z-20 transition-opacity ${
        dimmed ? "opacity-35" : "opacity-100"
      }`}
      style={{
        left,
        top,
        width: BUBBLE_WIDTH,
        // Centred on the area; the layer it sits in already carries the scaling.
        transform: "translate(-50%, -50%)",
      }}
      onMouseEnter={() => onHoverArea(bubble.area.id)}
      onMouseLeave={() => onHoverArea(null)}
    >
      <div
        className={`rounded-[20px] border p-[6px] shadow-[0_18px_36px_rgba(0,0,0,0.55)] backdrop-blur-md transition ${
          routeActive && inRoute
            ? "border-amber-300/75 bg-ink-950/92"
            : active
              ? "border-amber-300/60 bg-ink-950/90"
              : containsFocused
                ? "border-amber-300/45 bg-ink-950/85"
                : containsSupport
                  ? "border-amber-300/25 bg-ink-950/82"
                  : "border-emerald-300/25 bg-ink-950/80"
        }`}
      >
        <button
          type="button"
          onClick={() => onSelectArea(bubble.area.id)}
          className="flex w-full items-center justify-between gap-[12px] rounded-[13px] px-[10px] py-[3px] text-left transition hover:bg-white/[0.06]"
        >
          <span className="min-w-0 truncate font-display text-[21px] font-bold uppercase tracking-[0.1em] text-stone-100">
            {bubble.area.name}
          </span>
          <span className="shrink-0 font-mono text-[18px] text-emerald-300/90">
            {bubble.cards.length}
          </span>
        </button>

        <div className="mt-[6px] flex flex-wrap justify-center gap-[8px]">
          {bubble.cards.map((card) => (
            <BubbleMaterialCard
              key={card.material.item.id}
              material={card.material}
              quantityInArea={card.quantityInArea}
              source={card.source}
              animals={card.animals}
              focused={focus?.itemId === card.material.item.id}
              related={
                focus !== null &&
                focus.itemId !== card.material.item.id &&
                focus.subtreeIds.includes(card.material.item.id)
              }
              onHover={onHoverMaterial}
              onSelect={onSelectItem}
            />
          ))}
        </div>
      </div>

      {/* Pointer tying the bubble to its anchor on the island. */}
      <span
        aria-hidden="true"
        className="absolute left-1/2 top-full size-[10px] -translate-x-1/2 rounded-full bg-emerald-300/70"
      />
    </div>
  );
}
