/** Step 13 · N01 station cards against the Improved design. */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('UI-13.1 six cards in a 3 × 2 grid, 284 px high, 16 px apart, 16 px below the top row', async ({ page }) => {
  const cards = page.locator('.station-card')
  await expect(cards).toHaveCount(6)
  const b = await Promise.all([0, 1, 2, 3].map((i) => cards.nth(i).boundingBox()))
  expect(b.map((x) => Math.round(x?.height ?? 0))).toEqual([284, 284, 284, 284])
  expect(Math.round((b[1]?.x ?? 0) - ((b[0]?.x ?? 0) + (b[0]?.width ?? 0)))).toBe(16) // gap in a row
  expect(Math.round((b[3]?.y ?? 0) - ((b[0]?.y ?? 0) + (b[0]?.height ?? 0)))).toBe(16) // gap between rows
  expect(b[3]?.x).toBe(b[0]?.x) // 4th card starts row 2
  const top = await page.locator('.batch-card').boundingBox()
  expect(Math.round((b[0]?.y ?? 0) - ((top?.y ?? 0) + (top?.height ?? 0)))).toBe(16)
})

test('UI-13.2 state pills 134 × 26 in the PackML colours (EXECUTE green, HELD amber, IDLE grey)', async ({ page }) => {
  const pill = (name: string) => page.getByRole('region', { name }).locator('.state-pill')
  const colour = async (name: string): Promise<string> => pill(name).evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(await colour('Station 1 · Load')).toBe('rgb(46, 125, 50)')
  expect(await colour('Station 2 · Plasma clean')).toBe('rgb(249, 168, 37)')
  expect(await colour('Station 4 · Unload')).toBe('rgb(96, 125, 139)')
  const box = await pill('Station 1 · Load').boundingBox()
  expect([box?.width, box?.height]).toEqual([134, 26])
})

test('UI-13.3 signal table fills the card; columns in the design proportion 220 : 160 : 178; dark header, zebra', async ({ page }) => {
  const t = page.getByRole('table', { name: 'Station 1 · Load signals' })
  const widths = await t.getByRole('columnheader').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
  const sum = widths.reduce((a, b) => a + b, 0)
  expect(widths.map((w) => Math.round((w / sum) * 558))).toEqual([220, 160, 178]) // same proportion as drawn
  const [card, table] = [await page.getByRole('region', { name: 'Station 1 · Load' }).boundingBox(), await t.boundingBox()]
  expect((table?.x ?? 0) + (table?.width ?? 0)).toBeLessThanOrEqual((card?.x ?? 0) + (card?.width ?? 0) - 16) // inside the 16 px padding
  expect(
    await t
      .locator('th')
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor)
  ).toBe('rgb(74, 85, 98)')
  expect(
    await t
      .locator('tbody tr')
      .nth(1)
      .evaluate((e) => getComputedStyle(e).backgroundColor)
  ).toBe('rgb(243, 246, 249)')
})

test('UI-13.4 station 2: "blocks step" row red, "timeout soon" row amber without ⓕ', async ({ page }) => {
  const t = page.getByRole('table', { name: 'Station 2 · Plasma clean signals' })
  const blocks = t.getByRole('row').filter({ hasText: 'blocks step' })
  const timeout = t.getByRole('row').filter({ hasText: 'timeout soon' })
  expect(await blocks.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(253, 226, 226)')
  expect(await timeout.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(255, 243, 205)')
  await expect(timeout).toContainText('12.4 s / 15 s')
  await expect(timeout.getByRole('img', { name: 'forced' })).toHaveCount(0)
})

test('UI-13.5 buttons 170 × 36, 12 px; Open sequence opens N02, Station I/O opens N04', async ({ page }) => {
  const card = page.getByRole('region', { name: 'Station 3 · Dispense' })
  const btn = card.getByRole('button', { name: 'Open sequence' })
  const box = await btn.boundingBox()
  expect([box?.width, box?.height]).toEqual([170, 36])
  expect(await btn.evaluate((e) => getComputedStyle(e).fontSize)).toBe('12px')
  await btn.click()
  await expect(page.locator('.content h1')).toContainText('N02')
  await page.getByRole('button', { name: /Operate/ }).click()
  await page.getByRole('region', { name: 'Station 3 · Dispense' }).getByRole('button', { name: 'Station I/O' }).click()
  await expect(page.locator('.content h1')).toContainText('N04')
})
