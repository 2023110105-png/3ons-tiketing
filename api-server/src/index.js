import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import crypto from 'crypto'

import { readEnv } from './env.js'
import { initFirebaseAdmin, getAuth, getFirestore } from './firebaseAdmin.js'

const env = readEnv()
initFirebaseAdmin({
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: env.FIREBASE_PRIVATE_KEY
})

const app = express()
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS || 30000)

if (!env.apiDevBypassAuth && String(process.env.NODE_ENV || '').toLowerCase() === 'production' && !env.PLATFORM_ADMIN_SECRET) {
  throw new Error('PLATFORM_ADMIN_SECRET wajib diisi di production')
}

app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '1mb' }))
app.use(morgan('tiny'))
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID()
  res.setHeader('x-request-id', req.requestId)
  next()
})
app.use((req, _res, next) => {
  req.setTimeout(REQUEST_TIMEOUT_MS)
  next()
})

app.use(cors({
  origin(origin, cb) {
    // Allow server-to-server, curl, and same-origin
    if (!origin) return cb(null, true)
    if (env.corsAllowedOrigins.length === 0) return cb(null, true)
    if (env.corsAllowedOrigins.includes(origin)) return cb(null, true)
    return cb(new Error('CORS blocked'))
  },
  credentials: true
}))

app.get('/health', (req, res) => {
  res.json({
    success: true,
    service: 'api-server',
    time: new Date().toISOString(),
    uptime_seconds: Math.round(process.uptime()),
    request_id: req.requestId
  })
})

// Note: /me endpoint intentionally removed for now since owner panel uses secret auth.

function platformSecretRequired(req, res, next) {
  if (env.apiDevBypassAuth) return next()
  const provided = String(req.headers['x-platform-admin-secret'] || '').trim()
  if (!env.PLATFORM_ADMIN_SECRET) return res.status(500).json({ success: false, error: 'Server not configured' })
  if (!provided || provided !== env.PLATFORM_ADMIN_SECRET) return res.status(401).json({ success: false, error: 'Unauthorized' })
  return next()
}

function normalizeString(value) {
  return String(value || '').trim()
}

function normalizeEmail(value) {
  const clean = String(value || '').trim().toLowerCase()
  return clean || null
}

function normalizeRole(value) {
  const role = String(value || '').trim()
  if (role === 'admin_client' || role === 'gate_front' || role === 'gate_back') return role
  return 'gate_front'
}

// ===== Owner: user management (fullstack via Firebase Admin) =====
app.post('/platform/owner/tenants/:tenantId/users', platformSecretRequired, async (req, res) => {
  try {
    const tenantId = normalizeString(req.params.tenantId)
    if (!tenantId) return res.status(400).json({ success: false, error: 'tenantId required' })

    const username = normalizeString(req.body?.username).toLowerCase()
    const email = normalizeEmail(req.body?.email)
    const password = normalizeString(req.body?.password)
    const name = normalizeString(req.body?.name) || username
    const role = normalizeRole(req.body?.role)

    if (!username) return res.status(400).json({ success: false, error: 'username required' })
    if (password.length < 6) return res.status(400).json({ success: false, error: 'password must be >= 6 chars' })

    const db = getFirestore()
    const auth = getAuth()

    // Create Firebase Auth user if email provided; otherwise create "registry-only" user.
    let authUid = null
    if (email) {
      const userRecord = await auth.createUser({
        email,
        password,
        displayName: name,
        disabled: false
      })
      authUid = userRecord.uid
      await auth.setCustomUserClaims(authUid, { role, tenant_id: tenantId })
    }

    const userId = authUid || `${tenantId}-${username}`
    const userDoc = {
      id: userId,
      username,
      email,
      name,
      role,
      tenantId,
      tenant_id: tenantId,
      auth_uid: authUid,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    await db.collection('tenants').doc(tenantId).collection('users').doc(userId).set(userDoc, { merge: true })

    return res.json({ success: true, user: userDoc })
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

app.patch('/platform/owner/tenants/:tenantId/users/:userId', platformSecretRequired, async (req, res) => {
  try {
    const tenantId = normalizeString(req.params.tenantId)
    const userId = normalizeString(req.params.userId)
    if (!tenantId || !userId) return res.status(400).json({ success: false, error: 'tenantId and userId required' })

    const patch = req.body || {}
    const db = getFirestore()
    const auth = getAuth()

    const ref = db.collection('tenants').doc(tenantId).collection('users').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Not found' })

    const current = snap.data() || {}
    const authUid = normalizeString(current.auth_uid || '') || null

    const next = { ...current }
    if (patch.username !== undefined) next.username = normalizeString(patch.username).toLowerCase()
    if (patch.email !== undefined) next.email = normalizeEmail(patch.email)
    if (patch.name !== undefined) next.name = normalizeString(patch.name) || next.name
    if (patch.role !== undefined) next.role = normalizeRole(patch.role)
    if (patch.is_active !== undefined) next.is_active = !!patch.is_active
    next.updated_at = new Date().toISOString()

    // Apply Firebase Auth changes if the user is backed by Auth.
    if (authUid) {
      const authUpdates = {}
      if (patch.email !== undefined) authUpdates.email = next.email
      if (patch.name !== undefined) authUpdates.displayName = next.name
      if (patch.password !== undefined) {
        const pwd = normalizeString(patch.password)
        if (pwd.length < 6) return res.status(400).json({ success: false, error: 'password must be >= 6 chars' })
        authUpdates.password = pwd
      }
      if (patch.is_active !== undefined) authUpdates.disabled = !next.is_active
      if (Object.keys(authUpdates).length > 0) {
        await auth.updateUser(authUid, authUpdates)
      }
      if (patch.role !== undefined) {
        await auth.setCustomUserClaims(authUid, { role: next.role, tenant_id: tenantId })
      }
    }

    await ref.set(next, { merge: true })
    return res.json({ success: true, user: next })
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

app.delete('/platform/owner/tenants/:tenantId/users/:userId', platformSecretRequired, async (req, res) => {
  try {
    const tenantId = normalizeString(req.params.tenantId)
    const userId = normalizeString(req.params.userId)
    if (!tenantId || !userId) return res.status(400).json({ success: false, error: 'tenantId and userId required' })

    const db = getFirestore()
    const auth = getAuth()

    const ref = db.collection('tenants').doc(tenantId).collection('users').doc(userId)
    const snap = await ref.get()
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Not found' })

    const data = snap.data() || {}
    const authUid = normalizeString(data.auth_uid || '') || null

    await ref.delete()
    if (authUid) {
      try {
        await auth.deleteUser(authUid)
      } catch (err) {
        // If Auth user already removed, ignore.
        const msg = String(err?.message || err)
        if (!msg.toLowerCase().includes('user')) {
          throw err
        }
      }
    }

    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

// Minimal Firestore proof endpoints (Owner only)
app.get('/api/tenants', platformSecretRequired, async (req, res) => {
  try {
    const db = getFirestore()
    const snapshot = await db.collection('tenants').limit(50).get()
    const tenants = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
    res.json({ success: true, tenants })
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

app.get('/api/tenants/:tenantId/snapshot', platformSecretRequired, async (req, res) => {
  try {
    const tenantId = String(req.params.tenantId || '').trim()
    if (!tenantId) return res.status(400).json({ success: false, error: 'tenantId required' })
    const db = getFirestore()

    const tenantDoc = await db.collection('tenants').doc(tenantId).get()
    if (!tenantDoc.exists) return res.status(404).json({ success: false, error: 'Not found' })

    const eventsSnap = await db.collection('tenants').doc(tenantId).collection('events').limit(25).get()
    const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() }))

    res.json({
      success: true,
      tenant: { id: tenantDoc.id, ...tenantDoc.data() },
      events
    })
  } catch (err) {
    res.status(500).json({ success: false, error: err?.message || String(err) })
  }
})

// Safer error shape for CORS rejections & others.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const msg = err?.message || String(err)
  if (msg.toLowerCase().includes('cors')) {
    return res.status(403).json({ success: false, error: 'CORS blocked' })
  }
  return res.status(500).json({ success: false, error: 'Server error' })
})

app.listen(env.PORT, () => {
  console.log(`[api-server] listening on :${env.PORT}`)
})

