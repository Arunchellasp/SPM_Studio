/**
 * Wire protocol between the C runtime and the studio (see schemas/message.schema.json).
 * Every frame from the runtime is validated here before it reaches the rest of the app.
 */
import { z } from 'zod'

const value = z.union([z.number(), z.boolean(), z.string()])

export const ResMsg = z
  .object({
    t: z.literal('res'),
    id: z.number().int(),
    ok: z.boolean(),
    err: z.string().optional(),
    msg: z.string().optional()
  })
  .loose()

export const StateMsg = z.object({
  t: z.literal('state'),
  seq: z.number().int(),
  v: z.record(z.string(), value).default({}),
  pc: z.record(z.string(), z.number().int()).default({})
})

export const EvtMsg = z
  .object({
    t: z.literal('evt'),
    ev: z.string(),
    ts: z.number()
  })
  .loose()

export const PongMsg = z.object({
  t: z.literal('pong'),
  version: z.string().optional(),
  cycle_us: z.number().optional(),
  cycle_max_us: z.number().optional()
})

export const InMsg = z.discriminatedUnion('t', [ResMsg, StateMsg, EvtMsg, PongMsg])
export type InMsg = z.infer<typeof InMsg>

export interface CmdMsg {
  t: 'cmd'
  id: number
  op: string
  [key: string]: unknown
}

/** Parse one text frame. Returns null (and the reason) for anything malformed. */
export function parseFrame(text: string): { msg: InMsg | null; error?: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { msg: null, error: 'invalid JSON' }
  }
  const r = InMsg.safeParse(raw)
  return r.success ? { msg: r.data } : { msg: null, error: r.error.issues[0]?.message ?? 'invalid message' }
}
