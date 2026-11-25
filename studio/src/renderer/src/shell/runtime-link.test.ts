import { describe, expect, it } from 'vitest'
import { linkView, ms } from './runtime-link'

describe('runtime link in the header (step 31)', () => {
  it('U-31.3 online: cycle time in the text; address, version, max cycle in the tooltip', () => {
    const v = linkView({ link: 'online', url: 'ws://127.0.0.1:7600', runtimeVersion: '0.0.0-mock', cycleUs: 1000, cycleMaxUs: 1150 })
    expect(v).toEqual({
      tone: 'online',
      text: 'Online · 1.00 ms',
      title: 'Runtime online at ws://127.0.0.1:7600\nversion 0.0.0-mock\ncycle 1.00 ms · max 1.15 ms'
    })
    expect(linkView({ link: 'online', url: '' }).text).toBe('Online') // before the first pong
    expect(ms(2000)).toBe('2.00 ms')
  })

  it('U-31.4 offline: OFFLINE with the reason; connecting: amber text', () => {
    expect(linkView({ link: 'offline', url: 'ws://127.0.0.1:7600', lastError: 'connect ECONNREFUSED 127.0.0.1:7600' })).toEqual({
      tone: 'offline',
      text: 'OFFLINE',
      title: 'No runtime at ws://127.0.0.1:7600 — retrying\nconnect ECONNREFUSED 127.0.0.1:7600'
    })
    expect(linkView({ link: 'connecting', url: 'ws://127.0.0.1:7600' })).toMatchObject({ tone: 'connecting', text: 'Connecting…' })
  })
})
