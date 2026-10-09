"use client";

import type { CSSProperties, ReactNode } from "react";
import { ItemSprite } from "@/components/ui/ItemSprite";
import type { WikiItem } from "@/lib/wiki/types";

export interface ItemFrameProps {
  item: WikiItem;
  /**
   * Ring and background classes. The caller owns what the frame is saying:
   * amber when it is part of the plan, red when only an animal supplies it,
   * plain otherwise.
   */
  tone: string;
  /** Box geometry — padding, rounding, gap, size — which differs per context. */
  className?: string;
  style?: CSSProperties;
  /** The line under the artwork: a quantity, a ◎, or nothing at all. */
  footnote?: ReactNode;
  /** Tooltip and accessible name. */
  label: string;
  onSelect?: () => void;
  onHover?: (itemId: string | null) => void;
}

/**
 * The square an item is drawn in on the island: artwork trimmed to fill it, a
 * thin inset ring, and whatever the context has to say underneath.
 *
 * Shared by the bubble cards, which put a quantity or the animal-drop ◎ below the
 * artwork, and by the random-spawn box, which shows the artwork alone — so that
 * box reads as the same object as the map rather than as a second dialect.
 *
 * The ring is an inset shadow rather than a border on purpose; see
 * `BubbleMaterialCard`.
 */
export function ItemFrame({
  item,
  tone,
  className = "",
  style,
  footnote,
  label,
  onSelect,
  onHover,
}: ItemFrameProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      style={style}
      onMouseEnter={onHover ? () => onHover(item.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(item.id) : undefined}
      onBlur={onHover ? () => onHover(null) : undefined}
      onClick={
        onSelect
          ? (event) => {
              event.stopPropagation();
              onSelect();
            }
          : undefined
      }
      className={`flex shrink-0 flex-col items-center rounded-[13px] inset-ring-1 transition ${tone} ${className}`}
    >
      <ItemSprite item={item} size="tile" bare />
      {footnote}
    </button>
  );
}
