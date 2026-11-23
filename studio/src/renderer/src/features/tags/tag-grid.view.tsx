import { useEffect, useRef } from 'react'
import {
  EditModule,
  FilterModule,
  FormatModule,
  InteractionModule,
  ResizeTableModule,
  SelectRowModule,
  SortModule,
  Tabulator,
  type CellComponent,
  type ColumnDefinition,
  type RowComponent
} from 'tabulator-tables'
import 'tabulator-tables/dist/css/tabulator.min.css'
import { canEdit, EDITABLE_DTYPES, type EditField } from './tag-edit'
import { matches, type GridFilter, type GridRow } from './tag-grid'
import './tag-grid.css'

// only the parts the grid uses (the full build is ~3× bigger): sort, filter, cell text, clicks, one selected row, resize
Tabulator.registerModule([SortModule, FilterModule, FormatModule, InteractionModule, SelectRowModule, ResizeTableModule, EditModule])

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

/** grid field → edit field (step 19). The editor opens only where canEdit says so (e.g. Type only for REG / RECIPE). */
const EDIT: Record<string, EditField> = { name: 'name', type: 'type', scope: 'scope', unit: 'unit', init: 'init', comment: 'comment' }
const editableIf = (cell: CellComponent): boolean => canEdit(cell.getRow().getData() as GridRow, EDIT[cell.getField()]!)

/**
 * Every cell: its text (as text, never as HTML) and — step 20 — red with the reason as tooltip when a rule fails.
 * aria-invalid tells screen readers; the row also gets 'row-bad' (a ⚠ before the name: not by colour alone).
 */
function cellText(cell: CellComponent): HTMLElement {
  const row = cell.getRow().getData() as GridRow
  const msgs = row.issues?.[cell.getField() as keyof NonNullable<GridRow['issues']>]
  const el = cell.getElement()
  el.classList.toggle('cell-bad', !!msgs)
  if (msgs) {
    el.title = msgs.join('\n')
    el.setAttribute('aria-invalid', 'true')
  } else {
    el.removeAttribute('title')
    el.removeAttribute('aria-invalid')
  }
  const span = document.createElement('span')
  span.textContent = String(cell.getValue() ?? '')
  return span
}

function columns(scopes: () => string[]): ColumnDefinition[] {
  const text = { editor: 'input' as const, editable: editableIf }
  return [
    { title: 'Name', field: 'name', widthGrow: 24, hozAlign: 'left', headerHozAlign: 'left', sorter: byCode, ...text },
    { title: 'Address', field: 'address', widthGrow: 9 }, // double-click → address picker (dialog)
    { title: 'Type', field: 'type', widthGrow: 9, editor: 'list', editorParams: { values: [...EDITABLE_DTYPES] }, editable: editableIf },
    {
      title: 'Scope',
      field: 'scope',
      widthGrow: 10,
      editor: 'list',
      editorParams: () => ({ values: scopes(), autocomplete: true, freetext: true, allowEmpty: false }), // read when the editor opens
      editable: editableIf
    },
    { title: 'Unit', field: 'unit', widthGrow: 7, ...text },
    { title: 'Init', field: 'init', widthGrow: 8, ...text },
    { title: 'Retain', field: 'retain', widthGrow: 7 }, // double-click toggles (when allowed)
    { title: 'Mapped to', field: 'mappedTo', widthGrow: 17, headerSort: false },
    { title: 'Live value', field: 'live', widthGrow: 14, headerSort: false },
    { title: 'Comment', field: 'comment', widthGrow: 34, hozAlign: 'left', headerHozAlign: 'left', ...text }
  ].map((c) => ({ headerHozAlign: 'center', hozAlign: 'center', minWidth: 48, resizable: false, formatter: cellText, ...c }) as ColumnDefinition)
}

export interface TagGridProps {
  rows: GridRow[]
  /** values for the Scope list editor (free text allowed too) */
  scopes: string[]
  /** a cell was changed: true = kept, false = refused (the cell goes back) */
  onEdit: (name: string, field: EditField, value: unknown) => boolean
  /** double-click on Address */
  onPickAddress: (name: string) => void
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
export function TagGrid({ rows, scopes, filter, selected, onSelect, onCount, onEdit, onPickAddress }: TagGridProps): React.JSX.Element {
  const host = useRef<HTMLDivElement>(null)
  /** the live grid and the promise of its 'tableBuilt' — kept together, so work never lands on the wrong grid */
  const grid = useRef<{ t: Tabulator; ready: Promise<void> } | null>(null)
  // latest callbacks without re-creating the grid
  const cb = useRef({ onSelect, onCount, onEdit, onPickAddress, scopes })
  useEffect(() => {
    cb.current = { onSelect, onCount, onEdit, onPickAddress, scopes }
  })

  // create once, destroy on leave
  useEffect(() => {
    if (!host.current) return
    const t = new Tabulator(host.current, {
      data: [],
      index: 'name',
      columns: columns(() => cb.current.scopes),
      editTriggerEvent: 'dblclick', // one click selects, double-click edits
      rowFormatter: (row: RowComponent) => row.getElement().classList.toggle('row-bad', !!(row.getData() as GridRow).issues),
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
    // step 19: edits go to the store; a refused one puts the old text back
    t.on('cellEdited', (cell: CellComponent) => {
      const field = EDIT[cell.getField()]
      const name = cell.getField() === 'name' ? String(cell.getOldValue()) : (cell.getRow().getData() as GridRow).name
      if (!field || cell.getValue() === cell.getOldValue()) return
      if (!cb.current.onEdit(name, field, String(cell.getValue() ?? ''))) cell.restoreOldValue()
    })
    // Retain toggles on DOUBLE-click like every other editor: a single click in the middle of a row
    // (= the Retain column) only selects — found in step 21, where selecting a row changed it
    t.on('cellDblClick', (_e: UIEvent, cell: CellComponent) => {
      const row = cell.getRow().getData() as GridRow
      if (cell.getField() === 'address' && canEdit(row, 'address')) cb.current.onPickAddress(row.name)
      if (cell.getField() === 'retain' && canEdit(row, 'retain')) cb.current.onEdit(row.name, 'retain', row.retain !== '✓')
    })
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
        if (selected && t.getRow(selected)) {
          t.selectRow(selected)
          t.scrollToRow(selected, 'nearest', false).catch(() => {}) // filtered out → nothing to scroll to
        }
      }),
    [selected, rows]
  )

  return <div ref={host} className="tag-grid" data-testid="tag-grid" />
}
