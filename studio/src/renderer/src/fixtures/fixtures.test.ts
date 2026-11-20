/**
 * Step 11 · the sample data is consistent and matches the N01 template.
 * (That it matches the TypeScript types is checked by the compiler: `satisfies OverviewData`.)
 */
import { describe, expect, it } from 'vitest'
import { DEMO_CELL, DEMO_OVERVIEW } from './demo'
import { N00_FORCED_AT_START, N00_STATE_ROWS, N00_TAG_ROWS } from './n00'
import type { MachineState } from '../model/machine'

const PACKML: MachineState[] = ['STOPPED', 'IDLE', 'STARTING', 'EXECUTE', 'HELD', 'SUSPENDED', 'ABORTED', 'COMPLETE']
const HHMMSS = /^\d\d:\d\d:\d\d$/

describe('fixtures/demo.ts (N01 sample data)', () => {
  const { batch, stations, alarms, events, whyNotFaster } = DEMO_OVERVIEW

  it('batch numbers are possible: done ≤ target, % between 0 and 100, times > 0', () => {
    expect(batch.partsDone).toBeLessThanOrEqual(batch.partsTarget)
    for (const pct of [batch.yieldPct, batch.oeePct, whyNotFaster.sharePct]) {
      expect(pct).toBeGreaterThanOrEqual(0)
      expect(pct).toBeLessThanOrEqual(100)
    }
    expect(batch.cycleTimeS).toBeGreaterThan(0)
    expect(batch.cycleTargetS).toBeGreaterThan(0)
  })

  it('6 stations with unique ids, a PackML state and at least one signal', () => {
    expect(stations).toHaveLength(6)
    expect(new Set(stations.map((s) => s.id)).size).toBe(6)
    for (const s of stations) {
      expect(PACKML, s.id).toContain(s.state)
      expect(s.signals.length, s.id).toBeGreaterThan(0)
    }
  })

  it('a signal with a limit is below it (12.4 s of 15 s)', () => {
    for (const s of stations)
      for (const sig of s.signals)
        if ('limit' in sig && typeof sig.value === 'number') expect(sig.value).toBeLessThanOrEqual(sig.limit as number)
  })

  it('alarms: unique codes, priority 1–4, hh:mm:ss times; events too', () => {
    expect(new Set(alarms.map((a) => a.code)).size).toBe(alarms.length)
    for (const a of alarms) {
      expect([1, 2, 3, 4]).toContain(a.priority)
      expect(a.time).toMatch(HHMMSS)
    }
    for (const e of events) expect(e.time).toMatch(HHMMSS)
  })

  it('matches the N01 template text', () => {
    expect(`Batch ${batch.id} · ${batch.product} · ${batch.partsDone} / ${batch.partsTarget} parts`).toBe(
      'Batch A-12 · Trim dispensing · 4 / 50 parts'
    )
    expect(stations.map((s) => s.state)).toEqual(['EXECUTE', 'HELD', 'EXECUTE', 'IDLE', 'EXECUTE', 'EXECUTE'])
    expect(alarms.filter((a) => !a.acked).map((a) => a.code)).toEqual(['E1202'])
    expect(DEMO_CELL.name).toBe('Line 3 · Trim dispensing cell')
  })
})

describe('fixtures/n00.ts (gallery sample rows)', () => {
  it('value-states table has each state exactly once', () => {
    expect(N00_STATE_ROWS.map((r) => r.state).sort()).toEqual(['fault', 'forced', 'normal'])
  })
  it('tag rows are unique and the forced-at-start tags exist', () => {
    const tags = N00_TAG_ROWS.map((r) => r.tag)
    expect(new Set(tags).size).toBe(tags.length)
    for (const t of N00_FORCED_AT_START) expect(tags).toContain(t)
  })
})
