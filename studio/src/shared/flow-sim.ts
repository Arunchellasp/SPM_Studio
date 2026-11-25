/**
 * Step 34 · a simulated flow engine: runs program.rt.json for the stand-ins of the C runtime
 * (mock runtime, browser simulator) so the studio can show the live step. One instance per flow,
 * all flows run while the machine is in EXECUTE (Software implementation › 5d / 5e).
 *
 * Simulation, not real I/O: each step stays at least STEP_MS so the eye can follow it;
 * WAIT_DI sees its input come after WAIT_MS; MOVE_ABS takes MOVE_MS; DELAY its own time;
 * IF evaluates its RPN on the simulated values. END restarts the flow after STEP_MS (the next part)
 * and counts a cycle. The real engine (C, step 37) has the same step table and the same events.
 */
import type { RtFile, Step } from './generated/rt'
import { evalRpn } from './expr'

export const SIM = { STEP_MS: 600, WAIT_MS: 1000, MOVE_MS: 1500 } as const

export type TagValue = number | boolean

export interface FlowPos {
  flow: number
  pc: number
}

export class FlowRunner {
  /** current step of each flow (index = flow id) */
  readonly pc: number[]
  /** simulated values by tag id */
  readonly values = new Map<number, TagValue>()
  cycles = 0
  private inStep: number[]

  constructor(
    readonly rt: RtFile,
    private readonly onStep: (p: FlowPos) => void
  ) {
    this.pc = rt.flows.map(() => 0)
    this.inStep = rt.flows.map(() => 0)
  }

  /** advance every flow by dt ms (call only while EXECUTE) */
  tick(dt: number): void {
    this.rt.flows.forEach((f, fi) => {
      this.inStep[fi]! += dt
      const step = f.steps[this.pc[fi]!]
      if (!step) return
      const next = this.next(step, this.inStep[fi]!)
      if (next === null) return
      this.pc[fi] = next
      this.inStep[fi] = 0
      this.enter(f.steps[next])
      this.onStep({ flow: fi, pc: next })
    })
  }

  /** what a step does the moment it is entered (like the C handlers on their first call) */
  private enter(s: Step | undefined): void {
    if (s?.op === 'SET_DO') this.values.set(s.tag, s.val === 1)
  }

  /** where a step goes after `t` ms in it, or null = still busy */
  private next(s: Step, t: number): number | null {
    if (t < SIM.STEP_MS) return null
    switch (s.op) {
      case 'START':
        return s.next
      case 'WAIT_DI':
        if (t < SIM.WAIT_MS) return null
        this.values.set(s.tag, s.val === 1) // the input came
        return s.next
      case 'SET_DO': // set on entry (enter); stays STEP_MS so it can be seen
        return s.next
      case 'MOVE_ABS':
        return t < SIM.MOVE_MS ? null : s.next
      case 'DELAY':
        return t < s.ms ? null : s.next
      case 'IF':
        return evalRpn(s.rpn, (id) => this.values.get(id)) ? s.yes : s.no
      case 'END':
        this.cycles += 1
        return 0 // the next part: from Start again
    }
  }
}
