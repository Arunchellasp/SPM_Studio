/** Step 27 · N02 save / load + tree: program.json, several flows per station, the tree selects the flow. */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { stableBox } from './support/stable-box'

const pal = (page: Page, t: string): Locator => page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: t, exact: true })
const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`)
const flowBtn = (page: Page, name: string): Locator => page.getByRole('list', { name: 'Flows by station' }).getByRole('button', { name, exact: true })
const toastWith = (page: Page, text: string | RegExp): Locator => page.getByRole('status').filter({ hasText: text })
/** a node's place in canvas coordinates (React Flow writes it as transform: translate(x, y)) */
const place = (page: Page, id: string): Promise<string> => node(page, id).evaluate((e) => (e as HTMLElement).style.transform)

async function openDemo(page: Page): Promise<void> {
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
}
async function program(page: Page): Promise<void> {
  await page.goto('/')
  await openDemo(page)
  await expect(page.getByTestId('project-name')).toHaveText('demo')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
}
async function link(page: Page, from: string, to: string): Promise<void> {
  const a = await stableBox(node(page, from).locator('.react-flow__handle.source'))
  const b = await stableBox(node(page, to))
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + 8, { steps: 10 })
  await page.mouse.up()
}

test('UI-27.1 the tree: stations from the tags, their flows; a click shows that flow, a new flow is shown at once', async ({ page }) => {
  await program(page)
  await expect(page.locator('.seq-station')).toHaveText(['S1', 'S2'])
  await expect(flowBtn(page, 'S1_Main')).toHaveAttribute('aria-current', 'true')
  await pal(page, 'Delay').click() // n1 in S1_Main
  await page.getByRole('button', { name: 'New flow in S2' }).click()
  await expect(flowBtn(page, 'S2_Main')).toHaveAttribute('aria-current', 'true')
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await flowBtn(page, 'S1_Main').click()
  await expect(node(page, 'n1')).toHaveCount(1)
  await page.getByRole('button', { name: 'New flow in S1' }).click()
  await expect(flowBtn(page, 'S1_Flow2')).toHaveAttribute('aria-current', 'true')
})

test('UI-27.2 save, change, open again: the saved drawing comes back — nodes, links, places, parameters, all flows', async ({ page }) => {
  await program(page)
  await expect(page.getByTestId('program-dirty')).toHaveCount(0)
  await pal(page, 'Wait input').click() // n1
  const f = page.locator('.seq-props').getByLabel('Input', { exact: true })
  await f.fill('DI_S1_PartPresent')
  await f.press('Enter')
  await page.locator('.react-flow__controls-fitview').click()
  await link(page, 'start', 'n1')
  await link(page, 'n1', 'end')
  await page.getByRole('button', { name: 'New flow in S2' }).click()
  await expect(page.getByTestId('program-dirty')).toHaveText('● unsaved changes')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(toastWith(page, 'Saved (browser) projects/demo/program.json')).toBeVisible()
  await expect(page.getByTestId('program-dirty')).toHaveCount(0)

  await flowBtn(page, 'S1_Main').click()
  const before = await place(page, 'n1')
  await pal(page, 'Delay').click() // an unsaved change
  await openDemo(page)
  const ask = page.getByRole('alertdialog')
  await expect(ask).toContainText('flowchart changes that are not saved')
  await ask.getByRole('button', { name: 'Discard and open' }).click()
  await expect(toastWith(page, 'Opened demo · 20 tags · 2 flows')).toBeVisible()

  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await expect(page.locator('.seq-flow:not(.seq-flow-new)')).toHaveText(['S1_Main', 'S2_Main'])
  await expect(page.locator('.react-flow__node')).toHaveCount(3) // the Delay was not saved
  expect(await place(page, 'n1')).toBe(before)
  await expect(node(page, 'n1')).toContainText('WAIT DI_S1_PartPresent = TRUE · 5 s')
  await expect(page.getByTestId('seq-status')).toContainText('2 links')
  await expect(page.getByTestId('program-dirty')).toHaveCount(0)
  // saving what was opened writes nothing
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(toastWith(page, 'No changes — program.json is already up to date')).toBeVisible()
})

test('UI-27.3 without an open project: the drawing works, Save waits for a project', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await expect(page.locator('.seq-station')).toHaveText(['S1'])
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled()
  await expect(page.locator('.seq-save')).toContainText('Open a project in Tags to save the flows.')
  await pal(page, 'Delay').click()
  await expect(page.getByTestId('program-dirty')).toHaveCount(0) // nothing to save into yet: no 'unsaved' alarm
})
