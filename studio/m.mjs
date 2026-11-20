import { chromium } from '@playwright/test'
const b = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH })
for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 1024], [1536, 864]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } })
  await p.goto('http://127.0.0.1:5180/')
  await p.getByRole('button', { name: /N00 Dev/ }).click()
  const r = await p.evaluate(() => {
    const c = document.querySelector('.content'); const hd = document.querySelector('.header')
    const clock = document.querySelector('.header-user').getBoundingClientRect()
    const sh = document.querySelector('.shell').getBoundingClientRect()
    return { zoom: document.querySelector('.shell').dataset.zoom, shell: [Math.round(sh.width), Math.round(sh.height)], docOverflow: document.documentElement.scrollWidth - innerWidth, contentOverflowX: c.scrollWidth - c.clientWidth, headerOverflow: hd.scrollWidth - hd.clientWidth, clockRight: Math.round(clock.right), cell: Math.round(document.querySelector('.header-cell').getBoundingClientRect().width), echo: document.querySelector('[data-testid=scale-echo]').textContent }
  })
  console.log(w, h, JSON.stringify(r))
  await p.screenshot({ path: `/tmp/s9_after_${w}.png` })
  await p.close()
}
await b.close()
