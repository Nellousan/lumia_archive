import { areaCountLabel, itemCountLabel, plannedItemsFor } from "./plan";
import type { SharedPlan } from "./share";
import { itemTypeLabel } from "./taxonomy";
import type { WikiArea, WikiDataset, WikiItem } from "./types";

/**
 * What a shared link unfurls into.
 *
 * An unfurler is a program that fetches the page and reads its `<head>`; it runs
 * no JavaScript and knows nothing about the plan in the query string. So the card
 * has to be built on the server, from the same payload the reader's browser
 * decodes — and that payload now names the walk's own areas, so the route card is
 * a lookup in `data.json` rather than a solve. An unfurl costs the same whether
 * the link names one item or a twelve-stop route; nothing here imports the solver.
 */

/** The site's own card, for a link that carries no plan at all. */
export const SITE_TITLE = "Lumia Archive — Black Survival Wiki";
export const SITE_DESCRIPTION = "Interactive item and resource map for Black Survival Project Lumia";

/** What every dynamic title starts with, `Lumia Archive - ` (a plain hyphen). */
const TITLE_PREFIX = "Lumia Archive - ";

export interface PreviewImage {
  /** Path within the site; the metadata layer resolves it against the origin. */
  url: string;
  width: number;
  height: number;
  alt: string;
}

export const SITE_IMAGE_ALT = "Lumia Archive";

const SITE_IMAGE: PreviewImage = {
  url: "/og.png",
  width: 256,
  height: 256,
  alt: SITE_IMAGE_ALT,
};

/**
 * Dr. Nadja, for a link that names a route: the card for "here is the run" gets
 * the face of the person explaining it.
 */
const ROUTE_IMAGE: PreviewImage = {
  url: "/dr-nadja.png",
  width: 256,
  height: 256,
  alt: "Dr. Nadja",
};

export interface LinkPreview {
  /** Which of the four shapes the card took — the check reads it back. */
  kind: "site" | "item" | "plan" | "route";
  title: string;
  description: string;
  image: PreviewImage;
}

/**
 * The card for a plan: the site itself, one item, a plan, or one walk of it.
 *
 * The four cases are decided in that order, and the route wins outright — a link
 * that names a route is about the walk, even though it also carries the items the
 * walk gathers.
 */
export function linkPreview(dataset: WikiDataset, plan: SharedPlan | null): LinkPreview {
  const site: LinkPreview = {
    kind: "site",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    image: SITE_IMAGE,
  };
  if (plan === null) return site;

  const planned = plannedItemsFor(dataset.itemsById, plan.itemId, plan.bookmarkIds);
  if (planned.length === 0) return site;

  const names = planned.map((item) => item.name).join(", ");

  if (plan.routeAreaIds.length > 0) {
    // The walk as the link names it. An area this build no longer has drops out
    // the same way an unknown item does; a walk with none of its areas left is
    // not a walk, and the card falls through to the plan.
    const areas = plan.routeAreaIds
      .map((areaId) => dataset.areasById[areaId])
      .filter((area): area is WikiArea => area !== undefined);
    if (areas.length > 0) {
      return {
        kind: "route",
        title: `${TITLE_PREFIX}${itemCountLabel(planned.length)} route (${areaCountLabel(areas.length)})`,
        description: `${names}\n${areas.map((area) => area.name).join(" → ")}`,
        image: ROUTE_IMAGE,
      };
    }
  }

  // A plan is several items, or any link whose items are all bookmarks: there is
  // no single open item for the card to be about.
  if (planned.length > 1 || plan.itemId === null) {
    return {
      kind: "plan",
      title: `${TITLE_PREFIX}${itemCountLabel(planned.length)} plan`,
      description: names,
      image: SITE_IMAGE,
    };
  }

  const item = planned[0];
  return {
    kind: "item",
    title: `${TITLE_PREFIX}${item.name}`,
    description: itemDescription(dataset, item),
    image: itemImage(item),
  };
}

/**
 * An item's card text: what it is, what it is worth, and what it is made of.
 *
 * Two lines at most, because a description is a sentence or two in a chat client —
 * `Blade 57` and `Craft: Iron Ore + Scrap Metal`, with either line dropped when the
 * data has nothing to put in it.
 */
function itemDescription(dataset: WikiDataset, item: WikiItem): string {
  const types = item.types.map(itemTypeLabel).join(" / ");
  const headline = [types, item.value === null ? "" : String(item.value)]
    .filter((part) => part !== "")
    .join(" ");

  const ingredients = (item.recipe ?? [])
    .map((entry) => dataset.itemsById[entry.itemId]?.name ?? entry.itemId)
    .join(" + ");

  return [headline, ingredients === "" ? "" : `Craft: ${ingredients}`]
    .filter((line) => line !== "")
    .join("\n");
}

/** The item's own artwork, at the size its sprite really is. */
function itemImage(item: WikiItem): PreviewImage {
  if (item.sprite === null) return SITE_IMAGE;
  return {
    url: item.sprite,
    width: item.spriteTrim?.sourceWidth ?? 256,
    height: item.spriteTrim?.sourceHeight ?? 128,
    alt: item.name,
  };
}
