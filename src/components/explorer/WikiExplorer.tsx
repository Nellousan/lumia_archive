"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatalogPanel } from "@/components/catalog/CatalogPanel";
import { ItemDetailPanel } from "@/components/item/ItemDetailPanel";
import { UsedToCraftPanel } from "@/components/item/UsedToCraftPanel";
import { AppHeader } from "@/components/layout/AppHeader";
import { IslandMapPanel } from "@/components/map/IslandMapPanel";
import { useCatalogQuery } from "@/hooks/useCatalogQuery";
import { useHotkeys } from "@/hooks/useHotkeys";
import { useItemSelection } from "@/hooks/useItemSelection";
import { useRoutePlan } from "@/hooks/useRoutePlan";
import type { MapFocus } from "@/lib/wiki/route";
import type { AreaItemRef, AreaSpawnRef, WikiDataset, WikiItem } from "@/lib/wiki/types";

/** Stable empties so derived memos do not invalidate on every render. */
const NO_SPAWNS: AreaSpawnRef[] = [];
const NO_ITEMS: AreaItemRef[] = [];
const NO_CRAFTABLES: WikiItem[] = [];

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

  const [focusedMaterialId, setFocusedMaterialId] = useState<string | null>(null);
  const [hoveredAreaId, setHoveredAreaId] = useState<string | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);
  /**
   * The pinned route travels with the item it was pinned for: opening another
   * item clears the highlight without an effect that would fight the render.
   */
  const [pinnedRoute, setPinnedRoute] = useState<{ itemId: string; routeId: string } | null>(null);

  const catalog = useCatalogQuery(dataset.items);
  const { item: activeItem, canGoBack, toggleFromCatalog, followLink, goBack, clearSelection } =
    useItemSelection(dataset.items);

  const spawnRefs = activeItem
    ? (dataset.spawnsByItemId[activeItem.id] ?? NO_SPAWNS)
    : NO_SPAWNS;
  const usedToCraft = activeItem
    ? (dataset.usedToCraftByItemId[activeItem.id] ?? NO_CRAFTABLES)
    : NO_CRAFTABLES;
  const route = useRoutePlan(dataset, activeItem, spawnRefs);

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

  /** Hover wins over nothing; a pinned route outlives the pointer leaving the row. */
  const pinnedRouteId =
    pinnedRoute && pinnedRoute.itemId === activeItem?.id ? pinnedRoute.routeId : null;
  const activeRouteId = pinnedRouteId ?? hoveredRouteId;
  const activeRoute = activeRouteId
    ? (route.routes.find((candidate) => candidate.id === activeRouteId) ?? null)
    : null;

  /** Clicking the highlight again lets it go; the pointer keeps it alive meanwhile. */
  const handleSelectRoute = useCallback(
    (routeId: string) => {
      const itemId = activeItem?.id;
      if (!itemId) return;
      setPinnedRoute((previous) =>
        previous?.itemId === itemId && previous.routeId === routeId ? null : { itemId, routeId },
      );
    },
    [activeItem?.id],
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

  useHotkeys({
    onSearchShortcut: () => searchInputRef.current?.focus(),
    onEscape: () => {
      if (selectedAreaId) {
        setSelectedAreaId(null);
      } else if (pinnedRoute) {
        setPinnedRoute(null);
      } else if (focusedMaterialId) {
        setFocusedMaterialId(null);
      } else if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
  });

  // Surface loader warnings for contributors instead of failing silently.
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || dataset.warnings.length === 0) return;
    console.warn(`[lumia-archive] ${dataset.warnings.length} data note(s):`);
    for (const warning of dataset.warnings) console.warn(`  • ${warning}`);
  }, [dataset.warnings]);

  return (
    <main className="min-h-screen bg-ink-950 text-stone-100">
      <AppHeader stats={dataset.stats} />

      <div className="flex min-h-[calc(100vh-4rem)] flex-col lg:h-[calc(100vh-4rem)] lg:flex-row lg:overflow-hidden">
        <aside className="flex w-full shrink-0 flex-col border-b border-white/[0.08] bg-ink-900 lg:w-[38%] lg:max-w-[560px] lg:min-h-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <CatalogPanel
            items={catalog.visibleItems}
            totalCount={dataset.items.length}
            query={catalog.query}
            onQueryChange={catalog.updateQuery}
            groupCounts={catalog.groupCounts}
            typeCounts={catalog.typeCounts}
            activeItemId={activeItem?.id ?? null}
            onSelectItem={handleSelectFromCatalog}
            searchInputRef={searchInputRef}
          />

          {activeItem && (
            <UsedToCraftPanel
              items={usedToCraft}
              activeItemId={activeItem?.id ?? null}
              onSelect={handleFollowLink}
            />
          )}

          <ItemDetailPanel
            item={activeItem}
            tree={route.tree}
            materialCount={route.recipeMaterials.length}
            areaCount={route.recipeAreaCount}
            spawnRefs={spawnRefs}
            routes={route.routes}
            activeRouteId={activeRoute?.id ?? null}
            focusedMaterialId={focusedMaterialId}
            onHoverMaterial={setFocusedMaterialId}
            onHoverRoute={setHoveredRouteId}
            onSelectRoute={handleSelectRoute}
            onSelectItem={handleFollowLink}
            onSelectArea={setSelectedAreaId}
            canGoBack={canGoBack}
            onGoBack={handleGoBack}
            onClearSelection={handleClearSelection}
          />
        </aside>

        <IslandMapPanel
          map={dataset.map}
          areas={dataset.areas}
          bubbles={route.bubbles}
          placements={route.placements}
          materials={route.recipeMaterials}
          overlayMode={route.overlayMode}
          focus={focus}
          activeRoute={activeRoute}
          activeItemId={activeItem?.id ?? null}
          hoveredAreaId={hoveredAreaId}
          onHoverArea={setHoveredAreaId}
          onHoverMaterial={setFocusedMaterialId}
          onSelectItem={handleFollowLink}
          onSelectArea={setSelectedAreaId}
          onClearSelection={handleClearSelection}
          selectedArea={selectedArea}
          selectedAreaItems={selectedAreaItems}
          onCloseArea={() => setSelectedAreaId(null)}
          warnings={dataset.warnings}
        />
      </div>
    </main>
  );
}
