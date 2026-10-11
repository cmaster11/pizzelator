import { expect, test, type Locator, type Page } from '@playwright/test';

import { collectErrors, PIZZA, setPaletteColors, setTargetSize, setThreshold } from './helpers';

const FORM_TOPICS = [
  'target sizes',
  'palette colors',
  'palette search',
  'max images',
  'palette methods',
  'thresholds',
  'redraw methods',
  'tolerance',
  'forced palette',
];

/** The block a "Learn more" toggle controls, found through its aria-controls. */
async function helpBlock(page: Page, toggle: Locator): Promise<Locator> {
  const id = await toggle.getAttribute('aria-controls');
  expect(id).not.toBeNull();
  return page.locator(`[id="${id ?? ''}"]`);
}

/** Opens and closes one help block, checking it shows `expected` only while open. */
async function togglesHelp(page: Page, about: string, expected: RegExp): Promise<void> {
  const toggle = page.getByRole('button', { name: `Learn more about ${about}` });
  const block = await helpBlock(page, toggle);
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(block).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  // fails-when: the toggle does not expand the block it names in aria-controls.
  await expect(block).toBeVisible();
  await expect(block).toContainText(expected);
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(block).toBeHidden();
}

test('every setting has a help block that opens and closes', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./');

  const toggles = page.getByRole('button', { name: /^Learn more about / });
  // fails-when: a setting loses its help block, or one is added without updating this list.
  await expect(toggles).toHaveCount(FORM_TOPICS.length);
  for (const [i, about] of FORM_TOPICS.entries()) {
    await expect(toggles.nth(i)).toHaveAccessibleName(`Learn more about ${about}`);
  }
  await togglesHelp(page, 'thresholds', /0 takes the dullest, darkest color/);
  await togglesHelp(page, 'tolerance', /The search only moves up/);

  // fails-when: any block stays empty or does not collapse again.
  for (const about of FORM_TOPICS) {
    await togglesHelp(page, about, /\w{3,}/);
  }

  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await setTargetSize(page, 32);
  await setPaletteColors(page, 8);
  await setThreshold(page, 0.6);
  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });
  await togglesHelp(page, 'output options', /without painting again/);
  expect(errors).toEqual([]);
});
