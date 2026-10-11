import { expect, test } from '@playwright/test';

import { pngSize } from './helpers';

test('the header links to the source code and its author', async ({ page }) => {
  await page.goto('./');
  // fails-when: a link is missing, renamed or points anywhere else.
  await expect(page.getByRole('link', { name: 'Source code on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/cmaster11/pizzelator',
  );
  await expect(page.getByRole('link', { name: 'cmaster11' })).toHaveAttribute(
    'href',
    'https://github.com/cmaster11',
  );
});

test('the favicon is a 32 × 32 PNG served under the base path', async ({ page }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="icon"]').getAttribute('href');
  // fails-when: the icon link is missing, misses the base path or the file is not served.
  expect(href).toBe('/pizzelator/favicon.png');
  const response = await page.request.get(new URL(href ?? '', page.url()).toString());
  expect(response.status()).toBe(200);
  expect(pngSize(await response.body())).toEqual([32, 32]);
});

test('the KiCI link shows its hook when wide and fits the header when narrow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto('./');
  const kici = page.getByRole('link', { name: /^KiCI/ });
  await expect(kici).toHaveAttribute('href', 'https://kici.dev');
  await expect(kici).toHaveAccessibleName('KiCI: CI your LLM can develop and test autonomously');
  await expect(page.getByText('also by cmaster11 ·')).toBeVisible();

  await page.setViewportSize({ width: 390, height: 800 });
  await expect(kici).toHaveAccessibleName('KiCI');
  // fails-when: the header's contents overflow a phone-width screen.
  const header = page.getByRole('banner');
  const overflow = await header.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow).toBe(0);
});
