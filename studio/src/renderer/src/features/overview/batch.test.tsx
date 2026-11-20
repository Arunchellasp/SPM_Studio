// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { batchKpis, nextText, progressPct, whyNotFasterText } from './batch'
import { BatchCard } from './batch-card.view'
import { DEMO_OVERVIEW } from '../../fixtures/demo'

afterEach(cleanup)
const batch = DEMO_OVERVIEW.batch

describe('batch logic', () => {
  it('progress % = parts done / target', () => {
    expect(progressPct(4, 50)).toBe(8)
    expect(progressPct(25, 50)).toBe(50)
    expect(progressPct(50, 50)).toBe(100)
  })
  it('progress is kept between 0 and 100 (target 0, more than target, negative)', () => {
    expect(progressPct(3, 0)).toBe(0)
    expect(progressPct(60, 50)).toBe(100)
    expect(progressPct(-1, 50)).toBe(0)
  })
  it('KPI values formatted like the design (2 decimals for time, 1 for %)', () => {
    expect(batchKpis(batch)).toEqual([
      { label: 'Cycle time', value: '4.85 s', after: '(target 4.50)' },
      { label: 'Yield', value: '98.9 %' },
      { label: 'OEE', value: '80.5 %' }
    ])
  })
  it('next action text, singular for 1 part', () => {
    expect(nextText(batch)).toBe('Next: tray change in 6 parts')
    expect(nextText({ ...batch, next: { text: 'tray change', inParts: 1 } })).toBe('Next: tray change in 1 part')
  })
  it('why-not-faster sentence is the design text', () => {
    expect(whyNotFasterText(DEMO_OVERVIEW.whyNotFaster)).toBe(
      'Station 2 waits for robot 1.7 s per part (35 %). Suggestion: dual gripper. (from trace analysis)'
    )
  })
})

describe('BatchCard', () => {
  it('shows the batch line and the KPI line from the data', () => {
    render(<BatchCard batch={batch} />)
    expect(screen.getByRole('region', { name: 'Batch A-12' }).textContent).toContain('Batch A-12 · Trim dispensing · 4 / 50 parts')
    expect(screen.getByTestId('batch-kpis').textContent).toBe(
      'Cycle time 4.85 s (target 4.50) · Yield 98.9 % · OEE 80.5 % · Next: tray change in 6 parts'
    )
  })
  it('progress bar: accessible values and fill width = progress %', () => {
    const { container } = render(<BatchCard batch={batch} />)
    const bar = screen.getByRole('progressbar', { name: 'Batch progress' })
    expect([bar.getAttribute('aria-valuenow'), bar.getAttribute('aria-valuemax')]).toEqual(['4', '50'])
    expect((container.querySelector('.batch-bar-fill') as HTMLElement).style.width).toBe('8%')
  })
})
