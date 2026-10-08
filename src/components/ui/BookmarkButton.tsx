"use client";

export interface StarGlyphProps {
  filled: boolean;
  className?: string;
}

/** The bookmark star, drawn the same wherever it appears. */
export function StarGlyph({ filled, className = "size-3.5" }: StarGlyphProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
    >
      <path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" />
    </svg>
  );
}

export interface BookmarkButtonProps {
  /** Name of the item, used for the accessible label and the tooltip. */
  itemName: string;
  bookmarked: boolean;
  onToggle: () => void;
  /**
   * `panel` is a full-size button for the detail header; `overlay` is the small
   * corner star on a catalog card, hidden until the card is hovered or focused.
   */
  variant?: "panel" | "overlay";
}

/**
 * The one bookmark control: pressed means "keep this item in the plan", which
 * puts its materials on the island and its requirements into the routes.
 */
export function BookmarkButton({
  itemName,
  bookmarked,
  onToggle,
  variant = "panel",
}: BookmarkButtonProps) {
  const action = bookmarked ? "Remove from the plan" : "Keep in the plan";

  const shape =
    variant === "overlay"
      ? `absolute right-1 top-1 z-10 grid size-6 place-items-center rounded-md border backdrop-blur-sm transition focus-visible:opacity-100 group-hover:opacity-100 ${
          bookmarked
            ? "border-amber-300/60 bg-ink-950/85 text-amber-200 opacity-100"
            : "border-white/15 bg-ink-950/70 text-stone-400 opacity-0 hover:border-amber-300/60 hover:text-amber-200"
        }`
      : `grid size-7 shrink-0 place-items-center rounded-lg border transition ${
          bookmarked
            ? "border-amber-300/60 bg-amber-300/15 text-amber-200 hover:bg-amber-300/25"
            : "border-white/10 bg-white/[0.03] text-stone-400 hover:border-amber-300/50 hover:text-amber-200"
        }`;

  return (
    <button
      type="button"
      onClick={(event) => {
        // On a catalog card the star sits over the card's own click target.
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={bookmarked}
      aria-label={`${action}: ${itemName}`}
      title={`${action} — ${itemName}`}
      className={shape}
    >
      <StarGlyph filled={bookmarked} className={variant === "overlay" ? "size-3" : "size-3.5"} />
    </button>
  );
}
