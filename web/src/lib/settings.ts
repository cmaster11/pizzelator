/**
 * The settings saved in the browser, so a reload keeps them: every run
 * parameter and the output options. The forced palette is not saved: like
 * the image, it comes from a file the user picks again.
 */
import { PALETTE_METHODS, PALETTE_SEARCHES, REDRAW_METHODS } from '../engine/types';
import { ADJUST_RANGE } from './adjust';
import { DEFAULT_OUTPUT, EXPORT_SCALES, type OutputOptions } from './output';
import { DEFAULT_PARAMS, type Params } from './params';

export const SETTINGS_KEY = 'pizzelator.settings.v1';

export interface Settings {
  params: Params;
  output: OutputOptions;
}

export const DEFAULT_SETTINGS: Settings = { params: DEFAULT_PARAMS, output: DEFAULT_OUTPUT };

/** The JSON stored under `SETTINGS_KEY`. */
export function serializeSettings({ params, output }: Settings): string {
  return JSON.stringify({ params: { ...params, forcedPalette: null }, output });
}

export function isDefaultSettings(settings: Settings): boolean {
  return (
    settings.params.forcedPalette === null &&
    serializeSettings(settings) === serializeSettings(DEFAULT_SETTINGS)
  );
}

type Fields = Partial<Record<string, unknown>>;

function fieldsOf(v: unknown): Fields {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? v : {};
}

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function numbers(v: unknown, fallback: number[]): number[] {
  return Array.isArray(v) && v.every(isNumber) ? v : fallback;
}

function number(v: unknown, fallback: number): number {
  return isNumber(v) ? v : fallback;
}

/** A list of known ids, or `fallback` when any entry is unknown. */
function ids<T extends string>(v: unknown, known: readonly { id: T }[], fallback: T[]): T[] {
  const valid = (x: unknown): x is T => known.some((k) => k.id === x);
  return Array.isArray(v) && v.every(valid) ? v : fallback;
}

/** A slider position the output bar can show: in range and on a step. */
function adjustment(v: unknown, fallback: number): number {
  return isNumber(v) &&
    v >= ADJUST_RANGE.min &&
    v <= ADJUST_RANGE.max &&
    (v - ADJUST_RANGE.min) % ADJUST_RANGE.step === 0
    ? v
    : fallback;
}

function parseParams(v: unknown): Params {
  const p = fieldsOf(v);
  const d = DEFAULT_PARAMS;
  return {
    targetSizes: numbers(p.targetSizes, d.targetSizes),
    paletteCount: number(p.paletteCount, d.paletteCount),
    paletteSearches: ids(p.paletteSearches, PALETTE_SEARCHES, d.paletteSearches),
    maxImages: number(p.maxImages, d.maxImages),
    paletteMethods: ids(p.paletteMethods, PALETTE_METHODS, d.paletteMethods),
    thresholds: numbers(p.thresholds, d.thresholds),
    redrawMethods: ids(p.redrawMethods, REDRAW_METHODS, d.redrawMethods),
    tolerance: number(p.tolerance, d.tolerance),
    increment: number(p.increment, d.increment),
    forcedPalette: null,
  };
}

function parseOutput(v: unknown): OutputOptions {
  const o = fieldsOf(v);
  const adjust = fieldsOf(o.adjust);
  const d = DEFAULT_OUTPUT;
  return {
    scale: EXPORT_SCALES.find((s) => s.value === o.scale)?.value ?? d.scale,
    adjust: {
      brightness: adjustment(adjust.brightness, d.adjust.brightness),
      saturation: adjustment(adjust.saturation, d.adjust.saturation),
    },
  };
}

/**
 * Settings from stored JSON. Stored data is untrusted (an older version of
 * the app, or edited by hand): each field that is missing or malformed takes
 * its default, and the rest are kept.
 */
export function parseSettings(text: string | null): Settings {
  let data: unknown = null;
  if (text !== null) {
    try {
      data = JSON.parse(text);
    } catch {
      // Not JSON: every field takes its default.
    }
  }
  const s = fieldsOf(data);
  return { params: parseParams(s.params), output: parseOutput(s.output) };
}

/**
 * `storage` is a getter because reaching `window.localStorage` itself throws
 * when the browser blocks storage for the site. The app then works as
 * before, starting from the defaults on every load.
 */
export function loadSettings(storage: () => Pick<Storage, 'getItem'>): Settings {
  try {
    return parseSettings(storage().getItem(SETTINGS_KEY));
  } catch (err) {
    console.warn('Settings could not be read; using the defaults.', err);
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(storage: () => Pick<Storage, 'setItem'>, settings: Settings): void {
  try {
    storage().setItem(SETTINGS_KEY, serializeSettings(settings));
  } catch (err) {
    console.warn('Settings could not be saved.', err);
  }
}
