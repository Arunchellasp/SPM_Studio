/** Step 4 · Field + Select: size, look, error state, typing and keyboard. */
import { expect, test, type Page } from '@playwright/test'

async function openN00(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /N00 Dev/ }).click()
}

test('UI-4.1 field box is 260 × 32, 4 px corners, 1 px #B8BEC6 border, 13 px text', async ({ page }) => {
  await openN00(page)
  const input = page.getByLabel('Jog speed')
  const box = await input.boundingBox()
  expect([box?.width, box?.height]).toEqual([260, 32])
  const s = await input.evaluate((e) => {
    const c = getComputedStyle(e)
    return [c.borderRadius, c.borderTopWidth, c.borderTopColor, c.fontSize, c.backgroundColor]
  })
  expect(s).toEqual(['4px', '1px', 'rgb(184, 190, 198)', '13px', 'rgb(255, 255, 255)'])
})

test('UI-4.2 label: 11 px grey, 2 px above the box', async ({ page }) => {
  await openN00(page)
  const field = page.locator('.field', { has: page.getByLabel('Jog speed') })
  const label = field.locator('.field-label')
  const [lb, ib] = [await label.boundingBox(), await page.getByLabel('Jog speed').boundingBox()]
  expect(await label.evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).color])).toEqual(['11px', 'rgb(95, 102, 112)'])
  expect(Math.round((ib?.y ?? 0) - ((lb?.y ?? 0) + (lb?.height ?? 0)))).toBe(2)
})

test('UI-4.3 unit "mm" sits inside the box on the right', async ({ page }) => {
  await openN00(page)
  const input = page.getByLabel('Target position')
  const unit = page.locator('.field', { has: input }).locator('.field-unit')
  const [ib, ub] = [await input.boundingBox(), await unit.boundingBox()]
  expect(await unit.textContent()).toBe('mm')
  const rightGap = (ib?.x ?? 0) + (ib?.width ?? 0) - ((ub?.x ?? 0) + (ub?.width ?? 0))
  expect(Math.round(rightGap)).toBe(6)
})

test('UI-4.4 typing out of range shows the red error; fixing it clears it', async ({ page }) => {
  // the field's alert only: since step 14 the red alarm banner is also role=alert
  await openN00(page)
  const input = page.getByLabel('Target position')
  await input.fill('700')
  await expect(input).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.field').getByRole('alert')).toHaveText('Allowed range 0 … 600 mm')
  expect(await input.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgb(211, 47, 47)')
  await expect(page.getByTestId('form-echo')).toContainText('position —')
  await input.fill('120.5')
  await expect(input).not.toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.field').getByRole('alert')).toHaveCount(0)
  await expect(page.getByTestId('form-echo')).toContainText('position 120.5 mm')
})

test('UI-4.5 select: same 260 × 32 box, mouse and keyboard choose a recipe', async ({ page }) => {
  await openN00(page)
  const sel = page.getByLabel('Recipe')
  const box = await sel.boundingBox()
  expect([box?.width, box?.height]).toEqual([260, 32])
  await sel.selectOption('B-01') // like picking with the mouse
  await expect(page.getByTestId('form-echo')).toContainText('recipe B-01')
  await sel.focus()
  await page.keyboard.press('ArrowUp') // keyboard: one up
  await expect(page.getByTestId('form-echo')).toContainText('recipe A-13')
  await expect(sel.locator('option', { hasText: 'archived' })).toBeDisabled()
})

test('UI-4.6 focus shows the blue edge; Tab moves field → select', async ({ page }) => {
  await openN00(page)
  const input = page.getByLabel('Jog speed')
  await input.focus()
  expect(await input.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe('rgb(43, 95, 168)')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('Axis (choose)')).toBeFocused()
  await expect(page.getByLabel('Cycle counter (read only)')).toBeDisabled()
})
