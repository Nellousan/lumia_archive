"use client";

import { useEffect, useRef } from "react";

export interface HotkeyHandlers {
  /** Called for `/` when the user is not already typing. */
  onSearchShortcut: () => void;
  /** Called for Escape. */
  onEscape: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

/** Global keyboard shortcuts: `/` focuses search, Escape unwinds overlays. */
export function useHotkeys({ onSearchShortcut, onEscape }: HotkeyHandlers) {
  // Latest handlers kept in refs so the listener binds exactly once.
  const searchShortcutRef = useRef(onSearchShortcut);
  const escapeRef = useRef(onEscape);

  useEffect(() => {
    searchShortcutRef.current = onSearchShortcut;
    escapeRef.current = onEscape;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        searchShortcutRef.current();
        return;
      }

      if (event.key === "Escape") {
        escapeRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
