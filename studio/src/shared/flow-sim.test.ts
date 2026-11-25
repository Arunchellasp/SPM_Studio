import { describe, expect, it } from 'vitest'
import { evalRpn } from './expr'
import { FlowRunner, SIM, type FlowPos } from './flow-sim'
import type { RtFile } from './generated/rt'

// golden sample 3: Start → wait DI 9 → IF R_PartCount(17) >= 100 → yes End / no set DO 12 → delay 500 → back to the wait
const RT: RtFile = {
  schema: 'spm.rt/1',
  crc: '34498683',
  tags_crc: 'D45C7CCE',
  flows: [
    {
      name: 'S1_Main',
      id: 0,
      station: 'S1',
      autostart: false,
      steps: [
        { i: 0, src: 'start', op: 'START', next: 1 },
        { i: 1, src: 'n1', op: 'WAIT_DI', tag: 9, val: 1, tmo: 0, next: 2 },
        { i: 2, src: 'n2', op: 'IF', rpn: ['T:17', 'K:100', 'GE'], yes: 3, no: 4 },
        { i: 3, src: 'end', op: 'END' },
        { i: 4, src: 'n3', op: 'SET_DO', tag: 12, val: 1, next: 5 },
        { i: 5, src: 'n4', op: 'DELAY', ms: 500, next: 1 }
      ]
    }
  ]
}

describe('RPN and the simulated flow engine (step 34)', () => {
  it('U-34.1 evalRpn: tags, constants, operators; a missing tag reads 0', () => {
    const v = (id: number): number | boolean | undefined => ({ 17: 120, 8: false })[id]
    expect(evalRpn(['T:17', 'K:100', 'GE', 'T:8', 'NOT', 'AND'], v)).toBe(1)
    expect(evalRpn(['T:17', 'K:2', 'DIV', 'K:60', 'EQ'], v)).toBe(1)
    expect(evalRpn(['T:99', 'NEG'], v)).toBe(-0)
    expect(() => evalRpn(['K:1', 'K:2'], v)).toThrow('RPN: 2 values left on the stack')
    expect(() => evalRpn(['XOR'], v)).toThrow('RPN: unknown token XOR')
  })

  it('U-34.2 the runner walks the step table: each change is reported as flow + pc; IF takes the branch its RPN gives', () => {
    const seen: FlowPos[] = []
    const r = new FlowRunner(RT, (p) => seen.push(p))
    const run = (ms: number): void => {
      for (let t = 0; t < ms; t += 50) r.tick(50)
    }
    run(SIM.STEP_MS) // START done
    expect(r.pc[0]).toBe(1)
    run(SIM.WAIT_MS) // the input came
    expect(r.values.get(9)).toBe(true)
    run(SIM.STEP_MS) // IF: R_PartCount (no value = 0) >= 100 is false → no
    expect(r.pc[0]).toBe(4)
    run(SIM.STEP_MS + 600) // SET_DO, then DELAY 500 (but at least STEP_MS)
    expect(r.values.get(12)).toBe(true)
    expect(seen.map((p) => p.pc)).toEqual([1, 2, 4, 5, 1])
    r.values.set(17, 100) // now the yes branch: End, and the flow starts again
    run(SIM.WAIT_MS + SIM.STEP_MS + SIM.STEP_MS)
    expect(seen.map((p) => p.pc).slice(5)).toEqual([2, 3, 0])
    expect(r.cycles).toBe(1)
  })
})
