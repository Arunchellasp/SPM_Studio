/**
 * N02 Decision condition — syntax only (step 26), now a thin wrapper: since step 30 the one parser of the studio
 * is src/shared/expr.ts (jsep, as the design says), used here, by the badges and by the compiler.
 * The type check (needs the project's tags) is compileExpr() in the same file.
 */
import { parseExpr } from '@shared/expr'

export type ExprResult = { ok: true; names: string[] } | { ok: false; error: string }

/** is this condition well formed? → the tag names it reads (in order, once each), or the first error */
export function parseCondition(text: string): ExprResult {
  if (!text.trim()) return { ok: false, error: 'the condition is empty' }
  const r = parseExpr(text)
  return r.ok ? { ok: true, names: r.names } : r
}
