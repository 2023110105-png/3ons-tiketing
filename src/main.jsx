import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register Progressive Web App Service Worker after the app is rendered.
// Never let SW registration failure block app boot.
if ('serviceWorker' in navigator) {
  try {
    registerSW({ immediate: true })
  } catch (error) {
    console.error('[PWA] Failed to register service worker:', error)
  }
}
