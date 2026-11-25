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
import { connectLiveStore } from './stores/live.store'
import { installSimApi } from './dev/sim-api'

applyTheme(loadTheme()) // before the first paint, so a dark PC never flashes light
if (!window.spm) installSimApi() // plain browser (preview, UI tests): the simulator stands in for Electron + runtime
connectLiveStore() // step 31: runtime status / state / events → live store (header link)
connectProjectMenu() // File › Open project… (Ctrl+O) / Save (Ctrl+S) from the window menu

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>
)
