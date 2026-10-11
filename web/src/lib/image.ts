/** Decoding uploads to RGBA, scaling and encoding PNGs. */
import { decodePngInWorker } from '../engine/pool';
import type { RgbaImage, SourceImage } from '../engine/types';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function isPng(bytes: Uint8Array): boolean {
  return PNG_SIGNATURE.every((b, i) => bytes[i] === b);
}

/** Widens 8-bit samples to 16 bits (multiplying by 257, so 0xff becomes 0xffff). */
export function widen(rgba: Uint8Array | Uint8ClampedArray): Uint16Array<ArrayBuffer> {
  const out = new Uint16Array(rgba.length);
  for (let i = 0; i < rgba.length; i++) {
    out[i] = (rgba[i] ?? 0) * 257;
  }
  return out;
}

async function decodeWithCanvas(file: Blob): Promise<SourceImage> {
  const bitmap = await createImageBitmap(file, {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('2D canvas is not available');
    }
    ctx.drawImage(bitmap, 0, 0);
    const data = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    return { width: bitmap.width, height: bitmap.height, rgba16: widen(data.data) };
  } finally {
    bitmap.close();
  }
}

/**
 * Decodes an upload for the engine. PNGs go through the engine's own decoder:
 * a canvas premultiplies alpha and would shift semi-transparent colors.
 * Other formats use the browser's decoder.
 */
export async function decodeImage(file: Blob): Promise<SourceImage> {
  const bytes = await file.arrayBuffer();
  if (isPng(new Uint8Array(bytes, 0, Math.min(8, bytes.byteLength)))) {
    return decodePngInWorker(bytes);
  }
  return decodeWithCanvas(file);
}

/** Nearest-neighbor upscale by an integer factor. */
export function scaleNearest(image: RgbaImage, factor: number): RgbaImage {
  if (!Number.isInteger(factor) || factor < 1) {
    throw new Error(`scale factor must be a positive integer, got ${factor}`);
  }
  if (factor === 1) {
    return image;
  }
  const width = image.width * factor;
  const height = image.height * factor;
  const out = new Uint8Array(width * height * 4);
  const src = new Uint32Array(image.rgba.buffer, image.rgba.byteOffset, image.width * image.height);
  const dst = new Uint32Array(out.buffer);
  for (let y = 0; y < height; y++) {
    const srcRow = Math.floor(y / factor) * image.width;
    const dstRow = y * width;
    for (let x = 0; x < width; x++) {
      dst[dstRow + x] = src[srcRow + Math.floor(x / factor)] ?? 0;
    }
  }
  return { width, height, rgba: out };
}

export async function encodePng(image: RgbaImage): Promise<Blob> {
  const canvas = new OffscreenCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('2D canvas is not available');
  }
  const pixels = new Uint8ClampedArray(
    image.rgba.buffer,
    image.rgba.byteOffset,
    image.rgba.byteLength,
  );
  ctx.putImageData(new ImageData(pixels, image.width, image.height), 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}
