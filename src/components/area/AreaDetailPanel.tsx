"use client";

import { useMemo, useState } from "react";
import { AnimalCard } from "@/components/animal/AnimalCard";
import { ItemCard } from "@/components/ui/ItemCard";
import { groupByCategoryTab } from "@/lib/wiki/catalog";
import type { AreaItemRef, WikiAnimal, WikiArea } from "@/lib/wiki/types";

export interface AreaDetailPanelProps {
  area: WikiArea;
  /** The wild animals that spawn here; usually one, and never part of a plan. */
  animals: WikiAnimal[];
  /** Every item the area spawns, with quantities. */
  items: AreaItemRef[];
  activeItemId: string | null;
  /** Items belonging to the recipe currently mapped, highlighted in the list. */
  relevantItemIds: string[];
  onSelectItem: (itemId: string) => void;
  onClose: () => void;
}

/**
 * Slide-over listing everything that spawns in the clicked area — the "what is
 * actually here" counterpart to the recipe-driven map bubbles.
 *
 * It covers the whole pane where there is no room to spare (a phone, where a
 * three-quarter panel would leave a useless sliver of map) and three quarters of
 * it on the wider two-column layouts.
 *
 * Items use the same card as the rail, with the quantity found in this area
 * standing in for the rarity/type/value line. They are grouped under the named
 * top-level categories — most actionable first, Weapon → Gear → Food → Normal —
 * and sorted inside each group by the catalog rule.
 *
 * Above them sits the area's wild animal: the one thing on this panel that is not
 * a resource. Its loot is shown, but nothing in the app plans around it.
 */
export function AreaDetailPanel({
  area,
  animals,
  items,
  activeItemId,
  relevantItemIds,
  onSelectItem,
  onClose,
}: AreaDetailPanelProps) {
  const [onlyRelevant, setOnlyRelevant] = useState(false);
  const relevantSet = useMemo(() => new Set(relevantItemIds), [relevantItemIds]);

  const visible = useMemo(
    () => (onlyRelevant ? items.filter((entry) => relevantSet.has(entry.item.id)) : items),
    [items, onlyRelevant, relevantSet],
  );

  const buckets = useMemo(
    () => groupByCategoryTab(visible.map((entry) => entry.item)),
    [visible],
  );
  const quantityByItemId = useMemo(
    () => new Map(items.map((entry) => [entry.item.id, entry.quantity])),
    [items],
  );

  return (
    <aside
      aria-label={`${area.name} area details`}
      className="absolute inset-y-0 right-0 z-40 flex w-full flex-col border-l border-white/10 bg-ink-900/95 shadow-[-20px_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl lg:w-3/4 lg:min-w-[320px] lg:max-w-[900px]"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] p-4">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400">
            Area
          </div>
          <h2 className="mt-1 font-display text-2xl font-semibold leading-none text-white">
            {area.name}
          </h2>
          <p className="mt-1.5 font-mono text-[11px] text-stone-500">
            {area.empty ? "no loot recorded" : `${area.spawns.length} item stacks`}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close area details"
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-xs text-stone-400 transition hover:border-white/25 hover:text-stone-100"
        >
          ✕
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-2.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-stone-500">
          {visible.length} shown
        </span>
        {relevantSet.size > 0 && (
          <button
            type="button"
            onClick={() => setOnlyRelevant((value) => !value)}
            aria-pressed={onlyRelevant}
            className={`rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider transition ${
              onlyRelevant
                ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
                : "border-white/10 bg-white/[0.03] text-stone-500 hover:text-stone-200"
            }`}
          >
            Recipe only
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="space-y-5">
          {/* Above the loot, and outside the empty-state branch below: an area
              with no recorded items still has whatever lives there, and the one
              area that is both — the Research Center, home to Mr. Meiji — is the
              case where the animal matters most. */}
          {animals.length > 0 && (
            <section>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-red-300">
                  Wild animal
                </h3>
                <span className="h-px flex-1 bg-white/[0.08]" />
                <span className="font-mono text-[10px] text-stone-600">{animals.length}</span>
              </div>

              <div className="space-y-2">
                {animals.map((animal) => (
                  <AnimalCard key={animal.id} animal={animal} onSelectItem={onSelectItem} />
                ))}
              </div>
            </section>
          )}

          {buckets.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-xs leading-relaxed text-stone-500">
              {area.empty
                ? "data.json records no loot for this area yet."
                : "Nothing here belongs to the current recipe."}
            </p>
          ) : (
            buckets.map((bucket) => (
              <section key={bucket.id}>
                <div className="mb-2 flex items-center gap-2">
                  <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
                    {bucket.label}
                  </h3>
                  <span className="h-px flex-1 bg-white/[0.08]" />
                  <span className="font-mono text-[10px] text-stone-600">{bucket.items.length}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 min-[560px]:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                  {bucket.items.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      selected={item.id === activeItemId}
                      onSelect={onSelectItem}
                      footnote={
                        // The card's own numbers — value and craft yield — are
                        // left off here on purpose: the only quantity that means
                        // anything in this panel is what lies in *this* area, and
                        // a second figure beside it only competes with it.
                        <span className="font-mono text-[13px] font-bold leading-none text-emerald-300">
                          ×{quantityByItemId.get(item.id) ?? 0}
                        </span>
                      }
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </aside>
  );
}
