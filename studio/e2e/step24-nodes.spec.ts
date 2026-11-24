/** Step 24 · First node types: palette drag and drop, shapes, a 6-node flow. */
import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await page.getByRole('button', { name: 'Clear flow' }).click() // the flow store lives across screens ('New flow' until step 27)
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
})

const palette = (page: Page, title: string): Locator => page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: title, exact: true })
const canvas = (page: Page): Locator => page.getByTestId('seq-canvas')
const nodeOf = (page: Page, title: string): Locator => page.locator('.react-flow__node').filter({ has: page.locator('.seq-step-title', { hasText: new RegExp(`^${title}$`) }) })

async function dropAt(page: Page, title: string, fx: number, fy: number): Promise<void> {
  const box = (await canvas(page).boundingBox())!
  await palette(page, title).dragTo(canvas(page), { targetPosition: { x: box.width * fx, y: box.height * fy } })
}
async function link(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = (await from.locator('.react-flow__handle.source').boundingBox())!
  const b = (await to.locator('.react-flow__handle.target').boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('UI-24.1 the palette offers Move, Wait input, Set output, Delay', async ({ page }) => {
  await expect(page.getByRole('list', { name: 'Node palette' }).getByRole('button')).toHaveText(['Start', 'End', 'Move', 'Wait input', 'Set output', 'Delay', 'Decision']) // Start / End / Decision: step 26
  await expect(palette(page, 'Wait input')).toHaveAttribute('draggable', 'true')
})

test('UI-24.2 drag a node from the palette: it lands at the drop point with its defaults', async ({ page }) => {
  const box = (await canvas(page).boundingBox())!
  await dropAt(page, 'Wait input', 0.75, 0.3)
  const n = nodeOf(page, 'Wait input')
  await expect(n).toHaveCount(1)
  await expect(n.locator('.seq-step-sum')).toHaveText('WAIT input? = TRUE · 5 s')
  const nb = (await n.boundingBox())!
  expect(Math.abs(nb.x + nb.width / 2 - (box.x + box.width * 0.75))).toBeLessThan(40) // centred on the drop point
  expect(Math.abs(nb.y + nb.height / 2 - (box.y + box.height * 0.3))).toBeLessThan(40)
})

test('UI-24.3 build the 6-node flow Start → Wait → Move → Set → Delay → End by drag and drop', async ({ page }) => {
  await dropAt(page, 'Wait input', 0.78, 0.14)
  await dropAt(page, 'Move', 0.78, 0.34)
  await dropAt(page, 'Set output', 0.78, 0.54)
  await dropAt(page, 'Delay', 0.78, 0.74)
  await expect(page.locator('.react-flow__node')).toHaveCount(6)
  const chain = [page.locator('.react-flow__node[data-id="start"]'), nodeOf(page, 'Wait input'), nodeOf(page, 'Move'), nodeOf(page, 'Set output'), nodeOf(page, 'Delay'), page.locator('.react-flow__node[data-id="end"]')]
  for (let i = 0; i < chain.length - 1; i++) await link(page, chain[i]!, chain[i + 1]!)
  await expect(page.locator('.react-flow__edge')).toHaveCount(5)
  await expect(page.getByTestId('seq-status')).toHaveText('Offline · 6 nodes · 5 links')
  await expect(page.locator('.react-flow__minimap-node')).toHaveCount(6)
  // fit view: every node inside the canvas (found in step 24: the fit button used other options)
  await page.locator('.react-flow__controls-fitview').click()
  const c = (await canvas(page).boundingBox())!
  for (const n of await page.locator('.react-flow__node').all()) {
    const b = (await n.boundingBox())!
    expect(b.y).toBeGreaterThanOrEqual(c.y)
    expect(b.y + b.height).toBeLessThanOrEqual(c.y + c.height)
  }
})

test('UI-24.4 shapes: Move / Set output rectangles, Wait input a hexagon, Delay the D shape; open parameters dashed', async ({ page }) => {
  for (const t of ['Move', 'Wait input', 'Set output', 'Delay']) await palette(page, t).click() // keyboard way: below the last node
  await expect(page.locator('.react-flow__node')).toHaveCount(6)
  await expect(nodeOf(page, 'Wait input').locator('svg polygon')).toHaveCount(1)
  await expect(nodeOf(page, 'Delay').locator('svg path')).toHaveCount(1)
  expect(await nodeOf(page, 'Move').locator('.seq-step').evaluate((e) => getComputedStyle(e).borderTopStyle)).toBe('dashed') // axis? point?
  // 260 × 54 like the steps of the design (layout size, independent of the canvas zoom)
  expect(await nodeOf(page, 'Move').locator('.seq-step').evaluate((e) => [(e as HTMLElement).offsetWidth, (e as HTMLElement).offsetHeight])).toEqual([260, 54])
})

test('UI-24.5 a new node is selected; Del removes it with its links', async ({ page }) => {
  await palette(page, 'Delay').click()
  const n = nodeOf(page, 'Delay')
  await expect(n).toHaveClass(/selected/)
  await link(page, page.locator('.react-flow__node[data-id="start"]'), n)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await n.click()
  await page.keyboard.press('Delete')
  await expect(page.locator('.react-flow__node')).toHaveCount(2)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
})
