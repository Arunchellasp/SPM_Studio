import { afterEach, describe, expect, it } from 'vitest'
import { WebSocketServer, type WebSocket } from 'ws'
import type { AddressInfo } from 'node:net'
import { RuntimeBridge } from './bridge'
import type { RuntimeState, RuntimeStatus } from '@shared/ipc'

let server: WebSocketServer | null = null
let bridge: RuntimeBridge | null = null

afterEach(() => {
  bridge?.stop()
  server?.close()
  bridge = null
  server = null
})

/** Fake runtime: answers ping and commands, sends one state frame on connect. */
function fakeRuntime(): Promise<string> {
  return new Promise((resolve) => {
    server = new WebSocketServer({ host: '127.0.0.1', port: 0 }, () => resolve(`ws://127.0.0.1:${(server!.address() as AddressInfo).port}`))
    server.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({ t: 'state', seq: 1, v: { '12': 1, '3': 10.5 }, pc: { '0': 2 } }))
      ws.on('message', (raw) => {
        const m = JSON.parse(raw.toString())
        if (m.t === 'ping') ws.send(JSON.stringify({ t: 'pong', version: 'test', cycle_us: 1000 }))
        if (m.t === 'cmd') ws.send(JSON.stringify({ t: 'res', id: m.id, ok: m.op === 'start', echo: m.flow }))
      })
    })
  })
}

const waitFor = <T>(fn: (resolve: (v: T) => void) => void, ms = 2000): Promise<T> =>
  Promise.race([new Promise<T>(fn), new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

describe('RuntimeBridge', () => {
  it('connects, receives state and runtime version', async () => {
    bridge = new RuntimeBridge(await fakeRuntime())
    const online = waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.runtimeVersion && res(s)))
    const state = waitFor<RuntimeState>((res) => bridge!.on('state', res))
    bridge.start()
    expect((await online).link).toBe('online')
    expect((await state).values['3']).toBe(10.5)
  })

  it('matches command replies by id', async () => {
    bridge = new RuntimeBridge(await fakeRuntime())
    const online = waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.link === 'online' && res(s)))
    bridge.start()
    await online
    const [a, b] = await Promise.all([bridge.command('start', { flow: 'S1_Main' }), bridge.command('stop')])
    expect(a).toMatchObject({ ok: true, echo: 'S1_Main' })
    expect(b.ok).toBe(false)
  })

  it('reports offline when no runtime is listening', async () => {
    bridge = new RuntimeBridge('ws://127.0.0.1:1')
    const off = waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.link === 'offline' && res(s)))
    bridge.start()
    expect((await off).link).toBe('offline')
    expect((await bridge.command('start')).err).toBe('OFFLINE')
  })
})
