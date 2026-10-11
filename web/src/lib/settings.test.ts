import { describe, expect, it } from 'vitest';

import { DEFAULT_OUTPUT } from './output';
import { DEFAULT_PARAMS } from './params';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  isDefaultSettings,
  loadSettings,
  parseSettings,
  saveSettings,
  serializeSettings,
  type Settings,
} from './settings';

const CHANGED: Settings = {
  params: {
    targetSizes: [32, 96],
    paletteCount: 20,
    paletteSearches: ['cluster'],
    maxImages: 3,
    paletteMethods: ['hcld', 'lab'],
    thresholds: [0.25, 1],
    redrawMethods: ['cie2000', 'rgb'],
    tolerance: 0.035,
    increment: 0.002,
    forcedPalette: null,
  },
  output: { scale: 'original', adjust: { brightness: -15, saturation: 0 } },
};

/** An in-memory `Storage` for one test. */
function memoryStorage(): Storage {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => {
      items.clear();
    },
    getItem: (key) => items.get(key) ?? null,
    key: (i) => [...items.keys()][i] ?? null,
    removeItem: (key) => {
      items.delete(key);
    },
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

describe('parseSettings', () => {
  it('reads back every setting it saved', () => {
    // fails-when: a field is not saved, or parsing replaces a valid value with its default.
    expect(parseSettings(serializeSettings(CHANGED))).toEqual(CHANGED);
    expect(CHANGED.params).not.toEqual(DEFAULT_PARAMS);
  });

  it('starts from the defaults with nothing saved or with text that is not JSON', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"params": ')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('[1, 2]')).toEqual(DEFAULT_SETTINGS);
  });

  it('gives each missing or malformed field its default and keeps the rest', () => {
    const stored = JSON.parse(serializeSettings(CHANGED)) as {
      params: Record<string, unknown>;
      output: { scale: unknown; adjust: Record<string, unknown> };
    };
    stored.params.paletteMethods = ['lsd', 'gone'];
    stored.params.thresholds = [0.5, '0.6'];
    delete stored.params.maxImages;
    stored.params.tolerance = null;
    stored.output.scale = '3';
    stored.output.adjust.brightness = 7;
    stored.output.adjust.saturation = 55;

    const parsed = parseSettings(JSON.stringify(stored));
    // fails-when: an unknown method id, a non-number or an off-step slider value is kept.
    expect(parsed).toEqual({
      params: {
        ...CHANGED.params,
        paletteMethods: DEFAULT_PARAMS.paletteMethods,
        thresholds: DEFAULT_PARAMS.thresholds,
        maxImages: DEFAULT_PARAMS.maxImages,
        tolerance: DEFAULT_PARAMS.tolerance,
      },
      output: DEFAULT_OUTPUT,
    });
  });
});

describe('serializeSettings', () => {
  it('leaves out the forced palette', () => {
    const forced = { r: 0.5, g: 0.25, b: 1, weight: 3 };
    const text = serializeSettings({
      ...CHANGED,
      params: { ...CHANGED.params, forcedPalette: [forced] },
    });
    expect(text).toBe(serializeSettings(CHANGED));
    expect(parseSettings(text).params.forcedPalette).toBeNull();
  });
});

describe('isDefaultSettings', () => {
  it('is true for the defaults only', () => {
    expect(isDefaultSettings(DEFAULT_SETTINGS)).toBe(true);
    expect(isDefaultSettings(parseSettings(serializeSettings(DEFAULT_SETTINGS)))).toBe(true);
    expect(isDefaultSettings(CHANGED)).toBe(false);
    // fails-when: an output option or a forced palette is ignored.
    expect(
      isDefaultSettings({ ...DEFAULT_SETTINGS, output: { ...DEFAULT_OUTPUT, scale: '1' } }),
    ).toBe(false);
    expect(
      isDefaultSettings({
        ...DEFAULT_SETTINGS,
        params: { ...DEFAULT_PARAMS, forcedPalette: [{ r: 0, g: 0, b: 0, weight: 1 }] },
      }),
    ).toBe(false);
  });
});

describe('loadSettings and saveSettings', () => {
  it('round-trip through storage under the settings key', () => {
    const storage = memoryStorage();
    expect(loadSettings(() => storage)).toEqual(DEFAULT_SETTINGS);
    saveSettings(() => storage, CHANGED);
    expect(storage.getItem(SETTINGS_KEY)).toBe(serializeSettings(CHANGED));
    expect(loadSettings(() => storage)).toEqual(CHANGED);
  });

  it('use the defaults and keep the app running when storage is blocked', () => {
    const blocked = (): Storage => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS);
    expect(() => {
      saveSettings(blocked, CHANGED);
    }).not.toThrow();
  });
});
