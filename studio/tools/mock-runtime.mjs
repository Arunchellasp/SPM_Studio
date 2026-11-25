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
 *   step 34: cmd download { rt } (only in STOPPED; schema + CRC checked, src/shared/compile.ts) → res { ok, crc };
 *   the program runs in EXECUTE (src/shared/flow-sim.ts): evt { ev:'step', flow, pc } on every step change,
 *   state frames with pc per flow and the simulated values by tag id; evt 'machine' carries prog = its CRC.
 *   With a program loaded the alarm demo raises W0310 only (no E1202 abort), so the sequence can be watched.
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
const { FlowRunner } = await jiti.import(resolve(here, '../src/shared/flow-sim.ts'))
const { verifyRt } = await jiti.import(resolve(here, '../src/shared/compile.ts'))

const PORT = Number(process.env.SPM_RUNTIME_PORT ?? 7600)
const wss = new WebSocketServer({ host: '127.0.0.1', port: PORT })

let seq = 0
/** step 34: the downloaded program and its simulated engine (null = nothing loaded) */
let rt = null
let runner = null
const onStep = (p) => {
  const s = rt.flows[p.flow].steps[p.pc]
  console.log(`step ${rt.flows[p.flow].name} pc ${p.pc} ${s.op} (${s.src})`)
  broadcast({ t: 'evt', ev: 'step', ts: Date.now(), flow: p.flow, pc: p.pc })
}
const fresh = () => (runner = rt ? new FlowRunner(rt, onStep) : null) // Reset: every flow back to its Start
const pcs = () => (runner ? Object.fromEntries(runner.pc.map((p, i) => [String(i), p])) : {})
const vals = () => (runner ? Object.fromEntries([...runner.values].map(([id, v]) => [String(id), v])) : {})

const send = (ws, msg) => ws.readyState === 1 && ws.send(JSON.stringify(msg))
const broadcast = (msg) => wss.clients.forEach((ws) => send(ws, msg))
const machineEvt = (s) => ({ t: 'evt', ev: 'machine', ts: Date.now(), state: s.state, mode: s.mode, prog: rt ? rt.crc : null })
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
        if (rt) return // step 34: with a program loaded, let it run (no abort)
        alarms.raise('E1202')
        machine.abort() // P1 → Abort (design: E-stop, P1 alarm → Aborting)
      }, 12000)
    )
  }
  if (s.state === 'RESETTING') fresh()
  if (s.state === 'STOPPED') alarms.clear('E1202') // cleared by Reset after the abort
})
const reply = (ws, id, r) => send(ws, { t: 'res', id, ...r })

wss.on('connection', (ws) => {
  console.log('studio connected')
  send(ws, { t: 'state', seq: ++seq, v: vals(), pc: pcs() })
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
      case 'download': {
        if (machine.status.state !== 'STOPPED')
          return reply(ws, m.id, { ok: false, err: 'STATE', msg: `download only in STOPPED (now ${machine.status.state})` })
        const v = verifyRt(m.rt)
        if (!v.ok) return reply(ws, m.id, v)
        rt = m.rt
        fresh()
        console.log(`program ${rt.crc} loaded: ${rt.flows.length} flows, ${rt.flows.reduce((n, f) => n + f.steps.length, 0)} steps`)
        reply(ws, m.id, { ok: true, crc: rt.crc })
        broadcast(machineEvt(machine.status)) // everyone sees the new program CRC
        break
      }
      case 'write': // a simulated value by tag id (step 34: the values live in the flow engine)
        if (!runner || !Number.isInteger(m.tag)) return reply(ws, m.id, { ok: false, err: 'UNKNOWN_TAG', msg: `no tag ${m.tag} in the loaded program` })
        runner.values.set(m.tag, m.value)
        reply(ws, m.id, { ok: true })
        break
      default:
        send(ws, { t: 'res', id: m.id, ok: false, err: 'UNKNOWN_OP', msg: `op '${m.op}' not supported by mock` })
    }
  })
})

// 20 Hz: the flow engine runs while EXECUTE; every cycle a state frame (pc per flow, values by tag id)
setInterval(() => {
  if (machine.running && runner) runner.tick(50)
  broadcast({ t: 'state', seq: ++seq, v: vals(), pc: pcs() })
}, 50)

console.log(`mock runtime listening on ws://127.0.0.1:${PORT}`)
