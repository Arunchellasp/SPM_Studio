/**
 * Station card logic (step 13): turn raw signal values into the text the card shows.
 */
import type { Signal, Station } from '../../model/overview'
import type { ValueState } from '../../model/machine'
import { formatValue } from '../../app/format'

/** TRUE / FALSE · "1.24 s" · "12.4 s / 15 s" · "ON" */
export function signalValueText(s: Signal): string {
  if (typeof s.value === 'boolean') return s.value ? 'TRUE' : 'FALSE'
  if (typeof s.value === 'number') {
    const v = formatValue(s.value, s.unit)
    return s.limit === undefined ? v : `${v} / ${formatValue(s.limit, s.unit)}`
  }
  return s.value
}

/** the bold part of 'Step s3 Wait plasma ready (12.4 s)' */
export function stepText(st: Station): string {
  const { id, text, elapsedS } = st.step
  return elapsedS === undefined ? `${id} ${text}` : `${id} ${text} (${formatValue(elapsedS, 's')})`
}

/** a row of the signal table */
export interface SignalRow {
  name: string
  value: string
  note: string
  state: ValueState
}
export function signalRows(st: Station): SignalRow[] {
  return st.signals.map((s) => ({ name: s.name, value: signalValueText(s), note: s.note ?? '', state: s.state ?? 'normal' }))
}
