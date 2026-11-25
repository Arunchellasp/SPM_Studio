/** Step 33 · live alarms: banner, N01 and N07 fed by the runtime's alarm events; Ack sent to the runtime. */
import { expect, test, type Locator, type Page } from '@playwright/test'

type Sim = { spmSim: { set(r: string): void; raise(c: string): void; clear(c: string): void } }
const sim = (page: Page, fn: 'raise' | 'clear' | 'set', arg: string): Promise<void> =>
  page.evaluate(([f, a]) => (window as unknown as Sim).spmSim[f as 'raise'](a!), [fn, arg])
const banner = (page: Page): Locator => page.locator('footer.banner')
const n07 = (page: Page): Locator => page.getByRole('table', { name: 'Active alarms', exact: true })
const rowOf = (t: Locator, code: string): Locator => t.getByRole('row').filter({ hasText: code })
async function openN07(page: Page): Promise<void> {
  await page.locator('.rail-item', { hasText: 'Alarms' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('runtime-link')).toHaveText('Online · 1.00 ms')
})

test('UI-33.1 N07 lists the runtime alarms like the banner (P1 first); the other tabs wait for step 41', async ({ page }) => {
  await openN07(page)
  await expect(page.getByRole('tab', { name: 'Active (2)' })).toHaveAttribute('aria-selected', 'true')
  for (const t of ['History', 'Top 10', 'Shelved']) {
    await expect(page.getByRole('tab', { name: t })).toBeDisabled()
    await expect(page.getByRole('tab', { name: t })).toHaveAttribute('title', /step 41/)
  }
  await expect(n07(page).getByRole('row').nth(1)).toContainText('E1202')
  await expect(n07(page).getByRole('row').nth(2)).toContainText('W0310')
  await expect(rowOf(n07(page), 'E1202')).toContainText('Active · unacked')
  await expect(banner(page)).toContainText('E1202')
})

test('UI-33.2 a new alarm from the runtime appears in the banner and on N07 at once; Ack on N07 acks it everywhere', async ({ page }) => {
  await openN07(page)
  await page.getByRole('button', { name: 'Ack E1202' }).click() // the old one first
  await expect(rowOf(n07(page), 'E1202')).toContainText('Active · acked')
  await expect(banner(page).getByRole('button', { name: 'Acknowledge E1202' })).toBeDisabled()
  await sim(page, 'clear', 'E1202') // acked + cleared → gone
  await expect(page.getByRole('tab', { name: 'Active (1)' })).toBeVisible()
  // the machine runs, then the runtime raises the P1 alarm: it aborts, banner and N07 show it on top
  await page.locator('.header-commands button', { hasText: 'Reset' }).click()
  await expect(page.locator('.header .state-pill')).toHaveText('IDLE')
  await page.locator('.header-commands button', { hasText: 'Start' }).click()
  await expect(page.locator('.header .state-pill')).toHaveText('EXECUTE')
  await sim(page, 'raise', 'E1202')
  await expect(banner(page)).toContainText('E1202 Plasma ready signal lost during cleaning (station 2)')
  await expect(page.getByRole('tab', { name: 'Active (2)' })).toBeVisible()
  await expect(n07(page).getByRole('row').nth(1)).toContainText('Active · unacked')
  await expect(page.locator('.header .state-pill')).toHaveText('ABORTED')
  await page.getByRole('button', { name: 'Ack E1202' }).click()
  await expect(rowOf(n07(page), 'E1202')).toContainText('Active · acked')
  // N01 shows the same, with the event lines written from the runtime's events
  await page.locator('.rail-item', { hasText: 'Operate' }).click()
  const n01 = page.getByRole('table', { name: 'Active alarms and events' })
  await expect(rowOf(n01, 'E1202').first()).toContainText('Active · acked')
  await expect(n01).toContainText('E1202 cleared')
  await expect(n01).toContainText('E1202 acknowledged by A. Engineer')
})

test('UI-33.3 cleared before Ack: stays as "Cleared · unacked" until acknowledged; offline: Ack off with the reason', async ({ page }) => {
  await openN07(page)
  await sim(page, 'clear', 'E1202')
  await expect(rowOf(n07(page), 'E1202')).toContainText('Cleared · unacked')
  await sim(page, 'set', 'stopped')
  await expect(page.getByTestId('runtime-link')).toHaveText('OFFLINE')
  await expect(page.getByRole('button', { name: 'Ack E1202' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Ack E1202' })).toHaveAttribute('title', 'Runtime OFFLINE — acknowledge when it is back')
  await expect(page.locator('.n07-note')).toHaveText('Runtime OFFLINE — this is the last list received; it may be old.')
  await sim(page, 'set', 'running')
  await expect(page.getByRole('button', { name: 'Ack E1202' })).toBeEnabled({ timeout: 6000 })
  await page.getByRole('button', { name: 'Ack E1202' }).click()
  await expect(page.getByRole('tab', { name: 'Active (1)' })).toBeVisible()
  await expect(rowOf(n07(page), 'E1202')).toHaveCount(0)
})
