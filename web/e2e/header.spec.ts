import { expect, test } from '@playwright/test';

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
