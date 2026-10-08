export interface ItemFact {
  label: string;
  value: string;
  /** Optional explanation shown on hover. */
  hint?: string;
}

/**
 * The fields `data.json` actually provides — nothing invented.
 * Value and quantity are `null`-able in the source, hence the placeholder.
 */
export function ItemFactsGrid({ facts }: { facts: ItemFact[] }) {
  return (
    <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.06] sm:grid-cols-3">
      {facts.map((fact) => (
        <div key={fact.label} className="bg-ink-900/80 px-3 py-2.5">
          <dt
            title={fact.hint}
            className="text-[9px] font-bold uppercase tracking-[0.16em] text-stone-600"
          >
            {fact.label}
          </dt>
          <dd className="mt-1 truncate font-display text-lg font-semibold leading-none text-stone-200">
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
