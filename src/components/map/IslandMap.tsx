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
import { bubbleScaleFor, type BubblePlacement } from "@/lib/map-layout";
import type { AreaBubble, MapFocus } from "@/lib/wiki/route";
import type { StepOverlay } from "@/hooks/useStepOverlay";
import type { RoutePlan } from "@/lib/wiki/routes";
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

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const bubbleByAreaId = useMemo(
    () => new Map(bubbles.map((bubble) => [bubble.area.id, bubble])),
    [bubbles],
  );

  /** Areas the island is currently drawing a bubble over. */
  const bubbledAreaIds = useMemo(() => {
    if (stepOverlay) return new Set(stepOverlay.route.steps.map((step) => step.area.id));
    return new Set(bubbles.map((bubble) => bubble.area.id));
  }, [bubbles, stepOverlay]);

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
    // A highlighted route takes over the island: its areas are the answer, so
    // the recipe/material tints step aside until the route is unpinned.
    if (routeAreaIds) return routeAreaIds.has(area.id) ? "route" : area.empty ? "empty" : "base";

    const bubble = bubbleByAreaId.get(area.id);
    if (!bubble) return area.empty ? "empty" : "base";
    if (!supportAreaIds) return "relevant";
    if (primaryAreaIds?.has(area.id)) return "material";
    if (supportAreaIds.has(area.id)) return "support";
    return "relevant";
  };

  const regionDimmed = (area: WikiArea) => {
    if (routeAreaIds) return !routeAreaIds.has(area.id);
    return supportAreaIds !== null && !supportAreaIds.has(area.id);
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
        <div className="absolute right-0 top-0 flex flex-col items-end gap-2">
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
        {stepOverlay
          ? stepOverlay.route.steps.map((step) => {
              const placement = stepOverlay.placements[step.area.id];
              if (!placement) return null;
              return (
                <RouteStepBubbleCard
                  key={step.area.id}
                  step={step}
                  placement={placement}
                  bubbleScale={bubbleScale}
                  active={activeAreaId === step.area.id}
                  onHoverArea={onHoverArea}
                  onSelectArea={onSelectArea}
                  onSelectItem={onSelectItem}
                />
              );
            })
          : bubbles.map((bubble) => {
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
                  onSelectItem={onSelectItem}
                />
              );
            })}

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
