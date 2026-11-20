/** Step 8 · Dialog + toast: look, keyboard-only use, focus trap, toast shows and hides. */
import { expect, test, type Page } from '@playwright/test'

async function openN00(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /N00 Dev/ }).click()
}

test('UI-8.1 dialog look: 420 px wide, white, 8 px corners, title bold 14 px, backdrop dims the screen', async ({ page }) => {
  await openN00(page)
  await page.getByRole('button', { name: 'Delete recipe…' }).click()
  const dlg = page.getByRole('alertdialog', { name: 'Delete recipe A-13?' })
  await expect(dlg).toBeVisible()
  expect(Math.round((await dlg.boundingBox())?.width ?? 0)).toBe(420)
  expect(await dlg.evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderRadius])).toEqual([
    'rgb(255, 255, 255)',
    '8px'
  ])
  const title = dlg.getByRole('heading')
  expect(await title.evaluate((e) => [getComputedStyle(e).fontSize, getComputedStyle(e).fontWeight])).toEqual(['14px', '700'])
  expect(await page.locator('.dlg-backdrop').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgba(31, 35, 40, 0.45)')
  await expect(dlg.getByRole('button', { name: 'Delete' })).toHaveClass(/btn-danger/)
})

test('UI-8.2 focus is trapped: Tab cycles ✕ → Cancel → Delete → ✕ and never reaches the page', async ({ page }) => {
  await openN00(page)
  await page.getByRole('button', { name: 'Delete recipe…' }).click()
  const dlg = page.getByRole('alertdialog')
  await expect(dlg.getByRole('button', { name: 'Cancel' })).toBeFocused()
  const seen: string[] = []
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab')
    seen.push(await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.textContent ?? ''))
  }
  expect(seen).toEqual(['Delete', 'Close', 'Cancel', 'Delete', 'Close', 'Cancel'])
})

test('UI-8.3 keyboard only: Esc cancels, Tab + Enter confirms; focus returns to the opener', async ({ page }) => {
  await openN00(page)
  const opener = page.getByRole('button', { name: 'Delete recipe…' })
  await opener.click()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(page.getByTestId('dlg-echo')).toHaveText('answer Cancel')
  await expect(opener).toBeFocused()
  await page.keyboard.press('Enter') // opens again from the keyboard
  await page.keyboard.press('Tab') // Cancel → Delete
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('dlg-echo')).toHaveText('answer Delete')
})

test('UI-8.4 confirm shows a "done" toast bottom-right above the banner; it hides after 4 s', async ({ page }) => {
  await openN00(page)
  await page.getByRole('button', { name: 'Save draft…' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Save draft' }).click()
  const t = page.locator('.toast', { hasText: 'Draft saved' })
  await expect(t).toBeVisible()
  await expect(t).toHaveClass(/toast-done/)
  const [box, banner] = [await t.boundingBox(), await page.locator('footer.banner').boundingBox()]
  expect(Math.round((box?.x ?? 0) + (box?.width ?? 0))).toBe(1920 - 16)
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual((banner?.y ?? 1080) - 16 + 1)
  await expect(t).toBeHidden({ timeout: 6000 })
})

test('UI-8.5 error toast has the red edge; ✕ dismisses at once', async ({ page }) => {
  await openN00(page)
  await page.getByRole('button', { name: 'Error toast' }).click()
  const t = page.locator('.toast', { hasText: 'Export failed' })
  expect(await t.evaluate((e) => getComputedStyle(e).borderLeftColor)).toBe('rgb(211, 47, 47)')
  await t.getByRole('button', { name: 'Dismiss' }).click()
  await expect(t).toHaveCount(0)
})
