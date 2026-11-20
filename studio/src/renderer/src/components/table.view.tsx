import type { ReactNode } from 'react'
import { Icon } from './icon.view'
import './table.css'

import type { ValueState } from '../model/machine'

/** ValueState lives in model/machine.ts since step 11 (shared with the runtime data) */
export type { ValueState }

/**
 * One column. 'key' reads row[key]; 'render' draws anything else (a lamp, a button).
 * width in px as in the design (Tag 300, Type 140 …); align center by default like N00.
 */
export interface Column<R> {
  key: string
  header: ReactNode
  width?: number
  align?: 'center' | 'left' | 'right'
  render?: (row: R) => ReactNode
}

export interface TableProps<R> {
  /** read by screen readers, e.g. "Tags" */
  label: string
  columns: Column<R>[]
  rows: R[]
  rowKey: (row: R) => string
  /** forced → amber row + ⓕ after the first cell · fault → light red row */
  rowState?: (row: R) => ValueState
  /** alternate light rows for long lists (I/O) */
  striped?: boolean
  /** stretch to the width of the parent instead of the sum of the column widths */
  fill?: boolean
  /** shown in one row when there are no rows */
  empty?: ReactNode
  className?: string
}

export function Table<R>({
  label,
  columns,
  rows,
  rowKey,
  rowState,
  striped = false,
  fill = false,
  empty = 'No rows',
  className = ''
}: TableProps<R>): React.JSX.Element {
  // column widths are measured between the grid-line centres, like draw.io does in the design;
  // the outer box is 1 px more (half of the 1 px outer line on each side)
  const total = columns.reduce((sum, c) => sum + (c.width ?? 120), 0)
  const width = fill ? undefined : total
  const classes = ['tbl', striped ? 'tbl-striped' : '', fill ? 'tbl-fill' : '', className].filter(Boolean).join(' ')
  const alignClass = (c: Column<R>): string | undefined => (c.align && c.align !== 'center' ? `tbl-${c.align}` : undefined)

  return (
    <table className={classes} aria-label={label} style={{ width }}>
      <colgroup>
        {columns.map((c) => (
          // fill: the design widths become proportions of the parent (e.g. 220 : 160 : 178), so the table
          // shrinks with its card at 1366 / 1280 instead of sticking out (step 13, caught by UI-9.2 / 9.3)
          <col key={c.key} style={{ width: fill ? `${((c.width ?? 120) / total) * 100}%` : c.width }} />
        ))}
      </colgroup>
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" className={alignClass(c)}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="tbl-empty">
              {empty}
            </td>
          </tr>
        )}
        {rows.map((r) => {
          const state = rowState?.(r) ?? 'normal'
          return (
            <tr key={rowKey(r)} className={state === 'normal' ? undefined : `tbl-${state}`} data-state={state}>
              {columns.map((c, i) => (
                <td key={c.key} className={alignClass(c)}>
                  {c.render ? c.render(r) : String((r as Record<string, unknown>)[c.key] ?? '')}
                  {i === 0 && state === 'forced' && (
                    <span className="tbl-mark" title="Forced by a person">
                      <Icon name="forced" label="forced" />
                    </span>
                  )}
                  {i === 0 && state === 'fault' && <span className="sr-only"> (fault)</span>}
                  {i === 0 && state === 'warn' && <span className="sr-only"> (warning)</span>}
                </td>
              ))}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
