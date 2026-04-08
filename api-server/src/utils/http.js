export function safeErrorCode(err) {
  const code = String(err?.code || '').trim()
  if (!code) return 'internal_error'
  return code.toLowerCase()
}

export function safeErrorMessage(status) {
  if (status >= 500) return 'Server error'
  if (status === 404) return 'Not found'
  if (status === 403) return 'Forbidden'
  if (status === 401) return 'Unauthorized'
  return 'Request invalid'
}

export function sendError(res, status, req, errorCode) {
  return res.status(status).json({
    success: false,
    error: safeErrorMessage(status),
    error_code: String(errorCode || 'error'),
    request_id: req?.requestId || null
  })
}
