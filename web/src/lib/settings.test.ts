import { describe, expect, it } from 'vitest';

import { DEFAULT_PARAMS } from './params';
import {
  defaultSettings,
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
  output: { scale: 'original', display: '8', adjust: { brightness: -15, saturation: 0 } },
};

/** The defaults with a mouse; the ones most tests start from. */
const DEFAULTS = defaultSettings(false);

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
    expect(parseSettings(serializeSettings(CHANGED), DEFAULTS)).toEqual(CHANGED);
    expect(CHANGED.params).not.toEqual(DEFAULT_PARAMS);
    expect(CHANGED.output.display).not.toBe(DEFAULTS.output.display);
  });

  it('starts from the defaults with nothing saved or with text that is not JSON', () => {
    expect(parseSettings(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(parseSettings('{"params": ', DEFAULTS)).toEqual(DEFAULTS);
    expect(parseSettings('[1, 2]', DEFAULTS)).toEqual(DEFAULTS);
  });

  it('gives each missing or malformed field its default and keeps the rest', () => {
    const stored = JSON.parse(serializeSettings(CHANGED)) as {
      params: Record<string, unknown>;
      output: { scale: unknown; display: unknown; adjust: Record<string, unknown> };
    };
    stored.params.paletteMethods = ['lsd', 'gone'];
    stored.params.thresholds = [0.5, '0.6'];
    delete stored.params.maxImages;
    stored.params.tolerance = null;
    stored.output.scale = '3';
    stored.output.display = '1';
    stored.output.adjust.brightness = 7;
    stored.output.adjust.saturation = 55;

    const parsed = parseSettings(JSON.stringify(stored), DEFAULTS);
    // fails-when: an unknown method id, a non-number or an off-step slider value is kept.
    expect(parsed).toEqual({
      params: {
        ...CHANGED.params,
        paletteMethods: DEFAULT_PARAMS.paletteMethods,
        thresholds: DEFAULT_PARAMS.thresholds,
        maxImages: DEFAULT_PARAMS.maxImages,
        tolerance: DEFAULT_PARAMS.tolerance,
      },
      output: DEFAULTS.output,
    });
  });

  it("gives a missing display size this device's default", () => {
    // Settings saved before the display size existed.
    const stored = JSON.parse(serializeSettings(CHANGED)) as { output: Record<string, unknown> };
    delete stored.output.display;
    const text = JSON.stringify(stored);
    // fails-when: the display size ignores the device, or a saved one is dropped.
    expect(parseSettings(text, defaultSettings(false)).output.display).toBe('4');
    expect(parseSettings(text, defaultSettings(true)).output.display).toBe('fit');
    expect(parseSettings(serializeSettings(CHANGED), defaultSettings(true)).output.display).toBe(
      '8',
    );
  });
});

describe('defaultSettings', () => {
  it('starts touch screens at fit and a mouse at 4×, with every other setting alike', () => {
    expect(defaultSettings(true).output.display).toBe('fit');
    expect(defaultSettings(false).output.display).toBe('4');
    expect({ ...defaultSettings(true).output, display: '4' }).toEqual(
      defaultSettings(false).output,
    );
    expect(defaultSettings(true).params).toEqual(defaultSettings(false).params);
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
    expect(parseSettings(text, DEFAULTS).params.forcedPalette).toBeNull();
  });
});

describe('isDefaultSettings', () => {
  it('is true for the defaults only', () => {
    expect(isDefaultSettings(DEFAULTS, DEFAULTS)).toBe(true);
    expect(isDefaultSettings(parseSettings(serializeSettings(DEFAULTS), DEFAULTS), DEFAULTS)).toBe(
      true,
    );
    expect(isDefaultSettings(CHANGED, DEFAULTS)).toBe(false);
    // fails-when: an output option or a forced palette is ignored.
    expect(
      isDefaultSettings({ ...DEFAULTS, output: { ...DEFAULTS.output, scale: '1' } }, DEFAULTS),
    ).toBe(false);
    expect(
      isDefaultSettings({ ...DEFAULTS, output: { ...DEFAULTS.output, display: 'fit' } }, DEFAULTS),
    ).toBe(false);
    expect(
      isDefaultSettings(
        {
          ...DEFAULTS,
          params: { ...DEFAULT_PARAMS, forcedPalette: [{ r: 0, g: 0, b: 0, weight: 1 }] },
        },
        DEFAULTS,
      ),
    ).toBe(false);
    // Each device compares against its own defaults.
    expect(isDefaultSettings(defaultSettings(true), defaultSettings(true))).toBe(true);
    expect(isDefaultSettings(defaultSettings(true), defaultSettings(false))).toBe(false);
  });
});

describe('loadSettings and saveSettings', () => {
  it('round-trip through storage under the settings key', () => {
    const storage = memoryStorage();
    expect(loadSettings(() => storage, DEFAULTS)).toEqual(DEFAULTS);
    saveSettings(() => storage, CHANGED);
    expect(storage.getItem(SETTINGS_KEY)).toBe(serializeSettings(CHANGED));
    expect(loadSettings(() => storage, DEFAULTS)).toEqual(CHANGED);
  });

  it('use the defaults and keep the app running when storage is blocked', () => {
    const blocked = (): Storage => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    expect(loadSettings(blocked, DEFAULTS)).toEqual(DEFAULTS);
    expect(() => {
      saveSettings(blocked, CHANGED);
    }).not.toThrow();
  });
});
