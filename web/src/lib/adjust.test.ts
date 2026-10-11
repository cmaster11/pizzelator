import { describe, expect, it } from 'vitest';

import {
  adjustImage,
  adjustLabel,
  adjustPalette,
  adjustRgb,
  formatPercent,
  toByte,
} from './adjust';

const NONE = { brightness: 0, saturation: 0 };

describe('adjustRgb', () => {
  it('leaves every color unchanged with no adjustment', () => {
    for (let v = 0; v <= 255; v += 5) {
      expect(adjustRgb(v, 255 - v, (v * 7) % 256, NONE)).toEqual([v, 255 - v, (v * 7) % 256]);
    }
  });

  it('brightens by scaling each channel, rounding and capping', () => {
    const up10 = { brightness: 10, saturation: 0 };
    // 100 × 1.1 = 110; 5 × 1.1 = 5.5 rounds up; 240 × 1.1 caps at 255.
    expect(adjustRgb(100, 5, 240, up10)).toEqual([110, 6, 255]);
    expect(adjustRgb(100, 100, 100, { brightness: -50, saturation: 0 })).toEqual([50, 50, 50]);
  });

  it('saturates with the Filter Effects matrix, leaving grays alone', () => {
    const sat = { brightness: 0, saturation: 10 };
    // Each matrix row sums to 1, so grays keep their value.
    expect(adjustRgb(128, 128, 128, sat)).toEqual([128, 128, 128]);
    // (200, 100, 50) with s = 1.1, worked by hand:
    // R = 1.0787·200 − 0.0715·100 − 0.0072·50 = 215.74 − 7.15 − 0.36 = 208.23 → 208
    // G = −0.0213·200 + 1.0285·100 − 0.0072·50 = −4.26 + 102.85 − 0.36 = 98.23 → 98
    // B = −0.0213·200 − 0.0715·100 + 1.0928·50 = −4.26 − 7.15 + 54.64 = 43.23 → 43
    expect(adjustRgb(200, 100, 50, sat)).toEqual([208, 98, 43]);
  });

  it('desaturates fully to the luminance gray at -100%', () => {
    // 0.213·200 + 0.715·100 + 0.072·50 = 42.6 + 71.5 + 3.6 = 117.7 → 118
    expect(adjustRgb(200, 100, 50, { brightness: 0, saturation: -100 })).toEqual([118, 118, 118]);
  });

  it('combines saturation and brightness at the defaults', () => {
    // The unrounded saturated values above, × 1.2: 249.876 → 250, 117.876 → 118, 51.876 → 52.
    expect(adjustRgb(200, 100, 50, { brightness: 20, saturation: 10 })).toEqual([250, 118, 52]);
  });
});

describe('toByte', () => {
  it('matches the engine conversion: (v × 65535 + 0.5) as u32 >> 8', () => {
    expect(toByte(0)).toBe(0);
    expect(toByte(1)).toBe(255);
    // 0.5 → 32768.0 → 128; 0.2 → 13107.5 → 13107 → 51.
    expect(toByte(0.5)).toBe(128);
    expect(toByte(0.2)).toBe(51);
    for (let k = 0; k <= 255; k++) {
      expect(toByte(k / 255)).toBe(k);
    }
  });
});

describe('adjustImage', () => {
  it('adjusts RGB and keeps alpha', () => {
    const out = adjustImage(
      { width: 1, height: 2, rgba: Uint8Array.of(100, 5, 240, 255, 0, 15, 50, 128) },
      { brightness: 10, saturation: 0 },
    );
    expect([...out.rgba]).toEqual([110, 6, 255, 255, 0, 17, 55, 128]);
  });
});

describe('adjustPalette', () => {
  it('adjusts each color as its pixels are adjusted, keeping weights', () => {
    // fails-when: the float is adjusted directly. For 0.5 that gives 0.55 × 255 = 140.25
    // → 140, while its pixels hold toByte(0.5) = 128, brightened to 140.8 → 141.
    const [c] = adjustPalette([{ r: 0.2, g: 0.5, b: 1, weight: 7 }], {
      brightness: 10,
      saturation: 0,
    });
    expect(c).toEqual({ r: 56 / 255, g: 141 / 255, b: 1, weight: 7 });
  });
});

describe('adjustLabel', () => {
  it('names non-zero adjustments only', () => {
    expect(adjustLabel(NONE)).toBe('');
    expect(adjustLabel({ brightness: 20, saturation: 10 })).toBe('_bright20_sat10');
    expect(adjustLabel({ brightness: 0, saturation: -15 })).toBe('_sat-15');
  });
});

describe('formatPercent', () => {
  it('signs positive values', () => {
    expect([formatPercent(20), formatPercent(0), formatPercent(-15)]).toEqual([
      '+20%',
      '0%',
      '-15%',
    ]);
  });
});
