const DEFAULT_PROD_API_BASE_URL = 'https://yamaha-scan-tiketing-production.up.railway.app'

function normalizeBaseUrl(rawUrl) {
  const value = String(rawUrl || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  // Common misconfiguration on Vercel env: domain without protocol.
  return `https://${value}`
}

export function getApiBaseUrl() {
  const envBase = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
  if (envBase) return envBase

  // Safety net: if Vercel env was not set yet, use the known Railway backend.
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('vercel.app')) {
    return DEFAULT_PROD_API_BASE_URL
  }

  return ''
}

export function buildApiUrl(path) {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) return path
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

export function apiFetch(path, options) {
  return fetch(buildApiUrl(path), options)
}
