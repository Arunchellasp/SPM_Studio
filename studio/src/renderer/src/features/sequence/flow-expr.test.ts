import { describe, expect, it } from 'vitest'
import { parseCondition } from './flow-expr'

const ok = (s: string) => parseCondition(s)
const err = (s: string): string => {
  const r = parseCondition(s)
  if (r.ok) throw new Error(`expected an error for ${s}`)
  return r.error
}

describe('N02 Decision condition (step 26)', () => {
  it('U-26.1 well formed conditions: the tag names they read, once each, in order', () => {
    expect(ok('R_PartCount >= 100')).toEqual({ ok: true, names: ['R_PartCount'] })
    expect(ok('DI_S1_PartPresent AND NOT DI_S1_ClampOpen')).toEqual({ ok: true, names: ['DI_S1_PartPresent', 'DI_S1_ClampOpen'] })
    expect(ok('(A + 2) * B / 4 <> C - 1 or a = TRUE')).toEqual({ ok: true, names: ['A', 'B', 'C', 'a'] })
    expect(ok('x and x')).toEqual({ ok: true, names: ['x'] })
    expect(ok('TRUE')).toEqual({ ok: true, names: [] })
    expect(ok('  R_S1_Step  =  3 ')).toEqual({ ok: true, names: ['R_S1_Step'] })
  })

  it('U-26.2 errors say what was expected and where (messages of the jsep parser since step 30)', () => {
    expect(err('')).toBe('the condition is empty')
    expect(err('R_PartCount >=')).toBe('Expected expression after >= (position 15)')
    expect(err('A AND')).toBe('AND needs something on both sides')
    expect(err('(A > 1')).toBe('Unclosed ( (position 7)')
    expect(err('A > 1)')).toBe('Unexpected ")" (position 6)')
    expect(err('A B')).toBe('an operator (AND, OR, =, < …) is missing between A and B')
    // A < B < C is fine for the syntax since step 30 (jsep); the TYPE check refuses it — U-30.3
    expect(err('A == 1')).toBe('Expected expression after = (position 4)')
    expect(err('A > 1 ; B')).toBe('an operator (AND, OR, =, < …) is missing between (A > 1) and B')
  })
})
