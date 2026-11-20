/** Step 5 · Segmented + Tabs: look, header uses Segmented, mouse and keyboard. */
import { expect, test, type Page } from '@playwright/test'

async function openN00(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /N00 Dev/ }).click()
}

test('UI-5.1 segments are 110 × 32, square, 12 px; selected is blue with white text', async ({ page }) => {
  await openN00(page)
  const group = page.getByRole('radiogroup', { name: 'Demo mode' })
  const auto = group.getByRole('radio', { name: 'Auto' })
  const box = await auto.boundingBox()
  expect([box?.width, box?.height]).toEqual([110, 32])
  const on = await auto.evaluate((e) => {
    const c = getComputedStyle(e)
    return [c.backgroundColor, c.color, c.borderRadius, c.fontSize]
  })
  expect(on).toEqual(['rgb(43, 95, 168)', 'rgb(255, 255, 255)', '0px', '12px'])
  const off = await group
    .getByRole('radio', { name: 'Manual' })
    .evaluate((e) => [getComputedStyle(e).backgroundColor, getComputedStyle(e).borderTopColor])
  expect(off).toEqual(['rgb(255, 255, 255)', 'rgb(184, 190, 198)'])
})

test('UI-5.2 segments share one border (joined, no gap)', async ({ page }) => {
  await openN00(page)
  const group = page.getByRole('radiogroup', { name: 'Demo mode' })
  const [a, m] = [
    await group.getByRole('radio', { name: 'Auto' }).boundingBox(),
    await group.getByRole('radio', { name: 'Manual' }).boundingBox()
  ]
  expect(Math.round((m?.x ?? 0) - ((a?.x ?? 0) + (a?.width ?? 0)))).toBe(-1)
})

test('UI-5.3 header mode switch is the shared Segmented (dark, 120 × 32) and still works', async ({ page }) => {
  await page.goto('/')
  const group = page.getByRole('radiogroup', { name: 'Machine mode' })
  await expect(group).toHaveClass(/seg seg-dark/)
  const box = await group.getByRole('radio', { name: 'Auto' }).boundingBox()
  expect([box?.width, box?.height]).toEqual([120, 32])
  await group.getByRole('radio', { name: 'Auto' }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(group.getByRole('radio', { name: 'Manual' })).toHaveAttribute('aria-checked', 'true')
  await expect(group.getByRole('radio', { name: 'Manual' })).toBeFocused()
})

test('UI-5.4 keyboard: one Tab stop, arrows select and skip the disabled segment', async ({ page }) => {
  await openN00(page)
  const view = page.getByRole('radiogroup', { name: 'View' })
  await view.getByRole('radio', { name: 'Grid' }).click()
  await page.keyboard.press('ArrowRight') // Chart is disabled → wraps to List
  await expect(view.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByTestId('seg-echo')).toContainText('view list')
  expect(await view.getByRole('radio').evaluateAll((els) => els.map((e) => (e as HTMLElement).tabIndex))).toEqual([0, -1, -1])
})

test('UI-5.5 tabs: 34 px row, selected bold blue with 3 px underline; clicking switches the panel', async ({ page }) => {
  await openN00(page)
  const list = page.getByRole('tablist', { name: 'Station view' })
  const overview = list.getByRole('tab', { name: 'Overview' })
  expect((await overview.boundingBox())?.height).toBe(34)
  const look = await overview.evaluate((e) => {
    const c = getComputedStyle(e)
    const u = getComputedStyle(e, '::after')
    return [c.color, c.fontWeight, u.height, u.backgroundColor]
  })
  expect(look).toEqual(['rgb(43, 95, 168)', '700', '3px', 'rgb(43, 95, 168)'])
  expect(await list.evaluate((e) => getComputedStyle(e).borderBottomColor)).toBe('rgb(184, 190, 198)')
  await list.getByRole('tab', { name: 'Axes' }).click()
  await expect(page.getByRole('tabpanel')).toContainText('Axes panel')
  await expect(page.getByTestId('tab-echo')).toHaveText('tab axes')
})

test('UI-5.6 tabs keyboard: → moves to the next tab, disabled Trace is skipped', async ({ page }) => {
  await openN00(page)
  const list = page.getByRole('tablist', { name: 'Station view' })
  await list.getByRole('tab', { name: 'I/O' }).click()
  await page.keyboard.press('ArrowRight')
  await expect(list.getByRole('tab', { name: 'Overview' })).toHaveAttribute('aria-selected', 'true')
  await expect(list.getByRole('tab', { name: 'Overview' })).toBeFocused()
  await expect(list.getByRole('tab', { name: 'Trace' })).toBeDisabled()
})
