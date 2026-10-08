/** Horizontal rule with a centred uppercase label, used between detail sections. */
export function PaneDivider({ label }: { label: string }) {
  return (
    <div className="my-5 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/[0.08]" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-600">
        {label}
      </span>
      <div className="h-px flex-1 bg-white/[0.08]" />
    </div>
  );
}
