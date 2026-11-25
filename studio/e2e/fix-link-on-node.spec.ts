/** Found on the PC (physical test P-26.2): a link let go on the middle of a Decision was not made — the nearest dot
 *  was the Decision's own exit ('yes'), so the link was invalid and silently dropped. Now a drop anywhere on a node
 *  links to it; a link the rules refuse says why. */
import { expect, test, type Page } from '@playwright/test'

const node = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`)

test('UI-F5 a link let go on the middle (or the bottom) of a node connects; on empty canvas it does not', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: 'Decision', exact: true }).click() // n1
  await page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: 'Delay', exact: true }).click() // n2
  await page.locator('.react-flow__controls-fitview').click()
  const drag = async (from: string, way: string, to: { x: number; y: number }): Promise<void> => {
    const h = way ? node(page, from).locator(`.react-flow__handle[data-handleid="${way}"]`) : node(page, from).locator('.react-flow__handle.source')
    const a = (await h.boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 12 })
    await page.mouse.up()
  }
  const d = (await node(page, 'n1').boundingBox())!
  await drag('start', '', { x: d.x + d.width / 2, y: d.y + d.height * 3 / 4 }) // low on the diamond, far from its top dot
  await expect(page.getByTestId('seq-status')).toContainText('1 link')
  const w = (await node(page, 'n2').boundingBox())!
  await drag('n1', 'no', { x: w.x + w.width - 12, y: w.y + w.height - 8 }) // bottom-right corner of the Delay
  await expect(page.getByTestId('seq-status')).toContainText('2 links')
  await expect(page.locator('.react-flow__edge-text')).toHaveText(['no'])
  const c = (await page.getByTestId('seq-canvas').boundingBox())!
  await drag('n2', '', { x: c.x + 30, y: c.y + c.height - 30 }) // empty canvas: no link
  await expect(page.getByTestId('seq-status')).toContainText('2 links')
  // a drop on Start is refused — and now says why instead of nothing happening
  const s = (await node(page, 'start').boundingBox())!
  await drag('n2', '', { x: s.x + s.width / 2, y: s.y + s.height / 2 })
  await expect(page.getByRole('status').filter({ hasText: 'Not linked: nothing can lead into Start' })).toBeVisible()
  await expect(page.getByTestId('seq-status')).toContainText('2 links')
})
