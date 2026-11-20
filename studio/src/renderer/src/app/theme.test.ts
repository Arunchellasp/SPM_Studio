// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { THEME_KEY, loadTheme } from './theme'
import { useUi } from '../stores/ui.store'
import { ALL_SCREENS } from './screens'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('theme', () => {
  it('default is light (nothing saved yet)', () => {
    expect(loadTheme()).toBe('light')
  })

  it('setTheme("dark") switches the page and saves the choice on this PC', () => {
    useUi.getState().setTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_KEY)).toBe('dark')
    expect(useUi.getState().theme).toBe('dark')
  })

  it('the saved choice is read back at the next start', () => {
    localStorage.setItem(THEME_KEY, 'dark')
    expect(loadTheme()).toBe('dark')
  })

  it('back to light removes the attribute (plain N00 tokens)', () => {
    useUi.getState().setTheme('dark')
    useUi.getState().setTheme('light')
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem(THEME_KEY)).toBe('light')
  })

  it('an unknown saved value falls back to light', () => {
    localStorage.setItem(THEME_KEY, 'purple')
    expect(loadTheme()).toBe('light')
  })

  it('store start screen = first screen in screens.ts (kept in sync after removing the import circle)', () => {
    expect(ALL_SCREENS[0].id).toBe('operate')
  })
})
