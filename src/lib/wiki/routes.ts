import {
  BAG_SLOTS,
  equipmentSlotFor,
  planWeaponTypes,
  type EquipmentSlot,
} from "./inventory";
import type { RecipeNode, WikiArea, WikiDataset, WikiItem } from "./types";

/**
 * Route planning: the fewest areas you must visit to obtain one or more items.
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
 *
 * Several items (the bookmarks, plus whatever is selected) simply stack: every
 * tree contributes its own requirements and a route has to satisfy all of them.
 */

/** One material to pick up at a stop, with the stack sitting in that area. */
export interface RouteCollection {
  item: WikiItem;
  /** Stack size in this area. */
  available: number;
  /** How much of that stack the route actually needs. */
  quantity: number;
}

/** An item produced at a stop. */
export interface RouteCraft {
  item: WikiItem;
  quantity: number;
}

/**
 * One thing that happens at a stop, in the order it happens.
 *
 * The order is load-bearing, not decoration: with deep recipes the pack can fill
 * up, and whether a pickup fits depends on what was built just before it. Keeping
 * the real sequence is what lets the step be followed — and checked — exactly.
 */
export type StepAction =
  | { kind: "gather"; collection: RouteCollection }
  | { kind: "craft"; craft: RouteCraft };

/** One area of a route, in visit order, with what happens there. */
export interface RouteStep {
  /** 1-based position along the route. */
  number: number;
  area: WikiArea;
  /** Every pickup and build at this stop, in the order they happen. */
  actions: StepAction[];
  /** Bag slots in use when leaving this area; worn items do not count. */
  bagUsed: number;
  /** Items worn by the time the survivor leaves this area. */
  equipped: WikiItem[];
}

/** Materials picked up at a stop, one entry per item, in first-pickup order. */
export function stepGathers(step: RouteStep): RouteCollection[] {
  const byItem = new Map<string, RouteCollection>();
  for (const action of step.actions) {
    if (action.kind !== "gather") continue;
    const existing = byItem.get(action.collection.item.id);
    if (existing) existing.quantity += action.collection.quantity;
    else byItem.set(action.collection.item.id, { ...action.collection });
  }
  return [...byItem.values()];
}

/** Items built at a stop, one entry per item, in first-build order. */
export function stepCrafts(step: RouteStep): RouteCraft[] {
  const byItem = new Map<string, RouteCraft>();
  for (const action of step.actions) {
    if (action.kind !== "craft") continue;
    const existing = byItem.get(action.craft.item.id);
    if (existing) existing.quantity += action.craft.quantity;
    else byItem.set(action.craft.item.id, { ...action.craft });
  }
  return [...byItem.values()];
}

export interface RoutePlan {
  /** Stable key: the area ids in visit order, joined. */
  id: string;
  steps: RouteStep[];
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
  /** Distinct items the route ends up building, targets included. */
  craftCount: number;
  /**
   * Value worn, summed over the look-ahead window — the greedy ranking metric.
   * Counts each step's kit again, so value that arrives earlier scores higher.
   */
  greedyScore: number;
}

/**
 * How routes are ranked.
 *
 *  - `fastest` cares only about the walk: fewest areas, then the tidiest line.
 *  - `greedy` cares about being strong early. In this game a survivor who hauls
 *    every ingredient to one spot and crafts at the end spends the whole trip
 *    naked, so greedy ranks by the value *worn* across the next few areas
 *    instead: arriving at area 3 already holding a knife beats arriving at area
 *    3 with a bag of scrap, even if both finish at the same time.
 */
export type RouteMode = "fastest" | "greedy";

export interface RouteOptions {
  /**
   * Clothes the survivor is already wearing on the first move, or `null`. It
   * satisfies requirements for that item for free, occupies the clothes slot
   * from the start (so it costs no bag space) and can still be spent on a craft.
   */
  startingClothes?: string | null;
  /** Ranking mode; `fastest` by default. */
  mode?: RouteMode;
  /** How many areas greedy looks ahead, counting the first one. */
  lookAhead?: number;
}

/** Look-ahead window bounds for the greedy mode. */
export const DEFAULT_LOOK_AHEAD = 2;
export const MAX_LOOK_AHEAD = 6;

/**
 * Visit orders tried per cover in greedy mode. The order is what decides when
 * each part gets built, so greedy has to look at several instead of stopping at
 * the first workable one.
 */
const GREEDY_ORDERS_PER_COVER = 24;

export interface RoutePlanSet {
  /** Fastest first; `truncated` says whether more equal-or-slower ones exist. */
  routes: RoutePlan[];
  /** True when the search stopped at {@link MAX_ROUTES} rather than exhausting. */
  truncated: boolean;
  /**
   * True when areas covering the plan exist but the pack cannot hold the job:
   * every candidate route runs out of bag slots. Nothing to show but the reason.
   */
  inventoryBlocked: boolean;
  /**
   * Items the plan takes as already carried because nothing on the island can
   * supply them — no area holds them and no recipe makes them (Mithril, Meteorite,
   * creature drops, the rare finds). They walk in with the survivor.
   */
  assumed: WikiItem[];
  /** True when every requirement is one of those: there is nowhere to walk. */
  nothingToGather: boolean;
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
 * search. A single item peaks at 14 (`h_fu`) and bookmark sets reach ~20, so
 * the sweep almost always runs — the guard only keeps a future, denser dataset
 * from stalling the UI.
 */
const MAX_EXHAUSTIVE_AREAS = 20;

/**
 * Cap on the routes returned. A single item peaks at 84 (`h_fu`), and a wide
 * plan can offer hundreds of near-identical lists; the rail only ever shows the
 * fastest handful, so the search stops here and reports `truncated`.
 */
const MAX_ROUTES = 100;

/** Covers up to this width are tried in every visit order; wider ones sample. */
const MAX_PERMUTED_AREAS = 4;

/**
 * Route run-throughs allowed per `buildRoutes` call. The per-cover order search
 * is the only unbounded part of the pipeline, so a shared budget keeps a greedy
 * plan — ten items, hundreds of covers — from turning into seconds of work.
 */
const RUN_BUDGET = 8000;

function toRequirement(node: RecipeNode): Requirement {
  const children =
    node.expanded && node.children.length > 0 ? node.children.map(toRequirement) : null;
  return { item: node.item, quantity: node.quantity, children };
}

/** Every item id the trees can ask for, gathered or crafted. */
function collectItemIds(requirements: Requirement[], ids: Set<string>): void {
  const walk = (requirement: Requirement) => {
    ids.add(requirement.item.id);
    for (const child of requirement.children ?? []) walk(child);
  };
  for (const requirement of requirements) walk(requirement);
}

/**
 * True when the island can supply the item at all: some mapped area holds it.
 * Used to spot the components the dataset simply has no location for — creature
 * drops and random spawns — which a route takes as already in the pack.
 */
function gatherableOnMap(dataset: WikiDataset, itemId: string): boolean {
  return (dataset.spawnsByItemId[itemId] ?? []).some(
    (ref) => dataset.areasById[ref.areaId]?.mapped === true,
  );
}

/**
 * The items a plan has to be handed rather than find: nothing on the map holds
 * them and no recipe produces them, so the only honest reading is that the
 * survivor already carries them. Craftable items are never assumed — their
 * recipe is known, so they are made from their ingredients instead.
 */
function assumedItems(dataset: WikiDataset, requirements: Requirement[]): Map<string, WikiItem> {
  const assumed = new Map<string, WikiItem>();

  const walk = (requirement: Requirement) => {
    const { item } = requirement;
    if (!item.craftable && !gatherableOnMap(dataset, item.id)) assumed.set(item.id, item);
    for (const child of requirement.children ?? []) walk(child);
  };

  for (const requirement of requirements) walk(requirement);
  return assumed;
}

/** Mapped areas holding at least one item the trees can ask for. */
function candidateAreas(dataset: WikiDataset, requirements: Requirement[]): WikiArea[] {
  const ids = new Set<string>();
  collectItemIds(requirements, ids);

  const areas = new Map<string, WikiArea>();
  for (const id of ids) {
    for (const ref of dataset.spawnsByItemId[id] ?? []) {
      const area = dataset.areasById[ref.areaId];
      if (area?.mapped) areas.set(area.id, area);
    }
  }

  return [...areas.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Drops areas that can never be the better choice: if another area holds at
 * least as much of everything, swapping one for the other only ever adds stock,
 * so the weaker area is in no fastest route. Equal vectors keep the first name
 * and drop the rest, which is what makes this safe to use on wide datasets.
 */
function pruneDominated(dataset: WikiDataset, candidates: WikiArea[]): WikiArea[] {
  const stock = (areaId: string) => {
    const byItem = new Map<string, number>();
    for (const itemId of Object.keys(dataset.spawnsByItemId)) {
      for (const ref of dataset.spawnsByItemId[itemId]) {
        if (ref.areaId === areaId) byItem.set(itemId, ref.quantity);
      }
    }
    return byItem;
  };

  const stocks = new Map(candidates.map((area) => [area.id, stock(area.id)]));
  const coversAtLeast = (a: Map<string, number>, b: Map<string, number>) => {
    for (const [itemId, quantity] of b) {
      if ((a.get(itemId) ?? 0) < quantity) return false;
    }
    return true;
  };

  return candidates.filter(
    (area, index) =>
      !candidates.some(
        (other, otherIndex) =>
          otherIndex !== index &&
          coversAtLeast(stocks.get(other.id)!, stocks.get(area.id)!) &&
          // Equal vectors are a tie: keep the earlier (alphabetical) area only.
          (otherIndex < index || !coversAtLeast(stocks.get(area.id)!, stocks.get(other.id)!)),
      ),
  );
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

/* -------------------------------------------------------------------------- */
/* Cover search                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A requirement with its stock indexed by candidate area, so the search can ask
 * "does this set of areas satisfy it?" without building Sets or scanning spawn
 * lists. A candidate set is a bitmask, which is what keeps the sweep cheap.
 */
interface CompiledRequirement {
  quantity: number;
  /** Units already in hand before the first move (the starting clothes). */
  provided: number;
  /** `[candidate index, stack size]` for every candidate holding the item. */
  stock: Array<[number, number]>;
  children: CompiledRequirement[] | null;
}

function compileRequirement(
  requirement: Requirement,
  dataset: WikiDataset,
  indexByAreaId: Map<string, number>,
  startingClothes: string | null,
  assumed: ReadonlySet<string>,
): CompiledRequirement {
  const stock: Array<[number, number]> = [];
  for (const ref of dataset.spawnsByItemId[requirement.item.id] ?? []) {
    const index = indexByAreaId.get(ref.areaId);
    if (index !== undefined) stock.push([index, ref.quantity]);
  }

  return {
    quantity: requirement.quantity,
    provided:
      requirement.item.id === startingClothes || assumed.has(requirement.item.id) ? 1 : 0,
    stock,
    children:
      requirement.children?.map((child) =>
        compileRequirement(child, dataset, indexByAreaId, startingClothes, assumed),
      ) ?? null,
  };
}

function satisfiesMask(requirement: CompiledRequirement, mask: number): boolean {
  // The starting clothes count on every node of that item: a relaxation, so the
  // sweep can only ever admit a cover the run-through then has to confirm.
  let gathered = requirement.provided;
  for (const [index, quantity] of requirement.stock) {
    if (mask & (1 << index)) gathered += quantity;
  }
  if (gathered >= requirement.quantity) return true;
  return requirement.children?.every((child) => satisfiesMask(child, mask)) ?? false;
}

/** How many requirement nodes are still unsatisfied — the greedy objective. */
function missingMask(requirement: CompiledRequirement, mask: number): number {
  if (satisfiesMask(requirement, mask)) return 0;
  if (!requirement.children) return 1;
  return requirement.children.reduce((total, child) => total + missingMask(child, mask), 0);
}

/**
 * Every inclusion-minimal cover, smallest first, as area bitmasks.
 *
 * A cover is minimal when no smaller accepted one sits inside it — those are
 * exactly the routes worth showing, since adding areas only ever costs more
 * moves. Walking sizes upwards means the first covers found are the fastest, so
 * hitting {@link MAX_ROUTES} only ever drops slower ones.
 *
 * The mask trick only works while the candidates fit in a 32-bit integer, which
 * {@link MAX_EXHAUSTIVE_AREAS} guarantees.
 */
function sweepCovers(
  count: number,
  isCover: (mask: number) => boolean,
): { masks: number[]; truncated: boolean } {
  const accepted: number[] = [];
  const full = 1 << count;

  for (let size = 1; size <= count; size += 1) {
    let mask = (1 << size) - 1;

    // Gosper's hack: the next mask with the same number of bits set.
    while (mask < full) {
      // Cover first — most masks fail fast, and the subset test is not free.
      if (isCover(mask) && !accepted.some((smaller) => (smaller & ~mask) === 0)) {
        accepted.push(mask);
        if (accepted.length >= MAX_ROUTES) return { masks: accepted, truncated: true };
      }

      const lowest = mask & -mask;
      const next = mask + lowest;
      mask = (((next ^ mask) >> 2) / lowest) | next;
    }
  }

  return { masks: accepted, truncated: false };
}

/**
 * Fallback for datasets too wide to sweep: from every starting area, keep adding
 * whatever covers the most outstanding requirements. Bounded by the candidate
 * count, and still filtered down to minimal covers.
 */
function greedyCovers(count: number, missing: (mask: number) => number): number[] {
  const accepted: number[] = [];

  for (let start = 0; start < count; start += 1) {
    let mask = 1 << start;
    let outstanding = missing(mask);

    while (outstanding > 0) {
      let best = -1;
      let bestMissing = outstanding;

      for (let index = 0; index < count; index += 1) {
        if (mask & (1 << index)) continue;
        const score = missing(mask | (1 << index));
        if (score < bestMissing) {
          bestMissing = score;
          best = index;
        }
      }

      if (best < 0) break;
      mask |= 1 << best;
      outstanding = bestMissing;
    }

    if (outstanding === 0) accepted.push(mask);
  }

  return accepted.filter(
    (cover) => !accepted.some((other) => other !== cover && (other & ~cover) === 0),
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
/* -------------------------------------------------------------------------- */
/* Inventory-aware run-through                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The plan flattened into what has to be picked up and what has to be built.
 *
 * Sourcing is decided per route, exactly like the cover predicate: an item the
 * route's areas can supply in full is gathered, anything else is crafted from
 * its ingredients.
 */
interface SimPlan {
  /** Item id -> units that must be picked up somewhere on the route. */
  gather: Map<string, { item: WikiItem; quantity: number }>;
  /** Item id -> units that must be built. */
  craftNeed: Map<string, number>;
  /** One recipe entry per item that gets built, with its per-unit ingredient use. */
  recipes: Map<string, { item: WikiItem; children: Array<{ item: WikiItem; perUnit: number }> }>;
}

/** Stock of one item across the route's areas. */
function stockOnRoute(dataset: WikiDataset, itemId: string, chosen: Set<string>): number {
  let total = 0;
  for (const ref of dataset.spawnsByItemId[itemId] ?? []) {
    if (chosen.has(ref.areaId)) total += ref.quantity;
  }
  return total;
}

function compilePlan(
  requirements: Requirement[],
  chosen: Set<string>,
  dataset: WikiDataset,
  startingClothes: string | null,
  assumed: ReadonlyMap<string, WikiItem>,
): SimPlan {
  const plan: SimPlan = { gather: new Map(), craftNeed: new Map(), recipes: new Map() };

  // Units the survivor walks in with — the worn clothes and every component the
  // island cannot supply; each spent once, the first time that item is asked
  // for, so a plan wanting two of them still has to find the second.
  const inHand = new Map<string, number>();
  if (startingClothes) inHand.set(startingClothes, 1);
  for (const itemId of assumed.keys()) inHand.set(itemId, 1);

  const walk = (requirement: Requirement) => {
    const itemId = requirement.item.id;
    const spare = Math.min(inHand.get(itemId) ?? 0, requirement.quantity);
    if (spare > 0) inHand.set(itemId, (inHand.get(itemId) ?? 0) - spare);
    const needed = requirement.quantity - spare;
    if (needed <= 0) return;

    if (stockOnRoute(dataset, itemId, chosen) >= needed) {
      const existing = plan.gather.get(itemId);
      if (existing) existing.quantity += needed;
      else plan.gather.set(itemId, { item: requirement.item, quantity: needed });
      return;
    }

    const children = requirement.children ?? [];
    plan.craftNeed.set(itemId, (plan.craftNeed.get(itemId) ?? 0) + needed);
    if (!plan.recipes.has(itemId)) {
      plan.recipes.set(itemId, {
        item: requirement.item,
        // Every recipe entry is one unit in this dataset, so the per-unit need is
        // the child's share of this node's multiplier.
        children: children.map((child) => ({
          item: child.item,
          perUnit: Math.max(1, Math.round(child.quantity / Math.max(1, requirement.quantity))),
        })),
      });
    }
    for (const child of children) walk(child);
  };

  for (const requirement of requirements) walk(requirement);
  return plan;
}

/**
 * The pack as the run-through carries it.
 *
 * Six bag slots, plus whatever can be worn. Capacity is about *stacks*, not
 * units, so the only way to run out of room is to hold too many different
 * things — and a craft can do that too, not just a pickup: consuming one unit of
 * a five-unit stack frees no slot at all, while the item it produces wants one.
 * Every operation is therefore checked against a projected pack first.
 */
class Pack {
  private readonly held = new Map<string, number>();
  private readonly worn = new Map<EquipmentSlot, string>();

  /**
   * @param weaponTypes the weapon types this plan can wield. Empty means the
   *   survivor keeps the crude weapon they started with: the slot is taken, so
   *   nothing else may be stored there.
   */
  constructor(
    private readonly dataset: WikiDataset,
    private readonly weaponTypes: ReadonlySet<string> = new Set<string>(),
  ) {}

  /**
   * Whether the item may be worn at all. Gear always fits its own slot; a weapon
   * only fits if the plan is about that kind of weapon, since mastery cannot be
   * changed mid-match.
   */
  private canWear(item: WikiItem): boolean {
    const slot = equipmentSlotFor(item);
    if (!slot) return false;
    if (slot !== "weapon") return true;
    return item.types.some((type) => this.weaponTypes.has(type));
  }

  /** Walks in carrying one of these: bagged for now, worn later if it fits. */
  startHolding(itemId: string): void {
    this.held.set(itemId, (this.held.get(itemId) ?? 0) + 1);
  }

  /** Walks in already wearing the chosen clothes: one item, no bag slot. */
  startWearing(itemId: string): void {
    this.held.set(itemId, (this.held.get(itemId) ?? 0) + 1);
    const item = this.dataset.itemsById[itemId];
    if (!this.canWear(item)) return;
    const slot = equipmentSlotFor(item);
    if (slot && !this.worn.has(slot)) this.worn.set(slot, itemId);
  }

  private static bagCount(
    held: ReadonlyMap<string, number>,
    worn: ReadonlyMap<EquipmentSlot, string>,
  ): number {
    const wornIds = new Set(worn.values());
    let used = 0;
    for (const [id, units] of held) {
      if (units > 0 && !wornIds.has(id)) used += 1;
    }
    return used;
  }

  private project(mutate: (held: Map<string, number>) => void): number {
    const held = new Map(this.held);
    mutate(held);
    const worn = new Map(this.worn);
    for (const [slot, id] of worn) {
      if ((held.get(id) ?? 0) <= 0) worn.delete(slot);
    }
    return Pack.bagCount(held, worn);
  }

  quantity(itemId: string): number {
    return this.held.get(itemId) ?? 0;
  }

  bagUsed(): number {
    return Pack.bagCount(this.held, this.worn);
  }

  /** True when `units` more of the item would leave the pack within its limit. */
  canAdd(itemId: string, units: number): boolean {
    if (this.quantity(itemId) > 0) return true;
    return this.project((held) => held.set(itemId, units)) <= BAG_SLOTS;
  }

  add(itemId: string, units: number): void {
    this.held.set(itemId, (this.held.get(itemId) ?? 0) + units);
  }

  /** Removes units; returns false when the pack does not hold that many. */
  take(itemId: string, units: number): boolean {
    const have = this.held.get(itemId) ?? 0;
    if (have < units) return false;
    const left = have - units;
    this.held.set(itemId, left);
    if (left === 0) {
      for (const [slot, id] of this.worn) if (id === itemId) this.worn.delete(slot);
    }
    return true;
  }

  /** True when crafting one unit would leave the pack within its limit. */
  canCraft(recipe: { item: WikiItem; children: Array<{ item: WikiItem; perUnit: number }> }): boolean {
    return (
      this.project((held) => {
        for (const child of recipe.children) {
          held.set(child.item.id, (held.get(child.item.id) ?? 0) - child.perUnit);
        }
        held.set(recipe.item.id, (held.get(recipe.item.id) ?? 0) + 1);
      }) <= BAG_SLOTS
    );
  }

  craft(recipe: { item: WikiItem; children: Array<{ item: WikiItem; perUnit: number }> }): void {
    for (const child of recipe.children) this.take(child.item.id, child.perUnit);
    this.add(recipe.item.id, 1);
  }

  /** Wears everything that fits; packing an item away can only free space. */
  equipWhatFits(): void {
    const wornIds = new Set(this.worn.values());
    for (const [id, units] of this.held) {
      if (units <= 0 || wornIds.has(id)) continue;
      const item = this.dataset.itemsById[id];
      if (!this.canWear(item)) continue;
      const slot = equipmentSlotFor(item);
      if (slot && !this.worn.has(slot)) {
        this.worn.set(slot, id);
        wornIds.add(id);
      }
    }
  }

  wornItems(): WikiItem[] {
    return [...this.worn.values()]
      .map((id) => this.dataset.itemsById[id])
      .filter((item): item is WikiItem => item !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}

/**
 * Walks one area order, gathering and building as it goes.
 *
 * The rule is *build as soon as the ingredients are in the pack*, which is both
 * what frees bag space (two ingredients become one item) and what the route list
 * shows at each step. Nothing is ever packed beyond six bag slots; gear that can
 * be worn is worn to make room, and gear whose slot is taken just sits in the bag.
 *
 * Returns `null` when the order cannot finish the plan — either an area holding
 * something still needed had no room for it, or a craft never became possible.
 */
function runRoute(
  dataset: WikiDataset,
  plan: SimPlan,
  order: WikiArea[],
  startingClothes: string | null,
  assumed: ReadonlyMap<string, WikiItem>,
  weaponTypes: ReadonlySet<string>,
): RouteStep[] | null {
  const pack = new Pack(dataset, weaponTypes);
  if (startingClothes && dataset.itemsById[startingClothes]) pack.startWearing(startingClothes);
  // Rare components are carried from the first move; they take bag slots like
  // anything else, and get worn at the first stop if they are equipment.
  for (const itemId of assumed.keys()) pack.startHolding(itemId);
  const gathered = new Map<string, number>();
  const crafted = new Map<string, number>();
  const steps: RouteStep[] = [];

  for (let index = 0; index < order.length; index += 1) {
    const area = order[index];
    const actions: StepAction[] = [];

    // What this area holds, spent down as it is picked from: a step visits the
    // area once, so a second pass must not draw the same stack again.
    const stock = new Map<string, number>();
    for (const spawn of area.spawns) {
      stock.set(spawn.itemId, (stock.get(spawn.itemId) ?? 0) + spawn.quantity);
    }

    // Everything that can happen here, in repeated passes: a craft frees the
    // slots that let the next pickup happen, and a pickup enables the next craft.
    for (;;) {
      let progressed = false;
      pack.equipWhatFits();

      // Builds come first: they are what makes room for the next pickup.
      for (const [itemId, recipe] of plan.recipes) {
        const need = plan.craftNeed.get(itemId) ?? 0;
        if ((crafted.get(itemId) ?? 0) >= need) continue;
        if (!recipe.children.every((child) => pack.quantity(child.item.id) >= child.perUnit)) continue;
        if (!pack.canCraft(recipe)) continue;

        pack.craft(recipe);
        crafted.set(itemId, (crafted.get(itemId) ?? 0) + 1);
        actions.push({ kind: "craft", craft: { item: recipe.item, quantity: 1 } });
        progressed = true;
      }

      for (const [itemId, need] of plan.gather) {
        const collected = gathered.get(itemId) ?? 0;
        const outstanding = need.quantity - collected;
        if (outstanding <= 0) continue;

        const available = stock.get(itemId) ?? 0;
        if (available <= 0) continue;

        const units = Math.min(outstanding, available);
        if (!pack.canAdd(itemId, units)) continue;

        pack.add(itemId, units);
        gathered.set(itemId, collected + units);
        stock.set(itemId, available - units);
        actions.push({
          kind: "gather",
          collection: { item: need.item, available, quantity: units },
        });
        progressed = true;
      }

      if (!progressed) break;
    }

    steps.push({
      number: index + 1,
      area,
      actions,
      bagUsed: pack.bagUsed(),
      equipped: pack.wornItems(),
    });
  }

  for (const [itemId, need] of plan.gather) {
    if ((gathered.get(itemId) ?? 0) < need.quantity) return null;
  }
  for (const [itemId, need] of plan.craftNeed) {
    if ((crafted.get(itemId) ?? 0) < need) return null;
  }

  return steps;
}

/* -------------------------------------------------------------------------- */
/* Route assembly                                                              */
/* -------------------------------------------------------------------------- */

/** What one step leaves the survivor wearing, in the item's own `value` terms. */
function wornValue(step: RouteStep): number {
  return step.equipped.reduce((total, item) => total + (item.value ?? 0), 0);
}

/**
 * Headline greedy number: the first entry of the profile — the most value the
 * survivor can be wearing within N areas of the start. Ranking uses the whole
 * profile; this is what the list can quote as a single figure.
 */
function greedyScore(steps: RouteStep[], lookAhead: number): number {
  return greedyProfile(steps, lookAhead)[0] ?? 0;
}

/**
 * The greedy reading of a route: at *every* step, the most the survivor can be
 * wearing within the look-ahead window that starts there.
 *
 * Applied at each step rather than once at the start, because the decision being
 * modelled is made at each step — "from here, where do the next N areas leave
 * me?" — and a route that is strong early but then plods through five areas of
 * gathering before its next upgrade is exactly what greedy is meant to avoid.
 * Worn value only ever drops when an ingredient is spent, so this is close to a
 * running maximum, but it is computed from the real curve either way.
 */
function greedyProfile(steps: RouteStep[], lookAhead: number): number[] {
  const curve = steps.map(wornValue);
  if (curve.length === 0) return [];

  // Past the last area the survivor simply keeps what they are wearing, so a
  // window that runs off the end reads as the final kit rather than as nothing.
  const final = curve[curve.length - 1];
  const at = (index: number) => (index < curve.length ? curve[index] : final);

  return curve.map((_, index) => {
    let peak = 0;
    for (let ahead = index; ahead < index + lookAhead; ahead += 1) {
      peak = Math.max(peak, at(ahead));
    }
    return peak;
  });
}

/**
 * Positive when `a` is the greedier profile: compared step by step from the start.
 *
 * A shorter profile is padded with its own last entry — a route that has ended
 * keeps its kit — so a longer walk never wins merely by having more steps to
 * compare. Otherwise a four-move detour would outrank a two-move route with an
 * identical curve simply because its profile has more entries.
 */
function compareProfiles(a: number[], b: number[]): number {
  const at = (profile: number[], index: number) =>
    profile.length === 0 ? 0 : profile[Math.min(index, profile.length - 1)];

  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = at(a, index) - at(b, index);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * The greedy key of a walk: the profile at the chosen window, then the profiles
 * that narrower windows would have produced, widest first.
 *
 * One window cannot break its own ties, and those ties are not draws. Of two walks
 * worth the same after two areas — "0 then 35" against "5 then 35" — the second is
 * plainly the greedier, and the second area is exactly what hides it: inside a
 * two-area window both peak at 35. Asking the one-area question settles it, which
 * is what makes a wider look-ahead *refine* a narrower one rather than contradict
 * it: the same walk that a one-area look-ahead would have chosen keeps winning,
 * because there is nothing in the extra patience to prefer the other one.
 */
function greedyKey(steps: RouteStep[], lookAhead: number): number[][] {
  const windows: number[][] = [];
  for (let window = lookAhead; window >= 1; window -= 1) {
    windows.push(greedyProfile(steps, window));
  }
  return windows;
}

/** Positive when `a` is the greedier walk: widest window first, then narrower ones. */
function compareKeys(a: number[][], b: number[][]): number {
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    const difference = compareProfiles(a[index], b[index]);
    if (difference !== 0) return difference;
  }
  return 0;
}

/**
 * Greedy ordering: the better greedy key first, then the shorter walk.
 *
 * Profiles are compared from the first step, so strength at the start outranks
 * strength later, and the window decides how much patience each step is allowed.
 * The key's narrower windows are the tie-break — see {@link greedyKey} — and only
 * a walk that is as greedy at *every* window falls through to distance.
 */
function compareGreedy(a: RoutePlan, b: RoutePlan, lookAhead: number): number {
  const keys = compareKeys(greedyKey(a.steps, lookAhead), greedyKey(b.steps, lookAhead));
  if (keys !== 0) return -keys;

  return (
    a.moves - b.moves ||
    a.walkDistance - b.walkDistance ||
    a.areaIds.join().localeCompare(b.areaIds.join())
  );
}

function toRoute(cover: WikiArea[], order: WikiArea[], steps: RouteStep[]): RoutePlan {
  const materials = new Set<string>();
  const crafts = new Set<string>();
  for (const step of steps) {
    for (const collection of stepGathers(step)) materials.add(collection.item.id);
    for (const built of stepCrafts(step)) crafts.add(built.item.id);
  }

  return {
    id: order.map((area) => area.id).join("+"),
    steps,
    areaIds: order.map((area) => area.id),
    moves: order.length - 1,
    walkDistance: Math.round(pathDistance(order)),
    materialCount: materials.size,
    craftCount: crafts.size,
    greedyScore: 0,
  };
}

/** Every permutation of `indices`, lexicographic — deterministic. */
function* permutations(indices: number[]): Generator<number[]> {
  const current = [...indices];
  yield current;

  for (;;) {
    let position = current.length - 2;
    while (position >= 0 && current[position] >= current[position + 1]) position -= 1;
    if (position < 0) return;

    let swap = current.length - 1;
    while (current[swap] <= current[position]) swap -= 1;
    [current[position], current[swap]] = [current[swap], current[position]];
    for (let left = position + 1, right = current.length - 1; left < right; left += 1, right -= 1) {
      [current[left], current[right]] = [current[right], current[left]];
    }
    yield current;
  }
}

/** Shuffles deterministically, so the same plan always offers the same routes. */
function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let state = seed;
  for (let index = out.length - 1; index > 0; index -= 1) {
    state = (state * 1103515245 + 12345) % 2147483648;
    const swap = state % (index + 1);
    [out[index], out[swap]] = [out[swap], out[index]];
  }
  return out;
}

/**
 * Orders worth trying for one cover, tidiest first.
 *
 * Travel time is the same whichever way round the same areas are visited, so the
 * order only matters for the *pack*: which ingredients are in hand when. Tiny
 * covers get the full permutation treatment; wider ones get a bounded sample of
 * nearest-neighbour sweeps, rotations of the tidiest line and shuffles, all
 * sharing one budget with every other cover so a greedy plan cannot stall the UI.
 */
function* orderings(cover: WikiArea[], budget: { left: number }): Generator<WikiArea[]> {
  const tidiest = bestOrder(cover).order;
  budget.left -= 1;
  yield tidiest;
  if (cover.length <= 1) return;

  const candidates: WikiArea[][] = [];
  if (cover.length <= MAX_PERMUTED_AREAS) {
    for (const permutation of permutations(cover.map((_, index) => index))) {
      candidates.push(permutation.map((index) => cover[index]));
    }
  } else {
    for (let start = 0; start < cover.length; start += 1) {
      candidates.push(twoOpt(nearestNeighbour(cover, start)));
    }
    for (let offset = 1; offset < cover.length; offset += 1) {
      candidates.push([...tidiest.slice(offset), ...tidiest.slice(0, offset)]);
    }
    for (let seed = 1; seed <= 48; seed += 1) candidates.push(shuffle(cover, seed));
  }

  for (const candidate of candidates) {
    if (budget.left <= 0) return;
    budget.left -= 1;
    yield candidate;
  }
}

/**
 * Fewest areas needed to obtain every item behind `trees`, sorted fastest first.
 *
 * Returns every inclusion-minimal cover that a survivor can actually walk: a
 * route with a spare area is strictly slower, so it is left out, and so is any
 * cover whose plan cannot fit the pack in any order. Best-first: fewest moves,
 * then the tidiest line, then a stable name order. At most {@link MAX_ROUTES}
 * come back — the fastest ones, with `truncated` telling the UI more exist.
 */
export function buildRoutes(
  dataset: WikiDataset,
  trees: RecipeNode[],
  options: RouteOptions = {},
): RoutePlanSet {
  const empty: RoutePlanSet = {
    routes: [],
    truncated: false,
    inventoryBlocked: false,
    assumed: [],
    nothingToGather: false,
  };
  if (trees.length === 0) return empty;

  const startingClothes =
    options.startingClothes && dataset.itemsById[options.startingClothes]
      ? options.startingClothes
      : null;

  const greedy = options.mode === "greedy";
  const lookAhead = Math.min(
    Math.max(1, Math.round(options.lookAhead ?? DEFAULT_LOOK_AHEAD)),
    MAX_LOOK_AHEAD,
  );

  const requirements = trees.map(toRequirement);
  const assumed = assumedItems(dataset, requirements);
  // What the plan can wield: weapon mastery cannot change mid-match, so only the
  // kinds of weapon the plan is about may ever fill the weapon slot.
  const weaponTypes = planWeaponTypes(trees.map((tree) => tree.item));
  const candidates = candidateAreas(dataset, requirements);

  // Nothing on the island is worth visiting: the whole plan is either worn or
  // carried already, so there is no walk to plan.
  if (candidates.length === 0) {
    return { ...empty, assumed: [...assumed.values()], nothingToGather: assumed.size > 0 };
  }

  // Only when the sweep would be expensive: dropping areas another one beats
  // removes options that could never appear in a fastest route anyway.
  let visited = candidates;
  if (visited.length > MAX_EXHAUSTIVE_AREAS) {
    const pruned = pruneDominated(dataset, visited);
    if (pruned.length > 0) visited = pruned;
  }

  const assumedIds = new Set(assumed.keys());
  const indexByAreaId = new Map(visited.map((area, index) => [area.id, index]));
  const compiled = requirements.map((requirement) =>
    compileRequirement(requirement, dataset, indexByAreaId, startingClothes, assumedIds),
  );

  const isCover = (mask: number) => compiled.every((requirement) => satisfiesMask(requirement, mask));
  const missing = (mask: number) =>
    compiled.reduce((total, requirement) => total + missingMask(requirement, mask), 0);

  const { masks, truncated } =
    visited.length <= MAX_EXHAUSTIVE_AREAS
      ? sweepCovers(visited.length, isCover)
      : { masks: greedyCovers(visited.length, missing), truncated: false };

  const routes: RoutePlan[] = [];
  const budget = { left: RUN_BUDGET };

  for (const mask of masks) {
    const cover = visited.filter((_, index) => mask & (1 << index));
    const chosen = new Set(cover.map((area) => area.id));
    const plan = compilePlan(requirements, chosen, dataset, startingClothes, assumed);

    // Fastest stops at the first order that works. Greedy keeps looking, because
    // the order decides how early each part gets built and therefore how early
    // the survivor is worth anything.
    let best: { order: WikiArea[]; steps: RouteStep[]; key: number[][] } | null = null;
    let tried = 0;

    for (const order of orderings(cover, budget)) {
      const steps = runRoute(dataset, plan, order, startingClothes, assumed, weaponTypes);
      if (!steps) continue;

      if (!greedy) {
        best = { order, steps, key: [] };
        break;
      }

      const key = greedyKey(steps, lookAhead);
      if (!best || compareKeys(key, best.key) > 0) best = { order, steps, key };
      tried += 1;
      if (tried >= GREEDY_ORDERS_PER_COVER) break;
    }

    if (best) {
      const route = toRoute(cover, best.order, best.steps);
      routes.push({ ...route, greedyScore: greedyScore(best.steps, lookAhead) });
    }
    if (routes.length >= MAX_ROUTES || budget.left <= 0) break;
  }

  routes.sort(
    greedy
      ? (a, b) => compareGreedy(a, b, lookAhead)
      : (a, b) =>
          a.moves - b.moves ||
          a.walkDistance - b.walkDistance ||
          a.areaIds.join().localeCompare(b.areaIds.join()),
  );

  return {
    routes,
    truncated: truncated || routes.length >= MAX_ROUTES,
    // Covers exist but none of them can be walked with six bag slots.
    inventoryBlocked: routes.length === 0 && masks.length > 0,
    assumed: [...assumed.values()].sort((a, b) => a.name.localeCompare(b.name)),
    nothingToGather: false,
  };
}
