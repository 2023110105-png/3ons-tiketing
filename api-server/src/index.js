import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'

import { readEnv } from './env.js'
import { initFirebaseAdmin } from './firebaseAdmin.js'
import { requestContext } from './middlewares/requestContext.js'
import { platformSecretRequired } from './middlewares/platformAuth.js'
import { createRateLimit } from './middlewares/rateLimit.js'
import { createHealthRoutes } from './routes/healthRoutes.js'
import { createPlatformOwnerRoutes } from './routes/platformOwnerRoutes.js'
import { createTenantRoutes } from './routes/tenantRoutes.js'
import { log } from './utils/logger.js'

const env = readEnv()
initFirebaseAdmin({
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: env.FIREBASE_PRIVATE_KEY
})

const app = express()
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000)
const platformAuth = platformSecretRequired(env)
const writeRateLimit = createRateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 10000),
  max: Number(process.env.RATE_LIMIT_MAX || 40)
})

if (env.isProduction && !env.PLATFORM_ADMIN_SECRET) {
  throw new Error('PLATFORM_ADMIN_SECRET wajib diisi di production')
}

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '1mb' }))
app.use(requestContext(REQUEST_TIMEOUT_MS))
app.use(cors({
  origin(origin, cb) {
    if (!origin) return cb(null, true)
    const normalizedOrigin = String(origin || '').trim()
    const host = (() => {
      try {
        return new URL(normalizedOrigin).hostname.toLowerCase()
      } catch {
        return ''
      }
    })()
    const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/i.test(String(origin || ''))
    const isVercelOrigin = host.endsWith('.vercel.app')
    const isHttpsOrigin = /^https:\/\//i.test(normalizedOrigin)
    // Accept all HTTPS origins to prevent environment-specific CORS lockouts.
    if (isHttpsOrigin) return cb(null, true)
    if (!env.isProduction && isLocalDevOrigin) return cb(null, true)
    if (isVercelOrigin) return cb(null, true)
    if (env.corsAllowedOrigins.length === 0) return cb(null, true)
    if (env.corsAllowedOrigins.includes(normalizedOrigin)) return cb(null, true)
    return cb(new Error('CORS blocked'))
  },
  credentials: true
}))

app.use(createHealthRoutes())
app.use(createPlatformOwnerRoutes({ platformSecretRequired: platformAuth, writeRateLimit }))
app.use(createTenantRoutes({ platformSecretRequired: platformAuth }))

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const msg = String(err?.message || '').toLowerCase()
  if (msg.includes('cors')) {
    return res.status(403).json({ success: false, error: 'CORS blocked', error_code: 'cors_blocked', request_id: req?.requestId || null })
  }
  return res.status(500).json({ success: false, error: 'Server error', error_code: 'internal_error', request_id: req?.requestId || null })
})

const server = app.listen(env.PORT, () => {
  log('info', 'api_server_started', {
    port: env.PORT,
    node_env: env.nodeEnv,
    auth_mode: env.apiDevBypassAuth ? 'dev_bypass' : 'platform_secret'
  })
})

function shutdown(signal) {
  log('warn', 'api_server_shutdown_signal', { signal })
  server.close(() => {
    log('info', 'api_server_stopped', { signal })
    process.exit(0)
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

