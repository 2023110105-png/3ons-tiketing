import crypto from 'crypto'
import { requestLog } from '../utils/logger.js'

export function requestContext(timeoutMs) {
  return (req, res, next) => {
    const startedAt = Date.now()
    req.requestId = crypto.randomUUID()
    res.setHeader('x-request-id', req.requestId)
    req.setTimeout(timeoutMs)

    res.on('finish', () => {
      requestLog(req, 'request_finished', {
        status: res.statusCode,
        elapsed_ms: Date.now() - startedAt
      })
    })

    next()
  }
}
