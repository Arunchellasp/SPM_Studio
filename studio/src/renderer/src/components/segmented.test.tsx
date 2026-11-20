// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { nextIndex } from './roving'
import { Segmented } from './segmented.view'
import { Tabs } from './tabs.view'

afterEach(cleanup)

describe('nextIndex (keyboard helper)', () => {
  const none = [false, false, false]
  it('moves right and left, wrapping around', () => {
    expect(nextIndex('ArrowRight', 0, none)).toBe(1)
    expect(nextIndex('ArrowRight', 2, none)).toBe(0)
    expect(nextIndex('ArrowLeft', 0, none)).toBe(2)
  })
  it('Home / End jump to the first / last enabled item', () => {
    expect(nextIndex('Home', 2, none)).toBe(0)
    expect(nextIndex('End', 0, [false, false, true])).toBe(1)
  })
  it('skips disabled items and ignores other keys', () => {
    expect(nextIndex('ArrowRight', 0, [false, true, false])).toBe(2)
    expect(nextIndex('a', 0, none)).toBeNull()
  })
})

/** small wrapper so the test sees state changes like a real screen */
function Seg(): React.JSX.Element {
  const [v, setV] = useState<'A' | 'B' | 'C'>('A')
  return <Segmented label="Mode" options={['A', { value: 'B', disabled: true }, 'C']} value={v} onChange={setV} />
}

describe('Segmented', () => {
  it('is a radio group with exactly one selected segment', () => {
    render(<Seg />)
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeTruthy()
    const checked = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true')
    expect(checked.map((r) => r.textContent)).toEqual(['A'])
  })
  it('click selects', () => {
    render(<Seg />)
    fireEvent.click(screen.getByRole('radio', { name: 'C' }))
    expect(screen.getByRole('radio', { name: 'C' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'A' }).getAttribute('aria-checked')).toBe('false')
  })
  it('arrow key moves the selection (skipping disabled B) and the focus', () => {
    render(<Seg />)
    const a = screen.getByRole('radio', { name: 'A' })
    a.focus()
    fireEvent.keyDown(a, { key: 'ArrowRight' })
    const c = screen.getByRole('radio', { name: 'C' })
    expect(c.getAttribute('aria-checked')).toBe('true')
    expect(document.activeElement).toBe(c)
  })
  it('only the selected segment is a Tab stop', () => {
    render(<Seg />)
    expect(screen.getAllByRole('radio').map((r) => r.tabIndex)).toEqual([0, -1, -1])
  })
})

describe('Tabs', () => {
  const TABS = [
    { id: 'o', label: 'Overview', content: 'overview panel' },
    { id: 's', label: 'Stations', content: 'stations panel' },
    { id: 'x', label: 'Trace', content: 'trace panel', disabled: true }
  ]
  it('shows the first tab and its panel by default', () => {
    render(<Tabs label="View" tabs={TABS} />)
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true')
    const panel = screen.getByRole('tabpanel')
    expect(panel.textContent).toBe('overview panel')
    expect(panel.getAttribute('aria-labelledby')).toBe(screen.getByRole('tab', { name: 'Overview' }).id)
  })
  it('click switches the panel', () => {
    render(<Tabs label="View" tabs={TABS} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Stations' }))
    expect(screen.getByRole('tabpanel').textContent).toBe('stations panel')
  })
  it('arrow keys move between tabs and skip disabled ones', () => {
    render(<Tabs label="View" tabs={TABS} defaultValue="s" />)
    const s = screen.getByRole('tab', { name: 'Stations' })
    fireEvent.keyDown(s, { key: 'ArrowRight' }) // Trace is disabled → wraps to Overview
    expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('tabpanel').textContent).toBe('overview panel')
  })
  it('controlled: follows value and reports onChange', () => {
    const seen: string[] = []
    render(<Tabs label="View" tabs={TABS} value="o" onChange={(id) => seen.push(id)} />)
    fireEvent.click(screen.getByRole('tab', { name: 'Stations' }))
    expect(seen).toEqual(['s'])
    expect(screen.getByRole('tabpanel').textContent).toBe('overview panel') // parent did not change value
  })
})
