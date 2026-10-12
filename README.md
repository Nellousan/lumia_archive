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

### Sharing links

A link posted to Discord, Slack or anywhere else unfurls into a card carrying the site's mark: the
page serves `og:*` and `twitter:*` tags, and `public/og.png` is the square the card shows.

Unfurlers fetch the page from their own servers, so those URLs have to be absolute and publicly
reachable — a loopback origin in the tags is a card nobody can render. They resolve against
`https://lumia-archive.vercel.app`; on Vercel the project's own production domain
(`VERCEL_PROJECT_PRODUCTION_URL`) takes precedence, so a custom domain later needs no code change.
`NEXT_PUBLIC_SITE_URL` overrides both:

```bash
NEXT_PUBLIC_SITE_URL=https://lumia.example npm run build
```

Discord caches an embed for as long as the message lives, which is why re-posting it (or appending
`?v=2` to the URL) is what makes it read the tags again — and why a link posted before the tags
shipped keeps its blank card. That is the card for the archive itself; a link that carries a plan gets
a card of its own, described next.

### Sharing a route

The address bar *is* the plan: one opaque parameter, `?p=…`, kept in step with what is on screen — the
same thing a refresh, a bookmark, the browser's own "copy link" and handing the tab to another device
all read back. Every walk in the rail also carries a **Share** control in its bottom right corner,
which copies that URL with *its* stops in it, so one can point at a route without pinning it first.

The payload holds two things: the **plan** — the open item, the bookmarks in the order they were added,
the starting armor — and the **walk**, the areas of the route that was on screen, in visit order.
Opening such a link selects the **Manual** mode with that walk as the trace, held down by the island's
**lock** — so the reader arrives on the same route, reading it the way a computed route is read — and
one click on the lock lets them keep editing it: adding a stop, taking one out, and sharing the result
again.

It used to carry a ranking mode, a look-ahead window and a *rank* instead — the position of a route in
the list the plan produced. That made every link a promise about the solver: any change to how routes
were ranked or ordered repointed every link ever posted, and both the reader's browser and the unfurl
card had to run the whole search again to find out which route was meant. The walk is now named
outright, so a link says the same thing whatever the solver does next, and nothing has to be computed
to open one.

**Packed, not compressed.** Compression plus base64 was the obvious move and the measurement says no:
these payloads are far below the size where deflate pays for itself, and base64 then adds a third back
on. In characters of query string, over real plans (`node _verify/check-share-codec.cjs`):

| plan                        | six parameters | packed here |
| --------------------------- | -------------- | ----------- |
| one item                    |             25 |      **14** |
| item + two bookmarks        |             71 |      **19** |
| ten items                   |            134 |      **50** |

A walk costs three bytes a stop on top of that — 18 characters for a six-stop route, 34 for a
thirteen-stop one — which is the whole price of nobody having to solve anything.

What shortens the link is not squeezing the ids but not spelling them out: an id averages 13 bytes and
is filed under a 3-byte code here. It is five bytes of header (version, flags, armor, bookmark count,
stop count) and then three bytes per id, base64url'd so the whole thing rides in one URL-safe token.

**The code is derived from the id, never from its position** — the high 24 bits of an FNV-1a hash — so
reordering or extending `data.json` cannot silently repoint a link. Items and areas share the code and
the rule: an id the data no longer has resolves to nothing and drops out, so a link opens the part of
its plan and the part of its walk that still exist. A code the data gives *twice* resolves to neither,
because planning the wrong item silently is the one failure this format cannot see; the check asserts
that no two of the current 629 item ids and no two of the 22 area ids collide, and `FORMAT` exists so
the code can widen to 32 bits if that ever changes. The two tables are separate, so an item code and an
area code that happen to match are harmless.

Only that one key is ever touched: a campaign tag, or the `?v=2` Discord needs to read a cached embed
again, sits beside it untouched. Writes go through `replaceState`, so nothing is pushed and Back still
leaves the archive; hovering a route changes nothing (only the *pinned* one is in the payload); and a
URL that already says the right thing is left alone rather than replaced with itself. A payload that is
not a plan — truncated, tampered with, or from an older format — is ignored, and since the URL is
written from the state it is then written back out, so junk does not accumulate in the address bar.
The retired six-parameter form (`?i=&b=&a=&m=&l=&r=`) is not read any more; it was never released.
Nor is the version that followed it, which carried a rank: it names a route by its position in a list
this build may no longer produce, which is exactly the fragility the walk replaced. Links are built
from the origin you are reading on, so one copied from a dev server points at `localhost`.

**Where the rail lands.** A link says what the reader came for, and the rail is scrolled to match. A
link that names a walk scrolls to the **trace** — that is the thing it carries, and it sits below the
catalogue, the crafting half of the item and the ranked list, so without the scroll a reader would land
on an item's recipe with their own route off screen. An item open with no walk behind it brings the
**Used to craft** section flush against the header instead: that item is what the reader is here for,
and the catalogue above it is what they scrolled past. The move is made on the rail's own `scrollTop`
rather than with `scrollIntoView`, which walks *every* scrollable ancestor and would scroll the
document too — landing the section under the header instead of against it (`lib/scroll.ts`). A plan of
bookmarks alone has no item to open and keeps the default top. The scroll is spent on arrival:
browsing on from there never pulls the rail back.

### Link previews

A shared link unfurls into a card that says what it points at, and an unfurler runs no JavaScript, so
the card is built on the server from the same payload the browser decodes (`lib/wiki/preview.ts`).
Four shapes, decided in this order:

| the link carries            | title                                     | description                              | image |
| --------------------------- | ----------------------------------------- | ---------------------------------------- | ----- |
| a walk, as its areas        | `Lumia Archive - N items route (M Areas)` | the items, then `Alley → Town Hall → …`  | Dr. Nadja |
| a plan, several items       | `Lumia Archive - N items plan`            | the items, in plan order                 | the site's mark |
| one bookmark, nothing open  | `Lumia Archive - 1 item plan`             | that item                                | the site's mark |
| one item open, no plan      | `Lumia Archive - <item>`                  | `Blade 46` and `Craft: Odachi + Blueprint` | the item's own sprite |

An item card is two lines at most — what it is and what it is worth, then what it is made of — and
either line drops when the data has nothing for it: `Scrap Metal` reads just `Ingredients`, and an
item with a recipe but no sprite (`Egg Bun`) falls back to the site's card. The route's areas are the
ones the link names, read straight out of `data.json`: **no unfurl runs the solver any more**, and the
route card costs what a plan card costs — measured at **23 ms against 26 ms** for the same three-item
plan on `next start`, where the ranked-route card it replaced took about 200 ms. The check times both
so the difference cannot come back unnoticed, and compares the card's areas, area for area, with the
ones the page draws as the trace.

`og:url` carries the URL that was shared, query and all — keying every card on the bare origin would
tell an unfurler that all plans are the same page. The canonical link stays `/` for crawlers, so plans
are not indexed as separate pages. Whatever the payload turns out to be — junk, an older format, a
walk whose areas have since been renamed — the card falls back to the site's own.

Because the card depends on the query, the page is rendered per request rather than prerendered: a
plan link costs about **26 ms** of server time and a route link the same, measured on `next start`
with eight requests each, the first of each kind discarded. The dataset is built once per process and
the card is a lookup in it.

The images are `public/og.png` (the archive's mark), `public/dr-nadja.png` (the route card, a square
cropped from `assets/dr-nadja.png`) and, for an item, its own sprite at `/items/<id>.png` — declared at
256×128, the size those sprites really are.

---

## What it does

Two panes:

**Left rail — the compendium.** Search (`/` focuses it), five category tabs each with their own
sub-tabs, and a grid of item cards. The rail opens on **Weapon → Blade**, and the grid is **paged**
rather than scrolled: 12 cards, four columns of three rows, with a previous/next pager underneath
(hidden while a filter fits on one page). Each card shows the artwork, the name, then the rarity dot
with the type and — when `data.json` has one — the value. Items are ordered rarest first, then by
highest value, then alphabetically, and the counter above the grid reads *matched / total*. A bookmark ribbon in the corner of a card — or on the detail
header — keeps an item in the plan. Selecting a card opens its detail: rarity, real data
fields, the **crafting chain drawn as a tree**, and the **fastest routes**.

**Two ways to rank a route, and a third to walk your own.** *Fastest* (the default) is the walk:
fewest areas, then the tidiest line. *Greedy* is about not spending the trip naked — in this game a
survivor who hauls every ingredient to one spot and crafts at the end is weak the whole way — so at
**every** step it asks what the next N areas (2 by default, 1–6) can leave the survivor wearing, and
ranks the resulting profile step by step; ties fall through to the same question asked with N-1
areas, then N-2, down to 1, which is what keeps a wider look-ahead *refining* a narrower one rather
than contradicting it. Each step prints the worn value beside its pack dots, so the curve being
ranked is visible. Which walk through a given set of areas greedy returns is **searched**, not
sampled: the walk is grown area by area, the candidates are ranked on the peaks they have already
settled, and the good orders are found rather than hoped for — see *How greedy finds its walk*
below. *Manual* ranks nothing: the reader clicks areas on the island and the walk is the order they
clicked, one stop per click, taken back out by clicking the area again. It is the same walk either
way — the solver runs underneath to say what each stop picks up and builds, and the trace is drawn
with the same numbered stops and the same cards. Every walk in the rail can be handed to someone
else with the **Share** control in its bottom right corner, which copies a link carrying *that
walk's areas* — see [Sharing a route](#sharing-a-route) — and opening one lands in Manual mode with
the trace prefilled, **locked**, and one click from editable. A route the solver found can also be
taken into manual directly, with **Open in manual** beside its Share control: the row's areas become
the trace, and the reader edits from there rather than clicking the whole walk back in.

**Right pane — Lumia Island.** The **plan bar** sits directly above the island and lists what the map
and the routes answer for: the selected item, then every bookmark. Under it, the PNG artwork with the
image map overlaid as clickable polygons, and a **bubble anchored over every area that holds a
material the plan needs** — each bubble names the area and lists one compact card per material found
there, artwork plus the quantity available. Pointing at a card is the only thing a card does: it
widens the answer to every other area holding that material (see *Focusing a material* below), and
clicking one does nothing at all. Opening a raw material from a bubble was a trap rather than a
shortcut — a reader comparing areas would click and lose the map they were reading — and the same
rule holds whether or not a route is highlighted, because both kinds of bubble card are drawn through
the same `ItemFrame` with no `onSelect`. Clicking an area opens a
wide slide-over with everything that spawns there; clicking the island outside it — or Escape, or
the ✕ — closes it.
Highlight a route and the bubbles swap to that route's steps: **what gets picked up and what gets
built** at each one, numbered in walk order. Those step cards are hover-only for the same reason: a
card that answers "where else is this?" while the pointer is on it must not also navigate when the
hand moves a pixel first. The random-spawn box is the one place a card still opens something, and on
purpose — nothing else can reach those items.

**Tracing by hand turns the island into the question.** In Manual mode the bubbles are answers on a
map whose only control is the polygons: every bubble lets the pointer through, and the one over the
area the pointer is in fades to a third so the reader can see and click the area under it. That is
also what makes the fade dependable — it follows *where the pointer is* rather than which element the
pointer happened to land on, so arriving on a card at speed no longer leaves the bubble at full
strength over the area being clicked. Clicking an area adds it to the walk and its bubble says what
the stop does: the item built there as an amber sparkle card, and each material the walk takes from it
as an amber `×needed` where a material card would have shown the area's own emerald `×in area` (the
same colour rule the step bubbles use). What the walk has already collected in full comes off every
other bubble, so what is left on the island is what is left to collect. The trace also stays on
screen while a material is focused from the rail — a stop is the reader's own answer, so it is never
dimmed away.

**Locking the walk hands the island back to the route.** The lock sits in the island's top-left
corner, opposite the animal-drop toggle and wearing the same shape, and it appears once there is a
walk to hold down. Locked, the trace stops being a drawing board and answers exactly the way a
computed route does: a click on an area opens its panel instead of adding a stop, the step cards take
the pointer, and pointing at one of them brings the material's other areas back with the unrelated
regions dimmed behind them — including for materials the walk has already collected in full, since
"where else is this?" is a question about the island rather than about what is left. Unlocked, every
bubble lets the pointer through again and the areas are clickable. Arriving on a shared walk lands
locked, because the reader came to read that walk first; **Open in manual** lands unlocked, because
they came to edit. Clearing the trace unlocks it with it, and the lock only exists in Manual mode.

**Focusing a material widens up the chain.** Hovering a material in the recipe tree highlights the
areas holding it *and* the areas holding everything needed to craft it: strong amber for the
material itself, soft amber for its ingredients, and everything unrelated dims back. This matters
for intermediates that spawn nowhere — `iron_sheet` is not found anywhere on the island, so without
the widening, focusing it would highlight nothing at all.

A pinned route replaces the material bubbles with its step cards, and hovering one of those cards
answers with the whole of the material view, not just its tints: the areas holding that material
that the route does **not** stop at get their material bubbles back, while the steps with nothing to
do with it fade to near-invisible. So the island behaves as it does with no route pinned — the
question the hover answers is the one a route *raises*, since the walk sends you to one area and the
reader wants to know whether it had to. A step that stays lit is the one whose area holds the
material, or which itself picks up or builds it: a craft has no spawn area, so hovering *build iron
sheet here* has to keep its own bubble. A build card is hoverable for the same reason, and it is the
only way to ask about an intermediate.

Three things about it are not obvious, and each was found by measuring rather than reasoning:

- **The bubbles that come back must not be able to take the pointer.** They sit around the route's
  cards, and one landing on the card being hovered ends the hover, which withdraws the answer, which
  returns the pointer to that card — a cycle measured at 13ms, strobing the island. They are drawn
  `pointer-events-none`: an answer must not be able to end the question that asked for it.
- **Only the steps that stay lit are obstacles** for the solve that places them. A faded step is on
  its way out, so a bubble settling over one costs nothing and the room it frees is what lets the
  answer space itself out.
- **A step bubble is not shaped like a material bubble.** A material bubble's width is pinned, so its
  cards wrap at three and it grows downwards; a step bubble is content-sized, so its cards never wrap
  and it grows sideways, one card tall whatever it holds. Reserving the wrapped box made every step
  reservation half as wide and twice as tall as the bubble drawn — invisible until something is
  placed against it, which is exactly what a hover does. Measured on route 1's Fire Station step: six
  cards, reserved 246×252, drawn 488×158. Two of the four geometry constants were also 2 units short
  each, which on its own is enough to put two bubbles a `gap` apart on top of each other.

A stop that **holds** the hovered item without gathering it shows it too, as the area's own card
rather than as a step card: the route stops for a material once, but the reader following it wants to
know where else it lies, and a stop they are already standing in is the most useful answer available.
The card carries the area's quantity and the same label the material view gives it, so it cannot be
read as something the route does there; the step's own pickups and builds are untouched beside it.

That case needs a plan whose route reaches one area for one material while another of its stops holds
something it already picked up. A single-item plan rarely manages it — a route that needs a material
once has no reason to stop where else it lies — so it takes a longer plan; see the verification notes
for the one that produces it.

The number under a card is coloured by what it counts: **amber is what the route needs, emerald is what
the area holds**. That is the app's language everywhere — the material cards are emerald for the same
reason — and it exists because the two numbers used to be the same colour while meaning different
things, so a `×1` could not be read without knowing which view you were in. Pointing at a pickup card
lends it the area's number, in emerald, so that everything on screen while a material is hovered is
answering the same question; letting go puts the route's number and its amber back. The accessible
name does not switch with it: it stays the action (`Pick up Iron Ore ×2 here`), because the number is a
readout the card lends out, not what the button is. Anything the plan assumes is *carried* rather than
found has no area card to borrow from, so it keeps its route amount throughout.

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

**One focus ring per control.** The global `:focus-visible` ring lives in `@layer base` in
`globals.css`, not beside the other top-level rules, and that placement is the feature: unlayered it
outranked the `outline-none` that four controls ask for, so each of them painted its own focus
styling *and* this ring on top of it. The search field showed it worst — the wrapper draws a ring on
`focus-within`, so the input added a second, smaller box just inside it. In `@layer base` the utility
wins again, and every control that opts out supplies its own signal: the wrapper border, an amber
border, a lit polygon, a highlighted route. Nothing else changed; `outline-none` simply started doing
what it said.

### Rarity palette

| Tier      | Colour                                                        |
| --------- | ------------------------------------------------------------- |
| Common    | stone                                                          |
| Uncommon  | emerald                                                        |
| Rare      | blue (`sky`)                                                   |
| Epic      | purple                                                         |
| Legendary | yellow lettering on a violet-tinted plate, with a solid gold dot |

`data.json` currently only uses the first three tiers. The whole ladder is declared in
`RARITY_META` anyway, so a new tier in the data renders correctly with no code change — and the
classes are real string literals in `taxonomy.ts`, so Tailwind emits them even while unused (checked
in the generated CSS). An unrecognised rarity string is treated as `common` and raises a data note.

### Category tabs

`CATEGORY_TABS` in `lib/wiki/taxonomy.ts` is the single source of truth for both levels:

| Tab    | Sub-tabs                                            | Items |
| ------ | --------------------------------------------------- | ----- |
| Weapon | Blade, Stab, Blunt, Thrown, Gun, Bow, Hand, Trap, All | 322   |
| Gear   | Head, Clothes, Arm, Leg, Accessory, All               | 153   |
| Food   | Health, Stamina, All                                 | 100   |
| Normal | Enhance, Special, Ingredients, All                    | 54    |
| All    | *(none — filters nothing)*                          | 629   |

Both levels are underline tabs — amber for the top level, a smaller emerald treatment for the
sub-tabs — so they read as a hierarchy. Weapon leads because it is what the game is played with.
**Both "All" tabs are last**, top level and sub-tab alike: they are a way out of the taxonomy
rather than a way in. The declaration order is also the "most actionable first" order the area
panel groups by, so the two agree without either inverting the other.

Sub-tabs come from that table rather than from the items present, so the strip keeps its shape as
the dataset grows, and the page resets to the first one whenever the tab, sub-tab or search changes —
the paging state is keyed by the filter it belongs to, so no effect has to chase it. This grouping matches the source wiki's own `itemcategory` values — notably
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
    icon.png              # favicon; Next's metadata file convention serves it
    page.tsx              # server entry: dataset, the page's own social tags
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
      share.ts            # a plan, and one of its routes, as one packed parameter
      plan.ts             # the plan's items in order + their recipe trees (shared code)
      preview.ts          # what a shared link says when it unfurls
      geometry.ts         # polygon centroid/anchor/bounds helpers
      map-image.ts        # base map dimensions (must match the PNG)
    clipboard.ts          # copy-to-clipboard, with the pre-2018 fallback
    scroll.ts             # scrolling confined to one pane, never the document
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
               RecipeTree, RecipeBranch, RoutePlanPanel, RoutePlanList
    map/       IslandMapPanel, IslandMap, MapAreaShape, AreaBubbleCard,
               BubbleMaterialCard, RouteStepBubbleCard, MapTooltip, RouteOverlay,
               regionStyles
    area/      AreaDetailPanel
    ui/        ItemCard, ItemSprite, BookmarkButton, Badge, PaneDivider
assets/
  dr-nadja.png            # source art for the route card (650 x 861, not served)
public/
  lumia_island.png        # base map (1503 x 774)
  items/*.png             # 644 item sprites, served as /items/<itemId>.png
  aglaia.png              # header mark (644 x 644, served whole)
  og.png                  # the archive's link-preview card (256 x 256)
  dr-nadja.png            # the route card's mark (256 x 256, cropped from assets/)
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

**Analytics is a platform feature, not an assumption.** `app/layout.tsx` renders Vercel Web
Analytics (`@vercel/analytics/next`), which injects the platform's script client-side — the
server-rendered HTML is unchanged. It reports `usePathname()`, so it sees `/` and never the query
string: the plan in `?p=` is not something a visitor agreed to hand to an analytics vendor. It sits
in the layout rather than a page so every route reports itself, including the 404. Two consequences
worth knowing: a visit is one pageview at `/` whatever plan it carries (counting plans would take an
explicit `track()` event), and off Vercel the script 404s — expected locally, and in production it
means Web Analytics is not enabled for the project.

**The hover is cross-pane, and it still must not re-render everything.** `focusedMaterialId` lives in
`WikiExplorer` because the map and the recipe tree have to agree on it, so hovering a card re-renders
the island — the catalogue included, which has no idea a material was hovered. The catalogue and the
route list are therefore memoized, with every prop below them stable (the hooks already memoize their
callbacks and derived objects; `unobtainableNames` was the one fresh array). That costs almost nothing
in production and a great deal in development, where React's element factory validates every prop it
creates: on a plan whose shared link had lifted the route list's fold, one hover re-created a hundred
mounted route rows and blocked the main thread for about 230 ms, while the same hover in a production
build measured no long task at all. Measured, the same hover now spends about 15 ms in dev-only element
work instead of about 335 ms.

**The image map is a real overlay.** `lumia-island.map.json` coordinates are pixel offsets into the
PNG, so the `<img>`, the SVG `viewBox` and the dataset all use the same `1503 x 774` space — no
scaling maths anywhere. The artwork already has every area name drawn on it, so the SVG draws none:
the polygons only tint, outline and take clicks, and the names survive as `aria-label`s so the map
still reads aloud.

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

- 629 items, **446 craftable**, 22 areas, `research_center` has no loot. Recipes now nest up to five
  levels (`ash` → `lye` → `poison` → `venom_dart` → `dart_of_souls` → `dart_of_blood`).
- 153 items appear in an area; the other 476 do not, and 35 of those have no recipe either — those
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
- **How greedy finds its walk.** The old per-cover search tried a fixed handful of orders — the
  tidiest line, a few nearest-neighbour sweeps, then seeded shuffles — and kept the best of those. That
  is a sample, and it showed: on the reported plan (Maverick Runner, Sheet Metal Armor, Uchiwa, from
  Fabric Armor) it walked 24 of one cover's 120 orders and returned `Lighthouse → Alley → Town Hall →
  Tunnel → Chapel` while `Lighthouse → Alley → Town Hall`'s better sibling was never tried, even though
  the ranking code already preferred it. The search now **grows** walks: every one-area walk is extended
  by every area left, extensions are ranked on the peaks they have settled (a peak whose window is fully
  walked can no longer move, so a partial walk that is behind on one is behind for good), the best
  twelve stay alive, and the process repeats. Covers small enough to enumerate are enumerated outright.
  The sampling it replaces is kept as the floor, so nothing it found can be lost, and a partial walk
  costs one step on a copied pack rather than a re-walk — which is what keeps a front of twelve
  affordable. `_verify/check-greedy-order.cjs` holds both ends: over twelve plans × three armors × four
  look-aheads it compares 8 608 covers against the version in `HEAD` — 5 797 walks improved, 54 covers
  made walkable that the sampler could not walk at all, and none worse.
- **A traced stop is a step of the walk, drawn like one.** A route the reader clicked and a route
  the solver found are the same kind of thing, so they are drawn by the same component: the numbered
  badge in the header, the amber outline, and the cards on one line rather than wrapped into the
  material bubble's pinned width. An area that is a stop therefore draws no material bubble — one box
  per area, as under a highlighted route — and everything that is not a stop keeps its material
  bubble, because those are the areas the reader is choosing between. The walk's own cards are what a
  stop shows: the builds in amber with a sparkle, and each material it takes with the amount the
  *route* needs (`×needed`, amber) rather than the amount lying in the area (`×in area`, emerald) —
  the same colour rule the pinned-route view uses.
- **The walk's requirement decides what is left on the island.** A material the walk has collected as
  much of as the plan needs leaves every bubble it was on, so what is left to collect is what the map
  shows. **What "as much as the plan needs" means is the plan's own requirement** — `SimPlan.gather`,
  the same map the walk collects against — and not the material list's totals. That list walks the
  whole recipe tree, so it counts a craftable node beside the ingredients it could be built from and
  sums a shared material once per planned item that wants it, which makes it a map of where things are
  rather than a shopping list: counting a walk's pickups against it left Scrap Metal the walk had
  already collected sitting on every other bubble. A material with no requirement at all is not
  something a walk collects — an intermediate it builds, or the armour the survivor walks in with — so
  it is not on the island while a walk is being drawn. The rule holds from the moment Manual is
  picked, so nothing vanishes under the reader's hand mid-trace.
- **A bubble lets the pointer through in Manual mode, and that is the fade's whole mechanism.** The
  polygons are the only thing a click may reach while tracing, so every bubble is
  `pointer-events-none` and the one over the hovered area drops to a third of its opacity. Reading the
  hover off the polygon rather than off the bubble is what makes the fade reliable: the pointer's
  position decides, not which element it entered, so a fast move that lands on a card no longer leaves
  the bubble at full strength on the area being clicked. The header is drawn as text rather than as a
  button when the pointer falls through it — a control only the keyboard could reach is a trap — and an
  area's own panel is still reachable from the trace row's area chips in the rail. The step back is
  Manual's alone: with no walk on screen the bubble is what is being read, and a hover over it reports
  its own area, so fading there would dim the very card the pointer is on.
- **The lock is the trace's own switch, not a fourth mode.** Manual is a way of *choosing* a walk;
  locked is the reader saying they are done choosing, so the island goes back to answering like a
  computed route without the walk, the rail or the share link changing at all. It is drawn as the same
  `RouteStepBubbleCard` either way, which is what keeps the two states comparable — one control flips
  only what a pointer may reach, and a walk read from a link and a walk read from the solver are the
  same walk on screen. Locked also un-filters the material list used to answer a hover, so the answer
  is "where else is this" as a pinned route answers it; unlocked keeps showing only what is left to
  collect, which is what the next click is choosing between.
- **How big a bubble is.** A share of the island box — `BUBBLE_WIDTH_SHARE` in `lib/map-layout.ts`,
  under the 140px ceiling the previous deployment drew — and both numbers come from *measuring* that
  deployment rather than from taste: a 140px bubble on the 1153px island a 1745 CSS px viewport
  draws, which is a 1920×1080 screen at 110% zoom. The ceiling is what makes the rendering identical
  to it at every desktop width, not just at the one it was calibrated against; the share underneath
  is what makes it shrink on the smaller ones, which the deployment did not do — a bubble drawn at
  140px whatever the pane took 16% of a small island and 5% of a large one, so a laptop got a third
  again more clutter than a 4K desk for no reason other than the screen. The island's own corner
  chrome — the random-spawn box and the animal-drop toggle, which are laid out in CSS pixels rather
  than in the island's coordinate layer — hangs off the same width via `islandControlScale`, so its
  `w-10` cards come out the size of the cards inside the bubbles (within a pixel, measured at seven
  widths) instead of half again bigger.
- **The rail is 32.08% of the row, up to 560px.** `lg:w-[32.08%] lg:max-w-[560px]` on the item pane,
  the map taking the rest. Read off the previous deployment again: it drew a 560px rail, which is
  32.08% of the 1745px viewport above. The cap reproduces that at every wider window, where the old
  `w-[38%] max-w-[560px]` also capped; the share is what stops the rail holding 560px on a window too
  small for it, where the old rule gave 38% of a small screen and 16% of a large one. Below `lg`
  there is one column and the pane is the whole screen.
- **The page never scrolls.** The shell is exactly one viewport tall (`100dvh`) and every pane scrolls
  inside it, so the root is clipped (`overflow: hidden` on `html`). That is load-bearing rather than
  tidy: once the rail's content passes a certain height the document starts reporting a scrollable area
  of its own — Chromium counting a descendant scroll container's overflow — and a wheel over the island,
  which scrolls nothing by itself, then slid the whole app up into empty space. Clipping the root also
  means nothing the app does can move the header: the two arrival scrolls go through
  `lib/scroll.ts`, which moves one scroll container and never the document.
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
- **The solve is remembered.** `buildRoutes` is the expensive half of the screen — it sweeps covers
  and walks several orders per cover — and the same few answers are asked for over and over: switching
  the ranking mode and back, entering manual mode (which solves the fastest list so a trace has a
  number to be measured against), and returning to a plan already seen. `buildRoutesCached` keeps one
  answer per set of trees, keyed by the settings the solve reads, and by the trees *by identity*: the
  hook rebuilds them only when the plan changes, so a plan that has moved on takes its answers with it
  and nothing needs evicting by hand. The result is shared and treated as read-only, which is what a
  `RoutePlanSet` already was. `_verify/check-route-cache.cjs` asserts the contract in node: the same
  question is the same object, and another mode, look-ahead, armor or plan each solves for itself.
- **The solve is not on the main thread.** A whole plan's worth of walking is a few hundred
  milliseconds, and it used to happen inside a render, which is a frozen page rather than a slow one.
  `route-pool.ts` splits the work where it is naturally independent — one job per set of areas, which
  is exactly what a solve is — hands the slices to up to four module workers (`route-worker.ts`, one
  core left for the page), and merges what comes back through the same comparator the single-threaded
  solver uses. The seam is `createRouteSolver`: `solveCovers(from, to)` solves a slice anywhere, and
  `assemble` ranks the answer, so the pooled path and the fallback cannot drift — the fallback *is* the
  single-threaded solver, and it takes over when workers are missing, refused or dead. Measured on a
  four-item greedy plan: ~700 ms of work on one thread, 225 ms of wall clock over three workers, and a
  main thread whose worst frame gap was 37 ms against 393 ms. The fallback is the old
  behaviour and says so: with no worker the thread is held for the whole solve, so it cannot show a
  spinner — it paints the click first and then blocks, and `_verify/check-route-solve.mjs` asserts
  both paths (the section must never claim the plan has no route while it is still working). The route section says it is working
  (a spinner, after a beat so a one-item plan never flashes it) while a pinned walk keeps its highlight
  and the address bar keeps its walk — the pin is a snapshot of the route, not a position in a list
  that has not arrived yet.
- **Fastest routes, not a spawn list.** The rail's bottom section lists the ways to gather everything
  the plan needs, best first, and highlights the picked one on the island when hovered or clicked
  (`Esc` releases it). It sits outside the item detail on purpose: the routes answer for the bookmarks
  as well as the open item, so they stay on screen with nothing selected at all. The list covers the
  whole plan, so its header says how many items it is answering for, and every route shows its steps:
  which area, what gets picked up there, and **what gets built there**. Each step keeps its actions
  in the order they happen, because that order decides whether the pack fits: a pickup only fits
  after the build that made room for it, and a five-deep recipe builds several links in one stop.
  A **starting-armor selector** sits above the list: a survivor can pick one clothes piece before the match, starts
  wearing it (so it costs no bag slot), and the routes are recomputed around it. It defaults to the
  game's own unset marker, `-`, and offers `fabric_armor`, `windbreaker`, `cassock`, `doctor_s_gown`
  and `full_body_swimsuit` — three of which feed a recipe, so the choice is not cosmetic: wearing a
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
  Ranking has two modes, chosen above the list. **Fastest** is described above. **Greedy** reads a
  route as a profile: at each step, the most value *worn* within the look-ahead window starting
  there (`lookAhead` areas, 1 to 6, two by default), and those profiles are then compared step by
  step from the start, with the shorter walk breaking a tie. Applying the window at every step is
  the point — the decision being modelled is made at every step, and a route that is strong early
  but then plods through five areas of gathering before its next upgrade is what greedy exists to
  avoid. Two length biases had to be designed out: a *sum* over the window rewards longer routes
  (more steps to add up), so the metric takes a peak; and comparing profiles of different lengths
  with zero padding let a longer route win by having more entries, so a profile is padded with its
  own last value — a route that has ended keeps its kit. A detour therefore has to buy real
  strength to earn an extra area. Greedy also explores up to 24 visit orders per cover instead of
  stopping at the first workable one, since the order decides how early each part gets built.
  Fastest mode is untouched: it explores the tidiest order only, and passing a look-ahead changes
  nothing about its results.
  Requirements keep the recipe's OR structure: a craftable material is satisfied when the route can
  gather it *or* craft it from what it gathers, which is why `magazine` (craftable *and* gatherable)
  offers two 0-move routes before any crafting route. Stack sizes are honoured: needing two Scrap
  Metal forces two areas when no single area holds both. Several planned items just stack their
  requirements.
- **Components the island cannot supply are carried, not searched for.** Some materials have no
  location in `data.json` at all — creature drops, random spawns, the rare finds (`mithril`,
  `meteorite`, `tree_of_life`, `holy_blood`, `ogre_skin`, `bread`, the `crude_*` weapons, the
  randomly-found blades like `muramasa` and `viper`). A route takes those as already in the pack rather than declaring the plan impossible: each is spent once,
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
  **The weapon slot is not storage.** Weapon mastery is one of the game's most important stats and
  cannot be changed mid-match, so the slot is only usable when the plan is *about* a weapon. With no
  weapon among the selection or bookmarks, the survivor keeps the crude weapon they started with and
  anything else of that kind goes in the bag — the steel chain feeding a `rider_jacket` costs a slot
  rather than riding free in the weapon slot. When the plan does hold weapons, only weapons of those
  types may fill the slot: a blade plan never wields the blunt chain it picks up, and a plan for two
  different weapon types admits both.
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
  actionable first — Weapon, Gear, Food, Normal, which is now simply the declared tab order — and
  sorted inside each bucket by the catalog rule. Every
  item in `data.json` belongs to exactly one tab, so nothing is ambiguous. The panel carries no
  filter and no count of its own: it lists everything the area holds, the header already says how
  many stacks that is, and the one area with nothing at all (the Research Center) shows its animal
  and stops rather than explaining itself.
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

- The route cache was checked on its own in node (`node _verify/check-route-cache.cjs`): the same plan
  and settings come back as **the same object**, while another mode, another look-ahead, another
  starting armor and a fresh set of trees each solve for themselves, and the remembered answer is
  identical to the one the uncached solver produces.
- `tsc --noEmit`, `eslint .` and `next build` all pass clean. The icon and the not-found page
  prerender; the archive itself renders per request, because its `<head>` answers for the plan in
  the query — see [Link previews](#link-previews).
- Server-rendered HTML verified against the real data: 22 polygons, the map PNG, sprite URLs, and the
  bubbles with correct anchors and quantities.
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
  (`sel`) then the bookmarks, card bookmarks carry `aria-pressed` and stay hidden until hover, the route
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
- The weapon rules were swept over **214 plans x 3 ranking modes** (642 runs): **0 violations** —
  no weapon was ever worn by a plan with no weapon in it (39 such plans), and no weapon was ever
  worn outside the plan's own types. Checked straight off each route's `equipped` list, and again
  through a replay that applies the same mastery rule. `rider_jacket` shows it: the steel chain it
  needs sits in the bag, while adding a blade to the plan opens the slot for that blade alone and
  still leaves the chain bagged. Worst run: 263 ms.
- The greedy mode was swept over **193 plans x 4 look-ahead windows** (1, 2, 3 and 6 areas) —
  **772 runs, 0 violations**: every route replayed action by action, every profile recomputed from
  the replay (score and ordering both), every step's shown value re-derived from the pack, and
  fastest mode returned byte-identical routes with and without a look-ahead set (193/193). Greedy's
  profile beat the fastest list's in 199 comparisons and tied in 573. `rocker_s_jacket` shows the
  intent: a window of 1 picks Uptown first (15 value immediately), 2 picks Fire Station then Uptown
  (47 value by the second area), and 3 or more keeps the 2-move walk because it already reaches the
  best available 55. The sweep is also what caught both length biases — the first metric picked a
  four-move detour for the same plan. Worst run: 346 ms.
- With components assumed rather than blocking, a sweep over **317 plans × 6 starting choices**
  (**1 902 runs, 64 373 routes**) reported no violations on the 629-item data: every route replayed
  action by action from the carried components and worn clothes, nothing assumed was ever gathered
  or built, the pack never passed 6 slots and always matched its reported use, and 228 runs were
  plans needing no travel at all. The only plans left without a route are ones the pack genuinely
  cannot hold — a 12-item plan carrying 6 rare components alongside its materials. Worst run 190 ms.
  That sweep is also what found the step-order bug above: with shallow recipes the recorded order
  inside a step never mattered, so sorting it alphabetically went unnoticed until the five-deep
  chains arrived and 326 replayed steps failed.
- The starting-armor option was swept over **214 plans × 6 choices** (bare plus all five clothes):
  **1 284 runs, 40 117 routes, 0 violations** — every route replayed from the picked clothes, pack
  never over 6 slots (peak 5) and always matching its reported use. It made 23 plans faster and left
  nothing slower than starting bare. `rocker_s_jacket` drops from 2 moves/3 areas to 1 move/2 areas
  with a windbreaker (which stops appearing in the pickups), `dress` drops from 1 move to 0 with a
  doctor's gown, and `bishop_s_cassock` switches which single area it needs. Worst run: 130 ms.
- The social card was read the way an unfurler reads it — from the served HTML, with no JavaScript
  run — and every URL in it was then fetched: `og:title`, `og:description`, `og:site_name`,
  `og:image` (absolute, `200 image/png`, 256×256 and matching its own `og:image:width/height`,
  PNG signature intact), `og:url`, and `twitter:card=summary`, which is the shape that puts a
  square mark in the corner of the card. Every social URL was asserted to share one origin and that
  origin to be non-loopback: before this, the tags fell back to `http://localhost:3000`, which no
  unfurler can reach. The deployed copy of `/og.png` answered `404` at the time of the check — the
  tags ship with the next push.
- The brand mark was checked in the browser at 390, 1512 and 1920 px: the header image loads and
  paints at 36×36 from `public/aglaia.png` (still 644×644 on disk), no trace of the amber "L" it
  replaced, and the tab icon is the single `link[rel=icon]` Next emits — 126×126, served with a
  content hash, byte-identical to `src/app/icon.png`.
- The island's panels were re-checked against `data.json` at 1512 and 390 px: the random-spawn box
  names an animal only when that animal has no area of its own (Holy Blood → "found on Dr.
  Wickeline, no fixed area") and says "found at random" otherwise — including for the Vital Sign
  Sensor, which does drop off Mr. Meiji but only in the Research Center, an area that opens for the
  alternative victory condition and that nobody visits to farm one; the animal-drops switch's tooltip
  carries no disclaimer in either state; the Research Center lists its animal and no prose about
  missing loot; neither the "N shown" count nor the "Recipe only" filter remains on any area; and
  the slide-over closes on a click outside it, stays open on a click inside, and still closes on
  Escape and on the ✕.
- The startup line was verified on a real `next start`: it prints once, before the first request —
  `[lumia-archive] data ready — 201 items · 22 areas (22 mapped) · 39 craftable — 2 data note(s): …` —
  and the island pane no longer renders any data-notes strip.
- The share codec was checked on its own in node against the real data
  (`node _verify/check-share-codec.cjs`): **629 item ids hash to 629 distinct 24-bit codes and 22 area
  ids to 22**, so no two items and no two areas can ever be confused for one another; every state the
  payload can hold round-trips (each of the five clothes and bare, walks of 0 to 22 stops, an item that
  is also bookmarked, a plan with no open item, a plan with no walk); a payload whose item the data no
  longer has drops just that item and keeps the rest of the plan, and one whose *area* is gone drops
  just that stop and keeps the walk; the URL layer keeps foreign parameters, writes nothing for an
  empty plan, and drops a payload that is not one. **4 000 random payloads — a quarter of them given a
  valid version byte and counts that fit their own length, so the parser past the version check is
  exercised too — and 129 bit-flipped ones** decoded to `null` or to a valid plan (402 and 123 of them
  came back as some plan) and none threw. The same harness prints the lengths: 25 → **14** characters
  for a single item, 71 → **19** for an item with two bookmarks, 134 → **50** for ten, and a walk at
  three bytes a stop — 18 characters for six stops, 34 for thirteen. A version 1 payload — the one that
  named a route by its rank — decodes to `null`.
- The shared-route link was then driven end to end in a real browser at 1512 and 390 px — real clicks,
  real typing, and the real clipboard (`node _verify/check-share.mjs`): on a plan of `Monohoshizao` +
  `Rocker's Jacket` + `Sword Stopper`, windbreaker, greedy, 3 areas, the address bar read
  `?p=AgECAgChQvQT-YpTHyg` — **19 characters** — and its payload changed at every step that changed
  the *plan* (item opened, armor, each bookmark) and at no other: hovering a route left it
  byte-identical, and a change plus its undo (bookmark Feather Boots, un-bookmark it) landed on exactly
  the same payload again. Switching the ranking mode now changes **nothing** in the URL, which is the
  visible half of the mode no longer being in the payload at all. Pinning rank 6 reached the URL, the
  Share control copied a link **byte-identical to the address bar**, and the link's payload decoded to
  exactly the areas that row's steps name. Opening that link with a foreign `?v=2` attached selected
  **Manual**, showed a trace of exactly those areas in that order, drew the same number of numbered
  stops on the island, listed **no ranked routes at all**, kept the payload and `?v=2`, and scrolled
  the trace row into view (`0 ≤ top < 950`); reloading the page it produced gave the same walk and the
  same mode. The trace's own Share control copied the same walk back, and **Clear the trace** emptied
  it from the screen, the island and the URL. Five junk payloads (`!!!!`, empty, `AAAA`, `eA`, 48
  characters of `z`) each planned nothing, crashed nothing, and were written back out of the address
  bar, leaving `?v=2`; the retired six-parameter link planned nothing at all; a one-item plan carried a
  14-character payload and a route link off it restored that row's walk; an item that is both open and
  bookmarked walked its single-item plan rather than a two-item one; an address-bar link — no walk in
  it — opened on the defaults (`Fastest`, no trace), which is what proves the mode is no longer
  restored from a link; and Enter on an area chip inside a row opened the area without pinning the
  route. Each arrival was then checked for where the rail lands: an item open, alone or over a two-item
  plan, put the **Used to craft** section **flush with the header** (`|section.top − header.bottom| ≤ 1`
  after 617 px of rail scroll, header still at `top: 0`); a bookmarks-only link left the rail at
  `scrollTop 0`; a link naming a walk brought the trace itself into view instead; and picking another
  item after arriving left the strip exactly where it was, so the scroll is spent rather than repeated.
- The link previews were read the way an unfurler reads them: raw HTTP, no JavaScript, `<head>` only
  (`node _verify/check-preview.mjs`). One item open gave `Lumia Archive - Monohoshizao`, `Blade 46` /
  `Craft: Odachi + Blueprint` on two lines, and its own sprite; a value-less, recipe-less item gave
  `Lumia Archive - Scrap Metal` with the single line `Ingredients`; an item with no sprite (`Egg Bun`)
  fell back to the site's card; a three-item plan gave `Lumia Archive - 3 items plan` listing
  `Monohoshizao, Rocker's Jacket, Sword Stopper`; a single bookmark with nothing open gave
  `Lumia Archive - 1 item plan`; and a link naming a walk gave
  `Lumia Archive - 3 items route (5 Areas)` with `Alley → Town Hall → School → Forest → Temple` — the
  very areas the page draws as that trace, which it now reads out of the payload rather than solving
  for. Four junk payloads (empty, `!!!!`, `AAAA`, 48 characters of `z`) all answered 200 with the site's
  card. Every declared image was then fetched and measured: the sprite 256×128, `og.png` and
  `dr-nadja.png` 256×256, each matching its own `og:image:width/height`, each absolute and off-loopback.
  Theming aside, the human got the same thing: the tab title matched the card title, and the page drew
  the same five-stop trace the card described. **The cost of an unfurl was measured against itself**:
  eight requests each, first discarded, medians **26 ms for a plan link and 23 ms for a route link** —
  where the ranked-route card this replaced took about 200 ms, because it ran the solver. The same run
  passed at 390 px.
- The shell was checked against the void: on a page carrying a long route list, a real wheel over the
  island left `window.scrollY` at **0** and the header at **0**, with the rail's own scroll untouched —
  and taking the root clip off in the same session reproduced the report exactly, scrolling the page to
  **400** and pushing the header off the top. A wheel over the rail still scrolled the rail (617 → 1 017)
  with the page at 0, and focusing the last control in the rail revealed it by scrolling the rail
  (46 946) rather than the document. The same checks passed at 390 px, where the rail is the whole
  screen.

- Vercel Web Analytics was verified from the browser rather than from the build: the injected tag is
  the `@vercel/analytics/next` 2.0.1 script, `window.vam` resolves to `production` under
  `next start`, and the client's undrained `window.vaq` queue held exactly `{ route: "/", path: "/" }`
  — the queue is where a payload waits until the script drains it, and off Vercel the script never
  loads, which is what makes the payload readable. Reloading a real share link (`?p=ARQAAAAT-Yo`) left
  that payload out of the queue entirely (`[?&]p=` never appears in it) while the plan still restored
  (Rocker's Jacket, 4 routes). Asserted at 1512 px and 390 px.

- The material hover was checked under a pinned route against the same hover with nothing pinned,
  rather than merely checked for "something lit up". With route 1 (Alley → School → Fire Station)
  pinned and *Steel Chain* hovered on its step card, the areas holding it became Alley (on the route)
  plus Hotel, Slums and Uptown (off it) — the same set, and the same dimming everywhere else, as
  hovering the same material with the route released. *Scrap Metal* and *Windbreaker* agreed too, and
  *Iron Sheet*, which spawns nowhere, reported its 8 ingredient areas instead. Every hovered card drew
  its own focus ring, no route tint survived a hover, and letting go restored the route's island
  exactly (compared region by region, state and dimming). Asserted at 1512 px and 1280 px.
- The bubbles that come back under that hover were checked as a set, not by eye: with route 1 pinned,
  hovering *Steel Chain* on Alley's step card brought back the material bubbles for Slums, Uptown and
  Hotel — every one of them holding a *Steel Chain* card, none of them a route stop — kept Alley's own
  step lit and faded the other two. Hovering *Build Iron Sheet* brought back six, and kept the two
  steps that hold its ingredients. The pointer was then left standing still on a card and the DOM
  sampled twice a second apart, because the failure mode here is a strobe rather than a wrong pixel:
  the hover held, the bubble count held, and the faded steps held. Releasing restored the step bubbles
  exactly, with no material bubble or fade left behind (asserted on the same counters, not on a
  screenshot). No two bubbles that are both still lit overlap, at either width — an overlap with a
  *faded* step is the behaviour, and is reported as such rather than counted as a failure.
- The amount colouring was checked against the app's own numbers rather than against a screenshot: with
  route 1 pinned, every pickup card read its route amount in amber at rest; pointing at *Pick up Steel
  Chain* turned it `×3` in emerald, and 3 is what Alley's card reports for Steel Chain in the area view;
  letting go gave back `×1` in amber. The check refuses a hovered number that is merely green by
  comparing it with the area's own figure.
- The hover's *cost* was measured rather than assumed, in both builds, with the CPU profiler over one
  hover. Production showed no long task at all; development spent about 335 ms inside React's
  development element factory and prop validation, because a hover re-rendered every pane of the
  island — a hundred mounted route rows on a plan whose shared link had lifted the route list's fold.
  Memoizing the two panes a hover cannot touch took that to about 15 ms and the main thread's block from
  232 ms to none, with the hover checks asserting the island behaves exactly as it did before.
- The beside-a-stop card needed a plan built for it, because the case it covers is rare: a route that
  needs a material once has no reason to stop where else it lies. Measured, it takes a longer plan —
  *Ice Water* plus *Sorghum Wine* and *Steel*, whose route reaches Well after picking Water up at
  Beach. With that pinned, hovering Water's card at Beach left Well lit and gave Well Water's card,
  as an item frame rather than a step action, with Well's own two pickups untouched. Every lit stop
  was separately asserted to say *something* about the hovered item — its own card or its area's —
  across all five pickups of the first plan and the build card, and never to show it twice or claim
  an area it does not hold.
- The focus ring was checked on `outline-style`, not on width, and with `:focus-visible` forced rather
  than merely tabbed to (`node _verify/check-focus-ring.mjs`). The search field really clicked gave a
  wrapper border equal to what `border-emerald-400/50` computes to and an input that draws nothing —
  comparing against a probe wearing the utility, because Tailwind declares its palette in oklab. Forced
  `:focus-visible` drew nothing on the search input, a route row or a map polygon, and still drew the
  global `solid 2px` on a catalog card, so the fix narrowed the ring rather than removing it. The
  stylesheet was read back through the CSSOM to confirm `:focus-visible` is declared once, inside
  `layer:base`, next to a `.outline-none` that resolves to `outline-style: none`. Measure the style and
  not the width: `outline-width` keeps reporting the cascaded value under `outline-style: none` — and
  reports the untouched initial `medium` (3px) when no ring applies at all.
- The two layout sizes were measured, not eyeballed, which is the only way a *share* can be checked:
  a bubble's width is a number that looks plausible at any value. `node _verify/check-pane-width.mjs`
  reads the rail and the island out of the DOM at nine widths (1024 → 3440) and got
  `min(32.08% of the row, 560px)` every time, with no sideways overflow in either pane, the same with
  the island folded away, and the full width at 390px where there is one column.
  `node _verify/check-bubble-scale.mjs` does the same for seven widths: the drawn bubble is the share
  under the 140px ceiling at every one, and the random-spawn box `158 ×` the same width — which puts
  its `w-10` cards within a pixel of what a bubble's 72-island-pixel card is drawn at (21 vs 21.5px at
  1024, 41 vs 41 on the reference island).
- The calibration itself was taken off the previous deployment rather than reasoned about, and its URL
  could not be used to do it: the Vercel address is behind deployment protection and answers 302 to
  `vercel.com/sso-api`, so the deployment's own commit was built locally instead and measured
  (`node _verify/measure-layout.mjs`, which reads the rail, the island box, a bubble, its rendered
  area name, an inner card and the corner box out of any build). The two builds then agreed on every
  one of those numbers — 560 / 1153 / 140 / 11.95 / 41 / 158 / 10 — at 1745 (a 1920×1080 screen at
  110% zoom, which is where the proportions were tuned), at 1920 and at 2560, because the deployment's
  pixel ceilings are back on top of the shares. Below the reference they part company on purpose: at
  1280 the rail is 411px against 486px and the bubble 102px against 125px, which is the responsiveness
  the ceilings never had.
- Two earlier attempts at this missed for lack of that measurement, and both are worth remembering:
  the first calibrated at 1920 CSS px, which is 10% off on a screen viewed at 110% zoom, and the second
  dropped the ceilings altogether, which made it match at exactly one viewport. What the numbers cannot
  say on their own is which viewport the person looking at it is actually at.
- The bubble cards' one interaction was checked on both kinds of bubble, because it is the sort of
  thing that only holds on the surface it was last changed on: `check-area-bubble-click.mjs` pins a
  route, clicks a step card and requires the selection to move *nothing* — the same requirement it
  puts on a material card, and the opposite of what it asserted before this change. The change itself
  is structural rather than a removed handler: both kinds of card are now the same `ItemFrame` with no
  `onSelect`, which is also the branch that makes them non-focusable, so a bubble draws no tab stop on
  either surface. The checks had to follow: they used to tell the two apart by tag, since step cards
  were `<button>`s and material cards were `<span role="img">`, and now tell them apart by label —
  material labels name the area's stock, step labels are the action.
- Manual mode was checked in a real browser against a plan of `steel` (Iron Ore + Scrap Metal), with
  the two areas clicked found in `data.json` rather than named in the check
  (`node _verify/check-manual-route.mjs`): Manual is offered as the third mode and an empty trace
  explains what to do. One long mouse move onto an area — the case that used to leave the bubble at
  full strength, because the pointer landed on a card — left that area's bubble at **opacity 0.35** with
  `pointer-events: none`, and the click that followed reached the polygon underneath and added the stop
  (one numbered stop on the island, a walk in the URL, `1 area · no travel` in the rail). The second
  stop, the one that completes the craft, drew **`✦ Build Steel ×2 here`** on the area's own bubble
  beside **`Pick up Iron Ore ×1 here`** — the amount the *route* needs, where the same card read `×7`
  before the stop was traced and the number is a different colour from the material cards' emerald,
  measured off the rendered text. What the trace collected came off the other bubbles (no other bubble
  still held Scrap Metal, and the island was down from 8 bubbles to 2), clicking the first area again
  took its stop out, and **Clear the trace** emptied the walk from the island, the rail and the URL and
  put all 8 bubbles back. A second scenario covers the count itself, on a plan whose recipe trees
  mention a material more often than the plan needs it (`Rocker's Jacket` + `Sword Stopper` + `Blade
  Boots`, worn with a Windbreaker): one stop at Slums collects both Scrap Metal the plan asks for, and
  **no bubble still holds Scrap Metal** while Hammer and Iron Ore — not yet collected — are still on
  the map, and Windbreaker is nowhere, because the survivor walks in with it. A third scenario covers
  the way into a trace and what moves the rail: **Open in manual** on a solved route's row hands that
  row's four areas over as the trace — the rail's own chips and the island's stops agree with the row,
  and the address bar picks the walk up — and bookmarking an item *after* that leaves the rail at
  `scrollTop 0`, which is the bug the reveal-by-plan-key fixed (it used to be spent on the plan the
  link described, and a bookmark moved the plan on). Arriving on a link that names a walk still
  scrolls: `scrollTop 512` with the trace on screen. Each stop is asserted to be drawn as a step of the
  walk rather than as a material bubble — amber outline, the amber number badge reading 1 for the first
  stop, and **all four of its cards on one row** — which is the same reader a pinned route's step
  bubbles produce. The checks that read a bubble header had to stop assuming it is a `<button>`:
  a bubble the pointer falls through draws it as text, since a control only the keyboard could reach
  would be a trap.

---

## Suggested next steps

1. **Descriptions are available.** `public/items/_manifest.json` (already in the repo) carries a
   `quality` field with real effect text — `12 Damage`, `70 Health`, `12 Armor` — for 192 of the 194
   items, plus a canonical rarity string. Wiring it in is a small, isolated change to `dataset.ts`.
   It was left out because you asked for `data.json` to be the only source.
2. **URLs.** A *plan* link exists now — the query string in
   [Sharing a route](#sharing-a-route) — but item and area deep links (`/items/[id]`, `/areas/[id]`)
   do not, and they are what would give back/forward for free.
3. **Tests.** The `lib/wiki/*` and `lib/map-layout.ts` functions are pure and are the natural target
   for a unit-test setup (Vitest), replacing the throwaway diagnostics route used here.
4. **Sprites.** Sources are 2:1 canvases with ~33% horizontal transparent padding. Trimming them to
   their content box once at build time would let the same artwork fill a smaller footprint.
5. **Animals.** `data.json` ships one animal (`crow`) with loot and area data — untouched for now.
6. **The 452 unused sprites** are all valid Black Survival items; they are ready if you widen the
   dataset.
