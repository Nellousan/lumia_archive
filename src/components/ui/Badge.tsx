import type { ReactNode } from "react";

export interface BadgeProps {
  children: ReactNode;
  className?: string;
  title?: string;
}

/** Small uppercase pill used for rarity, types and metadata. */
export function Badge({ children, className = "", title }: BadgeProps) {
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-bold uppercase tracking-widest ${className}`}
    >
      {children}
    </span>
  );
}
