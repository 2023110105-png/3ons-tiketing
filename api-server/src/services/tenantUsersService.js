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

function collectIdentifierValues(user) {
  return [
    user?.doc_id,
    user?.id,
    user?.uid,
    user?.user_id,
    user?.auth_uid,
    user?.username,
    user?.user_name,
    user?.email,
    user?.email_login,
    user?.login_email
  ]
    .map((value) => normalizeString(value))
    .filter(Boolean)
}

function userMatchesIdentifier(user, rawUserId) {
  const normalized = normalizeString(rawUserId)
  if (!normalized) return false
  const lowered = normalized.toLowerCase()
  const identifiers = collectIdentifierValues(user)
  return identifiers.some((identifier) => (
    identifier === normalized || identifier.toLowerCase() === lowered
  ))
}

async function resolveFirebaseAuthUid({ auth, user }) {
  const directUid = normalizeString(user?.auth_uid || '')
  if (directUid) return directUid

  const idAsUid = normalizeString(user?.id || '')
  if (idAsUid) {
    try {
      const record = await auth.getUser(idAsUid)
      if (record?.uid) return record.uid
    } catch {
      // Continue with email lookup.
    }
  }

  const email = normalizeEmail(user?.email)
  if (email) {
    try {
      const record = await auth.getUserByEmail(email)
      if (record?.uid) return record.uid
    } catch {
      // No Firebase account found by email.
    }
  }

  return null
}

async function resolveTenantUserRef({ tenantId, userId, db }) {
  const usersCol = db.collection('tenants').doc(tenantId).collection('users')
  const rawUserId = normalizeString(userId)
  const loweredUserId = rawUserId.toLowerCase()
  const emailUserId = normalizeEmail(rawUserId)

  const directRef = usersCol.doc(rawUserId)
  const directSnap = await directRef.get()
  if (directSnap.exists) return { ref: directRef, snap: directSnap }

  const candidates = [
    { field: 'id', value: rawUserId },
    { field: 'auth_uid', value: rawUserId },
    { field: 'username', value: loweredUserId },
    { field: 'email', value: emailUserId }
  ]

  for (const candidate of candidates) {
    if (!candidate.value) continue
    const querySnap = await usersCol.where(candidate.field, '==', candidate.value).limit(1).get()
    if (!querySnap.empty) {
      const foundDoc = querySnap.docs[0]
      return { ref: foundDoc.ref, snap: foundDoc }
    }
  }

  // Fallback for legacy schemas where identifier fields differ.
  // This only runs for PATCH/DELETE and keeps compatibility with old data.
  const allUsersSnap = await usersCol.limit(500).get()
  const matchedDoc = allUsersSnap.docs.find((doc) => {
    const data = doc.data() || {}
    return userMatchesIdentifier({ ...data, doc_id: doc.id }, rawUserId)
  })
  if (matchedDoc) return { ref: matchedDoc.ref, snap: matchedDoc }

  return { ref: null, snap: null }
}

async function resolveTenantUserFromTenantDoc({ tenantId, userId, db }) {
  const tenantRef = db.collection('tenants').doc(tenantId)
  const tenantSnap = await tenantRef.get()
  if (!tenantSnap.exists) return null

  const tenantData = tenantSnap.data() || {}
  const users = Array.isArray(tenantData.users) ? tenantData.users : []
  const index = users.findIndex((user) => userMatchesIdentifier(user, userId))
  if (index < 0) return null

  return {
    tenantRef,
    tenantData,
    users,
    index,
    user: users[index]
  }
}

export async function createTenantUser({ tenantId, body, db, auth }) {
  const tenantRef = db.collection('tenants').doc(tenantId)
  const tenantSnap = await tenantRef.get()
  if (!tenantSnap.exists) {
    const err = new Error('Tenant not found')
    err.code = 'tenant_not_found'
    throw err
  }

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

  await tenantRef.collection('users').doc(userId).set(userDoc, { merge: true })
  return userDoc
}

export async function patchTenantUser({ tenantId, userId, body, db, auth }) {
  const payload = PatchUserSchema.parse(body || {})
  const { ref, snap } = await resolveTenantUserRef({ tenantId, userId, db })
  if (!ref || !snap || !snap.exists) {
    const legacyMatch = await resolveTenantUserFromTenantDoc({ tenantId, userId, db })
    if (!legacyMatch) return null

    const next = { ...(legacyMatch.user || {}) }
    if (payload.username !== undefined) next.username = normalizeString(payload.username).toLowerCase()
    if (payload.email !== undefined) next.email = normalizeEmail(payload.email)
    if (payload.name !== undefined) next.name = normalizeString(payload.name) || next.name
    if (payload.role !== undefined) next.role = normalizeRole(payload.role)
    if (payload.is_active !== undefined) next.is_active = !!payload.is_active
    next.updated_at = new Date().toISOString()

    const updatedUsers = [...legacyMatch.users]
    updatedUsers[legacyMatch.index] = next
    await legacyMatch.tenantRef.set({ users: updatedUsers }, { merge: true })

    const legacyAuthUid = await resolveFirebaseAuthUid({ auth, user: next })
    if (legacyAuthUid) next.auth_uid = legacyAuthUid
    if (legacyAuthUid) {
      const authUpdates = {}
      if (payload.email !== undefined) authUpdates.email = next.email
      if (payload.name !== undefined) authUpdates.displayName = next.name
      if (payload.password !== undefined) authUpdates.password = normalizeString(payload.password)
      if (payload.is_active !== undefined) authUpdates.disabled = !next.is_active
      if (Object.keys(authUpdates).length > 0) await auth.updateUser(legacyAuthUid, authUpdates).catch(() => {})
      if (payload.role !== undefined) await auth.setCustomUserClaims(legacyAuthUid, { role: next.role, tenant_id: tenantId }).catch(() => {})
    }
    return next
  }

  const current = snap.data() || {}
  const authUid = await resolveFirebaseAuthUid({ auth, user: current })
  const next = { ...current }
  if (payload.username !== undefined) next.username = normalizeString(payload.username).toLowerCase()
  if (payload.email !== undefined) next.email = normalizeEmail(payload.email)
  if (payload.name !== undefined) next.name = normalizeString(payload.name) || next.name
  if (payload.role !== undefined) next.role = normalizeRole(payload.role)
  if (payload.is_active !== undefined) next.is_active = !!payload.is_active
  next.updated_at = new Date().toISOString()

  if (authUid) {
    next.auth_uid = authUid
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
  const { ref, snap } = await resolveTenantUserRef({ tenantId, userId, db })
  if (!ref || !snap || !snap.exists) {
    const legacyMatch = await resolveTenantUserFromTenantDoc({ tenantId, userId, db })
    if (!legacyMatch) return false

    const updatedUsers = legacyMatch.users.filter((_, idx) => idx !== legacyMatch.index)
    await legacyMatch.tenantRef.set({ users: updatedUsers }, { merge: true })

    const legacyAuthUid = normalizeString(legacyMatch.user?.auth_uid || '') || normalizeString(legacyMatch.user?.id || '') || null
    if (legacyAuthUid) {
      try {
        await auth.deleteUser(legacyAuthUid)
      } catch (err) {
        const msg = String(err?.message || err)
        if (!msg.toLowerCase().includes('user')) throw err
      }
    }
    return true
  }
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
