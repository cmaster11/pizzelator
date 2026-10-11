import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

import { collectErrors, PIZZA, pngSize, setTargetSize, setThreshold } from './helpers';

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

test('the export menu copies and downloads one result at any scale', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await setTargetSize(page, 64);
  await setThreshold(page, 0.6);
  await page.getByText('Tolerance (classic)', { exact: true }).click();
  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });
  const card = page.getByTestId('result-card');
  await expect(card).toHaveCount(1);
  // At target 64 the pizza is 63 × 63 downsampled pixels (golden fixture pizza_lsd_cie94),
  // and the run's own download size stays at its 4× default throughout.

  await card.getByRole('button', { name: 'More export options' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Download PNG at 8×' }).click();
  const download = await downloadPromise;
  // fails-when: the menu ignores its scale and downloads at the run's 4×.
  expect(download.suggestedFilename()).toMatch(/_bright20_sat10_8x\.png$/);
  expect(pngSize(await readFile(await download.path()))).toEqual([504, 504]);

  await card.getByRole('button', { name: 'More export options' }).click();
  await page.getByRole('menuitem', { name: 'Copy PNG at 2×' }).click();
  await expect(card.getByTestId('result-caption')).toHaveText('Copied 2× PNG');
  const copied = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    if (item === undefined) {
      throw new Error('the clipboard is empty');
    }
    return [...new Uint8Array(await (await item.getType('image/png')).arrayBuffer())];
  });
  // fails-when: the copy writes no PNG, or one at another scale.
  expect(pngSize(Buffer.from(copied))).toEqual([126, 126]);
  // The caption returns after its few seconds.
  await expect(card.getByTestId('result-caption')).toHaveText('clusters', { timeout: 5000 });
  expect(errors).toEqual([]);
});

test('copying is disabled with a reason outside a secure context', async ({ page }) => {
  // As on a plain-http address other than localhost.
  await page.addInitScript(() => {
    Object.defineProperty(window, 'isSecureContext', { value: false });
  });
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await setTargetSize(page, 16);
  await setThreshold(page, 0.6);
  await page.getByText('Tolerance (classic)', { exact: true }).click();
  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });

  await page.getByRole('button', { name: 'More export options' }).click();
  await expect(page.getByText('Copying images needs https or localhost.')).toBeVisible();
  // fails-when: the copy entries stay enabled where the browser refuses to copy.
  await expect(page.getByRole('menuitem', { name: 'Copy PNG at 4×' })).toBeDisabled();
  // breaks-if-wrong: downloads must keep working there.
  await expect(page.getByRole('menuitem', { name: 'Download PNG at 4×' })).toBeEnabled();
});
