/** Step 3 · Card: look, header, layout. */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('UI-3.1 card look: white, 1 px #C9CED4 border, 8 px corners, no shadow', async ({ page }) => {
  await page.getByRole('button', { name: /N00 Dev/ }).click()
  const card = page.getByRole('region', { name: 'Card with a title' })
  const s = await card.evaluate((e) => {
    const c = getComputedStyle(e)
    return [c.backgroundColor, c.borderTopWidth, c.borderTopColor, c.borderRadius, c.boxShadow]
  })
  expect(s).toEqual(['rgb(255, 255, 255)', '1px', 'rgb(201, 206, 212)', '8px', 'none'])
})

test('UI-3.2 card title: bold 14 px, 16 px from the left edge', async ({ page }) => {
  await page.getByRole('button', { name: /N00 Dev/ }).click()
  const card = page.getByRole('region', { name: 'Card with a title' })
  const title = card.getByRole('heading', { name: 'Card with a title' })
  const [cb, tb] = [await card.boundingBox(), await title.boundingBox()]
  expect(Math.round((tb?.x ?? 0) - (cb?.x ?? 0))).toBe(17) // 1 px border + 16 px padding
  expect(await title.evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).fontWeight])).toEqual(['14px', '700'])
})

test('UI-3.3 small state pill in a card is 134 × 26', async ({ page }) => {
  await page.getByRole('button', { name: /N00 Dev/ }).click()
  const pill = page.getByRole('region', { name: 'Station 2 · Plasma clean' }).locator('.state-pill')
  const box = await pill.boundingBox()
  expect([box?.width, box?.height]).toEqual([134, 26])
})

test('UI-3.4 cards in a row are 16 px apart', async ({ page }) => {
  await page.getByRole('button', { name: /N00 Dev/ }).click()
  const a = await page.getByRole('region', { name: 'Card with a title' }).boundingBox()
  const cards = page.locator('.cmp-cards > .card')
  const b = await cards.nth(1).boundingBox()
  expect(Math.round((b?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0)))).toBe(16)
})

test('UI-3.5 empty screens are full-height cards', async ({ page }) => {
  await page.locator('.rail-item', { hasText: 'I/O' }).click() // N01 has content since step 12, N03 since step 16
  const card = page.locator('.content > .card')
  await expect(card).toHaveClass(/card-fill/)
  const [content, c] = [await page.locator('.content').boundingBox(), await card.boundingBox()]
  expect(Math.round((c?.height ?? 0) + 32)).toBe(Math.round(content?.height ?? 0)) // 16 px padding top + bottom
})
