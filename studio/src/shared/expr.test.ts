import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { TagFile } from './ipc'
import { compileExpr, parseExpr } from './expr'

const tags = (JSON.parse(readFileSync(resolve(__dirname, '../../../projects/demo/tags.json'), 'utf8')) as TagFile).tags
const rpn = (s: string, want?: 'BOOL' | 'NUM') => {
  const r = compileExpr(s, tags, want)
  return r.ok ? r.rpn.join(' ') : `ERROR ${r.error}`
}

describe('expressions (step 30)', () => {
  it('U-30.1 parser: the tag names read; words in any case; the syntax errors with their place', () => {
    expect(parseExpr('R_PartCount >= 100 and not DI_S1_ClampOpen')).toMatchObject({ ok: true, names: ['R_PartCount', 'DI_S1_ClampOpen'] })
    expect(parseExpr('x Or x')).toMatchObject({ ok: true, names: ['x'] })
    const err = (s: string): string => {
      const r = parseExpr(s)
      return r.ok ? 'ok' : r.error
    }
    expect(err('')).toBe('the expression is empty')
    expect(err('R_PartCount >=')).toBe('Expected expression after >= (position 15)')
    expect(err('(A > 1')).toBe('Unclosed ( (position 7)')
    expect(err('A == 1')).toBe('Expected expression after = (position 4)')
    expect(err('A B')).toBe('an operator (AND, OR, =, < …) is missing between A and B')
    expect(err('A AND')).toBe('AND needs something on both sides')
    expect(err('A > 1 ; B')).toBe('an operator (AND, OR, =, < …) is missing between (A > 1) and B')
    expect(err("A = 'x'")).toBe("'x' is not allowed here")
  })

  it('U-30.2 RPN: tag ids (index in tags.json), constants, operators after their operands, precedence', () => {
    expect(rpn('R_PartCount >= 100')).toBe('T:17 K:100 GE')
    expect(rpn('R_PartCount >= 100 AND NOT DI_S1_ClampOpen')).toBe('T:17 K:100 GE T:8 NOT AND')
    expect(rpn('DI_S1_ClampClosed OR DI_S1_ClampOpen AND DI_S1_PartPresent')).toBe('T:7 T:8 T:9 AND OR')
    expect(rpn('(R_S1_Step + 1) * 2 - -AI_Sealer_Temp / 4', 'NUM')).toBe('T:18 K:1 ADD K:2 MUL T:0 NEG K:4 DIV SUB')
    expect(rpn('DI_S1_PartPresent = TRUE')).toBe('T:9 K:1 EQ')
    expect(rpn('AI_Sealer_Temp <> 2.5')).toBe('T:0 K:2.5 NE')
  })

  it('U-30.3 type errors say which part has which type', () => {
    expect(rpn('R_PartCount AND DI_S1_PartPresent')).toBe('ERROR AND needs TRUE / FALSE on both sides — R_PartCount is a number, DI_S1_PartPresent is TRUE / FALSE')
    expect(rpn('DI_S1_PartPresent > 1')).toBe('ERROR > needs numbers on both sides — DI_S1_PartPresent is TRUE / FALSE, 1 is a number')
    expect(rpn('R_S1_Step < 3 < 5')).toBe('ERROR < needs numbers on both sides — (R_S1_Step < 3) is TRUE / FALSE, 5 is a number (A < B < C: write A < B AND B < C)')
    expect(rpn('DI_S1_PartPresent = 1')).toBe('ERROR = needs the same type on both sides — DI_S1_PartPresent is TRUE / FALSE, 1 is a number')
    expect(rpn('NOT R_PartCount')).toBe('ERROR NOT needs TRUE / FALSE — R_PartCount is a number')
    expect(rpn('-DI_S1_PartPresent')).toBe('ERROR minus needs a number — DI_S1_PartPresent is TRUE / FALSE')
    expect(rpn('AX_S1_X > 10')).toBe('ERROR AX_S1_X is an AXIS — it has no single value to use here (DI, DO, AI, AO, REG, RECIPE have)')
    expect(rpn('T_S1_ClampDwell > 10')).toMatch(/^ERROR T_S1_ClampDwell is a TIMER/)
    expect(rpn('R_Nothing > 1')).toBe('ERROR no tag R_Nothing in the project')
  })

  it('U-30.4 what the place needs: a condition must give TRUE / FALSE, a calculation a number', () => {
    expect(rpn('R_PartCount + 1', 'BOOL')).toBe('ERROR a condition must give TRUE / FALSE — R_PartCount + 1 gives a number')
    expect(rpn('R_PartCount > 1', 'NUM')).toBe('ERROR this must give a number — R_PartCount > 1 gives TRUE / FALSE')
    expect(rpn('R_PartCount + 1', 'NUM')).toBe('T:17 K:1 ADD')
  })
})
