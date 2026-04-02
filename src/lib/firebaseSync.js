import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
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
