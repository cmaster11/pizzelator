import { describe, expect, it } from 'vitest';

import { defaultOutput, EXPORT_SCALES, scaleLabel } from './output';

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

describe('defaultOutput', () => {
  it('shows results to fit on touch screens and at 4× with a mouse', () => {
    expect(defaultOutput(true).display).toBe('fit');
    expect(defaultOutput(false).display).toBe('4');
    // Downloads stay at 4× everywhere.
    expect(defaultOutput(true).scale).toBe('4');
    expect(defaultOutput(false).scale).toBe('4');
  });
});
