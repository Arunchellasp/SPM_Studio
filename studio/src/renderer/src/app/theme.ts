/**
 * Theme (step 10): light (default, the N00 design) or dark.
 * The choice is saved on this PC (localStorage lives in Electron's user-data folder,
 * so it survives a restart) and applied as <html data-theme="dark">; tokens.css does the rest.
 */
export type Theme = 'light' | 'dark'
export const THEME_KEY = 'spm.theme'

/** read the saved choice; anything missing or unknown → light */
export function loadTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light' // storage blocked: just use the default
  }
}

export function saveTheme(t: Theme): void {
  try {
    localStorage.setItem(THEME_KEY, t)
  } catch {
    // not saved, but the app still switches
  }
}

/** switch the CSS: light = no attribute (plain N00 tokens), dark = the [data-theme='dark'] set */
export function applyTheme(t: Theme): void {
  if (t === 'dark') document.documentElement.dataset.theme = 'dark'
  else delete document.documentElement.dataset.theme
}
