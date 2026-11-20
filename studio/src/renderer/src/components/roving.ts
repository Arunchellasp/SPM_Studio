/**
 * Keyboard helper shared by Segmented and Tabs ("roving focus").
 * Only the selected item is reachable with Tab; arrow keys move between items.
 * Returns the index to move to, or null when the key is not a navigation key.
 */
export function nextIndex(key: string, current: number, disabled: boolean[]): number | null {
  const n = disabled.length
  if (n === 0) return null
  let step: number
  let start = current
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      step = 1
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      step = -1
      break
    case 'Home':
      step = 1
      start = -1
      break
    case 'End':
      step = -1
      start = n
      break
    default:
      return null
  }
  // walk in that direction, wrapping around, skipping disabled items
  for (let i = 1; i <= n; i++) {
    const idx = (((start + step * i) % n) + n) % n
    if (!disabled[idx]) return idx
  }
  return current
}
