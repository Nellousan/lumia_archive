import { STARTING_CLOTHES_IDS } from "./inventory";
import { DEFAULT_LOOK_AHEAD, MAX_LOOK_AHEAD, type RouteMode } from "./routes";
import type { WikiDataset, WikiItem } from "./types";

/**
 * A plan, and one of its routes, as a single opaque query parameter.
 *
 * The route solver is a pure function of exactly these values — the planned items
 * in order, the clothes worn from the first move, the ranking mode and its window
 * — so a link that carries them reproduces the same ranked list, and the rank
 * picks the same walk out of it. Nothing else about the screen is in here: the
 * fold of the island, the animal-drops switch and the open area change what is
 * drawn, never what is planned.
 *
 * ## Why this is packed rather than compressed
 *
 * Asked for as "compression + base64", and the honest answer is that compressing
 * this payload makes it *longer*. Measured over real plans (`?p=` included, in
 * characters):
 *
 * | plan                | keys, as six parameters | deflate + base64 | packed here |
 * | ------------------- | ----------------------- | ---------------- | ----------- |
 * | 1 item              |                      33 |               28 |          13 |
 * | 1 item + armor      |                      50 |               42 |          13 |
 * | 3 items             |                      78 |               78 |          25 |
 * | 6 items             |                     100 |               99 |          34 |
 * | 10 items            |                     149 |              138 |          49 |
 *
 * Deflate's own header costs more than these payloads contain, and base64 then
 * adds a third on top: it only starts to win past a couple of hundred bytes, which
 * a plan never reaches. What actually shortens the link is not squeezing the names
 * but not spelling them out at all — an item id averages 13 bytes and is filed
 * here under a 3-byte code. Base64 then keeps the whole thing to one URL-safe
 * token, which is why it is still the outer layer.
 *
 * ## The code
 *
 * {@link itemCode} is a 24-bit FNV-1a of the item id. It is derived from the id
 * alone, so it survives reordering, additions and deletions in `data.json` — an id
 * that is no longer in the dataset simply resolves to nothing and drops out of the
 * plan, the same way an unknown id did when the ids were written out in full.
 *
 * 24 bits over 629 items leaves a few parts per million of a pair colliding, and a
 * collision is the one failure this format cannot see: two ids, one code. So the
 * decoder resolves a code to *neither* item when the dataset gives it two, and the
 * check asserts that no two ids in `data.json` collide at all — a property to keep
 * re-asserting, and the reason {@link FORMAT} exists to widen the code if it ever
 * breaks.
 */
export const SHARE_PARAM = "p";

/** Bumped when the layout below changes; a payload from another version is ignored. */
const FORMAT = 1;
/** Bytes per item code: 24 bits, which is what {@link itemCode} produces. */
const CODE_BYTES = 3;
/**
 * One byte of item count, so the format tops out at 255 planned items. A plan
 * that long is not a plan; the extra ones are dropped from the link rather than
 * from the screen.
 */
const MAX_CODES = 255;

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
  /** How many areas greedy weighs at each step; carried even for fastest. */
  lookAhead: number;
  /** 1-based rank of the route to highlight, or `null` for none. */
  routeNumber: number | null;
}

/**
 * The fixed-width code an item is filed under: the top 24 bits of an FNV-1a hash
 * of its id.
 *
 * The high bits are taken because FNV-1a mixes upward — its low bits are the weak
 * ones for short keys — and `Math.imul` keeps the multiply inside 32 bits, so the
 * code is the same number in a browser and in a test runner.
 */
export function itemCode(itemId: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < itemId.length; index += 1) {
    hash ^= itemId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 8;
}

function clampLookAhead(value: number): number {
  return Math.min(Math.max(Math.round(value), 1), MAX_LOOK_AHEAD);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** `null` for anything that is not base64url — `atob` rejects the rest. */
function fromBase64Url(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  } catch {
    return null;
  }
}

/**
 * The dataset read as code -> item, with a code the data gives twice filed as
 * `null`: an ambiguous code plans nothing rather than planning the wrong item.
 */
function itemsByCode(dataset: WikiDataset): Map<number, WikiItem | null> {
  const found = new Map<number, WikiItem | null>();
  for (const item of dataset.items) {
    const code = itemCode(item.id);
    found.set(code, found.has(code) ? null : item);
  }
  return found;
}

function writeCode(bytes: Uint8Array, at: number, code: number): void {
  bytes[at] = (code >>> 16) & 0xff;
  bytes[at + 1] = (code >>> 8) & 0xff;
  bytes[at + 2] = code & 0xff;
}

function readCode(bytes: Uint8Array, at: number): number {
  return (bytes[at] << 16) | (bytes[at + 1] << 8) | bytes[at + 2];
}

/** True when the plan is worth a parameter at all: something is being gathered. */
export function hasPlan(plan: SharedPlan): boolean {
  return plan.itemId !== null || plan.bookmarkIds.length > 0;
}

/**
 * The parameter value for a plan.
 *
 * Five bytes of header, then three bytes per item:
 *
 * | byte | meaning                                                          |
 * | ---- | ---------------------------------------------------------------- |
 * | 0    | format version                                                   |
 * | 1    | flags: greedy · look-ahead (3 bits) · "an item is open" (1 bit)   |
 * | 2    | starting armor, 0 for bare, else 1 + its place in the five clothes |
 * | 3    | route rank, 0 for none                                           |
 * | 4    | bookmarked item count                                            |
 * | 5+   | the open item, then the bookmarks, three bytes each              |
 */
export function encodeSharedPlan(plan: SharedPlan, dataset: WikiDataset): string {
  const itemId = plan.itemId !== null && dataset.itemsById[plan.itemId] ? plan.itemId : null;
  const bookmarks = plan.bookmarkIds.filter((id) => dataset.itemsById[id]).slice(0, MAX_CODES);
  const armor = plan.startingClothes === null ? -1 : STARTING_CLOTHES_IDS.indexOf(
    plan.startingClothes as (typeof STARTING_CLOTHES_IDS)[number],
  );
  const lookAhead = clampLookAhead(plan.lookAhead);

  const bytes = new Uint8Array(5 + (itemId === null ? 0 : CODE_BYTES) + bookmarks.length * CODE_BYTES);
  bytes[0] = FORMAT;
  bytes[1] = (plan.mode === "greedy" ? 1 : 0) | (lookAhead << 1) | (itemId === null ? 0 : 0x10);
  bytes[2] = armor < 0 ? 0 : armor + 1;
  bytes[3] = plan.routeNumber === null ? 0 : Math.min(Math.max(plan.routeNumber, 1), 0xff);
  bytes[4] = bookmarks.length;

  let at = 5;
  if (itemId !== null) {
    writeCode(bytes, at, itemCode(itemId));
    at += CODE_BYTES;
  }
  for (const id of bookmarks) {
    writeCode(bytes, at, itemCode(id));
    at += CODE_BYTES;
  }

  return toBase64Url(bytes);
}

/**
 * The plan a parameter value describes, or `null` when it is not one.
 *
 * Everything is checked before it is believed: the version, the length against the
 * count it declares, and every code against the dataset. A code nobody claims is
 * dropped — that is an item this build no longer has — so an old link opens the
 * part of its plan that still exists instead of failing outright.
 */
export function decodeSharedPlan(value: string, dataset: WikiDataset): SharedPlan | null {
  const bytes = fromBase64Url(value);
  if (bytes === null || bytes.length < 5 || bytes[0] !== FORMAT) return null;

  const flags = bytes[1];
  const open = (flags & 0x10) !== 0;
  const count = bytes[4];
  if (bytes.length < 5 + (open ? CODE_BYTES : 0) + count * CODE_BYTES) return null;

  const byCode = itemsByCode(dataset);
  let at = 5;

  let itemId: string | null = null;
  if (open) {
    itemId = byCode.get(readCode(bytes, at))?.id ?? null;
    at += CODE_BYTES;
  }

  const bookmarkIds: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const item = byCode.get(readCode(bytes, at)) ?? null;
    at += CODE_BYTES;
    if (item !== null && !bookmarkIds.includes(item.id)) bookmarkIds.push(item.id);
  }

  const armor = bytes[2];
  return {
    itemId,
    bookmarkIds,
    startingClothes: armor === 0 ? null : (STARTING_CLOTHES_IDS[armor - 1] ?? null),
    mode: (flags & 1) === 1 ? "greedy" : "fastest",
    lookAhead: clampLookAhead(((flags >> 1) & 0b111) || DEFAULT_LOOK_AHEAD),
    routeNumber: bytes[3] === 0 ? null : bytes[3],
  };
}

/**
 * `href` with the plan written into it, replacing only the key this module owns.
 *
 * Anything else the URL was carrying — a campaign tag, Discord's `?v=2` — is left
 * exactly where it was, which is what lets a link be re-shared without losing what
 * it was for. A plan with nothing in it drops the parameter instead of writing an
 * empty one.
 */
export function buildSharedUrl(href: string, plan: SharedPlan, dataset: WikiDataset): string {
  const url = new URL(href);
  if (hasPlan(plan)) url.searchParams.set(SHARE_PARAM, encodeSharedPlan(plan, dataset));
  else url.searchParams.delete(SHARE_PARAM);
  return url.toString();
}

/** The plan a query string carries, or `null` when it carries none. */
export function readSharedUrl(search: string, dataset: WikiDataset): SharedPlan | null {
  const value = new URLSearchParams(search).get(SHARE_PARAM);
  if (value === null) return null;
  const plan = decodeSharedPlan(value, dataset);
  return plan !== null && hasPlan(plan) ? plan : null;
}
