"use client";

import { useState, type CSSProperties } from "react";
import type { SpriteTrim, WikiItem } from "@/lib/wiki/types";

/**
 * Item artwork.
 *
 * Source sprites are 2:1 canvases (256×128 for almost all of them) with the
 * artwork floating in a large transparent margin — a median 41% of the canvas is
 * dead space. Two ways of showing them:
 *
 *  - the fixed frames (`xs`…`hero`, `fill`) keep the whole canvas and use
 *    `object-contain`, so nothing is cropped;
 *  - the `tile` size crops to the visible pixels using `item.spriteTrim`, which
 *    lets a square tile show a much larger item.
 *
 * A missing sprite falls back to a monogram, and a sprite with no measured trim
 * falls back to `object-contain` inside the same square, so no combination
 * produces a broken image.
 */

export type SpriteSize = "xs" | "sm" | "md" | "lg" | "xl" | "hero" | "fill" | "tile";

const FRAME: Record<SpriteSize, string> = {
  xs: "h-5 w-10 rounded",
  sm: "h-6 w-12 rounded-md",
  md: "h-8 w-16 rounded-lg",
  lg: "h-12 w-24 rounded-xl",
  xl: "h-16 w-32 rounded-xl",
  hero: "h-20 w-40 rounded-2xl",
  /** Fills the parent width while keeping the 2:1 canvas ratio. */
  fill: "w-full aspect-[2/1] rounded-lg",
  /** Square, cropped to the visible pixels. Requires a square container. */
  tile: "w-full aspect-square rounded-lg",
};

const GLYPH: Record<SpriteSize, string> = {
  xs: "text-[9px]",
  sm: "text-[10px]",
  md: "text-xs",
  lg: "text-sm",
  xl: "text-base",
  hero: "text-2xl",
  fill: "text-sm",
  tile: "text-base",
};

function monogram(name: string): string {
  const words = name.split(/[\s''-]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

/**
 * Places the trimmed region of a sprite so it fills and centres in a square box.
 *
 * Everything is a percentage of the container, which works because the container
 * is square: scaling the image by `max(width, height)` makes the longer side of
 * the visible box exactly touch the container, and the offsets put the box's
 * centre on the container's centre.
 */
function trimmedImageStyle(trim: SpriteTrim): CSSProperties {
  const span = Math.max(trim.width, trim.height);
  return {
    position: "absolute",
    width: `${(trim.sourceWidth / span) * 100}%`,
    height: `${(trim.sourceHeight / span) * 100}%`,
    left: `${50 - ((trim.x + trim.width / 2) / span) * 100}%`,
    top: `${50 - ((trim.y + trim.height / 2) / span) * 100}%`,
    // Tailwind's preflight caps images at max-width:100%, which would fight the
    // explicit size above.
    maxWidth: "none",
  };
}

export interface ItemSpriteProps {
  item: WikiItem;
  size?: SpriteSize;
  /**
   * Drops the framed background so the artwork sits directly on its parent.
   * The size classes always apply — `bare` only removes the chrome, it does not
   * free the image to render at its intrinsic size.
   */
  bare?: boolean;
  className?: string;
}

export function ItemSprite({ item, size = "md", bare = false, className = "" }: ItemSpriteProps) {
  const [failed, setFailed] = useState(false);
  const chrome = bare ? "" : "border border-white/10 bg-black/25";

  if (item.sprite && !failed) {
    const frame = `shrink-0 place-items-center ${FRAME[size]} ${chrome} ${className}`;

    // Square + measured trim: crop to the artwork and scale it up.
    if (size === "tile" && item.spriteTrim) {
      return (
        <span className={`relative block overflow-hidden ${frame}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static sprite; the
              overlay must align with the exact rendered box, so no optimiser transform. */}
          <img
            src={item.sprite}
            alt=""
            width={item.spriteTrim.sourceWidth}
            height={item.spriteTrim.sourceHeight}
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setFailed(true)}
            style={trimmedImageStyle(item.spriteTrim)}
          />
        </span>
      );
    }

    return (
      <span className={`inline-grid ${frame}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- static sprite served
            from /public: the frame is a fixed box so there is no layout shift, and
            next/image would add an optimiser round-trip for no benefit at these sizes. */}
        <img
          src={item.sprite}
          alt=""
          width={item.spriteTrim?.sourceWidth ?? 256}
          height={item.spriteTrim?.sourceHeight ?? 128}
          loading="lazy"
          decoding="async"
          draggable={false}
          onError={() => setFailed(true)}
          className="h-full w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      title={`No sprite available for ${item.name}`}
      className={`grid shrink-0 place-items-center border border-dashed border-white/15 bg-white/[0.03] font-display font-bold tracking-widest text-stone-500 ${FRAME[size]} ${GLYPH[size]} ${className}`}
    >
      {monogram(item.name)}
    </span>
  );
}
