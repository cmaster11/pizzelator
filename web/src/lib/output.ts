/** How results are shown and downloaded; changing these never re-runs the engine. */
import { DEFAULT_ADJUSTMENTS, type Adjustments } from './adjust';

/** `original` scales each result back up by its downsampling step. */
export type ExportScale = 'original' | '1' | '2' | '4' | '8';

export const EXPORT_SCALES: { value: ExportScale; label: string }[] = [
  { value: 'original', label: 'Original size' },
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
  { value: '8', label: '8×' },
];

/**
 * How big results show on the page. `fit` fills the gallery columns and follows
 * the window; the others draw each result pixel as a fixed square of CSS
 * pixels, so resizing the window leaves them alone.
 */
export type DisplayScale = 'fit' | '2' | '4' | '8';

export const DISPLAY_SCALES: { value: DisplayScale; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
  { value: '8', label: '8×' },
];

export interface OutputOptions {
  scale: ExportScale;
  display: DisplayScale;
  adjust: Adjustments;
}

/**
 * The output options before any change. Touch screens (a coarse primary
 * pointer: phones and tablets) start at `fit`, where 4× results would not fit
 * side by side; a mouse or trackpad starts at 4×.
 */
export function defaultOutput(touch: boolean): OutputOptions {
  return { scale: '4', display: touch ? 'fit' : '4', adjust: DEFAULT_ADJUSTMENTS };
}

/** The file-name suffix for a PNG export at `scale`: `_4x`, or `_orig` for original size. */
export function scaleLabel(scale: ExportScale): string {
  return scale === 'original' ? '_orig' : `_${scale}x`;
}
