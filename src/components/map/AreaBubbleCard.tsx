"use client";

import { BubbleMaterialCard } from "./BubbleMaterialCard";
import { BUBBLE_WIDTH, type BubblePlacement } from "@/lib/map-layout";
import { toPercentPosition } from "@/lib/map-layout";
import type { AreaBubble, MapFocus } from "@/lib/wiki/route";
import type { MapImage } from "@/lib/wiki/types";

export interface AreaBubbleCardProps {
  bubble: AreaBubble;
  placement: BubblePlacement;
  map: MapImage;
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
 */
export function AreaBubbleCard({
  bubble,
  placement,
  map,
  active,
  focus,
  routeActive,
  inRoute,
  onHoverArea,
  onSelectArea,
  onHoverMaterial,
  onSelectItem,
}: AreaBubbleCardProps) {
  const { left, top } = toPercentPosition(placement, map.width, map.height);
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
      className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-opacity ${
        dimmed ? "opacity-35" : "opacity-100"
      }`}
      style={{ left, top, width: BUBBLE_WIDTH }}
      onMouseEnter={() => onHoverArea(bubble.area.id)}
      onMouseLeave={() => onHoverArea(null)}
    >
      <div
        className={`rounded-xl border p-1 shadow-[0_18px_36px_rgba(0,0,0,0.55)] backdrop-blur-md transition ${
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
          className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-0.5 text-left transition hover:bg-white/[0.06]"
        >
          <span className="min-w-0 truncate font-display text-[13px] font-bold uppercase tracking-[0.1em] text-stone-100">
            {bubble.area.name}
          </span>
          <span className="shrink-0 font-mono text-[11px] text-emerald-300/90">
            {bubble.cards.length}
          </span>
        </button>

        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {bubble.cards.map((card) => (
            <BubbleMaterialCard
              key={card.material.item.id}
              material={card.material}
              quantityInArea={card.quantityInArea}
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
        className="absolute left-1/2 top-full size-1.5 -translate-x-1/2 rounded-full bg-emerald-300/70"
      />
    </div>
  );
}
