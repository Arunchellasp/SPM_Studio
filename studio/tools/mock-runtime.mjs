#!/usr/bin/env node
/**
 * Mock runtime: stands in for the C runtime (spm_rt) until phase P2/P3.
 * Speaks the same WebSocket protocol on ws://127.0.0.1:7600:
 *   ping → pong · cmd → res · state diffs at 20 Hz · step / alarm events
 *   step 32: a PackML machine (src/shared/packml-sim.ts, loaded with jiti) —
 *   cmd start / hold / stop / reset / mode → evt { ev: 'machine', state, mode } on every change
 *   step 33: alarms (src/shared/alarm-sim.ts) — evt 'alarms' on connect, evt 'alarm' raise / ack / clear,
 *   cmd ack { code, user }. Demo: in EXECUTE, after 6 s W0310 (P3, clears itself 10 s later),
 *   after 12 s E1202 (P1) → the machine aborts; Reset (clear) after the abort clears E1202.
 *
 *   npm run mock-runtime          (on the PC: start-mock-runtime.cmd)
 */
import { dirname, resolve } from 'node:path'
import { clearTimeout, setTimeout } from 'node:timers'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'
import { WebSocketServer } from 'ws'

const here = dirname(fileURLToPath(import.meta.url))
const jiti = createJiti(import.meta.url)
const { PackMachine } = await jiti.import(resolve(here, '../src/shared/packml-sim.ts'))
const { AlarmBook } = await jiti.import(resolve(here, '../src/shared/alarm-sim.ts'))

const PORT = Number(process.env.SPM_RUNTIME_PORT ?? 7600)
const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT })

const tags = { DI_S1_PartPresent: false, 'AX_S1_X.pos': 0, AI_Sealer_Temp: 25, R_PartCount: 0, DO_S1_ClampValve: false }
let seq = 0
let pc = 0
let t = 0
let tick = 0
const steps = ['wait part', 'move X to pick', 'clamp', 'seal', 'count']

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg))
const broadcast = (msg) => wss.clients.forEach((ws) => send(ws, msg))
const machineEvt = (s) => ({ t: 'evt', ev: 'machine', ts: Date.now(), state: s.state, mode: s.mode })
const alarms = new AlarmBook((e) => {
  console.log(`alarm ${e.act} ${e.code}${e.by ? ` by ${e.by}` : ''}`)
  broadcast({ t: 'evt', ts: Date.now(), ...e })
})
let demo = [] // timers of the alarm demo, running only while EXECUTE
const machine = new PackMachine((s) => {
  console.log(`machine ${s.state} · ${s.mode}`)
  broadcast(machineEvt(s))
  demo.forEach(clearTimeout)
  demo = []
  if (s.state === 'EXECUTE') {
    demo.push(
      setTimeout(() => {
        if (alarms.has('W0310')) return
        alarms.raise('W0310')
        setTimeout(() => alarms.clear('W0310'), 10000) // glue refilled
      }, 6000),
      setTimeout(() => {
        alarms.raise('E1202')
        machine.abort() // P1 → Abort (design: E-stop, P1 alarm → Aborting)
      }, 12000)
    )
  }
  if (s.state === 'STOPPED') alarms.clear('E1202') // cleared by Reset after the abort
})
const reply = (ws, id, r) => send(ws, { t: 'res', id, ...r })

wss.on('connection', (ws) => {
  console.log('studio connected')
  send(ws, { t: 'state', seq: ++seq, v: tags, pc: { 0: pc } })
  send(ws, machineEvt(machine.status))
  send(ws, { t: 'evt', ts: Date.now(), ...alarms.snapshot() })

  ws.on('message', (raw) => {
    let m
    try {
      m = JSON.parse(raw.toString())
    } catch {
      return
    }
    if (m.t === 'ping')
      return send(ws, { t: 'pong', version: '0.0.0-mock', cycle_us: 1000, cycle_max_us: 1000 + Math.round(Math.random() * 150) })
    if (m.t !== 'cmd') return
    switch (m.op) {
      case 'start':
      case 'hold':
      case 'stop':
      case 'reset':
        reply(ws, m.id, machine.command(m.op))
        break
      case 'mode':
        reply(ws, m.id, machine.setMode(m.mode))
        break
      case 'ack':
        reply(ws, m.id, alarms.ack(m.code, m.user))
        break
      case 'write':
        if (!(m.tag in tags)) return send(ws, { t: 'res', id: m.id, ok: false, err: 'UNKNOWN_TAG', msg: `no tag ${m.tag}` })
        tags[m.tag] = m.value
        send(ws, { t: 'res', id: m.id, ok: true })
        break
      default:
        send(ws, { t: 'res', id: m.id, ok: false, err: 'UNKNOWN_OP', msg: `op '${m.op}' not supported by mock` })
    }
  })
})

// 20 Hz state publishing, simple simulated machine
setInterval(() => {
  t += 0.05
  tick += 1
  tags['AI_Sealer_Temp'] = 180 + 5 * Math.sin(t)
  if (machine.running) {
    tags['AX_S1_X.pos'] = 300 + 300 * Math.sin(t * 0.8)
    if (tick % 40 === 0) {
      pc = (pc + 1) % steps.length
      tags['DI_S1_PartPresent'] = pc !== 0
      tags['DO_S1_ClampValve'] = pc >= 2 && pc <= 3
      if (pc === 4) tags['R_PartCount'] += 1
      broadcast({ t: 'evt', ev: 'step', ts: Date.now(), flow: 0, pc, name: steps[pc] })
    }
  }
  broadcast({ t: 'state', seq: ++seq, v: { ...tags }, pc: { 0: pc } })
}, 50)

console.log(`mock runtime listening on ws://127.0.0.1:${PORT}`)
