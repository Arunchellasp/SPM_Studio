/**
 * Step 33 · the alarm list of the stand-ins for the C runtime (mock runtime, browser simulator):
 * raise / ack / clear, each sent as evt 'alarm'; snapshot() is what a new connection gets.
 */
import { applyAlarm, clockText, type AlarmEntry, type AlarmEvent, type Priority } from './alarms'

/** the alarms the demo machine knows (texts as in the Improved design, N01) */
export const DEMO_ALARMS: Record<string, { text: string; priority: Priority }> = {
  E1202: { text: 'Plasma ready signal lost during cleaning (station 2)', priority: 1 },
  W0310: { text: 'Glue level below 20 % (station 3)', priority: 3 }
}

export type AckReply = { ok: true } | { ok: false; err: 'ALARM'; msg: string }

export class AlarmBook {
  list: AlarmEntry[]

  constructor(
    private readonly emit: (e: AlarmEvent) => void,
    start: AlarmEntry[] = [],
    private readonly now: () => Date = () => new Date()
  ) {
    this.list = start
  }

  snapshot(): AlarmEvent {
    return { ev: 'alarms', list: this.list }
  }

  has(code: string): boolean {
    return this.list.some((a) => a.code === code && a.active !== false)
  }

  raise(code: string): void {
    const d = DEMO_ALARMS[code]
    if (!d) throw new Error(`no alarm ${code}`)
    this.apply({ ev: 'alarm', act: 'raise', code, text: d.text, priority: d.priority, time: clockText(this.now()) })
  }

  clear(code: string): void {
    if (this.list.some((a) => a.code === code)) this.apply({ ev: 'alarm', act: 'clear', code, time: clockText(this.now()) })
  }

  ack(code: unknown, user: unknown): AckReply {
    const a = this.list.find((x) => x.code === code)
    if (!a) return { ok: false, err: 'ALARM', msg: `no alarm ${String(code)} in the list` }
    if (a.acked) return { ok: false, err: 'ALARM', msg: `${a.code} is already acknowledged` }
    this.apply({
      ev: 'alarm',
      act: 'ack',
      code: a.code,
      time: clockText(this.now()),
      by: typeof user === 'string' && user ? user : 'unknown user'
    })
    return { ok: true }
  }

  private apply(e: AlarmEvent): void {
    this.list = applyAlarm(this.list, e).alarms // the runtime keeps its list by the same rule as the screens
    this.emit(e)
  }
}
