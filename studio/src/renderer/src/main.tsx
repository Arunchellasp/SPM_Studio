/**
 * Renderer entry: React starts here and draws <AppShell /> into <div id="root">.
 */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme/tokens.css'
import './theme/base.css'
import { AppShell } from './shell/app-shell.view'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppShell />
  </StrictMode>
)
