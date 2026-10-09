"use client";

export interface AnimalDropToggleProps {
  /** True when the island is also showing what wild animals can drop. */
  active: boolean;
  onToggle: () => void;
}

/**
 * Switches the animal drops on the island on and off.
 *
 * Off to begin with: the island's default answer to "where do I get this" is the
 * sourcing the plan can count on, and a drop is a maybe. The button wears the
 * same ◎ the cards wear, so what it turns on is legible before it is pressed.
 *
 * Shaped like the "Recipe only" filter in an area's slide-over — same box, same
 * type — because it is the same kind of control: a switch on what the island is
 * showing. It keeps a dark base of its own, though, since it floats over the
 * artwork rather than sitting on a panel.
 */
export function AnimalDropToggle({ active, onToggle }: AnimalDropToggleProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      title={
        active
          ? "Hide what wild animals can drop — drops are never part of a route"
          : "Show what wild animals can drop. Not guaranteed, and never part of a route"
      }
      className={`pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition ${
        active
          ? "border-red-400/40 bg-red-500/15 text-red-200 hover:border-red-300/70 hover:bg-red-500/25"
          : "border-white/10 bg-ink-950/75 text-stone-500 hover:border-red-400/40 hover:text-red-200"
      }`}
    >
      <span
        aria-hidden="true"
        className={`text-[12px] leading-none ${active ? "text-red-300" : "text-red-400/70"}`}
      >
        ◎
      </span>
      Animal drops
    </button>
  );
}
