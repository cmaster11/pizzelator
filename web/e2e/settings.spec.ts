import { expect, test, type Page } from '@playwright/test';

import { collectErrors, PIZZA, setPaletteColors, setTargetSize, setThreshold } from './helpers';

/** The default run: 13 thresholds, each one cluster palette and up to 8 tolerance palettes. */
const DEFAULT_PAINT = 'Paint · up to 117 images';
/** Target 16, 8 colors, threshold 0.6, clusters only. */
const CHANGED_PAINT = 'Paint · up to 1 images';

async function paint(page: Page): Promise<void> {
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });
}

test('settings survive a reload until "Reset all settings"', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');
  const reset = page.getByRole('button', { name: 'Reset all settings' });
  const tolerance = page.getByRole('checkbox', { name: 'Tolerance (classic)' });
  const brightness = page.getByRole('slider', { name: 'Brightness' });
  const scale = page.getByRole('radiogroup', { name: 'Download scale' });
  await expect(page.getByRole('button', { name: /Paint/ })).toHaveText(DEFAULT_PAINT);
  await expect(reset).toBeDisabled();

  await setTargetSize(page, 16);
  await setPaletteColors(page, 8);
  await setThreshold(page, 0.6);
  await page.getByText('Tolerance (classic)', { exact: true }).click();
  await expect(page.getByRole('button', { name: /Paint/ })).toHaveText(CHANGED_PAINT);
  await expect(reset).toBeEnabled();
  await paint(page);
  await scale.getByText('2×').click();
  await brightness.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(brightness).toHaveAttribute('aria-valuenow', '15');

  await page.reload();
  // fails-when: a change is not saved, or the saved settings are not read on load.
  await expect(page.getByRole('button', { name: /Paint/ })).toHaveText(CHANGED_PAINT);
  await expect(tolerance).not.toBeChecked();
  await expect(page.getByLabel('Custom palette colors')).toHaveValue('8');
  await paint(page);
  // The restored settings reach the engine: one cluster palette, one image.
  await expect(page.getByTestId('run-summary')).toContainText('1 images · 1/1 runs');
  await expect(scale.getByRole('radio', { name: '2×' })).toBeChecked();
  await expect(brightness).toHaveAttribute('aria-valuenow', '15');

  await reset.click();
  // fails-when: a setting or the form's own state survives the reset.
  await expect(page.getByRole('button', { name: /Paint/ })).toHaveText(DEFAULT_PAINT);
  await expect(tolerance).toBeChecked();
  await expect(
    page.getByRole('radiogroup', { name: 'Palette colors' }).getByRole('radio', { name: '24' }),
  ).toBeChecked();
  await expect(page.getByLabel('Custom palette colors')).toHaveCount(0);
  await expect(scale.getByRole('radio', { name: '4×' })).toBeChecked();
  await expect(brightness).toHaveAttribute('aria-valuenow', '20');
  await expect(reset).toBeDisabled();

  await page.reload();
  // The reset itself is saved.
  await expect(page.getByRole('button', { name: /Paint/ })).toHaveText(DEFAULT_PAINT);
  await expect(reset).toBeDisabled();
  expect(errors).toEqual([]);
});
