/** Step 6 · Table: header look, row size, the three value states, filter and force. */
import { expect, test, type Page } from '@playwright/test'

async function openN00(page: Page): Promise<void> {
  await page.goto('/')
  await page.getByRole('button', { name: /N00 Dev/ }).click()
}

const bg = (el: Element): string => getComputedStyle(el).backgroundColor

test('UI-6.1 header: #4A5562, white bold 13 px, 34 px high; grid lines #C3CEDA', async ({ page }) => {
  await openN00(page)
  const th = page.getByRole('table', { name: 'Value states' }).getByRole('columnheader', { name: 'Tag' })
  const s = await th.evaluate((e) => {
    const c = getComputedStyle(e)
    return [c.backgroundColor, c.color, c.fontWeight, c.fontSize, c.borderTopColor]
  })
  expect(s).toEqual(['rgb(74, 85, 98)', 'rgb(255, 255, 255)', '700', '13px', 'rgb(195, 206, 218)'])
  expect(Math.round((await th.boundingBox())?.height ?? 0)).toBe(34)
})

test('UI-6.2 value-states columns are 220 / 140 / 220 like N00 (580 between the outer lines)', async ({ page }) => {
  await openN00(page)
  const table = page.getByRole('table', { name: 'Value states' })
  // the outer box is 581: the 1 px outer grid line is centred on the table edge (half inside, half outside)
  expect(Math.round((await table.boundingBox())?.width ?? 0)).toBe(581)
  const widths = await table.getByRole('columnheader').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().width)))
  expect(widths).toEqual([220, 140, 220])
})

test('UI-6.3 normal row white, forced row amber with ⓕ, fault row light red', async ({ page }) => {
  await openN00(page)
  const table = page.getByRole('table', { name: 'Value states' })
  const row = (t: string) => table.getByRole('row').filter({ hasText: t })
  expect(await row('Plasma.Ready').evaluate(bg)).toBe('rgba(0, 0, 0, 0)') // transparent → white table shows through
  expect(await row('Clamp.Fwd').evaluate(bg)).toBe('rgb(255, 243, 205)')
  await expect(row('Clamp.Fwd').getByRole('img', { name: 'forced' })).toHaveText('ⓕ')
  expect(await row('Axis2.Pos').evaluate(bg)).toBe('rgb(253, 226, 226)')
})

test('UI-6.4 force / release a tag changes its row to amber and back', async ({ page }) => {
  await openN00(page)
  const tags = page.getByRole('table', { name: 'Tags' })
  const settle = tags.getByRole('row').filter({ hasText: 'Station.Settle' })
  await expect(settle).toHaveAttribute('data-state', 'normal')
  await settle.getByRole('button', { name: 'ⓕ Force' }).click()
  await expect(settle).toHaveAttribute('data-state', 'forced')
  expect(await settle.evaluate(bg)).toBe('rgb(255, 243, 205)')
  await expect(page.getByTestId('tbl-echo')).toContainText('2 forced')
  await settle.getByRole('button', { name: 'Release' }).click()
  await expect(settle).toHaveAttribute('data-state', 'normal')
})

test('UI-6.5 striped list: even rows #F3F6F9 (state colour wins); text columns left-aligned', async ({ page }) => {
  await openN00(page)
  const tags = page.getByRole('table', { name: 'Tags' })
  const rows = tags.locator('tbody tr')
  expect(await rows.nth(1).evaluate(bg)).toBe('rgb(255, 243, 205)') // 2nd row is forced: amber beats the stripe
  await rows.nth(1).getByRole('button', { name: 'Release' }).click()
  expect(await rows.nth(1).evaluate(bg)).toBe('rgb(243, 246, 249)') // now a plain even row: stripe
  expect(await rows.nth(0).evaluate(bg)).toBe('rgba(0, 0, 0, 0)') // odd row: white
  expect(
    await rows
      .nth(0)
      .locator('td')
      .first()
      .evaluate((e) => getComputedStyle(e).textAlign)
  ).toBe('left')
  expect(
    await rows
      .nth(0)
      .locator('td')
      .nth(1)
      .evaluate((e) => getComputedStyle(e).textAlign)
  ).toBe('center')
})

test('UI-6.6 filter with the Segmented: Fault shows one red row; empty text when none', async ({ page }) => {
  await openN00(page)
  const tags = page.getByRole('table', { name: 'Tags' })
  const filter = page.getByRole('radiogroup', { name: 'Tag filter' })
  await filter.getByRole('radio', { name: 'Fault' }).click()
  await expect(tags.locator('tbody tr')).toHaveCount(1)
  await expect(tags.locator('tbody tr')).toHaveAttribute('data-state', 'fault')
  await filter.getByRole('radio', { name: 'Forced' }).click()
  await tags.getByRole('row').filter({ hasText: 'Station.ClampFwd' }).getByRole('button', { name: 'Release' }).click()
  await expect(tags.getByText('No tags match the filter')).toBeVisible()
})
