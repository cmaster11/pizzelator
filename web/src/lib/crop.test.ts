import { describe, expect, it } from 'vitest';

import type { SourceImage } from '../engine/types';
import { cropImage, cropLabel, cropToPercent, snapCrop } from './crop';

/** A 4×3 image whose every sample encodes its own position: (y * 4 + x) * 4 + channel. */
function numbered(): SourceImage {
  const rgba16 = new Uint16Array(4 * 3 * 4);
  rgba16.forEach((_, i) => (rgba16[i] = i));
  return { width: 4, height: 3, rgba16 };
}

describe('cropImage', () => {
  it('copies exactly the selected pixels, row by row', () => {
    const out = cropImage(numbered(), { x: 1, y: 1, width: 2, height: 2 });
    expect(out.width).toBe(2);
    expect(out.height).toBe(2);
    // Pixels (1,1), (2,1), (1,2), (2,2) start at samples 20, 24, 36, 40.
    expect([...out.rgba16]).toEqual([
      20, 21, 22, 23, 24, 25, 26, 27, 36, 37, 38, 39, 40, 41, 42, 43,
    ]);
  });

  it('refuses an area reaching outside the image', () => {
    // fails-when: the bounds check is missing; subarray would silently return short rows.
    expect(() => cropImage(numbered(), { x: 3, y: 0, width: 2, height: 1 })).toThrow(/outside/);
    expect(() => cropImage(numbered(), { x: 0, y: 0, width: 0, height: 1 })).toThrow(/outside/);
  });

  it('accepts the whole image', () => {
    // breaks-if-wrong: an off-by-one bound would refuse the largest legitimate area.
    const out = cropImage(numbered(), { x: 0, y: 0, width: 4, height: 3 });
    expect([...out.rgba16]).toEqual([...numbered().rgba16]);
  });
});

describe('snapCrop', () => {
  it('rounds each edge to the nearest pixel boundary', () => {
    // 245 px wide: 10% → 24.5 → 25 (round half up), 60% → 147.
    expect(snapCrop({ x: 10, y: 25, width: 50, height: 50 }, 245, 184)).toEqual({
      x: 25,
      y: 46,
      width: 122,
      height: 92,
    });
  });

  it('clamps a selection spilling past the image', () => {
    expect(snapCrop({ x: 80, y: -5, width: 40, height: 50 }, 100, 100)).toEqual({
      x: 80,
      y: 0,
      width: 20,
      height: 45,
    });
  });

  it('treats an empty or whole-image selection as no crop', () => {
    expect(snapCrop({ x: 10, y: 10, width: 0.1, height: 20 }, 100, 100)).toBeNull();
    expect(snapCrop({ x: 0, y: 0, width: 100, height: 100 }, 100, 100)).toBeNull();
  });

  it('round-trips through cropToPercent', () => {
    const rect = { x: 7, y: 3, width: 101, height: 55 };
    expect(snapCrop(cropToPercent(rect, 245, 184), 245, 184)).toEqual(rect);
  });
});

describe('cropLabel', () => {
  it('names the area, and nothing without one', () => {
    expect(cropLabel({ x: 7, y: 3, width: 101, height: 55 })).toBe('_crop7-3-101x55');
    expect(cropLabel(null)).toBe('');
  });
});
