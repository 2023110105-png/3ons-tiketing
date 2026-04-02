const DEFAULT_PROD_API_BASE_URL = 'https://yamaha-scan-tiketing-production.up.railway.app'

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
  return fetch(buildApiUrl(path), options)
}
