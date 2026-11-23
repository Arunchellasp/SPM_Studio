// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AlarmCard } from './alarm-card.view'
import { AlarmBanner } from '../../shell/alarm-banner.view'
import { DEMO_OVERVIEW } from '../../fixtures/demo'
import { sortAlarms } from '../alarms/alarms'
import { useUi } from '../../stores/ui.store'

beforeEach(() => useUi.setState({ alarms: sortAlarms(DEMO_OVERVIEW.alarms), events: [...DEMO_OVERVIEW.events] }))
afterEach(cleanup)

const rows = (): HTMLElement[] =>
  within(screen.getByRole('table', { name: 'Active alarms and events' }))
    .getAllByRole('row')
    .slice(1)

describe('AlarmCard (N01)', () => {
  it('title counts the active alarms; alarms first (P1 before P3), then events', () => {
    render(<AlarmCard />)
    expect(screen.getByRole('region', { name: /Active alarms \(2\)/ })).toBeTruthy()
    expect(rows().map((r) => r.children[1].textContent || r.children[3].textContent)).toEqual([
      'E1202',
      'W0310',
      'Batch A-12 started by A. Engineer'
    ])
  })
  it('only the unacked State cell is red', () => {
    render(<AlarmCard />)
    const states = rows().map((r) => r.children[4])
    expect(states.map((c) => [c.textContent, c.className])).toEqual([
      ['Active · unacked', 'tbl-cell-fault'],
      ['Active · acked', ''],
      ['Event', '']
    ])
  })
  it('Ack in the list: row becomes acked, action becomes Shelve, an event is added on top of the events', () => {
    render(<AlarmCard />)
    fireEvent.click(screen.getByRole('button', { name: 'Ack E1202' }))
    expect(rows()[0].children[4].textContent).toBe('Active · acked')
    expect(within(rows()[0]).getByRole('button', { name: 'Shelve 1 h' })).toBeTruthy()
    expect(rows()[2].children[3].textContent).toBe('E1202 acknowledged by A. Engineer')
  })
})

describe('AlarmBanner with the sample alarms', () => {
  it('shows the P1 alarm; Ack disables after use; grey text when no alarms', () => {
    render(<AlarmBanner />)
    const banner = screen.getByRole('alert')
    expect(banner.textContent).toContain('E1202 Plasma ready signal lost during cleaning (station 2) · 12:37:51 · 1 more active')
    const ack = screen.getByRole('button', { name: 'Acknowledge E1202' })
    fireEvent.click(ack)
    expect((ack as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    useUi.setState({ alarms: [] })
    render(<AlarmBanner />)
    expect(screen.getByText('No active alarms')).toBeTruthy()
  })
})
