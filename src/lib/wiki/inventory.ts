import type { WikiItem } from "./types";

/**
 * The survivor's carry limit.
 *
 * Six bag slots hold everything you are not wearing, and each worn slot takes a
 * single item. Wearing is free, so the bag is what actually binds: an equipment
 * item can always be moved onto its slot to free the slot it was sitting in, and
 * if the slot is taken it simply stays in the bag (gear spilling into the bag is
 * allowed, it just costs space).
 *
 * Quantities are irrelevant — three Iron Ore stack in one slot, just like the
 * game.
 */
export const BAG_SLOTS = 6;

export type EquipmentSlot = "weapon" | "head" | "clothes" | "arm" | "leg" | "accessory";

/**
 * Which item types can be worn, and where.
 *
 * The eight weapon types all share the single weapon slot (`hand` really is a
 * weapon type here); the five gear types each own their slot. Everything else —
 * ingredients, food, enhance — only ever sits in the bag.
 */
const SLOT_BY_TYPE: Record<string, EquipmentSlot> = {
  blade: "weapon",
  stab: "weapon",
  blunt: "weapon",
  thrown: "weapon",
  gun: "weapon",
  bow: "weapon",
  hand: "weapon",
  trap: "weapon",
  head: "head",
  clothes: "clothes",
  arm: "arm",
  leg: "leg",
  accessory: "accessory",
};

/**
 * The clothes a survivor may pick before the match starts, and therefore already
 * be wearing on the first move. Being worn, the piece costs no bag slot — and
 * three of these feed a recipe (`windbreaker` into the leather jacket line,
 * `cassock` into the bishop's cassock, `doctor_s_gown` into the dress), so the
 * choice can genuinely shorten a route.
 */
export const STARTING_CLOTHES_IDS = [
  "fabric_armor",
  "windbreaker",
  "cassock",
  "doctor_s_gown",
  "full_body_swimsuit",
] as const;

/** The worn slot an item could occupy, or `null` when it can only be carried. */
export function equipmentSlotFor(item: WikiItem): EquipmentSlot | null {
  for (const type of item.types) {
    const slot = SLOT_BY_TYPE[type];
    if (slot) return slot;
  }
  return null;
}
