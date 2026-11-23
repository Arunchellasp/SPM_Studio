/** N03 Tags — words for the screen (logic only, unit tested). */
import type { ProjectInfo } from '@shared/ipc'
import { countByKind } from '@shared/tags-file'

/** the twelve kinds as Software implementation › 3a names them */
export const KIND_LABEL: Record<string, string> = {
  DI: 'Digital input',
  DO: 'Digital output',
  AI: 'Analog input',
  AO: 'Analog output',
  AXIS: 'Servo axis',
  POINT: 'Position',
  REG: 'Register',
  TIMER: 'Timer',
  COUNTER: 'Counter',
  ALARM: 'Alarm',
  RECIPE: 'Recipe parameter',
  UDT: 'Structure (UDT)'
}

export interface KindRow {
  kind: string
  label: string
  count: number
}

export function kindRows(p: ProjectInfo): KindRow[] {
  return countByKind(p.tags).map((r) => ({ ...r, label: KIND_LABEL[r.kind] ?? r.kind }))
}

/** '20 tags' / '1 tag' */
export function tagCountText(n: number): string {
  return `${n} ${n === 1 ? 'tag' : 'tags'}`
}
