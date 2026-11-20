import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import './theme/app.css'
import { App } from './app/App'
import { connectLiveStore } from './stores/live'

connectLiveStore()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
