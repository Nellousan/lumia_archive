"use client";

import { ItemFrame } from "@/components/ui/ItemFrame";
import type { WikiAnimal, WikiItem } from "@/lib/wiki/types";

export interface RandomSpawnBoxProps {
  /** The items with no fixed home on the island; see `RANDOM_SPAWN_ITEM_IDS`. */
  items: WikiItem[];
  /**
   * item id -> the animals that can drop it. Several of these items do have a
   * source, and saying so is the difference between "found at random" and
   * "found on Wickeline".
   */
  dropAnimalsByItemId: Record<string, WikiAnimal[]>;
  /** Ids the current plan needs — those are the ones worth looking at. */
  neededItemIds: string[];
  onSelectItem: (itemId: string) => void;
  onHoverItem: (itemId: string | null) => void;
}

/**
 * Where a road-less item comes from, in the fewest words that are true.
 *
 * Only an animal with no area at all is worth naming, and for one reason: it
 * says the item really does turn up wherever the match puts it, which is exactly
 * what this box is for. An animal with a home area is a different promise — the
 * Vital Sign Sensor does drop off Mr. Meiji, but he is in the Research Center,
 * which opens only for the alternative victory condition. Nobody goes there to
 * pick one up, and naming him would send a reader somewhere they are not going.
 */
function sourceOf(item: WikiItem, animals: WikiAnimal[]): string {
  const loose = animals.filter((animal) => animal.areas.length === 0);
  if (loose.length === 0) return "found at random, no fixed area";

  return `found on ${loose.map((animal) => animal.name).join(" and ")}, no fixed area`;
}

/**
 * The items that turn up wherever the match puts them.
 *
 * They have no area, so no bubble can be drawn for them and no route can plan
 * around them — the solver assumes they are already in the pack. That leaves a
 * hole in the map's answer exactly where a plan needs one, and this box is what
 * fills it: the six of them are always listed, dimmed, and the ones the current
 * plan actually needs light up in amber, the same colour the rest of the app uses
 * for "this is part of your plan".
 *
 * The cards are the map's cards, minus the line underneath: there is no quantity
 * to report. The tooltip carries what the card cannot, including the name of an
 * animal that drops it.
 */
export function RandomSpawnBox({
  items,
  dropAnimalsByItemId,
  neededItemIds,
  onSelectItem,
  onHoverItem,
}: RandomSpawnBoxProps) {
  if (items.length === 0) return null;

  const needed = new Set(neededItemIds);
  const neededCount = items.filter((item) => needed.has(item.id)).length;

  return (
    <div className="pointer-events-auto w-[158px] rounded-xl border border-white/10 bg-ink-950/80 p-2.5 shadow-[0_18px_36px_rgba(0,0,0,0.45)] backdrop-blur-md">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-stone-500">
          Random spawns
        </span>
        {neededCount > 0 && (
          <span
            className="ml-auto font-mono text-[10px] text-amber-300"
            title={`${neededCount} of these ${neededCount === 1 ? "is" : "are"} in the current plan`}
          >
            {neededCount}/{items.length}
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 justify-items-center gap-2">
        {items.map((item) => {
          const isNeeded = needed.has(item.id);
          const source = sourceOf(item, dropAnimalsByItemId[item.id] ?? []);
          return (
            <ItemFrame
              key={item.id}
              item={item}
              tone={
                isNeeded
                  ? "inset-ring-amber-300/60 bg-amber-300/[0.14]"
                  : "inset-ring-white/[0.08] bg-black/30"
              }
              className={`w-10 p-[3px] ${isNeeded ? "" : "opacity-55 hover:opacity-90"}`}
              label={
                isNeeded ? `${item.name} — ${source}, and the plan needs it` : `${item.name} — ${source}`
              }
              onHover={onHoverItem}
              onSelect={() => onSelectItem(item.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
