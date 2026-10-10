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
  /**
   * What a click does. Omit it and the frame is a plain labelled box instead of a
   * button: no click, no tab stop — see the note below.
   */
  onSelect?: () => void;
  /** Focuses the item while the pointer is on the frame. */
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
 * A frame that knows what a click means is a `<button>`; one that does not is a
 * plain labelled box. That difference is the whole reason `onSelect` is optional:
 * the random-spawn box opens the item it draws, while the material cards in an
 * area bubble do nothing on click — their one job is to be hovered, which lights
 * up every other area holding the same material. Opening a raw material was an
 * action nobody wanted, and testing showed it read as a trap: readers clicked a
 * card to see where else the material was and lost the map they were reading. The
 * non-clickable frame is also not a tab stop, which is the honest state of a card
 * with nothing to activate.
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
  const box = `flex shrink-0 flex-col items-center rounded-[13px] inset-ring-1 transition ${tone} ${className}`;
  const content = (
    <>
      <ItemSprite item={item} size="tile" bare />
      {footnote}
    </>
  );

  if (!onSelect) {
    return (
      <span
        role="img"
        title={label}
        aria-label={label}
        style={style}
        onMouseEnter={onHover ? () => onHover(item.id) : undefined}
        onMouseLeave={onHover ? () => onHover(null) : undefined}
        className={box}
      >
        {content}
      </span>
    );
  }

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
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      className={box}
    >
      {content}
    </button>
  );
}
