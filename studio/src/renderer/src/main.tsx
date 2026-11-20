import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import './theme/app.css'
import { App } from './app/App'
import { connectLiveStore } from './stores/live'
import { installSimApi } from './dev/sim-api'

// Outside Electron (plain browser preview / web demo): use the built-in simulator
if (!window.spm) installSimApi()

connectLiveStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
