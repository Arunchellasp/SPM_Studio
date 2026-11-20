/**
 * Screen scaling (step 9). The design is drawn for 1920 × 1080. Smaller panels
 * (1366 × 768, 1280 × 1024) and Windows display scaling (125 %, 150 %) give the app fewer
 * CSS pixels. Instead of squeezing the layout, the whole shell is zoomed down so it keeps
 * (almost) the design width. Text never gets smaller than MIN_ZOOM; below that the layout
 * gets narrower instead (cards reflow), so it always stays readable.
 */
import { useEffect, useState } from 'react'

export const DESIGN_W = 1920
export const DESIGN_H = 1080
/** 75 %: 13 px text → 9.75 px, the smallest size still readable on a panel at arm's length */
export const MIN_ZOOM = 0.75

export interface ScreenScale {
  zoom: number // factor for CSS zoom on the shell (≤ 1: never enlarges)
  width: number // layout width in design pixels (window width ÷ zoom)
  height: number // layout height in design pixels
}

/** pure function: window size in, zoom + layout size out (unit-tested) */
export function screenScale(windowW: number, windowH: number): ScreenScale {
  const raw = windowW / DESIGN_W
  const zoom = Math.round(Math.min(1, Math.max(MIN_ZOOM, raw)) * 1000) / 1000
  return { zoom, width: Math.round(windowW / zoom), height: Math.round(windowH / zoom) }
}

/** React hook: current scale, updated when the window is resized or moved to another screen */
export function useScreenScale(): ScreenScale {
  const [scale, setScale] = useState(() => screenScale(window.innerWidth, window.innerHeight))
  useEffect(() => {
    const update = (): void => setScale(screenScale(window.innerWidth, window.innerHeight))
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  return scale
}
