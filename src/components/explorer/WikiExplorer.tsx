"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { STARTING_CLOTHES_IDS } from "@/lib/wiki/inventory";
import type { MapFocus } from "@/lib/wiki/route";
import { DEFAULT_LOOK_AHEAD, type RouteMode } from "@/lib/wiki/routes";
import { buildSharedUrl, readSharedUrl } from "@/lib/wiki/share";
import type {
  AreaItemRef,
  WikiAnimal,
  WikiDataset,
  WikiItem,
} from "@/lib/wiki/types";

/** Where the island and the item rail start sharing the row (Tailwind's `lg`). */
const TWO_COLUMN_QUERY = "(min-width: 1024px)";

/** Stable empties so derived memos do not invalidate on every render. */
const NO_ITEMS: AreaItemRef[] = [];
const NO_ANIMALS: WikiAnimal[] = [];
const NO_CRAFTABLES: WikiItem[] = [];

/**
 * What identifies a plan: the items it gathers, in order, then the three settings
 * the solver reads.
 *
 * A pinned route, and the route a shared link names, only ever refer to one of
 * these — so both are dropped the moment the plan moves on underneath them. The
 * link's own key is worked out with this from the query alone, before the state it
 * describes exists.
 */
function planKeyOf(
  itemIds: string[],
  startingClothes: string | null,
  mode: RouteMode,
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
  /** Fastest by distance, or greedy for value worn early. */
  const [routeMode, setRouteMode] = useState<RouteMode>("fastest");
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
   * The route a shared link named, as a number in the list its plan produces.
   *
   * It is carried with the plan key worked out *from the link*, because the render
   * that applies the link has not happened yet, and resolved to an id later — see
   * {@link linkedRouteId}.
   */
  const [linkedRoute, setLinkedRoute] = useState<{ planKey: string; number: number } | null>(null);
  /**
   * False until the address bar has been read.
   *
   * The plan in it is adopted by the effect below, and written back by the one
   * further down; without this gate that second effect would run first, in the same
   * commit, and overwrite the query with the empty state it was about to replace.
   */
  const [linkApplied, setLinkApplied] = useState(false);

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
    setRouteMode(shared.mode);
    setLookAhead(shared.lookAhead);

    if (shared.routeNumber !== null) {
      // The plan the link describes, in the same order `plannedItems` will build:
      // the open item first, then the bookmarks it is not already.
      const planned =
        shared.itemId === null
          ? shared.bookmarkIds
          : [shared.itemId, ...shared.bookmarkIds.filter((id) => id !== shared.itemId)];
      setLinkedRoute({
        planKey: planKeyOf(planned, shared.startingClothes, shared.mode, shared.lookAhead),
        number: shared.routeNumber,
      });
    }
  }, [dataset, selectItem, setBookmarks]);
  /* eslint-enable react-hooks/set-state-in-effect */

  /**
   * What the island and the routes cover: the selected item first — so it heads
   * the bookmark bar — then every bookmark in the order it was added.
   */
  const plannedItems = useMemo(() => {
    const planned: WikiItem[] = [];
    if (activeItem) planned.push(activeItem);
    for (const id of bookmarks.ids) {
      if (id === activeItem?.id) continue;
      const item = dataset.itemsById[id];
      if (item) planned.push(item);
    }
    return planned;
  }, [activeItem, bookmarks.ids, dataset.itemsById]);

  const usedToCraft = activeItem
    ? (dataset.usedToCraftByItemId[activeItem.id] ?? NO_CRAFTABLES)
    : NO_CRAFTABLES;
  const route = useRoutePlan(dataset, activeItem, plannedItems, {
    startingClothes,
    mode: routeMode,
    lookAhead,
    islandWidth,
    showAnimalDrops,
  });

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

  /**
   * Where the route a link named sits in the list *this* plan produces. The number
   * is a rank, so it only means something next to the plan it was ranked in; a plan
   * that has moved on resolves to nothing and the highlight lets go on its own.
   */
  const linkedRouteId =
    linkedRoute && linkedRoute.planKey === planKey
      ? (route.routes[linkedRoute.number - 1]?.id ?? null)
      : null;

  /** `undefined` until the reader touches a route for this plan, `null` once they clear it. */
  const readerRouteId =
    readerRoute && readerRoute.planKey === planKey ? readerRoute.routeId : undefined;

  /** Hover wins over nothing; a pinned route outlives the pointer leaving the row. */
  const pinnedRouteId = readerRouteId === undefined ? linkedRouteId : readerRouteId;
  /** A link opens the list onto its route: the fold lifts, the row scrolls into view. */
  const revealRouteId = linkedRouteId;
  const activeRouteId = pinnedRouteId ?? hoveredRouteId;
  const activeRoute = activeRouteId
    ? (route.routes.find((candidate) => candidate.id === activeRouteId) ?? null)
    : null;

  /** The rank of the highlighted route, which is how the URL names it. */
  const pinnedRank = useMemo(() => {
    if (pinnedRouteId === null) return null;
    const index = route.routes.findIndex((candidate) => candidate.id === pinnedRouteId);
    return index === -1 ? null : index + 1;
  }, [pinnedRouteId, route.routes]);

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
        mode: routeMode,
        lookAhead,
        routeNumber: pinnedRank,
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
    routeMode,
    lookAhead,
    pinnedRank,
  ]);

  /** Bubbles for a highlighted route: what is picked up and built at each step. */
  const stepOverlay = useStepOverlay(activeRoute, dataset.map, islandWidth);

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
   * The link to the plan on screen, with `routeNumber` picking one walk out of the
   * list that plan produces.
   *
   * It is built from the live state rather than read back out of the address bar,
   * because the bar carries the *pinned* route and this row may not be it. One
   * function builds both, so the link that is copied and the URL that is shown
   * cannot drift apart.
   */
  const handleShareRoute = useCallback(
    async (routeNumber: number) => {
      const link = buildSharedUrl(
        window.location.href,
        {
          itemId: activeItem?.id ?? null,
          bookmarkIds: bookmarks.ids,
          startingClothes,
          mode: routeMode,
          lookAhead,
          routeNumber,
        },
        dataset,
      );
      return copyText(link);
    },
    [dataset, activeItem?.id, bookmarks.ids, startingClothes, routeMode, lookAhead],
  );

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
    <CatalogPanel
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
    <RoutePlanPanel
      routes={route.routes}
      plannedCount={plannedItems.length}
      truncated={route.routesTruncated}
      unobtainableNames={route.unobtainable.map((planned) => planned.name)}
      inventoryBlocked={route.inventoryBlocked}
      assumed={route.assumed}
      nothingToGather={route.nothingToGather}
      activeRouteId={activeRoute?.id ?? null}
      planKey={planKey}
      startingClothes={startingClothes}
      startingOptions={startingOptions}
      onStartingClothesChange={setStartingClothes}
      mode={routeMode}
      onModeChange={setRouteMode}
      lookAhead={lookAhead}
      onLookAheadChange={setLookAhead}
      onHoverRoute={setHoveredRouteId}
      onSelectRoute={handleSelectRoute}
      onSelectArea={setSelectedAreaId}
      onSelectItem={handleFollowLink}
      revealRouteId={revealRouteId}
      onShareRoute={handleShareRoute}
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
        <aside
          id="pane-items"
          role="tabpanel"
          aria-labelledby="tab-items"
          className={`${paneDisplay("items")} min-h-0 w-full flex-1 flex-col overflow-y-auto border-b border-white/[0.08] bg-ink-900 lg:flex lg:flex-none lg:max-w-[560px] lg:border-b-0 lg:border-r ${
            // Folded away, the catalogue hands a little of its width to the
            // crafting column: the point of the mode is that the recipe gets the
            // room, and the grid of items barely notices 34% instead of 38%.
            collapsed ? "lg:w-[34%] lg:min-w-[320px]" : "lg:w-[38%]"
          }`}
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
          activeRoute={activeRoute}
          stepOverlay={stepOverlay}
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
