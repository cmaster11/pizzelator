import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PARAMS,
  buildJobs,
  maxResults,
  resultCaption,
  resultFileName,
  settingsKey,
  settingsLabel,
  validateParams,
  type Params,
} from './params';

const params = (over: Partial<Params>): Params => ({
  ...DEFAULT_PARAMS,
  ...over,
});

describe('buildJobs', () => {
  it('expands threshold methods per threshold and others once, target size first', () => {
    const jobs = buildJobs(
      params({
        targetSizes: [64, 120],
        paletteSearches: ['tolerance'],
        paletteMethods: ['lsd', 'w'],
        thresholds: [0.2, 0.8],
      }),
    );
    const search = { kind: 'search', search: 'tolerance' } as const;
    expect(jobs.map((j) => [j.targetSize, j.source])).toEqual([
      [64, { ...search, method: 'lsd', threshold: 0.2 }],
      [64, { ...search, method: 'lsd', threshold: 0.8 }],
      [64, { ...search, method: 'w', threshold: 0 }],
      [120, { ...search, method: 'lsd', threshold: 0.2 }],
      [120, { ...search, method: 'lsd', threshold: 0.8 }],
      [120, { ...search, method: 'w', threshold: 0 }],
    ]);
    expect(new Set(jobs.map((j) => j.id)).size).toBe(jobs.length);
  });

  it('runs every palette search per method and threshold, clusters first', () => {
    // Picked in the other order: the jobs still put clusters first.
    const jobs = buildJobs(
      params({ paletteSearches: ['tolerance', 'cluster'], thresholds: [0.2, 0.8] }),
    );
    expect(
      jobs.map((j) => (j.source.kind === 'search' ? [j.source.threshold, j.source.search] : [])),
    ).toEqual([
      [0.2, 'cluster'],
      [0.2, 'tolerance'],
      [0.8, 'cluster'],
      [0.8, 'tolerance'],
    ]);
  });

  it('uses only the forced palette when one is set', () => {
    const colors = [{ r: 1, g: 0, b: 0, weight: 1 }];
    const jobs = buildJobs(params({ targetSizes: [64, 64, 32], forcedPalette: colors }));
    expect(jobs.map((j) => [j.targetSize, j.source.kind])).toEqual([
      [64, 'forced'],
      [32, 'forced'],
    ]);
  });
});

describe('maxResults', () => {
  it('multiplies jobs, redraw methods and images per search', () => {
    expect(
      maxResults(
        params({
          targetSizes: [64, 120],
          paletteSearches: ['tolerance'],
          thresholds: [0.6],
          redrawMethods: ['cie94', 'rgb'],
          maxImages: 5,
        }),
      ),
    ).toBe(20);
  });

  it('counts one palette per cluster search', () => {
    // 2 sizes × 2 redraws × (1 cluster palette + 5 tolerance palettes).
    // fails-when: cluster jobs count max images too (40).
    const both = params({
      targetSizes: [64, 120],
      thresholds: [0.6],
      redrawMethods: ['cie94', 'rgb'],
      maxImages: 5,
    });
    expect(maxResults(both)).toBe(24);
    expect(maxResults({ ...both, paletteSearches: ['cluster'] })).toBe(4);
  });
});

describe('validateParams', () => {
  it('accepts the defaults for a large enough image', () => {
    expect(validateParams(DEFAULT_PARAMS, { width: 400, height: 300 })).toEqual([]);
  });

  it('rejects target sizes above the shorter side and out-of-range thresholds', () => {
    const errors = validateParams(params({ targetSizes: [301], thresholds: [1.5] }), {
      width: 400,
      height: 300,
    });
    expect(errors).toHaveLength(2);
    expect(errors[0]).toContain('301');
    expect(errors[1]).toContain('1.5');
  });

  it('checks the tolerance settings only for the tolerance search', () => {
    const bad = { increment: 0, maxImages: 0 };
    const image = { width: 400, height: 300 };
    expect(validateParams(params({ ...bad, paletteSearches: ['cluster'] }), image)).toEqual([]);
    expect(validateParams(params(bad), image)).toEqual([
      'Max images must be a whole number of at least 1.',
      'Tolerance increment must be more than zero.',
    ]);
    expect(validateParams(params({ paletteSearches: [] }), image)).toEqual([
      'Pick at least one palette search.',
    ]);
  });

  it('ignores search parameters when a palette is forced', () => {
    const forced = params({
      forcedPalette: [{ r: 0, g: 0, b: 0, weight: 1 }],
      paletteSearches: [],
      paletteMethods: [],
      increment: 0,
    });
    expect(validateParams(forced, { width: 400, height: 300 })).toEqual([]);
  });
});

describe('resultFileName', () => {
  it('is distinct for distinct results', () => {
    const [cluster, a, , b] = buildJobs(params({ thresholds: [0.2, 0.8] }));
    if (cluster === undefined || a === undefined || b === undefined) {
      throw new Error('expected four jobs');
    }
    const names = [
      resultFileName('img', cluster, 'cie94', null),
      resultFileName('img', a, 'cie94', 0.05),
      resultFileName('img', a, 'cie94', 0.06),
      resultFileName('img', b, 'cie94', 0.05),
      resultFileName('img', a, 'rgb', 0.05),
    ];
    expect(new Set(names).size).toBe(names.length);
    expect(names.slice(0, 2)).toEqual([
      'img_t64_lsd0.2_cluster_cie94',
      'img_t64_lsd0.2_cie94_tol0.050000',
    ]);
  });
});

describe('labels', () => {
  it('heads a section with its settings and names the search in each caption', () => {
    const [cluster, tolerance] = buildJobs(params({ thresholds: [0.6] }));
    if (cluster === undefined || tolerance === undefined) {
      throw new Error('expected two jobs');
    }
    expect(settingsLabel(cluster.source)).toBe('HSLuv sat + lum @ 0.6');
    expect(settingsLabel(tolerance.source)).toBe('HSLuv sat + lum @ 0.6');
    expect(
      settingsLabel(buildJobs(params({ paletteMethods: ['w'] }))[0]?.source ?? cluster.source),
    ).toBe('Weighted average');
    expect(resultCaption(cluster.source, null)).toBe('clusters');
    expect(resultCaption(tolerance.source, 0.04352)).toBe('tolerance 0.0435');
  });
});

describe('settingsKey', () => {
  it('puts the searches of one size, method and threshold together, and nothing else', () => {
    const jobs = buildJobs(
      params({ targetSizes: [32, 64], paletteMethods: ['lsd', 'w'], thresholds: [0.2, 0.8] }),
    );
    const groups = new Map<string, string[]>();
    for (const job of jobs) {
      const key = settingsKey(job);
      groups.set(key, [
        ...(groups.get(key) ?? []),
        job.source.kind === 'search' ? job.source.search : 'forced',
      ]);
    }
    // 2 sizes × (lsd at 2 thresholds + w once): 6 sections, each with both searches.
    // fails-when: the key splits the searches of one setting or merges two settings.
    expect(groups.size).toBe(6);
    expect([...groups.values()].every((s) => s.join() === 'cluster,tolerance')).toBe(true);
  });
});

describe('DEFAULT_PARAMS', () => {
  it('steps thresholds by 0.1 to 0.7 and by 0.05 above, at target 64 with 24 colors', () => {
    // fails-when: a threshold is missing, doubled, or carries float noise
    // (0.1 + 0.2 is not 0.3).
    const thresholds = '.1,.2,.3,.4,.5,.6,.7,.75,.8,.85,.9,.95,1';
    expect(DEFAULT_PARAMS).toEqual({
      targetSizes: [64],
      paletteCount: 24,
      paletteSearches: ['cluster', 'tolerance'],
      maxImages: 8,
      paletteMethods: ['lsd'],
      thresholds: thresholds.split(',').map(Number),
      redrawMethods: ['cie94'],
      tolerance: 0.02,
      increment: 0.01,
      forcedPalette: null,
    });
  });
});
