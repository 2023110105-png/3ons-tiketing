const DEFAULT_PROD_API_BASE_URL = 'https://yamaha-scan-tiketing-production.up.railway.app'

export function getApiBaseUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim()
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
