# Lumia Archive — Black Survival interactive wiki (PoC)

An interactive item/resource wiki for **Black Survival** (the 2015 game set on Lumia Island).
It is deliberately *not* Eternal Return — the two are constantly confused, so the header says so.

Built with **Next.js 16 · React 19 · TypeScript · Tailwind CSS v4**.

This is a proof of concept: the UI is a clean rebuild of the Figma mock, the island is the real
`lumia_island.png` with the real image map, and every value comes from `data.json`.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

| Script                  | What it does                                                              |
| ----------------------- | ------------------------------------------------------------------------- |
| `npm run dev`           | Dev server on :3000 (regenerates the sprite manifest first)               |
| `npm run build`         | Production build (regenerates the sprite manifest first)                  |
| `npm run start`         | Serve the production build                                                |
| `npm run lint`          | ESLint via `eslint-config-next` (flat config)                             |
| `npm run typecheck`     | `tsc --noEmit`                                                            |
| `npm run assets:manifest` | Regenerates `src/data/item-assets.json` from `public/items/*.png`       |

> If you install inside a sandbox where `~/.npm` is read-only, point the cache somewhere writable:
> `npm_config_cache=$PWD/.npm-cache npm install`. `.npm-cache/` is already git-ignored.

---

## What it does

Two panes:

**Left rail — the compendium.** Search (`/` focuses it), five category tabs each with their own
sub-tabs, and a four-column grid of item cards. Each card shows the artwork, the name, then the
rarity dot with the type and — when `data.json` has one — the value. The grid is ordered rarest
first, then by highest value, then alphabetically. Selecting a card opens its detail: rarity, real
data fields, the **crafting chain drawn as a tree**, and every area the item spawns in.

**Right pane — Lumia Island.** The PNG artwork with the image map overlaid as clickable polygons.
For the selected item, a **bubble is anchored over every area that holds a material from its
crafting recipe**; each bubble names the area and lists one compact card per recipe material found
there — artwork plus the quantity available. Clicking any material opens it. Clicking an area opens
a wide slide-over with everything that spawns there, filterable down to just the current recipe.

**Focusing a material widens up the chain.** Hovering a material in the recipe tree highlights the
areas holding it *and* the areas holding everything needed to craft it: strong amber for the
material itself, soft amber for its ingredients, and everything unrelated dims back. This matters
for intermediates that spawn nowhere — `iron_sheet` is not found anywhere on the island, so without
the widening, focusing it would highlight nothing at all.

Keyboard: `/` search · `Esc` closes the area panel, then clears the material focus.

**Clearing the map.** Two ways in, both emptying the island of bubbles while leaving all 22 areas
drawn and clickable:

- a cross button on the right of the item detail's identity row, so it costs no vertical space;
- the *Clear map* button where the legend used to be, which disables when there is nothing to clear.

Clicking the item that is already open in the rail also closes it (`selectionAfterCatalogClick` in
`hooks/useItemSelection.ts`), so the picker itself acts as a toggle. With nothing selected the rail
shows a "No item selected" placeholder.

### Rarity palette

| Tier      | Colour                                                        |
| --------- | ------------------------------------------------------------- |
| Common    | stone                                                          |
| Uncommon  | emerald                                                        |
| Rare      | blue (`sky`)                                                   |
| Epic      | purple                                                         |
| Legendary | yellow lettering on a violet-tinted plate; the dot runs gold → violet |

`data.json` currently only uses the first three tiers. The whole ladder is declared in
`RARITY_META` anyway, so a new tier in the data renders correctly with no code change — and the
classes are real string literals in `taxonomy.ts`, so Tailwind emits them even while unused (checked
in the generated CSS). An unrecognised rarity string is treated as `common` and raises a data note.

### Category tabs

`CATEGORY_TABS` in `lib/wiki/taxonomy.ts` is the single source of truth for both levels:

| Tab    | Sub-tabs                                            | Items |
| ------ | --------------------------------------------------- | ----- |
| All    | *(none — filters nothing)*                          | 194   |
| Normal | Enhance, Special, Ingredients                        | 25    |
| Food   | Health, Stamina                                      | 35    |
| Gear   | Head, Clothes, Arm, Leg, Accessory                   | 38    |
| Weapon | Blade, Stab, Blunt, Thrown, Gun, Bow, Hand, Trap      | 96    |

Both levels are underline tabs — amber for the top level, a smaller emerald treatment for the
sub-tabs — so they read as a hierarchy.

Sub-tabs come from that table rather than from the items present, so the strip keeps its shape as
the dataset grows. This grouping matches the source wiki's own `itemcategory` values — notably
`hand` really is *Weapon (hand)* there (Knuckle, Claw, Gauntlet…), not an armor slot.

**`Special` is empty**: neither `data.json` nor the source manifest contains a `special` type yet.
The tab is declared anyway, shows a count of `0`, and will start working as soon as items carry the
type. A type missing from `CATEGORY_TABS` would make its items unreachable from every named tab, so
the loader raises a data note if that ever happens.

---

## Project structure

```
scripts/
  generate-item-asset-manifest.mjs   # public/items/*.png  ->  src/data/item-assets.json
  lib/png-alpha-bounds.mjs           # visible-pixel bounding box of a PNG sprite

src/
  app/
    layout.tsx            # html shell, fonts (Manrope + Barlow Condensed), metadata
    page.tsx              # server component: builds the dataset, renders the explorer
    globals.css           # Tailwind v4 import, design tokens, map + base styles
  data/
    data.json             # items, areas, animals  (source of truth)
    lumia-island.map.json # 22 area polygons in PNG pixel space
    lumia-island.map.html # original image map, kept for reference
    item-assets.json      # GENERATED sprite manifest
  lib/
    wiki/
      types.ts            # Raw* JSON shapes + the normalized domain model
      dataset.ts          # the only module that touches the JSON
      recipe.ts           # recursive recipe tree + flattened material list
      route.ts            # recipe materials x areas -> map bubbles
      catalog.ts          # pure filter/sort/search rules for the rail
      taxonomy.ts         # category tabs, sub-tabs, type labels, rarity palette
      geometry.ts         # polygon centroid/anchor/bounds helpers
      map-image.ts        # base map dimensions (must match the PNG)
    map-layout.ts         # bubble size estimates + collision-aware placement
  hooks/
    useCatalogQuery.ts    # rail filter state + every count the rail shows
    useItemSelection.ts   # open item + "back" trail through recipe links
    useRoutePlan.ts       # item -> tree -> materials -> bubbles -> placements
    useHotkeys.ts         # `/` and `Esc`
  components/
    explorer/WikiExplorer.tsx   # the client island; owns cross-pane UI state only
    layout/    AppHeader, DataNotes
    catalog/   CatalogPanel, SearchField, CategoryTabs, ItemCatalogGrid
    item/      ItemDetailPanel, UsedToCraftPanel, RarityBadge, ItemTypeBadges,
               ItemFactsGrid, RecipeTree, RecipeBranch, SpawnAreasList
    map/       IslandMapPanel, IslandMap, MapAreaShape, AreaBubbleCard,
               BubbleMaterialCard, MapTooltip, regionStyles
    area/      AreaDetailPanel
    ui/        ItemCard, ItemSprite, Badge, PaneDivider, ClearSelectionButton
public/
  lumia_island.png        # base map (1503 x 774)
  items/*.png             # 644 item sprites, served as /items/<itemId>.png
_reference_figma/         # the original Figma Make export + zip, kept for reference
```

## Architecture

**One data boundary.** `lib/wiki/dataset.ts` is the only module that imports the JSON. It
normalizes every wart once and returns an immutable `WikiDataset` with lookup tables. Everything
downstream consumes that model, so replacing the static files with a CMS or an HTTP API means
reimplementing `buildWikiDataset` and nothing else.

**Pure derivation layers.** `recipe.ts` → `route.ts` → `map-layout.ts` turn an item into the map
overlay. Each is a plain function over plain data: no React, no state, easy to test.

**State lives in hooks.** `useCatalogQuery`, `useItemSelection` and `useRoutePlan` own all state;
`WikiExplorer` only holds the cross-pane bits (map focus, hovered area, open area panel). Every
component below that is presentational.

**Server/client split.** `app/page.tsx` is a server component that builds the dataset and hands it to
`WikiExplorer`, the single client island.

**The image map is a real overlay.** `lumia-island.map.json` coordinates are pixel offsets into the
PNG, so the `<img>`, the SVG `viewBox` and the dataset all use the same `1503 x 774` space — no
scaling maths anywhere.

---

## Data

| File                      | Role                                                                        |
| ------------------------- | --------------------------------------------------------------------------- |
| `data.json`               | Source of truth: 194 items, 22 areas, 1 animal (**ignored**, as requested)   |
| `data.json` (live)        | May change under you — the loader reports anything it cannot resolve          |
| `lumia-island.map.json`   | The image map: 22 polygons, `title` = area id, `alt` = display name          |
| `item-assets.json`        | Generated: which sprites exist, plus the visible-pixel box of each one       |
| `public/items/_manifest.json` | Untouched scraper output from the Black Survival fandom wiki — see below |

### Derived facts about the current dataset

- 194 items, **32 craftable** (max recipe depth 2), 22 areas, `research_center` has no loot.
- 331 loot slots collapse to **330 distinct area/item pairs** — Alley lists Scrap Metal twice
  (×2 and ×9); the loader sums them to ×11 and reports it as a data note.
- 644 sprites shipped; **192/194 items have one** (`egg_bun` and `bat` do not), 452 sprites are
  unused extras.

### Data caveats, surfaced in the app

Everything the loader has to work around is collected in `dataset.warnings` and shown in the app
under **“data notes”** (and logged in dev). Currently:

1. `egg_bun` and `bat` have no sprite in `public/items`.
2. Alley lists Scrap Metal twice (×2 and ×9); the loader sums the slots to ×11.

Unknown recipe references are also reported and dropped rather than crashing the tree, and a type
missing from `CATEGORY_TABS` raises its own note.

---

## Interaction decisions worth knowing

- **What the bubbles show.** Areas holding a **material of the selected item's crafting recipe**.
  One bubble per area, one card per material found there, with the quantity available in that area.
  Bubbles are spread by a small collision solver (`lib/map-layout.ts`) and clamped inside the map.
- **Spawn-mode fallback.** ~149 of 194 items have no recipe at all (they are gatherable). Showing an
  empty map for them would be useless, so those items fall back to mapping **where the item itself
  spawns**. `MapOverlayMode` marks the distinction, and the map eyebrow reads *Item spawn map* rather
  than *Live resource map* so the mode is never ambiguous. Set by `useRoutePlan`.
- **One card everywhere.** `ui/ItemCard.tsx` renders the catalog grid and the recipe tree, so an
  item always looks the same. Its artwork uses the `fill` sprite size, which is why the card works
  both at the four-column rail width and inside a nested recipe branch.
- **Map bubble cards are square and trimmed.** `map/BubbleMaterialCard.tsx` shows a square of
  artwork with the quantity underneath, and nothing else: the bubble header already names the area,
  and the item name lives in the `title`/`aria-label`. Bubble and card sizes are shared constants in
  `lib/map-layout.ts` so the placement estimates cannot drift from what renders.
- **Sprites are cropped to their visible pixels.** The source canvases are 2:1 with the artwork
  floating in transparent margin — a median **41% of the area is dead space**. `scripts/lib/png-alpha-bounds.mjs`
  measures the bounding box (a small hand-written PNG reader, so no extra dependency) and
  `generate-item-asset-manifest.mjs` records it per sprite. `ItemSprite`'s `tile` size then scales
  the image by `max(width, height)` and offsets it so that box fills a square container. In a 68px
  bubble card the visible item goes from a median 39px to 58px wide — a 49% increase — for nothing
  at runtime.
  The select-item cards keep the full 2:1 canvas via the `fill` size, as requested.
- **Catalog order.** Rarest first, then highest value, then alphabetical — `compareForCatalog` in
  `lib/wiki/catalog.ts`. Items with no value sort after those with one.
- **Used to craft.** `dataset.usedToCraftByItemId` is a reverse recipe index built during
  normalization, surfaced as a horizontally scrollable strip of cards between the item picker and the
  item detail. 41 of the 194 items are an ingredient for something; the strip keeps its header and
  shows a short empty state for the rest, so the rail never jumps as you browse.
- **No legend.** The map header carries the clear button instead of a colour key; the polygon tints
  are self-explanatory once a material is focused, and the eyebrow names the current mode
  (*Live resource map*, *Item spawn map*, or *Island overview* when nothing is selected).
- **Area panel.** Three quarters of the map pane wide (min 320px, max 900px), listing the area's
  loot on the same card as the rail with the quantity found there in place of the rarity/type/value
  line (`ItemCard`'s `footnote` prop). Items are bucketed under the four named category tabs, most
  actionable first — Weapon, Gear, Food, Normal, i.e. `"reverse"` of the rail's tab order, via
  `groupByCategoryTab`'s `order` argument — and sorted inside each bucket by the catalog rule. Every
  item in `data.json` belongs to exactly one tab, so nothing is ambiguous.
- **Recipe tree.** Every recipe in `data.json` has exactly two direct ingredients, so `RecipeBranch`
  lays siblings side by side and splits the width evenly: the sub-ingredients end up about the size
  of a catalog card. Connectors are drawn per column as two half-width rail segments plus a vertical
  stub, so the halves meet exactly between two cards. Quantities are omitted because every recipe
  entry is one unit. Recursion is bounded and cycle-guarded in `lib/wiki/recipe.ts`, so nothing
  assumes a depth. Hover a material to focus it on the map, click to open it, and use `← Back` to
  walk the trail you followed through the chain.
- **Only real fields.** `data.json` has no description or flavour text, so the detail panel shows
  exactly what exists: rarity, type(s), value, default quantity, spawn areas and recipe. Nothing was
  invented. Value sits with the identity (name / id / value); the facts grid below carries only
  default quantity, spawn-area count and recipe shape.

---

## Verification performed

- `tsc --noEmit`, `eslint .` and `next build` all pass clean; the page prerenders as static.
- Server-rendered HTML verified against the real data: 22 polygons, all 22 area names, the map PNG,
  sprite URLs, and the bubbles with correct anchors and quantities.
- Every `<img>` in the rendered page was checked to sit inside a sized frame — no sprite can render
  at its intrinsic 256×128 size.
- The recipe tree was checked structurally against `gauntlet` (2 ingredients, one of which has 2 of
  its own): 10 connector segments, correct render order (`Cotton Work Glove, Steel, Iron Ore,
  Scrap Metal`), no quantity markers.
- The taxonomy was asserted over all 194 items: 0 items unreachable from any named tab, tab and
  sub-tab order preserved, `Special` correctly reporting 0.
- The catalog order was verified as a strict sequence across all 194 items — 0 violations of
  rarity → value → name.
- The rendered page was checked for the tab strip, the sub-tab strip (9 tabs under Weapon, `Hand`
  active, grid down to the right 7 items), the bubble card's markup, and the value's new position
  under the name and id.
- The hand-written PNG reader was validated against Pillow on **all 644 sprites**: 0 decode errors,
  0 bounding-box mismatches.
- Trim geometry was asserted for every sprite: each visible box is centred in the square, fills its
  long axis exactly, and never overflows.
- The bubble solver was re-swept after the bubbles were resized: 0 out-of-bounds placements across
  all 194 items, and the busiest item's 10 bubbles resolve to 0 overlapping pairs.
- Focus widening was checked against hand-computed expectations: focusing `long_rifle` produces 2
  strong-amber areas (where it spawns) + 6 soft-amber areas (bamboo/gunpowder) + 1 dimmed; focusing
  `iron_sheet`, which spawns nowhere, produces 0 strong and 8 soft, where the old behaviour gave 0.
- The cleared state was checked end to end: 0 bubbles, 0 amber/emerald tints, all 22 polygons still
  drawn and clickable, the used-to-craft strip hidden, a "No item selected" placeholder in the rail,
  and both clear buttons disabled.
- The area panel was cross-checked against `data.json` for Alley: 14 stacks summing to 59, in the
  order Weapon (9 items), Gear (Bracelet 4, Running Shoes 3), Food (Ramen 2), Normal
  (Cloth 5, Scrap Metal 11).
- A temporary diagnostics route swept **all 194 items** through the full pipeline and asserted:
  0 violations · no duplicate material or card ids · every bubble inside the map bounds · max 10
  bubbles for a single item (`magazine`) · max 2 cards per bubble · max material depth 2.
  The bubble solver was probed separately for overlap separation and edge clamping.

---

## Suggested next steps

1. **Descriptions are available.** `public/items/_manifest.json` (already in the repo) carries a
   `quality` field with real effect text — `12 Damage`, `70 Health`, `12 Armor` — for 192 of the 194
   items, plus a canonical rarity string. Wiring it in is a small, isolated change to `dataset.ts`.
   It was left out because you asked for `data.json` to be the only source.
2. **URLs.** Deep links (`/items/[id]`, `/areas/[id]`) would make the wiki shareable and give
   back/forward for free.
3. **Tests.** The `lib/wiki/*` and `lib/map-layout.ts` functions are pure and are the natural target
   for a unit-test setup (Vitest), replacing the throwaway diagnostics route used here.
4. **Sprites.** Sources are 2:1 canvases with ~33% horizontal transparent padding. Trimming them to
   their content box once at build time would let the same artwork fill a smaller footprint.
5. **Animals.** `data.json` ships one animal (`crow`) with loot and area data — untouched for now.
6. **The 452 unused sprites** are all valid Black Survival items; they are ready if you widen the
   dataset.
