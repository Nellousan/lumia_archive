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
first, then by highest value, then alphabetically. A star in the corner of a card — or on the detail
header — **bookmarks** an item into the plan. Selecting a card opens its detail: rarity, real data
fields, the **crafting chain drawn as a tree**, and the **fastest routes**.

**Right pane — Lumia Island.** The **plan bar** sits directly above the island and lists what the map
and the routes answer for: the selected item, then every bookmark. Under it, the PNG artwork with the
image map overlaid as clickable polygons, and a **bubble anchored over every area that holds a
material the plan needs** — each bubble names the area and lists one compact card per material found
there, artwork plus the quantity available. Clicking any material opens it. Clicking an area opens a
wide slide-over with everything that spawns there, filterable down to just the current plan.
Highlight a route and the bubbles swap to that route's steps: **what gets picked up and what gets
built** at each one, numbered in walk order.

**Focusing a material widens up the chain.** Hovering a material in the recipe tree highlights the
areas holding it *and* the areas holding everything needed to craft it: strong amber for the
material itself, soft amber for its ingredients, and everything unrelated dims back. This matters
for intermediates that spawn nowhere — `iron_sheet` is not found anywhere on the island, so without
the widening, focusing it would highlight nothing at all.

Keyboard: `/` search · `Esc` closes the area panel, then unpins the highlighted route, then clears the
material focus.

**Clearing the map.** Two ways in, both dropping the *selection* while leaving all 22 areas drawn and
clickable:

- a cross button on the right of the item detail's identity row, so it costs no vertical space;
- the *Clear item* button where the legend used to be, which disables when there is nothing to clear.

Bookmarks are untouched by both — they are the plan, not the selection — so clearing while bookmarks
exist leaves their bubbles on the island, and leaves the routes on screen. The bar's own *Clear* is
what drops those.

Clicking the item that is already open in the rail also closes it (`selectionAfterCatalogClick` in
`hooks/useItemSelection.ts`), so the picker itself acts as a toggle. Nothing is selected on first
load — the map opens empty and the rail shows a "No item selected" placeholder.

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
      routes.ts           # minimal covering area sets -> inventory-aware routes
      inventory.ts        # bag/equipment slots, worn slots, starting clothes
      catalog.ts          # pure filter/sort/search rules for the rail
      taxonomy.ts         # category tabs, sub-tabs, type labels, rarity palette
      geometry.ts         # polygon centroid/anchor/bounds helpers
      map-image.ts        # base map dimensions (must match the PNG)
    map-layout.ts         # bubble size estimates + collision-aware placement
  instrumentation.ts      # startup hook: logs the dataset summary to stdout
  hooks/
    useCatalogQuery.ts    # rail filter state + every count the rail shows
    useItemSelection.ts   # open item + "back" trail through recipe links
    useBookmarks.ts       # the items kept in the plan, in the order they were added
    useRoutePlan.ts       # planned items -> materials -> bubbles -> placements -> routes
    useStepOverlay.ts     # the highlighted route's step bubbles, placed on the island
    useHotkeys.ts         # `/` and `Esc`
  components/
    explorer/WikiExplorer.tsx   # the client island; owns cross-pane UI state only
    layout/    AppHeader
    bookmarks/ BookmarkBar
    catalog/   CatalogPanel, SearchField, CategoryTabs, ItemCatalogGrid
    item/      ItemDetailPanel, UsedToCraftPanel, RarityBadge, ItemTypeBadges,
               ItemFactsGrid, RecipeTree, RecipeBranch, RoutePlanPanel, RoutePlanList
    map/       IslandMapPanel, IslandMap, MapAreaShape, AreaBubbleCard,
               BubbleMaterialCard, RouteStepBubbleCard, MapTooltip, RouteOverlay,
               regionStyles
    area/      AreaDetailPanel
    ui/        ItemCard, ItemSprite, BookmarkButton, Badge, PaneDivider, ClearSelectionButton
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

- 346 items, **174 craftable**, 22 areas, `research_center` has no loot.
- 153 items appear in an area; the other 193 do not, and 24 of those have no recipe either — those
  are the components a route assumes are already carried (see below).
- 331 loot slots collapse to **330 distinct area/item pairs** — Alley lists Scrap Metal twice
  (×2 and ×9); the loader sums them to ×11 and reports it as a data note.
- 644 sprites shipped; **192/194 items have one** (`egg_bun` and `bat` do not), 452 sprites are
  unused extras.

### Data caveats, surfaced at startup

Everything the loader has to work around is collected in `dataset.warnings` and printed to stdout as
a single line, once per process, by `instrumentation.ts` (with `getWikiDataset` as the fallback for
`next build`). It used to be a collapsible strip at the bottom of the island pane, but that is a
contributor concern rather than something a reader of the wiki needs. Currently:

1. `egg_bun` and `bat` have no sprite in `public/items`.

Unknown recipe references are also reported and dropped rather than crashing the tree, and a type
missing from `CATEGORY_TABS` raises its own note.

---

## Interaction decisions worth knowing

- **What the bubbles show.** Areas holding a **material of the current plan** — the selected item
  plus every bookmark, see `useRoutePlan`. One bubble per area, one card per material found there,
  with the quantity available in that area; a material two planned items both need collapses into
  one card with the summed quantity. Bubbles are spread by a small collision solver
  (`lib/map-layout.ts`) and clamped inside the map.
- **The plan bar.** Bookmarked items sit directly above the island, and everything listed there
  drives it: the bubbles, and the routes — so a couple of bookmarks are enough to get routes, with
  nothing selected. The selected item appears alongside the bookmarks so it is
  never a mystery which requirements the paths were computed from — it is the only entry that is not
  a bookmark, and reads as `sel`. Clicking an entry takes it out of the plan: the selected item
  closes, a bookmark is dropped. An item that is both closes first and stays bookmarked.
- **Spawn-mode fallback.** ~149 of 194 items have no recipe at all (they are gatherable). Showing an
  empty map for them would be useless, so those items fall back to mapping **where the item itself
  spawns**. `MapOverlayMode` marks the distinction, and the map eyebrow reads *Item spawn map* rather
  than *Live resource map* so the mode is never ambiguous. Set by `useRoutePlan`.
- **Fastest routes, not a spawn list.** The rail's bottom section lists the ways to gather everything
  the plan needs, best first, and highlights the picked one on the island when hovered or clicked
  (`Esc` releases it). It sits outside the item detail on purpose: the routes answer for the bookmarks
  as well as the open item, so they stay on screen with nothing selected at all. The list covers the
  whole plan, so its header says how many items it is answering for, and every route shows its steps:
  which area, what gets picked up there, and **what gets built there**. A **starting-armor
  selector** sits above the list: a survivor can pick one clothes piece before the match, starts
  wearing it (so it costs no bag slot), and the routes are recomputed around it. It defaults to the
  game's own unset marker, `-`, and offers `fabric_armor`, `windbreaker`, `cassock`, `doctor_s_gown` and
  `full_body_swimsuit` — three of which feed a recipe, so the choice is not cosmetic: wearing a
  windbreaker takes `rocker_s_jacket` from 2 moves to 1, and a doctor's gown takes `dress` from 1
  move to 0. `data.json` carries no travel
  times, and any area can be reached from any other in the same amount of time, so a route costs
  exactly its number of hops and ranking reduces to *"cover every requirement with the fewest
  areas"*.
  `lib/wiki/routes.ts` sweeps every subset of the areas holding something relevant and keeps only
  inclusion-minimal covers — a route with a spare area is strictly slower, so it is never listed.
  The sweep works on **area bitmasks** over requirements whose stock is pre-indexed per candidate
  area, which is what keeps a five-item plan under 20 ms: a Set-based version of the same search took
  3.2 s on `h_fu + rocker_s_jacket + magazine + gauntlet + long_rifle`. Above 20 candidate areas —
  reachable only by a wide plan — areas that another area out-stocks are dropped first, and beyond
  that a greedy search takes over. At most **100 routes** are returned; the fastest few are shown, so
  the cap only ever drops slower lists.
  Requirements keep the recipe's OR structure: a craftable material is satisfied when the route can
  gather it *or* craft it from what it gathers, which is why `magazine` (craftable *and* gatherable)
  offers two 0-move routes before any crafting route. Stack sizes are honoured: needing two Scrap
  Metal forces two areas when no single area holds both. Several planned items just stack their
  requirements.
- **Components the island cannot supply are carried, not searched for.** Some materials have no
  location in `data.json` at all — creature drops, random spawns, the rare finds (`mithril`,
  `meteorite`, `tree_of_life`, `holy_blood`, `ogre_skin`, `bread`, the `crude_*` weapons). A route
  takes those as already in the pack rather than declaring the plan impossible: each is spent once,
  walks in with the survivor (taking its bag slot like anything else, and getting worn at the first
  stop if it is equipment), and is never gathered or built. Only items with **no area and no recipe**
  qualify — a craftable intermediate such as `iron_sheet` spawns nowhere but its recipe is known, so
  it is still made from its ingredients. The route panel names what it is assuming, and a plan that
  is entirely carried (`mithril` on its own) says *"Nothing to gather"* instead of showing a walk.
- **The pack decides what is possible.** Six bag slots hold everything that is not worn, and each
  worn slot (`weapon`, `head`, `clothes`, `arm`, `leg`, `accessory`) takes one item — see
  `lib/wiki/inventory.ts`. The eight weapon types share the single weapon slot, gear spilling into the
  bag is allowed, and capacity counts *stacks*, not units: three Iron Ore are one slot. Every
  candidate route is walked by simulation (`runRoute`), and nothing that would not fit is ever picked
  up or built. The rule is **build as soon as the ingredients are in the pack** — that is what frees
  room, two ingredients becoming one item, and it is why each step lists a build. Wearing is free and
  always taken, since it can only open space.
  Two consequences are easy to miss. A craft can *cost* a slot when it eats one unit of a stack that
  stays behind, so crafts are checked against the pack just like pickups. And the visit order stops
  being cosmetic: it decides which ingredients are in hand when, so covers of four areas or fewer are
  tried in every order while wider ones sample nearest-neighbour sweeps, rotations of the tidiest line
  and shuffles under a shared run budget. A plan nothing can carry says so — *"No route fits the
  pack"* — rather than showing a route that would not work.
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
  exactly what exists: rarity, type(s), value, default quantity, recipe and routes. Nothing was
  invented. An item nothing can obtain is reported instead of
  silently dropped — though components the island has no location for are assumed to be carried
  rather than blocking a plan. Value sits with the identity (name / id / value); the facts grid below carries only
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
- The route solver was swept over **all 201 items** through a temporary route handler: **758 routes,
  0 violations** — sorted by moves then walk distance, no duplicate route ids, no stop that gathers
  nothing, no area visited twice, and no listed route containing a cheaper one. Every route was then
  re-checked against its *own* harvest list, independently of the search: all 758 satisfy their
  recipe. Counts were cross-checked against a separately written prototype and matched everywhere
  except `magazine` and `long_rifle` — the two craftable items that also spawn, which is exactly
  where the OR rule admits "just pick it up" routes. The worst item is `h_fu` (84 routes) and no item
  took more than a few milliseconds.
- The route UI was rendered server-side for `gauntlet` and asserted: the moves label, the fold
  button, the per-stop "what to pick up here" tooltips, a dashed polyline through both area anchors,
  two numbered stop markers, 2 route-tinted polygons, 20 dimmed ones and 2 emphasised bubbles.
- The plan was swept over **333 two- and three-item plans** (random pairs and triples plus every pair
  drawn from ten recipe-heavy items): **8 107 routes, 0 violations**. Every plan whose items are all
  individually obtainable satisfied all of its trees; the 31 blocked plans (a `bread`, `hunting_trap`
  or `egg_bun` in the mix) correctly produced none; no plan leaked bubbles outside the map and
  **0 bubbles overlapped** even at three items, where the busiest bubble held 5 cards. Worst-case
  plan time was **17 ms**.
- The rendered plan UI was checked with a preset plan: the bar lists the selected item first
  (`sel`) then the bookmarks, card stars carry `aria-pressed` and stay hidden until hover, the route
  header names the plan size, `h_fu + gauntlet` maps the union of both recipes (12 materials, with
  shared ones summed), and a plan containing `bread` names it instead of showing an empty list.
- The inventory-aware run-through was swept over **274 plans** (random pairs and triples plus every
  pair of ten recipe-heavy items and plans up to ten items). Every emitted route was replayed from
  its own steps against `data.json`, independently of the search that produced it: each pickup matched
  the area's real stack, each build had its ingredients in hand at that moment, every planned item was
  built by the end, no step exceeded **6 bag slots** (peak across the sweep: **5**), and the reported
  pack usage matched the replayed one. Two real bugs fell out of this and are fixed: a step could draw
  the same stack twice, and a craft that ate one unit of a larger stack could push the pack to seven.
  Step bubbles never overlapped (0 pairs) and never left the map. Worst plan: **263 ms** for ten items.
- The rendered plan UI was checked without any selection: with two bookmarks and nothing open, the
  rail keeps its "No item selected" placeholder *and* shows the routes, with per-step "pick up … /
  build …" lines and `pack n/6`; pinning a route swaps the island to step bubbles (6 build cards, 8
  pickup cards, numbered badges, "nothing built here" where a step only gathers) while an unpinned map
  still shows the plan's material cards. A plan of ten items renders the *"No route fits the pack"*
  state, and one containing `bread` names it.
- With components assumed rather than blocking, a sweep over **318 plans × 6 starting choices**
  (**1 908 runs, 49 278 routes**) reported no violations: every route replayed from the carried
  components and worn clothes, nothing assumed was ever gathered or built, the pack never passed 6
  slots and always matched its reported use, and 222 runs were plans needing no travel at all. The
  only plans left without a route are ones the pack genuinely cannot hold — a 12-item plan carrying
  6 rare components alongside its materials. Worst run: 144 ms.
- The starting-armor option was swept over **214 plans × 6 choices** (bare plus all five clothes):
  **1 284 runs, 40 117 routes, 0 violations** — every route replayed from the picked clothes, pack
  never over 6 slots (peak 5) and always matching its reported use. It made 23 plans faster and left
  nothing slower than starting bare. `rocker_s_jacket` drops from 2 moves/3 areas to 1 move/2 areas
  with a windbreaker (which stops appearing in the pickups), `dress` drops from 1 move to 0 with a
  doctor's gown, and `bishop_s_cassock` switches which single area it needs. Worst run: 130 ms.
- The startup line was verified on a real `next start`: it prints once, before the first request —
  `[lumia-archive] data ready — 201 items · 22 areas (22 mapped) · 39 craftable — 2 data note(s): …` —
  and the island pane no longer renders any data-notes strip.

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
