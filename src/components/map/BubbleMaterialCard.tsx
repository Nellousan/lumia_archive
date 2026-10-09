"use client";

import { ItemFrame } from "@/components/ui/ItemFrame";
import { BUBBLE_CARD_WIDTH } from "@/lib/map-layout";
import type { RecipeMaterial } from "@/lib/wiki/types";

export interface BubbleMaterialCardProps {
  material: RecipeMaterial;
  /** How many of this material the area holds; unused for an animal drop. */
  quantityInArea: number;
  /** What the card reports: a guaranteed loot slot, or only a wild animal. */
  source: "spawn" | "animal";
  /** Animals that can drop it here; empty when none does. */
  animals: string[];
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
 * and the text sizes live in island pixels, matching `lib/map-layout.ts` so the
 * bubble placement estimates stay in sync.
 *
 * A card that can only be dropped by a wild animal is red and shows `◎` where a
 * spawn shows its quantity — the same trick the route steps use for a build's
 * star. There is no number to give: the drop is not a stack sitting in the area,
 * it is a maybe. A guaranteed spawn that an animal also drops keeps its number
 * and only names the animal, since the pickup itself is not a gamble.
 *
 * The frame is an inset ring rather than a `border`. Below one device pixel —
 * which is what a 1px border becomes once the overlay is scaled to about 0.6 —
 * Firefox resolves a rounded border by drawing its inner edge square, leaving a
 * square corner in the border colour inside each rounded one. It redraws on
 * hover, so it reads as an artefact rather than as a style. An inset ring paints
 * the same hairline without that path. The border's 1px is added to the padding
 * so the box model, and therefore the artwork, does not move.
 */
export function BubbleMaterialCard({
  material,
  quantityInArea,
  source,
  animals,
  focused,
  related,
  onHover,
  onSelect,
}: BubbleMaterialCardProps) {
  const dropped = source === "animal";
  const droppers = animals.join(" or ");
  const label = dropped
    ? `${material.item.name}, dropped by ${droppers} in this area — not a guaranteed spawn`
    : animals.length > 0
      ? `${material.item.name}, ${quantityInArea} in this area — also dropped by ${droppers}`
      : `${material.item.name}, ${quantityInArea} in this area`;

  const tone = dropped
    ? focused
      ? "inset-ring-red-300/70 bg-red-500/20"
      : related
        ? "inset-ring-red-400/30 bg-red-500/[0.10]"
        : "inset-ring-red-400/45 bg-red-500/[0.13] hover:inset-ring-red-300/70 hover:bg-red-500/20"
    : focused
      ? "inset-ring-amber-300/60 bg-amber-300/15"
      : related
        ? "inset-ring-amber-300/25 bg-black/35"
        : "inset-ring-white/[0.08] bg-black/30 hover:inset-ring-emerald-300/40 hover:bg-black/45";

  return (
    <ItemFrame
      item={material.item}
      label={label}
      tone={tone}
      className="gap-[2px] px-[4px] pb-[4px] pt-[7px]"
      style={{ width: BUBBLE_CARD_WIDTH }}
      onHover={onHover}
      onSelect={() => onSelect(material.item.id)}
      footnote={
        dropped ? (
          <span aria-hidden="true" className="text-[21px] leading-none text-red-400">
            ◎
          </span>
        ) : (
          <span className="font-mono text-[23px] font-bold leading-none text-emerald-300">
            ×{quantityInArea}
          </span>
        )
      }
    />
  );
}
