import type { MapImage } from "./types";

/**
 * Base map used by the island view.
 *
 * `width`/`height` must match `public/lumia_island.png` *and* the coordinate
 * space of `src/data/lumia-island.map.json` — the polygons are plain pixel
 * offsets into that image, so the two are locked together.
 */
export const LUMIA_ISLAND_MAP: MapImage = {
  src: "/lumia_island.png",
  width: 1503,
  height: 774,
};

/** Sprite files live under `public/items/<itemId>.png`. */
export const ITEM_SPRITE_BASE_PATH = "/items";

/** Animal portraits live under `public/animals/<animalId>.png`. */
export const ANIMAL_PORTRAIT_BASE_PATH = "/animals";
