"use client";

export interface ClearSelectionButtonProps {
  label: string;
  disabled?: boolean;
  onClear: () => void;
}

/**
 * Deselects the active item so the island map drops every bubble.
 *
 * Used in two places — the item detail panel and the map header (where the legend
 * used to sit) — with a label suited to each context.
 */
export function ClearSelectionButton({
  label,
  disabled = false,
  onClear,
}: ClearSelectionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClear}
      disabled={disabled}
      title="Deselect the item and empty the island map"
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
        disabled
          ? "cursor-not-allowed border-white/[0.06] bg-white/[0.02] text-stone-600"
          : "border-white/15 bg-white/[0.04] text-stone-300 hover:border-amber-300/50 hover:bg-amber-300/10 hover:text-amber-200"
      }`}
    >
      <svg
        aria-hidden="true"
        className="size-3"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
      {label}
    </button>
  );
}
