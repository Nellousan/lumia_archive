import { STARTING_CLOTHES_IDS } from "./inventory";
import { DEFAULT_LOOK_AHEAD, MAX_LOOK_AHEAD, type RouteMode } from "./routes";
import type { WikiDataset } from "./types";

/**
 * A plan, and the route within it, as six query parameters.
 *
 * The route solver is a pure function of exactly these values — the planned items
 * in order, the clothes worn from the first move, the ranking mode and its window
 * — so a link that carries them reproduces the same ranked list, and the number
 * picks the same walk out of it. Nothing else about the screen is in here: the
 * map's zoom, the fold of the island and the animal-drops switch change what is
 * drawn, never what is planned.
 *
 * Keys are one letter because the whole point is a URL short enough to paste:
 *
 * | key | meaning                                            |
 * | --- | -------------------------------------------------- |
 * | `i` | the open item                                      |
 * | `b` | bookmarked item ids, in the order they were added  |
 * | `a` | starting armor, absent when the survivor starts bare |
 * | `m` | `fastest` or `greedy`                              |
 * | `l` | how many areas greedy looks ahead (1-6)            |
 * | `r` | which route, counting from 1 in the ranked list    |
 *
 * `m` is always written even when it is the default, and `l` whenever the mode
 * reads it: a link is a statement about a route, and it should not quietly come
 * to mean something else the day a default changes.
 */
export const SHARE_PARAM = {
  item: "i",
  bookmarks: "b",
  armor: "a",
  mode: "m",
  lookAhead: "l",
  route: "r",
} as const;

/** Every key this module owns, in the order a link writes them. */
const OWNED_PARAMS: string[] = [
  SHARE_PARAM.item,
  SHARE_PARAM.bookmarks,
  SHARE_PARAM.armor,
  SHARE_PARAM.mode,
  SHARE_PARAM.lookAhead,
  SHARE_PARAM.route,
];

export interface SharedPlan {
  /** The item the link opens, or `null` when it opens none. */
  itemId: string | null;
  /**
   * The bookmarks, in the order they were added. The order is part of the plan —
   * the requirements reach the solver in sequence — and an item that is both open
   * and bookmarked is named here as well as in {@link itemId}: planning drops the
   * repeat, the plan bar keeps its star.
   */
  bookmarkIds: string[];
  /** Clothes worn from the first move, or `null` for a bare survivor. */
  startingClothes: string | null;
  /** What the routes are ranked by. */
  mode: RouteMode;
  /** How many areas greedy weighs at each step; ignored by `fastest`. */
  lookAhead: number;
  /** 1-based rank of the route to highlight, or `null` for none. */
  routeNumber: number | null;
}

/** A whole number at least 1, or `null` for anything else. */
function positiveInt(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 ? value : null;
}

/** A window the solver accepts, falling back to its own default. */
function lookAheadFrom(raw: string | null): number {
  if (raw === null || raw.trim() === "") return DEFAULT_LOOK_AHEAD;
  const value = Number(raw);
  if (!Number.isInteger(value)) return DEFAULT_LOOK_AHEAD;
  return Math.min(Math.max(value, 1), MAX_LOOK_AHEAD);
}

/**
 * Reads a plan out of a query string, dropping anything the dataset cannot
 * resolve.
 *
 * Every id is checked against the data before it reaches the solver: a link
 * pasted from an older or newer build names items that may be gone, and a route
 * number may point past the end of its list. Nothing here throws or invents an
 * item — an unknown id is simply not part of the plan.
 *
 * Returns `null` when the query carries none of the keys above, which is how the
 * caller tells a shared link from a plain visit.
 */
export function readSharedPlan(search: string, dataset: WikiDataset): SharedPlan | null {
  const params = new URLSearchParams(search);
  if (!OWNED_PARAMS.some((key) => params.has(key))) return null;

  const known = (id: string | null): string | null =>
    id !== null && id !== "" && Boolean(dataset.itemsById[id]) ? id : null;

  const bookmarks: string[] = [];
  for (const raw of (params.get(SHARE_PARAM.bookmarks) ?? "").split(",")) {
    const id = known(raw.trim());
    // Duplicates cannot come from the app; they can come from a hand-edited link.
    if (id !== null && !bookmarks.includes(id)) bookmarks.push(id);
  }

  const armor = params.get(SHARE_PARAM.armor);

  return {
    itemId: known(params.get(SHARE_PARAM.item)),
    bookmarkIds: bookmarks,
    // Only the five clothes the game offers can be picked at the start, so the
    // selector's own list is what validates this one.
    startingClothes:
      armor !== null && (STARTING_CLOTHES_IDS as readonly string[]).includes(armor) ? armor : null,
    mode: params.get(SHARE_PARAM.mode) === "greedy" ? "greedy" : "fastest",
    lookAhead: lookAheadFrom(params.get(SHARE_PARAM.lookAhead)),
    routeNumber: positiveInt(params.get(SHARE_PARAM.route)),
  };
}

/**
 * Writes `plan` into a URL, replacing only the keys this module owns.
 *
 * Anything else the URL was carrying — a campaign tag, Discord's `?v=2` — is left
 * exactly where it was, which is what lets a link be re-shared without losing
 * what it was for. Passing `null` clears the plan keys and touches nothing else.
 */
function withPlan(href: string, plan: SharedPlan | null): string {
  const url = new URL(href);

  const write = (key: string, value: string | null) => {
    if (value === null) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
  };

  write(SHARE_PARAM.item, plan?.itemId ?? null);
  write(SHARE_PARAM.bookmarks, plan && plan.bookmarkIds.length > 0 ? plan.bookmarkIds.join(",") : null);
  write(SHARE_PARAM.armor, plan?.startingClothes ?? null);
  write(SHARE_PARAM.mode, plan ? plan.mode : null);
  // The window only means something to greedy, and a fastest link that carried one
  // would suggest otherwise.
  write(SHARE_PARAM.lookAhead, plan?.mode === "greedy" ? String(plan.lookAhead) : null);
  write(SHARE_PARAM.route, plan?.routeNumber != null ? String(plan.routeNumber) : null);

  // `URLSearchParams` percent-encodes the commas between bookmarked ids; they are
  // legal raw in a query and the link reads a great deal better with them.
  url.search = url.searchParams.toString().replace(/%2C/g, ",");

  return url.toString();
}

/** The address to hand someone for this plan and this route. */
export function buildSharedLink(href: string, plan: SharedPlan): string {
  return withPlan(href, plan);
}

/**
 * The same URL with the plan taken back out of it.
 *
 * A shared link is an instruction, not a state to keep living in: once the plan
 * is on screen the address bar goes back to naming the archive alone, so copying
 * it from the browser gives the plain site rather than someone else's route.
 */
export function clearSharedParams(href: string): string {
  return withPlan(href, null);
}
