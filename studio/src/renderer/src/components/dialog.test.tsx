// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { confirmDialog, toast, useFeedback, TOAST_MS } from '../stores/feedback.store'
import { ConfirmDialogHost } from './dialog.view'
import { ToastHost } from './toast.view'

beforeEach(() => useFeedback.setState({ dialog: undefined, toasts: [] }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

const ask = (): Promise<boolean> => {
  let p!: Promise<boolean>
  act(() => {
    p = confirmDialog({ title: 'Delete recipe?', message: 'Cannot be undone.', confirmLabel: 'Delete', danger: true })
  })
  return p
}

describe('confirm dialog', () => {
  it('confirm button resolves true and closes', async () => {
    render(<ConfirmDialogHost />)
    const p = ask()
    expect(screen.getByRole('alertdialog', { name: 'Delete recipe?' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await expect(p).resolves.toBe(true)
    expect(screen.queryByRole('alertdialog')).toBeNull()
  })

  it('Cancel and ✕ resolve false', async () => {
    render(<ConfirmDialogHost />)
    let p = ask()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await expect(p).resolves.toBe(false)
    p = ask()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await expect(p).resolves.toBe(false)
  })

  it('Esc cancels', async () => {
    render(<ConfirmDialogHost />)
    const p = ask()
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' })
    await expect(p).resolves.toBe(false)
  })

  it('focus starts on Cancel (the safe answer) and Tab wraps inside the dialog', () => {
    render(<ConfirmDialogHost />)
    void ask()
    const cancel = screen.getByRole('button', { name: 'Cancel' })
    const del = screen.getByRole('button', { name: 'Delete' })
    const x = screen.getByRole('button', { name: 'Close' })
    expect(document.activeElement).toBe(cancel)
    del.focus()
    fireEvent.keyDown(del, { key: 'Tab' }) // last → first
    expect(document.activeElement).toBe(x)
    fireEvent.keyDown(x, { key: 'Tab', shiftKey: true }) // first → last
    expect(document.activeElement).toBe(del)
  })

  it('a second question cancels the first', async () => {
    render(<ConfirmDialogHost />)
    const first = ask()
    void ask()
    await expect(first).resolves.toBe(false)
  })
})

describe('toast', () => {
  it('shows and hides by itself after TOAST_MS', () => {
    vi.useFakeTimers()
    render(<ToastHost />)
    act(() => {
      toast('Draft saved', 'done')
    })
    expect(screen.getByText('Draft saved')).toBeTruthy()
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite')
    act(() => {
      vi.advanceTimersByTime(TOAST_MS + 10)
    })
    expect(screen.queryByText('Draft saved')).toBeNull()
  })

  it('keeps at most 3, can be dismissed, kind sets the class', () => {
    render(<ToastHost />)
    act(() => {
      for (const t of ['a', 'b', 'c', 'd']) toast(t, t === 'd' ? 'error' : 'info', 60_000)
    })
    expect(screen.queryByText('a')).toBeNull() // oldest dropped
    expect(screen.getByText('d').closest('.toast')?.className).toContain('toast-error')
    fireEvent.click(screen.getAllByRole('button', { name: 'Dismiss' })[0])
    expect(screen.queryByText('b')).toBeNull()
  })
})
