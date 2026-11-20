import { describe, expect, it } from 'vitest'
import { DESIGN_W, MIN_ZOOM, screenScale } from './screen-scale'

describe('screenScale (zoom factor from the window size)', () => {
  it('1920 × 1080: design size, zoom 1', () => {
    expect(screenScale(1920, 1080)).toEqual({ zoom: 1, width: 1920, height: 1080 })
  })

  it('1366 × 768 panel: zoom stops at 75 %, layout 1821 × 1024 design px', () => {
    expect(screenScale(1366, 768)).toEqual({ zoom: 0.75, width: 1821, height: 1024 })
  })

  it('1280 × 1024 panel (5:4): zoom 75 %, extra height becomes extra rows', () => {
    expect(screenScale(1280, 1024)).toEqual({ zoom: 0.75, width: 1707, height: 1365 })
  })

  it('Windows 125 % on a 1920 screen (1536 CSS px): back to exactly the design', () => {
    expect(screenScale(1536, 864)).toEqual({ zoom: 0.8, width: 1920, height: 1080 })
  })

  it('never enlarges above 100 % (a 2560 screen gets more room, not bigger text)', () => {
    expect(screenScale(2560, 1440).zoom).toBe(1)
  })

  it('never below MIN_ZOOM, whatever the window', () => {
    for (const w of [800, 1024, 1280, 1400]) expect(screenScale(w, 700).zoom).toBeGreaterThanOrEqual(MIN_ZOOM)
    expect(DESIGN_W * MIN_ZOOM).toBe(1440) // below 1440 px the layout narrows instead
  })
})
