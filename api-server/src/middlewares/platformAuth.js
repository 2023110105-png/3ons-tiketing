import { sendError } from '../utils/http.js'

export function platformSecretRequired(env) {
  return function platformSecretMiddleware(req, res, next) {
    if (env.apiDevBypassAuth) return next()
    const provided = String(req.headers['x-platform-admin-secret'] || '').trim()
    if (!env.PLATFORM_ADMIN_SECRET) return sendError(res, 500, req, 'server_not_configured')
    if (!provided || provided !== env.PLATFORM_ADMIN_SECRET) return sendError(res, 401, req, 'unauthorized')
    return next()
  }
}
