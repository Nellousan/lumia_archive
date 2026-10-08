import { BAG_SLOTS, equipmentSlotFor, type EquipmentSlot } from "./inventory";
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

/** One area of a route, in visit order, with what happens there. */
export interface RouteStep {
  /** 1-based position along the route. */
  number: number;
  area: WikiArea;
  /** Materials picked up here. */
  gather: RouteCollection[];
  /** Items built here, in the order the survivor builds them. */
  craft: RouteCraft[];
  /** Bag slots in use when leaving this area; worn items do not count. */
  bagUsed: number;
  /** Items worn by the time the survivor leaves this area. */
  equipped: WikiItem[];
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
}

export interface RouteOptions {
  /**
   * Clothes the survivor is already wearing on the first move, or `null`. It
   * satisfies requirements for that item for free, occupies the clothes slot
   * from the start (so it costs no bag space) and can still be spent on a craft.
   */
  startingClothes?: string | null;
}

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
): CompiledRequirement {
  const stock: Array<[number, number]> = [];
  for (const ref of dataset.spawnsByItemId[requirement.item.id] ?? []) {
    const index = indexByAreaId.get(ref.areaId);
    if (index !== undefined) stock.push([index, ref.quantity]);
  }

  return {
    quantity: requirement.quantity,
    provided: requirement.item.id === startingClothes ? 1 : 0,
    stock,
    children:
      requirement.children?.map((child) =>
        compileRequirement(child, dataset, indexByAreaId, startingClothes),
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
): SimPlan {
  const plan: SimPlan = { gather: new Map(), craftNeed: new Map(), recipes: new Map() };

  // Units the survivor walks in with; spent once, the first time that item is
  // asked for, so a plan wanting two of them still has to find the second.
  const inHand = new Map<string, number>();
  if (startingClothes) inHand.set(startingClothes, 1);

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

  constructor(private readonly dataset: WikiDataset) {}

  /** Walks in already wearing the chosen clothes: one item, no bag slot. */
  startWearing(itemId: string): void {
    this.held.set(itemId, (this.held.get(itemId) ?? 0) + 1);
    const slot = equipmentSlotFor(this.dataset.itemsById[itemId]);
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
      const slot = equipmentSlotFor(this.dataset.itemsById[id]);
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
): RouteStep[] | null {
  const pack = new Pack(dataset);
  if (startingClothes && dataset.itemsById[startingClothes]) pack.startWearing(startingClothes);
  const gathered = new Map<string, number>();
  const crafted = new Map<string, number>();
  const steps: RouteStep[] = [];

  for (let index = 0; index < order.length; index += 1) {
    const area = order[index];
    const gather = new Map<string, RouteCollection>();
    const craft = new Map<string, RouteCraft>();

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

        const existing = craft.get(itemId);
        if (existing) existing.quantity += 1;
        else craft.set(itemId, { item: recipe.item, quantity: 1 });
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

        const existing = gather.get(itemId);
        if (existing) existing.quantity += units;
        else gather.set(itemId, { item: need.item, available, quantity: units });
        progressed = true;
      }

      if (!progressed) break;
    }

    steps.push({
      number: index + 1,
      area,
      gather: [...gather.values()].sort((a, b) => a.item.name.localeCompare(b.item.name)),
      // Insertion order, not alphabetical: it is the order they get built in, and
      // a later build depends on an earlier one (Steel before the Gauntlet).
      craft: [...craft.values()],
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

function toRoute(cover: WikiArea[], order: WikiArea[], steps: RouteStep[]): RoutePlan {
  const materials = new Set<string>();
  const crafts = new Set<string>();
  for (const step of steps) {
    for (const collection of step.gather) materials.add(collection.item.id);
    for (const built of step.craft) crafts.add(built.item.id);
  }

  return {
    id: order.map((area) => area.id).join("+"),
    steps,
    areaIds: order.map((area) => area.id),
    moves: order.length - 1,
    walkDistance: Math.round(pathDistance(order)),
    materialCount: materials.size,
    craftCount: crafts.size,
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
  if (trees.length === 0) return { routes: [], truncated: false, inventoryBlocked: false };

  const startingClothes =
    options.startingClothes && dataset.itemsById[options.startingClothes]
      ? options.startingClothes
      : null;

  const requirements = trees.map(toRequirement);
  let candidates = candidateAreas(dataset, requirements);
  if (candidates.length === 0) return { routes: [], truncated: false, inventoryBlocked: false };

  // Only when the sweep would be expensive: dropping areas another one beats
  // removes options that could never appear in a fastest route anyway.
  if (candidates.length > MAX_EXHAUSTIVE_AREAS) {
    const pruned = pruneDominated(dataset, candidates);
    if (pruned.length > 0) candidates = pruned;
  }

  const indexByAreaId = new Map(candidates.map((area, index) => [area.id, index]));
  const compiled = requirements.map((requirement) =>
    compileRequirement(requirement, dataset, indexByAreaId, startingClothes),
  );

  const isCover = (mask: number) => compiled.every((requirement) => satisfiesMask(requirement, mask));
  const missing = (mask: number) =>
    compiled.reduce((total, requirement) => total + missingMask(requirement, mask), 0);

  const { masks, truncated } =
    candidates.length <= MAX_EXHAUSTIVE_AREAS
      ? sweepCovers(candidates.length, isCover)
      : { masks: greedyCovers(candidates.length, missing), truncated: false };

  const routes: RoutePlan[] = [];
  const budget = { left: RUN_BUDGET };
  for (const mask of masks) {
    const cover = candidates.filter((_, index) => mask & (1 << index));
    const chosen = new Set(cover.map((area) => area.id));
    const plan = compilePlan(requirements, chosen, dataset, startingClothes);

    for (const order of orderings(cover, budget)) {
      const steps = runRoute(dataset, plan, order, startingClothes);
      if (!steps) continue;
      routes.push(toRoute(cover, order, steps));
      break;
    }
    if (routes.length >= MAX_ROUTES || budget.left <= 0) break;
  }

  routes.sort(
    (a, b) =>
      a.moves - b.moves ||
      a.walkDistance - b.walkDistance ||
      a.areaIds.join().localeCompare(b.areaIds.join()),
  );

  return {
    routes,
    truncated: truncated || routes.length >= MAX_ROUTES,
    // Covers exist but none of them can be walked with six bag slots.
    inventoryBlocked: routes.length === 0 && masks.length > 0,
  };
}
