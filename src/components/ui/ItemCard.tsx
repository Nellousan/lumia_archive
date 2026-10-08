"use client";

import type { ReactNode } from "react";
import { ItemSprite } from "@/components/ui/ItemSprite";
import { RARITY_META, itemTypeLabel } from "@/lib/wiki/taxonomy";
import type { WikiItem } from "@/lib/wiki/types";

export interface ItemCardProps {
  item: WikiItem;
  /** Open in the detail panel. */
  selected?: boolean;
  /** Highlighted because the pointer is on it (or on its bubble on the map). */
  focused?: boolean;
  onSelect: (itemId: string) => void;
  /** When provided, hovering the card focuses the item on the map. */
  onHover?: (itemId: string | null) => void;
  /**
   * Replaces the rarity/type/value line — the area panel swaps in the quantity
   * found there. Styling is the caller's, so it can match the context.
   */
  footnote?: ReactNode;
  className?: string;
}

/**
 * The one item card used everywhere: catalog rail, recipe tree and area panel.
 *
 * Layout is a small stack — artwork on top, name underneath, then the rarity dot
 * with the type and, when `data.json` has one, the value pushed to the right.
 * The artwork fills the available width so the same card works at the four-column
 * rail width and inside a nested recipe branch.
 */
export function ItemCard({
  item,
  selected = false,
  focused = false,
  onSelect,
  onHover,
  footnote,
  className = "",
}: ItemCardProps) {
  const rarity = RARITY_META[item.rarity];
  const typeLabel = item.types.map(itemTypeLabel).join(" / ") || "Unclassified";

  return (
    <button
      type="button"
      onClick={() => onSelect(item.id)}
      onMouseEnter={onHover ? () => onHover(item.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(item.id) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
      aria-pressed={selected}
      title={`${item.name} — ${typeLabel} (${rarity.label})`}
      className={`flex w-full flex-col gap-1 rounded-xl border p-1.5 text-left transition ${
        focused
          ? "border-amber-300/60 bg-amber-300/[0.12]"
          : selected
            ? "border-amber-300/40 bg-amber-300/[0.09]"
            : "border-white/[0.07] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.05]"
      } ${className}`}
    >
      <ItemSprite item={item} size="fill" bare />

      <span
        className={`truncate text-center text-[12px] font-bold leading-tight ${
          selected || focused ? "text-amber-100" : "text-stone-300"
        }`}
      >
        {item.name}
      </span>

      {footnote !== undefined ? (
        <span className="flex items-center justify-center">{footnote}</span>
      ) : (
        <span className="flex items-center gap-1">
          <span className={`size-1.5 shrink-0 rounded-full ${rarity.dot}`} />
          <span className="min-w-0 flex-1 truncate text-[10px] uppercase tracking-wider text-stone-500">
            {typeLabel}
          </span>
          {item.value !== null && (
            <span className="shrink-0 font-mono text-[11px] font-bold text-amber-300">
              {item.value}
            </span>
          )}
        </span>
      )}
    </button>
  );
}
