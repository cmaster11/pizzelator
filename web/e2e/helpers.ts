import { fileURLToPath } from 'node:url';

import { expect, type Locator, type Page } from '@playwright/test';

/** The sample image: a square photo of a pizza. */
export const PIZZA = fileURLToPath(new URL('../../assets/pizza.png', import.meta.url));
export const PIZZA_SIZE = 1080;

/** Width and height from a PNG's IHDR chunk. */
export function pngSize(bytes: Buffer): [number, number] {
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

/** Collects page errors and console errors; a passing test expects none. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(`${msg.text()} ${msg.location().url}`);
    }
  });
  return errors;
}

/** Replaces the target sizes with one size. */
export async function setTargetSize(page: Page, size: number): Promise<void> {
  const sizes = page.getByRole('combobox', { name: 'Target sizes (px)' });
  await sizes.click();
  await page.keyboard.press('Backspace');
  await sizes.fill(String(size));
  await page.keyboard.press('Enter');
}

/** Picks "Custom" palette colors and enters a count. */
export async function setPaletteColors(page: Page, count: number): Promise<void> {
  await page.getByRole('radiogroup', { name: 'Palette colors' }).getByText('Custom').click();
  await page.getByLabel('Custom palette colors').fill(String(count));
}

/** Replaces the thresholds with one value. */
export async function setThreshold(page: Page, threshold: number): Promise<void> {
  await page.getByRole('button', { name: 'Clear all thresholds' }).click();
  const input = page.getByRole('combobox', { name: 'Thresholds' });
  await input.fill(String(threshold));
  await page.keyboard.press('Enter');
}

/** RGBA bytes of a result card's image as the browser decodes it. */
export async function cardPixels(
  card: Locator,
  previousSrc: string | null,
): Promise<[string, number[]]> {
  const img = card.getByRole('img', { name: /^Result / });
  await expect(img).toHaveAttribute('src', /^blob:/);
  if (previousSrc !== null) {
    await expect(img).not.toHaveAttribute('src', previousSrc);
  }
  const src = (await img.getAttribute('src')) ?? '';
  const pixels = await img.evaluate(async (el: HTMLImageElement) => {
    await el.decode();
    const canvas = new OffscreenCanvas(el.naturalWidth, el.naturalHeight);
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('no 2D context');
    }
    ctx.drawImage(el, 0, 0);
    return [...ctx.getImageData(0, 0, canvas.width, canvas.height).data];
  });
  return [src, pixels];
}
