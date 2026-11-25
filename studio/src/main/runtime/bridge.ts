/**
 * Runtime bridge: the one WebSocket link from the studio to the C runtime.
 * - reconnects with back-off
 * - request / response by id, with timeout
 * - merges state diffs, forwards them to windows at most ~30 times per second
 * - ping every second; link marked offline if no pong for 2.5 s (checked every 250 ms → OFFLINE within 3 s)
 * - while retrying, the link stays 'offline' (no flicker to 'connecting' on every try) — step 31
 * - keeps the last machine state and the alarm list, so a window that loads later gets them (getReplay) — step 33
 * - every new connection starts clean (values, pc, replay) — it may be a different runtime — step 34
 */
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { parseFrame, type CmdMsg } from '@shared/protocol'
import { alarmFrom, applyAlarm, type AlarmEntry } from '@shared/alarms'
import { LINK, type CommandResult, type RuntimeEvent, type RuntimeState, type RuntimeStatus } from '@shared/ipc'

const REQUEST_TIMEOUT_MS = 2000
const PUBLISH_MS = 33

type Pending = { resolve: (r: CommandResult) => void; timer: NodeJS.Timeout }

export interface BridgeEvents {
  status: [RuntimeStatus]
  state: [RuntimeState]
  event: [RuntimeEvent]
}

export class RuntimeBridge extends EventEmitter<BridgeEvents> {
  private ws: WebSocket | null = null
  private nextId = 1
  private pending = new Map<number, Pending>()
  private backoff: number = LINK.BACKOFF_MIN_MS
  private stopped = false
  private lastPong = 0
  private heartbeat?: NodeJS.Timeout
  private watchdog?: NodeJS.Timeout
  private publishTimer?: NodeJS.Timeout
  private dirty = false
  private state: RuntimeState = { seq: 0, values: {}, pc: {} }
  private status: RuntimeStatus
  /** step 33: what a window needs that the runtime sends only on connect or on a change */
  private lastMachine?: RuntimeEvent
  private alarms: AlarmEntry[] | null = null

  constructor(private readonly url: string) {
    super()
    this.status = { link: 'connecting', url }
  }

  start(): void {
    this.stopped = false
    this.connect()
    this.heartbeat = setInterval(() => this.ping(), LINK.PING_MS)
    this.watchdog = setInterval(() => this.watch(), LINK.WATCHDOG_MS)
    this.publishTimer = setInterval(() => this.flush(), PUBLISH_MS)
  }

  stop(): void {
    this.stopped = true
    clearInterval(this.heartbeat)
    clearInterval(this.watchdog)
    clearInterval(this.publishTimer)
    this.ws?.close()
    this.failPending('bridge stopped')
  }

  getStatus(): RuntimeStatus {
    return this.status
  }

  getState(): RuntimeState {
    return this.state
  }

  command(op: string, args: Record<string, unknown> = {}): Promise<CommandResult> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve({ ok: false, err: 'OFFLINE', msg: 'runtime not connected' })
    }
    const id = this.nextId++
    const msg: CmdMsg = { ...args, t: 'cmd', id, op }
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        resolve({ ok: false, err: 'TIMEOUT', msg: `no reply to '${op}' within ${REQUEST_TIMEOUT_MS} ms` })
      }, REQUEST_TIMEOUT_MS)
      this.pending.set(id, { resolve, timer })
      this.ws!.send(JSON.stringify(msg))
    })
  }

  // ------------------------------------------------------------------ internals
  private connect(): void {
    if (this.stopped) return
    if (this.status.link !== 'offline') this.setStatus({ link: 'connecting' }) // first try only
    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.on('open', () => {
      this.backoff = LINK.BACKOFF_MIN_MS
      this.lastPong = Date.now()
      // step 34 (found on the PC): a new connection may be a new runtime — forget the old values, pc and
      // replay copies; the runtime sends what it has now (state frame, machine, alarms) right after connecting
      this.state = { seq: 0, values: {}, pc: {} }
      this.lastMachine = undefined
      this.alarms = null
      this.dirty = true
      this.setStatus({ link: 'online', lastError: undefined })
      ws.send(JSON.stringify({ t: 'ping' }))
    })
    ws.on('message', (data, isBinary) => {
      if (isBinary) return // trace stream: handled in a later phase (N08)
      this.onFrame(data.toString())
    })
    ws.on('error', (e) => this.setStatus({ lastError: e.message }))
    ws.on('close', () => {
      this.ws = null
      this.failPending('link closed')
      this.setStatus({ link: 'offline' })
      if (!this.stopped) {
        setTimeout(() => this.connect(), this.backoff)
        this.backoff = Math.min(this.backoff * 2, LINK.BACKOFF_MAX_MS)
      }
    })
  }

  private onFrame(text: string): void {
    const { msg, error } = parseFrame(text)
    if (!msg) {
      this.setStatus({ lastError: `bad frame: ${error}` })
      return
    }
    switch (msg.t) {
      case 'res': {
        const p = this.pending.get(msg.id)
        if (p) {
          clearTimeout(p.timer)
          this.pending.delete(msg.id)
          const { t: _t, id: _id, ...rest } = msg
          p.resolve(rest as CommandResult)
        }
        break
      }
      case 'state':
        this.state = {
          seq: msg.seq,
          values: { ...this.state.values, ...msg.v },
          pc: { ...this.state.pc, ...msg.pc }
        }
        this.dirty = true
        break
      case 'evt':
        this.remember(msg as RuntimeEvent)
        this.emit('event', msg as RuntimeEvent)
        break
      case 'pong':
        this.lastPong = Date.now()
        this.setStatus({ runtimeVersion: msg.version, cycleUs: msg.cycle_us, cycleMaxUs: msg.cycle_max_us })
        break
    }
  }

  /** the events a newly loaded window needs to show the machine as it is now (sent on did-finish-load) */
  getReplay(): RuntimeEvent[] {
    const out: RuntimeEvent[] = []
    if (this.lastMachine) out.push(this.lastMachine)
    if (this.alarms) out.push({ ev: 'alarms', ts: this.alarmTs, list: this.alarms })
    return out
  }

  private alarmTs = 0
  private remember(e: RuntimeEvent): void {
    if (e.ev === 'machine') this.lastMachine = e
    const a = alarmFrom(e)
    if (a) {
      this.alarms = applyAlarm(this.alarms ?? [], a).alarms // the same rule as the screens
      this.alarmTs = e.ts
    }
  }

  private ping(): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'ping' }))
  }

  /** a runtime that hangs keeps the socket open but stops answering: drop the link, reconnect */
  private watch(): void {
    if (this.ws?.readyState === WebSocket.OPEN && Date.now() - this.lastPong > LINK.STALE_MS) {
      this.setStatus({ lastError: `no answer for ${LINK.STALE_MS / 1000} s (heartbeat lost)` })
      this.ws.terminate()
    }
  }

  private flush(): void {
    if (!this.dirty) return
    this.dirty = false
    this.emit('state', this.state)
  }

  private failPending(reason: string): void {
    for (const [id, p] of this.pending) {
      clearTimeout(p.timer)
      p.resolve({ ok: false, err: 'OFFLINE', msg: reason })
      this.pending.delete(id)
    }
  }

  private setStatus(patch: Partial<RuntimeStatus>): void {
    this.status = { ...this.status, ...patch }
    this.emit('status', this.status)
  }
}
