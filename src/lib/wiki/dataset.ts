import { ANIMAL_PORTRAIT_BASE_PATH, ITEM_SPRITE_BASE_PATH, LUMIA_ISLAND_MAP } from "./map-image";
import { coordsToPolygon, polygonAnchor, polygonBounds } from "./geometry";
import { KNOWN_RARITIES, allCategoryTypes } from "./taxonomy";
import type {
  AnimalDropRef,
  AreaItemRef,
  AreaSpawn,
  AreaSpawnRef,
  Rarity,
  RawDataset,
  RawItem,
  RecipeEntry,
  SpriteTrim,
  WikiAnimal,
  WikiArea,
  WikiDataset,
  WikiItem,
} from "./types";
import rawData from "@/data/data.json";
import rawMap from "@/data/lumia-island.map.json";
import spriteManifest from "@/data/item-assets.json";
import portraitManifest from "@/data/animal-assets.json";

/**
 * The single place that knows about the raw JSON on disk.
 *
 * Everything downstream consumes the normalized {@link WikiDataset}. Swapping
 * the static files for a CMS or an HTTP API means reimplementing
 * `buildWikiDataset` and nothing else.
 */

/** Shape of one entry in `lumia-island.map.json` (an HTML image map dump). */
interface RawMapRegion {
  shape: string;
  coords: number[];
  href: string;
  alt: string;
  title: string;
}

/**
 * TypeScript infers the narrowest possible type from a JSON import — `type:
 * string[]` loses the literal unions and `areas[].items` becomes one variant per
 * area. One cast per file, here, keeps every other module strictly typed.
 */
const rawDataset = rawData as unknown as RawDataset;
const rawMapRegions = rawMap as unknown as RawMapRegion[];
const spriteManifestTyped = spriteManifest as unknown as {
  files: string[];
  /** id -> compact visible-pixel box; see `SpriteTrim` for the long names. */
  trim?: Record<string, { sw: number; sh: number; x: number; y: number; w: number; h: number }>;
};
const spriteFiles = spriteManifestTyped.files;
const portraitFiles = (portraitManifest as unknown as { files: string[] }).files;

/**
 * Items that spawn in random loot spots rather than in any one place.
 *
 * `data.json` records no area for them, and that is not an omission: they turn up
 * wherever the match puts them, so no bubble can point at one. The island's box
 * lists them so a plan needing one reads as "you will have to get lucky" instead
 * of showing nothing at all.
 *
 * Curated here rather than derived, because "no area" is also what a crafted item
 * looks like: it is the shipping band, not a property the loader can infer. Ids,
 * checked against the dataset — a typo would silently shrink the box, so an
 * unknown id is reported with the other data notes.
 */
const RANDOM_SPAWN_ITEM_IDS = [
  "ogre_skin",
  "tree_of_life",
  "meteorite",
  "mithril",
  "vital_sign_sensor",
  "holy_blood",
];

/** Expands the manifest's compact box into the domain shape. */
function toSpriteTrim(id: string): SpriteTrim | null {
  const box = spriteManifestTyped.trim?.[id];
  if (!box) return null;
  return {
    sourceWidth: box.sw,
    sourceHeight: box.sh,
    x: box.x,
    y: box.y,
    width: box.w,
    height: box.h,
  };
}

/**
 * Normalizes a rarity from the source file. Unknown tiers fall back to `common`
 * and are reported, so a new tier in `data.json` shows up as a data note rather
 * than silently rendering as a common item.
 */
function normalizeRarity(value: string, itemId: string, warnings: string[]): Rarity {
  const normalized = value?.toLowerCase?.() ?? "";
  const known = KNOWN_RARITIES.find((rarity) => rarity === normalized);
  if (known) return known;

  warnings.push(`Item "${itemId}" has unknown rarity "${value}"; treated as common.`);
  return "common";
}

function buildItems(availableSprites: Set<string>, warnings: string[]): WikiItem[] {
  const rawItems = rawDataset.items;
  const knownIds = new Set(rawItems.map((item) => item.id));

  return rawItems.map((raw: RawItem): WikiItem => {
    let recipe: RecipeEntry[] | null = null;

    if (raw.recipe && raw.recipe.length > 0) {
      const entries: RecipeEntry[] = [];
      for (const ingredientId of raw.recipe) {
        if (!knownIds.has(ingredientId)) {
          warnings.push(
            `Recipe of "${raw.id}" references unknown item "${ingredientId}"; entry dropped.`,
          );
          continue;
        }
        entries.push({ itemId: ingredientId, quantity: 1 });
      }
      recipe = entries.length > 0 ? entries : null;
    }

    // How many units one craft (or one pickup) hands over. Below one makes no
    // sense and would loop the route solver, so it is a data note, not a crash.
    const defaultQuantity = Math.max(1, Math.round(raw.defaultQuantity ?? 1));
    if (raw.defaultQuantity !== defaultQuantity) {
      warnings.push(
        `Item "${raw.id}" has default quantity ${raw.defaultQuantity}; treated as ${defaultQuantity}.`,
      );
    }

    return {
      id: raw.id,
      name: raw.name,
      rarity: normalizeRarity(raw.rarity, raw.id, warnings),
      types: raw.type ?? [],
      value: raw.value ?? null,
      defaultQuantity,
      recipe,
      craftable: recipe !== null,
      sprite: availableSprites.has(raw.id) ? `${ITEM_SPRITE_BASE_PATH}/${raw.id}.png` : null,
      spriteTrim: availableSprites.has(raw.id) ? toSpriteTrim(raw.id) : null,
    };
  });
}

/**
 * Flattens an area's loot into one entry per item, summing the quantities.
 *
 * `data.json` can list the same item several times for one area (each entry is a
 * separate loot slot, e.g. Alley holds Scrap Metal as both 2 and 9). The wiki
 * wants the total available in the area, not the slot breakdown, so they are
 * merged here once instead of in every consumer.
 */
function flattenAreaSpawns(rawArea: { items: Array<Record<string, number>> } | undefined): {
  spawns: AreaSpawn[];
  mergedSlots: number;
} {
  if (!rawArea) return { spawns: [], mergedSlots: 0 };

  const totals = new Map<string, number>();
  let slots = 0;

  for (const entry of rawArea.items) {
    for (const [itemId, quantity] of Object.entries(entry)) {
      totals.set(itemId, (totals.get(itemId) ?? 0) + quantity);
      slots += 1;
    }
  }

  return {
    spawns: [...totals].map(([itemId, quantity]) => ({ itemId, quantity })),
    mergedSlots: slots - totals.size,
  };
}

function buildAreas(warnings: string[]): WikiArea[] {
  const rawAreas = rawDataset.areas;
  const rawAreasById = new Map(rawAreas.map((area) => [area.id, area]));
  const regions = rawMapRegions;

  const areas: WikiArea[] = [];
  const seen = new Set<string>();

  for (const region of regions) {
    const areaId = region.title;
    const rawArea = rawAreasById.get(areaId);
    seen.add(areaId);

    const polygon = coordsToPolygon(region.coords);
    const bounds = polygonBounds(polygon);
    const { spawns, mergedSlots } = flattenAreaSpawns(rawArea);

    if (!rawArea) {
      warnings.push(`Area "${areaId}" is on the map but has no loot entry in data.json.`);
    }
    if (mergedSlots > 0) {
      warnings.push(
        `Area "${areaId}" listed ${mergedSlots} duplicated loot slot(s); quantities summed.`,
      );
    }

    areas.push({
      id: areaId,
      name: region.alt || areaId,
      spawns,
      polygon,
      anchor: polygonAnchor(polygon),
      bounds,
      empty: spawns.length === 0,
      mapped: true,
    });
  }

  // Areas described in the data but missing from the image map: keep them so no
  // loot is silently dropped, but they cannot be drawn.
  for (const rawArea of rawAreas) {
    if (seen.has(rawArea.id)) continue;
    const { spawns } = flattenAreaSpawns(rawArea);
    warnings.push(`Area "${rawArea.id}" exists in data.json but not on the image map.`);
    areas.push({
      id: rawArea.id,
      name: rawArea.id,
      spawns,
      polygon: [],
      anchor: { x: 0, y: 0 },
      bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      empty: spawns.length === 0,
      mapped: false,
    });
  }

  return areas;
}

/**
 * Normalizes the animals and their loot.
 *
 * The loot is resolved to items (an unknown id is a data note, not a crash) and
 * the areas to mapped ones, because the only thing animals are used for is
 * annotating a bubble, and a bubble belongs to an area. The portrait is looked up
 * in `public/animals` the same way an item looks up its sprite: a missing file
 * costs the artwork, never the entry.
 */
function buildAnimals(
  itemsById: Record<string, WikiItem>,
  areasById: Record<string, WikiArea>,
  availablePortraits: Set<string>,
  warnings: string[],
): WikiAnimal[] {
  return rawDataset.animals.map((raw): WikiAnimal => {
    const loot: WikiItem[] = [];
    for (const itemId of raw.loot ?? []) {
      const item = itemsById[itemId];
      if (!item) {
        warnings.push(`Animal "${raw.id}" drops unknown item "${itemId}"; entry dropped.`);
        continue;
      }
      if (!loot.some((known) => known.id === item.id)) loot.push(item);
    }

    const areas: WikiArea[] = [];
    for (const areaId of raw.areas ?? []) {
      const area = areasById[areaId];
      if (!area) {
        warnings.push(`Animal "${raw.id}" spawns in unknown area "${areaId}"; entry dropped.`);
        continue;
      }
      if (!areas.some((known) => known.id === area.id)) areas.push(area);
    }

    // Not a defect: some animals roam rather than belonging to one area, so the
    // data gives them none. Worth a note all the same — it is the reason their
    // loot never shows up on the island.
    if (areas.length === 0 && loot.length > 0) {
      warnings.push(
        `Animal "${raw.id}" has no fixed area; its loot ` +
          `(${loot.map((item) => item.id).join(", ")}) is not placed on the island.`,
      );
    }

    areas.sort((a, b) => a.name.localeCompare(b.name));

    const hasPortrait = availablePortraits.has(raw.id);
    if (!hasPortrait) {
      warnings.push(
        `No portrait found for animal "${raw.id}" (public/animals/${raw.id}.png).`,
      );
    }

    return {
      id: raw.id,
      name: raw.name || raw.id,
      hp: raw.baseHp ?? null,
      atk: raw.baseAtk ?? null,
      def: raw.baseDef ?? null,
      firstSpawnTime: raw.firstSpawnTime ?? null,
      respawnTime: raw.respawnTime ?? null,
      loot,
      areas,
      portrait: hasPortrait ? `${ANIMAL_PORTRAIT_BASE_PATH}/${raw.id}.png` : null,
    };
  });
}

/** Builds every lookup table from the raw files. Pure — no module state. */
export function buildWikiDataset(): WikiDataset {
  const warnings: string[] = [];
  const availableSprites = new Set(spriteFiles);

  const items = buildItems(availableSprites, warnings);
  const itemsById: Record<string, WikiItem> = Object.fromEntries(
    items.map((item) => [item.id, item]),
  );

  for (const item of items) {
    if (!item.sprite) {
      warnings.push(`No sprite found for item "${item.id}" (public/items/${item.id}.png).`);
    }
  }

  // A type the taxonomy does not know about would be invisible in the rail, so
  // say so rather than letting items quietly vanish from every tab.
  const knownTypes = new Set(allCategoryTypes());
  const orphanTypes = [...new Set(items.flatMap((item) => item.types))].filter(
    (type) => !knownTypes.has(type),
  );
  if (orphanTypes.length > 0) {
    warnings.push(
      `Type(s) ${orphanTypes.map((type) => `"${type}"`).join(", ")} are not in CATEGORY_TABS; ` +
        `items carrying them only appear under "All".`,
    );
  }

  const areas = buildAreas(warnings);
  const areasById: Record<string, WikiArea> = Object.fromEntries(
    areas.map((area) => [area.id, area]),
  );

  const spawnsByItemId: Record<string, AreaSpawnRef[]> = {};
  const itemsByAreaId: Record<string, AreaItemRef[]> = {};

  for (const area of areas) {
    const resolved: AreaItemRef[] = [];
    for (const spawn of area.spawns) {
      const item = itemsById[spawn.itemId];
      if (!item) {
        warnings.push(`Area "${area.id}" spawns unknown item "${spawn.itemId}"; entry dropped.`);
        continue;
      }
      resolved.push({ item, quantity: spawn.quantity });
      (spawnsByItemId[item.id] ??= []).push({
        areaId: area.id,
        areaName: area.name,
        quantity: spawn.quantity,
      });
    }
    resolved.sort((a, b) => a.item.name.localeCompare(b.item.name));
    itemsByAreaId[area.id] = resolved;
  }

  for (const refs of Object.values(spawnsByItemId)) {
    refs.sort((a, b) => a.areaName.localeCompare(b.areaName));
  }

  const randomSpawnItems: WikiItem[] = [];
  for (const itemId of RANDOM_SPAWN_ITEM_IDS) {
    const item = itemsById[itemId];
    if (!item) {
      warnings.push(`Random-spawn item "${itemId}" is not in data.json; not shown on the island.`);
      continue;
    }
    randomSpawnItems.push(item);
  }

  const animals = buildAnimals(itemsById, areasById, new Set(portraitFiles), warnings);
  const animalsById: Record<string, WikiAnimal> = Object.fromEntries(
    animals.map((animal) => [animal.id, animal]),
  );

  /**
   * The animal half of the map's sourcing information: which animals can drop an
   * item, and where. One entry per animal × area so a bubble can name the animal
   * it is talking about.
   */
  const animalDropsByItemId: Record<string, AnimalDropRef[]> = {};
  const animalsByAreaId: Record<string, WikiAnimal[]> = {};

  for (const animal of animals) {
    for (const area of animal.areas) {
      (animalsByAreaId[area.id] ??= []).push(animal);
      for (const item of animal.loot) {
        (animalDropsByItemId[item.id] ??= []).push({
          animalId: animal.id,
          animalName: animal.name,
          areaId: area.id,
          areaName: area.name,
        });
      }
    }
  }

  for (const refs of Object.values(animalDropsByItemId)) {
    refs.sort(
      (a, b) => a.areaName.localeCompare(b.areaName) || a.animalName.localeCompare(b.animalName),
    );
  }
  for (const residents of Object.values(animalsByAreaId)) {
    residents.sort((a, b) => a.name.localeCompare(b.name));
  }

  // Reverse recipe index: which items can be crafted with a given ingredient.
  const usedToCraftByItemId: Record<string, WikiItem[]> = {};
  for (const item of items) {
    if (!item.recipe) continue;
    for (const entry of item.recipe) {
      (usedToCraftByItemId[entry.itemId] ??= []).push(item);
    }
  }
  for (const craftables of Object.values(usedToCraftByItemId)) {
    craftables.sort((a, b) => a.name.localeCompare(b.name));
  }

  const mappedAreas = areas.filter((area) => area.mapped);

  return {
    items,
    areas,
    itemsById,
    areasById,
    spawnsByItemId,
    itemsByAreaId,
    animals,
    animalsById,
    animalDropsByItemId,
    animalsByAreaId,
    randomSpawnItems,
    usedToCraftByItemId,
    map: LUMIA_ISLAND_MAP,
    stats: {
      itemCount: items.length,
      areaCount: areas.length,
      craftableCount: items.filter((item) => item.craftable).length,
      animalCount: animals.length,
      mappedAreaCount: mappedAreas.length,
      emptyAreaIds: areas.filter((area) => area.empty).map((area) => area.id),
    },
    warnings,
  };
}

let cached: WikiDataset | null = null;

/**
 * Prints what the loader had to work around, once per process.
 *
 * The data notes used to be a collapsible strip at the bottom of the island
 * pane; they are a build/startup concern rather than something a reader of the
 * wiki needs, so they now land in stdout as a single line.
 */
export function reportDataset(dataset: WikiDataset): void {
  const scope = globalThis as typeof globalThis & { __lumiaArchiveReported?: boolean };
  if (scope.__lumiaArchiveReported) return;
  scope.__lumiaArchiveReported = true;

  const { stats, warnings } = dataset;
  const notes =
    warnings.length === 0 ? "no data notes" : `${warnings.length} data note(s): ${warnings.join(" | ")}`;

  console.log(
    `[lumia-archive] data ready — ${stats.itemCount} items · ${stats.areaCount} areas ` +
      `(${stats.mappedAreaCount} mapped) · ${stats.craftableCount} craftable · ` +
      `${stats.animalCount} animals — ${notes}`,
  );
}

/** Process-wide singleton; the dataset is immutable so this is safe. */
export function getWikiDataset(): WikiDataset {
  cached ??= buildWikiDataset();
  reportDataset(cached);
  return cached;
}
