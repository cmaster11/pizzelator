import { expect, test } from '@playwright/test';

import { cardPixels, collectErrors, PIZZA, setTargetSize, setThreshold } from './helpers';

/** FNV-1a 64 over the RGB bytes of RGBA pixels, as engine/tests/cluster.rs computes it. */
function rgbHash(rgba: number[]): string {
  let h = 14695981039346656037n;
  for (let i = 0; i < rgba.length; i += 4) {
    for (const v of rgba.slice(i, i + 3)) {
      h ^= BigInt(v);
      h = (h * 1099511628211n) & 0xffffffffffffffffn;
    }
  }
  return h.toString(16).padStart(16, '0');
}

test('the cluster search paints the same pixels as the native engine', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await setTargetSize(page, 64);
  await setThreshold(page, 0.8);
  // The chip's checkbox is visually hidden; a user clicks its label.
  await page.getByText('Tolerance (classic)', { exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Tolerance (classic)' })).not.toBeChecked();
  await expect(page.getByRole('button', { name: /Paint/ })).toHaveText('Paint · up to 1 images');
  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });

  const section = page.getByTestId('result-section');
  await expect(section).toHaveCount(1);
  await expect(section.getByRole('heading')).toHaveText(
    '64px · HSLuv sat + lum @ 0.8 · clusters · CIE94',
  );
  const card = section.getByTestId('result-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('clusters');
  await expect(card.getByLabel('24-color palette')).toBeVisible();

  // Unadjusted, the card shows the engine's own pixels.
  const [adjustedSrc] = await cardPixels(card, null);
  await page.getByRole('slider', { name: 'Brightness' }).focus();
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowLeft');
  }
  await page.getByRole('slider', { name: 'Saturation' }).focus();
  for (let i = 0; i < 2; i++) {
    await page.keyboard.press('ArrowLeft');
  }
  const [, pixels] = await cardPixels(card, adjustedSrc);
  // The literal pinned by engine/tests/cluster.rs (matches_the_pinned_redraw),
  // computed natively: WASM in the browser must give the same pixels.
  // fails-when: the clustering's arithmetic or order differs between WASM and native.
  expect(rgbHash(pixels)).toBe('26204cbdfb4e6ce3');
  expect(errors).toEqual([]);
});
