import { supabase, isSupabaseEnabled } from './supabase.js'

const DEFAULT_TENANT_ID = 'Primavera Production'
const WORKSPACE_TABLE = 'workspace_state'
const WORKSPACE_ID = 'default'
const WORKSPACE_SCHEMA = 'public'

// Singleton state for shared subscription
const globalSubState = {
  callbacks: new Set(),
  isSubscribed: false,
  isConnecting: false,
  isPolling: false,
  pollTimer: null,
  lastData: null,
  channel: null
}

function noopPromise() {
  return Promise.resolve(false)
}

function cloneJson(value) {
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function createEmptySnapshot() {
  return {
    tenantRegistry: { activeTenantId: '', tenants: {} },
    store: { tenants: {} }
  }
}

export function isWorkspaceSyncEnabled() {
  return isSupabaseEnabled
}

function scopeTenantPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload
  // Keep original tenantId - support multi-tenant
  return { ...payload }
}

// Workspace helpers
async function readWorkspaceRow() {
  if (!isSupabaseEnabled || !supabase) return null
  const { data, error } = await supabase
    .from(WORKSPACE_TABLE)
    .select('tenant_registry, store')
    .eq('id', WORKSPACE_ID)
    .maybeSingle()
  if (error) throw error
  if (!data) return createEmptySnapshot()
  return {
    tenantRegistry: data.tenant_registry || { activeTenantId: '', tenants: {} },
    store: data.store || { tenants: {} }
  }
}

async function writeWorkspaceRow(snapshot) {
  if (!isSupabaseEnabled || !supabase) return false
  const { error } = await supabase
    .from(WORKSPACE_TABLE)
    .upsert({
      id: WORKSPACE_ID,
      tenant_registry: snapshot.tenantRegistry || { activeTenantId: '', tenants: {} },
      store: snapshot.store || { tenants: {} },
      updated_at: new Date().toISOString()
    })
  if (error) throw error
  return true
}

function ensureTenantRegistry(snapshot) {
  if (!snapshot.tenantRegistry || typeof snapshot.tenantRegistry !== 'object') {
    snapshot.tenantRegistry = { activeTenantId: '', tenants: {} }
  }
  if (!snapshot.tenantRegistry.tenants || typeof snapshot.tenantRegistry.tenants !== 'object') {
    snapshot.tenantRegistry.tenants = {}
  }
}

function ensureStore(snapshot) {
  if (!snapshot.store || typeof snapshot.store !== 'object') snapshot.store = { tenants: {} }
  if (!snapshot.store.tenants || typeof snapshot.store.tenants !== 'object') snapshot.store.tenants = {}
}

function ensureTenantStoreBucket(snapshot, tenantId) {
  ensureStore(snapshot)
  if (!snapshot.store.tenants[tenantId] || typeof snapshot.store.tenants[tenantId] !== 'object') {
    snapshot.store.tenants[tenantId] = { activeEventId: null, events: {} }
  }
  const bucket = snapshot.store.tenants[tenantId]
  if (!bucket.events || typeof bucket.events !== 'object') bucket.events = {}
  return bucket
}

function ensureEvent(snapshot, tenantId, eventId) {
  const bucket = ensureTenantStoreBucket(snapshot, tenantId)
  if (!bucket.events[eventId] || typeof bucket.events[eventId] !== 'object') {
    bucket.events[eventId] = {
      id: eventId,
      name: 'Event Platform',
      currentDay: 1,
      isArchived: false,
      participants: [],
      deletedParticipantIds: {},
      checkInLogs: [],
      adminLogs: [],
      pendingCheckIns: [],
      offlineQueueHistory: [],
      offlineConfig: { maxPendingAttempts: 5 },
      waTemplate: '',
      waSendMode: 'message_only'
    }
  }
  return bucket.events[eventId]
}

async function mutateWorkspace(mutator) {
  if (!isSupabaseEnabled || !supabase) return false
  const current = await readWorkspaceRow()
  const snapshot = cloneJson(current) || createEmptySnapshot()
  ensureTenantRegistry(snapshot)
  ensureStore(snapshot)
  mutator(snapshot)
  return writeWorkspaceRow(snapshot)
}

// Subscription helpers
function notifyAllCallbacks(payload) {
  globalSubState.callbacks.forEach((cb) => {
    try {
      cb(payload)
    } catch (err) {
      console.error('[DataSync] callback error:', err?.message)
    }
  })
}

function stopGlobalPolling() {
  if (globalSubState.pollTimer) {
    clearInterval(globalSubState.pollTimer)
    globalSubState.pollTimer = null
    globalSubState.isPolling = false
  }
}

function startGlobalPolling(pollInterval) {
  if (globalSubState.isPolling) return
  globalSubState.isPolling = true

  const doPoll = async () => {
    try {
      const snapshot = await readWorkspaceRow()
      if (snapshot) {
        const snapshotJson = JSON.stringify(snapshot)
        if (snapshotJson !== globalSubState.lastData) {
          globalSubState.lastData = snapshotJson
          notifyAllCallbacks({ new: snapshot, old: null, eventType: 'POLL_UPDATE' })
        }
      }
    } catch (err) {
      console.warn('[DataSync] poll fetch failed:', err?.message)
    }
  }

  doPoll()
  globalSubState.pollTimer = setInterval(doPoll, pollInterval)
}

function setupGlobalRealtime(pollInterval = 10000) {
  if (!supabase || globalSubState.isConnecting || globalSubState.channel) {
    return
  }

  globalSubState.isConnecting = true

  try {
    const channel = supabase
      .channel(`workspace:${WORKSPACE_ID}:${Date.now()}`, {
        config: {
          broadcast: { self: false },
          presence: { key: '' }
        }
      })
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: WORKSPACE_SCHEMA,
          table: WORKSPACE_TABLE,
          filter: `id=eq.${WORKSPACE_ID}`
        },
        (payload) => {
          notifyAllCallbacks(payload)
        }
      )

    // Mark that we're about to subscribe
    globalSubState.channelSubscribed = false
    
    // Track if we've already logged fallback (prevent spam)
    let fallbackLogged = false
    let successLogged = false
    
    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (!globalSubState.isSubscribed && !fallbackLogged) {
          console.warn('[DataSync] realtime unavailable, using polling fallback:', err?.message || status)
          console.info(`[DataSync] Auto-polling every ${pollInterval / 1000}s - data will sync automatically`)
          fallbackLogged = true
          startGlobalPolling(pollInterval)
        }
      } else if (status === 'SUBSCRIBED') {
        globalSubState.isSubscribed = true
        globalSubState.channelSubscribed = true
        stopGlobalPolling()
        if (!successLogged) {
          console.info('[DataSync] realtime connected successfully, polling stopped')
          successLogged = true
        }
      }
      globalSubState.isConnecting = false
    })

    globalSubState.channel = channel
  } catch (err) {
    console.error('[DataSync] Failed to setup realtime:', err)
    globalSubState.isConnecting = false
    // Fallback to polling
    startGlobalPolling(pollInterval)
  }
}

// === PUBLIC API ===

export async function fetchWorkspaceSnapshot() {
  if (!supabase) {
    console.error('[DataSync] Supabase client not available')
    return null
  }
  try {
    const snapshot = await readWorkspaceRow()
    if (!snapshot?.tenantRegistry || !snapshot?.store) {
      console.error('[DataSync] Snapshot missing tenantRegistry or store:', snapshot)
      return null
    }
    return snapshot
  } catch (err) {
    console.error('[DataSync] fetch snapshot failed:', err?.message || err, err)
    return null
  }
}

export function subscribeWorkspaceChanges(onChange, options = {}) {
  if (!isSupabaseEnabled || !supabase || typeof onChange !== 'function') {
    return () => {}
  }

  const { pollInterval = 10000 } = options

  globalSubState.callbacks.add(onChange)

  if (!globalSubState.channel && !globalSubState.isSubscribed && !globalSubState.isPolling) {
    setupGlobalRealtime(pollInterval)
  }

  return () => {
    globalSubState.callbacks.delete(onChange)

    if (globalSubState.callbacks.size === 0) {
      stopGlobalPolling()
      const channelToRemove = globalSubState.channel
      globalSubState.channel = null
      globalSubState.isSubscribed = false
      globalSubState.isConnecting = false

      if (channelToRemove) {
        setTimeout(() => {
          try {
            supabase.removeChannel(channelToRemove).catch(() => {})
          } catch {
            // Channel removal error - ignore
          }
        }, 500)
      }
    }
  }
}

export function syncTenantUpsert(tenant) {
  const nextTenant = {
    ...(tenant || {}),
    id: tenant?.id || tenant?.tenant_id || DEFAULT_TENANT_ID
  }
  if (!nextTenant?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    snapshot.tenantRegistry.tenants[nextTenant.id] = {
      ...(snapshot.tenantRegistry.tenants[nextTenant.id] || {}),
      ...nextTenant
    }
    if (!snapshot.tenantRegistry.activeTenantId) {
      snapshot.tenantRegistry.activeTenantId = nextTenant.id
    }
    ensureTenantStoreBucket(snapshot, nextTenant.id)
  }).catch((err) => {
    console.error('[DataSync] tenant upsert failed:', err?.message || err)
    return false
  })
}

export function syncTenantDelete(tenantId) {
  const scopedTenantId = String(tenantId || '').trim()
  if (!scopedTenantId) return Promise.resolve(false)
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    ensureStore(snapshot)
    delete snapshot.tenantRegistry.tenants[scopedTenantId]
    delete snapshot.store.tenants[scopedTenantId]
    if (snapshot.tenantRegistry.activeTenantId === scopedTenantId) {
      snapshot.tenantRegistry.activeTenantId = Object.keys(snapshot.tenantRegistry.tenants)[0] || ''
    }
  }).catch((err) => {
    console.error('[DataSync] tenant delete failed:', err?.message || err)
    return false
  })
}

export function syncTenantUserUpsert(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.user?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    const tenant = snapshot.tenantRegistry.tenants[scoped.tenantId] || { id: scoped.tenantId }
    const users = asArray(tenant.users)
    const idx = users.findIndex((item) => item?.id === scoped.user.id)
    if (idx >= 0) users[idx] = { ...users[idx], ...scoped.user }
    else users.push(scoped.user)
    tenant.users = users
    snapshot.tenantRegistry.tenants[scoped.tenantId] = tenant
  }).catch((err) => {
    console.error('[DataSync] tenant user upsert failed:', err?.message || err)
    return false
  })
}

export function syncTenantUserDelete(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.userId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    const tenant = snapshot.tenantRegistry.tenants[scoped.tenantId]
    if (!tenant) return
    tenant.users = asArray(tenant.users).filter((item) => String(item?.id || '') !== String(scoped.userId))
    snapshot.tenantRegistry.tenants[scoped.tenantId] = tenant
  }).catch((err) => {
    console.error('[DataSync] tenant user delete failed:', err?.message || err)
    return false
  })
}

export function syncParticipantUpsert(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId || !scoped?.participant?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, scoped.tenantId, scoped.eventId)
    const participants = asArray(event.participants)
    const idx = participants.findIndex((item) => item?.id === scoped.participant.id)
    if (idx >= 0) participants[idx] = { ...participants[idx], ...scoped.participant }
    else participants.push(scoped.participant)
    event.participants = participants
    if (event.deletedParticipantIds && event.deletedParticipantIds[scoped.participant.id]) {
      delete event.deletedParticipantIds[scoped.participant.id]
    }
  }).catch((err) => {
    console.error('[DataSync] participant upsert failed:', err?.message || err)
    return false
  })
}

export function syncParticipantDelete(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId || !scoped?.participantId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, scoped.tenantId, scoped.eventId)
    event.participants = asArray(event.participants).filter((item) => item?.id !== scoped.participantId)
    if (!event.deletedParticipantIds || typeof event.deletedParticipantIds !== 'object') {
      event.deletedParticipantIds = {}
    }
    event.deletedParticipantIds[scoped.participantId] = new Date().toISOString()
  }).catch((err) => {
    console.error('[DataSync] participant delete failed:', err?.message || err)
    return false
  })
}

export function syncCheckInLog(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId || !scoped?.log?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, scoped.tenantId, scoped.eventId)
    const logs = asArray(event.checkInLogs)
    const idx = logs.findIndex((item) => item?.id === scoped.log.id)
    if (idx >= 0) logs[idx] = { ...logs[idx], ...scoped.log }
    else logs.push(scoped.log)
    event.checkInLogs = logs
  }).catch((err) => {
    console.error('[DataSync] checkin log sync failed:', err?.message || err)
    return false
  })
}

export function syncResetCheckInLogs(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, scoped.tenantId, scoped.eventId)
    event.checkInLogs = []
  }).catch((err) => {
    console.error('[DataSync] reset checkin logs failed:', err?.message || err)
    return false
  })
}

export function syncResetAdminLogs(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, scoped.tenantId, scoped.eventId)
    event.adminLogs = []
  }).catch((err) => {
    console.error('[DataSync] reset admin logs failed:', err?.message || err)
    return false
  })
}

export function syncAuditLog(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId || !scoped?.log?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, scoped.tenantId, scoped.eventId)
    const logs = asArray(event.adminLogs)
    const idx = logs.findIndex((item) => item?.id === scoped.log.id)
    if (idx >= 0) logs[idx] = { ...logs[idx], ...scoped.log }
    else logs.push(scoped.log)
    event.adminLogs = logs
  }).catch((err) => {
    console.error('[DataSync] audit log sync failed:', err?.message || err)
    return false
  })
}

export function syncCurrentDay(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId || typeof scoped?.day !== 'number') return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, scoped.tenantId, scoped.eventId)
    event.currentDay = scoped.day
  }).catch((err) => {
    console.error('[DataSync] current day sync failed:', err?.message || err)
    return false
  })
}

export function syncEventSnapshot(payload) {
  const scoped = scopeTenantPayload(payload)
  console.log('[syncEventSnapshot] Received:', { tenantId: scoped?.tenantId, eventId: scoped?.event?.id, waTemplate: scoped?.event?.waTemplate?.substring(0, 50) });
  if (!scoped?.tenantId || !scoped?.event?.id) {
    console.error('[syncEventSnapshot] Missing tenantId or eventId');
    return noopPromise()
  }
  return mutateWorkspace((snapshot) => {
    const bucket = ensureTenantStoreBucket(snapshot, scoped.tenantId)
    const current = ensureEvent(snapshot, scoped.tenantId, scoped.event.id)
    console.log('[syncEventSnapshot] Current event waTemplate:', current?.waTemplate?.substring(0, 50));
    const participantsNext = Array.isArray(scoped.event?.participants)
      ? (cloneJson(scoped.event.participants) ?? asArray(current.participants))
      : asArray(current.participants)
    const checkInLogsNext = Array.isArray(scoped.event?.checkInLogs)
      ? (cloneJson(scoped.event.checkInLogs) ?? asArray(current.checkInLogs))
      : asArray(current.checkInLogs)
    const adminLogsNext = Array.isArray(scoped.event?.adminLogs)
      ? (cloneJson(scoped.event.adminLogs) ?? asArray(current.adminLogs))
      : asArray(current.adminLogs)
    bucket.events[scoped.event.id] = {
      ...current,
      id: scoped.event.id,
      name: scoped.event.name,
      currentDay: scoped.event.currentDay,
      isArchived: !!scoped.event.isArchived,
      participants: participantsNext,
      checkInLogs: checkInLogsNext,
      adminLogs: adminLogsNext,
      deletedParticipantIds: (scoped.event?.deletedParticipantIds && typeof scoped.event.deletedParticipantIds === 'object')
        ? scoped.event.deletedParticipantIds
        : (current.deletedParticipantIds || {}),
      waTemplate: typeof scoped.event?.waTemplate === 'string' ? scoped.event.waTemplate : (current?.waTemplate || ''),
      waSendMode: String(scoped.event?.waSendMode || '').trim() || 'message_with_barcode',
      offlineConfig: {
        maxPendingAttempts: Number.isInteger(scoped.event?.offlineConfig?.maxPendingAttempts) && scoped.event.offlineConfig.maxPendingAttempts >= 1
          ? scoped.event.offlineConfig.maxPendingAttempts
          : (current?.offlineConfig?.maxPendingAttempts || 5)
      },
      pendingCheckIns: Array.isArray(scoped.event?.pendingCheckIns) ? scoped.event.pendingCheckIns : (current?.pendingCheckIns || []),
      offlineQueueHistory: Array.isArray(scoped.event?.offlineQueueHistory) ? scoped.event.offlineQueueHistory : (current?.offlineQueueHistory || []),
      updated_at: new Date().toISOString()
    }
    console.log('[syncEventSnapshot] Saved waTemplate:', bucket.events[scoped.event.id].waTemplate?.substring(0, 50));
    if (!bucket.activeEventId) bucket.activeEventId = scoped.event.id
  }).catch((err) => {
    console.error('[DataSync] event snapshot sync failed:', err?.message || err)
    return false
  })
}

export function syncEventDelete(payload) {
  const scoped = scopeTenantPayload(payload)
  if (!scoped?.tenantId || !scoped?.eventId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const bucket = ensureTenantStoreBucket(snapshot, scoped.tenantId)
    delete bucket.events[scoped.eventId]
    if (bucket.activeEventId === scoped.eventId) {
      bucket.activeEventId = Object.keys(bucket.events)[0] || null
    }
  }).catch((err) => {
    console.error('[DataSync] event delete failed:', err?.message || err)
    return false
  })
}

// Backward compatibility alias
export const fetchFirebaseWorkspaceSnapshot = fetchWorkspaceSnapshot

