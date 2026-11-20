// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { signalRows, signalValueText, stepText } from './station'
import { StationCard } from './station-card.view'
import { DEMO_OVERVIEW } from '../../fixtures/demo'
import { useUi } from '../../stores/ui.store'

afterEach(cleanup)
const [st1, st2] = DEMO_OVERVIEW.stations

describe('station logic', () => {
  it('signal values as text: TRUE / FALSE, number + unit, value / limit, plain text', () => {
    expect(signalValueText({ name: 'a', value: true })).toBe('TRUE')
    expect(signalValueText({ name: 'a', value: false })).toBe('FALSE')
    expect(signalValueText({ name: 'a', value: 1.24, unit: 's' })).toBe('1.24 s')
    expect(signalValueText({ name: 'a', value: 12.4, unit: 's', limit: 15 })).toBe('12.4 s / 15 s')
    expect(signalValueText({ name: 'a', value: 'ON' })).toBe('ON')
  })
  it('step text, with elapsed time when there is one', () => {
    expect(stepText(st1)).toBe('s5 Wait part present')
    expect(stepText(st2)).toBe('s3 Wait plasma ready (12.4 s)')
  })
  it('signal rows carry the value state and the note (default normal / empty)', () => {
    expect(signalRows(st2).map((r) => [r.name, r.value, r.note, r.state])).toEqual([
      ['Plasma ready', 'FALSE', 'blocks step', 'fault'],
      ['Plasma power', 'ON', '', 'normal'],
      ['Step time', '12.4 s / 15 s', 'timeout soon', 'warn']
    ])
  })
})

describe('StationCard', () => {
  it('title, state → pill colour class, step line', () => {
    render(<StationCard station={st2} />)
    const card = screen.getByRole('region', { name: 'Station 2 · Plasma clean' })
    const pill = card.querySelector('.state-pill')!
    expect([pill.textContent, pill.className]).toEqual(['HELD', 'state-pill state-pill-sm st-held'])
    expect(card.querySelector('.station-step')!.textContent).toBe('Step s3 Wait plasma ready (12.4 s)')
  })
  it('signal rows rendered with their state (fault red, warn amber without ⓕ)', () => {
    render(<StationCard station={st2} />)
    const rows = within(screen.getByRole('table', { name: 'Station 2 · Plasma clean signals' }))
      .getAllByRole('row')
      .slice(1)
    expect(rows.map((r) => r.getAttribute('data-state'))).toEqual(['fault', 'normal', 'warn'])
    expect(within(rows[2]).queryByRole('img', { name: 'forced' })).toBeNull()
  })
  it('buttons open the sequence (N02) and the I/O (N04) screens', () => {
    render(<StationCard station={st1} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open sequence' }))
    expect(useUi.getState().activeScreen).toBe('program')
    fireEvent.click(screen.getByRole('button', { name: 'Station I/O' }))
    expect(useUi.getState().activeScreen).toBe('io')
    useUi.setState({ activeScreen: 'operate' })
  })
})
