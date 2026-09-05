import './styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import {
  applyTheme,
  bootThemeSetting,
  resolveThemeSetting,
  systemPrefersDark
} from './app/layout/themeContext'

// Apply the persisted theme (passed by main as `?theme=`) before the first paint so a light user
// on a dark OS never sees a dark flash; ThemeProvider takes over once settings load.
applyTheme(resolveThemeSetting(bootThemeSetting(), systemPrefersDark()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
