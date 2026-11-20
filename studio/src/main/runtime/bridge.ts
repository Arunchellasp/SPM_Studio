/**
 * Runtime bridge: the one WebSocket link from the studio to the C runtime.
 * - reconnects with back-off
 * - request / response by id, with timeout
 * - merges state diffs, forwards them to windows at most ~30 times per second
 * - heartbeat every second; link marked offline if no pong for 3 s
 */
import { EventEmitter } from 'node:events'
import WebSocket from 'ws'
import { parseFrame, type CmdMsg } from '@shared/protocol'
import type { CommandResult, RuntimeEvent, RuntimeState, RuntimeStatus } from '@shared/ipc'

const REQUEST_TIMEOUT_MS = 2000
const HEARTBEAT_MS = 1000
const STALE_MS = 3000
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
  private backoff = 500
  private stopped = false
  private lastPong = 0
  private heartbeat?: NodeJS.Timeout
  private publishTimer?: NodeJS.Timeout
  private dirty = false
  private state: RuntimeState = { seq: 0, values: {}, pc: {} }
  private status: RuntimeStatus

  constructor(private readonly url: string) {
    super()
    this.status = { link: 'connecting', url }
  }

  start(): void {
    this.stopped = false
    this.connect()
    this.heartbeat = setInterval(() => this.tick(), HEARTBEAT_MS)
    this.publishTimer = setInterval(() => this.flush(), PUBLISH_MS)
  }

  stop(): void {
    this.stopped = true
    clearInterval(this.heartbeat)
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
    this.setStatus({ link: 'connecting' })
    const ws = new WebSocket(this.url)
    this.ws = ws

    ws.on('open', () => {
      this.backoff = 500
      this.lastPong = Date.now()
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
        this.backoff = Math.min(this.backoff * 2, 5000)
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
        this.emit('event', msg as RuntimeEvent)
        break
      case 'pong':
        this.lastPong = Date.now()
        this.setStatus({ runtimeVersion: msg.version, cycleUs: msg.cycle_us, cycleMaxUs: msg.cycle_max_us })
        break
    }
  }

  private tick(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (Date.now() - this.lastPong > STALE_MS) {
        this.setStatus({ lastError: 'heartbeat lost' })
        this.ws.terminate()
        return
      }
      this.ws.send(JSON.stringify({ t: 'ping' }))
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
