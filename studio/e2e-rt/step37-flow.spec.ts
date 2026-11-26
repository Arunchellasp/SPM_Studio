/**
 * Step 37 · the flow engine: the demo flow (projects/demo/program.json) runs in spm_rt, driven from the studio.
 *   UI-37.1 Download the demo · UI-37.2 Reset + Start: the green ring walks the flow, values change under the links
 *   UI-37.3 Stop: the ring stands still at once, the clamp output off · UI-37.4 Reset: back to Start
 *   UI-37.5 spm_rt restarted: it loads program.rt.json itself — the studio sees its program again
 */
import { rmSync } from 'node:fs'
import { expect, test, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import { RT_BIN, Runtime, demoProject, launchStudio, openProject } from './support/rt'

const PORT = 17661
const pill = (page: Page): Locator => page.locator('.header .state-pill')
const btn = (page: Page, name: string): Locator => page.locator('.header-commands button', { hasText: name })
const status = (page: Page): Locator => page.getByTestId('seq-status')
const ringOn = (page: Page): Promise<string | null> =>
  page
    .getByTestId('live-step')
    .locator('xpath=ancestor::*[contains(@class,"react-flow__node")][1]')
    .getAttribute('data-id', { timeout: 2_000 })
    .catch(() => null)

let dir = ''
let rt: Runtime
let app: ElectronApplication
let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  expect(RT_BIN, 'spm_rt is not built (cmake -S runtime -B runtime/build && cmake --build runtime/build)').not.toBe('')
  dir = demoProject(PORT)
  rt = new Runtime(dir, PORT)
  await rt.start()
  expect(rt.log).toContain('no ') // no program.rt.json yet in the copy
  ;({ app, page } = await launchStudio(PORT))
  await expect(page.getByTestId('runtime-link')).toHaveText('Online · 1.00 ms', { timeout: 10_000 })
  await openProject(app, page, dir)
  await page.locator('.rail-item', { hasText: 'Program' }).click()
})

test.afterAll(async () => {
  await app?.close()
  await rt?.kill()
  if (dir) rmSync(dir, { recursive: true, force: true })
})

test('UI-37.1 Download the demo flow: spm_rt builds its step table (9 steps) and reports the CRC', async () => {
  await page.locator('.seq-tree').getByRole('button', { name: 'Download' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Downloaded to the runtime · 1 flow · CRC 20D80EEF' })).toBeVisible()
  await expect.poll(() => rt.log).toContain('download: program 20D80EEF, 1 flow, 9 steps')
  await expect(status(page)).toHaveText(/^Online · (step 0|start)/)
})

test('UI-37.2 Reset + Start: the ring walks the flow in spm_rt and the clamp values change under the links', async () => {
  await btn(page, 'Reset').click()
  await expect(pill(page)).toHaveText('IDLE')
  await btn(page, 'Start').click()
  await expect(pill(page)).toHaveText('EXECUTE')
  const seen = new Set<string>()
  const t0 = Date.now()
  while (Date.now() - t0 < 6_000) {
    const on = await ringOn(page)
    if (on) seen.add(on)
    await page.waitForTimeout(40)
  }
  // a cycle is ~2 s: in 6 s the ring must have stood on the long steps (moves, waits) of the real flow
  expect([...seen]).toEqual(expect.arrayContaining(['pick', 'place']))
  expect(seen.size).toBeGreaterThanOrEqual(4)
  await expect(page.getByText(/DO_S1_ClampValve = TRUE/).first()).toBeVisible({ timeout: 3_000 })
  await expect(page.getByText(/DO_S1_ClampValve = FALSE/).first()).toBeVisible({ timeout: 3_000 })
})

test('UI-37.3 Stop: the ring stands still at once and the clamp output is off', async () => {
  await btn(page, 'Stop').click()
  await expect(pill(page)).toHaveText(/STOPPING|STOPPED/)
  await expect.poll(() => rt.log).toContain('flows halted in the same cycle')
  await page.waitForTimeout(300) // the last state frame after the stop (20 Hz)
  const at = await status(page).textContent()
  await page.waitForTimeout(2_500)
  await expect(status(page)).toHaveText(at ?? '') // not one step more
  await expect(pill(page)).toHaveText('STOPPED')
  await expect(page.getByText(/DO_S1_ClampValve = FALSE/).first()).toBeVisible()
})

test('UI-37.4 Reset: every flow back to its Start', async () => {
  await btn(page, 'Reset').click()
  await expect(pill(page)).toHaveText('IDLE')
  await expect(status(page)).toHaveText(/^Online · (step 0|start)/)
})

test('UI-37.5 spm_rt restarted loads program.rt.json itself: the studio sees its program again (no Download)', async () => {
  await rt.kill()
  await expect(page.getByTestId('runtime-link')).toHaveAttribute('data-link', 'offline', { timeout: 3_500 })
  await rt.start()
  expect(rt.log).toContain('program 20D80EEF from') // the file the studio wrote at Download
  await expect(page.getByTestId('runtime-link')).toHaveText('Online · 1.00 ms', { timeout: 10_000 })
  await expect(status(page)).not.toHaveText(/no program|other program/)
  await btn(page, 'Reset').click()
  await btn(page, 'Start').click()
  await expect(pill(page)).toHaveText('EXECUTE')
  await expect.poll(async () => ringOn(page), { timeout: 5_000 }).toBe('pick')
  await btn(page, 'Stop').click()
  await expect(pill(page)).toHaveText('STOPPED')
})
