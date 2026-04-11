import { isSupabaseEnabled, supabase } from './supabase.js'

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
      offlineConfig: { maxPendingAttempts: 5 }
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

export async function fetchFirebaseWorkspaceSnapshot() {
  if (!supabase) {
    console.error('[SupabaseSync] Supabase client not available')
    return null
  }
  try {
    const snapshot = await readWorkspaceRow()
    if (!snapshot?.tenantRegistry || !snapshot?.store) {
      console.error('[SupabaseSync] Snapshot missing tenantRegistry or store:', snapshot)
      return null
    }
    return snapshot
  } catch (err) {
    console.error('[SupabaseSync] fetch snapshot failed:', err?.message || err, err)
    return null
  }
}

function notifyAllCallbacks(payload) {
  globalSubState.callbacks.forEach((cb) => {
    try {
      cb(payload)
    } catch (err) {
      console.error('[SupabaseSync] callback error:', err?.message)
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
      console.warn('[SupabaseSync] poll fetch failed:', err?.message)
    }
  }

  doPoll()
  globalSubState.pollTimer = setInterval(doPoll, pollInterval)
}

function setupGlobalRealtime(pollInterval) {
  // Prevent race condition - if already connecting or connected, skip
  if (globalSubState.channel || globalSubState.isConnecting) return

  globalSubState.isConnecting = true

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

  channel.subscribe((status, err) => {
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      if (!globalSubState.isSubscribed) {
        console.warn('[SupabaseSync] realtime unavailable, using polling fallback:', err?.message || status)
        console.info(`[SupabaseSync] Auto-polling every ${pollInterval / 1000}s - data will sync automatically`)
        startGlobalPolling(pollInterval)
      }
    } else if (status === 'SUBSCRIBED') {
      globalSubState.isSubscribed = true
      stopGlobalPolling()
      console.info('[SupabaseSync] realtime connected successfully, polling stopped')
    }
    globalSubState.isConnecting = false
  })

  globalSubState.channel = channel
}

export function subscribeWorkspaceChanges(onChange, options = {}) {
  if (!isSupabaseEnabled || !supabase || typeof onChange !== 'function') {
    return () => {}
  }

  const { pollInterval = 10000 } = options

  // Add callback to global set
  globalSubState.callbacks.add(onChange)

  // Setup shared subscription if not already done
  if (!globalSubState.channel && !globalSubState.isSubscribed && !globalSubState.isPolling) {
    setupGlobalRealtime(pollInterval)
  }

  // Return unsubscribe function
  return () => {
    globalSubState.callbacks.delete(onChange)

    // Cleanup if no more callbacks
    if (globalSubState.callbacks.size === 0) {
      stopGlobalPolling()
      const channelToRemove = globalSubState.channel
      globalSubState.channel = null
      globalSubState.isSubscribed = false
      globalSubState.isConnecting = false

      // Delay cleanup to avoid "WebSocket closed before connection" warning
      // This only happens in React StrictMode (dev) when component unmounts quickly
      if (channelToRemove) {
        setTimeout(() => {
          try {
            supabase.removeChannel(channelToRemove).catch(() => {
              // Ignore removal errors - channel may already be closed
            })
          } catch {
            // no-op
          }
        }, 500)
      }
    }
  }
}

export function syncTenantUpsert(tenant) {
  if (!tenant?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    snapshot.tenantRegistry.tenants[tenant.id] = {
      ...(snapshot.tenantRegistry.tenants[tenant.id] || {}),
      ...tenant
    }
    if (!snapshot.tenantRegistry.activeTenantId) {
      snapshot.tenantRegistry.activeTenantId = tenant.id
    }
    ensureTenantStoreBucket(snapshot, tenant.id)
  }).catch((err) => {
    console.error('[SupabaseSync] tenant upsert failed:', err?.message || err)
    return false
  })
}

export function syncTenantDelete(tenantId) {
  if (!tenantId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    ensureStore(snapshot)
    delete snapshot.tenantRegistry.tenants[tenantId]
    delete snapshot.store.tenants[tenantId]
    if (snapshot.tenantRegistry.activeTenantId === tenantId) {
      snapshot.tenantRegistry.activeTenantId = Object.keys(snapshot.tenantRegistry.tenants)[0] || ''
    }
  }).catch((err) => {
    console.error('[SupabaseSync] tenant delete failed:', err?.message || err)
    return false
  })
}

export function syncTenantUserUpsert({ tenantId, user }) {
  if (!tenantId || !user?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    const tenant = snapshot.tenantRegistry.tenants[tenantId] || { id: tenantId }
    const users = asArray(tenant.users)
    const idx = users.findIndex((item) => item?.id === user.id)
    if (idx >= 0) users[idx] = { ...users[idx], ...user }
    else users.push(user)
    tenant.users = users
    snapshot.tenantRegistry.tenants[tenantId] = tenant
  }).catch((err) => {
        console.error('[SupabaseSync] tenant user upsert failed:', err?.message || err)
    return false
  })
}

export function syncTenantUserDelete({ tenantId, userId }) {
  if (!tenantId || !userId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    ensureTenantRegistry(snapshot)
    const tenant = snapshot.tenantRegistry.tenants[tenantId]
    if (!tenant) return
    tenant.users = asArray(tenant.users).filter((item) => String(item?.id || '') !== String(userId))
    snapshot.tenantRegistry.tenants[tenantId] = tenant
  }).catch((err) => {
        console.error('[SupabaseSync] tenant user delete failed:', err?.message || err)
    return false
  })
}

export function syncParticipantUpsert({ tenantId, eventId, participant }) {
  if (!tenantId || !eventId || !participant?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, tenantId, eventId)
    const participants = asArray(event.participants)
    const idx = participants.findIndex((item) => item?.id === participant.id)
    if (idx >= 0) participants[idx] = { ...participants[idx], ...participant }
    else participants.push(participant)
    event.participants = participants
    if (event.deletedParticipantIds && event.deletedParticipantIds[participant.id]) {
      delete event.deletedParticipantIds[participant.id]
    }
  }).catch((err) => {
        console.error('[SupabaseSync] participant upsert failed:', err?.message || err)
    return false
  })
}

export function syncParticipantDelete({ tenantId, eventId, participantId }) {
  if (!tenantId || !eventId || !participantId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, tenantId, eventId)
    event.participants = asArray(event.participants).filter((item) => item?.id !== participantId)
    if (!event.deletedParticipantIds || typeof event.deletedParticipantIds !== 'object') {
      event.deletedParticipantIds = {}
    }
    event.deletedParticipantIds[participantId] = new Date().toISOString()
  }).catch((err) => {
        console.error('[SupabaseSync] participant delete failed:', err?.message || err)
    return false
  })
}

export function syncCheckInLog({ tenantId, eventId, log }) {
  if (!tenantId || !eventId || !log?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, tenantId, eventId)
    const logs = asArray(event.checkInLogs)
    const idx = logs.findIndex((item) => item?.id === log.id)
    if (idx >= 0) logs[idx] = { ...logs[idx], ...log }
    else logs.push(log)
    event.checkInLogs = logs
  }).catch((err) => {
        console.error('[SupabaseSync] checkin log sync failed:', err?.message || err)
    return false
  })
}

export function syncResetCheckInLogs({ tenantId, eventId }) {
  if (!tenantId || !eventId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, tenantId, eventId)
    event.checkInLogs = []
  }).catch((err) => {
        console.error('[SupabaseSync] reset checkin logs failed:', err?.message || err)
    return false
  })
}

export function syncResetAdminLogs({ tenantId, eventId }) {
  if (!tenantId || !eventId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, tenantId, eventId)
    event.adminLogs = []
  }).catch((err) => {
        console.error('[SupabaseSync] reset admin logs failed:', err?.message || err)
    return false
  })
}

export function syncAuditLog({ tenantId, eventId, log }) {
  if (!tenantId || !eventId || !log?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const event = ensureEvent(snapshot, tenantId, eventId)
    const logs = asArray(event.adminLogs)
    const idx = logs.findIndex((item) => item?.id === log.id)
    if (idx >= 0) logs[idx] = { ...logs[idx], ...log }
    else logs.push(log)
    event.adminLogs = logs
  }).catch((err) => {
        console.error('[SupabaseSync] audit log sync failed:', err?.message || err)
    return false
  })
}

export function syncEventSnapshot({ tenantId, event }) {
  if (!tenantId || !event?.id) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const bucket = ensureTenantStoreBucket(snapshot, tenantId)
    const current = ensureEvent(snapshot, tenantId, event.id)
    const participantsNext = Array.isArray(event?.participants)
      ? (cloneJson(event.participants) ?? asArray(current.participants))
      : asArray(current.participants)
    const checkInLogsNext = Array.isArray(event?.checkInLogs)
      ? (cloneJson(event.checkInLogs) ?? asArray(current.checkInLogs))
      : asArray(current.checkInLogs)
    const adminLogsNext = Array.isArray(event?.adminLogs)
      ? (cloneJson(event.adminLogs) ?? asArray(current.adminLogs))
      : asArray(current.adminLogs)
    bucket.events[event.id] = {
      ...current,
      id: event.id,
      name: event.name,
      currentDay: event.currentDay,
      isArchived: !!event.isArchived,
      participants: participantsNext,
      checkInLogs: checkInLogsNext,
      adminLogs: adminLogsNext,
      deletedParticipantIds: (event?.deletedParticipantIds && typeof event.deletedParticipantIds === 'object')
        ? event.deletedParticipantIds
        : (current.deletedParticipantIds || {}),
      waTemplate: String(event?.waTemplate || '').trim() || null,
      waSendMode: String(event?.waSendMode || '').trim() || 'message_with_barcode',
      offlineConfig: {
        maxPendingAttempts: Number.isInteger(event?.offlineConfig?.maxPendingAttempts) && event.offlineConfig.maxPendingAttempts >= 1
          ? event.offlineConfig.maxPendingAttempts
          : (current?.offlineConfig?.maxPendingAttempts || 5)
      },
      pendingCheckIns: Array.isArray(event?.pendingCheckIns) ? event.pendingCheckIns : (current?.pendingCheckIns || []),
      offlineQueueHistory: Array.isArray(event?.offlineQueueHistory) ? event.offlineQueueHistory : (current?.offlineQueueHistory || []),
      updated_at: new Date().toISOString()
    }
    if (!bucket.activeEventId) bucket.activeEventId = event.id
  }).catch((err) => {
        console.error('[SupabaseSync] event snapshot sync failed:', err?.message || err)
    return false
  })
}

export function syncEventDelete({ tenantId, eventId }) {
  if (!tenantId || !eventId) return noopPromise()
  return mutateWorkspace((snapshot) => {
    const bucket = ensureTenantStoreBucket(snapshot, tenantId)
    delete bucket.events[eventId]
    if (bucket.activeEventId === eventId) {
      bucket.activeEventId = Object.keys(bucket.events)[0] || null
    }
  }).catch((err) => {
        console.error('[SupabaseSync] event delete failed:', err?.message || err)
    return false
  })
}

