/**
 * The compiler (step 29): program.json + tags.json → program.rt.json, the numbered step table the C runtime
 * loads (Software implementation › 4d / 4e). Pure: no files, no Electron — the CLI (tools/compile-project.mts)
 * and later the Build button call it. Golden-file tests: compile.golden.test.ts.
 *
 *   4e step              here
 *   1 Load               (the caller reads the two files)
 *   2 Index tags         name → id = index in tags.json (the order the file has)
 *   3 Check graph        one START, every way out linked, every link to a node that exists, nothing unreachable
 *   4 Order steps        walk from START, depth first, yes before no: i = 0, 1, 2 …
 *   5 Resolve params     tag names → ids, kind check per op (the same rules as the property panel, step 25)
 *   6 Expressions        step 30 — for now the condition is carried as text ("expr")
 *   7 Functions          with the CALL node
 *   8 Emit               program.rt.json + CRC-32 of the flows and of tags.json
 *
 * The compiler is the gate: anything open or wrong is an error with flow name and node id, and nothing is made.
 * (The editor only shows problems as badges — step 26.)
 */
import type { ProgramFile, ProgramFlow, ProgramNode, Tag, TagFile } from '@shared/ipc'
import type { RtFile, Flow as RtFlow, Step } from '@shared/generated/rt'
import { formatTagFile } from '@shared/tags-file'

export interface CompileError {
  flow: string
  /** editor node id (null: the flow as a whole) */
  node: string | null
  message: string
}

export type CompileResult = { ok: true; rt: RtFile; text: string } | { ok: false; errors: CompileError[] }

// ---------------------------------------------------------------- 8 · CRC-32 (IEEE, as zlib) — the runtime checks the download
const TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
export function crc32(text: string): string {
  let c = 0xffffffff
  for (const b of new TextEncoder().encode(text)) c = TABLE[(c ^ b) & 0xff]! ^ (c >>> 8)
  return ((c ^ 0xffffffff) >>> 0).toString(16).toUpperCase().padStart(8, '0')
}

// ---------------------------------------------------------------- the file as the design shows it: one step per line
export function formatRtFile(rt: RtFile): string {
  const steps = (s: Step[]): string => (s.length ? `[\n${s.map((x) => `        ${JSON.stringify(x)}`).join(',\n')}\n      ]` : '[]')
  const flows = rt.flows.map(
    (f) =>
      `    {\n      "name": ${JSON.stringify(f.name)}, "id": ${f.id}, "station": ${JSON.stringify(f.station)}, "autostart": ${f.autostart},\n      "steps": ${steps(f.steps)}\n    }`
  )
  return `{\n  "schema": "spm.rt/1", "crc": "${rt.crc}", "tags_crc": "${rt.tags_crc}",\n  "flows": [${flows.length ? `\n${flows.join(',\n')}\n  ` : ''}]\n}\n`
}

// ---------------------------------------------------------------- 5 · what each op's tag fields accept
const TAG_RULES: Record<string, { key: string; out: string; ok: (t: Tag) => boolean; what: string; optional?: boolean }[]> = {
  wait_di: [
    {
      key: 'tag',
      out: 'tag',
      ok: (t) => t.kind === 'DI' || (t.kind === 'REG' && t.dtype === 'BOOL'),
      what: 'a digital input (DI) or BOOL register'
    },
    { key: 'alarm', out: 'alarm', ok: (t) => t.kind === 'ALARM', what: 'an alarm (ALARM)', optional: true }
  ],
  set_do: [{ key: 'tag', out: 'tag', ok: (t) => t.kind === 'DO', what: 'a digital output (DO)' }],
  move_abs: [
    { key: 'axis', out: 'axis', ok: (t) => t.kind === 'AXIS', what: 'an axis (AXIS)' },
    { key: 'point', out: 'point', ok: (t) => t.kind === 'POINT', what: 'a point (POINT)' }
  ]
}

const OUTLETS: Record<string, (string | null)[]> = { start: [null], end: [], if: ['yes', 'no'] }
const outlets = (type: string): (string | null)[] => OUTLETS[type] ?? [null]

/** whole number in [min, max] or a message */
function int(v: unknown, min: number, max: number, what: string): number | string {
  return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max
    ? v
    : `${what} must be a whole number ${min} … ${max} (is ${JSON.stringify(v ?? null)})`
}

function compileFlow(f: ProgramFlow, flowId: number, ids: Map<string, number>, tags: Tag[], errors: CompileError[]): RtFlow {
  const err = (node: string | null, message: string): void => void errors.push({ flow: f.name, node, message })
  const byId = new Map(f.nodes.map((n) => [n.id, n]))

  // ---- 3 · the graph
  const starts = f.nodes.filter((n) => n.type === 'start')
  if (starts.length !== 1) err(null, starts.length ? `${starts.length} Starts — a flow has exactly one` : 'the flow has no Start')
  const out = new Map<string, Map<string | null, string>>() // node → way out → target
  for (const [from, to, way = null] of f.edges) {
    const n = byId.get(from)
    if (!n || !byId.has(to)) {
      err(from, `link ${from} → ${to} leads to a node that is not there`)
      continue
    }
    if (!outlets(n.type).includes(way)) {
      err(from, `link ${from} → ${to}${way ? ` ('${way}')` : ''} does not fit ${/^[aeiou]/.test(n.type) ? 'an' : 'a'} ${n.type} node`)
      continue
    }
    const m = out.get(from) ?? new Map<string | null, string>()
    if (m.has(way)) err(from, `${way ? `its '${way}'` : 'its'} way out is linked twice`)
    m.set(way, to)
    out.set(from, m)
  }
  for (const n of f.nodes)
    for (const w of outlets(n.type)) if (!out.get(n.id)?.has(w)) err(n.id, w ? `'${w}' way out is not linked` : 'way out is not linked')

  // ---- 4 · order: walk from START, depth first, yes before no
  const order: ProgramNode[] = []
  const seen = new Set<string>()
  const visit = (id: string): void => {
    if (seen.has(id)) return
    seen.add(id)
    order.push(byId.get(id)!)
    for (const w of outlets(byId.get(id)!.type)) {
      const t = out.get(id)?.get(w)
      if (t) visit(t)
    }
  }
  if (starts[0]) visit(starts[0].id)
  if (starts.length === 1) for (const n of f.nodes) if (!seen.has(n.id)) err(n.id, 'cannot be reached from Start')
  const num = new Map(order.map((n, i) => [n.id, i]))
  const next = (n: ProgramNode, w: string | null = null): number => num.get(out.get(n.id)?.get(w) ?? '') ?? -1

  // ---- 5 · parameters
  const tag = (n: ProgramNode, rule: (typeof TAG_RULES)[string][number]): number | undefined => {
    const name = (n.p as Record<string, unknown> | undefined)?.[rule.key]
    if (name === undefined || name === '') {
      if (!rule.optional) err(n.id, `${rule.key} is not set`)
      return undefined
    }
    const id = ids.get(String(name))
    if (id === undefined) return void err(n.id, `no tag ${String(name)} in tags.json`)
    if (!rule.ok(tags[id]!)) return void err(n.id, `${String(name)} is a ${tags[id]!.kind}, not ${rule.what}`)
    return id
  }
  const steps: Step[] = order.map((n, i): Step => {
    const p = (n.p ?? {}) as Record<string, unknown>
    const base = { i, src: n.id }
    const params: Record<string, number> = {}
    for (const r of TAG_RULES[n.type] ?? []) {
      const id = tag(n, r)
      if (id !== undefined) params[r.out] = id
    }
    const number = (key: string, min: number, max: number, what: string): number => {
      const v = int(p[key], min, max, what)
      if (typeof v === 'string') err(n.id, v)
      return typeof v === 'number' ? v : 0
    }
    switch (n.type) {
      case 'start':
        return { ...base, op: 'START', next: next(n) }
      case 'end':
        return { ...base, op: 'END' }
      case 'wait_di':
        return {
          ...base,
          op: 'WAIT_DI',
          tag: params.tag ?? 0,
          val: p.value === false ? 0 : 1,
          tmo: number('timeout_ms', 0, 600000, 'timeout_ms'),
          ...(params.alarm !== undefined ? { alarm: params.alarm } : {}),
          next: next(n)
        }
      case 'set_do':
        return { ...base, op: 'SET_DO', tag: params.tag ?? 0, val: p.value === false ? 0 : 1, next: next(n) }
      case 'move_abs': {
        const axis = params.axis
        const point = params.point
        if (axis !== undefined && point !== undefined && !((tags[point]!.axes ?? []) as string[]).includes(tags[axis]!.name))
          err(n.id, `point ${tags[point]!.name} does not belong to axis ${tags[axis]!.name}`)
        return { ...base, op: 'MOVE_ABS', axis: axis ?? 0, point: point ?? 0, spd: number('speed', 1, 100, 'speed'), next: next(n) }
      }
      case 'delay':
        return { ...base, op: 'DELAY', ms: number('ms', 1, 3600000, 'ms'), next: next(n) }
      case 'if': {
        const expr = typeof p.expr === 'string' ? p.expr.trim() : ''
        if (!expr) err(n.id, 'the condition is empty')
        return { ...base, op: 'IF', expr: expr || '?', yes: next(n, 'yes'), no: next(n, 'no') }
      }
      default:
        err(n.id, `node type ${n.type} cannot be compiled yet`)
        return { ...base, op: 'END' }
    }
  })
  return { name: f.name, id: flowId, station: f.station, autostart: f.autostart ?? false, steps }
}

/** program.json + tags.json → program.rt.json (text exactly as written to disk) or every error found */
export function compile(program: ProgramFile, tagFile: TagFile): CompileResult {
  const tags = tagFile.tags
  const ids = new Map(tags.map((t, i) => [t.name, i]))
  const errors: CompileError[] = []
  const names = new Set<string>()
  for (const f of program.flows) {
    if (names.has(f.name)) errors.push({ flow: f.name, node: null, message: 'two flows have this name' })
    names.add(f.name)
  }
  const flows = program.flows.map((f, i) => compileFlow(f, i, ids, tags, errors))
  if (errors.length) return { ok: false, errors }
  const body: RtFile = { schema: 'spm.rt/1', crc: '00000000', tags_crc: crc32(formatTagFile(tagFile)), flows }
  // the CRC covers the flows exactly as written (the file with crc = 00000000)
  const rt: RtFile = { ...body, crc: crc32(formatRtFile(body)) }
  return { ok: true, rt, text: formatRtFile(rt) }
}

/** one line per error, for the CLI and Build output */
export const describe = (e: CompileError): string => `${e.flow}${e.node ? ` · ${e.node}` : ''}: ${e.message}`
