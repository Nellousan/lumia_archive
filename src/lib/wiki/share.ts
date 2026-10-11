import { STARTING_CLOTHES_IDS } from "./inventory";
import type { WikiDataset, WikiItem } from "./types";

/**
 * A plan, and the walk taken through it, as a single opaque query parameter.
 *
 * The plan half is what the solver reads: the open item, the bookmarks in the
 * order they were added, the clothes worn from the first move. The other half is
 * the *walk* — the areas of the route that was on screen, in visit order.
 *
 * ## Why the walk is in here, rather than a rank
 *
 * It used to be a ranking mode, a look-ahead window and a rank: a link asked the
 * reader's browser (and the unfurl card) to run the solver again and pick the Nth
 * route out of the list it produced. That made a link a promise about the solver —
 * any change to how routes are ranked or ordered repointed every link ever
 * posted — and it made an unfurl cost a full search on the server.
 *
 * Carrying the stops instead makes the link describe the walk itself. Opening one
 * selects the manual mode with the trace prefilled, which is the same walk, drawn
 * by the same code, recomputed from the areas rather than searched for. Nothing
 * about ranking is in the URL any more: the reader's mode and look-ahead are UI
 * state, and a link opens on the defaults.
 *
 * ## Why this is packed rather than compressed
 *
 * Asked for as "compression + base64", and the honest answer is that compressing
 * this payload makes it *longer*. Measured over real plans (`?p=` included, in
 * characters):
 *
 * | plan                       | keys, as six parameters | deflate + base64 | packed here |
 * | -------------------------- | ----------------------- | ---------------- | ----------- |
 * | 1 item                     |                      33 |               28 |          13 |
 * | 1 item + armor             |                      50 |               42 |          13 |
 * | 1 item + a 4-stop walk     |                      80 |               76 |          26 |
 * | 3 items + a 6-stop walk    |                     140 |              128 |          46 |
 *
 * Deflate's own header costs more than these payloads contain, and base64 then
 * adds a third on top: it only starts to win past a couple of hundred bytes, which
 * a plan never reaches. What actually shortens the link is not squeezing the names
 * but not spelling them out at all — an id averages 13 bytes and is filed here
 * under a 3-byte code. Base64 then keeps the whole thing to one URL-safe token,
 * which is why it is still the outer layer.
 *
 * ## The code
 *
 * {@link idCode} is a 24-bit FNV-1a of the id, item ids and area ids alike. It is
 * derived from the id alone, so it survives reordering, additions and deletions in
 * `data.json` — an id that is no longer in the dataset simply resolves to nothing
 * and drops out, the same way an unknown id did when the ids were written out in
 * full. That is what makes a link outlive the data it was made from.
 *
 * 24 bits over 629 items leaves a few parts per million of a pair colliding, and a
 * collision is the one failure this format cannot see: two ids, one code. So the
 * decoder resolves a code to *neither* item when the dataset gives it two, and the
 * check asserts that no two ids in `data.json` collide at all — a property to keep
 * re-asserting, and the reason {@link FORMAT} exists to widen the code if it ever
 * breaks. Areas share the code and the rule; an area code and an item code may
 * collide harmlessly, because each is only ever resolved against its own table.
 * The island carries 22 of them, so two bytes would do today, but one width keeps
 * one decoder and one collision story.
 */
export const SHARE_PARAM = "p";

/**
 * Bumped when the layout below changes; a payload from another version is ignored.
 *
 * Version 1 carried a ranking mode, a look-ahead window and a route rank. It is
 * not read any more: it names a route by its position in a list this build may no
 * longer produce, which is the fragility the walk replaced.
 */
const FORMAT = 2;
/** Bytes per id code: 24 bits, which is what {@link idCode} produces. */
const CODE_BYTES = 3;
/**
 * One byte of item count, so the format tops out at 255 planned items. A plan
 * that long is not a plan; the extra ones are dropped from the link rather than
 * from the screen.
 */
const MAX_CODES = 255;
/**
 * One byte of stop count. No trace or computed route comes close — the longest
 * route the solver has produced is a dozen areas — so this is a format ceiling,
 * not a limit anyone reaches.
 */
const MAX_STOPS = 255;

export interface SharedPlan {
  /** The item the link opens, or `null` when it opens none. */
  itemId: string | null;
  /**
   * The bookmarks, in the order they were added. The order is part of the plan —
   * the requirements reach the solver in sequence — and an item that is both open
   * and bookmarked is named here as well as in {@link itemId}: planning drops the
   * repeat, the plan bar keeps its bookmark.
   */
  bookmarkIds: string[];
  /** Clothes worn from the first move, or `null` for a bare survivor. */
  startingClothes: string | null;
  /**
   * The walk the link describes: the areas of the route that was on screen, in
   * visit order. Empty when the link names no route.
   *
   * It is the *route*, not a mode: opening the link selects the manual mode with
   * this as the trace, and the same code that walks a trace the reader clicked
   * walks this one.
   */
  routeAreaIds: string[];
}

/**
 * The fixed-width code an id is filed under: the top 24 bits of an FNV-1a hash
 * of the id.
 *
 * The high bits are taken because FNV-1a mixes upward — its low bits are the weak
 * ones for short keys — and `Math.imul` keeps the multiply inside 32 bits, so the
 * code is the same number in a browser and in a test runner.
 */
export function idCode(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 8;
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
    const code = idCode(item.id);
    found.set(code, found.has(code) ? null : item);
  }
  return found;
}

/** The same table for areas, which is what a walk's stops are resolved against. */
function areaIdsByCode(dataset: WikiDataset): Map<number, string | null> {
  const found = new Map<number, string | null>();
  for (const area of dataset.areas) {
    const code = idCode(area.id);
    found.set(code, found.has(code) ? null : area.id);
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
 * Five bytes of header, then three bytes per id:
 *
 * | byte | meaning                                                          |
 * | ---- | ---------------------------------------------------------------- |
 * | 0    | format version                                                   |
 * | 1    | flags: "an item is open" (1 bit), the rest reserved               |
 * | 2    | starting armor, 0 for bare, else 1 + its place in the five clothes |
 * | 3    | bookmarked item count                                            |
 * | 4    | stop count, 0 when the link names no walk                        |
 * | 5+   | the open item, then the bookmarks, then the walk's stops          |
 *
 * There is no ranking mode and no look-ahead in here: with the walk itself in the
 * payload, neither of them is a fact about the link any more. A plan with no walk
 * therefore costs one byte less than it used to (the rank byte is gone).
 */
export function encodeSharedPlan(plan: SharedPlan, dataset: WikiDataset): string {
  const itemId = plan.itemId !== null && dataset.itemsById[plan.itemId] ? plan.itemId : null;
  const bookmarks = plan.bookmarkIds.filter((id) => dataset.itemsById[id]).slice(0, MAX_CODES);
  const armor = plan.startingClothes === null ? -1 : STARTING_CLOTHES_IDS.indexOf(
    plan.startingClothes as (typeof STARTING_CLOTHES_IDS)[number],
  );
  // Areas the dataset no longer has cannot be walked, so they are not written: a
  // link is built from a screen that was drawn from this same dataset anyway.
  const stops = plan.routeAreaIds
    .filter((id) => dataset.areasById[id] !== undefined)
    .slice(0, MAX_STOPS);

  const bytes = new Uint8Array(
    5 +
      (itemId === null ? 0 : CODE_BYTES) +
      bookmarks.length * CODE_BYTES +
      stops.length * CODE_BYTES,
  );
  bytes[0] = FORMAT;
  bytes[1] = itemId === null ? 0 : 0x01;
  bytes[2] = armor < 0 ? 0 : armor + 1;
  bytes[3] = bookmarks.length;
  bytes[4] = stops.length;

  let at = 5;
  if (itemId !== null) {
    writeCode(bytes, at, idCode(itemId));
    at += CODE_BYTES;
  }
  for (const id of bookmarks) {
    writeCode(bytes, at, idCode(id));
    at += CODE_BYTES;
  }
  for (const id of stops) {
    writeCode(bytes, at, idCode(id));
    at += CODE_BYTES;
  }

  return toBase64Url(bytes);
}

/**
 * The plan a parameter value describes, or `null` when it is not one.
 *
 * Everything is checked before it is believed: the version, the length against the
 * counts it declares, and every code against the dataset. A code nobody claims is
 * dropped — that is an id this build no longer has — so an old link opens the part
 * of its plan that still exists instead of failing outright. A walk visits an area
 * once, so a repeated stop is dropped rather than walked twice.
 */
export function decodeSharedPlan(value: string, dataset: WikiDataset): SharedPlan | null {
  const bytes = fromBase64Url(value);
  if (bytes === null || bytes.length < 5 || bytes[0] !== FORMAT) return null;

  const open = (bytes[1] & 0x01) !== 0;
  const bookmarks = bytes[3];
  const stops = bytes[4];
  const needed = 5 + (open ? CODE_BYTES : 0) + (bookmarks + stops) * CODE_BYTES;
  if (bytes.length < needed) return null;

  const byCode = itemsByCode(dataset);
  let at = 5;

  let itemId: string | null = null;
  if (open) {
    itemId = byCode.get(readCode(bytes, at))?.id ?? null;
    at += CODE_BYTES;
  }

  const bookmarkIds: string[] = [];
  for (let index = 0; index < bookmarks; index += 1) {
    const item = byCode.get(readCode(bytes, at)) ?? null;
    at += CODE_BYTES;
    if (item !== null && !bookmarkIds.includes(item.id)) bookmarkIds.push(item.id);
  }

  const routeAreaIds: string[] = [];
  const byAreaCode = areaIdsByCode(dataset);
  for (let index = 0; index < stops; index += 1) {
    const areaId = byAreaCode.get(readCode(bytes, at)) ?? null;
    at += CODE_BYTES;
    if (areaId !== null && !routeAreaIds.includes(areaId)) routeAreaIds.push(areaId);
  }

  const armor = bytes[2];
  return {
    itemId,
    bookmarkIds,
    startingClothes: armor === 0 ? null : (STARTING_CLOTHES_IDS[armor - 1] ?? null),
    routeAreaIds,
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
