import { z } from 'zod'

const CreateUserSchema = z.object({
  username: z.string().trim().min(1),
  email: z.string().trim().email().optional().nullable(),
  password: z.string().trim().min(6),
  name: z.string().trim().optional(),
  role: z.enum(['admin_client', 'gate_front', 'gate_back']).optional()
})

const PatchUserSchema = z.object({
  username: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  password: z.string().trim().min(6).optional(),
  name: z.string().trim().min(1).optional(),
  role: z.enum(['admin_client', 'gate_front', 'gate_back']).optional(),
  is_active: z.boolean().optional()
})

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

export async function createTenantUser({ tenantId, body, db, auth }) {
  const payload = CreateUserSchema.parse({
    ...body,
    email: body?.email ? normalizeEmail(body.email) : null
  })
  const username = normalizeString(payload.username).toLowerCase()
  const email = normalizeEmail(payload.email)
  const password = normalizeString(payload.password)
  const name = normalizeString(payload.name) || username
  const role = normalizeRole(payload.role)

  let authUid = null
  if (email) {
    const userRecord = await auth.createUser({ email, password, displayName: name, disabled: false })
    authUid = userRecord.uid
    await auth.setCustomUserClaims(authUid, { role, tenant_id: tenantId })
  }

  const userId = authUid || `${tenantId}-${username}`
  const now = new Date().toISOString()
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
    created_at: now,
    updated_at: now
  }

  await db.collection('tenants').doc(tenantId).collection('users').doc(userId).set(userDoc, { merge: true })
  return userDoc
}

export async function patchTenantUser({ tenantId, userId, body, db, auth }) {
  const payload = PatchUserSchema.parse(body || {})
  const ref = db.collection('tenants').doc(tenantId).collection('users').doc(userId)
  const snap = await ref.get()
  if (!snap.exists) return null

  const current = snap.data() || {}
  const authUid = normalizeString(current.auth_uid || '') || null
  const next = { ...current }
  if (payload.username !== undefined) next.username = normalizeString(payload.username).toLowerCase()
  if (payload.email !== undefined) next.email = normalizeEmail(payload.email)
  if (payload.name !== undefined) next.name = normalizeString(payload.name) || next.name
  if (payload.role !== undefined) next.role = normalizeRole(payload.role)
  if (payload.is_active !== undefined) next.is_active = !!payload.is_active
  next.updated_at = new Date().toISOString()

  if (authUid) {
    const authUpdates = {}
    if (payload.email !== undefined) authUpdates.email = next.email
    if (payload.name !== undefined) authUpdates.displayName = next.name
    if (payload.password !== undefined) authUpdates.password = normalizeString(payload.password)
    if (payload.is_active !== undefined) authUpdates.disabled = !next.is_active
    if (Object.keys(authUpdates).length > 0) await auth.updateUser(authUid, authUpdates)
    if (payload.role !== undefined) await auth.setCustomUserClaims(authUid, { role: next.role, tenant_id: tenantId })
  }

  await ref.set(next, { merge: true })
  return next
}

export async function deleteTenantUser({ tenantId, userId, db, auth }) {
  const ref = db.collection('tenants').doc(tenantId).collection('users').doc(userId)
  const snap = await ref.get()
  if (!snap.exists) return false
  const data = snap.data() || {}
  const authUid = normalizeString(data.auth_uid || '') || null

  await ref.delete()
  if (authUid) {
    try {
      await auth.deleteUser(authUid)
    } catch (err) {
      const msg = String(err?.message || err)
      if (!msg.toLowerCase().includes('user')) throw err
    }
  }
  return true
}
