import { expect, test } from '@playwright/test';

import { collectErrors, PIZZA } from './helpers';

test('"Clear all" empties the target sizes and the thresholds', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  const paint = page.getByRole('button', { name: /Paint/ });
  await expect(paint).toBeEnabled();

  for (const [what, error] of [
    ['thresholds', 'Add at least one threshold.'],
    ['target sizes', 'Add at least one target size.'],
  ] as const) {
    const clear = page.getByRole('button', { name: `Clear all ${what}` });
    await clear.click();
    // fails-when: the button leaves any entry in the field.
    await expect(page.getByText(error)).toBeVisible();
    await expect(paint).toBeDisabled();
    // Nothing is left to clear.
    await expect(clear).toBeDisabled();
  }
  expect(errors).toEqual([]);
});
