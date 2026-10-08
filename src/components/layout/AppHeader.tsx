import type { WikiDataset } from "@/lib/wiki/types";

export interface AppHeaderProps {
  stats: WikiDataset["stats"];
}

/** Fixed application header: identity on the left, dataset stats on the right. */
export function AppHeader({ stats }: AppHeaderProps) {
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

      <div className="hidden items-center gap-5 text-xs font-semibold text-stone-500 lg:flex">
        <span className="text-stone-200">Item database</span>
        <span>
          {stats.itemCount} items · {stats.mappedAreaCount} areas
        </span>
      </div>
    </header>
  );
}
