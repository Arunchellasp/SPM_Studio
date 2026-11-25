/** Found on the PC (physical test P-23.3): with Windows 125 % (window 1536 × 864) the app zooms the shell to 80 %
 *  (step 9), and the canvas read the mouse at the wrong place — the link line did not follow the pointer and a
 *  drop on End made no link. Palette drops landed off too. The tests ran at 1920 × 1080 (zoom 100 %) only. */
import { expect, test, type Page } from '@playwright/test'

test.use({ viewport: { width: 1536, height: 864 } })
const status = (page: Page) => page.getByTestId('seq-status')

async function program(page: Page): Promise<void> {
  await page.goto('/')
  await expect(page.locator('.shell')).toHaveAttribute('data-zoom', '0.8')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
}

test('UI-F4.1 at 80 % zoom a link dragged from the Start dot to the End dot connects', async ({ page }) => {
  await program(page)
  const a = (await page.locator('.react-flow__node[data-id="start"] .react-flow__handle').boundingBox())!
  const b = (await page.locator('.react-flow__node[data-id="end"] .react-flow__handle').boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(status(page)).toHaveAttribute('title', / 1 link$/)
})

test('UI-F4.2 at 80 % zoom the link line follows the pointer while dragging', async ({ page }) => {
  await program(page)
  const a = (await page.locator('.react-flow__node[data-id="start"] .react-flow__handle').boundingBox())!
  const canvas = (await page.getByTestId('seq-canvas').boundingBox())!
  const to = { x: canvas.x + canvas.width / 4, y: canvas.y + canvas.height * 3 / 4 }
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 10 })
  const line = (await page.locator('.react-flow__connection-path').boundingBox())!
  await page.mouse.up()
  // the free end of the line is where the pointer is (the line's box reaches the pointer within a few px)
  expect(Math.abs(line.x - to.x)).toBeLessThan(6)
  expect(Math.abs(line.y + line.height - to.y)).toBeLessThan(6)
})

test('UI-F4.3 at 80 % zoom a palette node dropped at the pointer lands under the pointer', async ({ page }) => {
  await program(page)
  const canvas = (await page.getByTestId('seq-canvas').boundingBox())!
  const at = { x: canvas.x + canvas.width / 4, y: canvas.y + canvas.height * 3 / 4 }
  await page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: 'Delay', exact: true }).dragTo(page.getByTestId('seq-canvas'), {
    targetPosition: { x: at.x - canvas.x, y: at.y - canvas.y }
  })
  const n = (await page.locator('.react-flow__node:has([data-kind="Delay"])').boundingBox())!
  // the drop point is inside the new node (snapping to the 16 px grid moves it a little)
  expect(at.x).toBeGreaterThan(n.x - 16)
  expect(at.x).toBeLessThan(n.x + n.width + 16)
  expect(at.y).toBeGreaterThan(n.y - 16)
  expect(at.y).toBeLessThan(n.y + n.height + 16)
})
