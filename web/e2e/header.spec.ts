import { expect, test } from '@playwright/test';

import { pngSize } from './helpers';

test('the header links to the source code and its author', async ({ page }) => {
  await page.goto('./');
  // fails-when: a link is missing, renamed or points anywhere else.
  await expect(page.getByRole('link', { name: 'Star Pizzelator on GitHub' })).toHaveAttribute(
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

test('the KiCI link keeps its full text and the header fits at every width', async ({ page }) => {
  await page.goto('./');
  const kici = page.getByRole('link', { name: /^KiCI/ });
  const header = page.getByRole('banner');
  for (const width of [390, 1000, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    // fails-when: the link is shortened, doubled or missing at this width.
    await expect(kici).toHaveCount(1);
    await expect(kici).toHaveAccessibleName('KiCI: CI your LLM can develop and test autonomously');
    await expect(kici).toHaveAttribute('href', 'https://kici.dev');
    // fails-when: the header's contents spill out sideways or below its height.
    const fit = await header.evaluate((el) => {
      const content = el.firstElementChild?.getBoundingClientRect().height ?? Infinity;
      return { sideways: el.scrollWidth - el.clientWidth, below: content - el.clientHeight };
    });
    expect(fit.sideways, `width ${String(width)}`).toBe(0);
    expect(fit.below, `width ${String(width)}`).toBeLessThanOrEqual(1);
    // fails-when: the byline wraps to make room for the buttons.
    const lines = await page.getByTestId('byline').evaluate((el) => {
      return el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight);
    });
    expect(lines, `width ${String(width)}`).toBeLessThan(1.5);
  }
  await expect(page.getByText('also by cmaster11 ·').filter({ visible: true })).toHaveCount(1);
});
