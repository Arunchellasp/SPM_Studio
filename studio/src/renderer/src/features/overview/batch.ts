/**
 * Batch logic (step 12): pure functions, no React — easy to unit-test.
 */
import type { Batch, WhyNotFaster } from '../../model/overview'
import { formatValue } from '../../app/format'

/** parts done / target as 0 … 100 % (target 0 → 0 %, more than target → 100 %) */
export function progressPct(done: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.max(0, (done / target) * 100))
}

/** the KPI line of the N01 batch card, as label / value pairs (values are shown bold) */
export function batchKpis(b: Batch): { label: string; value: string; after?: string }[] {
  return [
    { label: 'Cycle time', value: formatValue(b.cycleTimeS, 's', 2), after: `(target ${formatValue(b.cycleTargetS, undefined, 2)})` },
    { label: 'Yield', value: formatValue(b.yieldPct, '%', 1) },
    { label: 'OEE', value: formatValue(b.oeePct, '%', 1) }
  ]
}

/** "Next: tray change in 6 parts" */
export function nextText(b: Batch): string {
  const n = b.next.inParts
  return `Next: ${b.next.text} in ${n} ${n === 1 ? 'part' : 'parts'}`
}

/** "Station 2 waits for robot 1.7 s per part (35 %). Suggestion: dual gripper. (from trace analysis)" */
export function whyNotFasterText(w: WhyNotFaster): string {
  return (
    `${w.station} waits for ${w.waitsFor} ${formatValue(w.waitS, 's')} per part (${formatValue(w.sharePct, '%')}). ` +
    `Suggestion: ${w.suggestion}. (from ${w.source})`
  )
}
