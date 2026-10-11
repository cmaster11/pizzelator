/** Selecting an area of the source image, in whole source pixels. */
import type { SourceImage } from '../engine/types';

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A selection in percent of the image, as the crop control reports it. */
export interface PercentRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Snaps a percent selection to whole pixels of a `width` × `height` image:
 * each edge rounds to the nearest pixel boundary and is clamped to the image.
 * Returns null when the selection is empty or covers the whole image, both of
 * which mean "use the whole image".
 */
export function snapCrop(sel: PercentRect, width: number, height: number): CropRect | null {
  const edge = (percent: number, size: number): number =>
    Math.min(size, Math.max(0, Math.round((percent / 100) * size)));
  const x0 = edge(sel.x, width);
  const x1 = edge(sel.x + sel.width, width);
  const y0 = edge(sel.y, height);
  const y1 = edge(sel.y + sel.height, height);
  if (x1 - x0 < 1 || y1 - y0 < 1) {
    return null;
  }
  if (x0 === 0 && y0 === 0 && x1 === width && y1 === height) {
    return null;
  }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/** The selection in percent of a `width` × `height` image, for the crop control. */
export function cropToPercent(rect: CropRect, width: number, height: number): PercentRect {
  return {
    x: (rect.x / width) * 100,
    y: (rect.y / height) * 100,
    width: (rect.width / width) * 100,
    height: (rect.height / height) * 100,
  };
}

/** Copies the selected rows of a row-major RGBA image; samples are not altered. */
export function cropImage(image: SourceImage, rect: CropRect): SourceImage {
  const { x, y, width, height } = rect;
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    width < 1 ||
    height < 1 ||
    x < 0 ||
    y < 0 ||
    x + width > image.width ||
    y + height > image.height
  ) {
    throw new Error(
      `crop ${width}×${height} at ${x},${y} is outside the ${image.width}×${image.height} image`,
    );
  }
  const rgba16 = new Uint16Array(width * height * 4);
  const rowLength = width * 4;
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * image.width + x) * 4;
    rgba16.set(image.rgba16.subarray(start, start + rowLength), row * rowLength);
  }
  return { width, height, rgba16 };
}

/** A file-name suffix naming the area, so results from different areas never collide. */
export function cropLabel(rect: CropRect | null): string {
  return rect === null ? '' : `_crop${rect.x}-${rect.y}-${rect.width}x${rect.height}`;
}
