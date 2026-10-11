"use client";

export interface RouteLockToggleProps {
  /** True while the trace is held down and the island answers like a route. */
  locked: boolean;
  onToggle: () => void;
}

/**
 * Holds a hand-drawn route down.
 *
 * Unlocked, the island is a drawing board: clicks add stops, every bubble gets out
 * of the way of the pointer, and the areas are the question. Locked, the walk is
 * finished enough to read, and the island goes back to answering like a computed
 * route does — areas open, item cards take the pointer, and hovering one says where
 * else the material is.
 *
 * Same shape and base as {@link AnimalDropToggle}: the island's own chrome floats
 * over the artwork, so it carries its own dark backing.
 */
export function RouteLockToggle({ locked, onToggle }: RouteLockToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={locked}
      title={locked ? "Unlock the route to edit it" : "Lock the route to browse areas and materials"}
      className={`pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition ${
        locked
          ? "border-amber-300/45 bg-amber-500/15 text-amber-200 hover:border-amber-200/70 hover:bg-amber-500/25"
          : "border-white/10 bg-ink-950/75 text-stone-500 hover:border-amber-300/45 hover:text-amber-200"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`size-3 ${locked ? "text-amber-300" : "text-amber-400/70"}`}
      >
        <rect x="4.5" y="11" width="15" height="9.5" rx="2" />
        {locked ? (
          <path d="M8.5 11V7.5a3.5 3.5 0 0 1 7 0V11" />
        ) : (
          <path d="M8.5 11V7.5a3.5 3.5 0 0 1 6.8-1.2" />
        )}
      </svg>
      {locked ? "Unlock route" : "Lock route"}
    </button>
  );
}
