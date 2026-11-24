/**
 * N02 Decision (step 26): the condition of an IF node — checked here, logic only (unit tested).
 * Software implementation › 4a: 'Decision · IF · expression; yes / no links · evaluated in one cycle'.
 * The compiler (step 29) turns the same grammar into RPN for the runtime ('rpn': ["T:30", "K:100", "GE"]).
 *
 *   condition := and ( OR and )*
 *   and       := not ( AND not )*
 *   not       := NOT not | compare
 *   compare   := sum ( ( = | <> | < | <= | > | >= ) sum )?
 *   sum       := product ( ( + | - ) product )*
 *   product   := operand ( ( * | / ) operand )*
 *   operand   := NAME | NUMBER | TRUE | FALSE | ( condition )
 *
 * Words are not case sensitive (and, Or, NOT); tag names are (as in tags.json).
 */

export type ExprResult = { ok: true; names: string[] } | { ok: false; error: string }

type Tok = { t: 'name' | 'num' | 'op' | 'word' | '(' | ')'; v: string; at: number }

const WORDS = new Set(['AND', 'OR', 'NOT', 'TRUE', 'FALSE'])
const COMPARE = new Set(['=', '<>', '<', '<=', '>', '>='])

function tokens(text: string): Tok[] | string {
  const out: Tok[] = []
  const re = /\s*(?:([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|(<>|<=|>=|[=<>+\-*/])|([()]))/y
  let i = 0
  while (i < text.length) {
    if (/^\s*$/.test(text.slice(i))) break
    re.lastIndex = i
    const m = re.exec(text)
    if (!m) {
      const at = i + (text.slice(i).length - text.slice(i).trimStart().length)
      return `'${text[at]}' is not allowed here (position ${at + 1})`
    }
    const at = m.index + (m[0].length - m[0].trimStart().length)
    if (m[1]) out.push(WORDS.has(m[1].toUpperCase()) ? { t: 'word', v: m[1].toUpperCase(), at } : { t: 'name', v: m[1], at })
    else if (m[2]) out.push({ t: 'num', v: m[2], at })
    else if (m[3]) out.push({ t: 'op', v: m[3], at })
    else out.push({ t: m[4] as '(' | ')', v: m[4], at })
    i = re.lastIndex
  }
  return out
}

/** is this condition well formed? → the tag names it reads (in order, once each), or the first error */
export function parseCondition(text: string): ExprResult {
  if (!text.trim()) return { ok: false, error: 'the condition is empty' }
  const toks = tokens(text)
  if (typeof toks === 'string') return { ok: false, error: toks }
  let k = 0
  const names: string[] = []
  const peek = (): Tok | undefined => toks[k]
  const where = (): string => (peek() ? `'${peek()!.v}' (position ${peek()!.at + 1})` : 'the end')
  const fail = (what: string): never => {
    throw new Error(`${what} expected at ${where()}`)
  }
  const isOp = (set: Set<string> | string[]): boolean => {
    const p = peek()
    return !!p && ((p.t === 'op' && (Array.isArray(set) ? set.includes(p.v) : set.has(p.v))) || false)
  }
  const isWord = (w: string): boolean => peek()?.t === 'word' && peek()!.v === w

  const operand = (): void => {
    const p = peek()
    if (!p) return fail('a tag, number or (')
    if (p.t === 'name') {
      if (!names.includes(p.v)) names.push(p.v)
      k++
    } else if (p.t === 'num' || (p.t === 'word' && (p.v === 'TRUE' || p.v === 'FALSE'))) k++
    else if (p.t === '(') {
      k++
      condition()
      if (peek()?.t !== ')') fail(')')
      k++
    } else fail('a tag, number or (')
  }
  const product = (): void => {
    operand()
    while (isOp(['*', '/'])) {
      k++
      operand()
    }
  }
  const sum = (): void => {
    product()
    while (isOp(['+', '-'])) {
      k++
      product()
    }
  }
  const compare = (): void => {
    sum()
    if (isOp(COMPARE)) {
      k++
      sum()
    }
    if (isOp(COMPARE)) fail('AND / OR between two comparisons')
  }
  const not = (): void => {
    if (isWord('NOT')) {
      k++
      not()
    } else compare()
  }
  const and = (): void => {
    not()
    while (isWord('AND')) {
      k++
      not()
    }
  }
  function condition(): void {
    and()
    while (isWord('OR')) {
      k++
      and()
    }
  }

  try {
    condition()
    if (k < toks.length) fail(peek()!.t === ')' ? 'a matching (' : 'AND, OR or a comparison')
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  return { ok: true, names }
}
