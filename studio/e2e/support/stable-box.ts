/**
 * The box of an element once it has stopped moving (two equal reads one frame apart).
 * Canvas tests measure a node and then drag to it; right after a new node, a fit view or a tidy-up
 * the canvas may still be settling, and on a slow CI machine the drag then misses
 * (UI-26.2 / 26.4 once on CI, step 32). Waiting here makes the drag land where the node really is.
 */
import { expect, type Locator } from '@playwright/test'

type Box = { x: number; y: number; width: number; height: number }

export async function stableBox(l: Locator): Promise<Box> {
  let last: Box | null = null
  let box: Box | null = null
  await expect(async () => {
    box = await l.boundingBox()
    await l.page().waitForTimeout(50)
    last = await l.boundingBox()
    expect(box).not.toBeNull()
    expect(last).toEqual(box)
  }).toPass({ timeout: 5000 })
  return last!
}
