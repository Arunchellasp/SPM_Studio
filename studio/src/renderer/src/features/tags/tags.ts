/** N03 Tags — words for the screen (logic only, unit tested). */
import type { ProjectInfo, Tag } from '@shared/ipc'
import { countByKind } from '@shared/tags-file'
import type { GridRow } from './tag-grid'

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

/** the 'Tag details' panel (Improved design › N03, right): label → value, read-only in step 18 */
export function detailRows(tag: Tag, row: GridRow): { label: string; value: string }[] {
  const alarm = tag.alarm
    ? [alarmText(tag.alarm.code), ...(['lolo', 'lo', 'hi', 'hihi'] as const).filter((k) => tag.alarm?.[k] !== undefined).map((k) => `${k} ${tag.alarm?.[k]}`)]
        .filter(Boolean)
        .join(' · ')
    : tag.kind === 'ALARM'
      ? [alarmText(tag.code), tag.severity ? `P${tag.severity}` : '', tag.reaction ?? '', tag.latch ? 'latched' : ''].filter(Boolean).join(' · ')
      : '–'
  return [
    { label: 'Kind', value: `${tag.kind} · ${KIND_LABEL[tag.kind] ?? tag.kind}` },
    { label: 'Address', value: row.address },
    { label: 'Type', value: tag.dtype ?? tag.kind },
    { label: 'Scope', value: row.scope },
    { label: 'Mapped to', value: '– (card and channel come with N04 I/O)' },
    { label: 'Used in', value: '– (flowcharts come with N02 Program)' },
    { label: 'Alarm', value: alarm },
    { label: 'Comment', value: row.comment || '–' }
  ]
}

function alarmText(code: number | undefined): string {
  return code === undefined ? '' : `code ${code}`
}
