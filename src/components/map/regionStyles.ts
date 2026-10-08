import type { CSSProperties } from "react";

/**
 * Fill and stroke for area polygons.
 *
 * Inline styles rather than Tailwind colour utilities: SVG `fill`/`stroke` need
 * rgba values that fade the PNG underneath, and these must stay in sync with the
 * bubble colours used in the overlay.
 */

export type RegionState =
  /** Mapped area, no relevance to the current item. */
  | "base"
  /** On the map but with no loot in `data.json` (e.g. research_center). */
  | "empty"
  /** Contains at least one material of the active recipe tree. */
  | "relevant"
  /** Contains the material currently focused. */
  | "material"
  /** Contains an ingredient needed to craft the focused material. */
  | "support";

interface RegionVisual {
  fill: string;
  stroke: string;
  strokeWidth: number;
}

const REGION_VISUALS: Record<RegionState, RegionVisual> = {
  base: {
    fill: "rgba(22,32,28,0.22)",
    stroke: "rgba(139,169,155,0.30)",
    strokeWidth: 1,
  },
  empty: {
    fill: "rgba(22,32,28,0.05)",
    stroke: "rgba(139,169,155,0.16)",
    strokeWidth: 1,
  },
  relevant: {
    fill: "rgba(52,211,153,0.20)",
    stroke: "rgba(167,243,208,0.65)",
    strokeWidth: 1.5,
  },
  material: {
    fill: "rgba(252,211,77,0.26)",
    stroke: "rgba(254,243,199,0.85)",
    strokeWidth: 2.25,
  },
  support: {
    fill: "rgba(252,211,77,0.11)",
    stroke: "rgba(252,211,77,0.45)",
    strokeWidth: 1.5,
  },
};

export function regionVisual(state: RegionState, hovered: boolean, dimmed: boolean): CSSProperties {
  const visual = REGION_VISUALS[state];
  return {
    fill: visual.fill,
    stroke: visual.stroke,
    strokeWidth: hovered ? visual.strokeWidth + 0.75 : visual.strokeWidth,
    strokeDasharray: state === "empty" ? "3 4" : undefined,
    opacity: dimmed ? 0.32 : 1,
  };
}
