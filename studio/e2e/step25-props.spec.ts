/** Step 25 · N02 property panel: form per node type, TagPicker offers only tags of the right kind. */
import { expect, test, type Locator, type Page } from '@playwright/test'

async function withProject(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByTestId('project-name')).toHaveText('demo')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
}
const pal = (page: Page, t: string): Locator => page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: t, exact: true })
const panel = (page: Page): Locator => page.locator('.seq-props')
const options = (page: Page, label: string): Promise<string[]> =>
  page.getByTestId(`list-${label}`).evaluate((d) => [...(d as HTMLDataListElement).options].map((o) => o.value))
async function choose(page: Page, label: string, value: string): Promise<void> {
  const f = panel(page).getByLabel(label, { exact: true })
  await f.fill(value)
  await f.press('Enter')
}
const node = (page: Page): Locator => page.locator('.react-flow__node.selected')

test('UI-25.1 Wait input offers only DI tags', async ({ page }) => {
  await withProject(page)
  await pal(page, 'Wait input').click()
  await expect(panel(page)).toContainText('Wait input · WAIT_DI')
  expect(await options(page, 'Input')).toEqual(['DI_S1_ClampClosed', 'DI_S1_ClampOpen', 'DI_S1_PartPresent', 'DI_S2_DoorClosed'])
  await expect(panel(page)).toContainText('4 digital inputs (DI) and BOOL registers')
})

test('UI-25.2 choosing tags and numbers updates the node: summary, no more dashed outline', async ({ page }) => {
  await withProject(page)
  await pal(page, 'Wait input').click()
  await choose(page, 'Input', 'DI_S1_PartPresent')
  await choose(page, 'Timeout', '3000')
  await panel(page).getByRole('radio', { name: 'FALSE' }).click()
  await expect(node(page).locator('.seq-step-sum')).toHaveText('WAIT DI_S1_PartPresent = FALSE · 3 s')
  await expect(node(page).locator('.seq-step')).not.toHaveClass(/seq-open/)
  await expect(page.getByTestId('prop-summary')).toHaveText('WAIT DI_S1_PartPresent = FALSE · 3 s')
})

test('UI-25.3 a tag of the wrong kind is refused with the reason; the node keeps its value', async ({ page }) => {
  await withProject(page)
  await pal(page, 'Wait input').click()
  await choose(page, 'Input', 'DO_S1_Vacuum')
  await expect(panel(page).getByRole('alert')).toHaveText('DO_S1_Vacuum is not one of the digital inputs (DI) and BOOL registers')
  await expect(node(page).locator('.seq-step-sum')).toHaveText('WAIT input? = TRUE · 5 s')
})

test('UI-25.4 Move: axes only, then only the points of that axis; speed limits', async ({ page }) => {
  await withProject(page)
  await pal(page, 'Move').click()
  expect(await options(page, 'Axis')).toEqual(['AX_S1_X', 'AX_S1_Z'])
  await choose(page, 'Axis', 'AX_S1_X')
  expect(await options(page, 'Point')).toEqual(['P_S1_Pick', 'P_S1_Place'])
  await choose(page, 'Point', 'P_S1_Pick')
  await choose(page, 'Speed', '120')
  await expect(panel(page).getByRole('alert')).toHaveText('1 … 100 %')
  await choose(page, 'Speed', '80')
  await expect(node(page).locator('.seq-step-sum')).toHaveText('MOVE AX_S1_X → P_S1_Pick · 80 %')
})

test('UI-25.5 Name replaces the title on the node; Start has nothing to set', async ({ page }) => {
  await withProject(page)
  await pal(page, 'Set output').click()
  await choose(page, 'Name', 'Clamp')
  await expect(node(page).locator('.seq-step-title')).toHaveText('Clamp')
  await page.locator('.react-flow__node[data-id="start"]').click()
  await expect(panel(page)).toContainText('Start: the flow begins here. Nothing to set.')
})

test('UI-25.6 without an open project the panel says so and leads to Tags', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await pal(page, 'Set output').click()
  await expect(panel(page).getByRole('note')).toContainText('No project open')
  await panel(page).getByRole('button', { name: 'Open one in Tags' }).click()
  await expect(page.locator('.rail-item.active')).toContainText('Tags')
})

test('UI-25.7 Backspace / Delete while typing in the panel edit the text, never delete the selected node', async ({ page }) => {
  await withProject(page)
  await pal(page, 'Delay').click()
  const f = panel(page).getByLabel('Name', { exact: true })
  await f.fill('Settle')
  await f.press('Backspace')
  await f.press('Backspace')
  await f.press('Delete')
  await expect(f).toHaveValue('Sett')
  await expect(page.locator('.react-flow__node')).toHaveCount(3)
})
