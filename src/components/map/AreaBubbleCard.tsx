"use client";

import { BubbleMaterialCard } from "./BubbleMaterialCard";
import { toLayerPosition, BUBBLE_WIDTH, type BubblePlacement } from "@/lib/map-layout";
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
  /**
   * True when the bubble is an answer rather than a control, so the pointer falls
   * straight through it.
   *
   * The bubbles that come back under a hover while a route is pinned sit around
   * the route's own cards, and if one of them took the pointer the card being
   * hovered would lose it — which withdraws the answer, which returns the pointer
   * to that card, which brings the answer back. Measured, that cycle runs every
   * 13ms and the island strobes. Letting the pointer through makes the answer
   * unable to end the question that asked it.
   *
   * While a route is being traced by hand this is *every* bubble, for a stronger
   * reason: the polygons are then the only thing a click may reach, and a bubble
   * that took the pointer could also swallow the entry that fades it.
   */
  passThrough?: boolean;
  /**
   * True when the pointer is inside this bubble's own area, under a manual trace:
   * the bubble steps back so the reader can click the area it is sitting on. Faded
   * rather than hidden, so the reader keeps seeing what is in the area they are
   * about to add.
   */
  faded?: boolean;
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  onHoverMaterial: (itemId: string | null) => void;
}

/**
 * Floating card anchored over an area that holds materials of the active
 * recipe. Its header names the area and opens the area panel; its body lists one
 * card per recipe material found there, with the quantity.
 *
 * The material cards themselves are read-only and hover-only — see
 * `BubbleMaterialCard` — so the header is the one control in the bubble, and the
 * count beside it is the number of cards the body draws. A bubble the pointer
 * falls through (`passThrough`) has no control at all, and its header is drawn as
 * text rather than as a button only the keyboard could reach. A traced stop draws
 * no material bubble at all: it is a step of the walk, and `RouteStepBubbleCard`
 * draws it the way a highlighted route's steps are drawn.
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
  passThrough = false,
  faded = false,
  onHoverArea,
  onSelectArea,
  onHoverMaterial,
}: AreaBubbleCardProps) {
  const { left, top } = toLayerPosition(placement, bubbleScale);
  const containsFocused = bubble.cards.some((card) => card.material.item.id === focus?.itemId);
  // A bubble also counts as relevant when it holds anything needed to craft the
  // focused material, not just the material itself.
  const containsSupport =
    focus !== null && bubble.cards.some((card) => focus.subtreeIds.includes(card.material.item.id));
  // A highlighted route overrides the material focus: everything off the route
  // fades back, so the path reads at a glance.
  const dimmed = faded || (routeActive ? !inRoute : focus !== null && !containsSupport);

  const header = (
    <>
      <span className="min-w-0 truncate font-display text-[21px] font-bold uppercase tracking-[0.1em] text-stone-100">
        {bubble.area.name}
      </span>
      <span className="shrink-0 font-mono text-[18px] text-emerald-300/90">{bubble.cards.length}</span>
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
        {passThrough ? (
          <div className="flex w-full items-center justify-between gap-[12px] rounded-[13px] px-[10px] py-[3px] text-left">
            {header}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onSelectArea(bubble.area.id)}
            className="flex w-full items-center justify-between gap-[12px] rounded-[13px] px-[10px] py-[3px] text-left transition hover:bg-white/[0.06]"
          >
            {header}
          </button>
        )}

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
