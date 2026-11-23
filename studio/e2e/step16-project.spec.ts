/** Step 16 · Open / save project (N03 Tags project card; browser stand-in opens projects/demo). */
import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Tags/ }).click()
})

test('UI-16.1 N03 without a project: hint, Open enabled, Save disabled', async ({ page }) => {
  await expect(page.getByTestId('project-none')).toContainText('No project open')
  await expect(page.getByRole('button', { name: 'Open project…' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled()
})

test('UI-16.2 Open project… shows the project and its tag count, with a toast', async ({ page }) => {
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByTestId('project-name')).toHaveText('demo')
  await expect(page.getByTestId('project-count')).toHaveText('20 tags · format spm.tags/1')
  await expect(page.getByRole('status').filter({ hasText: 'Opened demo · 20 tags' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled()
})

test('UI-16.3 Tags by kind: 12 kinds, counts add up to 20', async ({ page }) => {
  await page.getByRole('button', { name: 'Open project…' }).click()
  const table = page.getByRole('table', { name: 'Tags by kind' })
  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(12)
  await expect(rows.first()).toContainText('DI')
  await expect(rows.first()).toContainText('Digital input')
  await expect(rows.first()).toContainText('4')
  const counts = await rows.locator('td:last-child').allTextContents()
  expect(counts.map(Number).reduce((a, b) => a + b, 0)).toBe(20)
})

test('UI-16.4 Save right after Open: nothing to write', async ({ page }) => {
  await page.getByRole('button', { name: 'Open project…' }).click()
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'No changes — tags.json is already up to date' })).toBeVisible()
})

test('UI-16.5 the project stays open when going to another screen and back', async ({ page }) => {
  await page.getByRole('button', { name: 'Open project…' }).click()
  await page.getByRole('button', { name: /Operate/ }).click()
  await page.getByRole('button', { name: /Tags/ }).click()
  await expect(page.getByTestId('project-count')).toHaveText('20 tags · format spm.tags/1')
})
