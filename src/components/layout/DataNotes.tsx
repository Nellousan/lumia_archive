export interface DataNotesProps {
  /** Data-quality warnings collected while normalizing `data.json`. */
  warnings: string[];
}

/**
 * Collapsible list of everything the loader had to work around: missing
 * sprites, duplicated loot slots, areas with no loot. Surfacing these beats
 * logging them into a console nobody reads.
 */
export function DataNotes({ warnings }: DataNotesProps) {
  if (warnings.length === 0) return null;

  return (
    <details className="border-t border-white/[0.06] bg-black/25 px-4 py-2 sm:px-8">
      <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/70 transition hover:text-amber-200">
        {warnings.length} data note{warnings.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
        {warnings.map((warning) => (
          <li key={warning} className="font-mono text-[10px] leading-relaxed text-stone-500">
            • {warning}
          </li>
        ))}
      </ul>
    </details>
  );
}
