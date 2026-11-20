import { describe, expect, it } from 'vitest'
import { formatCount, formatValue } from './format'

describe('format', () => {
  it('formatCount groups thousands with a space', () => {
    expect(formatCount(12480)).toBe('12 480')
    expect(formatCount(950)).toBe('950')
    expect(formatCount(1234567)).toBe('1 234 567')
  })
  it('formatValue adds the unit and optional decimals', () => {
    expect(formatValue(4.85, 's')).toBe('4.85 s')
    expect(formatValue(4.5, 's', 2)).toBe('4.50 s')
    expect(formatValue(98.9, '%')).toBe('98.9 %')
    expect(formatValue(35)).toBe('35')
  })
})
