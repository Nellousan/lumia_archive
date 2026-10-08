"use client";

import { useMemo } from "react";
import { AreaBubbleCard } from "./AreaBubbleCard";
import { MapAreaShape } from "./MapAreaShape";
import { MapTooltip } from "./MapTooltip";
import type { RegionState } from "./regionStyles";
import type { BubblePlacement } from "@/lib/map-layout";
import type { AreaBubble, MapFocus } from "@/lib/wiki/route";
import type { MapImage, WikiArea } from "@/lib/wiki/types";

export interface IslandMapProps {
  map: MapImage;
  areas: WikiArea[];
  /** Areas holding at least one material of the active recipe. */
  bubbles: AreaBubble[];
  /** Resolved bubble centres, in base-map pixels. */
  placements: Record<string, BubblePlacement>;
  focus: MapFocus | null;
  hoveredAreaId: string | null;
  activeAreaId: string | null;
  onHoverArea: (areaId: string | null) => void;
  onSelectArea: (areaId: string) => void;
  onHoverMaterial: (itemId: string | null) => void;
  onSelectItem: (itemId: string) => void;
}

/**
 * The island itself: the PNG artwork, an SVG overlay carrying the clickable area
 * polygons from the image map, and the material bubbles on top.
 *
 * Coordinates come straight from `lumia-island.map.json`, which uses the pixel
 * space of the PNG, so the overlay viewBox and the image dimensions are the same
 * numbers — no scaling maths anywhere.
 */
export function IslandMap({
  map,
  areas,
  bubbles,
  placements,
  focus,
  hoveredAreaId,
  activeAreaId,
  onHoverArea,
  onSelectArea,
  onHoverMaterial,
  onSelectItem,
}: IslandMapProps) {
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

  const hoveredArea = hoveredAreaId ? (areaById.get(hoveredAreaId) ?? null) : null;
  // Areas with a bubble already explain their contents, so no tooltip there.
  const tooltipArea =
    hoveredArea && !bubbleByAreaId.has(hoveredArea.id) && placements[hoveredArea.id]
      ? hoveredArea
      : null;

  const tooltipMaterialNames = useMemo(() => {
    if (!hoveredArea) return [];
    return bubbles
      .filter((bubble) => bubble.area.id === hoveredArea.id)
      .flatMap((bubble) => bubble.cards.map((card) => card.material.item.name));
  }, [bubbles, hoveredArea]);

  const regionState = (area: WikiArea): RegionState => {
    const bubble = bubbleByAreaId.get(area.id);
    if (!bubble) return area.empty ? "empty" : "base";
    if (!supportAreaIds) return "relevant";
    if (primaryAreaIds?.has(area.id)) return "material";
    if (supportAreaIds.has(area.id)) return "support";
    return "relevant";
  };

  const regionDimmed = (area: WikiArea) =>
    supportAreaIds !== null && !supportAreaIds.has(area.id);

  return (
    <div className="relative mx-auto w-full max-w-[1400px]">
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
              showLabel={!bubbleByAreaId.has(area.id)}
              onHover={onHoverArea}
              onSelect={onSelectArea}
            />
          ))}
      </svg>

      {bubbles.map((bubble) => {
        const placement = placements[bubble.area.id];
        if (!placement) return null;
        return (
          <AreaBubbleCard
            key={bubble.area.id}
            bubble={bubble}
            placement={placement}
            map={map}
            active={activeAreaId === bubble.area.id}
            focus={focus}
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
          map={map}
          materialNames={tooltipMaterialNames}
        />
      )}
    </div>
  );
}
