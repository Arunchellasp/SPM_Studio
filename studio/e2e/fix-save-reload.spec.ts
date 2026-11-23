/** Found on the PC in the step 25 physical test (P-20.3): Save rewrote projects/demo/tags.json, the dev server
 *  reloaded the screens on that change and the open project was lost (back to N01). projects/ is data, not code. */
import { expect, test } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const DEMO = resolve(__dirname, '../../projects/demo/tags.json')

test('UI-F1 a change to projects/…/tags.json on disk does not reload the screens; the open project stays', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => ((window as unknown as { __kept: number }).__kept = 1))
  await page.locator('.rail-item', { hasText: 'Tags' }).click()
  await page.getByRole('button', { name: 'Open project…' }).click()
  await expect(page.getByTestId('project-name')).toHaveText('demo')
  writeFileSync(DEMO, readFileSync(DEMO)) // what Save does on the PC (same bytes, new write)
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => (window as unknown as { __kept?: number }).__kept)).toBe(1)
  await expect(page.getByTestId('project-name')).toHaveText('demo')
  await expect(page.locator('.rail-item.active')).toContainText('Tags')
})
