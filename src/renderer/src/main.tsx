import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { applyTheme, systemPrefersDark } from './app/layout/themeContext'

// Match the OS appearance before the first paint; ThemeProvider takes over once settings load.
applyTheme(systemPrefersDark() ? 'dark' : 'light')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
