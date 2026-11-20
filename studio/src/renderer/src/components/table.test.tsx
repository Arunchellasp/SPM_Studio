// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { Table, type Column, type ValueState } from './table.view'

afterEach(cleanup)

interface Row {
  tag: string
  value: string
  state: ValueState
}
const ROWS: Row[] = [
  { tag: 'Plasma.Ready', value: 'TRUE', state: 'normal' },
  { tag: 'Clamp.Fwd', value: 'TRUE', state: 'forced' },
  { tag: 'Axis2.Pos', value: 'ERR', state: 'fault' }
]
const COLS: Column<Row>[] = [
  { key: 'tag', header: 'Tag', width: 220 },
  { key: 'value', header: 'Value', width: 140, align: 'left' }
]
const draw = (rows = ROWS): ReturnType<typeof render> =>
  render(<Table label="Value states" columns={COLS} rows={rows} rowKey={(r) => r.tag} rowState={(r) => r.state} />)

describe('Table', () => {
  it('renders a named table with column headers and one row per item', () => {
    draw()
    const table = screen.getByRole('table', { name: 'Value states' })
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((h) => h.textContent)
    ).toEqual(['Tag', 'Value'])
    expect(within(table).getAllByRole('row')).toHaveLength(4) // header + 3
  })

  it('width = sum of the column widths (fixed layout like the design)', () => {
    draw()
    expect(screen.getByRole('table').style.width).toBe('360px')
  })

  it('forced row: amber class and ⓕ marker after the first cell', () => {
    draw()
    const row = screen.getByText('Clamp.Fwd').closest('tr')!
    expect(row.className).toBe('tbl-forced')
    expect(within(row).getByRole('img', { name: 'forced' }).textContent).toBe('ⓕ')
  })

  it('fault row: red class, "fault" for screen readers, no ⓕ', () => {
    draw()
    const row = screen.getByText('Axis2.Pos').closest('tr')!
    expect(row.className).toBe('tbl-fault')
    expect(row.textContent).toContain('(fault)')
    expect(within(row).queryByRole('img', { name: 'forced' })).toBeNull()
  })

  it('normal row has no state class and no marker', () => {
    draw()
    const row = screen.getByText('Plasma.Ready').closest('tr')!
    expect(row.className).toBe('')
    expect(row.getAttribute('data-state')).toBe('normal')
  })

  it('render() draws custom cells; align adds a class', () => {
    render(
      <Table
        label="T"
        columns={[...COLS, { key: 'x', header: 'Act', render: (r) => <button>Open {r.tag}</button> }]}
        rows={ROWS.slice(0, 1)}
        rowKey={(r) => r.tag}
      />
    )
    expect(screen.getByRole('button', { name: 'Open Plasma.Ready' })).toBeTruthy()
    expect(screen.getByText('TRUE').className).toBe('tbl-left')
  })

  it('shows the empty text when there are no rows', () => {
    draw([])
    expect(screen.getByText('No rows').getAttribute('colspan')).toBe('2')
  })
})
