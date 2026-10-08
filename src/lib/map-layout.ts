import { clamp } from "./wiki/geometry";
import type { AreaBubble } from "./wiki/route";

/**
 * Bubble placement solver for the island overlay.
 *
 * Area anchors are dictated by geography, so two neighbouring areas can easily
 * want their bubble in the same spot. This spreads them apart with a few
 * iterations of axis-aligned separation, then clamps everything back inside the
 * map. Pure and deterministic: same input, same layout.
 */

/**
 * Bubble geometry, in base-map pixels.
 *
 * The card and bubble numbers are shared with the components (`AreaBubbleCard`
 * and `BubbleMaterialCard` read them) so the estimates below cannot drift away
 * from what is actually rendered.
 */
export const BUBBLE_WIDTH = 140;
export const BUBBLE_CARD_WIDTH = 44;

const BUBBLE_PADDING = 4; // bubble `p-1`
const BUBBLE_CARD_GAP = 6; // card row `gap-1.5`
const BUBBLE_CARD_HEIGHT = 60; // square artwork + the quantity underneath
const BUBBLE_CHROME_HEIGHT = 34; // bubble padding + area header

/** How many cards fit on one row before they wrap. */
const CARDS_PER_ROW = Math.max(
  1,
  Math.floor(
    (BUBBLE_WIDTH - 2 * BUBBLE_PADDING + BUBBLE_CARD_GAP) / (BUBBLE_CARD_WIDTH + BUBBLE_CARD_GAP),
  ),
);

/**
 * Estimated rendered size of a bubble, in base-map pixels — used to spread
 * overlapping bubbles apart before drawing them.
 */
export function estimateBubbleSize(bubble: AreaBubble): { width: number; height: number } {
  const rows = Math.max(1, Math.ceil(bubble.cards.length / CARDS_PER_ROW));
  return {
    width: BUBBLE_WIDTH,
    height: BUBBLE_CHROME_HEIGHT + rows * BUBBLE_CARD_HEIGHT,
  };
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

export function toPercentPosition(
  placement: BubblePlacement,
  mapWidth: number,
  mapHeight: number,
): { left: string; top: string } {
  return {
    left: `${(placement.x / mapWidth) * 100}%`,
    top: `${(placement.y / mapHeight) * 100}%`,
  };
}
