// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { Field } from './field.view'
import { Select } from './select.view'

afterEach(cleanup)

describe('Field', () => {
  it('links the label to the input (click label = focus input)', () => {
    render(<Field label="Target position" defaultValue="1" />)
    // getByLabelText only finds the input if <label for> and <input id> match
    const input = screen.getByLabelText('Target position')
    expect(input.tagName).toBe('INPUT')
  })

  it('shows the unit inside the box, hidden from screen readers', () => {
    const { container } = render(<Field label="Pos" unit="mm" />)
    const unit = container.querySelector('.field-unit')
    expect(unit?.textContent).toBe('mm')
    expect(unit?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.field')?.className).toContain('field-has-unit')
  })

  it('error: red state, message, aria-invalid and aria-describedby', () => {
    const { container } = render(<Field label="Pos" error="Allowed range 0 … 600 mm" />)
    const input = screen.getByLabelText('Pos')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    const msg = screen.getByRole('alert')
    expect(msg.textContent).toBe('Allowed range 0 … 600 mm')
    expect(input.getAttribute('aria-describedby')).toBe(msg.id)
    expect(container.querySelector('.field')?.className).toContain('field-error')
  })

  it('no error: no aria-invalid; hint is shown as grey help text', () => {
    render(<Field label="Speed" hint="Empty = default" />)
    const input = screen.getByLabelText('Speed')
    expect(input.getAttribute('aria-invalid')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByText('Empty = default')).toBeTruthy()
  })

  it('calls onChange while typing', () => {
    const onChange = vi.fn()
    render(<Field label="Pos" value="" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Pos'), { target: { value: '12.5' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })
})

describe('Select', () => {
  const OPTS = [
    { value: 'a', label: 'Recipe A' },
    { value: 'b', label: 'Recipe B' },
    { value: 'x', label: 'Archived', disabled: true }
  ]

  it('is a labelled native select with all options', () => {
    render(<Select label="Recipe" options={OPTS} defaultValue="a" />)
    const sel = screen.getByLabelText('Recipe') as HTMLSelectElement
    expect(sel.tagName).toBe('SELECT')
    expect(Array.from(sel.options).map((o) => o.text)).toEqual(['Recipe A', 'Recipe B', 'Archived'])
    expect(sel.options[2].disabled).toBe(true)
  })

  it('placeholder is a disabled first entry', () => {
    render(<Select label="Axis" placeholder="Choose…" options={OPTS} defaultValue="" />)
    const sel = screen.getByLabelText('Axis') as HTMLSelectElement
    expect(sel.options[0].text).toBe('Choose…')
    expect(sel.options[0].disabled).toBe(true)
    expect(sel.value).toBe('')
  })

  it('calls onChange with the chosen value', () => {
    const chosen: string[] = []
    // read the value inside the handler: a controlled select (value="a") resets itself afterwards
    render(<Select label="Recipe" options={OPTS} value="a" onChange={(e) => chosen.push(e.target.value)} />)
    fireEvent.change(screen.getByLabelText('Recipe'), { target: { value: 'b' } })
    expect(chosen).toEqual(['b'])
  })

  it('error state like Field', () => {
    render(<Select label="Recipe" options={OPTS} error="Choose a recipe" />)
    expect(screen.getByLabelText('Recipe').getAttribute('aria-invalid')).toBe('true')
    expect(screen.getByRole('alert').textContent).toBe('Choose a recipe')
  })
})
