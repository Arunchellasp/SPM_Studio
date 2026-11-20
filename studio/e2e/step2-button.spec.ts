/** Step 2 · Button: variants, sizes, behaviour on the N00 Components screen. */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /N00 Dev/ }).click()
})

test('UI-2.1 five variants at the N00 demo size (150 × 40)', async ({ page }) => {
  for (const name of ['Primary', 'Default', 'Quiet', 'Ghost', 'Danger']) {
    const b = page.getByRole('button', { name, exact: true })
    await expect(b).toBeVisible()
    const box = await b.boundingBox()
    expect([box?.width, box?.height]).toEqual([150, 40])
  }
})

test('UI-2.2 variant colours match the design tokens', async ({ page }) => {
  const css = (name: string, prop: string) =>
    page.getByRole('button', { name, exact: true }).evaluate((e, p) => getComputedStyle(e).getPropertyValue(p), prop)
  expect(await css('Primary', 'background-color')).toBe('rgb(43, 95, 168)') // --accent
  expect(await css('Danger', 'color')).toBe('rgb(211, 47, 47)') // --p1
  expect(await css('Quiet', 'background-color')).toBe('rgb(238, 240, 242)') // --panel
  expect(await css('Primary', 'font-weight')).toBe('400')
})

test('UI-2.3 sizes are 28 / 32 / 36 / 40 px high', async ({ page }) => {
  for (const [s, h] of [
    ['sm', 28],
    ['md', 32],
    ['lg', 36],
    ['xl', 40]
  ] as const) {
    const box = await page
      .getByRole('button', { name: `Size ${s}` })
      .first()
      .boundingBox()
    expect(box?.height).toBe(h)
  }
})

test('UI-2.4 click counter and disabled reset', async ({ page }) => {
  const reset = page.getByRole('button', { name: 'Reset', exact: true }).last()
  await expect(reset).toBeDisabled()
  await page.getByRole('button', { name: 'Click me' }).click()
  await page.getByRole('button', { name: 'Click me' }).click()
  await expect(page.getByText('clicked 2×')).toBeVisible()
  await reset.click()
  await expect(page.getByText('clicked 0×')).toBeVisible()
})

test('UI-2.5 keyboard focus ring appears on Tab', async ({ page }) => {
  await page.getByRole('button', { name: 'Click me' }).focus()
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Tab')
  const outline = await page.getByRole('button', { name: 'Click me' }).evaluate((e) => getComputedStyle(e).outlineStyle)
  expect(outline).toBe('solid')
})
