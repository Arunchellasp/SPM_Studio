/** Step 10 · Dark / light theme: switch on N10, contrast in both themes, kept after restart, colours that must not change. */
import { expect, test, type Page } from '@playwright/test'

async function setTheme(page: Page, name: 'Light' | 'Dark'): Promise<void> {
  await page.getByRole('button', { name: /Admin/ }).click()
  await page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name }).click()
}

/** WCAG contrast of two CSS colours (rgb(…) strings), computed in the page */
async function tokenContrasts(page: Page): Promise<Record<string, number>> {
  return page.evaluate(() => {
    const css = getComputedStyle(document.documentElement)
    const probe = document.createElement('div')
    document.body.appendChild(probe)
    const rgb = (v: string): number[] => {
      probe.style.color = css.getPropertyValue(v).trim()
      return getComputedStyle(probe).color.match(/\d+/g)!.slice(0, 3).map(Number)
    }
    const lum = (c: number[]): number => {
      const [r, g, b] = c.map((x) => {
        const s = x / 255
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
      })
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const cr = (a: string, b: string): number => {
      const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p)
      return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100
    }
    const pairs: [string, string][] = [
      ['--text', '--surface'],
      ['--text', '--bg'],
      ['--text', '--panel'],
      ['--text', '--rail'],
      ['--muted', '--surface'],
      ['--muted', '--panel'],
      ['--muted-on-bg', '--bg'],
      ['--cell-text', '--surface'],
      ['--cell-text', '--row-alt'],
      ['--cell-text', '--forced-bg'],
      ['--cell-text', '--fault-bg'],
      ['--accent-text', '--surface'],
      ['--accent-text', '--accent-lt'],
      ['--danger', '--surface'],
      ['--error', '--surface'],
      ['--text', '--alarm-bg'],
      ['--on-accent', '--accent'],
      ['--header-text', '--header']
    ]
    const out: Record<string, number> = {}
    for (const [a, b] of pairs) out[`${a} on ${b}`] = cr(a, b)
    probe.remove()
    return out
  })
}

test('UI-10.1 N10 Admin › Display: Light is the default; Dark switches the whole app', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /Admin/ }).click()
  const group = page.getByRole('radiogroup', { name: 'Theme' })
  await expect(group.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(220, 223, 227)')
  await group.getByRole('radio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(27, 33, 40)')
})

for (const theme of ['Light', 'Dark'] as const) {
  test(`UI-10.2 ${theme}: every text colour pair is at least 4.5 : 1`, async ({ page }) => {
    await page.goto('/')
    await setTheme(page, theme)
    const c = await tokenContrasts(page)
    for (const [pair, ratio] of Object.entries(c)) expect(ratio, `${theme} ${pair} = ${ratio}`).toBeGreaterThanOrEqual(4.5)
  })
}

test('UI-10.3 the choice is kept after a restart (reload)', async ({ page }) => {
  await page.goto('/')
  await setTheme(page, 'Dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: /Admin/ }).click()
  await expect(page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark' })).toHaveAttribute('aria-checked', 'true')
})

test('UI-10.4 dark: all N00 parts use the dark tokens; state, alarm and header colours unchanged', async ({ page }, info) => {
  await page.goto('/')
  const fixed = async (): Promise<string[]> =>
    page.evaluate(() => [
      getComputedStyle(document.querySelector('.header')!).backgroundColor,
      getComputedStyle(document.querySelector('.header .state-pill')!).backgroundColor,
      getComputedStyle(document.documentElement).getPropertyValue('--p1').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--st-execute').trim(),
      getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()
    ])
  const before = await fixed()
  await setTheme(page, 'Dark')
  expect(await fixed()).toEqual(before)

  await page.getByRole('button', { name: /N00 Dev/ }).click()
  const bg = (sel: string): Promise<string> =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => getComputedStyle(e).backgroundColor)
  const fg = (sel: string): Promise<string> =>
    page
      .locator(sel)
      .first()
      .evaluate((e) => getComputedStyle(e).color)
  expect(await bg('.card')).toBe('rgb(42, 49, 57)')
  expect(await fg('.card-title')).toBe('rgb(230, 233, 237)')
  expect(await bg('.field-control')).toBe('rgb(42, 49, 57)')
  expect(await fg('.tbl td')).toBe('rgb(230, 233, 237)')
  expect(await bg('.tbl tr.tbl-forced')).toBe('rgb(122, 95, 18)')
  expect(await bg('.tbl tr.tbl-fault')).toBe('rgb(132, 48, 48)')
  expect(await fg('.tab[aria-selected="true"]')).toBe('rgb(130, 177, 238)')
  expect(await fg('.btn-danger')).toBe('rgb(240, 113, 113)')
  await page.getByRole('button', { name: 'Delete recipe…' }).click()
  expect(await bg('.dlg')).toBe('rgb(42, 49, 57)')
  await page.screenshot({ path: info.outputPath('n00-dark.png') })
})
