/** Step 20 · Validation: rules across tags, red cell + tooltip, Save blocked until fixed; kind and scaling edits. */
import { expect, test, type Locator, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.locator('.tabulator-row').first()).toBeVisible()
})

const row = (page: Page, name: string): Locator =>
  page.locator('.tabulator-row').filter({ has: page.locator('.tabulator-cell[tabulator-field="name"]', { hasText: new RegExp(`^${name}$`) }) })
const cell = (page: Page, name: string, field: string): Locator => row(page, name).locator(`.tabulator-cell[tabulator-field="${field}"]`)
const toast = (page: Page): Locator => page.getByRole('status')
const problems = (page: Page): Locator => page.getByTestId('project-problems')

async function setChannel(page: Page, name: string, ch: string): Promise<void> {
  await cell(page, name, 'address').dblclick()
  const dlg = page.getByRole('dialog', { name: `Address · ${name}` })
  await dlg.getByLabel('Channel').fill(ch)
  await dlg.getByRole('button', { name: 'OK' }).click()
  await expect(dlg).toHaveCount(0)
}

test('UI-20.1 the demo has no problems', async ({ page }) => {
  await expect(problems(page)).toHaveCount(0)
  await expect(page.locator('.cell-bad')).toHaveCount(0)
})

test('UI-20.2 address used twice: both cells red with the reason as tooltip, ⚠ on the rows, problem count', async ({ page }) => {
  await setChannel(page, 'DI_S1_ClampOpen', '0') // = DI_S1_PartPresent
  const a = cell(page, 'DI_S1_ClampOpen', 'address')
  await expect(a).toHaveClass(/cell-bad/)
  await expect(a).toHaveAttribute('title', 'address ecat 3:0 is also used by DI_S1_PartPresent')
  await expect(a).toHaveAttribute('aria-invalid', 'true')
  await expect(cell(page, 'DI_S1_PartPresent', 'address')).toHaveClass(/cell-bad/)
  await expect(row(page, 'DI_S1_PartPresent')).toHaveClass(/row-bad/)
  expect(await a.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(253, 226, 226)') // --fault-bg
  await expect(problems(page)).toHaveText('⚠ 2 problems')
})

test('UI-20.3 Save is blocked until fixed, then works', async ({ page }) => {
  await setChannel(page, 'DI_S1_ClampOpen', '0')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(toast(page)).toContainText('Not saved: 2 problems — DI_S1_ClampOpen: address ecat 3:0 is also used by DI_S1_PartPresent')
  await expect(page.getByTestId('project-dirty')).toBeVisible()
  await setChannel(page, 'DI_S1_ClampOpen', '5')
  await expect(problems(page)).toHaveCount(0)
  await expect(page.locator('.cell-bad')).toHaveCount(0)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(toast(page)).toContainText('Saved (browser) projects/demo/tags.json')
})

test('UI-20.4 the problem button goes to the tag; details list its problems', async ({ page }) => {
  await cell(page, 'R_S1_Step', 'init').dblclick()
  await page.locator('.tabulator-editing input').fill('1500')
  await page.locator('.tabulator-editing input').press('Enter')
  await expect(cell(page, 'R_S1_Step', 'init')).toHaveAttribute('title', 'init 1500 is above max 999')
  await page.getByRole('radio', { name: 'Outputs' }).click() // the bad tag is filtered out …
  await problems(page).click() // … the button shows all again and selects it
  await expect(row(page, 'R_S1_Step')).toHaveClass(/tabulator-selected/)
  await expect(page.getByRole('list', { name: 'Problems' })).toHaveText('⚠ init 1500 is above max 999')
})

test('UI-20.5 kind change in the details: asks first, then red cells show what the new kind needs', async ({ page }) => {
  await row(page, 'R_S1_Step').click()
  const kind = page.locator('.tgs-details').getByLabel('Kind')
  await kind.selectOption('AI')
  const q = page.getByRole('alertdialog', { name: 'Change R_S1_Step to AI?' })
  await expect(q).toContainText('dtype INT')
  await q.getByRole('button', { name: 'Cancel' }).click()
  await expect(kind).toHaveValue('REG')
  await kind.selectOption('AI')
  await page.getByRole('alertdialog').getByRole('button', { name: 'Change to AI' }).click()
  await expect(cell(page, 'R_S1_Step', 'name')).toHaveAttribute('title', 'a AI name must start with AI_')
  await expect(cell(page, 'R_S1_Step', 'address')).toHaveClass(/cell-bad/)
  await expect(cell(page, 'R_S1_Step', 'unit')).toHaveClass(/cell-bad/)
  await expect(problems(page)).toHaveText('⚠ 4 problems')
})

test('UI-20.6 scaling dialog: a falling raw range is kept and shown red; fixing it clears it', async ({ page }) => {
  await row(page, 'AI_Sealer_Temp').click()
  await page.getByRole('button', { name: 'Change scaling…' }).click()
  const dlg = page.getByRole('dialog', { name: 'Scaling · AI_Sealer_Temp' })
  await dlg.getByLabel('Raw high').fill('-1')
  await dlg.getByRole('button', { name: 'OK' }).click()
  await expect(cell(page, 'AI_Sealer_Temp', 'unit')).toHaveAttribute('title', 'raw range 0 … -1 must rise')
  await expect(page.locator('.tgs-details')).toContainText('raw 0 … -1 → 0 … 400 degC')
  await page.getByRole('button', { name: 'Change scaling…' }).click()
  await page.getByRole('dialog').getByLabel('Raw high').fill('27648')
  await page.getByRole('dialog').getByLabel('Raw high').press('Enter')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(problems(page)).toHaveCount(0)
})

test('UI-20.7 renaming an axis breaks the points that use it; renaming back fixes them', async ({ page }) => {
  await cell(page, 'AX_S1_X', 'name').dblclick()
  await page.locator('.tabulator-editing input').fill('AX_S1_Gantry')
  await page.locator('.tabulator-editing input').press('Enter')
  await expect(cell(page, 'P_S1_Pick', 'name')).toHaveAttribute('title', 'axis AX_S1_X does not exist')
  await expect(cell(page, 'P_S1_Place', 'name')).toHaveClass(/cell-bad/)
  await cell(page, 'AX_S1_Gantry', 'name').dblclick()
  await page.locator('.tabulator-editing input').fill('AX_S1_X')
  await page.locator('.tabulator-editing input').press('Enter')
  await expect(page.locator('.cell-bad')).toHaveCount(0)
})
