/** Step 23 · N02 canvas: Start / End, link by dragging, zoom, pan, mini-map; layout of the design. */
import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await expect(page.getByTestId('seq-canvas').locator('.react-flow__node')).toHaveCount(2)
})

const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`)
const scale = async (page: Page): Promise<number> => {
  const t = await page.locator('.react-flow__viewport').evaluate((e) => getComputedStyle(e).transform) // matrix(a, b, c, d, tx, ty)
  return Number(t.match(/matrix\(([^,]+)/)?.[1] ?? 1)
}
const translate = async (page: Page): Promise<[number, number]> => {
  const t = await page.locator('.react-flow__viewport').evaluate((e) => getComputedStyle(e).transform)
  const m = t.match(/matrix\([^,]+,[^,]+,[^,]+,[^,]+,\s*([^,]+),\s*([^)]+)\)/)
  return [Number(m?.[1]), Number(m?.[2])]
}
async function drag(page: Page, from: Locator, to: Locator): Promise<void> {
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.up()
}

test('UI-23.1 layout of the design: tree 300 · canvas 1080 · properties 388; tools panel below; run tools wait for the runtime', async ({ page }) => {
  const w = async (sel: string): Promise<number> => (await page.locator(sel).boundingBox())!.width
  const [tree, main, props] = [await w('.seq-tree'), await w('.seq-main'), await w('.seq-props')]
  expect(main / tree).toBeCloseTo(1080 / 300, 1)
  expect(props / tree).toBeCloseTo(388 / 300, 1)
  for (const t of ['Run', 'Pause', 'Step', 'Breakpoint', 'Force', 'Online change']) await expect(page.getByRole('button', { name: t, exact: true })).toBeDisabled()
  await expect(page.getByRole('tablist', { name: 'Program tools' }).getByRole('tab')).toHaveText(['Watch', 'Trace', 'Cross reference', 'Build output'])
})

test('UI-23.0 the screen has its heading (hidden: the design shows none)', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('N02 Program › Sequence editor')
})

test('UI-23.2 Start above End, not linked; mini-map shows both', async ({ page }) => {
  const s = (await node(page, 'start').boundingBox())!
  const e = (await node(page, 'end').boundingBox())!
  expect(s.y).toBeLessThan(e.y)
  await expect(page.locator('.react-flow__edge')).toHaveCount(0)
  await expect(page.getByTestId('seq-status')).toHaveAttribute('title', /· 2 nodes · 0 links$/) // since step 34 the browser has a runtime: the status shows it, the counts are in its tooltip
  await expect(page.locator('.react-flow__minimap')).toBeVisible()
  await expect(page.locator('.react-flow__minimap-node')).toHaveCount(2)
})

test('UI-23.3 drag from Start to End links them (arrow); a second link is refused', async ({ page }) => {
  await drag(page, node(page, 'start').locator('.react-flow__handle.source'), node(page, 'end').locator('.react-flow__handle.target'))
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.locator('.react-flow__edge path[marker-end]')).toHaveCount(1)
  await expect(page.getByTestId('seq-status')).toHaveAttribute('title', /· 2 nodes · 1 link$/)
  await drag(page, node(page, 'start').locator('.react-flow__handle.source'), node(page, 'end').locator('.react-flow__handle.target'))
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
})

test('UI-23.4 zoom: + / − buttons and the mouse wheel', async ({ page }) => {
  const z0 = await scale(page)
  await page.locator('.react-flow__controls-zoomin').click()
  await expect.poll(() => scale(page)).toBeGreaterThan(z0)
  const z1 = await scale(page)
  await page.locator('.react-flow__controls-zoomout').click()
  await expect.poll(() => scale(page)).toBeLessThan(z1)
  const box = (await page.getByTestId('seq-canvas').boundingBox())!
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 3)
  const z2 = await scale(page)
  await page.mouse.wheel(0, -400) // wheel up = zoom in
  await expect.poll(() => scale(page)).toBeGreaterThan(z2)
})

test('UI-23.5 pan: drag on the empty canvas moves the view; the nodes stay where they are in the flow', async ({ page }) => {
  const box = (await page.getByTestId('seq-canvas').boundingBox())!
  const [x0, y0] = await translate(page)
  await page.mouse.move(box.x + 60, box.y + 60)
  await page.mouse.down()
  await page.mouse.move(box.x + 260, box.y + 160, { steps: 10 })
  await page.mouse.up()
  const [x1, y1] = await translate(page)
  expect(Math.round(x1 - x0)).toBeGreaterThan(100)
  expect(Math.round(y1 - y0)).toBeGreaterThan(50)
})

test('UI-23.6 dark theme: canvas and nodes use the dark tokens', async ({ page }) => {
  await page.locator('.rail-item', { hasText: 'Admin' }).click()
  await page.getByRole('radio', { name: 'Dark' }).click()
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  const bg = await page.locator('.react-flow').evaluate((e) => getComputedStyle(e).backgroundColor)
  expect(bg).toBe('rgb(42, 49, 57)') // --surface (dark)
  const fg = await node(page, 'start').locator('.seq-terminal').evaluate((e) => getComputedStyle(e).color)
  expect(fg).not.toBe('rgb(31, 35, 40)')
})

test('UI-23.7 at 1280 × 720 the canvas toolbar stays one row inside the card, the canvas has room', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  const tools = page.getByRole('toolbar', { name: 'Sequence tools' })
  const card = (await page.locator('.seq-main').boundingBox())!
  const items = tools.locator('> *')
  const n = await items.count()
  const mids: number[] = []
  for (let i = 0; i < n; i++) {
    const b = (await items.nth(i).boundingBox())!
    mids.push(b.y + b.height / 2) // centres: a text and a button of one row share the middle line
    expect(b.x + b.width).toBeLessThanOrEqual(card.x + card.width + 0.5)
  }
  expect(Math.max(...mids) - Math.min(...mids)).toBeLessThan(2) // one row
  expect((await page.getByTestId('seq-canvas').boundingBox())!.height).toBeGreaterThan(250)
})
