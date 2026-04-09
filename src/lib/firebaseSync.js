import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore'
import { db, isFirebaseEnabled } from './firebase'

function noopPromise() {
  return Promise.resolve(false)
}

function withSyncGuard(task) {
  if (!isFirebaseEnabled || !db) return noopPromise()
  return task().catch((err) => {
    console.error('[FirebaseSync] sync failed:', err?.message || err)
    return false
  })
}

function toPlainValue(value) {
  if (value == null) return value
  if (typeof value?.toDate === 'function') return value.toDate().toISOString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(toPlainValue)
  if (typeof value === 'object') {
    const plain = {}
    Object.entries(value).forEach(([key, nestedValue]) => {
      plain[key] = toPlainValue(nestedValue)
    })
    return plain
  }
  return value
}

async function readCollectionDocs(pathSegments) {
  if (!isFirebaseEnabled || !db) return []
  const snapshot = await getDocs(collection(db, ...pathSegments))
  return snapshot.docs.map(documentSnapshot => ({
    id: documentSnapshot.id,
    ...toPlainValue(documentSnapshot.data())
  }))
}

function getTimestampScore(item, fieldNames) {
  for (const field of fieldNames) {
    const rawValue = item?.[field]
    const score = new Date(rawValue || 0).getTime()
    if (Number.isFinite(score) && score > 0) return score
  }
  return 0
}

function sortByTimestampAscending(items, fieldNames = ['created_at', 'timestamp', 'updated_at']) {
  return [...items].sort((a, b) => getTimestampScore(a, fieldNames) - getTimestampScore(b, fieldNames))
}

function sortByTimestampDescending(items, fieldNames = ['timestamp', 'created_at', 'updated_at']) {
  return [...items].sort((a, b) => getTimestampScore(b, fieldNames) - getTimestampScore(a, fieldNames))
}

function parseStoredJSON(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function readSessionSnapshot() {
  if (typeof localStorage === 'undefined') return null
  const active = parseStoredJSON(localStorage.getItem('ons_session'))
  if (active) return active
  return parseStoredJSON(localStorage.getItem('event_session'))
}

function getScopedTenantIdFromSession() {
  const session = readSessionSnapshot()
  const role = String(session?.role || '').trim().toLowerCase()
  const isGlobalRole = role === 'owner' || role === 'super_admin'
  if (isGlobalRole) return ''
  return String(session?.tenant?.id || '').trim()
}

async function readTenantWorkspaceSnapshot(tenantId, tenantMeta = {}) {
  const [tenantUsers, tenantEvents] = await Promise.all([
    readCollectionDocs(['tenants', tenantId, 'users']),
    readCollectionDocs(['tenants', tenantId, 'events'])
  ])

  const events = {}

  for (const event of tenantEvents) {
    const [participants, checkInLogs, adminLogs] = await Promise.all([
      readCollectionDocs(['tenants', tenantId, 'events', event.id, 'participants']),
      readCollectionDocs(['tenants', tenantId, 'events', event.id, 'checkins']),
      readCollectionDocs(['tenants', tenantId, 'events', event.id, 'admin_logs'])
    ])

    events[event.id] = {
      id: event.id,
      name: String(event.name || 'Event Platform').trim() || 'Event Platform',
      isArchived: !!event.isArchived,
      created_at: event.created_at || new Date().toISOString(),
      currentDay: Number.isInteger(event.currentDay) && event.currentDay > 0 ? event.currentDay : 1,
      participants: sortByTimestampAscending(participants),
      checkInLogs: sortByTimestampDescending(checkInLogs),
      adminLogs: sortByTimestampDescending(adminLogs),
      pendingCheckIns: Array.isArray(event.pendingCheckIns) ? event.pendingCheckIns : [],
      offlineQueueHistory: Array.isArray(event.offlineQueueHistory) ? event.offlineQueueHistory : [],
      offlineConfig: {
        maxPendingAttempts: Number.isInteger(event?.offlineConfig?.maxPendingAttempts) && event.offlineConfig.maxPendingAttempts >= 1
          ? event.offlineConfig.maxPendingAttempts
          : 5
      },
      waTemplate: event.waTemplate || null
    }
  }

  const eventIds = Object.keys(events)
  const preferredActiveEventId = String(tenantMeta?.activeEventId || '').trim()
  const activeEventId = eventIds.includes(preferredActiveEventId)
    ? preferredActiveEventId
    : (eventIds[0] || null)

  return {
    users: sortByTimestampAscending(tenantUsers),
    activeEventId,
    events
  }
}

export async function fetchFirebaseWorkspaceSnapshot() {
  if (!isFirebaseEnabled || !db) return null

  const scopedTenantId = getScopedTenantIdFromSession()
  let tenantSnapshots = []
  try {
    tenantSnapshots = await readCollectionDocs(['tenants'])
  } catch (err) {
    const message = String(err?.message || err).toLowerCase()
    const permissionDenied = message.includes('permission') || message.includes('insufficient')
    if (!permissionDenied || !scopedTenantId) throw err

    const tenantDoc = await getDoc(doc(db, 'tenants', scopedTenantId))
    if (!tenantDoc.exists()) {
      return {
        tenantRegistry: null,
        store: null
      }
    }
    tenantSnapshots = [{ id: tenantDoc.id, ...toPlainValue(tenantDoc.data()) }]
  }

  if (scopedTenantId) {
    tenantSnapshots = tenantSnapshots.filter((tenant) => String(tenant?.id || '').trim() === scopedTenantId)
  }

  if (tenantSnapshots.length === 0) {
    return {
      tenantRegistry: null,
      store: null
    }
  }

  const tenantRegistry = {
    activeTenantId: tenantSnapshots[0].id,
    tenants: {}
  }
  const store = {
    tenants: {}
  }

  for (const tenant of tenantSnapshots) {
    const workspace = await readTenantWorkspaceSnapshot(tenant.id, tenant)
    tenantRegistry.tenants[tenant.id] = {
      id: tenant.id,
      brandName: String(tenant.brandName || tenant.name || 'Tenant').trim() || 'Tenant',
      eventName: String(tenant.eventName || 'Event Platform').trim() || 'Event Platform',
      status: tenant.status === 'inactive' ? 'inactive' : 'active',
      expires_at: tenant.expires_at || null,
      created_at: tenant.created_at || new Date().toISOString(),
      activeEventId: workspace.activeEventId,
      contract: tenant.contract || { package: 'starter', payment_status: 'unpaid' },
      quota: tenant.quota || { maxParticipants: 500, maxGateDevices: 3, maxActiveEvents: 1 },
      users: workspace.users,
      branding: tenant.branding || { primaryColor: '#0ea5e9' },
      invoices: Array.isArray(tenant.invoices) ? tenant.invoices : []
    }

    store.tenants[tenant.id] = {
      activeEventId: workspace.activeEventId,
      events: workspace.events
    }
  }

  return { tenantRegistry, store }
}

export function syncTenantUpsert(tenant) {
  if (!tenant?.id) return noopPromise()

  return withSyncGuard(async () => {
    await setDoc(
      doc(db, 'tenants', tenant.id),
      {
        ...tenant,
        updated_at: serverTimestamp()
      },
      { merge: true }
    )
    return true
  })
}

export function syncTenantDelete(tenantId) {
  if (!tenantId) return noopPromise()

  return withSyncGuard(async () => {
    await deleteDoc(doc(db, 'tenants', tenantId))
    return true
  })
}

export function syncTenantUserUpsert({ tenantId, user }) {
  if (!tenantId || !user?.id) return noopPromise()

  return withSyncGuard(async () => {
    const ref = doc(db, 'tenants', tenantId, 'users', user.id)
    await setDoc(
      ref,
      {
        ...user,
        tenant_id: tenantId,
        updated_at: serverTimestamp()
      },
      { merge: true }
    )
    return true
  })
}

export function syncTenantUserDelete({ tenantId, userId }) {
  if (!tenantId || !userId) return noopPromise()

  return withSyncGuard(async () => {
    await deleteDoc(doc(db, 'tenants', tenantId, 'users', userId))
    return true
  })
}

export function syncParticipantUpsert({ tenantId, eventId, participant }) {
  if (!tenantId || !eventId || !participant?.id) return noopPromise()

  return withSyncGuard(async () => {
    const ref = doc(db, 'tenants', tenantId, 'events', eventId, 'participants', participant.id)
    await setDoc(
      ref,
      {
        ...participant,
        tenant_id: tenantId,
        event_id: eventId,
        updated_at: serverTimestamp()
      },
      { merge: true }
    )
    return true
  })
}

export function syncParticipantDelete({ tenantId, eventId, participantId }) {
  if (!tenantId || !eventId || !participantId) return noopPromise()

  return withSyncGuard(async () => {
    const ref = doc(db, 'tenants', tenantId, 'events', eventId, 'participants', participantId)
    await deleteDoc(ref)
    return true
  })
}

export function syncCheckInLog({ tenantId, eventId, log }) {
  if (!tenantId || !eventId || !log?.id) return noopPromise()

  return withSyncGuard(async () => {
    const ref = doc(db, 'tenants', tenantId, 'events', eventId, 'checkins', log.id)
    await setDoc(
      ref,
      {
        ...log,
        tenant_id: tenantId,
        event_id: eventId,
        created_at: serverTimestamp()
      },
      { merge: true }
    )
    return true
  })
}

export function syncAuditLog({ tenantId, eventId, log }) {
  if (!tenantId || !eventId || !log?.id) return noopPromise()

  return withSyncGuard(async () => {
    const ref = doc(db, 'tenants', tenantId, 'events', eventId, 'admin_logs', log.id)
    await setDoc(
      ref,
      {
        ...log,
        tenant_id: tenantId,
        event_id: eventId,
        created_at: serverTimestamp()
      },
      { merge: true }
    )
    return true
  })
}

export function syncEventSnapshot({ tenantId, event }) {
  if (!tenantId || !event?.id) return noopPromise()

  return withSyncGuard(async () => {
    const ref = doc(db, 'tenants', tenantId, 'events', event.id)
    await setDoc(
      ref,
      {
        id: event.id,
        name: event.name,
        currentDay: event.currentDay,
        isArchived: !!event.isArchived,
        updated_at: serverTimestamp()
      },
      { merge: true }
    )

    return true
  })
}

export function syncEventDelete({ tenantId, eventId }) {
  if (!tenantId || !eventId) return noopPromise()

  return withSyncGuard(async () => {
    await deleteDoc(doc(db, 'tenants', tenantId, 'events', eventId))
    return true
  })
}
