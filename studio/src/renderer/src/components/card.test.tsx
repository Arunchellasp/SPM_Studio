// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Card } from './card.view'

afterEach(cleanup)

describe('Card', () => {
  it('shows the title as a heading and is named by it', () => {
    render(<Card title="Why not faster?">text</Card>)
    expect(screen.getByRole('heading', { name: 'Why not faster?' })).toBeTruthy()
    // a <section> with a name becomes a "region" for screen readers
    expect(screen.getByRole('region', { name: 'Why not faster?' })).toBeTruthy()
  })

  it('has no header when there is no title and no actions', () => {
    const { container } = render(<Card>only content</Card>)
    expect(container.querySelector('.card-head')).toBeNull()
    expect(screen.getByText('only content')).toBeTruthy()
  })

  it('renders actions on the right of the header', () => {
    const { container } = render(
      <Card title="Station 1" actions={<button>Open</button>}>
        body
      </Card>
    )
    expect(container.querySelector('.card-actions button')?.textContent).toBe('Open')
  })

  it('uses 16 px padding by default and none on request', () => {
    const { container, rerender } = render(<Card>a</Card>)
    expect(container.querySelector('.card-body')?.className).toContain('card-pad-md')
    rerender(<Card padding="none">a</Card>)
    expect(container.querySelector('.card-body')?.className).toContain('card-pad-none')
  })

  it('can fill the parent height', () => {
    const { container } = render(<Card fill>a</Card>)
    expect(container.querySelector('.card')?.className).toContain('card-fill')
  })
})
