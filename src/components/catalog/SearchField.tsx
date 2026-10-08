"use client";

import type { RefObject } from "react";

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Owned by the explorer so the `/` shortcut can focus it from anywhere. */
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SearchField({ value, onChange, inputRef }: SearchFieldProps) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3.5 py-2.5 transition focus-within:border-emerald-400/50 focus-within:bg-white/[0.055]">
      <svg
        aria-hidden="true"
        className="size-4 shrink-0 text-stone-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search items, materials, types…"
        aria-label="Search items"
        autoComplete="off"
        spellCheck={false}
        className="w-full bg-transparent text-sm text-stone-200 outline-none placeholder:text-stone-600"
      />

      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-stone-500 transition hover:text-stone-200"
        >
          clear
        </button>
      ) : (
        <kbd className="shrink-0 rounded border border-white/10 bg-black/20 px-1.5 py-0.5 text-[10px] text-stone-600">
          /
        </kbd>
      )}
    </label>
  );
}
