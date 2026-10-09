/**
 * Domain types for the Lumia Archive wiki.
 *
 * Two layers live here on purpose:
 *  - `Raw*` types mirror `src/data/*.json` exactly, warts included.
 *  - The plain types are the normalized shape the UI consumes.
 *
 * Only `lib/wiki/dataset.ts` may touch the `Raw*` types. Everything else in the
 * app works against the normalized domain model, so the data source can later be
 * swapped for an API without touching a single component.
 */

/* -------------------------------------------------------------------------- */
/* Raw JSON shapes (src/data/data.json, src/data/lumia-island.map.json)        */
/* -------------------------------------------------------------------------- */

export interface RawItem {
  id: string;
  name: string;
  /** Free-form in the source file; normalized to {@link Rarity} on load. */
  rarity: string;
  /** Raw type keys, e.g. `["blade", "stab"]`. Multi-valued. */
  type: string[];
  value: number | null;
  defaultQuantity: number;
  /** Ingredient item ids, or `null` when the item is gathered, not crafted. */
  recipe: string[] | null;
}

/** `data.json` stores an area's loot as `[{ itemId: quantity }, ...]`. */
export interface RawArea {
  id: string;
  items: Array<Record<string, number>>;
}

/** `data.json` stores an animal's stats, the ids it can drop and its area ids. */
export interface RawAnimal {
  id: string;
  name: string;
  baseHp?: number;
  baseAtk?: number;
  baseDef?: number;
  /** Seconds into the match at which it first appears. */
  firstSpawnTime?: number | null;
  /** Seconds between respawns; absent/null for the once-a-match animals. */
  respawnTime?: number | null;
  loot?: string[];
  areas?: string[];
}

export interface RawDataset {
  items: RawItem[];
  areas: RawArea[];
  animals: RawAnimal[];
}

/* -------------------------------------------------------------------------- */
/* Normalized domain model                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Item rarity tiers. `data.json` currently only uses the first three, but the
 * palette and ordering cover the full ladder so new tiers light up on their own.
 */
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export interface RecipeEntry {
  itemId: string;
  /** Always 1 in the current dataset; modelled so future data can carry counts. */
  quantity: number;
}

/**
 * Bounding box of the visible pixels inside a sprite, in source-image pixels.
 *
 * The source canvases are 2:1 with a lot of transparent padding (a median 41% of
 * the area), so rendering them as-is wastes most of the frame. Consumers that
 * need a tight crop scale the image by `max(width, height)` and offset it so this
 * box lands centred in the container.
 */
export interface SpriteTrim {
  /** Full source canvas size, in pixels. */
  sourceWidth: number;
  sourceHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WikiItem {
  id: string;
  name: string;
  rarity: Rarity;
  /** Raw type keys; empty only for malformed data. */
  types: string[];
  value: number | null;
  defaultQuantity: number;
  recipe: RecipeEntry[] | null;
  /** True when `recipe` has at least one entry. */
  craftable: boolean;
  /** Sprite URL, or `null` when no asset exists (see `unresolvedAssets`). */
  sprite: string | null;
  /** Visible-pixel box for the sprite, or `null` when it could not be measured. */
  spriteTrim: SpriteTrim | null;
}

export interface MapPoint {
  x: number;
  y: number;
}

/** One lootable stack: an item and how many of it sit in that area. */
export interface AreaSpawn {
  itemId: string;
  quantity: number;
}

/** A resolved pointer from an item back to an area that contains it. */
export interface AreaSpawnRef {
  areaId: string;
  areaName: string;
  quantity: number;
}

/** A resolved pointer from an area to one of its items. */
export interface AreaItemRef {
  item: WikiItem;
  quantity: number;
}

export interface WikiArea {
  id: string;
  /** Display name, taken from the image map (`alt`). */
  name: string;
  spawns: AreaSpawn[];
  /** Polygon vertices in base-image pixel coordinates. */
  polygon: MapPoint[];
  /** Anchor for labels and bubbles; falls back to the bbox centre for concave shapes. */
  anchor: MapPoint;
  /** Axis-aligned bounds, handy for clamping overlays. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** True when the area exists on the map but has no loot in the dataset. */
  empty: boolean;
  /** False for an area present in `data.json` but absent from the image map. */
  mapped: boolean;
}

/**
 * A wild animal: where it spawns and what it can drop.
 *
 * Its loot is *not* a source of supply — killing one is optional and may not even
 * be possible — so nothing here feeds the route solver. It exists to annotate the
 * map: "you can also get this here, off a Bat".
 */
export interface WikiAnimal {
  id: string;
  name: string;
  hp: number | null;
  atk: number | null;
  def: number | null;
  firstSpawnTime: number | null;
  respawnTime: number | null;
  loot: WikiItem[];
  /** Areas it spawns in; empty for an animal the data places nowhere. */
  areas: WikiArea[];
  /**
   * Portrait artwork, or `null` when `public/animals` has none.
   *
   * The source is a square canvas holding the whole animal, framed so that its
   * eye level sits on the middle row — the card crops a band around that row
   * rather than trusting any one animal's proportions.
   */
  portrait: string | null;
}

/** One way to get an item off a wild animal: a given animal in a given area. */
export interface AnimalDropRef {
  animalId: string;
  animalName: string;
  areaId: string;
  areaName: string;
}

export interface MapImage {
  src: string;
  width: number;
  height: number;
}

/**
 * Denormalized lookup tables, built once. Plain objects (not `Map`s) so the
 * whole dataset stays serializable across the React Server Component boundary.
 */
export interface WikiDataset {
  items: WikiItem[];
  areas: WikiArea[];
  itemsById: Record<string, WikiItem>;
  areasById: Record<string, WikiArea>;
  spawnsByItemId: Record<string, AreaSpawnRef[]>;
  itemsByAreaId: Record<string, AreaItemRef[]>;
  animals: WikiAnimal[];
  animalsById: Record<string, WikiAnimal>;
  /**
   * item id -> every animal × area that can drop it. Deliberately kept out of
   * `spawnsByItemId`: a drop is a maybe, so it must never reach the route solver.
   */
  animalDropsByItemId: Record<string, AnimalDropRef[]>;
  /** area id -> the animals that spawn there. */
  animalsByAreaId: Record<string, WikiAnimal[]>;
  /**
   * The items with no fixed home on the island, in the order the island's box
   * shows them. See `RANDOM_SPAWN_ITEM_IDS` for the list and why it is curated.
   */
  randomSpawnItems: WikiItem[];
  /**
   * Reverse recipe index: for an item used as an ingredient, the items that can
   * be crafted with it. Alphabetical; empty for the ~150 items no recipe needs.
   */
  usedToCraftByItemId: Record<string, WikiItem[]>;
  map: MapImage;
  stats: {
    itemCount: number;
    areaCount: number;
    craftableCount: number;
    animalCount: number;
    mappedAreaCount: number;
    emptyAreaIds: string[];
  };
  /** Data-quality warnings surfaced in the UI/console instead of failing silently. */
  warnings: string[];
}

/* -------------------------------------------------------------------------- */
/* Recipe tree                                                                 */
/* -------------------------------------------------------------------------- */

export interface RecipeNode {
  item: WikiItem;
  /** Effective quantity required, multiplied down the tree. */
  quantity: number;
  /** 0 for the root item. */
  depth: number;
  children: RecipeNode[];
  /** False when the node is a leaf or its expansion was stopped. */
  expanded: boolean;
  /** True when recursion stopped because the item already appears above. */
  cyclic: boolean;
  /** Areas containing this specific item, so a node can render its own sourcing. */
  areas: AreaSpawnRef[];
}

/** A material somewhere in a recipe tree, flattened for lookup and rendering. */
export interface RecipeMaterial {
  item: WikiItem;
  /** Total effective quantity needed, summed across every path. */
  quantity: number;
  /** Shallowest depth at which the material appears. */
  depth: number;
  /** True when the material is itself craftable (an intermediate, not a raw resource). */
  intermediate: boolean;
  /** Areas that contain this material. */
  areas: AreaSpawnRef[];
}
