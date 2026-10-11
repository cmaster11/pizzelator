import { describe, expect, it } from 'vitest';
import { isPng, scaleNearest, widen } from './image';

describe('scaleNearest', () => {
  it('repeats each pixel in a factor-by-factor block', () => {
    const rgba = new Uint8Array([1, 2, 3, 255, 4, 5, 6, 255]);
    const out = scaleNearest({ width: 2, height: 1, rgba }, 2);
    expect([out.width, out.height]).toEqual([4, 2]);
    const row = [1, 2, 3, 255, 1, 2, 3, 255, 4, 5, 6, 255, 4, 5, 6, 255];
    expect([...out.rgba]).toEqual([...row, ...row]);
  });

  it('rejects non-integer factors', () => {
    expect(() => scaleNearest({ width: 1, height: 1, rgba: new Uint8Array(4) }, 1.5)).toThrow();
  });
});

describe('widen', () => {
  it('maps 8-bit samples onto the full 16-bit range', () => {
    expect([...widen(new Uint8Array([0, 1, 128, 255]))]).toEqual([0, 257, 32896, 65535]);
  });
});

describe('isPng', () => {
  it('recognizes the PNG signature only', () => {
    expect(isPng(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe(true);
    expect(isPng(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]))).toBe(false);
  });
});
