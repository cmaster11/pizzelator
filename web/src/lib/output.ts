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

export interface OutputOptions {
  scale: ExportScale;
  adjust: Adjustments;
}

export const DEFAULT_OUTPUT: OutputOptions = { scale: '4', adjust: DEFAULT_ADJUSTMENTS };
