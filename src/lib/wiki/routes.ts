import type { RecipeNode, WikiArea, WikiDataset, WikiItem } from "./types";

/**
 * Route planning: the fewest areas you must visit to obtain the active item.
 *
 * Any area can be reached from any other in the same amount of time (there is no
 * travel-time data, and the game charges one hop per move), so the cost of a
 * route is simply its number of hops: `stops - 1`. Ranking therefore reduces to
 * "cover every requirement with as few areas as possible", and a route that
 * contains a redundant area is never worth showing.
 *
 * Requirements keep the recipe's OR structure: an item is obtained either by
 * gathering it in an area that holds enough of it, or by crafting it from its
 * ingredients — so a route may satisfy a craftable material directly, or through
 * its children. Quantities are honoured end to end: `2x Scrap Metal` needs areas
 * whose stacks add up to two.
 */

/** One material to pick up at a stop, with the stack sitting in that area. */
export interface RouteCollection {
  item: WikiItem;
  /** Stack size in this area. */
  available: number;
  /** How much of that stack the route actually needs. */
  quantity: number;
}

/** One area of a route, in visit order. */
export interface RouteStop {
  area: WikiArea;
  /** Materials gathered here; empty only for a data quirk (see `buildRoutes`). */
  collects: RouteCollection[];
}

export interface RoutePlan {
  /** Stable key: the area ids in visit order, joined. */
  id: string;
  stops: RouteStop[];
  areaIds: string[];
  /** Areas walked between: every hop costs the same, so this is the ranking metric. */
  moves: number;
  /**
   * Straight-line length of the drawn path in map pixels. It does **not** affect
   * travel time (every hop is equal); it only picks the tidier line among routes
   * that already need the same number of moves, and shapes the stop order.
   */
  walkDistance: number;
  /** Distinct materials the route ends up gathering. */
  materialCount: number;
}

/** A requirement node: gather the item, or craft it from `children`. */
interface Requirement {
  item: WikiItem;
  /** Effective quantity required, summed across diamond paths upstream. */
  quantity: number;
  /** Non-empty only when the item is craftable within the tree's depth budget. */
  children: Requirement[] | null;
}

/**
 * Above this many candidate areas the subset sweep is skipped for a greedy
 * search. The current dataset peaks at 14 (`h_fu`), so the sweep always runs —
 * the guard only keeps a future, denser dataset from stalling the UI.
 */
const MAX_EXHAUSTIVE_AREAS = 16;

function toRequirement(node: RecipeNode): Requirement {
  const children =
    node.expanded && node.children.length > 0 ? node.children.map(toRequirement) : null;
  return { item: node.item, quantity: node.quantity, children };
}

/** Every item id the tree can ask for, gathered or crafted. */
function collectItemIds(requirement: Requirement, ids: Set<string>): void {
  ids.add(requirement.item.id);
  for (const child of requirement.children ?? []) collectItemIds(child, ids);
}

/** Mapped areas holding at least one item the tree can ask for. */
function candidateAreas(dataset: WikiDataset, requirement: Requirement): WikiArea[] {
  const ids = new Set<string>();
  collectItemIds(requirement, ids);

  const areas = new Map<string, WikiArea>();
  for (const id of ids) {
    for (const ref of dataset.spawnsByItemId[id] ?? []) {
      const area = dataset.areasById[ref.areaId];
      if (area?.mapped) areas.set(area.id, area);
    }
  }

  return [...areas.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Stack sizes already chosen for one item, summed over the picked areas. */
function gatheredQuantity(
  dataset: WikiDataset,
  itemId: string,
  chosen: Set<string>,
): number {
  let total = 0;
  for (const ref of dataset.spawnsByItemId[itemId] ?? []) {
    if (chosen.has(ref.areaId)) total += ref.quantity;
  }
  return total;
}

function satisfies(requirement: Requirement, chosen: Set<string>, dataset: WikiDataset): boolean {
  if (gatheredQuantity(dataset, requirement.item.id, chosen) >= requirement.quantity) return true;
  if (!requirement.children) return false;
  return requirement.children.every((child) => satisfies(child, chosen, dataset));
}

/* -------------------------------------------------------------------------- */
/* Cover search                                                                */
/* -------------------------------------------------------------------------- */

function* combinations(count: number, size: number): Generator<number[]> {
  const indices = Array.from({ length: size }, (_, index) => index);
  while (true) {
    yield indices;
    let position = size - 1;
    while (position >= 0 && indices[position] === count - size + position) position -= 1;
    if (position < 0) return;
    indices[position] += 1;
    for (let next = position + 1; next < size; next += 1) indices[next] = indices[next - 1] + 1;
  }
}

/**
 * Every inclusion-minimal cover, smallest first. A cover is minimal when no
 * smaller one sits inside it — those are exactly the routes worth showing, since
 * adding areas only ever costs more moves.
 */
function minimalCovers(
  candidates: WikiArea[],
  isCover: (chosen: Set<string>) => boolean,
): WikiArea[][] {
  const accepted: WikiArea[][] = [];

  for (let size = 1; size <= candidates.length; size += 1) {
    for (const combo of combinations(candidates.length, size)) {
      const chosen = new Set(combo.map((index) => candidates[index].id));
      const contained = accepted.some(
        (smaller) => smaller.length < size && smaller.every((area) => chosen.has(area.id)),
      );
      if (contained) continue;
      if (isCover(chosen)) accepted.push(combo.map((index) => candidates[index]));
    }
  }

  return accepted;
}

/**
 * Fallback for datasets too wide to sweep: from every starting area, keep adding
 * whatever covers the most outstanding requirements. Bounded by the candidate
 * count, and still filtered down to minimal covers.
 */
function greedyCovers(
  candidates: WikiArea[],
  missing: (chosen: Set<string>) => number,
): WikiArea[][] {
  const accepted: WikiArea[][] = [];

  for (const start of candidates) {
    const chosen: WikiArea[] = [start];
    const chosenIds = new Set([start.id]);
    let outstanding = missing(chosenIds);

    while (outstanding > 0 && chosen.length < candidates.length) {
      let best: WikiArea | null = null;
      let bestMissing = outstanding;
      for (const candidate of candidates) {
        if (chosenIds.has(candidate.id)) continue;
        const next = new Set(chosenIds);
        next.add(candidate.id);
        const score = missing(next);
        if (score < bestMissing) {
          bestMissing = score;
          best = candidate;
        }
      }
      if (!best) break;
      chosen.push(best);
      chosenIds.add(best.id);
      outstanding = bestMissing;
    }

    if (outstanding === 0) accepted.push(chosen);
  }

  return accepted.filter(
    (cover) =>
      !accepted.some(
        (other) => other.length < cover.length && other.every((area) => cover.includes(area)),
      ),
  );
}

/* -------------------------------------------------------------------------- */
/* Stop ordering                                                               */
/* -------------------------------------------------------------------------- */

function anchorDistance(a: WikiArea, b: WikiArea): number {
  return Math.hypot(a.anchor.x - b.anchor.x, a.anchor.y - b.anchor.y);
}

function pathDistance(areas: WikiArea[]): number {
  let total = 0;
  for (let index = 1; index < areas.length; index += 1) {
    total += anchorDistance(areas[index - 1], areas[index]);
  }
  return total;
}

function nearestNeighbour(areas: WikiArea[], startIndex: number): WikiArea[] {
  const remaining = [...areas];
  const order = [remaining.splice(startIndex, 1)[0]];

  while (remaining.length > 0) {
    const last = order[order.length - 1];
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let index = 0; index < remaining.length; index += 1) {
      const distance = anchorDistance(last, remaining[index]);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    order.push(remaining.splice(bestIndex, 1)[0]);
  }

  return order;
}

/** Open-path 2-opt: reverse any stretch that shortens the line. */
function twoOpt(areas: WikiArea[]): WikiArea[] {
  const order = [...areas];
  let improved = true;
  let sweeps = 0;

  while (improved && sweeps < 40) {
    improved = false;
    sweeps += 1;
    for (let start = 0; start < order.length - 1; start += 1) {
      for (let end = start + 1; end < order.length; end += 1) {
        const candidate = [...order];
        candidate.splice(start, end - start + 1, ...order.slice(start, end + 1).reverse());
        if (pathDistance(candidate) < pathDistance(order) - 1e-9) {
          for (let index = 0; index < order.length; index += 1) order[index] = candidate[index];
          improved = true;
        }
      }
    }
  }

  return order;
}

/**
 * Visit order for one cover. Travel time is identical whatever the order, so
 * this only decides which way the line is drawn and which stops are listed
 * first — nearest-neighbour from every start, then 2-opt.
 */
function bestOrder(areas: WikiArea[]): { order: WikiArea[]; distance: number } {
  if (areas.length <= 1) return { order: [...areas], distance: 0 };

  let best: { order: WikiArea[]; distance: number } | null = null;
  for (let start = 0; start < areas.length; start += 1) {
    const order = twoOpt(nearestNeighbour(areas, start));
    const distance = pathDistance(order);
    if (!best || distance < best.distance - 1e-9) best = { order, distance };
  }

  return best ?? { order: [...areas], distance: pathDistance(areas) };
}

/* -------------------------------------------------------------------------- */
/* Route assembly                                                              */
/* -------------------------------------------------------------------------- */

type Picks = Map<string, Map<string, RouteCollection>>;

function addPick(
  picks: Picks,
  areaId: string,
  item: WikiItem,
  available: number,
  quantity: number,
): void {
  let forArea = picks.get(areaId);
  if (!forArea) {
    forArea = new Map();
    picks.set(areaId, forArea);
  }
  const existing = forArea.get(item.id);
  if (existing) {
    existing.quantity += quantity;
    return;
  }
  forArea.set(item.id, { item, available, quantity });
}

/**
 * Decides what is picked up where, mirroring {@link satisfies}: fill the
 * requirement from the route's stacks when they are big enough, otherwise walk
 * into the ingredients and gather those instead.
 *
 * `visitOrder` only drives which stop gets credited first, so the earliest stops
 * carry the materials they can actually supply.
 */
function resolvePicks(
  requirement: Requirement,
  visitOrder: WikiArea[],
  picks: Picks,
  dataset: WikiDataset,
): void {
  const refs = visitOrder
    .map((area) => {
      const ref = (dataset.spawnsByItemId[requirement.item.id] ?? []).find(
        (spawn) => spawn.areaId === area.id,
      );
      return ref ? { areaId: area.id, quantity: ref.quantity } : null;
    })
    .filter((ref): ref is { areaId: string; quantity: number } => ref !== null);

  const total = refs.reduce((sum, ref) => sum + ref.quantity, 0);
  if (total >= requirement.quantity) {
    let remaining = requirement.quantity;
    for (const ref of refs) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, ref.quantity);
      addPick(picks, ref.areaId, requirement.item, ref.quantity, take);
      remaining -= take;
    }
    return;
  }

  for (const child of requirement.children ?? []) {
    resolvePicks(child, visitOrder, picks, dataset);
  }
}

function toRoute(
  dataset: WikiDataset,
  requirement: Requirement,
  cover: WikiArea[],
): RoutePlan {
  const { order, distance } = bestOrder(cover);
  const picks: Picks = new Map();
  resolvePicks(requirement, order, picks, dataset);

  const stops: RouteStop[] = order.map((area) => ({
    area,
    collects: [...(picks.get(area.id)?.values() ?? [])].sort((a, b) =>
      a.item.name.localeCompare(b.item.name),
    ),
  }));

  const materialIds = new Set<string>();
  for (const stop of stops) for (const collection of stop.collects) materialIds.add(collection.item.id);

  return {
    id: order.map((area) => area.id).join("+"),
    stops,
    areaIds: order.map((area) => area.id),
    moves: order.length - 1,
    walkDistance: Math.round(distance),
    materialCount: materialIds.size,
  };
}

/**
 * Fewest areas needed to obtain `tree`'s root item, sorted fastest first.
 *
 * Returns every inclusion-minimal cover (a route with a spare area is strictly
 * slower, so it is left out), best-first: fewest moves, then the tidiest line,
 * then a stable name order.
 */
export function buildRoutes(dataset: WikiDataset, tree: RecipeNode | null): RoutePlan[] {
  if (!tree) return [];

  const requirement = toRequirement(tree);
  const candidates = candidateAreas(dataset, requirement);
  if (candidates.length === 0) return [];

  const isCover = (chosen: Set<string>) => satisfies(requirement, chosen, dataset);
  const covers =
    candidates.length <= MAX_EXHAUSTIVE_AREAS
      ? minimalCovers(candidates, isCover)
      : greedyCovers(candidates, (chosen) => countMissing(requirement, chosen, dataset));

  return covers
    .map((cover) => toRoute(dataset, requirement, cover))
    .sort(
      (a, b) =>
        a.moves - b.moves ||
        a.walkDistance - b.walkDistance ||
        a.areaIds.join().localeCompare(b.areaIds.join()),
    );
}

/** How many requirement nodes are still unsatisfied — the greedy objective. */
function countMissing(
  requirement: Requirement,
  chosen: Set<string>,
  dataset: WikiDataset,
): number {
  if (satisfies(requirement, chosen, dataset)) return 0;
  if (!requirement.children) {
    return gatheredQuantity(dataset, requirement.item.id, chosen) >= requirement.quantity ? 0 : 1;
  }
  return requirement.children.reduce(
    (total, child) => total + countMissing(child, chosen, dataset),
    0,
  );
}
