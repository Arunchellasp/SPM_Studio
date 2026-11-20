/** Step 9 · Screen scaling: every screen at 1920 × 1080, 1366 × 768 and 1280 × 1024 — nothing cut off. */
import { expect, test } from '@playwright/test'

const SIZES = [
  { w: 1920, h: 1080, zoom: '1' },
  { w: 1366, h: 768, zoom: '0.75' },
  { w: 1280, h: 1024, zoom: '0.75' }
]

for (const s of SIZES) {
  test.describe(`${s.w} × ${s.h}`, () => {
    test.use({ viewport: { width: s.w, height: s.h } })

    test(`UI-9.${SIZES.indexOf(s) + 1} every screen fits: zoom ${s.zoom}, no horizontal scroll, header complete`, async ({
      page
    }, info) => {
      await page.goto('/')
      await expect(page.locator('.shell')).toHaveAttribute('data-zoom', s.zoom)
      const rail = page.getByRole('navigation', { name: 'Task areas' }).getByRole('button')
      const n = await rail.count()
      for (let i = 0; i < n; i++) {
        await rail.nth(i).click()
        const m = await page.evaluate(() => {
          const c = document.querySelector('.content')!
          const hd = document.querySelector('.header')!
          return {
            page: document.documentElement.scrollWidth - window.innerWidth,
            content: c.scrollWidth - c.clientWidth,
            header: hd.scrollWidth - hd.clientWidth,
            clockRight: document.querySelector('.header-user')!.getBoundingClientRect().right,
            cellWidth: document.querySelector('.header-cell')!.getBoundingClientRect().width
          }
        })
        const name = await rail.nth(i).innerText()
        expect(m.page, `${name}: page scrolls sideways`).toBe(0)
        expect(m.content, `${name}: content scrolls sideways`).toBe(0)
        expect(m.header, `${name}: header cut off`).toBe(0)
        expect(m.clockRight, `${name}: clock outside the window`).toBeLessThanOrEqual(s.w)
        expect(m.cellWidth, `${name}: cell name squeezed away`).toBeGreaterThan(200)
      }
      // evidence for the report: the N00 screen at this size
      await page.getByRole('button', { name: /N00 Dev/ }).click()
      await page.screenshot({ path: info.outputPath(`n00-${s.w}x${s.h}.png`) })
    })
  })
}

test.describe('1366 × 768 floating layers', () => {
  test.use({ viewport: { width: 1366, height: 768 } })
  test('UI-9.4 dialog backdrop still covers the whole window and the dialog is centred', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /N00 Dev/ }).click()
    await page.getByRole('button', { name: 'Delete recipe…' }).click()
    const bd = await page.locator('.dlg-backdrop').boundingBox()
    expect([Math.round(bd?.width ?? 0), Math.round(bd?.height ?? 0)]).toEqual([1366, 768])
    const d = await page.getByRole('alertdialog').boundingBox()
    expect(Math.abs((d?.x ?? 0) + (d?.width ?? 0) / 2 - 683)).toBeLessThan(2)
    expect(Math.round(d?.width ?? 0)).toBe(315) // 420 design px × 0.75
  })
})
