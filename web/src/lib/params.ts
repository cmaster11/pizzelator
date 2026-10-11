/** Run parameters, their validation, and how they expand into jobs. */
import {
  PALETTE_METHODS,
  PALETTE_SEARCHES,
  type Job,
  type PaletteColor,
  type PaletteMethodId,
  type PaletteSearchId,
  type RedrawMethodId,
} from '../engine/types';

export interface Params {
  targetSizes: number[];
  paletteCount: number;
  /** Each search runs for every palette method and threshold. */
  paletteSearches: PaletteSearchId[];
  /** Palettes kept per tolerance search, before duplicates are dropped. */
  maxImages: number;
  paletteMethods: PaletteMethodId[];
  /** Positions in [0, 1] for the methods that pick a color from a sorted group. */
  thresholds: number[];
  redrawMethods: RedrawMethodId[];
  /** Tolerance search only, like `maxImages`. */
  tolerance: number;
  increment: number;
  /** When set, every target size is redrawn with this palette and no search runs. */
  forcedPalette: PaletteColor[] | null;
}

/**
 * The classic run (tolerance 0.02 by 0.01 and this threshold sweep, HSLuv
 * saturation and lightness with CIE94, keeping 8 palettes per threshold) at
 * target size 64 with 24 colors, with the cluster search beside the
 * tolerance search.
 */
export const DEFAULT_PARAMS: Params = {
  targetSizes: [64],
  paletteCount: 24,
  paletteSearches: ['cluster', 'tolerance'],
  maxImages: 8,
  paletteMethods: ['lsd'],
  thresholds: [
    0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.58, 0.6, 0.62, 0.65, 0.67, 0.7, 0.75,
    0.77, 0.79, 0.8, 0.81, 0.82, 0.83, 0.84, 0.85, 0.86, 0.87, 0.88, 0.89, 0.9, 0.91, 0.92, 0.93,
    0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1,
  ],
  redrawMethods: ['cie94'],
  tolerance: 0.02,
  increment: 0.01,
  forcedPalette: null,
};

export function usesThreshold(method: PaletteMethodId): boolean {
  return PALETTE_METHODS.some((m) => m.id === method && m.usesThreshold);
}

/** The selected searches in `PALETTE_SEARCHES` order, whatever order they were picked in. */
function searchOrder(p: Params): PaletteSearchId[] {
  return PALETTE_SEARCHES.map((s) => s.id).filter((id) => p.paletteSearches.includes(id));
}

function searchesTolerance(p: Params): boolean {
  return p.paletteSearches.includes('tolerance');
}

export function validateParams(
  p: Params,
  image: { width: number; height: number } | null,
): string[] {
  const errors: string[] = [];
  const minSide = image === null ? Infinity : Math.min(image.width, image.height);
  if (p.targetSizes.length === 0) {
    errors.push('Add at least one target size.');
  }
  for (const t of p.targetSizes) {
    if (!Number.isInteger(t) || t < 1 || t > minSide) {
      errors.push(`Target size ${t} must be a whole number from 1 to ${minSide}.`);
    }
  }
  if (p.redrawMethods.length === 0) {
    errors.push('Pick at least one redraw method.');
  }
  if (p.forcedPalette !== null) {
    return errors;
  }
  if (!Number.isInteger(p.paletteCount) || p.paletteCount < 1) {
    errors.push('Palette colors must be a whole number of at least 1.');
  }
  if (p.paletteSearches.length === 0) {
    errors.push('Pick at least one palette search.');
  }
  if (p.paletteMethods.length === 0) {
    errors.push('Pick at least one palette method.');
  }
  if (p.paletteMethods.some(usesThreshold)) {
    if (p.thresholds.length === 0) {
      errors.push('Add at least one threshold.');
    }
    for (const t of p.thresholds) {
      if (!(t >= 0 && t <= 1)) {
        errors.push(`Threshold ${t} must be between 0 and 1.`);
      }
    }
  }
  if (searchesTolerance(p)) {
    if (!Number.isInteger(p.maxImages) || p.maxImages < 1) {
      errors.push('Max images must be a whole number of at least 1.');
    }
    if (!(p.tolerance >= 0)) {
      errors.push('Initial tolerance must be zero or more.');
    }
    if (!(p.increment > 0)) {
      errors.push('Tolerance increment must be more than zero.');
    }
  }
  return errors;
}

/**
 * One job per target size and palette source: target size first, then
 * method and threshold, then palette search, so the searches of one method
 * and threshold sit side by side.
 */
export function buildJobs(p: Params): Job[] {
  const sources: Job['source'][] =
    p.forcedPalette !== null
      ? [{ kind: 'forced', colors: p.forcedPalette }]
      : p.paletteMethods
          .flatMap((method) =>
            (usesThreshold(method) ? p.thresholds : [0]).map((threshold) => ({
              method,
              threshold,
            })),
          )
          .flatMap(({ method, threshold }) =>
            searchOrder(p).map((search) => ({
              kind: 'search' as const,
              search,
              method,
              threshold,
            })),
          );
  const unique = [...new Set(p.targetSizes)];
  return unique.flatMap((targetSize, i) =>
    sources.map((source, j) => ({
      id: i * sources.length + j,
      targetSize,
      source,
      redrawMethods: p.redrawMethods,
      paletteCount: p.paletteCount,
      tolerance: p.tolerance,
      increment: p.increment,
      maxImages: p.maxImages,
    })),
  );
}

/** Palettes one job redraws at most: the tolerance search keeps `maxImages`. */
function palettesPerJob(job: Job): number {
  return job.source.kind === 'search' && job.source.search === 'tolerance' ? job.maxImages : 1;
}

/** Upper bound on the images a run can produce. */
export function maxResults(p: Params): number {
  return buildJobs(p).reduce((n, job) => n + palettesPerJob(job), 0) * p.redrawMethods.length;
}

export function sourceLabel(source: Job['source']): string {
  if (source.kind === 'forced') {
    return 'forced palette';
  }
  const method = PALETTE_METHODS.find((m) => m.id === source.method);
  const label = method?.label ?? source.method;
  const search = PALETTE_SEARCHES.find((s) => s.id === source.search)?.heading ?? source.search;
  return `${method?.usesThreshold === true ? `${label} @ ${source.threshold}` : label} · ${search}`;
}

/** The caption under one result image. */
export function resultCaption(source: Job['source'], tolerance: number | null): string {
  if (source.kind === 'forced') {
    return 'forced palette';
  }
  if (source.search === 'cluster' || tolerance === null) {
    return 'clusters';
  }
  return `tolerance ${tolerance.toFixed(4)}`;
}

/** A file name unique within a run. */
export function resultFileName(
  baseName: string,
  job: Job,
  redrawMethod: RedrawMethodId,
  tolerance: number | null,
): string {
  const source =
    job.source.kind === 'forced'
      ? 'forced'
      : (usesThreshold(job.source.method)
          ? `${job.source.method}${job.source.threshold}`
          : job.source.method) + (job.source.search === 'cluster' ? '_cluster' : '');
  const tol = tolerance === null ? '' : `_tol${tolerance.toFixed(6)}`;
  return `${baseName}_t${job.targetSize}_${source}_${redrawMethod}${tol}`;
}
