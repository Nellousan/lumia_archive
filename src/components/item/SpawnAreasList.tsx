"use client";

import type { AreaSpawnRef } from "@/lib/wiki/types";

export interface SpawnAreasListProps {
  refs: AreaSpawnRef[];
  onSelectArea: (areaId: string) => void;
}

/** Every area that contains the active item, with the quantity found there. */
export function SpawnAreasList({ refs, onSelectArea }: SpawnAreasListProps) {
  if (refs.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
        Not found anywhere on Lumia Island — this item only exists as the result of a craft.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5">
      {refs.map((ref) => (
        <li key={ref.areaId}>
          <button
            type="button"
            onClick={() => onSelectArea(ref.areaId)}
            className="flex w-full items-center gap-3 rounded-lg border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-left transition hover:border-emerald-400/30 hover:bg-white/[0.05]"
          >
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-stone-300">
              {ref.areaName}
            </span>
            <span className="shrink-0 font-mono text-[11px] text-stone-500">×{ref.quantity}</span>
            <span aria-hidden="true" className="shrink-0 text-stone-600">
              →
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
