/** Step 26 · N02 Decision (IF, yes / no) and flow validation: red badges appear and clear. */
import { expect, test, type Locator, type Page } from '@playwright/test'

const pal = (page: Page, t: string): Locator => page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: t, exact: true })
const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`)
const badge = (page: Page, id: string): Locator => node(page, id).locator('.seq-badge')
const problems = (page: Page): Locator => page.getByTestId('seq-problems')

async function program(page: Page, withProject = false): Promise<void> {
  await page.goto('/')
  if (withProject) {
    await page.locator('.rail-item', { hasText: 'Tags' }).click()
    await page.getByRole('button', { name: 'Open project…' }).click()
    await expect(page.getByTestId('project-name')).toHaveText('demo')
  }
  await page.locator('.rail-item', { hasText: 'Program' }).click()
}
/** drag from a node's way out ('' = its only one, or 'yes' / 'no') onto another node */
async function link(page: Page, from: string, to: string, way = ''): Promise<void> {
  const h = way ? node(page, from).locator(`.react-flow__handle[data-handleid="${way}"]`) : node(page, from).locator('.react-flow__handle.source')
  const a = (await h.boundingBox())!
  const b = (await node(page, to).boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + 8, { steps: 10 })
  await page.mouse.up()
}
async function setCondition(page: Page, text: string): Promise<void> {
  const f = page.locator('.seq-props').getByLabel('Condition', { exact: true })
  await f.fill(text)
  await f.press('Enter')
}

test('UI-26.1 a fresh flow shows its problems as badges; linking Start → End clears them', async ({ page }) => {
  await program(page)
  await expect(problems(page)).toHaveText('⚠ 2 problems')
  await expect(badge(page, 'start')).toHaveText('1')
  await expect(badge(page, 'start')).toHaveAttribute('title', 'way out is not linked')
  await expect(badge(page, 'end')).toHaveAttribute('title', 'cannot be reached from Start')
  await link(page, 'start', 'end')
  await expect(problems(page)).toHaveText('✓ no problems')
  await expect(page.locator('.seq-badge')).toHaveCount(0)
})

test('UI-26.2 Decision: a diamond with yes / no ways out; each link is labelled; both must be linked', async ({ page }) => {
  await program(page, true)
  await pal(page, 'Decision').click() // n1
  await expect(node(page, 'n1').locator('.seq-decision')).toHaveClass(/seq-open/)
  await expect(node(page, 'n1')).toContainText('IF condition?')
  await setCondition(page, 'R_PartCount >= 100')
  await expect(node(page, 'n1')).toContainText('IF R_PartCount >= 100')
  await expect(node(page, 'n1').locator('.seq-decision')).not.toHaveClass(/seq-open/)
  await pal(page, 'Delay').click() // n2
  await page.locator('.react-flow__controls-fitview').click()
  await link(page, 'start', 'n1')
  await link(page, 'n1', 'end', 'yes')
  await expect(badge(page, 'n1')).toHaveAttribute('title', "'no' way out is not linked")
  await link(page, 'n1', 'n2', 'no')
  await link(page, 'n2', 'n1')
  await expect(problems(page)).toHaveText('✓ no problems')
  await expect(page.locator('.react-flow__edge-text')).toHaveText(['yes', 'no'])
})

test('UI-26.3 two Starts: both get a badge; deleting one clears it', async ({ page }) => {
  await program(page)
  await link(page, 'start', 'end')
  await pal(page, 'Start').click() // n1, selected
  await expect(badge(page, 'start')).toHaveAttribute('title', '2 Starts — a flow has exactly one')
  await expect(badge(page, 'n1')).toHaveAttribute('title', /2 Starts — a flow has exactly one\nway out is not linked/)
  await page.keyboard.press('Delete')
  await expect(node(page, 'n1')).toHaveCount(0)
  await expect(problems(page)).toHaveText('✓ no problems')
})

test('UI-26.4 unknown tag: a tag deleted in N03 shows a badge in N02; Ctrl+Z in N03 clears it', async ({ page }) => {
  await program(page, true)
  await pal(page, 'Wait input').click() // n1
  const f = page.locator('.seq-props').getByLabel('Input', { exact: true })
  await f.fill('DI_S1_PartPresent')
  await f.press('Enter')
  await page.locator('.react-flow__controls-fitview').click()
  await link(page, 'start', 'n1')
  await link(page, 'n1', 'end')
  await expect(problems(page)).toHaveText('✓ no problems')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.locator('.tabulator-row', { hasText: 'DI_S1_PartPresent' }).click()
  await page.keyboard.press('Delete')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await expect(badge(page, 'n1')).toHaveAttribute('title', 'no tag DI_S1_PartPresent in the project')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.keyboard.press('Control+z')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await expect(problems(page)).toHaveText('✓ no problems')
})

test('UI-26.5 a bad condition is refused in the panel with the place of the error', async ({ page }) => {
  await program(page, true)
  await pal(page, 'Decision').click()
  await setCondition(page, 'R_PartCount >=')
  await expect(page.locator('.seq-props').getByRole('alert')).toHaveText('a tag, number or ( expected at the end')
  await setCondition(page, 'R_Nothing > 1')
  await expect(page.locator('.seq-props').getByRole('alert')).toHaveText('no tag R_Nothing in the project')
  await expect(node(page, 'n1')).toContainText('IF condition?')
})

test('UI-26.6 Build output lists every problem; a click selects that node', async ({ page }) => {
  await program(page)
  await pal(page, 'Delay').click() // n1
  await page.getByRole('tab', { name: 'Build output' }).click()
  await expect(page.getByTestId('build-head')).toHaveText('⚠ 4 problems in the flow · tags not checked (no project open)')
  await page.getByRole('button', { name: /Delay \(n1\) — way out is not linked/ }).click()
  await expect(node(page, 'n1')).toHaveClass(/selected/)
  await expect(page.locator('.seq-props')).toContainText('Delay · DELAY')
})
