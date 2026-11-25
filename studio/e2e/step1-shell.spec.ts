/** Step 1 · window frame: header, rail, content, alarm banner. */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('UI-1.1 shell shows header, rail, content and banner at the design sizes', async ({ page }) => {
  const header = page.locator('.header')
  await expect(header).toContainText('SPM Studio')
  await expect(header).toContainText('Line 3 · Trim dispensing cell')
  expect((await header.boundingBox())?.height).toBe(56)
  expect((await page.locator('.rail').boundingBox())?.width).toBe(88)
  expect((await page.locator('.banner').boundingBox())?.height).toBe(36)
  // since step 14 the sample alarms are active, so the banner shows the top one (grey 'No active alarms' when empty: unit test)
  await expect(page.locator('.banner')).toContainText('E1202')
})

test('UI-1.2 rail lists N01–N10 (+ N00 Dev in development)', async ({ page }) => {
  const labels = await page.locator('.rail-item .rail-label').allTextContents()
  expect(labels.slice(0, 10)).toEqual(['Operate', 'Program', 'Tags', 'I/O', 'Motion', 'Recipes', 'Alarms', 'Trace', 'Data', 'Admin'])
  expect(labels).toContain('N00 Dev')
})

test('UI-1.3 clicking a rail item opens that screen and moves the highlight', async ({ page }) => {
  await page.getByRole('button', { name: /Tags/ }).click()
  await expect(page.locator('.content h1')).toContainText('N03')
  await expect(page.locator('.rail-item.active')).toContainText('Tags')
})

test('UI-1.4 mode switch selects one mode', async ({ page }) => {
  const manual = page.getByRole('radio', { name: 'Manual' })
  await manual.click()
  await expect(manual).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'false')
})

test('UI-1.5 machine commands are disabled without a runtime', async ({ page }) => {
  // since step 32 the browser simulator is a connected runtime: stop it first
  await page.evaluate(() => (window as unknown as { spmSim: { set(r: string): void } }).spmSim.set('stopped'))
  await expect(page.getByTestId('runtime-link')).toHaveText('OFFLINE')
  for (const name of ['Start', 'Hold', 'Stop', 'Reset']) {
    await expect(page.locator('.header-commands button', { hasText: name })).toBeDisabled()
  }
})

test('UI-1.6 state pill shows STOPPED and the clock ticks', async ({ page }) => {
  await expect(page.locator('.header .state-pill')).toHaveText('STOPPED')
  const clock = page.locator('.header-user .mono')
  const first = await clock.textContent()
  await expect(clock).not.toHaveText(first ?? '', { timeout: 3000 })
})
