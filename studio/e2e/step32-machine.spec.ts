/** Step 32 · state, mode and commands from the runtime (browser simulator = the same PackML machine as the mock runtime). */
import { expect, test, type Locator, type Page } from '@playwright/test'

type SimWindow = Window & { spmSim: { set(r: string): void } }
const pill = (page: Page): Locator => page.locator('.header .state-pill')
const btn = (page: Page, name: string): Locator => page.locator('.header-commands button', { hasText: name })
const seg = (page: Page, name: string): Locator => page.getByRole('radiogroup', { name: 'Machine mode' }).getByRole('radio', { name })
async function on(page: Page, ...names: string[]): Promise<void> {
  for (const n of ['Start', 'Hold', 'Stop', 'Reset'])
    if (names.includes(n)) await expect(btn(page, n), `${n} on`).toBeEnabled()
    else await expect(btn(page, n), `${n} off`).toBeDisabled()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('runtime-link')).toHaveText('Online · 1.00 ms')
})

test('UI-32.1 STOPPED: only Reset; Reset → IDLE, Start → STARTING → EXECUTE; the tooltips say why a button is off', async ({ page }) => {
  await expect(pill(page)).toHaveText('STOPPED')
  await on(page, 'Reset')
  await expect(btn(page, 'Start')).toHaveAttribute('title', 'Start is not possible in STOPPED (only in IDLE or HELD)')
  await btn(page, 'Reset').click()
  await expect(pill(page)).toHaveText('RESETTING')
  await expect(pill(page)).toHaveText('IDLE')
  await on(page, 'Start', 'Stop')
  await btn(page, 'Start').click()
  await expect(pill(page)).toHaveText('STARTING')
  await expect(pill(page)).toHaveCSS('background-color', 'rgb(43, 95, 168)') // acting = blue
  await expect(pill(page)).toHaveText('EXECUTE')
  await expect(pill(page)).toHaveCSS('background-color', 'rgb(46, 125, 50)')
  await on(page, 'Hold', 'Stop')
  await expect(seg(page, 'Manual')).toBeDisabled() // no mode change while it runs
  await expect(seg(page, 'Manual')).toHaveAttribute('title', 'the mode can change only in STOPPED, IDLE or ABORTED (now EXECUTE)')
})

test('UI-32.2 Hold → HELD, Start continues → EXECUTE, Stop → STOPPING → STOPPED', async ({ page }) => {
  await btn(page, 'Reset').click()
  await expect(pill(page)).toHaveText('IDLE')
  await btn(page, 'Start').click()
  await expect(pill(page)).toHaveText('EXECUTE')
  await btn(page, 'Hold').click()
  await expect(pill(page)).toHaveText('HELD')
  await on(page, 'Start', 'Stop')
  await btn(page, 'Start').click()
  await expect(pill(page)).toHaveText('EXECUTE')
  await btn(page, 'Stop').click()
  await expect(pill(page)).toHaveText('STOPPING')
  await expect(pill(page)).toHaveText('STOPPED')
  await on(page, 'Reset')
})

test('UI-32.3 the mode comes from the runtime: Manual while stopped; offline → all off, last state faded', async ({ page }) => {
  await seg(page, 'Manual').click()
  await expect(seg(page, 'Manual')).toHaveAttribute('aria-checked', 'true')
  await seg(page, 'Auto').click()
  await expect(seg(page, 'Auto')).toHaveAttribute('aria-checked', 'true')
  await btn(page, 'Reset').click()
  await expect(pill(page)).toHaveText('IDLE')
  await page.evaluate(() => (window as unknown as SimWindow).spmSim.set('stopped'))
  await expect(page.getByTestId('runtime-link')).toHaveText('OFFLINE')
  await on(page)
  await expect(btn(page, 'Stop')).toHaveAttribute('title', 'Runtime OFFLINE — no commands')
  await expect(pill(page)).toHaveText('IDLE')
  await expect(pill(page)).toHaveCSS('opacity', '0.45')
  await expect(pill(page)).toHaveAttribute('title', 'IDLE — last known state, the runtime is not connected')
  await expect(seg(page, 'Manual')).toBeDisabled()
  await page.evaluate(() => (window as unknown as SimWindow).spmSim.set('running'))
  await expect(pill(page)).toHaveCSS('opacity', '1', { timeout: 6000 })
  await on(page, 'Start', 'Stop')
})
