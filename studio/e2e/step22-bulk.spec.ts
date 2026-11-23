/** Step 22 · Bulk tools (generate I/O, copy station) and Excel / CSV import preview + export. */
import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.locator('.tabulator-row').first()).toBeVisible()
})

const row = (page: Page, name: string): Locator =>
  page.locator('.tabulator-row').filter({ has: page.locator('.tabulator-cell[tabulator-field="name"]', { hasText: new RegExp(`^${name}$`) }) })
const count = (page: Page): Locator => page.getByTestId('grid-count')
/** nothing inside the dialog sticks out on the right (found in step 22: content wider than the 420 px dialog) */
async function fitsInside(dlg: Locator): Promise<void> {
  const out = await dlg.evaluate((e) => {
    const r = e.getBoundingClientRect().right + 0.5
    return [...e.querySelectorAll('*')].filter((c) => c.getBoundingClientRect().right > r).map((c) => c.className || c.tagName)
  })
  expect(out).toEqual([])
}

test('UI-22.1 Bulk › Generate I/O: 32 inputs for one card with a preview; one Ctrl+Z takes all back', async ({ page }) => {
  await page.getByRole('button', { name: 'Bulk…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Bulk tools' })
  await dlg.getByLabel('Station (scope)').fill('S3')
  await dlg.getByLabel('Slave').fill('20')
  await expect(dlg.getByTestId('bulk-preview')).toHaveText('DI_S3_000 … DI_S3_031 on ecat 20:0…31')
  await fitsInside(dlg)
  await dlg.getByRole('button', { name: 'Generate' }).click()
  await expect(dlg).toHaveCount(0)
  await expect(count(page)).toHaveText('52 tags')
  await expect(row(page, 'DI_S3_000')).toHaveClass(/tabulator-selected/)
  await expect(page.getByTestId('project-problems')).toHaveCount(0)
  await page.keyboard.press('Control+z')
  await expect(count(page)).toHaveText('20 tags')
})

test('UI-22.2 Bulk › Copy station S1 → S6 on free cards: clean, references follow', async ({ page }) => {
  await page.getByRole('button', { name: 'Bulk…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Bulk tools' })
  await dlg.getByRole('tab', { name: 'Copy station' }).click()
  await dlg.getByLabel('To station').fill('S6')
  await expect(dlg.getByTestId('copy-preview')).toContainText('tags: AX_S1_X → AX_S6_X')
  await fitsInside(dlg)
  await dlg.getByRole('button', { name: 'Copy' }).click()
  await expect(row(page, 'DI_S6_PartPresent')).toHaveCount(1)
  await expect(page.getByTestId('project-problems')).toHaveCount(0)
  await row(page, 'P_S6_Pick').click()
  await expect(page.locator('.tgs-details')).toContainText('Tag details · P_S6_Pick')
})

test('UI-22.3 Import… shows a preview first; Merge applies it as one change; Ctrl+Z takes it back', async ({ page }) => {
  await page.getByRole('button', { name: 'Import…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Import tags' })
  await expect(dlg).toContainText('(browser) tags-edited.xlsx · 22 rows read')
  await expect(dlg.getByTestId('imp-new')).toHaveText('2 · R_Excel_1, R_Excel_2')
  await expect(dlg.getByTestId('imp-changed')).toHaveText('1 · R_S1_Step')
  await expect(dlg.getByRole('alert')).toContainText("row 24 (R_Bad): column 'more' is not valid JSON")
  await fitsInside(dlg)
  await expect(count(page)).toHaveText('20 tags') // nothing yet
  await dlg.getByRole('button', { name: 'Import' }).click()
  await expect(count(page)).toHaveText('22 tags')
  await expect(row(page, 'R_S1_Step').locator('[tabulator-field="comment"]')).toHaveText('Edited in Excel')
  await page.keyboard.press('Control+z')
  await expect(count(page)).toHaveText('20 tags')
})

test('UI-22.4 Import preview: Cancel changes nothing; Replace turns the button red', async ({ page }) => {
  await page.getByRole('button', { name: 'Import…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Import tags' })
  await dlg.getByRole('radio', { name: 'Replace all' }).click()
  await expect(dlg.getByRole('button', { name: 'Import' })).toHaveClass(/btn-danger/)
  await dlg.getByRole('button', { name: 'Cancel' }).click()
  await expect(dlg).toHaveCount(0)
  await expect(count(page)).toHaveText('20 tags')
  await expect(page.getByTestId('project-dirty')).toHaveCount(0)
})

test('UI-22.5 Export… says where the file went', async ({ page }) => {
  await page.getByRole('button', { name: 'Export…' }).click()
  await expect(page.getByRole('status')).toContainText('Exported 20 tags to (browser) projects/demo/demo-tags.xlsx')
})
