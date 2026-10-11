import { describe, expect, it } from 'vitest';

import { EXPORT_SCALES, scaleLabel } from './output';

describe('scaleLabel', () => {
  it('names each scale', () => {
    expect(scaleLabel('1')).toBe('_1x');
    expect(scaleLabel('8')).toBe('_8x');
    expect(scaleLabel('original')).toBe('_orig');
  });

  it('gives every scale a different suffix, so exports of one image never collide', () => {
    // fails-when: two scales share a suffix.
    const labels = EXPORT_SCALES.map((s) => scaleLabel(s.value));
    expect(new Set(labels).size).toBe(EXPORT_SCALES.length);
  });
});
