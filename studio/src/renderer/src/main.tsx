/**
 * Renderer entry: React starts here and draws <AppShell /> into <div id="root">.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import './theme/base.css'
import { AppShell } from './shell/app-shell.view'
import { applyTheme, loadTheme } from './app/theme'
import { connectProjectMenu } from './stores/project.store'

applyTheme(loadTheme()) // before the first paint, so a dark PC never flashes light
connectProjectMenu() // File › Open project… (Ctrl+O) / Save (Ctrl+S) from the window menu

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>
)
