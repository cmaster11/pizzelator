/**
 * Output adjustments, applied to finished results only; the search and the
 * redraw never see them. Each 8-bit RGB color goes through the CSS
 * `saturate()` matrix and the `brightness()` scale, then is rounded and
 * clamped to 0–255 once.
 */
import type { PaletteColor, RgbaImage } from '../engine/types';

export interface Adjustments {
  /** Percent added to brightness: 20 scales every channel by 1.2. */
  brightness: number;
  /** Percent added to saturation: 10 is CSS `saturate(1.1)`. */
  saturation: number;
}

export const ADJUST_RANGE = { min: -50, max: 50, step: 5 } as const;
export const DEFAULT_ADJUSTMENTS: Adjustments = { brightness: 20, saturation: 10 };

function isIdentity(adj: Adjustments): boolean {
  return adj.brightness === 0 && adj.saturation === 0;
}

function toChannel(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

/**
 * One 8-bit color through the saturate matrix of the Filter Effects spec
 * (feColorMatrix type="saturate") and the brightness scale.
 */
export function adjustRgb(
  r: number,
  g: number,
  b: number,
  adj: Adjustments,
): [number, number, number] {
  const s = 1 + adj.saturation / 100;
  const k = 1 + adj.brightness / 100;
  const r1 = (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b;
  const g1 = (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b;
  const b1 = (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b;
  return [toChannel(r1 * k), toChannel(g1 * k), toChannel(b1 * k)];
}

/** The engine's float-to-byte conversion (`Rgb::to_rgb8`). */
export function toByte(v: number): number {
  const wide = Math.min(0xffffffff, Math.max(0, Math.trunc(v * 65535 + 0.5)));
  return (wide >>> 8) & 0xff;
}

export function adjustImage(image: RgbaImage, adj: Adjustments): RgbaImage {
  if (isIdentity(adj)) {
    return image;
  }
  const src = image.rgba;
  const rgba = new Uint8Array(src.length);
  for (let i = 0; i < src.length; i += 4) {
    const [r, g, b] = adjustRgb(src[i] ?? 0, src[i + 1] ?? 0, src[i + 2] ?? 0, adj);
    rgba[i] = r;
    rgba[i + 1] = g;
    rgba[i + 2] = b;
    rgba[i + 3] = src[i + 3] ?? 0;
  }
  return { width: image.width, height: image.height, rgba };
}

/**
 * Adjusts each palette color exactly as its pixels are adjusted: through the
 * engine's byte conversion, so the palette matches the image byte for byte.
 */
export function adjustPalette(colors: PaletteColor[], adj: Adjustments): PaletteColor[] {
  if (isIdentity(adj)) {
    return colors;
  }
  return colors.map((c) => {
    const [r, g, b] = adjustRgb(toByte(c.r), toByte(c.g), toByte(c.b), adj);
    return { r: r / 255, g: g / 255, b: b / 255, weight: c.weight };
  });
}

/** A file-name suffix naming the adjustments, so differently adjusted files never collide. */
export function adjustLabel(adj: Adjustments): string {
  const part = (name: string, v: number): string => (v === 0 ? '' : `_${name}${v}`);
  return part('bright', adj.brightness) + part('sat', adj.saturation);
}

/** "+20%", "0%", "-15%". */
export function formatPercent(v: number): string {
  return `${v > 0 ? '+' : ''}${v}%`;
}
