import { adjustImage, adjustLabel, adjustPalette } from '../lib/adjust';
import { encodePng, scaleNearest } from '../lib/image';
import { scaleLabel, type ExportScale, type OutputOptions } from '../lib/output';
import { serializePalette } from '../lib/palette';
import type { ResultView } from './useRun';

export function scaleFactor(scale: ExportScale, result: ResultView): number {
  return scale === 'original' ? result.step : Number(scale);
}

/** The download name, without extension. */
export function exportName(result: ResultView, output: OutputOptions): string {
  return result.fileName + adjustLabel(output.adjust);
}

/** The PNG file name, without extension: the export name plus the scale. */
export function pngName(result: ResultView, output: OutputOptions): string {
  return exportName(result, output) + scaleLabel(output.scale);
}

export function exportPng(result: ResultView, output: OutputOptions): Promise<Blob> {
  const image = adjustImage(result.image, output.adjust);
  return encodePng(scaleNearest(image, scaleFactor(output.scale, result)));
}

export function exportPalette(result: ResultView, output: OutputOptions): Blob {
  const palette = adjustPalette(result.palette, output.adjust);
  return new Blob([serializePalette(palette, result.tolerance)], {
    type: 'application/json',
  });
}

/**
 * Why copying an image is unavailable here, or null when it works. Browsers
 * expose the image clipboard only in secure contexts (https or localhost).
 */
export function copyUnavailable(): string | null {
  if (!window.isSecureContext) {
    return 'Copying images needs https or localhost.';
  }
  if (typeof ClipboardItem === 'undefined' || typeof navigator.clipboard.write !== 'function') {
    return 'This browser cannot copy images.';
  }
  return null;
}

/**
 * Copies the PNG to the clipboard. The encoding promise goes into the
 * ClipboardItem as is, so the write starts inside the click that asked for
 * it, as Safari requires.
 */
export function copyPng(result: ResultView, output: OutputOptions): Promise<void> {
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': exportPng(result, output) })]);
}
