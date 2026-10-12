/**
 * The app's one loading affordance: a ring that turns while something is being
 * computed off the main thread.
 *
 * It is deliberately small and quiet. The route section is the only place that has
 * to wait for anything visible — the island, the bubbles and a traced walk are all
 * derived on the spot — so this says "the walk is being worked out" without taking
 * the section over: the settings stay usable while it turns.
 */
export function Spinner({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg
      role="status"
      aria-label="Solving"
      viewBox="0 0 24 24"
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
