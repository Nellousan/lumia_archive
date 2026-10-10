"use client";

export interface BookmarkGlyphProps {
  filled: boolean;
  className?: string;
}

/**
 * The bookmark ribbon, drawn the same wherever it appears.
 *
 * The classic shape — square shoulders at the top, a V cut into the bottom — so it
 * reads as "keep this" rather than as a rating. `filled` carries the state: hollow
 * when the item is not in the plan, solid when it is.
 */
export function BookmarkGlyph({ filled, className = "size-4" }: BookmarkGlyphProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M8 3h8a3 3 0 0 1 3 3v15l-7-4-7 4V6a3 3 0 0 1 3-3z" />
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
   * corner control on a catalog card, hidden until the card is hovered or focused.
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
        // On a catalog card the control sits over the card's own click target.
        event.stopPropagation();
        onToggle();
      }}
      aria-pressed={bookmarked}
      aria-label={`${action}: ${itemName}`}
      title={`${action} — ${itemName}`}
      className={shape}
    >
      {/* A ribbon is narrower than the star it replaces, so it is drawn a notch
          larger to keep the same weight in the button. */}
      <BookmarkGlyph filled={bookmarked} className={variant === "overlay" ? "size-3.5" : "size-4"} />
    </button>
  );
}
