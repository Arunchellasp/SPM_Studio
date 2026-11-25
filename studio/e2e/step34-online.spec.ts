/** Step 34 · online flow: Download the saved program, Start — the live step glows on N02 and follows the sequence. */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { stableBox } from './support/stable-box'

const pal = (page: Page, t: string): Locator => page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: t, exact: true })
const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`)
const status = (page: Page): Locator => page.getByTestId('seq-status')
const download = (page: Page): Locator => page.locator('.seq-tree').getByRole('button', { name: 'Download' })
const header = (page: Page, b: string): Locator => page.locator('.header-commands button', { hasText: b })
const glowOn = (page: Page, id: string): Locator => node(page, id).getByTestId('live-step')
async function field(page: Page, label: string, value: string): Promise<void> {
  const f = page.locator('.seq-props').getByLabel(label, { exact: true })
  await f.fill(value)
  await f.press('Enter')
}
async function link(page: Page, from: string, to: string): Promise<void> {
  const a = await stableBox(node(page, from).locator('.react-flow__handle.source'))
  const b = await stableBox(node(page, to))
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + 8, { steps: 10 })
  await page.mouse.up()
}
/** Start → Wait input DI_S1_PartPresent (n1) → Set output DO_S1_ClampValve (n2) → End, saved */
async function savedFlow(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.getByTestId('runtime-link')).toHaveText('Online · 1.00 ms')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByTestId('project-name')).toHaveText('demo')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await pal(page, 'Wait input').click() // n1
  await field(page, 'Input', 'DI_S1_PartPresent')
  await pal(page, 'Set output').click() // n2
  await field(page, 'Output', 'DO_S1_ClampValve')
  await page.locator('.react-flow__controls-fitview').click()
  await link(page, 'start', 'n1')
  await link(page, 'n1', 'n2')
  await link(page, 'n2', 'end')
  await expect(page.getByTestId('seq-problems')).toHaveText('✓ no problems')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(status(page)).toHaveText('Online · no program')
}

test('UI-34.1 Download, Reset, Start: the live step glows and follows the sequence; values under the nodes', async ({ page }) => {
  await savedFlow(page)
  await expect(download(page)).toBeEnabled()
  await download(page).click()
  await expect(page.getByRole('status').filter({ hasText: /Downloaded to the runtime · 1 flow · CRC [0-9A-F]{8}/ })).toBeVisible()
  await expect(status(page)).toHaveText('Online · start')
  await expect(glowOn(page, 'start')).toBeVisible()
  await expect(node(page, 'n1').getByTestId('live-n1')).toHaveText('DI_S1_PartPresent = –')
  await header(page, 'Reset').click()
  await expect(page.locator('.header .state-pill')).toHaveText('IDLE')
  await header(page, 'Start').click()
  // the sequence: Start → n1 (waits for its input) → n2 → End → Start again (the next part)
  await expect(glowOn(page, 'n1')).toBeVisible()
  await expect(status(page)).toHaveText('Online · n1')
  await expect(glowOn(page, 'start')).toHaveCount(0)
  await expect(glowOn(page, 'n2')).toBeVisible({ timeout: 4000 })
  await expect(node(page, 'n1').getByTestId('live-n1')).toHaveText('DI_S1_PartPresent = TRUE')
  await expect(node(page, 'n2').getByTestId('live-n2')).toHaveText('DO_S1_ClampValve = TRUE') // set on entry
  await expect(glowOn(page, 'end')).toBeVisible({ timeout: 4000 })
  await expect(node(page, 'n2').getByTestId('live-n2')).toHaveText('DO_S1_ClampValve = TRUE')
  await expect(glowOn(page, 'n1')).toBeVisible({ timeout: 4000 }) // round again
  await expect(page.locator('[data-testid="live-step"]')).toHaveCount(1) // only one node glows
  await header(page, 'Hold').click()
  await expect(page.locator('.header .state-pill')).toHaveText('HELD')
  const held = await status(page).textContent()
  await page.waitForTimeout(1500)
  await expect(status(page)).toHaveText(held!) // held: the step does not move
})

test('UI-34.2 Download says why it is off: unsaved, running, offline; a changed program stops the glow', async ({ page }) => {
  await savedFlow(page)
  await download(page).click()
  await expect(status(page)).toHaveText('Online · start')
  await header(page, 'Reset').click()
  await expect(page.locator('.header .state-pill')).toHaveText('IDLE')
  await expect(download(page)).toBeDisabled()
  await expect(download(page)).toHaveAttribute('title', 'Download only in STOPPED (now IDLE) — press Stop first')
  await header(page, 'Stop').click()
  await expect(page.locator('.header .state-pill')).toHaveText('STOPPED')
  // change the drawing: unsaved → no download; the status says the canvas differs from the download
  await node(page, 'n2').click()
  await field(page, 'Output', 'DO_S1_Vacuum')
  await expect(download(page)).toHaveAttribute('title', 'Save first (Ctrl+S): the runtime gets the saved program.json')
  await expect(status(page)).toHaveText('Online · start · changed')
  // saved: the canvas's program has a new CRC, the runtime still runs the old one → no glow
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(status(page)).toHaveText('Online · other program')
  await expect(status(page)).toHaveAttribute('title', /^Online · the runtime runs another program \(CRC [0-9A-F]{8}\) — Download this one · 4 nodes · 3 links$/)
  await expect(page.locator('[data-testid="live-step"]')).toHaveCount(0)
  await download(page).click()
  await expect(status(page)).toHaveText('Online · start')
  await page.evaluate(() => (window as unknown as { spmSim: { set(r: string): void } }).spmSim.set('stopped'))
  await expect(download(page)).toHaveAttribute('title', 'Runtime OFFLINE — no download')
  await expect(status(page)).toHaveText(/^Offline · 4 nodes · 3 links$/)
  await expect(page.locator('[data-testid="live-step"]')).toHaveCount(0)
})

test('UI-34.3 a program that does not compile is not downloaded: the reasons in Build output', async ({ page }) => {
  await savedFlow(page)
  await pal(page, 'Delay').click() // n3, not linked: the flow has a problem, Save still works (step 26)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByTestId('program-dirty')).toHaveCount(0)
  await download(page).click()
  await expect(page.getByRole('status').filter({ hasText: /^Not downloaded: S1_Main · n3: / })).toBeVisible()
  await page.getByRole('tab', { name: 'Build output' }).click()
  await expect(page.getByTestId('build-compile')).toHaveText('⚠ The program does not compile')
  await expect(page.locator('.seq-build-list').first()).toContainText('S1_Main · n3:')
  await expect(status(page)).toHaveText('Online · not built')
})
