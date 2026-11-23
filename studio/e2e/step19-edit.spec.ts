/** Step 19 · N03 cell editing: the right editor per column, refused input, address picker, unsaved changes. */
import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.locator('.tabulator-row').first()).toBeVisible()
})

const row = (page: Page, name: string): Locator =>
  page.locator('.tabulator-row').filter({ has: page.locator(`.tabulator-cell[tabulator-field="name"]:text-is("${name}")`) })
const cell = (page: Page, name: string, field: string): Locator => row(page, name).locator(`.tabulator-cell[tabulator-field="${field}"]`)
const editor = (page: Page): Locator => page.locator('.tabulator-cell.tabulator-editing input')
const toast = (page: Page): Locator => page.getByRole('status')

test('UI-19.1 text editor: double-click Comment, type, Enter → kept, unsaved mark, Save clears it', async ({ page }) => {
  await cell(page, 'R_S1_Step', 'comment').dblclick()
  await editor(page).fill('Step number of station 1')
  await editor(page).press('Enter')
  await expect(cell(page, 'R_S1_Step', 'comment')).toHaveText('Step number of station 1')
  await expect(page.getByTestId('project-dirty')).toHaveText('● unsaved changes')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(toast(page)).toContainText('Saved (browser) projects/demo/tags.json')
  await expect(page.getByTestId('project-dirty')).toHaveCount(0)
})

test('UI-19.2 wrong type refused: Init "abc" for a DINT → message, old value back', async ({ page }) => {
  await cell(page, 'R_PartCount', 'init').dblclick()
  await editor(page).fill('abc')
  await editor(page).press('Enter')
  await expect(toast(page)).toContainText("Not changed: 'abc' is not a whole number (DINT)")
  await expect(cell(page, 'R_PartCount', 'init')).toHaveText('0')
  await expect(page.getByTestId('project-dirty')).toHaveCount(0)
})

test('UI-19.3 list editor for Type on a register; no editor where the type is fixed (DI)', async ({ page }) => {
  await cell(page, 'R_S1_Step', 'type').dblclick()
  await page.locator('.tabulator-edit-list .tabulator-edit-list-item', { hasText: 'REAL' }).click()
  await expect(cell(page, 'R_S1_Step', 'type')).toHaveText('REAL')
  await cell(page, 'DI_S1_ClampOpen', 'type').dblclick()
  await expect(page.locator('.tabulator-edit-list')).toHaveCount(0)
  await expect(editor(page)).toHaveCount(0)
})

test('UI-19.4 Retain toggles with a click where allowed (register), not on an input', async ({ page }) => {
  await cell(page, 'R_S1_Step', 'retain').click()
  await expect(cell(page, 'R_S1_Step', 'retain')).toHaveText('✓')
  await cell(page, 'R_S1_Step', 'retain').click()
  await expect(cell(page, 'R_S1_Step', 'retain')).toHaveText('')
  await cell(page, 'DI_S1_PartPresent', 'retain').click()
  await expect(cell(page, 'DI_S1_PartPresent', 'retain')).toHaveText('')
})

test('UI-19.5 address picker: double-click Address → dialog; channel 12 → ecat 3:12; Esc changes nothing', async ({ page }) => {
  await cell(page, 'DI_S1_PartPresent', 'address').dblclick()
  const dlg = page.getByRole('dialog', { name: 'Address · DI_S1_PartPresent' })
  await expect(dlg).toBeVisible()
  await expect(dlg.getByLabel('Bus')).toBeFocused() // first field gets the focus
  await dlg.getByLabel('Channel').fill('300')
  await dlg.getByRole('button', { name: 'OK' }).click()
  await expect(toast(page)).toContainText('Not changed: channel is a whole number 0 … 255')
  await expect(dlg).toBeVisible() // stays open to fix it
  await dlg.getByLabel('Channel').fill('12')
  await dlg.getByRole('button', { name: 'OK' }).click()
  await expect(dlg).toHaveCount(0)
  await expect(cell(page, 'DI_S1_PartPresent', 'address')).toHaveText('ecat 3:12')
  await cell(page, 'DI_S1_PartPresent', 'address').dblclick()
  await page.getByRole('dialog').getByLabel('Channel').fill('99')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(cell(page, 'DI_S1_PartPresent', 'address')).toHaveText('ecat 3:12')
})

test('UI-19.6 address picker from the details panel; memory tags have none', async ({ page }) => {
  await row(page, 'AX_S1_X').click()
  await page.getByRole('button', { name: 'Change address…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Address · AX_S1_X' })
  await expect(dlg.getByLabel('Channel')).toHaveCount(0) // a drive has no channel
  await dlg.getByLabel('Slave (drive)').fill('9')
  await dlg.getByLabel('Slave (drive)').press('Enter')
  await expect(cell(page, 'AX_S1_X', 'address')).toHaveText('ecat 9')
  await page.waitForTimeout(200)
  await expect(page.getByRole('dialog')).toHaveCount(0) // the Enter must not re-open it (found in step 19)
  await row(page, 'R_PartCount').click()
  await expect(page.getByRole('button', { name: 'Change address…' })).toHaveCount(0)
})

test('UI-19.7 rename: good name kept and still selected; a wrong prefix is refused', async ({ page }) => {
  await row(page, 'DO_S1_Vacuum').click()
  await cell(page, 'DO_S1_Vacuum', 'name').dblclick()
  await editor(page).fill('DO_S1_VacuumOn')
  await editor(page).press('Enter')
  await expect(row(page, 'DO_S1_VacuumOn')).toHaveClass(/tabulator-selected/)
  await expect(page.locator('.tgs-details')).toContainText('Tag details · DO_S1_VacuumOn')
  await cell(page, 'DO_S1_VacuumOn', 'name').dblclick()
  await editor(page).fill('DI_S1_VacuumOn')
  await editor(page).press('Enter')
  await expect(toast(page)).toContainText('Not changed: a DO name must start with DO_')
  await expect(row(page, 'DO_S1_VacuumOn')).toHaveCount(1)
})

test('UI-19.8 Open project… with unsaved changes asks first', async ({ page }) => {
  await cell(page, 'R_S1_Step', 'comment').dblclick()
  await editor(page).fill('not saved')
  await editor(page).press('Enter')
  await page.getByRole('button', { name: 'Open project…' }).click()
  const q = page.getByRole('alertdialog', { name: 'Discard unsaved changes?' })
  await expect(q).toBeVisible()
  await q.getByRole('button', { name: 'Cancel' }).click()
  await expect(cell(page, 'R_S1_Step', 'comment')).toHaveText('not saved')
  await expect(page.getByTestId('project-dirty')).toBeVisible()
})
