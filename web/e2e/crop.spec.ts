import { readFile } from 'node:fs/promises';

import { expect, test, type Page } from '@playwright/test';

import {
  collectErrors,
  PIZZA,
  PIZZA_SIZE,
  pngSize,
  setPaletteColors,
  setTargetSize,
  setThreshold,
} from './helpers';

const TARGET = 32;

interface Point {
  x: number;
  y: number;
}

type Drag = (page: Page, from: Point, to: Point) => Promise<void>;

const mouseDrag: Drag = async (page, from, to) => {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
};

/** Real touch input through the DevTools protocol, which Chromium turns into touch pointer events. */
const touchDrag: Drag = async (page, from, to) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
  for (let i = 1; i <= 10; i++) {
    const at = { x: from.x + ((to.x - from.x) * i) / 10, y: from.y + ((to.y - from.y) * i) / 10 };
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [at] });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

/** The engine's block size for a target size, computed here independently of the app. */
function stepFor(width: number, height: number, target: number): number {
  const step = Math.ceil(Math.min(width, height) / target);
  return step % 2 === 0 ? step + 1 : step;
}

async function paintsTheSelectedArea(page: Page, drag: Drag): Promise<void> {
  const errors = collectErrors(page);
  await page.goto('./');
  await page.locator('input[type=file]').first().setInputFiles(PIZZA);
  await expect(page.getByTestId('painted-area')).toHaveText('Painting the whole image');

  await page.getByRole('button', { name: 'Select area' }).click();
  const dialog = page.getByRole('dialog', { name: 'Select the area to paint' });
  const box = await dialog.getByRole('img', { name: 'Image to crop' }).boundingBox();
  expect(box).not.toBeNull();
  if (box === null) {
    return;
  }
  // From 10%, 10% to 60%, 70% of the image: half its width, 60% of its height.
  await drag(
    page,
    { x: box.x + box.width * 0.1, y: box.y + box.height * 0.1 },
    { x: box.x + box.width * 0.6, y: box.y + box.height * 0.7 },
  );
  const text = (await dialog.getByTestId('crop-size').textContent()) ?? '';
  const match = /^(\d+) × (\d+) px at (\d+), (\d+)$/.exec(text);
  expect(match, `crop size text: ${text}`).not.toBeNull();
  const [w, h, x, y] = (match ?? []).slice(1).map(Number) as [number, number, number, number];
  // Within two screen pixels, measured in source pixels of the scaled-down preview.
  const slack = Math.ceil((2 * PIZZA_SIZE) / Math.min(box.width, box.height));
  expect(Math.abs(w - PIZZA_SIZE * 0.5)).toBeLessThanOrEqual(slack);
  expect(Math.abs(h - PIZZA_SIZE * 0.6)).toBeLessThanOrEqual(slack);

  await dialog.getByRole('button', { name: 'Use this area' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId('painted-area')).toHaveText(
    `Painting ${w} × ${h} px at ${x}, ${y}`,
  );

  await setTargetSize(page, TARGET);
  await setPaletteColors(page, 8);
  await setThreshold(page, 0.6);

  await page.getByRole('button', { name: /Paint/ }).click();
  await expect(page.getByTestId('run-summary')).toContainText('done in', { timeout: 60_000 });
  await page.getByRole('radiogroup', { name: 'Download scale' }).getByText('Original size').click();

  const downloadPromise = page.waitForEvent('download');
  await page
    .getByTestId('result-card')
    .first()
    .getByRole('button', { name: 'Download PNG' })
    .click();
  const download = await downloadPromise;
  // fails-when: the run paints the whole 1080 × 1080 image instead of the area.
  const step = stepFor(w, h, TARGET);
  expect(pngSize(await readFile(await download.path()))).toEqual([
    Math.floor(w / step) * step,
    Math.floor(h / step) * step,
  ]);
  expect(download.suggestedFilename()).toMatch(
    new RegExp(`^pizza_crop${x}-${y}-${w}x${h}_t${TARGET}_`),
  );
  expect(errors).toEqual([]);
}

test('paints only the area selected with a mouse', async ({ page }) => {
  await paintsTheSelectedArea(page, mouseDrag);
});

test.describe('on a touch screen', () => {
  test.use({ hasTouch: true });

  test('paints only the area selected by touch', async ({ page }) => {
    await paintsTheSelectedArea(page, touchDrag);
  });
});
