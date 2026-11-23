/** Step 14 · N01 alarm and event list + red banner with Ack (N01 complete). */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('UI-14.1 banner is red with the P1 alarm (diamond 1, code, text, time)', async ({ page }) => {
  const banner = page.locator('footer.banner')
  expect(await banner.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(247, 227, 227)')
  await expect(banner).toContainText('E1202 Plasma ready signal lost during cleaning (station 2) · 12:37:51 · 1 more active')
  await expect(banner.locator('.prio-1')).toHaveText('1')
})

test('UI-14.2 Ack in the banner disables it, the list row turns acked, an event is written', async ({ page }) => {
  const ack = page.getByRole('button', { name: 'Acknowledge E1202' })
  await expect(ack).toBeEnabled()
  await ack.click()
  await expect(ack).toBeDisabled()
  const table = page.getByRole('table', { name: 'Active alarms and events' })
  const row = table.getByRole('row').filter({ hasText: 'E1202' }).first()
  await expect(row).toContainText('Active · acked')
  await expect(row.getByRole('button', { name: 'Shelve 1 h' })).toBeVisible()
  await expect(table).toContainText('E1202 acknowledged by A. Engineer')
})

test('UI-14.3 alarm card: 1800 × 210, table 1670 with the design columns 60 / 120 / 170 / 900 / 220 / 200', async ({ page }) => {
  const card = page.getByRole('region', { name: /Active alarms \(2\)/ })
  const box = await card.boundingBox()
  expect([box?.width, box?.height]).toEqual([1800, 210])
  const table = card.getByRole('table')
  expect(Math.round((await table.boundingBox())?.width ?? 0)).toBe(1670)
  const widths = await table.getByRole('columnheader').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().width))
  const sum = widths.reduce((a, b) => a + b, 0)
  expect(widths.map((w) => Math.round((w / sum) * 1670))).toEqual([60, 120, 170, 900, 220, 200])
})

test('UI-14.4 rows in order P1, P3, event; only "Active · unacked" is red; P icons shape + number', async ({ page }) => {
  const rows = page.getByRole('table', { name: 'Active alarms and events' }).locator('tbody tr')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toContainText('E1202')
  await expect(rows.nth(1)).toContainText('W0310')
  await expect(rows.nth(2)).toContainText('Event')
  const stateBg = (i: number) =>
    rows
      .nth(i)
      .locator('td')
      .nth(4)
      .evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(await stateBg(0)).toBe('rgb(253, 226, 226)')
  expect(
    await rows
      .nth(0)
      .locator('td')
      .nth(3)
      .evaluate((e) => getComputedStyle(e).backgroundColor)
  ).not.toBe('rgb(253, 226, 226)')
  await expect(rows.nth(0).locator('.prio-1')).toHaveText('1')
  await expect(rows.nth(1).locator('.prio-3')).toHaveText('3')
})

test('UI-14.5 N01 complete: the whole screen fits 1920 × 1080 without scrolling', async ({ page }) => {
  const m = await page.locator('.content').evaluate((c) => [c.scrollHeight - c.clientHeight, c.scrollWidth - c.clientWidth])
  expect(m).toEqual([0, 0])
})

test('UI-14.6 Help and Shelve say where they will live (N07) instead of doing nothing', async ({ page }) => {
  await page.getByRole('table', { name: 'Active alarms and events' }).getByRole('button', { name: 'Help' }).click()
  await expect(page.locator('.toast', { hasText: 'Help for E1202 comes with N07 Alarms' })).toBeVisible()
})
