const DEFAULT_PROD_API_BASE_URL = 'https://yamaha-scan-tiketing-production.up.railway.app'
const WA_ADMIN_SECRET_HEADER = 'x-wa-admin-secret'
const PLATFORM_ADMIN_SECRET_HEADER = 'x-platform-admin-secret'

function getWaAdminSecret() {
  return String(import.meta.env.VITE_WA_ADMIN_SECRET || '').trim()
}

function getApiBaseEnv() {
  return normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
}

function getPlatformApiBaseEnv() {
  return normalizeBaseUrl(import.meta.env.VITE_PLATFORM_API_BASE_URL)
}

function getWaBaseEnv() {
  return normalizeBaseUrl(import.meta.env.VITE_WA_BASE_URL)
}

function getPlatformAdminSecret() {
  const envSecret = String(import.meta.env.VITE_PLATFORM_ADMIN_SECRET || '').trim()
  if (envSecret) return envSecret

  // Local dev fallback to match api-server/.env default.
  if (typeof window !== 'undefined') {
    const host = String(window.location.hostname || '').trim()
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') {
      return 'local-platform-admin-secret'
    }
  }

  return ''
}

function needsWaAdminSecret(path) {
  const cleanPath = String(path || '')
  return cleanPath.startsWith('/api/wa/sessions')
    || cleanPath.startsWith('/api/wa/runtime')
    || cleanPath.startsWith('/api/wa/logout')
    || cleanPath.startsWith('/api/wa/bootstrap-session')
    || cleanPath.startsWith('/api/wa/test-send')
    || cleanPath.startsWith('/api/wa/batch-status')
    || cleanPath.startsWith('/api/wa/send-log')
    || cleanPath.startsWith('/api/send-ticket')
}

function isWaRoute(path) {
  const cleanPath = String(path || '')
  return cleanPath.startsWith('/api/wa/')
    || cleanPath === '/api/wa'
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
  const envBase = getApiBaseEnv()
  const browserHost = typeof window !== 'undefined' ? window.location.hostname : ''
  const isLocalBrowser = browserHost === 'localhost' || browserHost === '127.0.0.1' || browserHost === '0.0.0.0'

  // Explicit env always wins in local development.
  if (envBase && (isLocalBrowser || !isLocalHostLike(envBase))) {
    return envBase
  }

  // In browser production, prefer same-origin and let host rewrites/proxy handle routing.
  // This avoids direct cross-origin calls that often trigger CORS "Failed to fetch".
  if (typeof window !== 'undefined' && !isLocalBrowser) {
    return ''
  }

  return ''
}

export function getWaBaseUrl() {
  const envBase = getWaBaseEnv()
  if (envBase) return envBase
  // Backward compat: WA server used to be the same as API base
  return getApiBaseUrl()
}

export function getPlatformApiBaseUrl() {
  const envBase = getPlatformApiBaseEnv()
  const browserHost = typeof window !== 'undefined' ? String(window.location.hostname || '').trim() : ''
  if (envBase) return envBase

  // Local dev fallback: owner platform endpoints run on api-server (default 3002).
  if (typeof window !== 'undefined') {
    if (browserHost === 'localhost' || browserHost === '127.0.0.1' || browserHost === '0.0.0.0') {
      return 'http://127.0.0.1:3002'
    }
  }

  // In browser production, force same-origin so owner API goes through host proxy.
  if (typeof window !== 'undefined' && browserHost) {
    return ''
  }

  // Non-browser fallback (tests/SSR).
  return DEFAULT_PROD_API_BASE_URL
}

export function buildApiUrl(path) {
  const baseUrl = isWaRoute(path) ? getWaBaseUrl() : getApiBaseUrl()
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

export async function platformFetch(path, options) {
  const baseUrl = getPlatformApiBaseUrl()
  const cleanPath = String(path || '')
  const localProxyPath = cleanPath.startsWith('/platform/')
    ? `/api${cleanPath}`
    : (cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`)
  const url = baseUrl
    ? `${baseUrl.replace(/\/$/, '')}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`
    : localProxyPath

  const requestOptions = { ...(options || {}) }
  const secret = getPlatformAdminSecret()
  if (secret) {
    const headers = new Headers(requestOptions.headers || {})
    headers.set(PLATFORM_ADMIN_SECRET_HEADER, secret)
    requestOptions.headers = headers
  }

  return fetch(url, requestOptions)
}
