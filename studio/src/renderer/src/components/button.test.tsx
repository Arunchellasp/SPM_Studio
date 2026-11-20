// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Button } from './button.view'

afterEach(cleanup)

describe('Button', () => {
  it('shows its label and uses default style and size', () => {
    render(<Button>Save draft</Button>)
    const b = screen.getByRole('button', { name: 'Save draft' })
    expect(b.className).toContain('btn-default')
    expect(b.className).toContain('btn-md')
    expect(b.getAttribute('type')).toBe('button')
  })

  it('applies variant and size', () => {
    render(
      <Button variant="danger" size="lg">
        Delete
      </Button>
    )
    const b = screen.getByRole('button', { name: 'Delete' })
    expect(b.className).toContain('btn-danger')
    expect(b.className).toContain('btn-lg')
  })

  it('supports the xl size used for form actions', () => {
    render(<Button size="xl">Acknowledge</Button>)
    expect(screen.getByRole('button', { name: 'Acknowledge' }).className).toContain('btn-xl')
  })

  it('calls onClick', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Ack</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Ack' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button disabled onClick={onClick}>
        Start
      </Button>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start' }))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('renders an icon hidden from screen readers', () => {
    render(<Button icon="+">New tag</Button>)
    const b = screen.getByRole('button', { name: 'New tag' })
    expect(b.querySelector('.btn-icon')?.getAttribute('aria-hidden')).toBe('true')
  })
})
