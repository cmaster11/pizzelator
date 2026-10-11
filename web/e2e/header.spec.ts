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
