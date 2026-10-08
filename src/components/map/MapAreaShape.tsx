"use client";

import { regionVisual, type RegionState } from "./regionStyles";
import { toSvgPoints } from "@/lib/wiki/geometry";
import type { WikiArea } from "@/lib/wiki/types";

export interface MapAreaShapeProps {
  area: WikiArea;
  state: RegionState;
  dimmed: boolean;
  hovered: boolean;
  onHover: (areaId: string | null) => void;
  onSelect: (areaId: string) => void;
}

/**
 * One clickable area of the image map. The polygon is purely an overlay: the
 * artwork itself is the PNG underneath — area names included, which is why none
 * are drawn here — so the shape only provides tint, outline and hit area.
 */
export function MapAreaShape({
  area,
  state,
  dimmed,
  hovered,
  onHover,
  onSelect,
}: MapAreaShapeProps) {
  const label = area.mapped ? area.name : `${area.name} (not on map)`;

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${label}${area.empty ? ", no recorded loot" : `, ${area.spawns.length} items`}`}
      className="cursor-pointer outline-none"
      onMouseEnter={() => onHover(area.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(area.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(area.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(area.id);
        }
      }}
    >
      <polygon
        className="map-region"
        points={toSvgPoints(area.polygon)}
        style={regionVisual(state, hovered, dimmed)}
      />
    </g>
  );
}
