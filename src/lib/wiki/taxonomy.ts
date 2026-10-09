import type { Rarity } from "./types";

/**
 * Curated taxonomy.
 *
 * `data.json` carries 17 raw type keys. The rail presents them as two levels:
 * five top-level tabs, each with its own ordered sub-tabs (the catch-all "All"
 * last). Both levels are
 * derived from the single source of truth below — `CATEGORY_TABS` is the only
 * place the structure is written down.
 *
 * The grouping matches the source wiki's own categories (`itemcategory` in
 * `public/items/_manifest.json`): `hand` really is "Weapon (hand)" there, not an
 * armor slot.
 */

export interface CategoryTab {
  id: string;
  label: string;
  /** Sub-tab order. Empty for "All", which filters nothing. */
  types: string[];
}

export const ALL_GROUP_ID = "all";

/** The catch-all tab. Kept as a constant so the fallback below cannot drift. */
const ALL_TAB: CategoryTab = { id: ALL_GROUP_ID, label: "All", types: [] };

/**
 * Top-level tabs, in display order.
 *
 * Weapon first because that is what the game is played with — most items are
 * weapons and most questions are about them. "All" comes last on purpose: it is a
 * way out of the taxonomy rather than a way in, and the rail opens on Weapon ->
 * Blade. The order is also the "most actionable first" one the area panel groups
 * by, so the two agree without either having to invert the other.
 */
export const CATEGORY_TABS: CategoryTab[] = [
  {
    id: "weapon",
    label: "Weapon",
    types: ["blade", "stab", "blunt", "thrown", "gun", "bow", "hand", "trap"],
  },
  { id: "gear", label: "Gear", types: ["head", "clothes", "arm", "leg", "accessory"] },
  { id: "food", label: "Food", types: ["health", "stamina"] },
  {
    id: "normal",
    label: "Normal",
    // `special` is part of the taxonomy but has no items in data.json yet.
    types: ["enhance", "special", "ingredients"],
  },
  ALL_TAB,
];

export function getCategoryTab(groupId: string): CategoryTab {
  return CATEGORY_TABS.find((tab) => tab.id === groupId) ?? ALL_TAB;
}

/** Every raw type key the taxonomy knows about. */
export function allCategoryTypes(): string[] {
  return CATEGORY_TABS.flatMap((tab) => tab.types);
}

const TYPE_LABELS: Record<string, string> = {
  blade: "Blade",
  blunt: "Blunt",
  stab: "Stab",
  gun: "Gun",
  bow: "Bow",
  thrown: "Thrown",
  trap: "Trap",
  hand: "Hand",
  head: "Head",
  arm: "Arm",
  leg: "Leg",
  clothes: "Clothes",
  accessory: "Accessory",
  health: "Health",
  stamina: "Stamina",
  ingredients: "Ingredients",
  enhance: "Enhance",
  special: "Special",
};

/** Falls back to a title-cased version of the raw key for unknown types. */
export function itemTypeLabel(typeKey: string): string {
  const known = TYPE_LABELS[typeKey];
  if (known) return known;
  return typeKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export interface RarityMeta {
  key: Rarity;
  label: string;
  /** Tailwind classes for a solid badge. */
  badge: string;
  /** Tailwind classes for a small dot. */
  dot: string;
  /** Tailwind classes for a text-only label. */
  text: string;
}

export const RARITY_META: Record<Rarity, RarityMeta> = {
  common: {
    key: "common",
    label: "Common",
    badge: "border-stone-400/25 bg-stone-400/10 text-stone-300",
    dot: "bg-stone-400",
    text: "text-stone-300",
  },
  uncommon: {
    key: "uncommon",
    label: "Uncommon",
    badge: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
  },
  rare: {
    key: "rare",
    label: "Rare",
    badge: "border-sky-400/35 bg-sky-400/10 text-sky-300",
    dot: "bg-sky-400",
    text: "text-sky-300",
  },
  epic: {
    key: "epic",
    label: "Epic",
    badge: "border-purple-400/35 bg-purple-400/10 text-purple-300",
    dot: "bg-purple-400",
    text: "text-purple-300",
  },
  legendary: {
    key: "legendary",
    label: "Legendary",
    // Yellow that leans purple: gold lettering on a violet-tinted plate, with a
    // solid gold dot. The dot used to run gold -> violet, but a 6px gradient
    // interpolates through grey and reads violet, so it is one flat colour now.
    badge: "border-violet-400/35 bg-violet-500/10 text-amber-200",
    dot: "bg-amber-300",
    text: "text-amber-200",
  },
};

/** Rarest first — the order the catalog sorts by, and the rarity ladder. */
export const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "uncommon", "common"];

/** Every rarity the app knows about; anything else in the data is reported. */
export const KNOWN_RARITIES: Rarity[] = [...RARITY_ORDER];

/** 0 for the rarest. Used as the primary catalog sort key. */
export function rarityRank(rarity: Rarity): number {
  const index = RARITY_ORDER.indexOf(rarity);
  return index === -1 ? RARITY_ORDER.length : index;
}
