/** Step 18 · N03 tag grid (read): Tabulator, sort, filters, details, 1000 tags. */
import { expect, test, type Page } from '@playwright/test'

async function openTags(page: Page, url = '/'): Promise<void> {
  await page.goto(url)
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByTestId('tag-grid').locator('.tabulator-row').first()).toBeVisible()
}
const names = (page: Page) => page.locator('.tabulator-row .tabulator-cell[tabulator-field="name"]')

test('UI-18.1 the demo project shows 20 rows, sorted by name, with the 10 design columns (no page errors)', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await openTags(page)
  await expect(names(page)).toHaveCount(20)
  await expect(names(page).first()).toHaveText('AI_Sealer_Temp')
  await expect(page.getByTestId('grid-count')).toHaveText('20 tags')
  const heads = await page.locator('.tabulator-col .tabulator-col-title').allTextContents()
  expect(heads).toEqual(['Name', 'Address', 'Type', 'Scope', 'Unit', 'Init', 'Retain', 'Mapped to', 'Live value', 'Comment'])
  await page.waitForTimeout(300)
  expect(errors).toEqual([]) // React dev mounts twice: the grid must survive that (Tabulator build is async)
})

test('UI-18.2 clicking the Name header sorts Z→A, again A→Z', async ({ page }) => {
  await openTags(page)
  const head = page.locator('.tabulator-col[tabulator-field="name"]')
  await head.click()
  await expect(head).toHaveAttribute('aria-sort', 'descending')
  await expect(names(page).first()).toHaveText('T_S1_ClampDwell')
  await head.click()
  await expect(head).toHaveAttribute('aria-sort', 'ascending')
  await expect(names(page).first()).toHaveText('AI_Sealer_Temp')
})

test('UI-18.3 kind group Outputs: 4 rows, count says 4 of 20', async ({ page }) => {
  await openTags(page)
  await page.getByRole('radio', { name: 'Outputs' }).click()
  await expect(names(page)).toHaveText(['AO_Dispense_Pressure', 'DO_S1_ClampValve', 'DO_S1_Vacuum', 'DO_S2_HeaterOn'])
  await expect(page.getByTestId('grid-count')).toHaveText('4 of 20 tags')
  await page.getByRole('radio', { name: 'All' }).click()
  await expect(names(page)).toHaveCount(20)
})

test('UI-18.4 search, Scope and Type work together', async ({ page }) => {
  await openTags(page)
  await page.getByRole('searchbox', { name: 'Search tags' }).fill('clamp')
  await expect(names(page)).toHaveCount(5)
  await page.getByRole('searchbox', { name: 'Search tags' }).fill('')
  await page.getByRole('combobox', { name: 'Scope' }).selectOption('S2')
  await page.getByRole('combobox', { name: 'Type' }).selectOption('BOOL')
  await expect(names(page)).toHaveText(['DI_S2_DoorClosed', 'DO_S2_HeaterOn'])
  await page.getByRole('searchbox', { name: 'Search tags' }).fill('zzz')
  await expect(page.locator('.tabulator-placeholder')).toContainText('No tags match the filter')
  await expect(page.getByTestId('grid-count')).toHaveText('0 of 20 tags')
})

test('UI-18.5 clicking a row selects it and shows Tag details', async ({ page }) => {
  await openTags(page)
  await expect(page.getByRole('table', { name: 'Tags by kind' })).toBeVisible()
  const row = page.locator('.tabulator-row', { hasText: 'AI_Sealer_Temp' })
  await row.click()
  await expect(row).toHaveClass(/tabulator-selected/)
  const details = page.locator('.tgs-details')
  await expect(details).toContainText('Tag details · AI_Sealer_Temp')
  await expect(details).toContainText('ecat 5:1')
  await expect(details).toContainText('code 410 · hi 250 · hihi 280')
})

test('UI-18.6 sizes from the design: 38 px rows, dark header, 384 px details, Name : Comment = 240 : 340', async ({ page }) => {
  await openTags(page)
  const z = await page.locator('.shell').evaluate((e) => Number(getComputedStyle(e).zoom) || 1)
  const rowH = (await page.locator('.tabulator-row').first().boundingBox())!.height
  expect(Math.round(rowH / z)).toBe(38)
  expect(await page.locator('.tabulator-header .tabulator-col').first().evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(74, 85, 98)')
  expect(Math.round((await page.locator('.tgs-details').boundingBox())!.width / z)).toBe(384)
  const w = async (f: string): Promise<number> => (await page.locator(`.tabulator-col[tabulator-field="${f}"]`).boundingBox())!.width
  expect((await w('name')) / (await w('comment'))).toBeCloseTo(240 / 340, 1)
})

test('UI-18.7 1000 tags: only the rows in view are drawn; scrolling reaches the last tag', async ({ page }) => {
  await openTags(page, '/?project=big')
  await expect(page.getByTestId('grid-count')).toHaveText('1000 tags')
  const drawn = await page.locator('.tabulator-row').count()
  expect(drawn).toBeLessThan(100) // virtual rendering
  const holder = page.locator('.tabulator-tableholder')
  const t0 = Date.now()
  for (let i = 0; i < 10; i++) await holder.evaluate((e, k) => (e.scrollTop = (e.scrollHeight * (k + 1)) / 10), i)
  await expect(names(page).last()).toHaveText('T_S9_003')
  expect(Date.now() - t0).toBeLessThan(3000)
})

test('UI-18.8 at 1280 × 720 the toolbar fits and the grid is visible', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await openTags(page)
  const tb = page.locator('.tgs-toolbar')
  expect(await tb.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true)
  const box = await page.getByTestId('tag-grid').boundingBox()
  expect(box!.height).toBeGreaterThan(200)
  await expect(page.getByRole('button', { name: 'New tag' })).toBeVisible()
})

test('UI-18.9 dark theme: grid text is light on dark rows (readable)', async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Admin' }).click()
  await page.getByRole('radio', { name: 'Dark' }).click()
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  const cell = page.locator('.tabulator-row .tabulator-cell[tabulator-field="name"]').first()
  await expect(cell).toBeVisible()
  expect(await cell.evaluate((e) => getComputedStyle(e).color)).toBe('rgb(230, 233, 237)') // --cell-text (dark)
  expect(await page.locator('.tabulator-row').first().evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe('rgb(255, 255, 255)')
})
