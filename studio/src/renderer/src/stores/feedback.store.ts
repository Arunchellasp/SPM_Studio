/**
 * Feedback store: the in-app confirm dialog and short notifications (toasts).
 * Never window.alert / window.confirm: those block the whole app (and the live values),
 * look like the operating system, not like SPM Studio, and cannot be tested.
 */
import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string // default 'OK'
  cancelLabel?: string // default 'Cancel'
  /** red confirm button, for actions that delete or stop something */
  danger?: boolean
}

export type ToastKind = 'info' | 'done' | 'error'
export interface Toast {
  id: number
  text: string
  kind: ToastKind
}

export const TOAST_MS = 4000 // how long a toast stays (ms)
export const TOAST_MAX = 3 // more than 3 at once: the oldest goes

interface FeedbackState {
  dialog?: ConfirmOptions & { resolve: (ok: boolean) => void }
  toasts: Toast[]
  /** ask a question; the promise gives true (confirmed) or false (cancelled, Esc, ✕) */
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  closeDialog: (ok: boolean) => void
  /** show a short message that hides by itself after ms */
  toast: (text: string, kind?: ToastKind, ms?: number) => number
  dismissToast: (id: number) => void
}

let nextId = 1

export const useFeedback = create<FeedbackState>((set, get) => ({
  dialog: undefined,
  toasts: [],

  confirm: (opts) =>
    new Promise<boolean>((resolve) => {
      get().dialog?.resolve(false) // only one question at a time: an older one counts as cancelled
      set({ dialog: { ...opts, resolve } })
    }),

  closeDialog: (ok) => {
    const d = get().dialog
    if (!d) return
    set({ dialog: undefined })
    d.resolve(ok)
  },

  toast: (text, kind = 'info', ms = TOAST_MS) => {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }].slice(-TOAST_MAX) }))
    setTimeout(() => get().dismissToast(id), ms)
    return id
  },

  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}))

/** shortcuts usable anywhere (also outside React components) */
export const confirmDialog = (opts: ConfirmOptions): Promise<boolean> => useFeedback.getState().confirm(opts)
export const toast = (text: string, kind?: ToastKind, ms?: number): number => useFeedback.getState().toast(text, kind, ms)
