/**
 * Minimal PNG reader, just enough to find the bounding box of the visible
 * (non-transparent) pixels in an item sprite.
 *
 * Written by hand rather than pulling in a dependency: the sprites are all
 * 8-bit non-interlaced PNGs, and the only thing we need out of them is the alpha
 * channel. Anything outside that envelope throws, and the caller skips trimming
 * for that file — so a future odd PNG degrades to "no trim", never to a wrong
 * crop.
 */
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Samples per pixel, by PNG colour type. */
const CHANNELS_BY_COLOR_TYPE = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decodes a PNG into raw 8-bit samples. Throws on anything unsupported. */
export function decodePng(buffer) {
  if (buffer.length < 8 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("not a PNG");
  }

  let header = null;
  let palette = null;
  let transparency = null;
  const idatChunks = [];

  let pos = 8;
  while (pos + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(pos);
    const type = buffer.toString("ascii", pos + 4, pos + 8);
    const data = buffer.subarray(pos + 8, pos + 8 + length);

    if (type === "IHDR") {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        interlace: data[12],
      };
    } else if (type === "PLTE") {
      palette = Buffer.from(data);
    } else if (type === "tRNS") {
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }

    pos += 12 + length;
  }

  if (!header) throw new Error("missing IHDR");
  const { width, height, bitDepth, colorType, interlace } = header;

  if (interlace !== 0) throw new Error("interlaced PNGs are not supported");
  if (bitDepth !== 8) throw new Error(`bit depth ${bitDepth} is not supported`);

  const channels = CHANNELS_BY_COLOR_TYPE[colorType];
  if (!channels) throw new Error(`colour type ${colorType} is not supported`);

  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const pixels = Buffer.alloc(height * stride);

  let cursor = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor];
    cursor += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let i = 0; i < stride; i += 1) {
      const rawValue = raw[cursor + i];
      const left = i >= channels ? pixels[rowStart + i - channels] : 0;
      const up = y > 0 ? pixels[previousRowStart + i] : 0;
      const upLeft = i >= channels && y > 0 ? pixels[previousRowStart + i - channels] : 0;

      let value;
      switch (filter) {
        case 0:
          value = rawValue;
          break;
        case 1:
          value = rawValue + left;
          break;
        case 2:
          value = rawValue + up;
          break;
        case 3:
          value = rawValue + ((left + up) >> 1);
          break;
        case 4:
          value = rawValue + paethPredictor(left, up, upLeft);
          break;
        default:
          throw new Error(`unknown row filter ${filter}`);
      }

      pixels[rowStart + i] = value & 0xff;
    }

    cursor += stride;
  }

  return { width, height, colorType, channels, pixels, palette, transparency };
}

function alphaAt(decoded, pixelIndex) {
  const { colorType, channels, pixels, transparency } = decoded;

  switch (colorType) {
    case 6: // RGBA
      return pixels[pixelIndex * channels + 3];
    case 4: // grey + alpha
      return pixels[pixelIndex * channels + 1];
    case 3: {
      // Palette: alpha comes from an optional tRNS chunk.
      if (!transparency) return 255;
      const paletteIndex = pixels[pixelIndex];
      return paletteIndex < transparency.length ? transparency[paletteIndex] : 255;
    }
    default:
      // Grey and RGB have no alpha channel: everything is opaque.
      return 255;
  }
}

/**
 * Finds the bounding box of the visible pixels.
 *
 * `threshold` ignores near-invisible pixels so a stray faint pixel cannot blow
 * the box out to the whole canvas; `padding` grows the box back slightly so
 * anti-aliased edges are not clipped by the crop.
 *
 * Returns `null` when the image has no alpha channel to trim against.
 */
export function findVisibleBounds(buffer, options = {}) {
  const threshold = options.threshold ?? 8;
  const padding = options.padding ?? 2;

  const decoded = decodePng(buffer);
  const { width, height, colorType } = decoded;

  if (colorType !== 3 && colorType !== 4 && colorType !== 6) return null;

  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width;
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(decoded, rowStart + x) <= threshold) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Fully transparent (or empty): nothing to crop, keep the full canvas.
  if (maxX < minX || maxY < minY) return null;

  const x = Math.max(0, minX - padding);
  const y = Math.max(0, minY - padding);
  const right = Math.min(width - 1, maxX + padding);
  const bottom = Math.min(height - 1, maxY + padding);

  return {
    sourceWidth: width,
    sourceHeight: height,
    x,
    y,
    width: right - x + 1,
    height: bottom - y + 1,
  };
}
