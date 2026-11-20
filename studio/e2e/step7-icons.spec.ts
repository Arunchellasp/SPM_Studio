/** Step 7 · Icons: SVG everywhere a text glyph used to be; sizes; no glyph characters left. */
import { expect, test } from '@playwright/test'

// the placeholder glyphs of the design that must not appear as text any more
const GLYPHS = /[▣⧉⇄↔☰⚠∿▤⚙◧▶❚■↺▾ⓕ⌂]/ // '›' stays: it is the breadcrumb separator in titles, text not an icon

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('UI-7.1 every rail button shows one 24 × 24 SVG icon and no glyph text', async ({ page }) => {
  const items = page.getByRole('navigation', { name: 'Task areas' }).getByRole('button')
  const n = await items.count()
  expect(n).toBe(11) // N01–N10 + N00 Dev
  for (let i = 0; i < n; i++) {
    const svg = items.nth(i).locator('svg')
    await expect(svg).toHaveCount(1)
    const box = await svg.boundingBox()
    expect([box?.width, box?.height]).toEqual([24, 24])
  }
  expect(await page.getByRole('navigation', { name: 'Task areas' }).innerText()).not.toMatch(GLYPHS)
})

test('UI-7.2 header commands: SVG icon + word, 14 px icons, buttons still 108 × 36', async ({ page }) => {
  for (const name of ['Start', 'Hold', 'Stop', 'Reset']) {
    const b = page.locator('.header-commands button', { hasText: name })
    const box = await b.boundingBox()
    expect([box?.width, box?.height]).toEqual([108, 36])
    const icon = await b.locator('svg').boundingBox()
    expect([icon?.width, icon?.height]).toEqual([14, 14])
    expect((await b.innerText()).trim()).toBe(name)
  }
})

test('UI-7.3 icons take the text colour (active rail item blue, others dark)', async ({ page }) => {
  const rail = page.getByRole('navigation', { name: 'Task areas' })
  const active = await rail
    .getByRole('button', { name: /Operate/ })
    .locator('svg')
    .evaluate((e) => getComputedStyle(e).color)
  const other = await rail
    .getByRole('button', { name: /Tags/ })
    .locator('svg')
    .evaluate((e) => getComputedStyle(e).color)
  expect(active).toBe('rgb(43, 95, 168)')
  expect(other).toBe('rgb(31, 35, 40)')
})

test('UI-7.4 N00: no glyph characters left; select caret, button icons and ⓕ are SVG', async ({ page }) => {
  await page.getByRole('button', { name: /N00 Dev/ }).click()
  expect(await page.locator('.content').innerText()).not.toMatch(/[▾⌂]/)
  await expect(page.locator('.select-caret svg').first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'New tag' }).locator('svg')).toHaveCount(1)
  await expect(page.getByRole('table', { name: 'Value states' }).getByRole('img', { name: 'forced' })).toHaveCount(1)
})

test('UI-7.5 icons stay sharp: SVG elements with a viewBox, not bitmaps', async ({ page }) => {
  const viewBoxes = await page.locator('.rail svg, .header-commands svg').evaluateAll((els) => els.map((e) => e.getAttribute('viewBox')))
  expect(viewBoxes.length).toBe(15)
  expect(new Set(viewBoxes)).toEqual(new Set(['0 0 24 24']))
  expect(await page.locator('.rail img, .header img').count()).toBe(0)
})
