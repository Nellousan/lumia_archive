"use client";

/** Which half of the explorer the stacked layout is showing. */
export type MobilePane = "items" | "map";

/**
 * Height the switcher takes out of the viewport, as classes the panes pad
 * themselves with. Kept here so the bar and the room reserved for it cannot
 * drift apart; `3.5rem` is the button height, the rest is the home indicator.
 */
export const PANE_BOTTOM_INSET = "pb-[calc(3.5rem+env(safe-area-inset-bottom))]";

export interface MobilePaneTabsProps {
  pane: MobilePane;
  onPaneChange: (pane: MobilePane) => void;
}

interface PaneOption {
  id: MobilePane;
  label: string;
  /** Id of the region this button shows, for `aria-controls`. */
  panelId: string;
  hint: string;
}

const PANES: PaneOption[] = [
  {
    id: "items",
    label: "Item Select",
    panelId: "pane-items",
    hint: "Catalogue, item details and routes",
  },
  { id: "map", label: "Lumia Map", panelId: "pane-map", hint: "The island and the highlighted route" },
];

/**
 * The switcher between the rail and the island on the stacked layout.
 *
 * In one column the two panes sit on top of each other, so the map used to sit
 * below the whole catalogue — reachable only by scrolling past it. These two
 * buttons put both a thumb away from each other instead, and they are pinned to
 * the bottom of the viewport rather than sitting at the end of the column: the
 * point of the switcher is to be reachable from wherever the reader is, so it
 * must not depend on the page around it being scrolled to the end. The panes
 * reserve its height (`PANE_BOTTOM_INSET`), so nothing hides underneath.
 *
 * Hidden from `lg` up, where the panes are side by side and there is nothing to
 * switch between.
 */
export function MobilePaneTabs({ pane, onPaneChange }: MobilePaneTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Explorer section"
      className="fixed inset-x-0 bottom-0 z-50 flex items-stretch gap-2 border-t border-white/[0.08] bg-ink-900/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      {PANES.map((option) => {
        const active = option.id === pane;
        return (
          <button
            key={option.id}
            type="button"
            role="tab"
            id={`tab-${option.id}`}
            aria-selected={active}
            aria-controls={option.panelId}
            title={option.hint}
            onClick={() => onPaneChange(option.id)}
            className={`h-14 flex-1 rounded-xl border px-3 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
              active
                ? "border-amber-300/50 bg-amber-300/10 text-amber-200"
                : "border-white/10 bg-white/[0.03] text-stone-500 hover:text-stone-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}
