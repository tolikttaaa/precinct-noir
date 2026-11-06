import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/sofia-sans'
import '@fontsource-variable/sofia-sans-extra-condensed'
import '@fontsource/cousine/400.css'
import './index.css'
import App from './App.tsx'
import { initI18n } from './i18n'

initI18n()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
