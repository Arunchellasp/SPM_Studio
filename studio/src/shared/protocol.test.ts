import { describe, expect, it } from 'vitest'
import { parseFrame } from './protocol'

describe('parseFrame', () => {
  it('accepts a state diff', () => {
    const { msg } = parseFrame('{"t":"state","seq":5,"v":{"12":1,"3":152.4},"pc":{"0":2}}')
    expect(msg?.t).toBe('state')
    if (msg?.t === 'state') {
      expect(msg.v['3']).toBe(152.4)
      expect(msg.pc['0']).toBe(2)
    }
  })

  it('accepts a command result with extra fields', () => {
    const { msg } = parseFrame('{"t":"res","id":41,"ok":true,"crc":"9F3A11C2"}')
    expect(msg?.t).toBe('res')
  })

  it('accepts an event', () => {
    const { msg } = parseFrame('{"t":"evt","ev":"alarm","ts":1,"code":301}')
    expect(msg?.t).toBe('evt')
  })

  it('rejects invalid JSON', () => {
    expect(parseFrame('{nope').error).toBe('invalid JSON')
  })

  it('rejects an unknown message type', () => {
    expect(parseFrame('{"t":"hello"}').msg).toBeNull()
  })

  it('rejects a state frame with a wrong value type', () => {
    expect(parseFrame('{"t":"state","seq":1,"v":{"1":{}}}').msg).toBeNull()
  })
})
