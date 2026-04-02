export function getApiBaseUrl() {
  return import.meta.env.VITE_API_BASE_URL?.trim() || '';
}

export function buildApiUrl(path) {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, '')}${path}`;
}

export function apiFetch(path, options) {
  return fetch(buildApiUrl(path), options);
}
