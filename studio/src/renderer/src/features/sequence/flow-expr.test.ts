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

  it('U-26.2 errors say what was expected and where', () => {
    expect(err('')).toBe('the condition is empty')
    expect(err('R_PartCount >=')).toBe('a tag, number or ( expected at the end')
    expect(err('A AND')).toBe('a tag, number or ( expected at the end')
    expect(err('(A > 1')).toBe(') expected at the end')
    expect(err('A > 1)')).toBe("a matching ( expected at ')' (position 6)")
    expect(err('A B')).toBe("AND, OR or a comparison expected at 'B' (position 3)")
    expect(err('A < B < C')).toBe("AND / OR between two comparisons expected at '<' (position 7)")
    expect(err('A == 1')).toBe("a tag, number or ( expected at '=' (position 4)")
    expect(err('A > 1 ; B')).toBe("';' is not allowed here (position 7)")
  })
})
