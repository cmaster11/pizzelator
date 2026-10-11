import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import {
  cardPixels,
  collectErrors,
  PIZZA,
  setPaletteColors,
  setTargetSize,
  setThreshold,
} from './helpers';

/**
 * The adjustment rule written out independently of the app: the Filter Effects
 * saturate matrix, then the brightness scale, rounded and clamped once.
 */
function adjust(r: number, g: number, b: number, sat: number, bright: number): number[] {
  const s = 1 + sat / 100;
  const k = 1 + bright / 100;
  return [
    (0.213 + 0.787 * s) * r + (0.715 - 0.715 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 + 0.285 * s) * g + (0.072 - 0.072 * s) * b,
    (0.213 - 0.213 * s) * r + (0.715 - 0.715 * s) * g + (0.072 + 0.928 * s) * b,
  ].map((v) => Math.min(255, Math.max(0, Math.round(v * k))));
}

test('adjusts result pixels and their palette alike', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await setTargetSize(page, 64);
  await setPaletteColors(page, 8);
  await setThreshold(page, 0.6);
  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });

  const brightness = page.getByRole('slider', { name: 'Brightness' });
  const saturation = page.getByRole('slider', { name: 'Saturation' });
  await expect(brightness).toHaveAttribute('aria-valuenow', '20');
  await expect(saturation).toHaveAttribute('aria-valuenow', '10');
  const card = page.getByTestId('result-card').first();
  const [adjustedSrc, adjusted] = await cardPixels(card, null);

  // Both down to 0% in 5% steps: the run's own, unadjusted image.
  await brightness.focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowLeft');
  }
  await saturation.focus();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowLeft');
  }
  await expect(brightness).toHaveAttribute('aria-valuenow', '0');
  await expect(saturation).toHaveAttribute('aria-valuenow', '0');
  const [rawSrc, raw] = await cardPixels(card, adjustedSrc);

  // fails-when: an adjustment is skipped, or applied with another rule.
  const expected: number[] = [];
  for (let i = 0; i < raw.length; i += 4) {
    expected.push(
      ...adjust(raw[i] ?? 0, raw[i + 1] ?? 0, raw[i + 2] ?? 0, 10, 20),
      raw[i + 3] ?? 0,
    );
  }
  expect(adjusted).toEqual(expected);
  expect(adjusted).not.toEqual(raw);

  // Back to the defaults: the palette JSON holds exactly the colors in the adjusted image.
  await brightness.focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
  }
  await saturation.focus();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowRight');
  }
  const [, again] = await cardPixels(card, rawSrc);
  expect(again).toEqual(adjusted);
  const downloadPromise = page.waitForEvent('download');
  await card.getByRole('button', { name: 'Download palette JSON' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/_bright20_sat10\.palette\.json$/);
  const json = JSON.parse(await readFile(await download.path(), 'utf8')) as {
    Colors: { Color: { R: number; G: number; B: number } }[];
  };
  const key = (r: number, g: number, b: number): string => `${r},${g},${b}`;
  const paletteKeys = new Set(
    json.Colors.map(({ Color: c }) =>
      key(Math.round(c.R * 255), Math.round(c.G * 255), Math.round(c.B * 255)),
    ),
  );
  for (let i = 0; i < adjusted.length; i += 4) {
    const k = key(adjusted[i] ?? 0, adjusted[i + 1] ?? 0, adjusted[i + 2] ?? 0);
    expect(paletteKeys, `pixel color ${k} is in the palette`).toContain(k);
  }
  expect(errors).toEqual([]);
});
