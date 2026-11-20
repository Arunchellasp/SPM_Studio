/**
 * Formatting (step 11): data is stored as plain numbers (fixtures, later the runtime);
 * screens turn them into text here, so every screen writes numbers the same way.
 */

/** 12480 → "12 480" (space as thousands separator, readable on a machine screen) */
export function formatCount(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/** 4.85, 's' → "4.85 s"; digits = decimals to show */
export function formatValue(v: number, unit?: string, digits?: number): string {
  const text = digits === undefined ? String(v) : v.toFixed(digits)
  return unit ? `${text} ${unit}` : text
}
