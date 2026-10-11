import { expect, test } from '@playwright/test';

import { collectErrors, setTargetSize, setThreshold } from './helpers';

test('"Try the example" loads the city photo and paints it with the current settings', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('./');
  await setTargetSize(page, 16);
  await setThreshold(page, 0.6);
  await page.getByText('Tolerance (classic)', { exact: true }).click();

  await page.getByRole('button', { name: 'Try the example: a city street' }).click();
  await expect(page.getByText('city.jpg')).toBeVisible();
  await expect(page.getByText('3000 × 4000 px')).toBeVisible();
  // fails-when: the example does not start a run, or runs with other settings
  // (the defaults paint up to 360 images).
  await expect(page.getByTestId('run-summary')).toContainText('1 images · 1/1 runs', {
    timeout: 60_000,
  });
  await expect(page.getByTestId('run-summary')).toContainText('done in');
  await expect(page.getByTestId('result-section').getByRole('heading')).toContainText(
    '16px · HSLuv sat + lum @ 0.6 · clusters',
  );
  expect(errors).toEqual([]);
});

test('the example only loads when the settings cannot run', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'Clear all target sizes' }).click();
  await page.getByRole('button', { name: 'Try the example: a city street' }).click();
  await expect(page.getByText('3000 × 4000 px')).toBeVisible();
  // breaks-if-wrong: the image still loads, and the form says what to fix.
  await expect(page.getByText('Add at least one target size.')).toBeVisible();
  await expect(page.getByText('Set the parameters and press Paint.')).toBeVisible();
});
