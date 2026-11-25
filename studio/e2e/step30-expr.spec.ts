/** Step 30 · expressions with types: a wrong type is refused in the panel and shown on the node (badge, Build output). */
import { expect, test, type Locator, type Page } from '@playwright/test'

const pal = (page: Page, t: string): Locator => page.getByRole('list', { name: 'Node palette' }).getByRole('button', { name: t, exact: true })
const node = (page: Page, id: string): Locator => page.locator(`.react-flow__node[data-id="${id}"]`)
const tagCell = (page: Page, name: string, field: string): Locator =>
  page
    .locator('.tabulator-row')
    .filter({ has: page.locator('.tabulator-cell[tabulator-field="name"]', { hasText: new RegExp(`^(⚠ )?${name}$`) }) })
    .locator(`.tabulator-cell[tabulator-field="${field}"]`)
async function condition(page: Page, text: string): Promise<void> {
  const f = page.locator('.seq-props').getByLabel('Condition', { exact: true })
  await f.fill(text)
  await f.press('Enter')
}
async function program(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByTestId('project-name')).toHaveText('demo')
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await pal(page, 'Decision').click() // n1
}

test('UI-30.1 the panel refuses a condition with the wrong types and says which part has which type', async ({ page }) => {
  await program(page)
  await condition(page, 'R_PartCount AND DI_S1_PartPresent')
  await expect(page.locator('.seq-props').getByRole('alert')).toHaveText(
    'AND needs TRUE / FALSE on both sides — R_PartCount is a number, DI_S1_PartPresent is TRUE / FALSE'
  )
  await condition(page, 'R_PartCount + 1')
  await expect(page.locator('.seq-props').getByRole('alert')).toHaveText('a condition must give TRUE / FALSE — R_PartCount + 1 gives a number')
  await expect(node(page, 'n1')).toContainText('IF condition?')
  await condition(page, 'R_S1_Step > 1 and not DI_S1_ClampOpen') // the words in any case (tag names exactly as in tags.json)
  await expect(node(page, 'n1')).toContainText('IF R_S1_Step > 1 and not DI_S1_ClampOpen')
})

test('UI-30.2 a type that changes in Tags shows on the node: badge with the reason, line in Build output', async ({ page }) => {
  await program(page)
  await condition(page, 'R_S1_Step > 1')
  await expect(node(page, 'n1').locator('.seq-badge')).not.toHaveAttribute('title', /condition/)
  // R_S1_Step becomes a BOOL register in N03 — '> 1' no longer fits
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await tagCell(page, 'R_S1_Step', 'type').dblclick()
  await page.locator('.tabulator-edit-list .tabulator-edit-list-item', { hasText: /^BOOL$/ }).click()
  await page.locator('.rail-item', { hasText: 'Program' }).click()
  await expect(node(page, 'n1').locator('.seq-badge')).toHaveAttribute(
    'title',
    /condition: > needs numbers on both sides — R_S1_Step is TRUE \/ FALSE, 1 is a number/
  )
  await page.getByRole('tab', { name: 'Build output' }).click()
  await expect(page.locator('.seq-build')).toContainText('Decision (n1) — condition: > needs numbers on both sides')
})
