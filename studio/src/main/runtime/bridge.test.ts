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

/** Fake runtime: answers ping and commands, sends one state frame on connect.
 *  port: listen on this one (restart test) · hung: keeps the socket open but never answers a ping */
function fakeRuntime(port = 0, hung = { on: false }): Promise<string> {
  return new Promise((resolve) => {
    server = new WebSocketServer({ host: '127.0.0.1', port }, () => resolve(`ws://127.0.0.1:${(server!.address() as AddressInfo).port}`))
    server.on('connection', (ws: WebSocket) => {
      ws.send(JSON.stringify({ t: 'state', seq: 1, v: { '12': 1, '3': 10.5 }, pc: { '0': 2 } }))
      ws.on('message', (raw) => {
        const m = JSON.parse(raw.toString())
        if (m.t === 'ping' && !hung.on) ws.send(JSON.stringify({ t: 'pong', version: 'test', cycle_us: 1000 }))
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

  it('U-31.1 runtime stopped → offline at once; started again → online again (reconnect)', async () => {
    const url = await fakeRuntime()
    const port = Number(url.split(':').pop())
    bridge = new RuntimeBridge(url)
    const seen: string[] = []
    bridge.on('status', (s) => seen[seen.length - 1] !== s.link && seen.push(s.link))
    const online = waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.link === 'online' && res(s)))
    bridge.start()
    await online
    const t0 = Date.now()
    const off = waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.link === 'offline' && res(s)))
    for (const c of server!.clients) c.terminate() // the process is killed: its sockets close
    await new Promise<void>((r) => server!.close(() => r()))
    await off
    expect(Date.now() - t0).toBeLessThan(3000)
    // retrying while nothing listens: stays 'offline', no flicker to 'connecting'
    await new Promise((r) => setTimeout(r, 1700))
    expect(bridge.getStatus().link).toBe('offline')
    const back = waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.link === 'online' && res(s)), 6000)
    await fakeRuntime(port)
    await back
    expect(seen).toEqual(['connecting', 'online', 'offline', 'online'])
  }, 10000)

  it('U-31.2 runtime hangs (socket open, no pong) → offline within 3 s, with the reason', async () => {
    const hung = { on: false }
    bridge = new RuntimeBridge(await fakeRuntime(0, hung))
    const online = waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.link === 'online' && res(s)))
    bridge.start()
    await online
    hung.on = true
    const t0 = Date.now()
    const off = await waitFor<RuntimeStatus>((res) => bridge!.on('status', (s) => s.link === 'offline' && res(s)), 5000)
    expect(Date.now() - t0).toBeLessThan(3000)
    expect(off.lastError).toBe('no answer for 2.5 s (heartbeat lost)')
  }, 10000)
})
