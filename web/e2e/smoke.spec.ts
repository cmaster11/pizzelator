import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import {
  collectErrors,
  PIZZA,
  pngSize,
  setPaletteColors,
  setTargetSize,
  setThreshold,
} from './helpers';

test('paints an image and downloads a result at 4× and at original size', async ({ page }) => {
  const errors = collectErrors(page);

  // Relative, so it resolves under the base path in `baseURL`.
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await expect(page.getByText('1080 × 1080 px')).toBeVisible();

  await expect(
    page.getByRole('radiogroup', { name: 'Palette colors' }).getByRole('radio', { name: '24' }),
  ).toBeChecked();
  await setTargetSize(page, 64);
  await setPaletteColors(page, 8);
  await setThreshold(page, 0.6);
  await page.getByLabel('Initial tolerance').fill('0.02');

  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });

  // pizza.png at 64px with 8 colors, threshold 0.6, initial tolerance 0.02, CIE94
  // yields 4 distinct images from the tolerance search; the engine's golden
  // fixture pizza_lsd_cie94 pins the same case. The cluster search adds its
  // one palette.
  const sections = page.getByTestId('result-section');
  await expect(sections).toHaveCount(2);
  const clusters = sections.nth(0);
  const tolerance = sections.nth(1);
  await expect(clusters.getByRole('heading')).toContainText('· clusters ·');
  await expect(tolerance.getByRole('heading')).toContainText('· tolerance search ·');
  await expect(clusters.getByTestId('result-card')).toHaveCount(1);
  const cards = tolerance.getByTestId('result-card');
  await expect(cards).toHaveCount(4);
  await expect(page.getByTestId('run-summary')).toContainText('5 images · 2/2 runs');

  const downloadSize = async (): Promise<[number, number]> => {
    const downloadPromise = page.waitForEvent('download');
    await cards.first().getByRole('button', { name: 'Download PNG' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^pizza_t64_lsd0\.6_cie94_tol\d\.\d{6}_bright20_sat10\.png$/,
    );
    return pngSize(await readFile(await download.path()));
  };
  // The result is 63×63 downsampled pixels at step 17 (pizza_lsd_cie94). Downloads
  // default to 4×.
  expect(await downloadSize()).toEqual([252, 252]);
  await page.getByRole('radiogroup', { name: 'Download scale' }).getByText('Original size').click();
  expect(await downloadSize()).toEqual([1071, 1071]);

  const clusterDownload = page.waitForEvent('download');
  await clusters.getByRole('button', { name: 'Download PNG' }).click();
  expect((await clusterDownload).suggestedFilename()).toBe(
    'pizza_t64_lsd0.6_cluster_cie94_bright20_sat10.png',
  );

  expect(errors).toEqual([]);
});
