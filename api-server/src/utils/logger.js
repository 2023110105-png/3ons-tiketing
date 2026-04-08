export function log(level, message, meta = {}) {
  const payload = {
    level: String(level || 'info').toLowerCase(),
    message: String(message || ''),
    time: new Date().toISOString(),
    ...meta
  }
  const line = JSON.stringify(payload)
  if (payload.level === 'error' || payload.level === 'warn') {
    console.error(line)
    return
  }
  console.log(line)
}

export function requestLog(req, message, meta = {}, level = 'info') {
  return log(level, message, {
    request_id: req?.requestId || null,
    method: req?.method || null,
    path: req?.originalUrl || req?.url || null,
    ...meta
  })
}
