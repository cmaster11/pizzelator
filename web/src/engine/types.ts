/** Messages and data shared by the UI thread and the engine workers. */

export const PALETTE_METHODS = [
  {
    id: 'lsd',
    label: 'HSLuv sat + lum',
    usesThreshold: true,
    description:
      'Picks the group color at the threshold position, ordered by HSLuv saturation plus luminance.',
  },
  {
    id: 'ls',
    label: 'HSLuv saturation',
    usesThreshold: true,
    description:
      'Picks the group color at the threshold position, ordered by HSLuv saturation, then luminance.',
  },
  {
    id: 'hcld',
    label: 'HCL chroma + lum',
    usesThreshold: true,
    description:
      'Picks the group color at the threshold position, ordered by HCL chroma plus luminance.',
  },
  {
    id: 'w',
    label: 'Weighted average',
    usesThreshold: false,
    description: 'Averages each group in RGB, weighted by pixel count.',
  },
  {
    id: 'sqQ',
    label: 'Squared average',
    usesThreshold: false,
    description: 'Root-mean-square average of each group in RGB, weighted by pixel count.',
  },
  {
    id: 'lab',
    label: 'Lab average',
    usesThreshold: false,
    description: 'Averages each group in CIE Lab, weighted by pixel count.',
  },
] as const;

export type PaletteMethodId = (typeof PALETTE_METHODS)[number]['id'];

export const PALETTE_SEARCHES = [
  {
    id: 'cluster',
    label: 'Clusters (v2)',
    description:
      'Clusters the colors by pixel count into exactly the palette size: one palette per method and threshold.',
  },
  {
    id: 'tolerance',
    label: 'Tolerance (classic)',
    description:
      'The classic search: raises a grouping tolerance until the colors fall into exactly the palette size.',
  },
] as const;

export type PaletteSearchId = (typeof PALETTE_SEARCHES)[number]['id'];

export const REDRAW_METHODS = [
  { id: 'cie94', label: 'CIE94' },
  { id: 'cie2000', label: 'CIEDE2000' },
  { id: 'lab', label: 'Lab' },
  { id: 'luv', label: 'Luv' },
  { id: 'rgb', label: 'RGB' },
] as const;

export type RedrawMethodId = (typeof REDRAW_METHODS)[number]['id'];

/** Engine input: row-major straight-alpha 16-bit RGBA samples. */
export interface SourceImage {
  width: number;
  height: number;
  rgba16: Uint16Array<ArrayBuffer>;
}

/**
 * The input downsampled for one target size, made once per run and shared
 * with every run worker, which never needs the full-size image.
 */
export interface Downsampled {
  targetSize: number;
  step: number;
  width: number;
  height: number;
  /** `[r, g, b, …]` column-major, exactly as the engine computed them. */
  rgb: Float64Array<ArrayBuffer>;
}

export interface RgbaImage {
  width: number;
  height: number;
  /** Row-major straight-alpha RGBA bytes. */
  rgba: Uint8Array<ArrayBuffer>;
}

/** Channels in [0, 1]; weight is the number of downsampled pixels it stands for. */
export interface PaletteColor {
  r: number;
  g: number;
  b: number;
  weight: number;
}

export type PaletteSource =
  | { kind: 'search'; search: PaletteSearchId; method: PaletteMethodId; threshold: number }
  | { kind: 'forced'; colors: PaletteColor[] };

/** One target size with one palette source, redrawn with each redraw method. */
export interface Job {
  id: number;
  targetSize: number;
  source: PaletteSource;
  redrawMethods: RedrawMethodId[];
  paletteCount: number;
  /** Tolerance search only. */
  tolerance: number;
  increment: number;
  maxImages: number;
}

export interface ResultImage {
  jobId: number;
  redrawMethod: RedrawMethodId;
  /** Grouping tolerance that produced the palette; null for clusters and forced palettes. */
  tolerance: number | null;
  palette: PaletteColor[];
  step: number;
  image: RgbaImage;
}

export type WorkerRequest =
  | { type: 'images'; images: Downsampled[] }
  | { type: 'job'; job: Job }
  | { type: 'downsample'; image: SourceImage; targetSizes: number[] }
  | { type: 'extract-palette'; image: SourceImage }
  | { type: 'decode-png'; bytes: ArrayBuffer };

export type WorkerResponse =
  | { type: 'result'; result: ResultImage }
  | { type: 'job-done'; jobId: number; palettesFound: number }
  | { type: 'job-error'; jobId: number; message: string }
  | { type: 'palette'; colors: PaletteColor[] }
  | { type: 'downsampled'; images: Downsampled[] }
  | { type: 'decoded'; image: SourceImage }
  | { type: 'task-error'; message: string };
