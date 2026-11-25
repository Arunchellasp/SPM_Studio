/** Found on the PC (physical test P-23.3): linking by hand failed — a press just beside the 10 px dot panned the
 *  canvas, and letting go on the End box instead of its dot made no link. */
import { expect, test, type Page } from '@playwright/test'

const status = (page: Page) => page.getByTestId('seq-status')

test('UI-F3 a press 7 px beside the dot starts a link; letting go on the middle of End connects', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  const dot = (await page.locator('.react-flow__node[data-id="start"] .react-flow__handle').boundingBox())!
  const end = (await page.locator('.react-flow__node[data-id="end"]').boundingBox())!
  const startBefore = (await page.locator('.react-flow__node[data-id="start"]').boundingBox())!
  await page.mouse.move(dot.x + dot.width / 2 + 7, dot.y + dot.height / 2)
  await page.mouse.down()
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 3, { steps: 8 })
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 4 })
  await page.mouse.up()
  await expect(status(page)).toHaveAttribute('title', / 1 link$/)
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  // no pan happened
  expect((await page.locator('.react-flow__node[data-id="start"]').boundingBox())!.x).toBeCloseTo(startBefore.x, 0)
})
