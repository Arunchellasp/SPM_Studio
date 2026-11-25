/** Step 31 · runtime link in the header: Online with the cycle time; OFFLINE within 3 s when the runtime stops or hangs; back when it returns. */
import { expect, test, type Locator, type Page } from '@playwright/test'

type SimWindow = Window & { spmSim: { set(r: string): void } } // the browser simulator's control (src/renderer/src/dev/sim-api.ts)

const link = (page: Page): Locator => page.getByTestId('runtime-link')
const runtime = (page: Page, r: 'running' | 'stopped' | 'hung'): Promise<void> => page.evaluate((x) => (window as unknown as SimWindow).spmSim.set(x), r)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(link(page)).toHaveText('Online · 1.00 ms')
})

test('UI-31.1 online: green dot, cycle time; the tooltip names the runtime and the max cycle', async ({ page }) => {
  await expect(link(page)).toHaveAttribute('data-link', 'online')
  await expect(link(page)).toHaveAttribute('title', /^Runtime online at simulator \(browser\)\nversion 0\.0\.0-sim\ncycle 1\.00 ms · max 1\.\d\d ms$/)
  await expect(link(page).locator('.link-dot')).toHaveCSS('background-color', 'rgb(46, 125, 50)') // --st-execute green
})

test('UI-31.2 runtime stopped → OFFLINE within 3 s, stays OFFLINE while retrying, Online again after a restart', async ({ page }) => {
  const stop = page.getByRole('button', { name: 'Stop' })
  const before = await stop.boundingBox()
  await runtime(page, 'stopped')
  await expect(link(page)).toHaveText('OFFLINE', { timeout: 3000 })
  expect(await stop.boundingBox()).toEqual(before) // the chip keeps its width: nothing in the header moves
  await expect(link(page)).toHaveAttribute('title', /No runtime at simulator \(browser\) — retrying\nconnect ECONNREFUSED/)
  await expect(link(page)).toHaveCSS('background-color', 'rgb(211, 47, 47)') // red chip (--st-aborted)
  await page.waitForTimeout(1600) // two retries
  await expect(link(page)).toHaveText('OFFLINE')
  await runtime(page, 'running')
  await expect(link(page)).toHaveText('Online · 1.00 ms', { timeout: 6000 }) // next retry: at most 5 s apart
})

test('UI-31.3 runtime hangs (no answer) → OFFLINE within 3 s, with "heartbeat lost"; on every screen', async ({ page }) => {
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await runtime(page, 'hung')
  await expect(link(page)).toHaveText('OFFLINE', { timeout: 3000 })
  await expect(link(page)).toHaveAttribute('title', /no answer for 2\.5 s \(heartbeat lost\)/)
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await expect(link(page)).toHaveText('OFFLINE')
  await runtime(page, 'running')
  await expect(link(page)).toHaveText('Online · 1.00 ms', { timeout: 6000 })
})
