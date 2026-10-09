import type { WikiDataset } from "@/lib/wiki/types";

export interface AppHeaderProps {
  stats: WikiDataset["stats"];
  /**
   * True while the island is folded away. The switch lives here rather than on
   * the island itself because the island is exactly what disappears — a control
   * inside the pane it closes could not bring it back.
   */
  islandCollapsed: boolean;
  onToggleIsland: () => void;
}

/**
 * Fixed application header: identity on the left, then the island's switch and
 * the dataset stats on the right.
 *
 * The switch is desktop-only: below `lg` the island is a tab of its own, so
 * there is nothing to fold away.
 */
export function AppHeader({ stats, islandCollapsed, onToggleIsland }: AppHeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-white/[0.08] bg-ink-900 px-4 sm:px-7">
      <div className="flex items-center gap-3">
        <div className="relative grid size-9 place-items-center rounded-full border border-amber-200/40 bg-amber-300/10">
          <span className="font-display text-lg font-black text-amber-300">L</span>
          <span className="absolute -right-0.5 top-0 size-2 rounded-full border border-ink-900 bg-emerald-400" />
        </div>
        <div>
          <div className="font-display text-lg font-bold leading-none tracking-wide text-stone-100">
            LUMIA ARCHIVE
          </div>
          <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.26em] text-stone-500">
            Black Survival Wiki
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={onToggleIsland}
          aria-pressed={islandCollapsed}
          title={
            islandCollapsed
              ? "Bring the island back beside the item detail"
              : "Fold the island away and give the item detail the room"
          }
          className={`hidden items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition lg:inline-flex ${
            islandCollapsed
              ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200 hover:border-emerald-300/70"
              : "border-white/10 bg-white/[0.03] text-stone-400 hover:border-white/20 hover:text-stone-100"
          }`}
        >
          <span aria-hidden className="text-[9px] leading-none">
            {islandCollapsed ? "▸" : "◂"}
          </span>
          {islandCollapsed ? "Show island" : "Hide island"}
        </button>

        <div className="hidden items-center gap-5 text-xs font-semibold text-stone-500 lg:flex">
          <span className="text-stone-200">Item database</span>
          <span>
            {stats.itemCount} items · {stats.mappedAreaCount} areas
          </span>
        </div>
      </div>
    </header>
  );
}
