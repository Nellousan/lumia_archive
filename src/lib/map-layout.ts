import { clamp } from "./wiki/geometry";
import type { AreaBubble } from "./wiki/route";
import { stepCrafts, stepGathers, type RouteStep } from "./wiki/routes";

/**
 * Bubble placement solver for the island overlay.
 *
 * Area anchors are dictated by geography, so two neighbouring areas can easily
 * want their bubble in the same spot. This spreads them apart with a few
 * iterations of axis-aligned separation, then clamps everything back inside the
 * map. Pure and deterministic: same input, same layout.
 */

/**
 * Bubble geometry, in island pixels — the same 1503×774 space as the PNG and the
 * area polygons.
 *
 * Bubbles are drawn inside an overlay layer the size of the island itself (see
 * `IslandMap`), so writing them in these units makes them scale *with the map*:
 * the same bubble covers the same patch of Lumia whether the pane is a phone or
 * a 4K monitor. That also makes the numbers here honest — the boxes below and the
 * boxes the browser lays out are the same boxes, which they were not while the
 * overlay was measured in island pixels but drawn in CSS ones.
 *
 * The card and bubble numbers are shared with the components (`AreaBubbleCard`
 * and `BubbleMaterialCard` read them) so the estimates below cannot drift away
 * from what is actually rendered.
 */
export const BUBBLE_WIDTH = 230;
export const BUBBLE_CARD_WIDTH = 72;

/**
 * Widest a bubble is drawn on screen, in CSS pixels — the size the overlay used
 * before it started scaling with the island.
 */
const BUBBLE_DESIGN_CSS_WIDTH = 140;

const BUBBLE_PADDING = 6; // bubble `p-[6px]`
const BUBBLE_CARD_GAP = 8; // card row `gap-[8px]`
const BUBBLE_CARD_HEIGHT = 98; // square artwork + the quantity underneath
const BUBBLE_CHROME_HEIGHT = 56; // bubble padding + area header

/**
 * How much the bubbles shrink or grow with the island, as a multiplier on top of
 * the layer that already scales them to it.
 *
 * Scaling with the map is what keeps a phone's labels readable, but there is no
 * reason for a bubble to keep growing once it is back at
 * {@link BUBBLE_DESIGN_CSS_WIDTH}: a 27" monitor has room to spare, and a bubble
 * that fills it only covers the island it is describing. So the factor is capped
 * at 1 — bubbles track the map on the way down and hold their size on the way up.
 *
 * The placement solver and the renderer both derive it from the same measured
 * width, so the boxes it reserves and the boxes on screen stay the same boxes.
 */
export function bubbleScaleFor(islandWidth: number | null, mapWidth: number): number {
  if (islandWidth === null || islandWidth <= 0) return 1;
  return Math.min(1, (BUBBLE_DESIGN_CSS_WIDTH * mapWidth) / (BUBBLE_WIDTH * islandWidth));
}

/** How many cards fit on one row before they wrap. */
const CARDS_PER_ROW = Math.max(
  1,
  Math.floor(
    (BUBBLE_WIDTH - 2 * BUBBLE_PADDING + BUBBLE_CARD_GAP) / (BUBBLE_CARD_WIDTH + BUBBLE_CARD_GAP),
  ),
);

/**
 * Estimated rendered size of a bubble holding `cardCount` cards, in island
 * pixels at the given bubble scale. Wrapping does not depend on the scale, so
 * only the final numbers are multiplied.
 */
export function estimateCardsBubbleSize(
  cardCount: number,
  scale = 1,
): {
  width: number;
  height: number;
} {
  const rows = Math.max(1, Math.ceil(cardCount / CARDS_PER_ROW));
  return {
    width: BUBBLE_WIDTH * scale,
    height: (BUBBLE_CHROME_HEIGHT + rows * BUBBLE_CARD_HEIGHT) * scale,
  };
}

/**
 * Estimated rendered size of a bubble, in base-map pixels — used to spread
 * overlapping bubbles apart before drawing them.
 */
export function estimateBubbleSize(
  bubble: AreaBubble,
  scale = 1,
): { width: number; height: number } {
  return estimateCardsBubbleSize(bubble.cards.length, scale);
}

/** Same estimate for a route step, whose cards are what is gathered and built. */
export function estimateStepBubbleSize(
  step: RouteStep,
  scale = 1,
): { width: number; height: number } {
  return estimateCardsBubbleSize(stepGathers(step).length + stepCrafts(step).length, scale);
}

export interface BubbleAnchor {
  id: string;
  /** Desired centre, in base-map pixel coordinates. */
  x: number;
  y: number;
  /** Estimated rendered size, in base-map pixel coordinates. */
  width: number;
  height: number;
}

export interface BubblePlacement {
  x: number;
  y: number;
}

export interface BubbleLayoutOptions {
  mapWidth: number;
  mapHeight: number;
  /** Minimum gap between two boxes. */
  gap?: number;
  /** Extra breathing room from the map edge. */
  edgePadding?: number;
  iterations?: number;
}

function overlaps(a: BubbleAnchor, b: BubbleAnchor, gap: number): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2 + gap
  );
}

export function resolveBubblePlacements(
  anchors: BubbleAnchor[],
  options: BubbleLayoutOptions,
): Record<string, BubblePlacement> {
  const { mapWidth, mapHeight } = options;
  const gap = options.gap ?? 8;
  const edgePadding = options.edgePadding ?? 6;
  const iterations = options.iterations ?? 60;

  // Work on mutable copies, already clamped so every box starts inside the map.
  const boxes = anchors.map((anchor) => {
    const halfWidth = anchor.width / 2;
    const halfHeight = anchor.height / 2;
    return {
      ...anchor,
      x: clamp(anchor.x, halfWidth + edgePadding, mapWidth - halfWidth - edgePadding),
      y: clamp(anchor.y, halfHeight + edgePadding, mapHeight - halfHeight - edgePadding),
    };
  });

  const clampBox = (box: (typeof boxes)[number]) => {
    const halfWidth = box.width / 2;
    const halfHeight = box.height / 2;
    box.x = clamp(box.x, halfWidth + edgePadding, mapWidth - halfWidth - edgePadding);
    box.y = clamp(box.y, halfHeight + edgePadding, mapHeight - halfHeight - edgePadding);
  };

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let moved = false;

    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        if (!overlaps(a, b, gap)) continue;

        const minX = (a.width + b.width) / 2 + gap;
        const minY = (a.height + b.height) / 2 + gap;
        const dx = b.x - a.x;
        const dy = b.y - a.y;

        // Overlap depth on each axis; separate along the shallower one.
        const overlapX = minX - Math.abs(dx);
        const overlapY = minY - Math.abs(dy);

        if (overlapX <= 0 || overlapY <= 0) continue;
        moved = true;

        if (overlapY <= overlapX) {
          const push = (overlapY / 2 + 0.5) * (dy >= 0 ? 1 : -1);
          a.y -= push;
          b.y += push;
        } else {
          const push = (overlapX / 2 + 0.5) * (dx >= 0 ? 1 : -1);
          a.x -= push;
          b.x += push;
        }

        clampBox(a);
        clampBox(b);
      }
    }

    if (!moved) break;
  }

  return Object.fromEntries(boxes.map((box) => [box.id, { x: box.x, y: box.y }]));
}

/**
 * Style that drops a bubble centre onto the island.
 *
 * The overlay layer is drawn in *capped* island pixels — its own box is
 * `map.width / bubbleScale` wide and one transform scales it to the map — so an
 * island coordinate has to be divided by the cap to land in it. Sizes do not:
 * they are already in the layer's units.
 *
 * The division lives here rather than in the layer's transform because a second
 * transform per bubble is not free: nested scales make Firefox re-rasterise the
 * cards' sub-pixel borders as square corners under some zooms. One transform and
 * arithmetic that cannot go stale is the cheaper arrangement.
 */
export function toLayerPosition(
  placement: BubblePlacement,
  bubbleScale: number,
): { left: number; top: number } {
  return { left: placement.x / bubbleScale, top: placement.y / bubbleScale };
}
