"use client";

import type { WikiAnimal } from "@/lib/wiki/types";

/**
 * The portrait band of an {@link AnimalCard}.
 *
 * The source portraits are square canvases holding the whole animal, framed so
 * that its eye level sits on the middle row — the one thing the card can rely on
 * without measuring each picture. `object-cover` against a 3:2 box therefore
 * keeps the middle two thirds of the canvas: the head and shoulders stay, and
 * only air above and below is dropped.
 *
 * The crop is not left as a hard edge. Two masks overlap, one per axis, so the
 * artwork dissolves into the card instead of being sliced off: the top and bottom
 * (where the rectangle cuts) fade over a longer run, the sides (where the
 * portrait itself runs off the canvas) over a much shorter one. Nesting them
 * rather than compositing masks keeps this working everywhere.
 *
 * All nine animals have a portrait today; a missing one falls back to the first
 * letter of the name, so a data addition without artwork is still readable.
 */
const TOP_BOTTOM_FADE = "linear-gradient(to bottom, transparent, #000 11%, #000 68%, transparent)";
const SIDE_FADE = "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)";

export interface AnimalPortraitProps {
  animal: WikiAnimal;
  /** Box geometry: the caller decides how much room the artwork gets. */
  className?: string;
}

export function AnimalPortrait({ animal, className = "" }: AnimalPortraitProps) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg ${className}`}
      style={{ maskImage: SIDE_FADE, WebkitMaskImage: SIDE_FADE }}
    >
      {animal.portrait ? (
        // Static portrait from /public in a fixed box: no layout shift to avoid, and
        // next/image would only add an optimiser round-trip for a 240px file.
        // eslint-disable-next-line @next/next/no-img-element -- static file, fixed box
        <img
          src={animal.portrait}
          alt=""
          draggable={false}
          className="block size-full object-cover object-center"
          style={{ maskImage: TOP_BOTTOM_FADE, WebkitMaskImage: TOP_BOTTOM_FADE }}
        />
      ) : (
        <span className="grid size-full place-items-center bg-white/[0.04] font-display text-3xl text-stone-600">
          {animal.name.slice(0, 1).toUpperCase()}
        </span>
      )}
    </div>
  );
}
