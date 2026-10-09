"use client";

import { AnimalPortrait } from "@/components/animal/AnimalPortrait";
import { ItemSprite } from "@/components/ui/ItemSprite";
import type { WikiAnimal, WikiItem } from "@/lib/wiki/types";

/**
 * Seconds into a match, written the way the in-game clock reads them.
 *
 * The dataset stores spawn timers as seconds (180, 110), which is precise but
 * unreadable; nobody counts in hundreds of seconds mid-match.
 */
function clock(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * One of the three combat numbers, in the game's own shorthand: a dagger, a
 * shield and a cross for attack, defense and health.
 *
 * The glyph is decoration — the tooltip and the screen reader both get the word —
 * and the colour is doing the work of separating the three at a glance. A number
 * the data does not have is left out rather than shown as a zero.
 */
function Stat({
  glyph,
  label,
  value,
  tone,
}: {
  glyph: string;
  label: string;
  value: number | null;
  tone: string;
}) {
  if (value === null) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[13px] font-bold leading-none ${tone}`}
      title={`${label} ${value}`}
    >
      <span aria-hidden className="text-[12px] leading-none">
        {glyph}
      </span>
      <span className="sr-only">{label}</span>
      {value}
    </span>
  );
}

/** A labelled number under the name: when it turns up, and how often again. */
function Fact({ label, value, title }: { label: string; value: string; title: string }) {
  return (
    <span className="flex flex-col gap-0.5" title={title}>
      <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-500">
        {label}
      </span>
      <span className="font-mono text-[13px] leading-none text-stone-300">{value}</span>
    </span>
  );
}

/**
 * One thing an animal leaves behind, as the item it is.
 *
 * A chip rather than a bare sprite because the names here are the point — "Fat"
 * and "Leather" are easy to confuse at 24px — and because clicking one opens the
 * item, the same as every other item surface in the app.
 */
function DropChip({ item, onSelect }: { item: WikiItem; onSelect: (itemId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      title={`${item.name} — dropped by this animal`}
      className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.03] py-[2px] pl-[2px] pr-2 text-[10px] font-medium text-stone-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-stone-100"
    >
      <span className="block size-6 shrink-0 overflow-hidden rounded-md">
        <ItemSprite item={item} size="tile" bare />
      </span>
      <span className="truncate">{item.name}</span>
    </button>
  );
}

export interface AnimalCardProps {
  animal: WikiAnimal;
  onSelectItem: (itemId: string) => void;
}

/**
 * The wild animal of an area, on the area panel.
 *
 * It answers the question the item list cannot: what is going to be hunting *me*
 * here. Stats, spawn timing and loot come straight from `data.json`; the artwork
 * is the animal's portrait, cropped to a rectangle around the head (see
 * {@link AnimalPortrait}).
 *
 * Deliberately about the height of an item card: the artwork is pinned to 104px
 * and the details wrap into whatever width is left, so the card keeps the same
 * rhythm as the grid underneath instead of towering over it. Everything outside
 * the artwork can wrap; nothing is ever clipped.
 *
 * The loot is deliberately not part of the plan: killing an animal is optional,
 * so a route never budgets for it. The chips are there to read, and to open the
 * item, not to promise supply.
 */
export function AnimalCard({ animal, onSelectItem }: AnimalCardProps) {
  const { firstSpawnTime, respawnTime } = animal;

  return (
    <article className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-2">
      <AnimalPortrait animal={animal} className="aspect-[3/2] h-[80px] sm:h-[104px]" />

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h4 className="min-w-0 truncate font-display text-base font-semibold leading-none text-stone-100">
            {animal.name}
          </h4>

          <span className="flex items-center gap-3">
            <Stat glyph="🗡" label="Attack" value={animal.atk} tone="text-rose-300" />
            <Stat glyph="🛡" label="Defense" value={animal.def} tone="text-sky-300" />
            <Stat glyph="✚" label="Health" value={animal.hp} tone="text-emerald-300" />
          </span>

          <span className="flex items-start gap-4">
            {firstSpawnTime !== null && (
              <Fact
                label="First spawn"
                value={clock(firstSpawnTime)}
                title={`First appears ${clock(firstSpawnTime)} into the match`}
              />
            )}

            <Fact
              label="Respawn"
              value={respawnTime !== null ? clock(respawnTime) : "once a match"}
              title={
                respawnTime !== null
                  ? `Kill it and it is back ${clock(respawnTime)} later`
                  : "Spawns once per match — killing it removes it for good"
              }
            />
          </span>
        </div>

        {animal.loot.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-red-300/80">
              Drops
            </span>
            {animal.loot.map((item) => (
              <DropChip key={item.id} item={item} onSelect={onSelectItem} />
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
