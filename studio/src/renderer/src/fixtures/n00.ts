/**
 * Sample rows for the N00 Components gallery (moved out of the screen in step 11).
 * The gallery shows HOW components look; WHAT they show comes from here.
 */
import type { SelectOption } from '../components/select.view'
import type { ValueState } from '../model/machine'

export const N00_RECIPES: SelectOption[] = [
  { value: 'A-12', label: 'Recipe A-12' },
  { value: 'A-13', label: 'Recipe A-13' },
  { value: 'B-01', label: 'Recipe B-01' },
  { value: 'old', label: 'Recipe X-00 (archived)', disabled: true }
]

export const N00_AXES: SelectOption[] = [
  { value: 'X1', label: 'Slide X1' },
  { value: 'X2', label: 'Slide X2' }
]

/** Target position field: start value and allowed range (mm) */
export const N00_POSITION = { start: '482.382', min: 0, max: 600 }
export const N00_CYCLE_COUNTER = 12480

/** N00 › Value states: the three rows exactly as drawn */
export interface StateRow {
  tag: string
  value: string
  state: ValueState
  note: string
}
export const N00_STATE_ROWS: StateRow[] = [
  { tag: 'Plasma.Ready', value: 'TRUE', state: 'normal', note: 'normal (no colour)' },
  { tag: 'Clamp.Fwd', value: 'TRUE', state: 'forced', note: 'forced: amber + ⓕ' },
  { tag: 'Axis2.Pos', value: 'ERR', state: 'fault', note: 'bad quality / fault' }
]

/** N03 Tags style rows */
export interface TagRow {
  tag: string
  type: string
  value: string
  comment: string
  fault?: boolean
}
export const N00_TAG_ROWS: TagRow[] = [
  { tag: 'Station.ClampOut', type: 'BOOL', value: 'TRUE', comment: 'Clamp solenoid O0.04' },
  { tag: 'Station.ClampFwd', type: 'BOOL', value: 'TRUE', comment: 'Clamp forward sensor I0.02' },
  { tag: 'Station.Settle', type: 'TIME', value: '300 ms', comment: 'Recipe value' },
  { tag: 'Axis2.Pos', type: 'REAL', value: 'ERR', comment: 'Encoder cable fault', fault: true },
  { tag: 'Plasma.Ready', type: 'BOOL', value: 'FALSE', comment: 'Generator ready' }
]
export const N00_FORCED_AT_START = ['Station.ClampFwd']
