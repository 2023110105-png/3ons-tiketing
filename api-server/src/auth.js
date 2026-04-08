import { getAuth } from './firebaseAdmin.js'

function parseBearerToken(headerValue) {
  const raw = String(headerValue || '').trim()
  const m = raw.match(/^Bearer\s+(.+)$/i)
  return m ? m[1].trim() : ''
}

export function authRequired({ devBypass = false } = {}) {
  return async function authMiddleware(req, res, next) {
    try {
      if (devBypass) {
        req.user = {
          uid: 'dev-bypass',
          email: 'dev@local',
          role: 'owner',
          tenant_id: 'tenant-default',
          claims: {}
        }
        return next()
      }

      const token = parseBearerToken(req.headers.authorization)
      if (!token) return res.status(401).json({ success: false, error: 'Unauthorized' })

      const decoded = await getAuth().verifyIdToken(token)
      const role = String(decoded?.role || decoded?.claims?.role || '').trim()
      const tenantId = String(decoded?.tenant_id || decoded?.tenantId || '').trim()

      req.user = {
        uid: decoded.uid,
        email: decoded.email || null,
        role: role || null,
        tenant_id: tenantId || null,
        claims: decoded
      }
      return next()
    } catch (err) {
      return res.status(401).json({ success: false, error: 'Unauthorized', detail: err?.message || String(err) })
    }
  }
}

export function requireRole(allowedRoles = []) {
  const allow = Array.isArray(allowedRoles) ? allowedRoles.map(r => String(r).toLowerCase()) : []
  return function roleMiddleware(req, res, next) {
    const role = String(req?.user?.role || '').toLowerCase()
    if (!role || allow.length === 0) return res.status(403).json({ success: false, error: 'Forbidden' })
    if (!allow.includes(role)) return res.status(403).json({ success: false, error: 'Forbidden' })
    return next()
  }
}

