"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogPanel } from "@/components/catalog/CatalogPanel";
import { ItemDetailPanel } from "@/components/item/ItemDetailPanel";
import { RoutePlanPanel } from "@/components/item/RoutePlanPanel";
import { UsedToCraftPanel } from "@/components/item/UsedToCraftPanel";
import { AppHeader } from "@/components/layout/AppHeader";
import { MobilePaneTabs, PANE_BOTTOM_INSET, type MobilePane } from "@/components/layout/MobilePaneTabs";
import { IslandMapPanel } from "@/components/map/IslandMapPanel";
import { useBookmarks } from "@/hooks/useBookmarks";
import { useCatalogQuery } from "@/hooks/useCatalogQuery";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useItemSelection } from "@/hooks/useItemSelection";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useRoutePlan } from "@/hooks/useRoutePlan";
import { useStepOverlay } from "@/hooks/useStepOverlay";
import { copyText } from "@/lib/clipboard";
import { plannedItemsFor } from "@/lib/wiki/plan";
import { scrollWithinScroller } from "@/lib/scroll";
import { STARTING_CLOTHES_IDS } from "@/lib/wiki/inventory";
import type { MapFocus } from "@/lib/wiki/route";
import { DEFAULT_LOOK_AHEAD, type RouteModeChoice } from "@/lib/wiki/routes";
import { buildSharedUrl, readSharedUrl } from "@/lib/wiki/share";
import type {
  AreaItemRef,
  WikiAnimal,
  WikiDataset,
  WikiItem,
} from "@/lib/wiki/types";

/**
 * The two panes a material hover cannot touch, held still while it happens.
 *
 * `focusedMaterialId` lives here because the map and the recipe tree have to agree
 * on it, so hovering a card re-renders this whole island — including the catalogue
 * and the route list, which have no idea a material was hovered. That is cheap in
 * production and expensive in development, where React's element factory validates
 * every prop it creates: on a plan whose shared link had lifted the route list's
 * fold, one hover re-created a hundred route rows' worth of elements and blocked the
 * main thread for a third of a second, while the same hover in a production build
 * measured no long task at all.
 *
 * Memoized rather than moved: the state is cross-pane, which is what this component
 * is for, and every prop below it is already stable — the hooks memoize their
 * callbacks and their derived objects, and the one prop that was not
 * (`unobtainableNames`) is now memoized too.
 */
const MemoCatalogPanel = memo(CatalogPanel);
const MemoRoutePlanPanel = memo(RoutePlanPanel);

/** Where the island and the item rail start sharing the row (Tailwind's `lg`). */
const TWO_COLUMN_QUERY = "(min-width: 1024px)";

/** Stable empties so derived memos do not invalidate on every render. */
const NO_ITEMS: AreaItemRef[] = [];
const NO_ANIMALS: WikiAnimal[] = [];
const NO_CRAFTABLES: WikiItem[] = [];
/** No walk on screen: a stable empty, so the URL effect does not rewrite itself. */
const NO_AREAS: string[] = [];

/**
 * What identifies a plan: the items it gathers, in order, then the three settings
 * the solver reads.
 *
 * A pinned route only ever refers to one of these, so it is dropped the moment the
 * plan moves on underneath it — the walk a shared link names lives in its own
 * state and is not keyed by this, because a walk is a set of areas rather than a
 * position in a list, and the reader keeps editing it as the plan changes.
 */
function planKeyOf(
  itemIds: string[],
  startingClothes: string | null,
  mode: RouteModeChoice,
  lookAhead: number,
): string {
  return `${itemIds.join("|")}#${startingClothes ?? ""}#${mode}${lookAhead}`;
}

export interface WikiExplorerProps {
  dataset: WikiDataset;
}

/**
 * Interactive wiki entry point.
 *
 * Keeps the "no data" guard outside {@link WikiExplorerContent} so that
 * component can call its hooks unconditionally.
 */
export function WikiExplorer({ dataset }: WikiExplorerProps) {
  if (dataset.items.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center bg-ink-950 px-6 text-center text-stone-400">
        <div>
          <p className="font-display text-2xl text-stone-200">No items loaded</p>
          <p className="mt-2 text-sm">
            <code className="font-mono text-amber-300">src/data/data.json</code> contains no items.
          </p>
        </div>
      </main>
    );
  }

  return <WikiExplorerContent dataset={dataset} />;
}

/**
 * Owns nothing but cross-pane UI state — map focus, hovered area, open area
 * panel — and delegates the rest: {@link useCatalogQuery} the rail filters,
 * {@link useItemSelection} the open item, {@link useRoutePlan} the island
 * overlay. Every child below is presentational.
 */
function WikiExplorerContent({ dataset }: WikiExplorerProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  /**
   * Which pane the stacked layout shows. One column cannot hold both, and the
   * map used to be a long scroll below the catalogue; from `lg` up both are
   * visible at once and this is ignored.
   */
  const [mobilePane, setMobilePane] = useState<MobilePane>("items");

  /**
   * How wide the island ended up, reported by the map itself. The bubble sizes
   * the route solver reserves depend on it, so this is what keeps the layout
   * solver and the drawn bubbles in the same units.
   */
  const [islandWidth, setIslandWidth] = useState<number | null>(null);

  /** Wild-animal drops are opt-in: a maybe is not what the island is for. */
  const [showAnimalDrops, setShowAnimalDrops] = useState(false);

  /**
   * Focus mode: the island folded away so the crafting half of the item can use
   * the width it was sharing. Meaningful only from `lg` up, where the two panes
   * sit side by side — below that the island is a tab of its own, so the switch
   * is hidden and this is ignored even if it was left on.
   */
  const [islandCollapsed, setIslandCollapsed] = useState(false);
  const isTwoColumn = useMediaQuery(TWO_COLUMN_QUERY);
  const collapsed = islandCollapsed && isTwoColumn;

  const [focusedMaterialId, setFocusedMaterialId] = useState<string | null>(null);
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  /** Clothes picked before the match; empty means the survivor starts bare. */
  const [startingClothes, setStartingClothes] = useState<string | null>(null);
  /** Fastest by distance, greedy for value worn early, or the reader's own trace. */
  const [routeMode, setRouteMode] = useState<RouteModeChoice>("fastest");
  /**
   * The areas the reader clicked while tracing by hand, in visit order.
   *
   * Kept apart from the mode rather than inside it: switching to `fastest` and
   * back should find the trace where it was left, and the solver keeps answering
   * for the plan either way. A link that names a walk arrives here too — a shared
   * route *is* a trace, prefilled.
   */
  const [manualAreaIds, setManualAreaIds] = useState<string[]>([]);
  /**
   * True while the trace is held down and the island answers like a computed route
   * — areas open, item cards hover. Off while the walk is being drawn, and turned on
   * by a link that carries one, since the reader came to read that walk rather than
   * to keep editing it before they have looked at it.
   */
  const [manualLocked, setManualLocked] = useState(false);

  /** A click on an area adds it to the trace, or takes it out. */
  const toggleManualArea = useCallback((areaId: string) => {
    setManualAreaIds((previous) =>
      previous.includes(areaId) ? previous.filter((id) => id !== areaId) : [...previous, areaId],
    );
  }, []);

  const clearManualTrace = useCallback(() => {
    setManualAreaIds([]);
    // Nothing left to hold down: with no walk the lock would only stop the reader
    // from drawing the next one.
    setManualLocked(false);
  }, []);

  const toggleManualLocked = useCallback(() => setManualLocked((locked) => !locked), []);

  /**
   * Changing mode drops the hovered route with the list that drawn it: the rows
   * unmount without a mouseleave, and a hover left behind would keep a route
   * tinted on an island that is no longer showing one.
   */
  const handleModeChange = useCallback((mode: RouteModeChoice) => {
    setHoveredRouteId(null);
    setRouteMode(mode);
  }, []);

  const [lookAhead, setLookAhead] = useState(DEFAULT_LOOK_AHEAD);
  /**
   * The route the reader pinned, if they have touched one for this plan.
   *
   * `routeId: null` is not "nothing" — it is the reader *clearing* the highlight,
   * which has to outrank the route a shared link arrived with, or the one pin a
   * link sets could never be dismissed.
   */
  const [readerRoute, setReaderRoute] = useState<{ planKey: string; routeId: string | null } | null>(
    null,
  );
  /**
   * False until the address bar has been read.
   *
   * The plan in it is adopted by the effect below, and written back by the one
   * further down; without this gate that second effect would run first, in the same
   * commit, and overwrite the query with the empty state it was about to replace.
   */
  const [linkApplied, setLinkApplied] = useState(false);
  /**
   * The plan an arriving link named a walk for, by its plan key.
   *
   * Held as the *identity of the plan the link described* rather than as a flag to
   * be cleared: the trace is drawn far down the rail — below the catalogue, the
   * crafting half of the item and the routes panel — so a link that carries one
   * scrolls the rail to it rather than leaving the reader at an item's recipe with
   * their route off screen. Booking a bookmark moves the plan on, which is what
   * spends the reveal: the rail is scrolled once, on arrival, and never again by
   * the reader's own edits.
   */
  const [linkedWalk, setLinkedWalk] = useState<string | null>(null);

  /** The rail's "Used to craft" section, for a link that wants it at the top. */
  const usedToCraftRef = useRef<HTMLDivElement | null>(null);
  /**
   * What the link that is being adopted asked the rail to show, until the panels
   * it describes exist. Spent by the effect below; a ref rather than state because
   * nothing renders from it.
   */
  const arrivalScroll = useRef<"crafting" | null>(null);

  const catalog = useCatalogQuery(dataset.items);
  const {
    item: activeItem,
    canGoBack,
    toggleFromCatalog,
    selectItem,
    followLink,
    goBack,
    clearSelection,
  } = useItemSelection(dataset.items);

  const bookmarks = useBookmarks();
  const { setBookmarks } = bookmarks;

  /**
   * Adopts the plan a shared link carries.
   *
   * Every line below is a `setState` in an effect, which the compiler rules flag as
   * a cascading render — and here it is the honest shape: the query is an external
   * system handing over one instruction, read once on arrival, with nothing to
   * subscribe to afterwards (the other direction is the effect further down).
   * Running twice, which StrictMode does in development, costs nothing: the second
   * pass reads the same query and adopts the same plan.
   */
  /* eslint-disable react-hooks/set-state-in-effect -- one-shot read of the address bar */
  useEffect(() => {
    setLinkApplied(true);

    const shared = readSharedUrl(window.location.search, dataset);
    if (!shared) return;

    if (shared.itemId !== null) selectItem(shared.itemId);
    setBookmarks(shared.bookmarkIds);
    setStartingClothes(shared.startingClothes);

    /*
     * A link that names a walk opens on it: the manual mode, with the walk's areas
     * as the trace. That is the whole of what the link says about the route — the
     * ranking mode and the look-ahead are not in the payload any more, so a link
     * that names no walk leaves this screen on the defaults it would have had.
     *
     * The reader can then keep editing the trace, which is the point: a shared
     * route is a route to start from, not a picture of one.
     */
    if (shared.routeAreaIds.length > 0) {
      setManualAreaIds(shared.routeAreaIds);
      setRouteMode("manual");
      // Locked, because the link named a walk to read: the island answers like a
      // computed route until the reader unlocks it and starts editing.
      setManualLocked(true);
      // The plan the link describes, in the order `plannedItems` will build it: the
      // open item first, then the bookmarks it is not already.
      const planned =
        shared.itemId === null
          ? shared.bookmarkIds
          : [shared.itemId, ...shared.bookmarkIds.filter((id) => id !== shared.itemId)];
      // The look-ahead is the default, because the payload no longer carries one:
      // the arriving screen is on it, and this has to key the same plan the render
      // below will compute — hence the constant rather than the state, which would
      // make this one-shot read of the address bar depend on a value it sets.
      setLinkedWalk(planKeyOf(planned, shared.startingClothes, "manual", DEFAULT_LOOK_AHEAD));
    }

    /*
     * What the arriving link is asking to be shown.
     *
     * An item is open, so the reader came for that item: the catalogue above is not
     * what they want to read first, and the rail is brought down to its crafting
     * work. A plan of bookmarks alone has no item to open, so it keeps the default
     * top. A walk outranks both: that is the thing the link is about, and the trace
     * row scrolls itself into view — standing aside here is what lets it.
     */
    arrivalScroll.current =
      shared.routeAreaIds.length > 0 ? null : shared.itemId !== null ? "crafting" : null;
  }, [dataset, selectItem, setBookmarks]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * What the island and the routes cover: the selected item first — so it heads
   * the bookmark bar — then every bookmark in the order it was added.
   */
  const plannedItems = useMemo(
    () => plannedItemsFor(dataset.itemsById, activeItem?.id ?? null, bookmarks.ids),
    [activeItem?.id, bookmarks.ids, dataset.itemsById],
  );

  const usedToCraft = activeItem
    ? (dataset.usedToCraftByItemId[activeItem.id] ?? NO_CRAFTABLES)
    : NO_CRAFTABLES;
  const route = useRoutePlan(dataset, activeItem, plannedItems, {
    startingClothes,
    mode: routeMode,
    lookAhead,
    islandWidth,
    showAnimalDrops,
    manualAreaIds,
    manualLocked,
  });

  /** Named once per plan: the route panel is memoized, and a fresh array defeats it. */
  const unobtainableNames = useMemo(
    () => route.unobtainable.map((planned) => planned.name),
    [route.unobtainable],
  );

  /** The clothes on offer, resolved once so the selector can show artwork. */
  const startingOptions = useMemo(
    () =>
      STARTING_CLOTHES_IDS.map((id) => dataset.itemsById[id]).filter(
        (item): item is WikiItem => item !== undefined,
      ),
    [dataset.itemsById],
  );

  /**
   * Identity of the current plan, so a pin never outlives what it pointed at.
   * The starting clothes are part of it: changing them changes the routes.
   */
  const planKey = planKeyOf(
    plannedItems.map((planned) => planned.id),
    startingClothes,
    routeMode,
    lookAhead,
  );

  /**
   * True while the screen is still showing the plan an arriving link named a walk
   * for — the one visit that scrolls the rail down to the trace; see
   * {@link linkedWalk}.
   */
  const revealWalk = linkedWalk !== null && linkedWalk === planKey;

  /**
   * What the island's random-spawn box highlights: everything the plan is about,
   * which is the planned items themselves as well as the materials they need — an
   * item with no recipe and no area is exactly the case the box exists for, and it
   * would otherwise never be the one lit up.
   */
  const plannedItemIds = useMemo(() => {
    const ids = new Set(plannedItems.map((planned) => planned.id));
    for (const material of route.materials) ids.add(material.item.id);
    return [...ids];
  }, [plannedItems, route.materials]);

  const bookmarkEntries = useMemo(
    () =>
      plannedItems.map((planned) => ({
        item: planned,
        selected: planned.id === activeItem?.id,
        bookmarked: bookmarks.ids.includes(planned.id),
      })),
    [activeItem?.id, bookmarks.ids, plannedItems],
  );

  /**
   * Focusing a material also lights up everything needed to craft it, so the
   * whole chain behind an ingredient is highlighted rather than one area.
   */
  const focus = useMemo<MapFocus | null>(
    () =>
      focusedMaterialId
        ? {
            itemId: focusedMaterialId,
            subtreeIds: route.subtreeByItemId[focusedMaterialId] ?? [focusedMaterialId],
          }
        : null,
    [focusedMaterialId, route.subtreeByItemId],
  );

  const selectedArea = selectedAreaId ? (dataset.areasById[selectedAreaId] ?? null) : null;
  const selectedAreaItems = selectedAreaId
    ? (dataset.itemsByAreaId[selectedAreaId] ?? NO_ITEMS)
    : NO_ITEMS;
  const selectedAreaAnimals = selectedAreaId
    ? (dataset.animalsByAreaId[selectedAreaId] ?? NO_ANIMALS)
    : NO_ANIMALS;

  /** `undefined` until the reader touches a route for this plan, `null` once they clear it. */
  const readerRouteId =
    readerRoute && readerRoute.planKey === planKey ? readerRoute.routeId : undefined;

  /** Hover wins over nothing; a pinned route outlives the pointer leaving the row. */
  const pinnedRouteId = readerRouteId ?? null;

  /**
   * Brings the crafting section to the top of the rail.
   *
   * Adopting the link only *schedules* the plan; this runs in the commit after it,
   * which is the first one that has the section on screen at all. The intent is
   * spent on the way in, so a reader who scrolls afterwards is never pulled back to
   * it, and a link that asked for nothing leaves the rail where it is.
   *
   * The move is confined to the pane the section lives in. `scrollIntoView` would
   * scroll the document as well, which is how the section ended up under the header
   * rather than against it.
   */
  useEffect(() => {
    if (!linkApplied || arrivalScroll.current === null) return;
    arrivalScroll.current = null;
    scrollWithinScroller(usedToCraftRef.current, "start");
  }, [linkApplied]);

  const activeRouteId = pinnedRouteId ?? hoveredRouteId;
  const activeRoute = activeRouteId
    ? (route.routes.find((candidate) => candidate.id === activeRouteId) ?? null)
    : null;

  /**
   * Tracing by hand: the rail shows the trace instead of the route list, and the
   * island draws it itself rather than through the `activeRoute` machinery.
   *
   * The two are kept apart on purpose. `activeRoute` is an *answer* — it dims
   * everything off its path and replaces the material bubbles with its steps —
   * while a trace is still being chosen, so the areas the reader might click next
   * have to stay lit and readable. Only the trace's own stops are tinted.
   */
  const manualMode = routeMode === "manual";
  const railedRoute = manualMode ? route.manualRoute : activeRoute;
  const manualTrace = useMemo(
    () =>
      manualMode
        ? {
            plan: route.manualRoute,
            locked: manualLocked,
            onToggleArea: toggleManualArea,
            onToggleLocked: toggleManualLocked,
          }
        : null,
    [manualLocked, manualMode, route.manualRoute, toggleManualArea, toggleManualLocked],
  );

  /** The pinned route itself, which is the walk the URL describes. */
  const pinnedRoute = useMemo(
    () => (pinnedRouteId ? (route.routes.find((candidate) => candidate.id === pinnedRouteId) ?? null) : null),
    [pinnedRouteId, route.routes],
  );

  /**
   * The walk the URL describes: the trace being drawn by hand, or the computed
   * route the reader pinned. One slot, whichever is on screen — a shared link
   * names a walk, and both kinds of walk are the same thing to the reader.
   *
   * The trace is written from the *walked* areas rather than the clicked ones, so
   * a link that named an area this build cannot draw is written back without it
   * rather than carrying a stop that is not there.
   */
  const sharedRouteAreaIds = manualMode
    ? (route.manualRoute?.areaIds ?? NO_AREAS)
    : (pinnedRoute?.areaIds ?? NO_AREAS);

  /**
   * The address bar *is* the plan.
   *
   * One opaque parameter, rewritten in place: a refresh, a bookmark, the browser's
   * own "copy link" and handing the tab to another device all reproduce what is on
   * screen, and nothing is ever pushed, so Back still leaves the archive. Hovering
   * cannot churn it — only the pinned route is in here, never the hovered one — and
   * a URL that already says the right thing is left alone rather than replaced with
   * itself.
   *
   * `history.state` is passed back rather than `null`: Next keeps its own routing
   * state there, and throwing it away is how a soft-navigated app loses its place.
   */
  useEffect(() => {
    if (!linkApplied) return;

    const url = buildSharedUrl(
      window.location.href,
      {
        itemId: activeItem?.id ?? null,
        bookmarkIds: bookmarks.ids,
        startingClothes,
        routeAreaIds: sharedRouteAreaIds,
      },
      dataset,
    );

    if (url !== window.location.href) window.history.replaceState(window.history.state, "", url);
  }, [
    linkApplied,
    dataset,
    activeItem?.id,
    bookmarks.ids,
    startingClothes,
    sharedRouteAreaIds,
  ]);

  /**
   * Bubbles for a highlighted route: what is picked up and built at each step.
   *
   * A trace gets none: its stops are the areas the reader just clicked, and the
   * map's own bubbles are what they are choosing between — replacing those with
   * step cards would take the question away while it is being asked. What the trace
   * does at a stop is drawn *into* that stop's material bubble instead; see
   * `AreaBubbleCard`'s `step`.
   */
  const stepOverlay = useStepOverlay(manualMode ? null : activeRoute, dataset.map, islandWidth);

  /** Clicking the highlight again lets it go; the pointer keeps it alive meanwhile. */
  const handleSelectRoute = useCallback(
    (routeId: string) => {
      // The highlight being clicked is the one to drop: whether it came from a link
      // or from the reader, one click puts it back the way it was found.
      setReaderRoute({ planKey, routeId: pinnedRouteId === routeId ? null : routeId });
    },
    [planKey, pinnedRouteId],
  );

  /**
   * The link to one walk.
   *
   * It is built from the live state rather than read back out of the address bar,
   * because the bar carries the *pinned* walk and this row may not be it. One
   * function builds both, so the link that is copied and the URL that is shown
   * cannot drift apart — and it takes the walk's areas rather than a position in
   * the list, because a position is only meaningful next to the code that ranked
   * it.
   */
  const handleShareRoute = useCallback(
    async (routeAreaIds: string[]) => {
      const link = buildSharedUrl(
        window.location.href,
        {
          itemId: activeItem?.id ?? null,
          bookmarkIds: bookmarks.ids,
          startingClothes,
          routeAreaIds,
        },
        dataset,
      );
      return copyText(link);
    },
    [dataset, activeItem?.id, bookmarks.ids, startingClothes],
  );

  /**
   * A route the solver found, handed to the manual mode: its areas become the trace
   * and the reader edits from there. The panel does not move — the trace takes the
   * list's place where the list already was — so nothing is scrolled.
   */
  const handleOpenManual = useCallback((routeAreaIds: string[]) => {
    setHoveredRouteId(null);
    setManualAreaIds(routeAreaIds);
    setRouteMode("manual");
  }, []);

  /** Changing item, from either entry point, clears the map focus. */
  const handleSelectFromCatalog = useCallback(
    (itemId: string) => {
      toggleFromCatalog(itemId);
      setFocusedMaterialId(null);
    },
    [toggleFromCatalog],
  );

  const handleFollowLink = useCallback(
    (itemId: string) => {
      followLink(itemId);
      setFocusedMaterialId(null);
    },
    [followLink],
  );

  const handleGoBack = useCallback(() => {
    goBack();
    setFocusedMaterialId(null);
  }, [goBack]);

  /** Empties the map: no selection, no focus, no open area. */
  const handleClearSelection = useCallback(() => {
    clearSelection();
    setFocusedMaterialId(null);
    setSelectedAreaId(null);
  }, [clearSelection]);

  /**
   * A click in the plan bar means "take this out": the selected item closes, a
   * bookmark is dropped. An item that is both closes first and stays bookmarked,
   * so the plan never loses an entry the reader did not point at.
   */
  const handleBookmarkEntryClick = useCallback(
    (itemId: string) => {
      if (itemId === activeItem?.id) handleClearSelection();
      else bookmarks.toggleBookmark(itemId);
    },
    [activeItem?.id, bookmarks, handleClearSelection],
  );

  useHotkeys({
    onSearchShortcut: () => searchInputRef.current?.focus(),
    onEscape: () => {
      if (selectedAreaId) {
        setSelectedAreaId(null);
      } else if (pinnedRouteId) {
        setReaderRoute({ planKey, routeId: null });
      } else if (focusedMaterialId) {
        setFocusedMaterialId(null);
      } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
  });

  /** Both panes occupy the same slot: one is shown, the other is display:none. */
  const paneDisplay = (pane: MobilePane) => (mobilePane === pane ? "flex" : "hidden");

  /**
   * The four blocks the rail is made of, named so the two arrangements below can
   * place them without repeating a line of their wiring: stacked in one column
   * beside the island, or split across three when it is folded away.
   */
  const catalogPane = (
    <MemoCatalogPanel
      items={catalog.pageItems}
      matchedCount={catalog.visibleItems.length}
      page={catalog.page}
      pageCount={catalog.pageCount}
      onPageChange={catalog.goToPage}
      totalCount={dataset.items.length}
      query={catalog.query}
      onQueryChange={catalog.updateQuery}
      groupCounts={catalog.groupCounts}
      typeCounts={catalog.typeCounts}
      activeItemId={activeItem?.id ?? null}
      bookmarkedIds={bookmarks.ids}
      onSelectItem={handleSelectFromCatalog}
      onToggleBookmark={bookmarks.toggleBookmark}
      searchInputRef={searchInputRef}
    />
  );

  const usedToCraftPane = activeItem ? (
    <UsedToCraftPanel
      items={usedToCraft}
      activeItemId={activeItem?.id ?? null}
      onSelect={handleFollowLink}
      // Hidden island: this strip is the first thing in the crafting column, and
      // the recipe below it starts wherever the strip ends. Reserving the height
      // keeps that starting point put, whatever is selected.
      reserveHeight={collapsed}
      sectionRef={usedToCraftRef}
    />
  ) : null;

  const detailPane = (
    <ItemDetailPanel
      item={activeItem}
      tree={route.tree}
      materialCount={route.recipeMaterials.length}
      areaCount={route.recipeAreaCount}
      bookmarked={activeItem ? bookmarks.isBookmarked(activeItem.id) : false}
      focusedMaterialId={focusedMaterialId}
      onHoverMaterial={setFocusedMaterialId}
      onSelectItem={handleFollowLink}
      onSelectArea={setSelectedAreaId}
      onToggleBookmark={bookmarks.toggleBookmark}
      canGoBack={canGoBack}
      onGoBack={handleGoBack}
      onClearSelection={handleClearSelection}
    />
  );

  const routesPane =
    plannedItems.length > 0 ? (
    <MemoRoutePlanPanel
      routes={route.routes}
      plannedCount={plannedItems.length}
      truncated={route.routesTruncated}
      unobtainableNames={unobtainableNames}
      inventoryBlocked={route.inventoryBlocked}
      assumed={route.assumed}
      nothingToGather={route.nothingToGather}
      activeRouteId={railedRoute?.id ?? null}
      planKey={planKey}
      startingClothes={startingClothes}
      startingOptions={startingOptions}
      onStartingClothesChange={setStartingClothes}
      mode={routeMode}
      onModeChange={handleModeChange}
      lookAhead={lookAhead}
      onLookAheadChange={setLookAhead}
      onHoverRoute={setHoveredRouteId}
      onSelectRoute={handleSelectRoute}
      onSelectArea={setSelectedAreaId}
      onSelectItem={handleFollowLink}
      onShareRoute={handleShareRoute}
      manualRoute={route.manualRoute}
      manualComplete={route.manualComplete}
      onClearManual={clearManualTrace}
      onOpenManual={handleOpenManual}
      revealWalk={revealWalk}
    />
    ) : null;

  return (
    // `100dvh` where it is understood, `100vh` everywhere else: the switcher is
    // pinned either way, but a stale viewport height would leave the panes sized
    // for a screen that is not there.
    <main
      className="flex h-screen flex-col overflow-hidden bg-ink-950 text-stone-100"
      style={{ height: "100dvh" }}
    >
      <AppHeader
        stats={dataset.stats}
        islandCollapsed={collapsed}
        onToggleIsland={() => setIslandCollapsed((folded) => !folded)}
      />

      {/*
       * Each pane scrolls on its own, so switching tabs never lands mid-list, and
       * the bottom inset keeps the last row of either pane clear of the pinned
       * switcher.
       */}
      <div
        className={`flex min-h-0 flex-1 flex-col lg:flex-row lg:pb-0 ${PANE_BOTTOM_INSET}`}
      >
        {/*
         * The item rail. With the island folded away this one scrolling column
         * becomes three: the catalogue stays put, the crafting half of the item
         * — what consumes it, then how it is made — moves into the space the map
         * was using, and the routes take the right edge as a panel of their own.
         * Each column scrolls on its own, so a long recipe tree no longer pushes
         * the routes off the bottom of a shared column.
         */}
        {/*
         * The share and the ceiling together are what the previous deployment drew: at
         * the 1745 CSS px viewport it was measured at, and at every wider one, the cap
         * binds and the rail is the 560px it always was; below that the share takes
         * over and the rail shrinks with the window instead of holding 560px until the
         * screen is too small for it.
         *
         * The fraction used to be capped in pixels (`max-w-[560px]`), which made the
         * rail a different size on every screen: 38% of a 1280 laptop, 29% of a
         * 1080p desk, 15% of a 4K one, with the map absorbing all the difference. A
         * fraction with nothing capping it is the only version that holds, and it
         * holds at 100% zoom and above because it is a fraction of the viewport
         * rather than a count of pixels, so browser zoom cancels out.
         *
         * Below `lg` the pane is the whole screen, and this is ignored.
         */}
        <aside
          id="pane-items"
          role="tabpanel"
          aria-labelledby="tab-items"
          className={`${paneDisplay("items")} min-h-0 w-full flex-1 flex-col overflow-y-auto border-b border-white/[0.08] bg-ink-900 lg:flex lg:w-[32.08%] lg:max-w-[560px] lg:flex-none lg:border-b-0 lg:border-r`}
        >
          {catalogPane}

          {!collapsed && (
            <>
              {usedToCraftPane}
              {detailPane}
              {routesPane}
            </>
          )}
        </aside>

        {collapsed && (
          <>
            <section
              aria-label="Item crafting"
              className={`flex min-h-0 flex-1 flex-col overflow-y-auto bg-ink-900 ${
                routesPane ? "border-r border-white/[0.08]" : ""
              }`}
            >
              {usedToCraftPane}
              {detailPane}
            </section>

            {routesPane && (
              <aside
                aria-label="Routes"
                className="flex min-h-0 w-[26%] min-w-[300px] max-w-[400px] flex-col overflow-y-auto bg-ink-900"
              >
                {routesPane}
              </aside>
            )}
          </>
        )}

        {!collapsed && (
        <IslandMapPanel
          className={`${paneDisplay("map")} lg:flex`}
          randomSpawnItems={dataset.randomSpawnItems}
          dropAnimalsByItemId={dataset.animalsByDropItemId}
          plannedItemIds={plannedItemIds}
          animalDrops={showAnimalDrops}
          onToggleAnimalDrops={() => setShowAnimalDrops((shown) => !shown)}
          renderWidth={islandWidth}
          onRenderWidthChange={setIslandWidth}
          map={dataset.map}
          areas={dataset.areas}
          bubbles={route.bubbles}
          placements={route.placements}
          overlayMode={route.overlayMode}
          hasPlan={plannedItems.length > 0}
          focus={focus}
          activeRoute={manualMode ? null : activeRoute}
          stepOverlay={manualMode ? null : stepOverlay}
          manualTrace={manualTrace}
          activeItemId={activeItem?.id ?? null}
          bookmarks={bookmarkEntries}
          onBookmarkEntryClick={handleBookmarkEntryClick}
          onClearBookmarks={bookmarks.clearBookmarks}
          hoveredAreaId={hoveredAreaId}
          onHoverArea={setHoveredAreaId}
          onHoverMaterial={setFocusedMaterialId}
          onSelectItem={handleFollowLink}
          onSelectArea={setSelectedAreaId}
          selectedArea={selectedArea}
          selectedAreaItems={selectedAreaItems}
          selectedAreaAnimals={selectedAreaAnimals}
          onCloseArea={() => setSelectedAreaId(null)}
        />
        )}
      </div>

      <MobilePaneTabs pane={mobilePane} onPaneChange={setMobilePane} />
    </main>
  );
}
