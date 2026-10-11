import { adjustImage, adjustLabel, adjustPalette } from '../lib/adjust';
import { encodePng, scaleNearest } from '../lib/image';
import type { ExportScale, OutputOptions } from '../lib/output';
import { serializePalette } from '../lib/palette';
import type { ResultView } from './useRun';

export function scaleFactor(scale: ExportScale, result: ResultView): number {
  return scale === 'original' ? result.step : Number(scale);
}

/** The download name, without extension. */
export function exportName(result: ResultView, output: OutputOptions): string {
  return result.fileName + adjustLabel(output.adjust);
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
