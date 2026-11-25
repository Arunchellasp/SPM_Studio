/** Step 28 · N02 editing comfort: undo / redo, copy / paste, auto-layout ('Tidy up'). */
import { expect, test, type Locator, type Page } from '@playwright/test'
import { stableBox } from './support/stable-box'

const pal = (page: Page, t: string): Locator => page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: t, exact: true })
const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`)
const place = (page: Page, id: string): Promise<string> => node(page, id).evaluate((e) => (e as HTMLElement).style.transform)
const fit = (page: Page): Promise<void> => page.locator('.react-flow__controls-fitview').click()

async function program(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
}
async function link(page: Page, from: string, to: string, way = ''): Promise<void> {
  const h = way ? node(page, from).locator(`.react-flow__handle[data-handleid="${way}"]`) : node(page, from).locator('.react-flow__handle.source')
  const a = await stableBox(h)
  const b = await stableBox(node(page, to))
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + 8, { steps: 10 })
  await page.mouse.up()
}
async function drag(page: Page, id: string, dx: number, dy: number): Promise<void> {
  const b = (await node(page, id).boundingBox())!
  await page.mouse.move(b.x + 24, b.y + 12)
  await page.mouse.down()
  await page.mouse.move(b.x + 24 + dx, b.y + 12 + dy, { steps: 8 })
  await page.mouse.up()
}
const boxes = async (page: Page, ids: string[]) => Promise.all(ids.map(async (id) => ({ id, ...(await node(page, id).boundingBox())! })))

test('UI-28.1 Tidy up: a messy flow is laid out top to bottom in one click, nothing overlaps; Ctrl+Z brings the mess back', async ({ page }) => {
  await program(page)
  await pal(page, 'Wait input').click() // n1
  await pal(page, 'Decision').click() // n2
  await pal(page, 'Delay').click() // n3
  await fit(page)
  await link(page, 'start', 'n1')
  await link(page, 'n1', 'n2')
  await link(page, 'n2', 'end', 'yes')
  await link(page, 'n2', 'n3', 'no')
  await link(page, 'n3', 'n1')
  // make a mess: End up beside Start, the Delay on top of the Wait
  await drag(page, 'end', 260, -250)
  const w = (await node(page, 'n1').boundingBox())!
  const d = (await node(page, 'n3').boundingBox())!
  await drag(page, 'n3', w.x - d.x + 30, w.y - d.y + 10)
  const messy = await Promise.all(['start', 'end', 'n1', 'n2', 'n3'].map((id) => place(page, id)))

  await page.getByRole('button', { name: 'Tidy up' }).click()
  await expect.poll(() => place(page, 'end')).not.toBe(messy[1])
  const b = Object.fromEntries((await boxes(page, ['start', 'n1', 'n2', 'end', 'n3'])).map((x) => [x.id, x]))
  expect(b.start!.y).toBeLessThan(b.n1!.y)
  expect(b.n1!.y).toBeLessThan(b.n2!.y)
  expect(b.n2!.y).toBeLessThan(b.end!.y)
  expect(b.n3!.x).toBeGreaterThan(b.n2!.x) // the 'no' branch beside the main line
  const list = Object.values(b)
  for (const p of list)
    for (const q of list)
      if (p !== q) expect(p.x + p.width <= q.x || q.x + q.width <= p.x || p.y + p.height <= q.y || q.y + q.height <= p.y).toBe(true)
  await expect(page.getByTestId('seq-problems')).toHaveText('✓ no problems')

  await page.locator('.react-flow__pane').click({ position: { x: 10, y: 10 } })
  await page.keyboard.press('Control+z')
  expect(await Promise.all(['start', 'end', 'n1', 'n2', 'n3'].map((id) => place(page, id)))).toEqual(messy)
})

test('UI-28.2 undo / redo: buttons and Ctrl+Z / Ctrl+Y; a drag is one step; Ctrl+Z in a field edits only the text', async ({ page }) => {
  await program(page)
  const undo = page.getByRole('button', { name: 'Undo (Ctrl+Z)' })
  const redo = page.getByRole('button', { name: 'Redo (Ctrl+Y)' })
  await expect(undo).toBeDisabled()
  await pal(page, 'Delay').click() // n1
  await undo.click()
  await expect(node(page, 'n1')).toHaveCount(0)
  await redo.click()
  await expect(node(page, 'n1')).toHaveCount(1)
  const before = await place(page, 'n1')
  await drag(page, 'n1', 120, 40)
  await page.keyboard.press('Control+z')
  expect(await place(page, 'n1')).toBe(before)
  await page.keyboard.press('Control+y')
  expect(await place(page, 'n1')).not.toBe(before)
  // in the Name field the keys belong to the text
  await node(page, 'n1').click()
  const name = page.locator('.seq-props').getByLabel('Name', { exact: true })
  await name.fill('Settle')
  await name.press('Control+z')
  await expect(node(page, 'n1')).toHaveCount(1)
})

test('UI-28.3 copy / paste: Ctrl+C, Ctrl+V twice → two copies with their own ids and the same settings, selected', async ({ page }) => {
  await program(page)
  await pal(page, 'Delay').click() // n1, selected
  const t = page.locator('.seq-props').getByLabel('Time', { exact: true })
  await t.fill('300')
  await t.press('Enter')
  await node(page, 'n1').click()
  await page.keyboard.press('Control+c')
  await expect(page.getByRole('status').filter({ hasText: 'Copied 1 node — Ctrl+V pastes' })).toBeVisible()
  await page.keyboard.press('Control+v')
  await page.keyboard.press('Control+v')
  await expect(page.locator('.react-flow__node')).toHaveCount(5)
  for (const id of ['n2', 'n3']) await expect(node(page, id)).toContainText('DELAY 300 ms')
  await expect(node(page, 'n3')).toHaveClass(/selected/)
  await page.keyboard.press('Control+z')
  await expect(node(page, 'n3')).toHaveCount(0)
})
