import { useEffect, useRef } from 'react'
import {
  FilterModule,
  FormatModule,
  InteractionModule,
  ResizeTableModule,
  SelectRowModule,
  SortModule,
  Tabulator,
  type ColumnDefinition,
  type RowComponent
} from 'tabulator-tables'
import 'tabulator-tables/dist/css/tabulator.min.css'
import { matches, type GridFilter, type GridRow } from './tag-grid'
import './tag-grid.css'

// only the parts the grid uses (the full build is ~3× bigger): sort, filter, cell text, clicks, one selected row, resize
Tabulator.registerModule([SortModule, FilterModule, FormatModule, InteractionModule, SelectRowModule, ResizeTableModule])

/**
 * The 10 columns of Improved design › N03. widthGrow = the design width in px ÷ 10, so the columns
 * keep the design's proportions at 1920 and still fit at 1366 / 1280 (step 9 rule: proportions, not fixed px).
 */
/** plain code order, like the saved file (shared/tags-file.ts) — Tabulator's default would put A_301 before AI_ */
const byCode = (a: unknown, b: unknown): number => {
  const x = String(a)
  const y = String(b)
  return x < y ? -1 : x > y ? 1 : 0
}

const COLUMNS: ColumnDefinition[] = [
  { title: 'Name', field: 'name', widthGrow: 24, hozAlign: 'left', headerHozAlign: 'left', tooltip: true, sorter: byCode },
  { title: 'Address', field: 'address', widthGrow: 9 },
  { title: 'Type', field: 'type', widthGrow: 9 },
  { title: 'Scope', field: 'scope', widthGrow: 10 },
  { title: 'Unit', field: 'unit', widthGrow: 7 },
  { title: 'Init', field: 'init', widthGrow: 8 },
  { title: 'Retain', field: 'retain', widthGrow: 7 },
  { title: 'Mapped to', field: 'mappedTo', widthGrow: 17, headerSort: false },
  { title: 'Live value', field: 'live', widthGrow: 14, headerSort: false },
  { title: 'Comment', field: 'comment', widthGrow: 34, hozAlign: 'left', headerHozAlign: 'left', tooltip: true }
].map((c) => ({ headerHozAlign: 'center', hozAlign: 'center', minWidth: 48, resizable: false, ...c }) as ColumnDefinition)

export interface TagGridProps {
  rows: GridRow[]
  filter: GridFilter
  selected: string | null
  onSelect: (name: string) => void
  /** number of rows left after the filter (for '5 of 20 tags') */
  onCount: (shown: number) => void
}

/**
 * Tabulator inside React: React owns the data and the filter; Tabulator owns the DOM of the grid.
 * Virtual rendering: only the rows in view exist in the page, so 1000 tags scroll as fast as 20.
 */
export function TagGrid({ rows, filter, selected, onSelect, onCount }: TagGridProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  /** the live grid and the promise of its 'tableBuilt' — kept together, so work never lands on the wrong grid */
  const grid = useRef<{ t: Tabulator; ready: Promise<void> } | null>(null)
  // latest callbacks without re-creating the grid
  const cb = useRef({ onSelect, onCount })
  useEffect(() => {
    cb.current = { onSelect, onCount }
  })

  // create once, destroy on leave
  useEffect(() => {
    if (!host.current) return
    const t = new Tabulator(host.current, {
      data: [],
      index: 'name',
      columns: COLUMNS,
      layout: 'fitColumns',
      height: '100%',
      renderVertical: 'virtual',
      selectableRows: 1,
      initialSort: [{ column: 'name', dir: 'asc' }],
      placeholder: 'No tags match the filter'
    })
    const ready = new Promise<void>((resolve) => t.on('tableBuilt', () => resolve()))
    const me = { t, ready }
    grid.current = me
    t.on('rowClick', (_e: UIEvent, row: RowComponent) => cb.current.onSelect((row.getData() as GridRow).name))
    t.on('dataFiltered', (_f: unknown, shown: RowComponent[]) => cb.current.onCount(shown.length))
    host.current.setAttribute('aria-label', 'Tags')
    return () => {
      if (grid.current === me) grid.current = null
      // React (dev, StrictMode) mounts twice: destroying a grid that is still being built throws inside Tabulator
      void ready.then(() => t.destroy())
    }
  }, [])

  /** run fn once THIS grid is built — skipped if it was replaced or destroyed meanwhile */
  const whenBuilt = (fn: (t: Tabulator) => unknown): void => {
    const me = grid.current
    void me?.ready.then(() => {
      if (grid.current === me) void fn(me.t)
    })
  }

  useEffect(() => whenBuilt((t) => t.replaceData(rows)), [rows])
  useEffect(() => whenBuilt((t) => t.setFilter((data: GridRow) => matches(data, filter))), [filter])
  useEffect(
    () =>
      whenBuilt((t) => {
        t.deselectRow()
        if (selected && t.getRow(selected)) t.selectRow(selected)
      }),
    [selected, rows]
  )

  return <div ref={host} className="tag-grid" data-testid="tag-grid" />
}
