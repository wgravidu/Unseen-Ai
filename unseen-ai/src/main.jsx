import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { LanguageProvider } from './i18n/LanguageContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="app-bg" aria-hidden="true">
      <img className="app-bg-photo app-bg-left" src="/images/lady-left.jpg" alt="" />
      <img className="app-bg-photo app-bg-right" src="/images/men-right.jpg" alt="" />
      <div className="app-bg-overlay" />
    </div>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA shell caching is progressive enhancement; the app still works without it.
    })
  })
}
