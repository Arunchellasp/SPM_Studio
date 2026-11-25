/**
 * Expressions (step 30): conditions and calculations → type check → RPN for the runtime.
 * Software implementation › 4e step 6: 'parse (jsep, free) → type check → RPN'. One place for the whole
 * studio: the property panel and the badges (renderer) and the compiler (main) all use this file.
 *
 *   condition   R_PartCount >= 100 AND NOT DI_S1_ClampOpen
 *   RPN         ["T:17", "K:100", "GE", "T:8", "NOT", "AND"]      T:<tag id>  K:<constant>  then the operator
 *
 * Language (as since step 26): tags by name, numbers, TRUE / FALSE, ( ), = <> < <= > >=, + - * /, AND OR NOT.
 * The words AND OR NOT TRUE FALSE may be written in any case. Types: BOOL (TRUE / FALSE) and NUM (a number).
 */
import jsep from 'jsep'
import type { Tag } from './ipc'

export type ExprType = 'BOOL' | 'NUM'

// ---------------------------------------------------------------- jsep set up for this language only
// (jsep is configured once per process; nothing else in the studio uses it)
for (const op of [
  '||',
  '&&',
  '|',
  '^',
  '&',
  '==',
  '!=',
  '===',
  '!==',
  '<',
  '>',
  '<=',
  '>=',
  '<<',
  '>>',
  '>>>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '**'
])
  jsep.removeBinaryOp(op)
for (const op of ['-', '!', '~', '+']) jsep.removeUnaryOp(op)
jsep.addBinaryOp('OR', 1)
jsep.addBinaryOp('AND', 2)
for (const op of ['=', '<>', '<', '<=', '>', '>=']) jsep.addBinaryOp(op, 6)
jsep.addBinaryOp('+', 9)
jsep.addBinaryOp('-', 9)
jsep.addBinaryOp('*', 10)
jsep.addBinaryOp('/', 10)
jsep.addUnaryOp('NOT')
jsep.addUnaryOp('-')
jsep.addLiteral('TRUE', true)
jsep.addLiteral('FALSE', false)

type Node = jsep.Expression
const WORDS = ['AND', 'OR', 'NOT', 'TRUE', 'FALSE']

export type ParseResult = { ok: true; ast: Node; names: string[] } | { ok: false; error: string }

/** the text as a tree, and the tag names it reads (in order, once each) — or the first syntax error */
export function parseExpr(text: string): ParseResult {
  if (!text.trim()) return { ok: false, error: 'the expression is empty' }
  // the five words in any case → upper case for jsep (a tag name always has its kind prefix, e.g. DI_…)
  const src = text.replace(/\b(and|or|not|true|false)\b/gi, (w) => w.toUpperCase())
  let ast: Node
  try {
    ast = jsep(src)
  } catch (e) {
    const err = e as Error & { description?: string; index?: number }
    return { ok: false, error: `${err.description ?? err.message} (position ${(err.index ?? 0) + 1})` }
  }
  const names: string[] = []
  let problem = ''
  const walk = (n: Node): void => {
    if (problem) return
    switch (n.type) {
      case 'Compound': {
        const parts = (n.body as Node[]).map(show)
        problem = parts.some((p) => WORDS.includes(p))
          ? `${parts.find((p) => WORDS.includes(p))} needs something on both sides`
          : `an operator (AND, OR, =, < …) is missing between ${parts[0]} and ${parts[1]}`
        return
      }
      case 'Identifier': {
        const name = n.name as string
        if (WORDS.includes(name)) problem = `${name} needs something on both sides`
        else if (!names.includes(name)) names.push(name)
        return
      }
      case 'Literal':
        if (typeof n.value !== 'number' && typeof n.value !== 'boolean') problem = `${String(n.raw)} is not allowed here`
        return
      case 'UnaryExpression':
        return walk(n.argument as Node)
      case 'BinaryExpression':
        walk(n.left as Node)
        return walk(n.right as Node)
      default:
        problem = `${show(n)} is not allowed here (only tags, numbers, TRUE / FALSE and the operators)`
    }
  }
  walk(ast)
  return problem ? { ok: false, error: problem } : { ok: true, ast, names }
}

/** a short text of a part of the expression, for messages: 'R_PartCount', '(A + 1)' */
export function show(n: Node): string {
  switch (n.type) {
    case 'Identifier':
      return n.name as string
    case 'Literal':
      return typeof n.value === 'boolean' ? (n.value ? 'TRUE' : 'FALSE') : String(n.raw ?? n.value)
    case 'UnaryExpression':
      return `${n.operator === 'NOT' ? 'NOT ' : '-'}${show(n.argument as Node)}`
    case 'BinaryExpression':
      return `(${show(n.left as Node)} ${String(n.operator)} ${show(n.right as Node)})`
    default:
      return n.type
  }
}

// ---------------------------------------------------------------- types
/** the value type a tag gives in an expression, or why it cannot be used */
export function tagType(t: Tag): ExprType | string {
  const scalar = ['DI', 'DO', 'AI', 'AO', 'REG', 'RECIPE'].includes(t.kind)
  if (!scalar || t.dtype === 'STRUCT' || t.dtype === 'STRING')
    return `${t.name} is ${an(t.kind)} ${t.kind} — it has no single value to use here (DI, DO, AI, AO, REG, RECIPE have)`
  return t.dtype === 'BOOL' ? 'BOOL' : 'NUM'
}

const RPN_OP: Record<string, string> = {
  OR: 'OR',
  AND: 'AND',
  '=': 'EQ',
  '<>': 'NE',
  '<': 'LT',
  '<=': 'LE',
  '>': 'GT',
  '>=': 'GE',
  '+': 'ADD',
  '-': 'SUB',
  '*': 'MUL',
  '/': 'DIV'
}
const word = (t: ExprType): string => (t === 'BOOL' ? 'TRUE / FALSE' : 'a number')
/** the left side of a comparison is itself a comparison: A < B < C */
const chained = (n: Node): boolean => n.type === 'BinaryExpression' && ['<', '<=', '>', '>=', '=', '<>'].includes(n.operator as string)
const an = (kind: string): string => (/^[AEIOU]/.test(kind) ? 'an' : 'a')

export type CompileExprResult = { ok: true; type: ExprType; rpn: string[]; names: string[] } | { ok: false; error: string }

/**
 * Parse, check the types, make the RPN. `tags` = the project's tag table (ids = index in it, as in the step
 * table); `want` = what the place needs (a Decision: BOOL; a calculation into a REG: NUM).
 */
export function compileExpr(text: string, tags: Tag[], want?: ExprType): CompileExprResult {
  const p = parseExpr(text)
  if (!p.ok) return p
  const ids = new Map(tags.map((t, i) => [t.name, i]))
  const rpn: string[] = []
  const go = (n: Node): ExprType => {
    switch (n.type) {
      case 'Identifier': {
        const id = ids.get(n.name as string)
        if (id === undefined) throw new Error(`no tag ${String(n.name)} in the project`)
        const t = tagType(tags[id]!)
        if (t !== 'BOOL' && t !== 'NUM') throw new Error(t)
        rpn.push(`T:${id}`)
        return t
      }
      case 'Literal':
        rpn.push(`K:${typeof n.value === 'boolean' ? (n.value ? 1 : 0) : String(n.value)}`)
        return typeof n.value === 'boolean' ? 'BOOL' : 'NUM'
      case 'UnaryExpression': {
        const a = go(n.argument as Node)
        const op = n.operator as string
        const need: ExprType = op === 'NOT' ? 'BOOL' : 'NUM'
        if (a !== need) throw new Error(`${op === 'NOT' ? 'NOT' : 'minus'} needs ${word(need)} — ${show(n.argument as Node)} is ${word(a)}`)
        rpn.push(op === 'NOT' ? 'NOT' : 'NEG')
        return need
      }
      case 'BinaryExpression': {
        const op = n.operator as string
        const l = go(n.left as Node)
        const r = go(n.right as Node)
        const sides = `${show(n.left as Node)} is ${word(l)}, ${show(n.right as Node)} is ${word(r)}`
        if (op === 'AND' || op === 'OR') {
          if (l !== 'BOOL' || r !== 'BOOL') throw new Error(`${op} needs TRUE / FALSE on both sides — ${sides}`)
        } else if (op === '=' || op === '<>') {
          if (l !== r) throw new Error(`${op} needs the same type on both sides — ${sides}`)
        } else if (l !== 'NUM' || r !== 'NUM')
          throw new Error(
            `${op} needs numbers on both sides — ${sides}${chained(n.left as Node) && ['<', '<=', '>', '>='].includes(op) ? ' (A < B < C: write A < B AND B < C)' : ''}`
          )
        rpn.push(RPN_OP[op]!)
        return ['+', '-', '*', '/'].includes(op) ? 'NUM' : 'BOOL'
      }
      default:
        throw new Error(`${show(n)} is not allowed here`)
    }
  }
  let type: ExprType
  try {
    type = go(p.ast)
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
  if (want && type !== want)
    return {
      ok: false,
      error:
        want === 'BOOL'
          ? `a condition must give TRUE / FALSE — ${text.trim()} gives a number`
          : `this must give a number — ${text.trim()} gives TRUE / FALSE`
    }
  return { ok: true, type, rpn, names: p.names }
}

/**
 * Step 34 · run an RPN condition (what the C runtime will do each cycle; the mock runtime and the
 * browser simulator do it now). Values are numbers: TRUE = 1, FALSE = 0; a tag without a value reads 0.
 * Returns the top of the stack; throws on a token it does not know or a stack that does not add up.
 */
export function evalRpn(rpn: readonly string[], value: (tagId: number) => number | boolean | undefined): number {
  const st: number[] = []
  const pop = (): number => {
    const v = st.pop()
    if (v === undefined) throw new Error('RPN: stack empty')
    return v
  }
  const num = (v: number | boolean | undefined): number => (v === true ? 1 : v === false || v === undefined ? 0 : v)
  const bin = (f: (a: number, b: number) => number): void => {
    const b = pop()
    st.push(f(pop(), b))
  }
  const bool = (b: boolean): number => (b ? 1 : 0)
  for (const t of rpn) {
    if (t.startsWith('T:')) st.push(num(value(Number(t.slice(2)))))
    else if (t.startsWith('K:')) st.push(Number(t.slice(2)))
    else
      switch (t) {
        case 'NOT':
          st.push(bool(!pop()))
          break
        case 'NEG':
          st.push(-pop())
          break
        case 'AND':
          bin((a, b) => bool(!!a && !!b))
          break
        case 'OR':
          bin((a, b) => bool(!!a || !!b))
          break
        case 'EQ':
          bin((a, b) => bool(a === b))
          break
        case 'NE':
          bin((a, b) => bool(a !== b))
          break
        case 'LT':
          bin((a, b) => bool(a < b))
          break
        case 'LE':
          bin((a, b) => bool(a <= b))
          break
        case 'GT':
          bin((a, b) => bool(a > b))
          break
        case 'GE':
          bin((a, b) => bool(a >= b))
          break
        case 'ADD':
          bin((a, b) => a + b)
          break
        case 'SUB':
          bin((a, b) => a - b)
          break
        case 'MUL':
          bin((a, b) => a * b)
          break
        case 'DIV':
          bin((a, b) => (b === 0 ? 0 : a / b))
          break // like the C runtime: no exception in the cycle
        default:
          throw new Error(`RPN: unknown token ${t}`)
      }
  }
  if (st.length !== 1) throw new Error(`RPN: ${st.length} values left on the stack`)
  return st[0]!
}
