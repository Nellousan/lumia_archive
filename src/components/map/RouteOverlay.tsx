"use client";

import type { RoutePlan } from "@/lib/wiki/routes";

export interface RouteOverlayProps {
  route: RoutePlan;
}

/** Radius of the numbered stop markers, in base-map pixels. */
const STOP_RADIUS = 14;

/**
 * The highlighted route drawn over the island: a dashed line through the areas
 * in visit order, with numbered markers so the stop sequence is readable.
 *
 * Sits inside the map's SVG so it shares the PNG's pixel space, and is
 * pointer-transparent — the polygons underneath stay clickable.
 */
export function RouteOverlay({ route }: RouteOverlayProps) {
  const points = route.steps
    .map((step) => `${step.area.anchor.x},${step.area.anchor.y}`)
    .join(" ");

  return (
    <g className="pointer-events-none" aria-hidden="true">
      {route.steps.length > 1 && (
        <polyline
          points={points}
          fill="none"
          stroke="rgba(252,211,77,0.85)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="12 9"
        />
      )}

      {route.steps.map((step, index) => (
        <g key={step.area.id}>
          <circle
            cx={step.area.anchor.x}
            cy={step.area.anchor.y}
            r={STOP_RADIUS}
            fill="rgba(8,13,11,0.88)"
            stroke="rgba(252,211,77,0.95)"
            strokeWidth={2.25}
          />
          <text
            x={step.area.anchor.x}
            y={step.area.anchor.y}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fde68a"
            fontSize={15}
            fontWeight={700}
            fontFamily="monospace"
          >
            {index + 1}
          </text>
        </g>
      ))}
    </g>
  );
}
