import { sendError } from '../utils/http.js'

const store = new Map()

function getIp(req) {
  return String(req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown')
}

export function createRateLimit({ windowMs = 10000, max = 40 } = {}) {
  return function rateLimit(req, res, next) {
    const now = Date.now()
    const key = `${getIp(req)}|${req.path}`
    const entry = store.get(key) || { count: 0, resetAt: now + windowMs }
    if (now > entry.resetAt) {
      entry.count = 0
      entry.resetAt = now + windowMs
    }
    entry.count += 1
    store.set(key, entry)
    if (entry.count > max) {
      res.setHeader('retry-after', String(Math.ceil((entry.resetAt - now) / 1000)))
      return sendError(res, 429, req, 'rate_limited')
    }
    return next()
  }
}
