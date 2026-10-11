import { describe, expect, it } from 'vitest';
import { parsePaletteJson, serializePalette } from './palette';

describe('palette files', () => {
  it('round-trips through the classic format', () => {
    const colors = [
      { r: 0.1, g: 0.2, b: 0.3, weight: 4 },
      { r: 1, g: 1, b: 1, weight: 1 },
    ];
    expect(parsePaletteJson(serializePalette(colors, 0.05))).toEqual(colors);
  });

  it('reads a classic palette file written elsewhere', () => {
    const text = '{"Tolerance":0,"Colors":[{"Color":{"R":0.5,"G":0,"B":1},"Weight":3}]}';
    expect(parsePaletteJson(text)).toEqual([{ r: 0.5, g: 0, b: 1, weight: 3 }]);
  });

  it('rejects empty palettes and out-of-range channels', () => {
    expect(() => parsePaletteJson('{"Colors":[]}')).toThrow('non-empty');
    expect(() => parsePaletteJson('{"Colors":[{"Color":{"R":2,"G":0,"B":0}}]}')).toThrow('color 1');
  });
});
