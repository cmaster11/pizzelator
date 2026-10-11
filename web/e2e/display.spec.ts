import { expect, test, type Page } from '@playwright/test';

import { collectErrors, PIZZA, setPaletteColors, setTargetSize, setThreshold } from './helpers';

/** Paints the pizza at one target size. */
async function paint(page: Page, size: number): Promise<void> {
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await setTargetSize(page, size);
  await setPaletteColors(page, 8);
  await setThreshold(page, 0.6);
  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });
}

/** CSS pixels per result pixel in the first result as shown. */
async function shownScale(page: Page): Promise<number> {
  const img = page
    .getByTestId('result-card')
    .first()
    .getByRole('img', { name: /^Result / });
  await expect(img).toHaveAttribute('src', /^blob:/);
  return img.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    return el.getBoundingClientRect().width / el.naturalWidth;
  });
}

test.describe('with a mouse', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('fixed display sizes keep their size when the window changes, Fit follows it', async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto('./');
    await paint(page, 64);
    const display = page.getByRole('radiogroup', { name: 'Display scale' });
    await expect(display.getByRole('radio', { name: '4×' })).toBeChecked();
    // fails-when: the default is not 4× with a mouse, or 4× is not 4 CSS pixels per result pixel.
    expect(await shownScale(page)).toBe(4);
    await page.setViewportSize({ width: 1000, height: 900 });
    // fails-when: the size follows the window.
    expect(await shownScale(page)).toBe(4);

    await display.getByText('2×').click();
    expect(await shownScale(page)).toBe(2);
    await display.getByText('8×').click();
    expect(await shownScale(page)).toBe(8);

    // Fit does follow the window, so the checks above could tell the two apart.
    await display.getByText('Fit').click();
    const narrow = await shownScale(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect.poll(() => shownScale(page)).not.toBe(narrow);

    await page.reload();
    await paint(page, 64);
    await expect(display.getByRole('radio', { name: 'Fit' })).toBeChecked();
    expect(errors).toEqual([]);
  });

  test('a result wider than the window scrolls inside its card, not the page', async ({ page }) => {
    const errors = collectErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('./');
    await paint(page, 64);
    await page.getByRole('radiogroup', { name: 'Display scale' }).getByText('8×').click();
    expect(await shownScale(page)).toBe(8);
    // The card section that holds the image.
    const section = page
      .getByTestId('result-card')
      .first()
      .getByRole('img', { name: /^Result / })
      .locator('xpath=..');
    // fails-when: the card grows past the window and the page scrolls sideways.
    expect(
      await section.evaluate((el) => el.scrollWidth > el.clientWidth && el.clientWidth < 390),
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    expect(errors).toEqual([]);
  });
});

test.describe('on a touch screen', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('results start at Fit, and "Reset all settings" keeps Fit', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('./');
    const reset = page.getByRole('button', { name: 'Reset all settings' });
    // fails-when: a touch screen is compared against the mouse defaults.
    await expect(reset).toBeDisabled();
    await paint(page, 64);
    const display = page.getByRole('radiogroup', { name: 'Display scale' });
    await expect(display.getByRole('radio', { name: 'Fit' })).toBeChecked();
    await display.getByText('4×').click();
    expect(await shownScale(page)).toBe(4);

    await reset.click();
    await expect(display.getByRole('radio', { name: 'Fit' })).toBeChecked();
    await expect(reset).toBeDisabled();
    expect(errors).toEqual([]);
  });
});
