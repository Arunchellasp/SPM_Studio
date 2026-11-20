/** Step 12 · N01 batch card and why-not-faster card against the Improved design. */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/') // N01 is the start screen
})

test('UI-12.1 top row like the design: 1200 × 120 + 16 + 584 × 120', async ({ page }) => {
  const [b, w] = [await page.locator('.batch-card').boundingBox(), await page.locator('.why-card').boundingBox()]
  expect([b?.width, b?.height, w?.width, w?.height]).toEqual([1200, 120, 584, 120])
  expect(Math.round((w?.x ?? 0) - ((b?.x ?? 0) + (b?.width ?? 0)))).toBe(16)
})

test('UI-12.2 progress bar 900 × 14, fill 72 px = 4 / 50 = 8 %, colours from the design', async ({ page }) => {
  const bar = page.getByRole('progressbar', { name: 'Batch progress' })
  const fill = page.locator('.batch-bar-fill')
  const [bb, fb] = [await bar.boundingBox(), await fill.boundingBox()]
  expect([bb?.width, bb?.height, fb?.width]).toEqual([900, 14, 72])
  expect(await bar.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderRadius])).toEqual([
    'rgb(238, 240, 242)',
    '7px'
  ])
  expect(await fill.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(43, 95, 168)')
})

test('UI-12.3 title 16 px with bold "Batch"; KPI line 14 px grey with bold values', async ({ page }) => {
  const title = page.locator('.batch-title')
  await expect(title).toHaveText('Batch A-12 · Trim dispensing · 4 / 50 parts')
  expect(await title.evaluate((e) => getComputedStyle(e).fontSize)).toBe('16px')
  expect(await title.locator('b').evaluate((e) => getComputedStyle(e).fontWeight)).toBe('700')
  const kpis = page.getByTestId('batch-kpis')
  await expect(kpis).toHaveText('Cycle time 4.85 s (target 4.50) · Yield 98.9 % · OEE 80.5 % · Next: tray change in 6 parts')
  expect(await kpis.evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).color])).toEqual(['14px', 'rgb(95, 102, 112)'])
  expect(await kpis.locator('b').allTextContents()).toEqual(['4.85 s', '98.9 %', '80.5 %'])
})

test('UI-12.4 why-not-faster: bold 14 px title, grey 13 px text from the trace data', async ({ page }) => {
  const card = page.getByRole('region', { name: 'Why not faster?' })
  await expect(card.locator('.why-text')).toHaveText(
    'Station 2 waits for robot 1.7 s per part (35 %). Suggestion: dual gripper. (from trace analysis)'
  )
  expect(await card.locator('.why-text').evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).color])).toEqual([
    '13px',
    'rgb(95, 102, 112)'
  ])
})

test.describe('1366 × 768', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  test('UI-12.5 at 1366 the bar still shows 8 % (fill ÷ bar)', async ({ page }) => {
    await page.goto('/')
    const [bb, fb] = [await page.locator('.batch-bar').boundingBox(), await page.locator('.batch-bar-fill').boundingBox()]
    expect(Math.round(((fb?.width ?? 0) / (bb?.width ?? 1)) * 100)).toBe(8)
  })
})
