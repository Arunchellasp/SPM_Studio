// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ICONS, Icon, type IconName } from './icon.view'
import { ALL_SCREENS } from '../app/screens'

afterEach(cleanup)

describe('Icons', () => {
  it('every screen in screens.ts has an icon that exists in the registry', () => {
    for (const s of ALL_SCREENS) {
      expect(ICONS[s.icon], `${s.code} ${s.label}`).toBeDefined()
    }
  })

  it('every screen has its own icon (no two rail buttons look the same)', () => {
    const icons = ALL_SCREENS.map((s) => s.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })

  it('renders an SVG of 1em, hidden from screen readers when it has no label', () => {
    const { container } = render(<Icon name="alarms" />)
    const svg = container.querySelector('svg')!
    expect(svg.getAttribute('width')).toBe('1em')
    expect(svg.getAttribute('aria-hidden')).toBe('true')
    expect(svg.getAttribute('class')).toContain('icon')
  })

  it('with a label it is an image with that name', () => {
    render(<Icon name="forced" label="forced" />)
    expect(screen.getByRole('img', { name: 'forced' }).tagName.toLowerCase()).toBe('svg')
  })

  it('every registry entry renders (no missing import)', () => {
    for (const name of Object.keys(ICONS) as IconName[]) {
      const { container, unmount } = render(<Icon name={name} />)
      expect(container.querySelector('svg'), name).not.toBeNull()
      unmount()
    }
  })
})
