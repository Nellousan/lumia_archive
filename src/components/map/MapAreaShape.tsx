"use client";

import { regionVisual, type RegionState } from "./regionStyles";
import { toSvgPoints } from "@/lib/wiki/geometry";
import type { WikiArea } from "@/lib/wiki/types";

export interface MapAreaShapeProps {
  area: WikiArea;
  state: RegionState;
  dimmed: boolean;
  hovered: boolean;
  /** False when the area already shows a bubble carrying its name. */
  showLabel: boolean;
  onHover: (areaId: string | null) => void;
  onSelect: (areaId: string) => void;
}

/**
 * One clickable area of the image map. The polygon is purely an overlay: the
 * artwork itself is the PNG underneath, so the shape only provides tint,
 * outline, label and hit area.
 */
export function MapAreaShape({
  area,
  state,
  dimmed,
  hovered,
  showLabel,
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

      {showLabel && (
        <text
          x={area.anchor.x}
          y={area.anchor.y}
          textAnchor="middle"
          aria-hidden="true"
          className="pointer-events-none select-none font-display font-semibold uppercase"
          style={{
            fontSize: 15,
            letterSpacing: "0.06em",
            fill: hovered ? "rgba(240,250,245,0.95)" : "rgba(214,228,222,0.45)",
            paintOrder: "stroke",
            stroke: "rgba(6,12,10,0.85)",
            strokeWidth: 3.5,
            transition: "fill 200ms ease",
          }}
        >
          {area.name}
        </text>
      )}
    </g>
  );
}
