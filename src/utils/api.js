const DEFAULT_PROD_API_BASE_URL = 'https://yamaha-scan-tiketing-production.up.railway.app'
const WA_ADMIN_SECRET_HEADER = 'x-wa-admin-secret'

function getWaAdminSecret() {
  return String(import.meta.env.VITE_WA_ADMIN_SECRET || '').trim()
}

function needsWaAdminSecret(path) {
  const cleanPath = String(path || '')
  return cleanPath.startsWith('/api/wa/sessions')
    || cleanPath.startsWith('/api/wa/runtime')
    || cleanPath.startsWith('/api/wa/logout')
    || cleanPath.startsWith('/api/wa/test-send')
    || cleanPath.startsWith('/api/wa/batch-status')
    || cleanPath.startsWith('/api/send-ticket')
}

function normalizeBaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  // Common misconfiguration on Vercel env: domain without protocol.
  return `https://${value}`
}

function isLocalHostLike(url) {
  try {
    const host = new URL(url).hostname
    return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0'
  } catch {
    return false
  }
}

export function getApiBaseUrl() {
  const envBase = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
  const browserHost = typeof window !== 'undefined' ? window.location.hostname : ''
  const isLocalBrowser = browserHost === 'localhost' || browserHost === '127.0.0.1' || browserHost === '0.0.0.0'

  // Prevent production clients from trying to call local-only backend URLs.
  if (envBase && (!isLocalHostLike(envBase) || isLocalBrowser)) {
    return envBase
  }

  // Safety net: if Vercel env was not set yet, use the known Railway backend.
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')) {
    return DEFAULT_PROD_API_BASE_URL
  }

  return ''
}

export function buildApiUrl(path) {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) return path

  const cleanBase = baseUrl.replace(/\/$/, '')
  const cleanPath = String(path || '')

  // If base already ends with /api and path starts with /api, avoid /api/api duplication.
  if (cleanBase.endsWith('/api') && cleanPath.startsWith('/api/')) {
    return `${cleanBase}${cleanPath.slice(4)}`
  }

  return `${cleanBase}${cleanPath}`
}

export function apiFetch(path, options) {
  const requestOptions = { ...(options || {}) }
  if (needsWaAdminSecret(path)) {
    const secret = getWaAdminSecret()
    if (secret) {
      const headers = new Headers(requestOptions.headers || {})
      headers.set(WA_ADMIN_SECRET_HEADER, secret)
      requestOptions.headers = headers
    }
  }

  return fetch(buildApiUrl(path), requestOptions)
}
