/** Step 21 · Add / duplicate / delete rows; undo / redo (Ctrl+Z / Ctrl+Y, 20 steps). */
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
const toast = (page: Page): Locator => page.getByRole('status')

test('UI-21.1 + New tag: dialog with kind and name; the new tag is added, selected and clean', async ({ page }) => {
  await page.getByRole('button', { name: 'New tag' }).click()
  const dlg = page.getByRole('dialog', { name: 'New tag' })
  await dlg.getByLabel('Kind').selectOption('DI')
  await expect(dlg.getByLabel('Name')).toHaveAttribute('placeholder', 'DI_New_1')
  await dlg.getByRole('button', { name: 'Add' }).click()
  await expect(dlg).toHaveCount(0)
  await expect(count(page)).toHaveText('21 tags')
  await expect(row(page, 'DI_New_1')).toHaveClass(/tabulator-selected/)
  await expect(row(page, 'DI_New_1').locator('[tabulator-field="address"]')).toHaveText('sim 0:0')
  await expect(page.getByTestId('project-problems')).toHaveCount(0)
})

test('UI-21.2 Delete key removes the selected row; Ctrl+Z brings it back; Ctrl+Y removes it again', async ({ page }) => {
  await row(page, 'R_S1_Step').click()
  await page.keyboard.press('Delete')
  await expect(row(page, 'R_S1_Step')).toHaveCount(0)
  await expect(toast(page)).toContainText('Deleted R_S1_Step — Ctrl+Z brings it back')
  await expect(count(page)).toHaveText('19 tags')
  await page.keyboard.press('Control+z')
  await expect(row(page, 'R_S1_Step')).toHaveCount(1)
  await expect(count(page)).toHaveText('20 tags')
  await expect(page.getByTestId('project-dirty')).toHaveCount(0) // back to the saved table
  await page.keyboard.press('Control+y')
  await expect(row(page, 'R_S1_Step')).toHaveCount(0)
  await page.keyboard.press('Control+Shift+z')
  await expect(toast(page)).toContainText('Nothing to redo')
})

test('UI-21.3 Duplicate in Tag details: copy on the next free channel, selected', async ({ page }) => {
  await row(page, 'DO_S1_Vacuum').click()
  await page.getByRole('button', { name: 'Duplicate' }).click()
  await expect(row(page, 'DO_S1_Vacuum_2')).toHaveClass(/tabulator-selected/)
  await expect(row(page, 'DO_S1_Vacuum_2').locator('[tabulator-field="address"]')).toHaveText('ecat 4:0')
  await expect(page.getByTestId('project-problems')).toHaveCount(0)
})

test('UI-21.4 Undo / Redo buttons follow the history; Ctrl+Z while typing stays in the text box', async ({ page }) => {
  const undo = page.getByRole('button', { name: 'Undo (Ctrl+Z)' })
  const redo = page.getByRole('button', { name: 'Redo (Ctrl+Y)' })
  await expect(undo).toBeDisabled()
  await expect(redo).toBeDisabled()
  await row(page, 'R_S1_Step').locator('[tabulator-field="comment"]').dblclick()
  await page.locator('.tabulator-editing input').fill('changed')
  await page.locator('.tabulator-editing input').press('Enter')
  await expect(undo).toBeEnabled()
  await undo.click()
  await expect(row(page, 'R_S1_Step').locator('[tabulator-field="comment"]')).toHaveText('Station 1 flow step')
  await expect(redo).toBeEnabled()
  await redo.click()
  await expect(row(page, 'R_S1_Step').locator('[tabulator-field="comment"]')).toHaveText('changed')
  // in the search box Ctrl+Z is the text box's own undo — the table must not change
  await page.getByRole('searchbox', { name: 'Search tags' }).fill('x')
  await page.getByRole('searchbox', { name: 'Search tags' }).press('Control+z')
  await page.getByRole('searchbox', { name: 'Search tags' }).fill('')
  await expect(row(page, 'R_S1_Step').locator('[tabulator-field="comment"]')).toHaveText('changed')
})

test('UI-21.5 deleting an axis makes its points red; undo fixes it', async ({ page }) => {
  await row(page, 'AX_S1_Z').click()
  await page.getByRole('button', { name: 'Delete (Del)' }).click()
  await expect(page.getByTestId('project-problems')).toHaveText('⚠ 2 problems')
  await page.keyboard.press('Control+z')
  await expect(page.getByTestId('project-problems')).toHaveCount(0)
})
