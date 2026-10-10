"use client";

import { useEffect, useMemo, useRef } from "react";
import { AreaBubbleCard } from "./AreaBubbleCard";
import { MapAreaShape } from "./MapAreaShape";
import { MapTooltip } from "./MapTooltip";
import { AnimalDropToggle } from "./AnimalDropToggle";
import { RandomSpawnBox } from "./RandomSpawnBox";
import { RouteOverlay } from "./RouteOverlay";
import { RouteStepBubbleCard } from "./RouteStepBubbleCard";
import type { RegionState } from "./regionStyles";
import { useElementWidth } from "@/hooks/useElementWidth";
import {
  bubbleScaleFor,
  estimateBubbleSize,
  islandControlScale,
  estimateStepBubbleSize,
  resolveBubblePlacements,
  type BubblePlacement,
} from "@/lib/map-layout";
import type { AreaBubble, BubbleCard, MapFocus } from "@/lib/wiki/route";
import type { StepOverlay } from "@/hooks/useStepOverlay";
import { stepCrafts, stepGathers, type RoutePlan } from "@/lib/wiki/routes";
import type { MapImage, WikiAnimal, WikiArea, WikiItem } from "@/lib/wiki/types";

/**
 * Narrowest the island is ever drawn, in CSS pixels — `min-w-[880px]` on the map
 * box, released on two-column layouts (`lg:min-w-0`) where the pane fits it.
 *
 * Below 880px the map pans instead of shrinking further: that is where a bubble
 * lands around 135px wide, the point at which its label stops being readable.
 */
const MIN_ISLAND_WIDTH_CLASS = "min-w-[880px] lg:min-w-0";

export interface IslandMapProps {
  /**
   * Rendered width of the map box, in CSS pixels, owned by the explorer because
   * the route solver needs it too. `null` until the first measurement.
   */
  renderWidth: number | null;
  /** Reports the measured width back up, rounded to whole pixels. */
  onRenderWidthChange: (width: number) => void;
  map: MapImage;
  areas: WikiArea[];
  /** Areas holding at least one material of the active recipe. */
  bubbles: AreaBubble[];
  /** Resolved bubble centres, in base-map pixels. */
  placements: Record<string, BubblePlacement>;
  /**
   * The material being focused, if any. It answers "where else is this?", and it
   * outranks the route tint below so that pinning a route does not silence it.
   */
  focus: MapFocus | null;
  /** Route to highlight, if one is hovered or pinned in the rail. */
  activeRoute: RoutePlan | null;
  /**
   * The highlighted route's steps, which replace the material bubbles while a
   * route is active. `null` keeps the island on its "where things are" view.
   */
  stepOverlay: StepOverlay | null;
  hoveredAreaId: string | null;
  activeAreaId: string | null;
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  onHoverMaterial: (itemId: string | null) => void;
  onSelectItem: (itemId: string) => void;
  /** The items with no fixed area, listed in the island's own corner. */
  randomSpawnItems: WikiItem[];
  /** item id -> the animals that can drop it; names the source in the box. */
  dropAnimalsByItemId: Record<string, WikiAnimal[]>;
  /** Ids of the items the current plan needs; the corner box highlights them. */
  plannedItemIds: string[];
  /** True when the island is also showing what wild animals can drop. */
  animalDrops: boolean;
  onToggleAnimalDrops: () => void;
}

/**
 * The island itself: the PNG artwork, an SVG overlay carrying the clickable area
 * polygons from the image map, and the material bubbles on top.
 *
 * Coordinates come straight from `lumia-island.map.json`, which uses the pixel
 * space of the PNG, so the overlay viewBox and the image dimensions are the same
 * numbers. The bubbles get the same treatment as the polygons: they live in a
 * layer as wide as the island and scaled to it, so they can follow a small map
 * down instead of swallowing a phone screen. Past full size they stop growing —
 * see {@link bubbleScaleFor} — because a wide monitor has room to spare and a
 * bubble that fills it only hides the island. Below
 * {@link MIN_ISLAND_WIDTH_CLASS} the map pans rather than shrinking further, so
 * those bubbles stay legible.
 */
export function IslandMap({
  renderWidth,
  onRenderWidthChange,
  map,
  areas,
  bubbles,
  placements,
  focus,
  activeRoute,
  stepOverlay,
  hoveredAreaId,
  activeAreaId,
  onHoverArea,
  onSelectArea,
  onHoverMaterial,
  onSelectItem,
  randomSpawnItems,
  dropAnimalsByItemId,
  plannedItemIds,
  animalDrops,
  onToggleAnimalDrops,
}: IslandMapProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measuredWidth = useElementWidth(boxRef);

  // Whole pixels only: the observer reports fractions, and re-solving the bubble
  // layout for a third of a pixel is work nobody can see.
  useEffect(() => {
    if (measuredWidth !== null) onRenderWidthChange(Math.round(measuredWidth));
  }, [measuredWidth, onRenderWidthChange]);

  /**
   * Extra factor on the bubbles: they follow the map down to a phone, and hold
   * their size once the island is wide enough to draw them at full size.
   */
  const bubbleScale = bubbleScaleFor(renderWidth, map.width);
  /**
   * One transform for the whole overlay: the island's pixels at the bubble cap,
   * scaled onto the rendered map. Bubbles are positioned straight into that
   * space by {@link toLayerPosition} — a transform per bubble on top of this one
   * makes Firefox draw the cards' rounded borders square at some zoom levels.
   */
  const overlayScale = renderWidth === null ? null : (renderWidth / map.width) * bubbleScale;
  /**
   * The corner controls are laid out in CSS pixels, outside the scaled layer, so
   * they take the same rule as a plain multiplier instead — see
   * {@link islandControlScale}.
   */
  const controlsScale = islandControlScale(renderWidth);

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const bubbleByAreaId = useMemo(
    () => new Map(bubbles.map((bubble) => [bubble.area.id, bubble])),
    [bubbles],
  );

  /** Areas holding the focused material itself. */
  const primaryAreaIds = useMemo(() => {
    if (!focus) return null;
    return new Set(
      bubbles
        .filter((bubble) => bubble.cards.some((card) => card.material.item.id === focus.itemId))
        .map((bubble) => bubble.area.id),
    );
  }, [bubbles, focus]);

  /** Areas holding anything needed to craft it. */
  const supportAreaIds = useMemo(() => {
    if (!focus) return null;
    const subtree = new Set(focus.subtreeIds);
    return new Set(
      bubbles
        .filter((bubble) => bubble.cards.some((card) => subtree.has(card.material.item.id)))
        .map((bubble) => bubble.area.id),
    );
  }, [bubbles, focus]);

  /**
   * The focused item and everything needed to craft it, by id. `subtreeIds`
   * already includes the item itself — see {@link MapFocus}.
   */
  const focusIds = useMemo(() => (focus ? new Set(focus.subtreeIds) : null), [focus]);

  /** The areas whose bubble is a route step rather than a material. */
  const stepAreaIds = useMemo(
    () => new Set(stepOverlay ? stepOverlay.route.steps.map((step) => step.area.id) : []),
    [stepOverlay],
  );

  /**
   * The material bubbles that come back while a card is hovered under a pinned
   * route: the relevant areas the route does **not** stop at.
   *
   * A route step keeps its own bubble, so no area ever draws two bubbles at once —
   * the step already says what happens there, and the answer the reader asked for
   * is about everywhere else. Those bubbles are drawn as the material view draws
   * them: they are the material answer, so the route tint does not apply to them.
   */
  const hoveredMaterialBubbles = useMemo(() => {
    if (!stepOverlay || !supportAreaIds) return [];
    return bubbles.filter(
      (bubble) => supportAreaIds.has(bubble.area.id) && !stepAreaIds.has(bubble.area.id),
    );
  }, [bubbles, stepAreaIds, stepOverlay, supportAreaIds]);

  /**
   * The steps that have nothing to do with the focused material, and so step back
   * while it is focused — the route's own version of the way the other bubbles
   * fade.
   *
   * A step stays lit when its area holds the material or something needed to craft
   * it, and also when the step itself picks up or builds the focused item: a craft
   * has no spawn area, so hovering *build iron sheet here* must not fade the very
   * bubble the pointer is in.
   */
  const unrelatedStepAreaIds = useMemo(() => {
    if (!stepOverlay || !supportAreaIds || !focusIds) return new Set<string>();
    return new Set(
      stepOverlay.route.steps
        .filter((step) => {
          if (supportAreaIds.has(step.area.id)) return false;
          return ![...stepGathers(step), ...stepCrafts(step)].some((entry) =>
            focusIds.has(entry.item.id),
          );
        })
        .map((step) => step.area.id),
    );
  }, [focusIds, stepOverlay, supportAreaIds]);

  /**
   * The focused item's card in a step's own area, for the stops that hold it
   * without gathering it.
   *
   * A material needed once is often found on several stops while the route picks it
   * up at one of them, and the hover is exactly the question "where else is this?" —
   * so a stop that holds it should say so while the pointer is on its card. A step
   * that already lists the item as its own pickup or build is left alone: the card
   * is there, and a second one would only say it twice.
   */
  const foundCardByStepAreaId = useMemo(() => {
    const found = new Map<string, BubbleCard>();
    if (!stepOverlay || !focus) return found;
    for (const step of stepOverlay.route.steps) {
      const own = [...stepGathers(step), ...stepCrafts(step)];
      if (own.some((entry) => entry.item.id === focus.itemId)) continue;
      const card = bubbleByAreaId
        .get(step.area.id)
        ?.cards.find((candidate) => candidate.material.item.id === focus.itemId);
      if (card) found.set(step.area.id, card);
    }
    return found;
  }, [bubbleByAreaId, focus, stepOverlay]);

  /**
   * Where those bubbles go. They are solved here rather than by the plan's own
   * layout because the route's bubbles have to be kept out of the way, and only
   * this component knows where the route solver put them.
   *
   * The route bubbles are passed as obstacles, not as part of the set: they are on
   * screen and one of them holds the pointer, so a solve that moved them would
   * slide the hovered card out from under the reader and drop the hover.
   *
   * Only the steps that *stay lit* are obstacles. A faded step is on its way out —
   * that is the "irrelevant route bubbles vanish" half of the behaviour — so a
   * material bubble settling over one costs nothing, and leaving those boxes out of
   * the solve gives the answer the room it needs to space itself out.
   */
  const hoveredMaterialPlacements = useMemo(() => {
    if (!stepOverlay || hoveredMaterialBubbles.length === 0) return {};
    return resolveBubblePlacements(
      hoveredMaterialBubbles.map((bubble) => ({
        id: bubble.area.id,
        x: bubble.area.anchor.x,
        y: bubble.area.anchor.y,
        ...estimateBubbleSize(bubble, bubbleScale),
      })),
      {
        mapWidth: map.width,
        mapHeight: map.height,
        obstacles: stepOverlay.route.steps.flatMap((step) => {
          if (unrelatedStepAreaIds.has(step.area.id)) return [];
          const placement = stepOverlay.placements[step.area.id];
          if (!placement) return [];
          return [
            {
              id: step.area.id,
              x: placement.x,
              y: placement.y,
              ...estimateStepBubbleSize(
                step,
                bubbleScale,
                foundCardByStepAreaId.has(step.area.id) ? 1 : 0,
              ),
            },
          ];
        }),
      },
    );
  }, [
    bubbleScale,
    hoveredMaterialBubbles,
    map.height,
    map.width,
    foundCardByStepAreaId,
    stepOverlay,
    unrelatedStepAreaIds,
  ]);

  /** Areas the island is currently drawing a bubble over. */
  const bubbledAreaIds = useMemo(() => {
    if (stepOverlay) {
      const ids = new Set(stepOverlay.route.steps.map((step) => step.area.id));
      for (const bubble of hoveredMaterialBubbles) ids.add(bubble.area.id);
      return ids;
    }
    return new Set(bubbles.map((bubble) => bubble.area.id));
  }, [bubbles, hoveredMaterialBubbles, stepOverlay]);

  const hoveredArea = hoveredAreaId ? (areaById.get(hoveredAreaId) ?? null) : null;
  // Areas with a bubble already explain their contents, so no tooltip there.
  const tooltipArea =
    hoveredArea && !bubbledAreaIds.has(hoveredArea.id) && placements[hoveredArea.id]
      ? hoveredArea
      : null;

  const tooltipMaterialNames = useMemo(() => {
    if (!hoveredArea) return [];
    return bubbles
      .filter((bubble) => bubble.area.id === hoveredArea.id)
      .flatMap((bubble) => bubble.cards.map((card) => card.material.item.name));
  }, [bubbles, hoveredArea]);

  /** Areas on the highlighted route, if any. */
  const routeAreaIds = useMemo(
    () => (activeRoute ? new Set(activeRoute.areaIds) : null),
    [activeRoute],
  );

  const regionState = (area: WikiArea): RegionState => {
    // A hovered material is a question about the island — "where else is this?" —
    // and it outranks the route tint so it answers exactly what it answers with
    // no route on screen. It has to come first rather than be blended in: the
    // route and material states are both amber and near-identical, so an area
    // that stayed "route" would be indistinguishable from one holding the
    // material. The route survives the takeover regardless, because its numbered
    // stops are drawn over these regions rather than in them.
    if (supportAreaIds) {
      const bubble = bubbleByAreaId.get(area.id);
      if (!bubble) return area.empty ? "empty" : "base";
      if (primaryAreaIds?.has(area.id)) return "material";
      if (supportAreaIds.has(area.id)) return "support";
      return "relevant";
    }

    // A highlighted route takes over the island: its areas are the answer, so
    // the recipe/material tints step aside until the route is unpinned.
    if (routeAreaIds) return routeAreaIds.has(area.id) ? "route" : area.empty ? "empty" : "base";

    return bubbleByAreaId.has(area.id) ? "relevant" : area.empty ? "empty" : "base";
  };

  const regionDimmed = (area: WikiArea) => {
    // Same order as the states above: what the reader is asking about decides
    // what stays lit.
    if (supportAreaIds) return !supportAreaIds.has(area.id);
    if (routeAreaIds) return !routeAreaIds.has(area.id);
    return false;
  };

  return (
    <div
      ref={boxRef}
      className={`relative mx-auto w-full max-w-[1400px] ${MIN_ISLAND_WIDTH_CLASS}`}
    >
      {/*
       * The island's controls — what the map is showing, and what it cannot
       * show — in the box that holds the artwork, so they are placed against the
       * island itself and not against the pane around it: 12px in from its
       * top-right corner, the same inset at every size and scroll position.
       *
       * The wrapper is zero-height and sticky. Zero-height because it must not
       * push the artwork down a single pixel; sticky because below
       * {@link MIN_ISLAND_WIDTH_CLASS} the island is wider than the screen and
       * pans, and controls anchored to its corner would then start off-screen
       * and stay there. While the map is panned `right-3` holds them at the
       * visible edge, and `top-3` does the same when the island is taller than
       * the pane.
       */}
      <div className="sticky right-3 top-3 z-40 ml-auto h-0 w-[158px]">
        {/*
         * The island's own chrome, shrunk by the same rule as the bubbles — it is
         * laid out in CSS pixels rather than in the island's coordinate layer, so
         * without this it would sit at full size beside bubbles drawn at half its
         * scale. Anchored top-right, which is the corner it hangs from.
         */}
        <div
          className="absolute right-0 top-0 flex flex-col items-end gap-2"
          style={{ transform: `scale(${controlsScale})`, transformOrigin: "top right" }}
        >
          <RandomSpawnBox
            items={randomSpawnItems}
            dropAnimalsByItemId={dropAnimalsByItemId}
            neededItemIds={plannedItemIds}
            onSelectItem={onSelectItem}
            onHoverItem={onHoverMaterial}
          />
          <AnimalDropToggle active={animalDrops} onToggle={onToggleAnimalDrops} />
        </div>
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size static map, the SVG
          overlay must align with the exact rendered box, so no optimiser transform. */}
      <img
        src={map.src}
        alt="Terrain map of Lumia Island, the map of Black Survival"
        width={map.width}
        height={map.height}
        draggable={false}
        className="block h-auto w-full rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
      />

      <svg
        viewBox={`0 0 ${map.width} ${map.height}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-label="Clickable areas of Lumia Island"
      >
        {areas
          .filter((area) => area.mapped && area.polygon.length > 2)
          .map((area) => (
            <MapAreaShape
              key={area.id}
              area={area}
              state={regionState(area)}
              dimmed={regionDimmed(area)}
              hovered={hoveredAreaId === area.id}
              onHover={onHoverArea}
              onSelect={onSelectArea}
            />
          ))}
      </svg>

      {/*
       * The bubbles, in the island's own pixels: sized like the PNG, then scaled
       * to whatever the map is rendered at. Held back until the width is measured
       * so nothing is drawn at the wrong scale for a frame. Clipped to the island
       * so a bubble's pointer dot at the edge cannot add phantom panning to the
       * scroll container.
       */}
      <div
        className="pointer-events-none absolute left-0 top-0 z-20 overflow-hidden"
        style={{
          width: map.width / bubbleScale,
          height: map.height / bubbleScale,
          transform: `scale(${overlayScale ?? 1})`,
          transformOrigin: "top left",
          visibility: overlayScale === null ? "hidden" : "visible",
        }}
      >
        {stepOverlay ? (
          <>
            {stepOverlay.route.steps.map((step) => {
              const placement = stepOverlay.placements[step.area.id];
              if (!placement) return null;
              return (
                <RouteStepBubbleCard
                  key={step.area.id}
                  step={step}
                  placement={placement}
                  bubbleScale={bubbleScale}
                  active={activeAreaId === step.area.id}
                  focus={focus}
                  foundCard={foundCardByStepAreaId.get(step.area.id) ?? null}
                  areaCards={bubbleByAreaId.get(step.area.id)?.cards ?? []}
                  dimmed={unrelatedStepAreaIds.has(step.area.id)}
                  onHoverArea={onHoverArea}
                  onSelectArea={onSelectArea}
                  onSelectItem={onSelectItem}
                  onHoverItem={onHoverMaterial}
                />
              );
            })}

            {/*
             * Last, so the bubbles the hover just brought back paint over the route
             * steps: they are the answer, and the steps were already on screen.
             */}
            {hoveredMaterialBubbles.map((bubble) => {
              const placement = hoveredMaterialPlacements[bubble.area.id];
              if (!placement) return null;
              return (
                <AreaBubbleCard
                  key={bubble.area.id}
                  bubble={bubble}
                  placement={placement}
                  bubbleScale={bubbleScale}
                  active={activeAreaId === bubble.area.id}
                  focus={focus}
                  // Not a route stop, so it takes the material treatment rather
                  // than the route's: the route has already said its piece in the
                  // step bubbles above.
                  routeActive={false}
                  inRoute={false}
                  // It is on screen only for as long as the pointer holds a step
                  // card down, and it must not be able to take that pointer: see
                  // the prop's own note on the strobe that costs.
                  passThrough
                  onHoverArea={onHoverArea}
                  onSelectArea={onSelectArea}
                  onHoverMaterial={onHoverMaterial}
                />
              );
            })}
          </>
        ) : (
          bubbles.map((bubble) => {
            const placement = placements[bubble.area.id];
            if (!placement) return null;
            return (
              <AreaBubbleCard
                key={bubble.area.id}
                  bubble={bubble}
                  placement={placement}
                  bubbleScale={bubbleScale}
                  active={activeAreaId === bubble.area.id}
                  focus={focus}
                  routeActive={routeAreaIds !== null}
                  inRoute={routeAreaIds?.has(bubble.area.id) ?? false}
                  onHoverArea={onHoverArea}
                  onSelectArea={onSelectArea}
                  onHoverMaterial={onHoverMaterial}
                />
              );
            })
        )}

        {tooltipArea && (
          <MapTooltip
            area={tooltipArea}
            anchor={placements[tooltipArea.id]}
            bubbleScale={bubbleScale}
            materialNames={tooltipMaterialNames}
          />
        )}
      </div>

      {activeRoute && (
        // Above the bubbles (z-30) so the numbered stops cannot be hidden behind
        // a bubble card, and pointer-transparent so the island stays clickable.
        <svg
          viewBox={`0 0 ${map.width} ${map.height}`}
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 z-30 h-full w-full"
        >
          <RouteOverlay route={activeRoute} />
        </svg>
      )}
    </div>
  );
}
