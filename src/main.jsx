import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

const CHUNK_RELOAD_KEY = 'ons_chunk_reload_once'

function renderStartupError(message) {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#f0f0f5;padding:20px;">
      <div style="max-width:560px;width:100%;background:#16161f;border:1px solid rgba(239,68,68,.35);border-radius:14px;padding:20px;">
        <h2 style="margin:0 0 8px;font-size:20px;color:#ef4444;">Aplikasi gagal dimuat</h2>
        <p style="margin:0 0 14px;color:#c5c7d0;font-size:14px;line-height:1.5;">${message}</p>
        <button onclick="window.location.reload()" style="background:#e60012;color:#fff;border:none;border-radius:8px;padding:10px 16px;font-weight:600;cursor:pointer;">Muat Ulang</button>
      </div>
    </div>
  `
}

function isChunkLoadIssue(text) {
  const msg = String(text || '')
  return /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|Failed to import/i.test(msg)
}

function handleRuntimeLoadIssue(rawMessage) {
  if (isChunkLoadIssue(rawMessage)) {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, '1')
    renderStartupError('Versi aplikasi baru terdeteksi tetapi file lama masih tercache. Coba hard refresh (Ctrl+Shift+R) atau buka mode incognito.')
    return
  }

  console.error(`[Aplikasi] Kesalahan runtime tertangkap: ${String(rawMessage || 'unknown_error')}`)
}

window.addEventListener('error', (event) => {
  if (!event) return
  const message = event?.error?.message || event?.message
  if (!message) return
  handleRuntimeLoadIssue(message)
})

window.addEventListener('unhandledrejection', (event) => {
  const reason = event?.reason
  const message = reason?.message || String(reason || '')
  if (!message) return
  handleRuntimeLoadIssue(message)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Register PWA service worker in production-like environments.
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  registerSW({
    immediate: true,
    onRegisterError(error) {
      console.error('[PWA] register failed:', error)
    }
  })
}
