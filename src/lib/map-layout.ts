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
export const BUBBLE_CARD_WIDTH = 72;

/**
 * The share of the island's width a bubble is drawn at — at every size, with no
 * ceiling.
 *
 * A single pixel width cannot do this job: drawn at 140px whatever the pane, a
 * bubble took 16% of a small island and 5% of a large one, so a small screen got
 * a third again more clutter than a large one for no reason other than the
 * monitor. A share makes it the same picture at every size — a bubble covers the
 * same patch of Lumia on a laptop and on a 4K desk, which is what the island
 * pixels inside it already promise.
 *
 * Nothing caps it above because nothing needs to: the island box itself stops at
 * `max-w-[1400px]`, so {@link BUBBLE_DESIGN_ISLAND_WIDTH} is as wide as an island
 * ever gets and {@link BUBBLE_DESIGN_CSS_WIDTH} is therefore as wide as a bubble
 * ever gets.
 */
const BUBBLE_WIDTH_SHARE = 0.1;

/** Widest the island box itself ever gets, in CSS pixels — its own `max-w-[1400px]`. */
const BUBBLE_DESIGN_ISLAND_WIDTH = 1400;

/** A bubble at that island width, in CSS pixels: the size the island's own chrome is laid out against. */
const BUBBLE_DESIGN_CSS_WIDTH = BUBBLE_WIDTH_SHARE * BUBBLE_DESIGN_ISLAND_WIDTH;

const BUBBLE_BORDER = 1; // bubble `border`
const BUBBLE_PADDING = 6; // bubble `p-[6px]`
const BUBBLE_CARD_GAP = 8; // card row `gap-[8px]`
/**
 * Square artwork plus the quantity underneath. Measured off a rendered card, not
 * read off the classes: it came out 2 units taller than the arithmetic suggested,
 * and being 2 units short is enough to put two bubbles a `gap` apart on top of
 * each other.
 */
const BUBBLE_CARD_HEIGHT = 100;
/** Bubble padding plus the area header line. Measured the same way; was 56. */
const BUBBLE_CHROME_HEIGHT = 58;

/** How many item cards sit on one row before they wrap. */
const CARDS_PER_ROW = 3;

/**
 * The line a step bubble draws when nothing is built there ("nothing built
 * here"), in island pixels: `mt-[6px]` plus the 15px line itself.
 *
 * It is why a step is not the same shape as a material bubble with the same
 * number of cards, and it only shows on the *shortest* bubbles — an estimate that
 * forgot it reserved too little room for exactly the bubbles most likely to sit
 * next to a neighbour.
 */
const BUBBLE_NOTICE_HEIGHT = 24;

/** Width the header alone needs: room for an area name as long as "Research Center". */
const BUBBLE_HEADER_WIDTH = 230;

/**
 * Bubble width in island pixels: exactly {@link CARDS_PER_ROW} cards, the gaps
 * between them, the bubble's own padding and its hairline border — no more and no
 * less, so a row breaks after the last card that fits rather than one short of it.
 *
 * Never narrower than {@link BUBBLE_HEADER_WIDTH}, so shortening a row — going
 * back to two cards, say — cannot squeeze the area name in the header.
 *
 * Derived rather than typed out, because the count above is the only thing worth
 * choosing here: the width follows from it, and the placement estimates follow
 * from the width. Every term is box-sizing-dependent, which is the point: 2px of
 * border is exactly what stops a third card from fitting, and an estimate that
 * forgot it would reserve one row where the browser draws two.
 */
export const BUBBLE_WIDTH = Math.max(
  BUBBLE_HEADER_WIDTH,
  CARDS_PER_ROW * BUBBLE_CARD_WIDTH +
    (CARDS_PER_ROW - 1) * BUBBLE_CARD_GAP +
    2 * BUBBLE_PADDING +
    2 * BUBBLE_BORDER,
);

/**
 * The same rule as {@link bubbleScaleFor}, as a plain multiplier for the island's
 * own controls — the corner boxes that are laid out in CSS pixels rather than in
 * the island's coordinate layer.
 *
 * They are part of the same picture and there is no reason for them to keep their
 * size while the bubbles around them shrink: at a small island the random-spawn
 * box took a sixth of the map's width and its cards were half again the size of
 * the cards inside the bubbles. Multiplying by this puts its `w-10` frames at
 * what the bubbles' 72-island-pixel cards are drawn at.
 */
export function islandControlScale(islandWidth: number | null): number {
  if (islandWidth === null || islandWidth <= 0) return 1;
  return (BUBBLE_WIDTH_SHARE * islandWidth) / BUBBLE_DESIGN_CSS_WIDTH;
}

/**
 * How much the bubbles shrink or grow with the island, as a multiplier on top of
 * the layer that already scales them to it.
 *
 * The layer draws a bubble at a fixed fraction of the map — 246 of the island's
 * 1503 pixels, always — so this factor is what pulls it back to
 * {@link BUBBLE_WIDTH_SHARE} of whatever the island is measured at: proportionally
 * smaller on a small screen, where a full-size bubble would swallow the island,
 * and proportionally larger on a big one, where a fixed 140px would leave it
 * describing a patch of Lumia far bigger than itself.
 *
 * The placement solver and the renderer both derive it from the same measured
 * width, so the boxes it reserves and the boxes on screen stay the same boxes.
 * `islandWidth` is the width of the box holding the map, in CSS pixels.
 */
export function bubbleScaleFor(islandWidth: number | null, mapWidth: number): number {
  if (islandWidth === null || islandWidth <= 0) return 1;
  const drawnWidth = BUBBLE_WIDTH_SHARE * islandWidth;
  // Back out the factor that turns the layer's own scaling into that width: the
  // layer draws `islandWidth / mapWidth` of an island pixel per CSS pixel, and a
  // bubble is `BUBBLE_WIDTH` island pixels wide.
  return (drawnWidth * mapWidth) / (BUBBLE_WIDTH * islandWidth);
}

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

/**
 * Same estimate for a route step.
 *
 * A step bubble is *not* shaped like a material bubble with the same cards, and
 * the difference is the whole reason this is not one call to
 * {@link estimateCardsBubbleSize}. A material bubble has its width pinned to
 * {@link BUBBLE_WIDTH}, so its cards wrap at {@link CARDS_PER_ROW} and it grows
 * downwards. A step bubble is content-sized — nothing sets its width — so its
 * cards never wrap: it grows *sideways* instead, and stays one card tall however
 * many it holds.
 *
 * Reserving the wrapped box instead made every step reservation half as wide and
 * up to twice as tall as the bubble actually drawn, which is invisible until
 * something is placed against it: the bubbles that come back under a hover were
 * separated from a box 242 units narrower than the step they were avoiding, and
 * landed under it. Measured on route 1's Fire Station step: six cards, reserved
 * 246x252, drawn 488x158.
 */
export function estimateStepBubbleSize(
  step: RouteStep,
  scale = 1,
  /**
   * Cards the hover adds to this step because its area holds the focused material
   * too. They go on the same unwrapped row, so they widen the bubble — and this is
   * the box other bubbles are kept away from, so it has to know about them.
   */
  extraCards = 0,
): { width: number; height: number } {
  const cards = stepGathers(step).length + stepCrafts(step).length + extraCards;
  const cardsWidth =
    cards * BUBBLE_CARD_WIDTH +
    Math.max(0, cards - 1) * BUBBLE_CARD_GAP +
    2 * BUBBLE_PADDING +
    2 * BUBBLE_BORDER;
  const notice = stepCrafts(step).length === 0 ? BUBBLE_NOTICE_HEIGHT : 0;
  return {
    // The header sets a floor of its own, and a name is laid out rather than
    // measured here, so the floor errs wide: over-reserving only spaces bubbles
    // further apart, while under-reserving is what puts one on top of another.
    width: Math.max(BUBBLE_HEADER_WIDTH, cardsWidth) * scale,
    height: (BUBBLE_CHROME_HEIGHT + (cards > 0 ? BUBBLE_CARD_HEIGHT : 0) + notice) * scale,
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
  /**
   * Boxes that are already on screen and must not move: they still take part in
   * the separation, but only push the boxes being solved, which go around them.
   *
   * The route's step bubbles are passed this way while a material is hovered —
   * they are already drawn and the pointer is sitting on one of them, so moving
   * one would take the card out from under the reader and end the hover that
   * asked for the layout in the first place.
   */
  obstacles?: BubbleAnchor[];
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
  // The obstacles come last so the returned placements stay those of `anchors`.
  const boxes = [...anchors, ...(options.obstacles ?? [])].map((anchor, index) => {
    const halfWidth = anchor.width / 2;
    const halfHeight = anchor.height / 2;
    return {
      ...anchor,
      fixed: index >= anchors.length,
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
        // Two boxes that both have to stay put cannot be separated; the ones the
        // solver owns are pushed away from them instead.
        if (a.fixed && b.fixed) continue;
        moved = true;

        // A fixed box takes none of the push, so the one that moves takes it all.
        const share = (toward: number, axis: "x" | "y") => {
          if (a.fixed) b[axis] += toward * 2;
          else if (b.fixed) a[axis] -= toward * 2;
          else {
            a[axis] -= toward;
            b[axis] += toward;
          }
        };

        if (overlapY <= overlapX) {
          share((overlapY / 2 + 0.5) * (dy >= 0 ? 1 : -1), "y");
        } else {
          share((overlapX / 2 + 0.5) * (dx >= 0 ? 1 : -1), "x");
        }

        clampBox(a);
        clampBox(b);
      }
    }

    if (!moved) break;
  }

  // Only the boxes the caller asked about: an obstacle comes back where it was.
  return Object.fromEntries(
    boxes.slice(0, anchors.length).map((box) => [box.id, { x: box.x, y: box.y }]),
  );
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
