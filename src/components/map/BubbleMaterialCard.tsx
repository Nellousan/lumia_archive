"use client";

import { ItemSprite } from "@/components/ui/ItemSprite";
import { BUBBLE_CARD_WIDTH } from "@/lib/map-layout";
import type { RecipeMaterial } from "@/lib/wiki/types";

export interface BubbleMaterialCardProps {
  material: RecipeMaterial;
  /** How many of this material the area holds. */
  quantityInArea: number;
  focused: boolean;
  /** In the focused material's recipe subtree, but not the focused material. */
  related: boolean;
  onHover: (itemId: string | null) => void;
  onSelect: (itemId: string) => void;
}

/**
 * The item card inside a map bubble: a square of trimmed artwork with the
 * quantity underneath, and nothing else.
 *
 * The bubble header already names the area, the artwork carries the identity and
 * `title`/`aria-label` spell out the item name — so the card stays square and the
 * sprite gets the full width instead of sharing it with a label. The card width
 * lives in `lib/map-layout.ts` so the bubble placement estimates stay in sync.
 */
export function BubbleMaterialCard({
  material,
  quantityInArea,
  focused,
  related,
  onHover,
  onSelect,
}: BubbleMaterialCardProps) {
  const label = `${material.item.name}, ${quantityInArea} in this area`;

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onMouseEnter={() => onHover(material.item.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(material.item.id)}
      onBlur={() => onHover(null)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect(material.item.id);
      }}
      style={{ width: BUBBLE_CARD_WIDTH }}
      className={`flex shrink-0 flex-col items-center gap-px rounded-lg border px-0.5 pb-0.5 pt-1 transition ${
        focused
          ? "border-amber-300/60 bg-amber-300/15"
          : related
            ? "border-amber-300/25 bg-black/35"
            : "border-white/[0.08] bg-black/30 hover:border-emerald-300/40 hover:bg-black/45"
      }`}
    >
      <ItemSprite item={material.item} size="tile" bare />
      <span className="font-mono text-[14px] font-bold leading-none text-emerald-300">
        ×{quantityInArea}
      </span>
    </button>
  );
}
