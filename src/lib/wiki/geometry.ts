import type { MapPoint } from "./types";

/** Removes consecutive duplicate vertices (the image map repeats its last point). */
export function dedupeVertices(points: MapPoint[]): MapPoint[] {
  return points.filter((point, index) => {
    if (index === 0) return true;
    const previous = points[index - 1];
    return previous.x !== point.x || previous.y !== point.y;
  });
}

/**
 * Converts the flat `[x0, y0, x1, y1, ...]` coordinate list used by HTML image
 * maps into vertices.
 */
export function coordsToPolygon(coords: number[]): MapPoint[] {
  const points: MapPoint[] = [];
  for (let index = 0; index + 1 < coords.length; index += 2) {
    points.push({ x: coords[index], y: coords[index + 1] });
  }
  return dedupeVertices(points);
}

export function polygonBounds(points: MapPoint[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export function boundsCenter(bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): MapPoint {
  return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

/** Shoelace formula. Returns `null` for degenerate (zero-area) polygons. */
export function polygonCentroid(points: MapPoint[]): MapPoint | null {
  let twiceArea = 0;
  let x = 0;
  let y = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];
    const cross = current.x * next.y - next.x * current.y;
    twiceArea += cross;
    x += (current.x + next.x) * cross;
    y += (current.y + next.y) * cross;
  }

  if (Math.abs(twiceArea) < 1e-6) return null;
  return { x: x / (3 * twiceArea), y: y / (3 * twiceArea) };
}

/** Standard even-odd ray casting. */
export function pointInPolygon(point: MapPoint, polygon: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const straddles = a.y > point.y !== b.y > point.y;
    if (straddles && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * A stable anchor for overlays. The geometric centroid is preferred, but concave
 * area shapes (Beach, Cemetery, Well...) can push it outside the polygon, where a
 * label would float over water. In that case fall back to the bounding-box centre.
 */
export function polygonAnchor(points: MapPoint[]): MapPoint {
  const bounds = polygonBounds(points);
  const fallback = boundsCenter(bounds);
  const centroid = polygonCentroid(points);
  if (!centroid) return fallback;
  return pointInPolygon(centroid, points) ? centroid : fallback;
}

export function toSvgPoints(points: MapPoint[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
