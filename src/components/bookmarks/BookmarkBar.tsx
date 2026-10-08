"use client";

import { ItemSprite } from "@/components/ui/ItemSprite";
import { StarGlyph } from "@/components/ui/BookmarkButton";
import type { WikiItem } from "@/lib/wiki/types";

export interface BookmarkEntry {
  item: WikiItem;
  /** True for the item open in the rail — clicking it deselects instead. */
  selected: boolean;
  /** True when the item is also pinned in the bookmarks. */
  bookmarked: boolean;
}

export interface BookmarkBarProps {
  /** The planning set: the selected item first, then the bookmarks in order. */
  entries: BookmarkEntry[];
  /** Selected entries are deselected; bookmarked ones are removed. */
  onEntryClick: (itemId: string) => void;
  onClearBookmarks: () => void;
}

function StarIcon({ filled }: { filled: boolean }) {
  return <StarGlyph filled={filled} />;
}

/**
 * The planning set, sitting directly above the island.
 *
 * Everything listed here drives the map and the routes: the island shows the raw
 * materials of every entry, and the route list covers them all. The selected item
 * appears alongside the bookmarks so it is never a mystery which requirements the
 * paths are computed from — clicking a bookmark drops it, clicking the selected
 * item closes it.
 */
export function BookmarkBar({ entries, onEntryClick, onClearBookmarks }: BookmarkBarProps) {
  const bookmarks = entries.filter((entry) => entry.bookmarked).length;

  return (
    <div className="relative z-10 flex items-center gap-3 border-b border-white/[0.06] px-4 py-2 sm:px-6">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">
        Plan
      </span>

      {entries.length === 0 ? (
        <p className="min-w-0 flex-1 truncate text-[11px] text-stone-500">
          Star an item to keep it here — the island and the routes then cover everything in the plan.
        </p>
      ) : (
        <>
          <ul className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
            {entries.map((entry) => (
              <li key={entry.item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => onEntryClick(entry.item.id)}
                  title={
                    entry.selected
                      ? `${entry.item.name} — selected; click to deselect`
                      : `${entry.item.name} — bookmarked; click to remove`
                  }
                  className={`flex items-center gap-1.5 rounded-lg border py-1 pl-1 pr-2 transition ${
                    entry.selected
                      ? "border-amber-300/60 bg-amber-300/[0.10]"
                      : "border-white/10 bg-white/[0.03] hover:border-rose-300/40 hover:bg-rose-300/[0.06]"
                  }`}
                >
                  <span className="size-5 shrink-0">
                    <ItemSprite item={entry.item} size="tile" bare />
                  </span>
                  <span
                    className={`max-w-[130px] truncate text-[11px] font-semibold ${
                      entry.selected ? "text-amber-100" : "text-stone-300"
                    }`}
                  >
                    {entry.item.name}
                  </span>
                  {entry.bookmarked && (
                    <span className={entry.selected ? "text-amber-300" : "text-stone-500"}>
                      <StarIcon filled />
                    </span>
                  )}
                  {entry.selected && (
                    <span className="shrink-0 font-mono text-[9px] uppercase tracking-wider text-amber-300/70">
                      sel
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>

          {bookmarks > 0 && (
            <button
              type="button"
              onClick={onClearBookmarks}
              className="shrink-0 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-stone-500 transition hover:border-white/20 hover:text-stone-200"
            >
              Clear
            </button>
          )}
        </>
      )}
    </div>
  );
}
