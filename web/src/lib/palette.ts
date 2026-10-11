/**
 * Palette files in the classic palette JSON format:
 * `{"Tolerance": 0.06, "Colors": [{"Color": {"R": 0.1, "G": 0.2, "B": 0.3}, "Weight": 4}]}`.
 */
import type { PaletteColor } from '../engine/types';

interface PaletteFile {
  Tolerance: number;
  Colors: { Color: { R: number; G: number; B: number }; Weight: number }[];
}

function isChannel(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
}

export function parsePaletteJson(text: string): PaletteColor[] {
  const data: unknown = JSON.parse(text);
  const entries: unknown =
    typeof data === 'object' && data !== null ? (data as Partial<PaletteFile>).Colors : undefined;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('palette file needs a non-empty "Colors" array');
  }
  return entries.map((entry: unknown, i) => {
    const e = entry as Partial<PaletteFile['Colors'][number]> | null;
    const c = e?.Color;
    if (c === undefined || !isChannel(c.R) || !isChannel(c.G) || !isChannel(c.B)) {
      throw new Error(`color ${i + 1} needs R, G and B between 0 and 1`);
    }
    const weight = typeof e?.Weight === 'number' ? e.Weight : 0;
    return { r: c.R, g: c.G, b: c.B, weight };
  });
}

export function serializePalette(colors: PaletteColor[], tolerance: number | null): string {
  const file: PaletteFile = {
    Tolerance: tolerance ?? 0,
    Colors: colors.map((c) => ({
      Color: { R: c.r, G: c.g, B: c.b },
      Weight: c.weight,
    })),
  };
  return JSON.stringify(file, null, 2);
}

export function toCss(c: PaletteColor): string {
  const ch = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);
  return `rgb(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)})`;
}
