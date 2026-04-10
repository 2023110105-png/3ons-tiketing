// Mock data store - simulates Supabase backend
// Replace with real Supabase client when ready

import { apiFetch, platformFetch } from '../utils/api.js'
import { onAuthStateChanged } from 'firebase/auth'
import {
  syncAuditLog,
  fetchFirebaseWorkspaceSnapshot,
  subscribeWorkspaceChanges,
  syncCheckInLog,
  syncResetCheckInLogs,
  syncResetAdminLogs,
  syncEventDelete,
  syncEventSnapshot,
  syncParticipantDelete,
  syncParticipantUpsert,
  syncTenantDelete,
  syncTenantUserDelete,
  syncTenantUserUpsert,
  syncTenantUpsert,
  isWorkspaceSyncEnabled
} from '../lib/dataSync.js'
import { auth, isFirebaseEnabled } from '../lib/firebase.js'

const generateId = () => crypto.randomUUID()
const MIN_HIGH_IMPACT_REASON_LENGTH = 15
const DEFAULT_MAX_PENDING_ATTEMPTS = 5
const DEFAULT_EVENT_ID = 'event-1'
const STORE_KEY = 'ons_event_data'
const LEGACY_STORE_KEY = 'event_data'
const STORE_BACKUP_PREFIX = 'ons_event_data_backup_'
const MAX_STORE_BACKUPS = 3
const WA_TEMPLATE_KEY = 'ons_wa_template'
const LEGACY_WA_TEMPLATE_KEY = 'event_wa_template'
const WA_SEND_MODE_KEY = 'ons_wa_send_mode'
const LEGACY_WA_SEND_MODE_KEY = 'event_wa_send_mode'
const SESSION_KEY = 'ons_session'
const LEGACY_SESSION_KEY = 'event_session'
const TENANT_REGISTRY_KEY = 'ons_tenant_registry'
const LEGACY_TENANT_REGISTRY_KEY = 'event_tenant_registry'
const OWNER_AUDIT_LOG_KEY = 'ons_owner_audit_log'
const OWNER_NOTIFICATIONS_KEY = 'ons_owner_notifications'
const DELETED_PARTICIPANT_TOMBSTONES_KEY = 'ons_deleted_participant_tombstones'
const WA_SEND_MODE_MESSAGE_WITH_BARCODE = 'message_with_barcode'
const WA_SEND_MODE_MESSAGE_ONLY = 'message_only'
const DEFAULT_WA_SEND_MODE = WA_SEND_MODE_MESSAGE_WITH_BARCODE
const FIREBASE_DATA_MODE = (((import.meta.env && import.meta.env.VITE_FIREBASE_DATA_MODE) || process.env.VITE_FIREBASE_DATA_MODE) === 'hybrid') ? 'hybrid' : 'strict'
const IS_FIREBASE_STRICT_DATA_MODE = isFirebaseEnabled && FIREBASE_DATA_MODE === 'strict'
const FIREBASE_AUTH_MODE = (((import.meta.env && import.meta.env.VITE_FIREBASE_AUTH_MODE) || process.env.VITE_FIREBASE_AUTH_MODE) === 'hybrid') ? 'hybrid' : 'strict'
const DEFAULT_TENANT_ONLY_MODE = true
const TENANT_MODE_PURGED_FLAG_KEY = 'ons_tenant_mode_purged_v2'

function isAllowedStrictStorageKey(key) {
  return key === SESSION_KEY
    || key === LEGACY_SESSION_KEY
    || key === TENANT_REGISTRY_KEY
    || key === LEGACY_TENANT_REGISTRY_KEY
    || key === STORE_KEY
    || key === LEGACY_STORE_KEY
    // Tombstone perlu disimpan juga di strict mode supaya peserta yang dihapus
    // tidak muncul kembali setelah reload/hydrate.
    || key === DELETED_PARTICIPANT_TOMBSTONES_KEY
    // Owner utilities (audit trail + notifications) must remain usable
    // even when strict data mode blocks most localStorage keys.
    || key === OWNER_AUDIT_LOG_KEY
    || key === OWNER_NOTIFICATIONS_KEY
}

async function ensureFirebaseAuthSessionReady() {
  if (!isFirebaseEnabled || !auth) return null
  if (auth.currentUser) return auth.currentUser

  if (typeof auth.authStateReady === 'function') {
    try {
      await auth.authStateReady()
    } catch {
      // Continue with fallback subscriber below.
    }
    if (auth.currentUser) return auth.currentUser
  }

  await new Promise((resolve) => {
    let settled = false
    let unsubscribe = () => {}

    const finish = () => {
      if (settled) return
      settled = true
      unsubscribe()
      resolve()
    }

    const timeoutId = setTimeout(finish, 1500)
    unsubscribe = onAuthStateChanged(
      auth,
      () => {
        clearTimeout(timeoutId)
        finish()
      },
      () => {
        clearTimeout(timeoutId)
        finish()
      }
    )
  })

  return auth.currentUser || null
}

const DEFAULT_TENANT_ID = 'tenant-default'
const DEFAULT_TENANT = {
  id: DEFAULT_TENANT_ID,
  brandName: 'Event Platform',
  eventName: 'Event Platform',
  status: 'active',
  expires_at: null,
  created_at: new Date().toISOString(),
  activeEventId: DEFAULT_EVENT_ID,
  contract: {
    package: 'pro',
    start_at: new Date().toISOString(),
    payment_status: 'paid',
    amount: 0
  },
  quota: {
    maxParticipants: 5000,
    maxGateDevices: 10,
    maxActiveEvents: 5
  },
  users: [],
  branding: {
    primaryColor: '#0ea5e9'
  },
  invoices: [],
  deletedEventIds: {}
}

const DEFAULT_TENANT_CANONICAL_USERS = [
  {
    id: 'user-tenant-default-admin',
    username: 'admin',
    email: 'admin@ons.local',
    password: 'admin123',
    name: 'Admin',
    role: 'admin_client',
    tenantId: DEFAULT_TENANT_ID,
    created_at: new Date().toISOString(),
    is_active: true
  },
  {
    id: 'user-tenant-default-gate1',
    username: 'gate1',
    email: 'gate1@ons.local',
    password: 'gate123',
    name: 'Gate 1',
    role: 'gate_front',
    tenantId: DEFAULT_TENANT_ID,
    created_at: new Date().toISOString(),
    is_active: true
  },
  {
    id: 'user-tenant-default-gate2',
    username: 'gate2',
    email: 'gate2@ons.local',
    password: 'gate123',
    name: 'Gate 2',
    role: 'gate_back',
    tenantId: DEFAULT_TENANT_ID,
    created_at: new Date().toISOString(),
    is_active: true
  }
]

const ALLOWED_DEFAULT_USERNAMES = new Set(DEFAULT_TENANT_CANONICAL_USERS.map((user) => String(user.username || '').trim().toLowerCase()))

function seedDefaultTenantUsers(tenant) {
  if (!tenant || tenant.id !== DEFAULT_TENANT_ID) return tenant

  // Hard enforcement: tenant-default keeps only canonical users (admin, gate1, gate2).
  return {
    ...tenant,
    users: DEFAULT_TENANT_CANONICAL_USERS.map((user) => ({ ...user }))
  }
}

function purgeTenantScopedUIState() {
  safeStorageRemove('ons_owner_users_selected_tenant')
  safeStorageRemove('ons_owner_contract_selected_tenant')
}

const categories = ['Regular', 'VIP', 'Dealer', 'Media']

function safeStorageGet(key) {
  if (IS_FIREBASE_STRICT_DATA_MODE && !isAllowedStrictStorageKey(key)) return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key, value) {
  if (IS_FIREBASE_STRICT_DATA_MODE && !isAllowedStrictStorageKey(key)) return false
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function readDeletedParticipantTombstones() {
  const raw = safeStorageGet(DELETED_PARTICIPANT_TOMBSTONES_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function saveDeletedParticipantTombstones(mapObj) {
  safeStorageSet(DELETED_PARTICIPANT_TOMBSTONES_KEY, JSON.stringify(mapObj || {}))
}

let deletedParticipantTombstones = readDeletedParticipantTombstones()

function cleanupDeletedParticipantTombstones() {
  let changed = false
  Object.keys(deletedParticipantTombstones).forEach((id) => {
    if (!id) {
      delete deletedParticipantTombstones[id]
      changed = true
      return
    }
    const t = Number(deletedParticipantTombstones[id] || 0)
    if (!Number.isFinite(t) || t <= 0) {
      deletedParticipantTombstones[id] = Date.now()
      changed = true
    }
  })
  if (changed) saveDeletedParticipantTombstones(deletedParticipantTombstones)
}

function markParticipantDeleted(participantId) {
  if (!participantId) return
  cleanupDeletedParticipantTombstones()
  deletedParticipantTombstones[participantId] = Date.now()
  saveDeletedParticipantTombstones(deletedParticipantTombstones)
}

function clearDeletedParticipantMark(participantId) {
  if (!participantId) return
  if (deletedParticipantTombstones[participantId]) {
    delete deletedParticipantTombstones[participantId]
    saveDeletedParticipantTombstones(deletedParticipantTombstones)
  }
}

function isParticipantTicketLocked(participant) {
  return !!participant?.qr_locked || !!participant?.wa_sent_at
}

function getActiveParticipantsFromEvent(ev, dayFilter = null) {
  cleanupDeletedParticipantTombstones()
  const tombstones = deletedParticipantTombstones
  const hasDeletedMarks = Object.keys(tombstones).length > 0
  const all = Array.isArray(ev?.participants) ? ev.participants : []
  const eventDeletedMap = (ev?.deletedParticipantIds && typeof ev.deletedParticipantIds === 'object')
    ? ev.deletedParticipantIds
    : {}
  const targetDay = dayFilter == null ? null : Number(dayFilter)
  const activeTenant = getActiveTenantState()
  const activeTenantId = String(activeTenant?.id || '').trim()
  const activeTicketPrefix = getTenantTicketPrefix(activeTenant)

  const belongsToActiveTenant = (participant) => {
    if (!activeTenantId) return true
    const explicitTenantId = String(participant?.tenant_id || participant?.tenantId || '').trim()
    if (explicitTenantId) return explicitTenantId === activeTenantId
    const rawQr = String(participant?.qr_data || '').trim()
    if (!rawQr) return true
    try {
      const parsedQr = JSON.parse(rawQr)
      const qrTenantId = String(parsedQr?.t || '').trim()
      if (qrTenantId) return qrTenantId === activeTenantId
      // Legacy QR JSON payloads (v1/v2) may not carry tenant marker.
      // Keep them visible within current event scope.
      return true
    } catch {
      // fall through to ticket prefix fallback
    }

    // Legacy fallback: participants without tenant markers must match ticket prefix
    // of the active tenant to avoid cross-tenant leaks from stale caches.
    const ticketId = String(participant?.ticket_id || '').trim().toUpperCase()
    const prefix = String(activeTicketPrefix || '').trim().toUpperCase()
    if (!ticketId || !prefix) return false
    return ticketId.startsWith(`${prefix}-`)
  }

  // Fast path: no day filter and no deleted marks.
  if (targetDay == null && !hasDeletedMarks) {
    return all.filter(belongsToActiveTenant)
  }

  const result = []
  for (const participant of all) {
    if (targetDay != null && Number(participant?.day_number) !== targetDay) continue
    if (participant?.id && tombstones[participant.id]) continue
    if (participant?.id && eventDeletedMap[participant.id]) continue
    if (!belongsToActiveTenant(participant)) continue
    result.push(participant)
  }
  return result
}

function safeStorageRemove(key) {
  if (IS_FIREBASE_STRICT_DATA_MODE && !isAllowedStrictStorageKey(key)) return
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

function parseStoredJSON(raw) {
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function isTenantExpired(tenant) {
  if (!tenant?.expires_at) return false
  const expiredAt = new Date(tenant.expires_at).getTime()
  if (!Number.isFinite(expiredAt)) return false
  return expiredAt < Date.now()
}

function normalizeSavedTenant(id, raw) {
  return seedDefaultTenantUsers({
    id,
    brandName: String(raw?.brandName || raw?.name || 'Tenant').trim() || 'Tenant',
    eventName: String(raw?.eventName || 'Event Platform').trim() || 'Event Platform',
    status: raw?.status === 'inactive' ? 'inactive' : 'active',
    expires_at: raw?.expires_at || null,
    created_at: raw?.created_at || new Date().toISOString(),
    activeEventId: raw?.activeEventId || null,
    contract: raw?.contract || { package: 'starter', payment_status: 'unpaid' },
    quota: raw?.quota || { maxParticipants: 500, maxGateDevices: 3, maxActiveEvents: 1 },
    users: asArray(raw?.users),
    branding: raw?.branding || { primaryColor: '#0ea5e9' },
    invoices: asArray(raw?.invoices),
    deletedEventIds: (raw?.deletedEventIds && typeof raw.deletedEventIds === 'object')
      ? { ...raw.deletedEventIds }
      : {}
  })
}

function createDefaultTenantRegistry() {
  return {
    activeTenantId: DEFAULT_TENANT_ID,
    tenants: {
      [DEFAULT_TENANT_ID]: seedDefaultTenantUsers({ ...DEFAULT_TENANT })
    }
  }
}

function enforceDefaultTenantOnlyRegistry(input) {
  const currentDefaultTenant = input?.tenants?.[DEFAULT_TENANT_ID]
    ? normalizeSavedTenant(DEFAULT_TENANT_ID, input.tenants[DEFAULT_TENANT_ID])
    : seedDefaultTenantUsers({ ...DEFAULT_TENANT })

  return {
    activeTenantId: DEFAULT_TENANT_ID,
    tenants: {
      [DEFAULT_TENANT_ID]: currentDefaultTenant
    }
  }
}

function getTenantRegistry() {
  const raw = safeStorageGet(TENANT_REGISTRY_KEY) || safeStorageGet(LEGACY_TENANT_REGISTRY_KEY)
  const parsed = parseStoredJSON(raw)

  if (parsed?.tenants && typeof parsed.tenants === 'object') {
    const normalizedTenants = {}
    Object.keys(parsed.tenants).forEach(id => {
      normalizedTenants[id] = normalizeSavedTenant(id, parsed.tenants[id])
    })

    if (!normalizedTenants[DEFAULT_TENANT_ID]) {
      normalizedTenants[DEFAULT_TENANT_ID] = seedDefaultTenantUsers({ ...DEFAULT_TENANT })
    } else {
      normalizedTenants[DEFAULT_TENANT_ID] = seedDefaultTenantUsers(normalizedTenants[DEFAULT_TENANT_ID])
    }

    const activeTenantId = normalizedTenants[parsed.activeTenantId] ? parsed.activeTenantId : DEFAULT_TENANT_ID
    const normalizedRegistry = {
      activeTenantId,
      tenants: normalizedTenants
    }
    return DEFAULT_TENANT_ONLY_MODE
      ? enforceDefaultTenantOnlyRegistry(normalizedRegistry)
      : normalizedRegistry
  }

  return DEFAULT_TENANT_ONLY_MODE
    ? enforceDefaultTenantOnlyRegistry(createDefaultTenantRegistry())
    : createDefaultTenantRegistry()
}

let tenantRegistry = getTenantRegistry()

function saveTenantRegistry() {
  if (DEFAULT_TENANT_ONLY_MODE) {
    tenantRegistry = enforceDefaultTenantOnlyRegistry(tenantRegistry)
  }
  safeStorageSet(TENANT_REGISTRY_KEY, JSON.stringify(tenantRegistry))
  safeStorageRemove(LEGACY_TENANT_REGISTRY_KEY)
}

function runOneTimeDefaultTenantPurge() {
  if (!DEFAULT_TENANT_ONLY_MODE) return
  if (safeStorageGet(TENANT_MODE_PURGED_FLAG_KEY) === '1') return

  const rawRegistry = safeStorageGet(TENANT_REGISTRY_KEY) || safeStorageGet(LEGACY_TENANT_REGISTRY_KEY)
  const parsedRegistry = parseStoredJSON(rawRegistry)
  if (parsedRegistry?.tenants && typeof parsedRegistry.tenants === 'object') {
    const defaultTenantRaw = parsedRegistry.tenants[DEFAULT_TENANT_ID] || { ...DEFAULT_TENANT }
    const nextRegistry = enforceDefaultTenantOnlyRegistry({
      activeTenantId: DEFAULT_TENANT_ID,
      tenants: {
        [DEFAULT_TENANT_ID]: normalizeSavedTenant(DEFAULT_TENANT_ID, defaultTenantRaw)
      }
    })
    tenantRegistry = nextRegistry
    saveTenantRegistry()
  }

  const rawStore = safeStorageGet(STORE_KEY) || safeStorageGet(LEGACY_STORE_KEY)
  const parsedStore = parseStoredJSON(rawStore)
  if (parsedStore?.tenants && typeof parsedStore.tenants === 'object') {
    const defaultBucket = parsedStore.tenants[DEFAULT_TENANT_ID]
      ? normalizeTenantStoreBucket(parsedStore.tenants[DEFAULT_TENANT_ID], 'Event Platform 2026')
      : createTenantStoreBucket('Event Platform 2026', false)
    Object.values(defaultBucket.events || {}).forEach((event) => {
      event.participants = []
      event.deletedParticipantIds = {}
      event.checkInLogs = []
      event.pendingCheckIns = []
      event.offlineQueueHistory = []
      event.adminLogs = []
      event.currentDay = 1
    })
    store = { tenants: { [DEFAULT_TENANT_ID]: defaultBucket } }
    deletedParticipantTombstones = {}
    saveDeletedParticipantTombstones(deletedParticipantTombstones)
    saveStore()
  }

  purgeTenantScopedUIState()
  safeStorageSet(TENANT_MODE_PURGED_FLAG_KEY, '1')
}

function ensureActiveTenant() {
  if (!tenantRegistry.tenants[tenantRegistry.activeTenantId]) {
    tenantRegistry.activeTenantId = DEFAULT_TENANT_ID
    if (!tenantRegistry.tenants[DEFAULT_TENANT_ID]) {
      tenantRegistry.tenants[DEFAULT_TENANT_ID] = seedDefaultTenantUsers({ ...DEFAULT_TENANT })
    } else {
      tenantRegistry.tenants[DEFAULT_TENANT_ID] = seedDefaultTenantUsers(tenantRegistry.tenants[DEFAULT_TENANT_ID])
    }
    saveTenantRegistry()
  }
}

function readSessionSnapshot() {
  const active = safeStorageGet(SESSION_KEY)
  const parsedActive = parseStoredJSON(active)
  if (parsedActive) return parsedActive

  const legacy = safeStorageGet(LEGACY_SESSION_KEY)
  const parsedLegacy = parseStoredJSON(legacy)
  return parsedLegacy || null
}

function syncActiveTenantWithSession() {
  if (DEFAULT_TENANT_ONLY_MODE) {
    if (tenantRegistry.activeTenantId !== DEFAULT_TENANT_ID) {
      tenantRegistry.activeTenantId = DEFAULT_TENANT_ID
      saveTenantRegistry()
    }
    return
  }

  const session = readSessionSnapshot()
  if (!session) return

  const role = String(session.role || '').toLowerCase()
  const isGlobalRole = role === 'owner' || role === 'super_admin'

  if (isGlobalRole) {
    if (tenantRegistry.tenants[DEFAULT_TENANT_ID] && tenantRegistry.activeTenantId !== DEFAULT_TENANT_ID) {
      tenantRegistry.activeTenantId = DEFAULT_TENANT_ID
      saveTenantRegistry()
    }
    return
  }

  const sessionTenantId = String(session?.tenant?.id || '').trim()
  if (!sessionTenantId) return

  if (!tenantRegistry.tenants[sessionTenantId]) {
    // Build a scoped placeholder to keep tenant users isolated
    // even when Firebase hydrate cannot list all tenants.
    tenantRegistry.tenants[sessionTenantId] = seedDefaultTenantUsers({
      id: sessionTenantId,
      brandName: String(session?.tenant?.brandName || 'Tenant').trim() || 'Tenant',
      eventName: String(session?.tenant?.eventName || 'Event Platform').trim() || 'Event Platform',
      status: 'active',
      expires_at: null,
      created_at: new Date().toISOString(),
      activeEventId: null,
      contract: { package: 'starter', payment_status: 'unpaid' },
      quota: { maxParticipants: 500, maxGateDevices: 3, maxActiveEvents: 1 },
      users: [],
      branding: { primaryColor: '#0ea5e9' },
      invoices: []
    })
  }

  if (tenantRegistry.activeTenantId !== sessionTenantId) {
    tenantRegistry.activeTenantId = sessionTenantId
  }
  saveTenantRegistry()
}

function getActiveTenantState() {
  syncActiveTenantWithSession()
  ensureActiveTenant()
  return tenantRegistry.tenants[tenantRegistry.activeTenantId]
}

function canUseTenant(tenant) {
  if (!tenant) return false
  if (tenant.status !== 'active') return false
  if (isTenantExpired(tenant)) return false
  return true
}

function dispatchTenantChangeEvent() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('ons-tenant-changed'))
}

async function provisionTenantRuntime(tenantId) {
  const id = String(tenantId || '').trim()
  if (!id) return
  try {
    // Passive sync only: avoid creating QR/session before tenant logs in.
    await apiFetch(`/api/wa/status?tenant_id=${encodeURIComponent(id)}`)
  } catch {
    // Keep tenant creation/switch flow non-blocking even if WA runtime is temporarily offline.
  }
}

export function getActiveTenant() {
  return { ...getActiveTenantState() }
}

export function getTenantBranding() {
  const tenant = getActiveTenantState()
  return {
    tenantId: tenant.id,
    brandName: tenant.brandName,
    eventName: tenant.eventName
  }
}

export function getTenants() {
  return Object.values(tenantRegistry.tenants)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(tenant => ({
      ...tenant,
      isExpired: isTenantExpired(tenant),
      isActiveTenant: tenant.id === tenantRegistry.activeTenantId
    }))
}

export function switchActiveTenant(tenantId, actor = 'system') {
  if (DEFAULT_TENANT_ONLY_MODE && tenantId !== DEFAULT_TENANT_ID) {
    return { success: false, error: 'Mode tenant default aktif. Hanya tenant default yang digunakan.' }
  }
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  if (!canUseTenant(tenant)) return { success: false, error: 'Tenant tidak aktif atau sudah expired' }

  ensureTenantStore(tenant.id, tenant.eventName || 'Event 1', false)
  const previous = tenantRegistry.activeTenantId
  tenantRegistry.activeTenantId = tenant.id
  saveStore()
  saveTenantRegistry()
  dispatchTenantChangeEvent()
  void provisionTenantRuntime(tenant.id)

  if (previous !== tenant.id) {
    logAdminAction('tenant_switch', `Pindah tenant aktif ke ${tenant.brandName}`, actor, {
      from: previous,
      to: tenant.id
    })
  }

  return { success: true, tenant: { ...tenant } }
}

export async function createTenant(data, actor = 'system') {
  if (DEFAULT_TENANT_ONLY_MODE) {
    return {
      success: false,
      error: 'Mode tenant default aktif. Pembuatan tenant baru dinonaktifkan.'
    }
  }

  if (FIREBASE_DATA_MODE === 'strict' && !isFirebaseEnabled) {
    return {
      success: false,
      error: 'Proteksi aktif: Firebase belum terhubung. Isi environment VITE_FIREBASE_* di deployment lalu redeploy.'
    }
  }

  const activeFirebaseUser =
    FIREBASE_DATA_MODE === 'strict' && isFirebaseEnabled
      ? await ensureFirebaseAuthSessionReady()
      : null

  if (FIREBASE_DATA_MODE === 'strict' && isFirebaseEnabled && !activeFirebaseUser) {
    return {
      success: false,
      error: 'Sesi Firebase belum aktif. Login ulang dengan akun yang terdaftar di Firebase Authentication.'
    }
  }

  const brandName = String(data?.brandName || '').trim()
  const eventName = String(data?.eventName || '').trim() || 'Event Platform'
  const expiresAt = data?.expiresAt ? new Date(data.expiresAt).toISOString() : null

  if (!brandName) return { success: false, error: 'Nama brand wajib diisi' }

  const tenant = {
    id: generateId(),
    brandName,
    eventName,
    status: 'active',
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
    activeEventId: null,
    contract: { package: 'starter', start_at: new Date().toISOString(), payment_status: 'unpaid', amount: 0 },
    quota: { maxParticipants: 500, maxGateDevices: 3, maxActiveEvents: 1 },
    users: [],
    branding: { primaryColor: '#0ea5e9' },
    invoices: []
  }

  tenantRegistry.tenants[tenant.id] = tenant
  ensureTenantStore(tenant.id, tenant.eventName || 'Event 1', false)
  tenant.activeEventId = store.tenants[tenant.id]?.activeEventId || null
  saveStore()
  saveTenantRegistry()

  const synced = await syncTenantUpsert(tenant)
  if (IS_FIREBASE_STRICT_DATA_MODE && !synced) {
    delete tenantRegistry.tenants[tenant.id]
    if (store?.tenants?.[tenant.id]) {
      delete store.tenants[tenant.id]
    }
    saveStore()
    saveTenantRegistry()
    return {
      success: false,
      error: 'Tenant gagal disimpan ke Firestore. Periksa Authentication/Rules Firebase lalu coba lagi.'
    }
  }

  logAdminAction('tenant_create', `Membuat tenant ${brandName}`, actor, {
    tenant_id: tenant.id
  })

  void provisionTenantRuntime(tenant.id)

  return { success: true, tenant: { ...tenant } }
}

export function setTenantStatus(tenantId, nextStatus, actor = 'system') {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  if (tenant.id === DEFAULT_TENANT_ID && nextStatus === 'inactive') {
    return { success: false, error: 'Tenant default tidak bisa dinonaktifkan' }
  }

  const normalizedStatus = nextStatus === 'inactive' ? 'inactive' : 'active'
  tenant.status = normalizedStatus

  if (tenantRegistry.activeTenantId === tenant.id && !canUseTenant(tenant)) {
    tenantRegistry.activeTenantId = DEFAULT_TENANT_ID
    ensureTenantStore(DEFAULT_TENANT_ID, 'Event Platform 2026', true)
  }

  tenant.activeEventId = store.tenants?.[tenant.id]?.activeEventId || tenant.activeEventId || null

  saveStore()
  saveTenantRegistry()
  dispatchTenantChangeEvent()
  void syncTenantUpsert(tenant)

  logAdminAction('tenant_status_update', `Ubah status tenant ${tenant.brandName} menjadi ${normalizedStatus}`, actor, {
    tenant_id: tenant.id,
    status: normalizedStatus
  })

  logOwnerAction('tenant_status_update', `Ubah status tenant ${tenant.brandName} ke ${normalizedStatus}`, actor, {
    tenant_id: tenant.id,
    status: normalizedStatus
  })

  return { success: true }
}

export function logOwnerAction(action, description, actor = 'system', meta = null) {
  const raw = safeStorageGet(OWNER_AUDIT_LOG_KEY)
  const logs = asArray(parseStoredJSON(raw))
  const newLog = {
    id: generateId(),
    action,
    description,
    actor: normalizeActor(actor),
    meta,
    timestamp: new Date().toISOString()
  }
  logs.unshift(newLog)
  // Keep last 1000 logs
  safeStorageSet(OWNER_AUDIT_LOG_KEY, JSON.stringify(logs.slice(0, 1000)))
  return newLog
}

export function getOwnerAuditLog() {
  const raw = safeStorageGet(OWNER_AUDIT_LOG_KEY)
  return asArray(parseStoredJSON(raw))
}

export function getOwnerNotifications() {
  const raw = safeStorageGet(OWNER_NOTIFICATIONS_KEY)
  const notifs = asArray(parseStoredJSON(raw))
  return notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
}

export function addOwnerNotification(type, tenantId, message) {
  const raw = safeStorageGet(OWNER_NOTIFICATIONS_KEY)
  const notifs = asArray(parseStoredJSON(raw))
  notifs.unshift({
    id: generateId(),
    type,
    tenantId,
    message,
    read: false,
    created_at: new Date().toISOString()
  })
  safeStorageSet(OWNER_NOTIFICATIONS_KEY, JSON.stringify(notifs.slice(0, 100)))
}

export function markNotificationRead(id) {
  const raw = safeStorageGet(OWNER_NOTIFICATIONS_KEY)
  const notifs = asArray(parseStoredJSON(raw))
  const notif = notifs.find(n => n.id === id)
  if (notif) {
    notif.read = true
    safeStorageSet(OWNER_NOTIFICATIONS_KEY, JSON.stringify(notifs))
  }
}

export function getTenantHealth() {
  const tenants = getTenants()
  return tenants.map(t => {
    const bucket = store.tenants[t.id]
    const events = bucket ? Object.values(bucket.events) : []
    const totalParticipants = events.reduce((sum, e) => sum + (e.participants?.length || 0), 0)
    const totalCheckins = events.reduce((sum, e) => sum + (e.checkInLogs?.length || 0), 0)
    
    // Simulate real-time online status
    // A tenant is "active" if there was a check-in or login in last 24h
    const lastActivity = events.reduce((max, e) => {
      const logs = e.checkInLogs || []
      const latest = logs.length > 0 ? new Date(logs[logs.length - 1].timestamp).getTime() : 0
      return Math.max(max, latest)
    }, 0)
    
    const isOnline = lastActivity > (Date.now() - 24 * 60 * 60 * 1000)

    return {
      tenantId: t.id,
      brandName: t.brandName,
      status: t.status,
      isOnline,
      totalEvents: events.length,
      totalParticipants,
      totalCheckins,
      usageParticipants: Math.round((totalParticipants / (t.quota?.maxParticipants || 1)) * 100),
      lastBackup: t.created_at // fallback
    }
  })
}

export function deleteTenant(tenantId, actor = 'system') {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  if (tenant.id === DEFAULT_TENANT_ID) {
    return { success: false, error: 'Tenant default tidak bisa dihapus' }
  }

  delete tenantRegistry.tenants[tenant.id]
  if (store.tenants && store.tenants[tenant.id]) {
    delete store.tenants[tenant.id]
  }
  if (tenantRegistry.activeTenantId === tenant.id) {
    tenantRegistry.activeTenantId = DEFAULT_TENANT_ID
    ensureTenantStore(DEFAULT_TENANT_ID, 'Event Platform 2026', true)
  }

  saveStore()
  saveTenantRegistry()
  dispatchTenantChangeEvent()
  void syncTenantDelete(tenant.id)

  logAdminAction('tenant_delete', `Hapus tenant ${tenant.brandName}`, actor, {
    tenant_id: tenant.id
  })

  logOwnerAction('tenant_delete', `Hapus tenant ${tenant.brandName}`, actor, {
    tenant_id: tenant.id
  })

  return { success: true }
}

export function updateTenantContract(tenantId, contractData, actor = 'system') {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  const prev = tenant.contract
  tenant.contract = { ...prev, ...contractData }
  saveTenantRegistry()
  void syncTenantUpsert(tenant)
  logOwnerAction('tenant_contract_update', `Update kontrak tenant ${tenant.brandName}`, actor, {
    tenant_id: tenantId,
    previous: prev,
    new: tenant.contract
  })
  return { success: true }
}

export function updateTenantQuota(tenantId, quotaData, actor = 'system') {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  const prev = tenant.quota
  tenant.quota = { ...prev, ...quotaData }
  saveTenantRegistry()
  void syncTenantUpsert(tenant)
  logOwnerAction('tenant_quota_update', `Update kuota tenant ${tenant.brandName}`, actor, {
    tenant_id: tenantId,
    previous: prev,
    new: tenant.quota
  })
  return { success: true }
}

export function getTenantUsers(tenantId) {
  const tenant = tenantRegistry.tenants[tenantId]
  return tenant ? asArray(tenant.users) : []
}

function mapFirebaseAuthProvisionError(rawCode = '') {
  const code = String(rawCode || '').toUpperCase()
  if (code.includes('EMAIL_EXISTS')) return 'Email sudah terdaftar di Firebase Authentication'
  if (code.includes('INVALID_EMAIL')) return 'Format email tidak valid untuk Firebase Authentication'
  if (code.includes('WEAK_PASSWORD')) return 'Password terlalu lemah (minimal 6 karakter)'
  if (code.includes('CONFIGURATION_NOT_FOUND')) {
    return 'Firebase Authentication belum dikonfigurasi. Aktifkan Authentication dan Email/Password di Firebase Console'
  }
  if (code.includes('OPERATION_NOT_ALLOWED')) {
    return 'Metode login Email/Password belum diaktifkan di Firebase Authentication'
  }
  if (code.includes('PROJECT_NOT_FOUND')) {
    return 'Project Firebase tidak ditemukan. Periksa PROJECT_ID dan API key di .env'
  }
  if (code.includes('API_KEY_HTTP_REFERRER_BLOCKED') || code.includes('API_KEY_SERVICE_BLOCKED')) {
    return 'API key Firebase diblokir oleh pengaturan restriction. Izinkan Identity Toolkit API'
  }
  if (code.includes('API_KEY_INVALID')) return 'API key Firebase tidak valid'
  return `Gagal membuat akun di Firebase Authentication (${code})`
}

async function provisionFirebaseAuthUser(email, password) {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || '').trim()
  if (!apiKey) {
    return { success: false, error: 'VITE_FIREBASE_API_KEY belum diisi' }
  }

  try {
    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: false
      })
    })

    if (response.ok) {
      return { success: true }
    }

    const data = await response.json().catch(() => ({}))
    const code = data?.error?.message || `HTTP_${response.status}`
    return { success: false, error: mapFirebaseAuthProvisionError(code) }
  } catch {
    return { success: false, error: 'Tidak bisa terhubung ke Firebase Authentication' }
  }
}

export async function createTenantUser(tenantId, userData, actor = 'system') {
  if (FIREBASE_AUTH_MODE === 'strict' && !isFirebaseEnabled) {
    return {
      success: false,
      error: 'Proteksi aktif: Firebase Authentication belum terhubung. Isi environment VITE_FIREBASE_* di deployment lalu redeploy.'
    }
  }

  // Fullstack path: when Firebase is enabled, create user via api-server (Firebase Admin),
  // so enable/disable/reset password/delete also work on real auth accounts.
  let platformSyncUnavailable = false
  if (isFirebaseEnabled) {
    try {
      const res = await platformFetch(`/platform/owner/tenants/${encodeURIComponent(tenantId)}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: userData?.username,
          email: userData?.email,
          password: userData?.password,
          name: userData?.name,
          role: userData?.role
        })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        // Fallback to local registry in dev/offline mode when platform API is unreachable/misconfigured.
        platformSyncUnavailable = true
      } else {
        await bootstrapStoreFromFirebase(true)
        return { success: true, user: data.user }
      }
    } catch {
      platformSyncUnavailable = true
    }
  }

  const activeFirebaseUser =
    FIREBASE_AUTH_MODE === 'strict' && isFirebaseEnabled && !platformSyncUnavailable
      ? await ensureFirebaseAuthSessionReady()
      : null

  if (FIREBASE_AUTH_MODE === 'strict' && isFirebaseEnabled && !platformSyncUnavailable && !activeFirebaseUser) {
    return {
      success: false,
      error: 'Sesi Firebase belum aktif. Login ulang dengan akun yang terdaftar di Firebase Authentication.'
    }
  }

  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  
  const username = String(userData?.username || '').trim().toLowerCase()
  const email = normalizeParticipantEmail(userData?.email)
  if (!username) return { success: false, error: 'Username wajib diisi' }
  
  // Check global uniqueness (simulated)
  const allUsernames = Object.values(USERS).map(u => u.username)
    .concat(Object.values(tenantRegistry.tenants).flatMap(t => asArray(t.users).map(u => u.username)))
  const allEmails = Object.values(USERS).map(u => normalizeParticipantEmail(u.email))
    .concat(Object.values(tenantRegistry.tenants).flatMap(t => asArray(t.users).map(u => normalizeParticipantEmail(u.email))))
  
  if (allUsernames.includes(username)) {
    return { success: false, error: 'Username sudah digunakan' }
  }
  if (email && allEmails.includes(email)) {
    return { success: false, error: 'Email sudah digunakan' }
  }

  const password = String(userData?.password || '123456')
  if (isFirebaseEnabled && FIREBASE_AUTH_MODE === 'strict' && !platformSyncUnavailable) {
    if (!email) {
      return { success: false, error: 'Email wajib diisi pada mode Firebase strict' }
    }

    const authProvision = await provisionFirebaseAuthUser(email, password)
    if (!authProvision.success) {
      return { success: false, error: authProvision.error }
    }
  }

  const newUser = {
    id: generateId(),
    username,
    email,
    password,
    name: userData.name || username,
    role: userData.role || 'gate_front',
    tenantId: tenantId,
    created_at: new Date().toISOString(),
    is_active: true
  }

  tenant.users = asArray(tenant.users)
  tenant.users.push(newUser)
  saveTenantRegistry()
  void syncTenantUserUpsert({ tenantId, user: newUser })
  
  logOwnerAction('tenant_user_create', `Tambah user ${username} ke tenant ${tenant.brandName}`, actor, {
    tenant_id: tenantId,
    user_id: newUser.id,
    role: newUser.role
  })

  return { success: true, user: newUser }
}

export async function updateTenantUser(tenantId, userId, data, actor = 'system') {
  const updateUserLocally = (candidateIds = []) => {
    const tenant = tenantRegistry.tenants[tenantId]
    if (!tenant) return null
    const users = asArray(tenant.users)
    const loweredCandidates = candidateIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean)
    const index = users.findIndex((u) => {
      const values = [
        String(u?.id || '').trim(),
        String(u?.auth_uid || '').trim(),
        String(u?.username || '').trim().toLowerCase(),
        String(u?.email || '').trim().toLowerCase()
      ].filter(Boolean)
      return values.some((v) => loweredCandidates.includes(v.toLowerCase()))
    })
    if (index < 0) return null

    const user = { ...(users[index] || {}) }
    const nextData = { ...(data || {}) }
    if (Object.prototype.hasOwnProperty.call(nextData, 'email')) {
      nextData.email = normalizeParticipantEmail(nextData.email)
    }
    Object.assign(user, nextData)
    users[index] = user
    tenant.users = users
    saveTenantRegistry()
    void syncTenantUserUpsert({ tenantId, user })
    logOwnerAction('tenant_user_update', `Update user ${user.username} di tenant ${tenant.brandName}`, actor, {
      tenant_id: tenantId,
      user_id: user.id || userId
    })
    return user
  }

  // Fullstack path: update via api-server so status/password apply to Firebase Auth.
  if (isFirebaseEnabled) {
    try {
      const tenantForLookup = tenantRegistry.tenants[tenantId]
      const localUser = asArray(tenantForLookup?.users).find((u) => (
        u?.id === userId
        || String(u?.auth_uid || '').trim() === String(userId || '').trim()
        || String(u?.username || '').trim().toLowerCase() === String(userId || '').trim().toLowerCase()
        || String(u?.email || '').trim().toLowerCase() === String(userId || '').trim().toLowerCase()
      ))
      const primaryCandidateIds = [
        String(userId || '').trim(),
        String(localUser?.id || '').trim(),
        String(localUser?.auth_uid || '').trim()
      ].filter(Boolean)
      const aliasCandidateIds = [
        String(localUser?.username || '').trim().toLowerCase(),
        String(localUser?.email || '').trim().toLowerCase()
      ].filter(Boolean)
      const candidateUserIds = Array.from(new Set(
        primaryCandidateIds.length > 0 ? primaryCandidateIds : aliasCandidateIds
      ))

      let lastPayload = {}
      let lastStatus = 0
      let updatedUser = null
      let patched = false
      for (const candidateUserId of candidateUserIds) {
        const res = await platformFetch(`/platform/owner/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(candidateUserId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data || {})
        })
        const payload = await res.json().catch(() => ({}))
        lastPayload = payload
        lastStatus = res.status
        if (res.ok && payload?.success !== false) {
          patched = true
          updatedUser = payload?.user || null
          break
        }
        // Retry with next identifier only for not-found records.
        if (res.status !== 404) {
          return { success: false, error: payload?.error || `HTTP ${res.status}` }
        }
      }
      if (!patched) {
        if (Number(lastStatus || 0) === 404) {
          const fallbackUser = updateUserLocally(candidateUserIds)
          if (fallbackUser) return { success: true, user: fallbackUser }
        }
        return { success: false, error: lastPayload?.error || `HTTP ${lastStatus || 404}` }
      }
      await bootstrapStoreFromFirebase(true)
      return { success: true, user: updatedUser }
    } catch (err) {
      return {
        success: false,
        error: `Tidak bisa terhubung ke server akun tenant. ${err?.message || 'Periksa koneksi API lalu coba lagi.'}`
      }
    }
  }

  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  
  const user = asArray(tenant.users).find(u => u.id === userId)
  if (!user) return { success: false, error: 'User tidak ditemukan' }
  
  const nextData = { ...data }
  if (Object.prototype.hasOwnProperty.call(nextData, 'email')) {
    nextData.email = normalizeParticipantEmail(nextData.email)
  }
  Object.assign(user, nextData)
  saveTenantRegistry()
  void syncTenantUserUpsert({ tenantId, user })
  logOwnerAction('tenant_user_update', `Update user ${user.username} di tenant ${tenant.brandName}`, actor, {
    tenant_id: tenantId,
    user_id: userId
  })
  return { success: true }
}

export async function deleteTenantUser(tenantId, userId, actor = 'system') {
  const deleteUserLocally = (candidateIds = []) => {
    const tenant = tenantRegistry.tenants[tenantId]
    if (!tenant) return false
    const users = asArray(tenant.users)
    const loweredCandidates = candidateIds.map((id) => String(id || '').trim().toLowerCase()).filter(Boolean)
    const index = users.findIndex((u) => {
      const values = [
        String(u?.id || '').trim(),
        String(u?.auth_uid || '').trim(),
        String(u?.username || '').trim().toLowerCase(),
        String(u?.email || '').trim().toLowerCase()
      ].filter(Boolean)
      return values.some((v) => loweredCandidates.includes(v.toLowerCase()))
    })
    if (index < 0) return false

    const removedUser = users[index] || {}
    users.splice(index, 1)
    tenant.users = users
    saveTenantRegistry()
    const syncIds = Array.from(new Set([
      String(removedUser?.id || '').trim(),
      String(removedUser?.auth_uid || '').trim(),
      ...candidateIds.map((id) => String(id || '').trim())
    ].filter(Boolean)))
    syncIds.forEach((id) => {
      void syncTenantUserDelete({ tenantId, userId: id })
    })
    logOwnerAction('tenant_user_delete', `Hapus user ${removedUser?.username || removedUser?.name || '-'} dari tenant ${tenant.brandName}`, actor, {
      tenant_id: tenantId,
      user_id: removedUser?.id || userId
    })
    return true
  }

  if (isFirebaseEnabled) {
    try {
      const tenantForLookup = tenantRegistry.tenants[tenantId]
      const localUser = asArray(tenantForLookup?.users).find((u) => (
        u?.id === userId
        || String(u?.auth_uid || '').trim() === String(userId || '').trim()
        || String(u?.username || '').trim().toLowerCase() === String(userId || '').trim().toLowerCase()
        || String(u?.email || '').trim().toLowerCase() === String(userId || '').trim().toLowerCase()
      ))
      const primaryCandidateIds = [
        String(userId || '').trim(),
        String(localUser?.id || '').trim(),
        String(localUser?.auth_uid || '').trim()
      ].filter(Boolean)
      const aliasCandidateIds = [
        String(localUser?.username || '').trim().toLowerCase(),
        String(localUser?.email || '').trim().toLowerCase()
      ].filter(Boolean)
      const candidateUserIds = Array.from(new Set(
        primaryCandidateIds.length > 0 ? primaryCandidateIds : aliasCandidateIds
      ))

      let lastPayload = {}
      let lastStatus = 0
      let deleted = false
      for (const candidateUserId of candidateUserIds) {
        const res = await platformFetch(`/platform/owner/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(candidateUserId)}`, {
          method: 'DELETE'
        })
        const payload = await res.json().catch(() => ({}))
        lastPayload = payload
        lastStatus = res.status
        if (res.ok && payload?.success !== false) {
          deleted = true
          break
        }
        // Retry with next identifier only for not-found records.
        if (res.status !== 404) {
          return { success: false, error: payload?.error || `HTTP ${res.status}` }
        }
      }
      if (!deleted) {
        const fallbackDeleted = deleteUserLocally(candidateUserIds)
        if (fallbackDeleted) return { success: true }
        return { success: false, error: lastPayload?.error || `HTTP ${lastStatus || 404}` }
      }
      await bootstrapStoreFromFirebase(true)
      return { success: true }
    } catch (err) {
      const tenantForLookup = tenantRegistry.tenants[tenantId]
      const localUser = asArray(tenantForLookup?.users).find((u) => (
        u?.id === userId
        || String(u?.auth_uid || '').trim() === String(userId || '').trim()
        || String(u?.username || '').trim().toLowerCase() === String(userId || '').trim().toLowerCase()
        || String(u?.email || '').trim().toLowerCase() === String(userId || '').trim().toLowerCase()
      ))
      const fallbackCandidateIds = Array.from(new Set([
        String(userId || '').trim(),
        String(localUser?.id || '').trim(),
        String(localUser?.auth_uid || '').trim(),
        String(localUser?.username || '').trim().toLowerCase(),
        String(localUser?.email || '').trim().toLowerCase()
      ].filter(Boolean)))
      const fallbackDeleted = deleteUserLocally(fallbackCandidateIds)
      if (fallbackDeleted) return { success: true }
      return {
        success: false,
        error: `Tidak bisa terhubung ke server akun tenant. ${err?.message || 'Periksa koneksi API lalu coba lagi.'}`
      }
    }
  }

  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  
  const users = asArray(tenant.users)
  const index = users.findIndex(u => u.id === userId)
  if (index === -1) return { success: false, error: 'User tidak ditemukan' }
  
  const username = users[index].username
  users.splice(index, 1)
  tenant.users = users
  saveTenantRegistry()
  void syncTenantUserDelete({ tenantId, userId })
  
  logOwnerAction('tenant_user_delete', `Hapus user ${username} dari tenant ${tenant.brandName}`, actor, {
    tenant_id: tenantId,
    user_id: userId
  })
  return { success: true }
}

export function addTenantInvoice(tenantId, invoiceData, actor = 'system') {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  
  const invoice = {
    id: generateId().slice(0, 8).toUpperCase(),
    period: invoiceData.period || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    amount: invoiceData.amount || 0,
    status: invoiceData.status || 'unpaid',
    issued_at: new Date().toISOString(),
    paid_at: invoiceData.status === 'paid' ? new Date().toISOString() : null,
    notes: invoiceData.notes || ''
  }
  
  tenant.invoices = asArray(tenant.invoices)
  tenant.invoices.unshift(invoice)
  saveTenantRegistry()
  void syncTenantUpsert(tenant)
  
  logOwnerAction('tenant_invoice_create', `Buat invoice untuk tenant ${tenant.brandName}`, actor, {
    tenant_id: tenantId,
    invoice_id: invoice.id
  })
  return { success: true, invoice }
}

export function updateInvoiceStatus(tenantId, invoiceId, status, actor = 'system') {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  
  const invoice = asArray(tenant.invoices).find(i => i.id === invoiceId)
  if (!invoice) return { success: false, error: 'Invoice tidak ditemukan' }
  
  invoice.status = status
  invoice.paid_at = status === 'paid' ? new Date().toISOString() : null
  saveTenantRegistry()
  void syncTenantUpsert(tenant)
  
  logOwnerAction('tenant_invoice_update', `Update status invoice ${invoiceId} menjadi ${status}`, actor, {
    tenant_id: tenantId,
    invoice_id: invoiceId
  })
  return { success: true }
}

export function updateTenantBranding(tenantId, brandingData, actor = 'system') {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }

  const nextBranding = { ...(tenant.branding || {}), ...(brandingData || {}) }
  tenant.branding = nextBranding

  // Keep primary tenant label in sync with white-label name updates.
  const explicitBrandName = String(brandingData?.brandName || '').trim()
  const appNameAlias = String(brandingData?.appName || '').trim()
  const nextBrandName = explicitBrandName || appNameAlias
  if (nextBrandName) {
    tenant.brandName = nextBrandName
  }

  saveTenantRegistry()
  void syncTenantUpsert(tenant)
  dispatchTenantChangeEvent()
  
  logOwnerAction('tenant_branding_update', `Update branding tenant ${tenant.brandName}`, actor, {
    tenant_id: tenantId
  })
  return { success: true }
}

function safeStorageKeys() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    return keys
  } catch {
    return []
  }
}

function normalizeParticipantName(value) {
  return String(value || '').trim()
}

function normalizeParticipantPhone(value) {
  let phone = String(value || '').trim()
  // Hilangkan semua spasi, tanda - dan karakter non-digit kecuali + di depan
  phone = phone.replace(/[^\d+]/g, '')
  // Jika diawali +62, ubah ke 62
  if (phone.startsWith('+62')) phone = '62' + phone.slice(3)
  // Jika diawali 0, ubah ke 62
  else if (phone.startsWith('0')) phone = '62' + phone.slice(1)
  // Excel sering menghilangkan 0 depan: 81234567890 → 6281234567890 (format ID)
  else if (/^8[1-9]\d{7,11}$/.test(phone)) phone = `62${phone}`
  // Jika sudah 62 di depan, biarkan
  // Jika tidak, biarkan apa adanya (untuk nomor luar negeri)
  return phone
}

function normalizeParticipantEmail(value) {
  const clean = String(value || '').trim().toLowerCase()
  return clean || null
}

function normalizeParticipantDay(value, fallback = 1) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function parseParticipantDayValue(value) {
  if (value === undefined || value === null) return NaN
  const raw = String(value).trim()
  if (!raw) return NaN

  const normalized = raw.replace(',', '.')
  const direct = Number(normalized)
  if (Number.isFinite(direct) && Number.isInteger(direct) && direct > 0) return direct

  // Support text like "Hari 2", "Day-2", "D2", etc.
  const m = normalized.match(/(\d+)/)
  if (!m) return NaN
  const extracted = Number(m[1])
  return Number.isFinite(extracted) && Number.isInteger(extracted) && extracted > 0 ? extracted : NaN
}

function normalizeParticipantCategory(value) {
  const clean = String(value || '').trim()
  if (!clean) return 'Regular'
  const matched = categories.find(c => c.toLowerCase() === clean.toLowerCase())
  return matched || clean
}

function normalizeKey(rawKey) {
  return String(rawKey || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function extractParticipantExtras(raw = {}) {
  // Store all unknown columns as participant.meta so client can customize fields.
  // Example: "Tanggal Lahir" will be kept even if not part of system columns.
  const known = new Set([
    'name', 'nama',
    'phone', 'telepon', 'hp',
    'email', 'email_address',
    'category', 'kategori',
    'day_number', 'day', 'hari',
    'auto_send', 'auto_send_email', 'auto_send_wa',
    'id', 'ticket_id', 'secure_code', 'secure_ref',
    'qr_data', 'is_checked_in', 'checked_in_at', 'checked_in_by',
    'created_at',
    'actor', 'tenant_id', 'event_id'
  ])

  const extras = {}
  Object.keys(raw || {}).forEach((k) => {
    const nk = normalizeKey(k)
    if (known.has(nk) || nk === 'meta') return
    const v = raw?.[k]
    if (v === undefined || v === null) return
    const s = typeof v === 'string' ? v.trim() : String(v).trim()
    if (!s) return
    extras[k] = s
  })

  return extras
}

function toSafeCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

function getTenantTicketPrefix(tenant = getActiveTenantState()) {
  const brandCode = toSafeCode(tenant?.brandName).slice(0, 4)
  if (brandCode.length >= 3) return brandCode

  const fallback = toSafeCode(tenant?.id).slice(0, 4)
  return fallback || 'YMH'
}

function buildTicketId(dayNumber, index, tenant = getActiveTenantState()) {
  const prefix = getTenantTicketPrefix(tenant)
  return `${prefix}-D${dayNumber}-${String(index).padStart(3, '0')}`
}

function generateRandomToken(size = 18) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < size; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

function ensureParticipantSecurity(raw = {}) {
  const secure_code = String(raw.secure_code || '').trim() || generateRandomToken(24)
  const secure_ref = String(raw.secure_ref || '').trim() || generateRandomToken(14)
  return { secure_code, secure_ref }
}

function buildQrSignature({ tenantId, eventId, ticketId, dayNumber, secureCode = '', secureRef = '' }) {
  const payload = `${tenantId}|${eventId}|${ticketId}|${dayNumber}|${secureCode}|${secureRef}|event-secure-v3`
  return btoa(payload)
}

function buildSecurityMeta(participant) {
  const hasSecure = !!participant?.secure_code && !!participant?.secure_ref
  return {
    mode: hasSecure ? 'v3-secure' : 'legacy-v2',
    secure_ref_mask: hasSecure ? `***${String(participant.secure_ref).slice(-6)}` : '-',
    has_secure_token: hasSecure
  }
}

function encodeQrPayload({ ticketId, name, dayNumber, tenantId, eventId, secureCode = '', secureRef = '' }) {
  const signature = buildQrSignature({
    tenantId,
    eventId,
    ticketId,
    dayNumber,
    secureCode,
    secureRef
  })
  return JSON.stringify({
    tid: ticketId,
    n: name,
    d: dayNumber,
    t: tenantId,
    e: eventId,
    r: secureRef,
    sig: signature,
    v: 3
  })
}

function normalizeStoredParticipant(raw, index = 0) {
  const dayNumber = normalizeParticipantDay(raw?.day_number, 1)
  const ticketId = String(raw?.ticket_id || '').trim() || `YMH-D${dayNumber}-${String(index + 1).padStart(3, '0')}`
  const name = normalizeParticipantName(raw?.name) || 'Peserta'
  const security = ensureParticipantSecurity(raw)

  return {
    ...raw,
    id: raw?.id || generateId(),
    ticket_id: ticketId,
    name,
    secure_code: security.secure_code,
    secure_ref: security.secure_ref,
    phone: normalizeParticipantPhone(raw?.phone),
    email: normalizeParticipantEmail(raw?.email),
    category: normalizeParticipantCategory(raw?.category),
    day_number: dayNumber,
    is_checked_in: !!raw?.is_checked_in,
    checked_in_at: raw?.checked_in_at || null,
    checked_in_by: raw?.checked_in_by || null,
    created_at: raw?.created_at || new Date().toISOString()
  }
}

function sanitizeParticipantInput(data, fallbackDay = 1) {
  // If meta is already provided as an object (e.g. from bulk import), use it directly.
  const meta = (data?.meta && typeof data.meta === 'object' && !Array.isArray(data.meta) && Object.keys(data.meta).length > 0)
    ? data.meta
    : extractParticipantExtras(data)
  return {
    name: normalizeParticipantName(data?.name),
    phone: normalizeParticipantPhone(data?.phone),
    email: normalizeParticipantEmail(data?.email),
    category: normalizeParticipantCategory(data?.category),
    day_number: normalizeParticipantDay(data?.day_number, fallbackDay),
    meta
  }
}

function saveStoreBackupSnapshot(previousRaw) {
  if (!previousRaw) return
  const backupKey = `${STORE_BACKUP_PREFIX}${Date.now()}`
  safeStorageSet(backupKey, previousRaw)

  const backupKeys = safeStorageKeys()
    .filter(key => key.startsWith(STORE_BACKUP_PREFIX))
    .sort()

  if (backupKeys.length <= MAX_STORE_BACKUPS) return

  const toDelete = backupKeys.slice(0, backupKeys.length - MAX_STORE_BACKUPS)
  toDelete.forEach(key => safeStorageRemove(key))
}

function parseBackupTimestamp(backupKey) {
  const raw = Number(backupKey.replace(STORE_BACKUP_PREFIX, ''))
  return Number.isFinite(raw) ? raw : 0
}

function isValidStoreShape(candidate) {
  if (!candidate || typeof candidate !== 'object') return false
  if (candidate.events && typeof candidate.events === 'object') return true
  if (candidate.tenants && typeof candidate.tenants === 'object') {
    return Object.values(candidate.tenants).some(bucket => bucket?.events && typeof bucket.events === 'object')
  }
  return false
}

function isBackupKey(backupKey) {
  return String(backupKey || '').startsWith(STORE_BACKUP_PREFIX)
}

function countEventsInSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return 0
  if (snapshot.events && typeof snapshot.events === 'object') {
    return Object.keys(snapshot.events).length
  }
  if (snapshot.tenants && typeof snapshot.tenants === 'object') {
    return Object.values(snapshot.tenants).reduce((sum, bucket) => {
      const events = bucket?.events && typeof bucket.events === 'object' ? Object.keys(bucket.events).length : 0
      return sum + events
    }, 0)
  }
  return 0
}

// Integrasi dengan util generateMockParticipants agar data diambil dari CSV
import { allParticipants as csvParticipants } from '../../api-server/src/utils/generateMockParticipants.js';

function generateMockParticipants(tenantId = DEFAULT_TENANT_ID, eventId = DEFAULT_EVENT_ID) {
  // Map data CSV ke format peserta yang sesuai
  return csvParticipants.map((row, idx) => {
    const name = row.nama || 'Peserta';
    const ticketId = buildTicketId(Number(row.hari), idx + 1, tenantId);
    const security = ensureParticipantSecurity({});
    return {
      id: generateId(),
      ticket_id: ticketId,
      name,
      secure_code: security.secure_code,
      secure_ref: security.secure_ref,
      phone: row.telepon || '',
      category: row.kategori || categories[Math.floor(Math.random() * categories.length)],
      day_number: Number(row.hari) || 1,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      qr_data: encodeQrPayload({
        ticketId,
        name,
        dayNumber: Number(row.hari) || 1,
        tenantId,
        eventId,
        secureCode: security.secure_code,
        secureRef: security.secure_ref
      }),
      is_checked_in: false,
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString()
    };
  });
}

function createEmptyEventState(name = 'Event Platform') {
  const globalTemplate = safeStorageGet(WA_TEMPLATE_KEY) || safeStorageGet(LEGACY_WA_TEMPLATE_KEY) || null
  const globalSendModeRaw = safeStorageGet(WA_SEND_MODE_KEY) || safeStorageGet(LEGACY_WA_SEND_MODE_KEY)
  const globalSendMode = globalSendModeRaw === WA_SEND_MODE_MESSAGE_ONLY
    ? WA_SEND_MODE_MESSAGE_ONLY
    : DEFAULT_WA_SEND_MODE
  return {
    id: generateId(),
    name,
    isArchived: false,
    created_at: new Date().toISOString(),
    currentDay: 1,
    participants: [],
    deletedParticipantIds: {},
    checkInLogs: [],
    adminLogs: [],
    pendingCheckIns: [],
    offlineQueueHistory: [],
    offlineConfig: { maxPendingAttempts: DEFAULT_MAX_PENDING_ATTEMPTS },
    waTemplate: globalTemplate,
    waSendMode: globalSendMode
  }
}

function createDefaultStore() {
  const defaultEvent = createEmptyEventState('Event Platform 2026')
  defaultEvent.id = DEFAULT_EVENT_ID

  return {
    tenants: {
      [DEFAULT_TENANT_ID]: {
        activeEventId: defaultEvent.id,
        events: {
          [defaultEvent.id]: defaultEvent
        }
      }
    }
  }
}

function createTenantStoreBucket(eventName = 'Event 1', withMockParticipants = false) {
  const event = createEmptyEventState(eventName)
  if (withMockParticipants) {
    event.id = DEFAULT_EVENT_ID
    event.participants = generateMockParticipants(DEFAULT_TENANT_ID, event.id)
  }

  return {
    activeEventId: event.id,
    events: {
      [event.id]: event
    }
  }
}

function normalizeSavedEvent(id, raw) {
  const parsedSendMode = String(raw?.waSendMode || '').trim()
  const waSendMode = parsedSendMode === WA_SEND_MODE_MESSAGE_ONLY
    ? WA_SEND_MODE_MESSAGE_ONLY
    : DEFAULT_WA_SEND_MODE

  return {
    id,
    name: raw?.name || 'Event Platform',
    isArchived: !!raw?.isArchived,
    created_at: raw?.created_at || new Date().toISOString(),
    currentDay: Number.isInteger(raw?.currentDay) && raw.currentDay > 0 ? raw.currentDay : 1,
    participants: asArray(raw?.participants).map((p, i) => normalizeStoredParticipant(p, i)),
    deletedParticipantIds: (raw?.deletedParticipantIds && typeof raw.deletedParticipantIds === 'object')
      ? { ...raw.deletedParticipantIds }
      : {},
    checkInLogs: asArray(raw?.checkInLogs),
    adminLogs: asArray(raw?.adminLogs),
    pendingCheckIns: asArray(raw?.pendingCheckIns),
    offlineQueueHistory: asArray(raw?.offlineQueueHistory),
    offlineConfig: {
      maxPendingAttempts: Number.isInteger(raw?.offlineConfig?.maxPendingAttempts) && raw.offlineConfig.maxPendingAttempts >= 1
        ? raw.offlineConfig.maxPendingAttempts
        : DEFAULT_MAX_PENDING_ATTEMPTS
    },
    waTemplate: raw?.waTemplate || null,
    waSendMode
  }
}

function normalizeTenantStoreBucket(rawBucket, fallbackEventName = 'Event 1') {
  const normalizedEvents = {}
  const sourceEvents = rawBucket?.events

  if (sourceEvents && typeof sourceEvents === 'object') {
    Object.keys(sourceEvents).forEach(id => {
      normalizedEvents[id] = normalizeSavedEvent(id, sourceEvents[id])
    })
  }

  const eventIds = Object.keys(normalizedEvents)
  if (eventIds.length === 0) {
    return createTenantStoreBucket(fallbackEventName, false)
  }

  const fallbackId = eventIds[0]
  const activeEventId = normalizedEvents[rawBucket?.activeEventId] ? rawBucket.activeEventId : fallbackId

  return {
    activeEventId,
    events: normalizedEvents
  }
}

function migrateLegacyStore(parsed) {
  const event = createEmptyEventState('Event Platform 2026')
  event.id = DEFAULT_EVENT_ID
  event.currentDay = Number.isInteger(parsed?.currentDay) && parsed.currentDay > 0 ? parsed.currentDay : 1
  event.participants = asArray(parsed?.participants)
  event.checkInLogs = asArray(parsed?.checkInLogs)
  event.adminLogs = asArray(parsed?.adminLogs)
  event.pendingCheckIns = asArray(parsed?.pendingCheckIns)
  event.offlineQueueHistory = asArray(parsed?.offlineQueueHistory)
  event.offlineConfig = {
    maxPendingAttempts: Number.isInteger(parsed?.offlineConfig?.maxPendingAttempts) && parsed.offlineConfig.maxPendingAttempts >= 1
      ? parsed.offlineConfig.maxPendingAttempts
      : DEFAULT_MAX_PENDING_ATTEMPTS
  }
  event.waTemplate = safeStorageGet(WA_TEMPLATE_KEY) || safeStorageGet(LEGACY_WA_TEMPLATE_KEY) || null
  const legacySendMode = safeStorageGet(WA_SEND_MODE_KEY) || safeStorageGet(LEGACY_WA_SEND_MODE_KEY)
  event.waSendMode = legacySendMode === WA_SEND_MODE_MESSAGE_ONLY
    ? WA_SEND_MODE_MESSAGE_ONLY
    : DEFAULT_WA_SEND_MODE

  return {
    tenants: {
      [DEFAULT_TENANT_ID]: {
        activeEventId: event.id,
        events: {
          [event.id]: event
        }
      }
    }
  }
}

function getStore() {
  const saved = safeStorageGet(STORE_KEY) || safeStorageGet(LEGACY_STORE_KEY)
  const parsed = parseStoredJSON(saved)
  if (parsed) {
    if (parsed?.tenants && typeof parsed.tenants === 'object') {
      const normalizedTenants = {}
      Object.keys(parsed.tenants).forEach(tenantId => {
        const tenantMeta = tenantRegistry.tenants[tenantId]
        const fallbackEventName = tenantMeta?.eventName || `Event ${tenantId.slice(0, 6)}`
        normalizedTenants[tenantId] = normalizeTenantStoreBucket(parsed.tenants[tenantId], fallbackEventName)
      })

      if (!normalizedTenants[DEFAULT_TENANT_ID]) {
        normalizedTenants[DEFAULT_TENANT_ID] = createTenantStoreBucket('Event Platform 2026', false)
      }

      if (DEFAULT_TENANT_ONLY_MODE) {
        return {
          tenants: {
            [DEFAULT_TENANT_ID]: normalizeTenantStoreBucket(normalizedTenants[DEFAULT_TENANT_ID], 'Event Platform 2026')
          }
        }
      }

      return { tenants: normalizedTenants }
    }

    if (parsed?.events && typeof parsed.events === 'object') {
      return {
        tenants: {
          [DEFAULT_TENANT_ID]: normalizeTenantStoreBucket(parsed, 'Event Platform 2026')
        }
      }
    }

    return migrateLegacyStore(parsed)
  }
  return createDefaultStore()
}

let store = getStore()
runOneTimeDefaultTenantPurge()
let realtimeListeners = []
let firebaseBootstrapPromise = null
let firebaseStoreReady = false
let lastForcedFirebaseBootstrapAt = 0
let workspaceRealtimeUnsubscribe = null
let lastRealtimeHydrateAt = 0
let realtimeHydrateInFlight = false
const MIN_FORCED_FIREBASE_BOOTSTRAP_MS = 5000
const MIN_REALTIME_HYDRATE_MS = 1200

function dispatchWorkspaceSyncedToUI() {
  if (typeof window === 'undefined') return
  try {
    window.dispatchEvent(new CustomEvent('ons-workspace-synced'))
  } catch {
    // ignore
  }
}

function ensureTenantStore(tenantId, fallbackEventName = 'Event 1', withMockParticipants = false) {
  if (!store.tenants || typeof store.tenants !== 'object') {
    store.tenants = {}
  }

  if (!store.tenants[tenantId]) {
    store.tenants[tenantId] = createTenantStoreBucket(fallbackEventName, withMockParticipants)
  }

  store.tenants[tenantId] = normalizeTenantStoreBucket(store.tenants[tenantId], fallbackEventName)
  return store.tenants[tenantId]
}

function saveStore() {
  if (DEFAULT_TENANT_ONLY_MODE) {
    const defaultBucket = store?.tenants?.[DEFAULT_TENANT_ID]
      ? normalizeTenantStoreBucket(store.tenants[DEFAULT_TENANT_ID], 'Event Platform 2026')
      : createTenantStoreBucket('Event Platform 2026', false)
    store = { tenants: { [DEFAULT_TENANT_ID]: defaultBucket } }
  }
  const previous = safeStorageGet(STORE_KEY) || safeStorageGet(LEGACY_STORE_KEY)
  saveStoreBackupSnapshot(previous)
  safeStorageSet(STORE_KEY, JSON.stringify(store))
  safeStorageRemove(LEGACY_STORE_KEY)
}

function persistHydratedState() {
  if (DEFAULT_TENANT_ONLY_MODE) {
    tenantRegistry = enforceDefaultTenantOnlyRegistry(tenantRegistry)
    if (!store?.tenants || typeof store.tenants !== 'object') {
      store = createDefaultStore()
    }
    const defaultBucket = store.tenants?.[DEFAULT_TENANT_ID]
      ? normalizeTenantStoreBucket(store.tenants[DEFAULT_TENANT_ID], 'Event Platform 2026')
      : createTenantStoreBucket('Event Platform 2026', false)
    store = { tenants: { [DEFAULT_TENANT_ID]: defaultBucket } }
  }
  safeStorageSet(TENANT_REGISTRY_KEY, JSON.stringify(tenantRegistry))
  safeStorageSet(STORE_KEY, JSON.stringify(store))
  safeStorageRemove(LEGACY_TENANT_REGISTRY_KEY)
  safeStorageRemove(LEGACY_STORE_KEY)
}

function normalizeHydratedTenantRegistry(snapshot) {
  if (!snapshot?.tenants || typeof snapshot.tenants !== 'object') {
    return createDefaultTenantRegistry()
  }

  const normalizedTenants = {}
  Object.keys(snapshot.tenants).forEach(id => {
    normalizedTenants[id] = normalizeSavedTenant(id, snapshot.tenants[id])
  })

  if (!normalizedTenants[DEFAULT_TENANT_ID]) {
    normalizedTenants[DEFAULT_TENANT_ID] = { ...DEFAULT_TENANT }
  }

  const activeTenantId = normalizedTenants[snapshot.activeTenantId]
    ? snapshot.activeTenantId
    : Object.keys(normalizedTenants)[0] || DEFAULT_TENANT_ID

  const normalizedRegistry = {
    activeTenantId,
    tenants: normalizedTenants
  }
  return DEFAULT_TENANT_ONLY_MODE
    ? enforceDefaultTenantOnlyRegistry(normalizedRegistry)
    : normalizedRegistry
}

function normalizeHydratedStore(snapshot) {
  if (!snapshot?.tenants || typeof snapshot.tenants !== 'object') {
    return createDefaultStore()
  }

  const normalizedTenants = {}
  Object.keys(snapshot.tenants).forEach(tenantId => {
    const tenantMeta = tenantRegistry.tenants[tenantId]
    const fallbackEventName = tenantMeta?.eventName || `Event ${tenantId.slice(0, 6)}`
    normalizedTenants[tenantId] = normalizeTenantStoreBucket(snapshot.tenants[tenantId], fallbackEventName)
  })

  if (!normalizedTenants[DEFAULT_TENANT_ID]) {
    normalizedTenants[DEFAULT_TENANT_ID] = createTenantStoreBucket('Event Platform 2026', false)
  }

  if (DEFAULT_TENANT_ONLY_MODE) {
    const defaultBucket = normalizedTenants[DEFAULT_TENANT_ID]
      ? normalizeTenantStoreBucket(normalizedTenants[DEFAULT_TENANT_ID], 'Event Platform 2026')
      : createTenantStoreBucket('Event Platform 2026', false)
    return { tenants: { [DEFAULT_TENANT_ID]: defaultBucket } }
  }

  return { tenants: normalizedTenants }
}

function participantMergeTimestamp(p) {
  const primary = p?.updated_at || p?.created_at
  const n = primary ? new Date(primary).getTime() : 0
  return Number.isFinite(n) ? n : 0
}

function cloneStoreForMerge(src) {
  if (!src || !isValidStoreShape(src)) return null
  try {
    return JSON.parse(JSON.stringify(src))
  } catch {
    return null
  }
}

/**
 * Gabungkan peserta lokal (localStorage) ke store hasil Firebase supaya impor Excel
 * tidak lenyap saat snapshot remote kosong/belum tertulis (race sync).
 */
function mergePersistedLocalParticipantsIntoHydratedStore(nextStore, localStore) {
  if (!nextStore?.tenants || !localStore?.tenants || !isValidStoreShape(localStore)) return

  for (const tenantId of Object.keys(nextStore.tenants)) {
    const nextBucket = nextStore.tenants[tenantId]
    const localBucket = localStore.tenants[tenantId]
    if (!nextBucket?.events || !localBucket?.events) continue

    for (const eventId of Object.keys(nextBucket.events)) {
      const nextEv = nextBucket.events[eventId]
      const localEv = localBucket.events[eventId]
      if (!nextEv || !localEv) continue

      const remotePs = asArray(nextEv.participants)
      const localPs = asArray(localEv.participants)
      const deletedByRemote = (nextEv?.deletedParticipantIds && typeof nextEv.deletedParticipantIds === 'object')
        ? nextEv.deletedParticipantIds
        : {}
      const byId = new Map()
      for (const p of remotePs) {
        if (p?.id) byId.set(p.id, p)
      }

      const onlyLocal = []
      for (const p of localPs) {
        if (!p?.id) continue
        if (deletedParticipantTombstones[p.id]) continue
        if (deletedByRemote[p.id]) continue
        if (!byId.has(p.id)) {
          byId.set(p.id, p)
          onlyLocal.push(p)
        } else {
          const existing = byId.get(p.id)
          if (participantMergeTimestamp(p) > participantMergeTimestamp(existing)) {
            byId.set(p.id, p)
          }
        }
      }

      const merged = Array.from(byId.values()).sort(
        (a, b) => participantMergeTimestamp(a) - participantMergeTimestamp(b)
      )
      nextEv.participants = merged
      
      if (typeof localEv.currentDay === 'number' && localEv.currentDay > (nextEv.currentDay || 1)) {
        nextEv.currentDay = localEv.currentDay
      }

      if (onlyLocal.length > 0) {
        for (const p of onlyLocal) {
          void syncParticipantUpsert({ tenantId, eventId, participant: p })
        }
        void syncEventSnapshot({ tenantId, event: nextEv })
      }
    }
  }
}

/**
 * Jika event aktif masih kosong setelah merge (mis. ID tenant beda antara lokal vs Firebase),
 * pindahkan daftar peserta lokal terbesar ke event aktif supaya impor tidak "hilang".
 */
function salvageLargestParticipantListIntoActiveEvent(nextStore, ...sources) {
  if (!nextStore?.tenants || !tenantRegistry?.activeTenantId) return
  const tid = tenantRegistry.activeTenantId
  const bucket = nextStore.tenants[tid]
  if (!bucket?.events) return
  const eid = bucket.activeEventId
  const activeEv = bucket.events[eid]
  if (!activeEv) return
  if (asArray(activeEv.participants).length > 0) return
  const activeDeletedMap = (activeEv?.deletedParticipantIds && typeof activeEv.deletedParticipantIds === 'object')
    ? activeEv.deletedParticipantIds
    : {}

  let best = []
  for (const src of sources) {
    if (!src?.tenants) continue
    const localBucket = src.tenants[tid]
    if (!localBucket?.events) continue
    for (const lev of Object.values(localBucket.events)) {
      const ps = asArray(lev?.participants).filter((p) => (
        p?.id
        && !deletedParticipantTombstones[p.id]
        && !activeDeletedMap[p.id]
      ))
      if (ps.length > best.length) best = ps
    }
  }
  if (best.length === 0) return

  activeEv.participants = best
    .slice()
    .sort((a, b) => participantMergeTimestamp(a) - participantMergeTimestamp(b))

  for (const p of best) {
    void syncParticipantUpsert({ tenantId: tid, eventId: eid, participant: p })
  }
  void syncEventSnapshot({ tenantId: tid, event: activeEv })
}

function preserveMissingTenantScopes({ nextTenantRegistry, nextStore, previousTenantRegistry, previousStore }) {
  if (DEFAULT_TENANT_ONLY_MODE) return
  const prevTenants = previousTenantRegistry?.tenants || {}
  const nextTenants = nextTenantRegistry?.tenants || {}
  Object.keys(prevTenants).forEach((tenantId) => {
    if (nextTenants[tenantId]) return
    nextTenants[tenantId] = prevTenants[tenantId]
    if (!nextStore?.tenants) nextStore.tenants = {}
    if (!nextStore.tenants[tenantId] && previousStore?.tenants?.[tenantId]) {
      nextStore.tenants[tenantId] = previousStore.tenants[tenantId]
    }
  })
}

export async function bootstrapStoreFromFirebase(force = false) {
  ensureWorkspaceRealtimeBridge()
  if (!isWorkspaceSyncEnabled()) return false
  if (firebaseBootstrapPromise) return firebaseBootstrapPromise
  if (firebaseStoreReady && !force) return true
  if (force) {
    const now = Date.now()
    if (now - lastForcedFirebaseBootstrapAt < MIN_FORCED_FIREBASE_BOOTSTRAP_MS) {
      return true
    }
    lastForcedFirebaseBootstrapAt = now
  }

  firebaseBootstrapPromise = (async () => {
    const previousTenantRegistry = tenantRegistry
    const previousStore = cloneStoreForMerge(store)
    const memoryStorePreHydrate = cloneStoreForMerge(store)
    const localRaw = safeStorageGet(STORE_KEY) || safeStorageGet(LEGACY_STORE_KEY)
    const localSnap = parseStoredJSON(localRaw)

    const snapshot = await fetchFirebaseWorkspaceSnapshot()
    if (!snapshot?.tenantRegistry || !snapshot?.store) {
      firebaseStoreReady = true
      return false
    }

    const nextTenantRegistry = normalizeHydratedTenantRegistry(snapshot.tenantRegistry)
    const nextStore = normalizeHydratedStore(snapshot.store)
    const tenantIdsFromSnapshot = Object.keys(snapshot?.tenantRegistry?.tenants || {})
    preserveMissingTenantScopes({
      nextTenantRegistry,
      nextStore,
      previousTenantRegistry,
      previousStore
    })
    tenantRegistry = nextTenantRegistry
    store = nextStore
    mergePersistedLocalParticipantsIntoHydratedStore(store, localSnap)
    if (memoryStorePreHydrate) {
      mergePersistedLocalParticipantsIntoHydratedStore(store, memoryStorePreHydrate)
    }
    salvageLargestParticipantListIntoActiveEvent(store, localSnap, memoryStorePreHydrate)
    persistHydratedState()

    if (DEFAULT_TENANT_ONLY_MODE) {
      const nonDefaultTenantIds = tenantIdsFromSnapshot.filter((id) => id && id !== DEFAULT_TENANT_ID)
      nonDefaultTenantIds.forEach((tenantId) => {
        void syncTenantDelete(tenantId)
      })

      const snapshotDefaultTenant = snapshot?.tenantRegistry?.tenants?.[DEFAULT_TENANT_ID] || {}
      const hasRemoteLegacyPurgeMarker = !!String(snapshotDefaultTenant?.legacy_data_purged_at || '').trim()
      if (!hasRemoteLegacyPurgeMarker) {
        const snapshotDefaultUsers = Array.isArray(snapshotDefaultTenant?.users) ? snapshotDefaultTenant.users : []
        snapshotDefaultUsers.forEach((user) => {
          const username = String(user?.username || '').trim().toLowerCase()
          if (ALLOWED_DEFAULT_USERNAMES.has(username)) return
          const userId = String(user?.id || user?.auth_uid || '').trim()
          if (!userId) return
          void syncTenantUserDelete({ tenantId: DEFAULT_TENANT_ID, userId })
        })

        const snapshotDefaultBucket = snapshot?.store?.tenants?.[DEFAULT_TENANT_ID]
        const snapshotEvents = snapshotDefaultBucket?.events && typeof snapshotDefaultBucket.events === 'object'
          ? Object.values(snapshotDefaultBucket.events)
          : []
        snapshotEvents.forEach((event) => {
          const eventId = String(event?.id || '').trim()
          if (!eventId) return
          const participants = Array.isArray(event?.participants) ? event.participants : []
          participants.forEach((participant) => {
            const participantId = String(participant?.id || '').trim()
            if (!participantId) return
            void syncParticipantDelete({ tenantId: DEFAULT_TENANT_ID, eventId, participantId })
          })
          void syncEventSnapshot({
            tenantId: DEFAULT_TENANT_ID,
            event: {
              ...event,
              participants: [],
              deletedParticipantIds: {},
              checkInLogs: [],
              adminLogs: [],
              pendingCheckIns: [],
              offlineQueueHistory: [],
              currentDay: 1
            }
          })
          void syncResetCheckInLogs({ tenantId: DEFAULT_TENANT_ID, eventId })
          void syncResetAdminLogs({ tenantId: DEFAULT_TENANT_ID, eventId })
        })

        void syncTenantUpsert({
          ...snapshotDefaultTenant,
          id: DEFAULT_TENANT_ID,
          legacy_data_purged_at: new Date().toISOString()
        })
      }
    }

    firebaseStoreReady = true
    dispatchWorkspaceSyncedToUI()
    return true
  })().catch(err => {
    console.error('[FirebaseBootstrap] hydrate failed:', err?.message || err)
    return false
  }).finally(() => {
    firebaseBootstrapPromise = null
  })

  return firebaseBootstrapPromise
}

function ensureWorkspaceRealtimeBridge() {
  if (!isWorkspaceSyncEnabled()) return
  if (workspaceRealtimeUnsubscribe) return

  workspaceRealtimeUnsubscribe = subscribeWorkspaceChanges(() => {
    if (realtimeHydrateInFlight) return
    const now = Date.now()
    if (now - lastRealtimeHydrateAt < MIN_REALTIME_HYDRATE_MS) return

    lastRealtimeHydrateAt = now
    realtimeHydrateInFlight = true

    bootstrapStoreFromFirebase(true)
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('[WorkspaceRealtime] hydrate failed:', err?.message || err)
      })
      .finally(() => {
        realtimeHydrateInFlight = false
      })
  })
}

function getActiveEvent() {
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(
    activeTenant.id,
    activeTenant.eventName || 'Event 1',
    false
  )

  if (!bucket.events[bucket.activeEventId]) {
    const firstId = Object.keys(bucket.events)[0]
    bucket.activeEventId = firstId
  }

  return bucket.events[bucket.activeEventId]
}

function normalizeActor(actor) {
  if (!actor) return 'system'
  if (typeof actor === 'string') return actor
  return actor.username || actor.name || actor.role || 'system'
}

function normalizeReason(reason) {
  return String(reason || '').trim()
}

function isStrongReason(reason) {
  return normalizeReason(reason).length >= MIN_HIGH_IMPACT_REASON_LENGTH
}

export function getEvents() {
  return getEventsWithOptions({ includeArchived: false })
}

export function getStoreBackups() {
  return safeStorageKeys()
    .filter(key => key.startsWith(STORE_BACKUP_PREFIX))
    .map(key => {
      const raw = safeStorageGet(key)
      const parsed = parseStoredJSON(raw)
      const timestamp = parseBackupTimestamp(key)
      const eventCount = isValidStoreShape(parsed) ? countEventsInSnapshot(parsed) : 0
      return {
        key,
        timestamp,
        created_at: timestamp ? new Date(timestamp).toISOString() : null,
        size: raw ? raw.length : 0,
        eventCount,
        isValid: isValidStoreShape(parsed)
      }
    })
    .sort((a, b) => b.timestamp - a.timestamp)
}

export function restoreStoreBackup(backupKey, actor = 'system', reason = '') {
  if (!isBackupKey(backupKey)) {
    return { success: false, error: 'Backup key tidak valid' }
  }

  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const raw = safeStorageGet(backupKey)
  if (!raw) return { success: false, error: 'Backup tidak ditemukan' }

  const parsed = parseStoredJSON(raw)
  if (!isValidStoreShape(parsed)) {
    return { success: false, error: 'Backup rusak atau format tidak didukung' }
  }

  // Save current store as a new snapshot before performing restore.
  saveStoreBackupSnapshot(safeStorageGet(STORE_KEY) || safeStorageGet(LEGACY_STORE_KEY))

  safeStorageSet(STORE_KEY, raw)
  safeStorageRemove(LEGACY_STORE_KEY)
  store = getStore()

  const cleanReason = normalizeReason(reason)
  logAdminAction('store_restore_backup', `Restore data dari backup ${backupKey}`, actor, {
    backup_key: backupKey,
    reason: cleanReason,
    restored_at: new Date().toISOString()
  })

  return {
    success: true,
    activeEventId: getCurrentEventId(),
    eventCount: countEventsInSnapshot(store)
  }
}

export function exportStoreBackup(backupKey) {
  if (!isBackupKey(backupKey)) {
    return { success: false, error: 'Backup key tidak valid' }
  }

  const raw = safeStorageGet(backupKey)
  if (!raw) return { success: false, error: 'Backup tidak ditemukan' }

  const parsed = parseStoredJSON(raw)
  const timestamp = parseBackupTimestamp(backupKey)
  const stamp = timestamp ? new Date(timestamp).toISOString().replace(/[:.]/g, '-') : 'unknown'
  const fileName = `ons-store-backup-${stamp}.json`

  return {
    success: true,
    fileName,
    content: parsed ? JSON.stringify(parsed, null, 2) : raw,
    isValid: isValidStoreShape(parsed)
  }
}

export function deleteStoreBackup(backupKey, actor = 'system', reason = '') {
  if (!isBackupKey(backupKey)) {
    return { success: false, error: 'Backup key tidak valid' }
  }

  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const existing = safeStorageGet(backupKey)
  if (!existing) return { success: false, error: 'Backup tidak ditemukan' }

  safeStorageRemove(backupKey)
  logAdminAction('store_backup_delete', `Hapus backup store ${backupKey}`, actor, {
    backup_key: backupKey,
    reason: normalizeReason(reason),
    deleted_at: new Date().toISOString()
  })

  return { success: true }
}

export function deleteInvalidStoreBackups(actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const invalidBackups = getStoreBackups().filter(item => !item.isValid)
  if (invalidBackups.length === 0) {
    return { success: true, deleted: 0 }
  }

  invalidBackups.forEach(item => safeStorageRemove(item.key))

  logAdminAction('store_backup_delete_invalid', `Hapus backup invalid (${invalidBackups.length} item)`, actor, {
    deleted: invalidBackups.length,
    reason: normalizeReason(reason),
    keys: invalidBackups.map(item => item.key)
  })

  return { success: true, deleted: invalidBackups.length }
}

export function getEventsWithOptions(options = {}) {
  const includeArchived = !!options.includeArchived
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', false)

  return Object.values(bucket.events)
    .filter(e => includeArchived || !e.isArchived)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(e => ({ id: e.id, name: e.name, created_at: e.created_at, isArchived: !!e.isArchived }))
}

export function getCurrentEventId() {
  const activeTenant = getActiveTenantState()
  return ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', false).activeEventId
}

export function getCurrentEventName() {
  return getActiveEvent()?.name || '-'
}

export function createEvent(name, actor = 'system') {
  const eventName = String(name || '').trim() || `Event ${getEvents().length + 1}`
  const event = createEmptyEventState(eventName)
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', false)
  bucket.events[event.id] = event
  bucket.activeEventId = event.id
  activeTenant.activeEventId = bucket.activeEventId
  saveStore()
  void syncTenantUpsert(activeTenant)
  void syncEventSnapshot({ tenantId: activeTenant.id, event })
  logAdminAction('event_create', `Membuat event baru: ${eventName}`, actor, { event_id: event.id })
  return { id: event.id, name: event.name }
}

export function renameEvent(eventId, newName, actor = 'system') {
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', false)
  const event = bucket.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  const cleanName = String(newName || '').trim()
  if (!cleanName) return { success: false, error: 'Nama event tidak boleh kosong' }

  const prevName = event.name
  event.name = cleanName
  saveStore()
  void syncEventSnapshot({ tenantId: activeTenant.id, event })

  if (prevName !== cleanName) {
    logAdminAction('event_rename', `Ubah nama event: ${prevName} -> ${cleanName}`, actor, { event_id: eventId })
  }
  return { success: true }
}

export function archiveEvent(eventId, actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', false)
  const event = bucket.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  if (event.id === bucket.activeEventId) {
    return { success: false, error: 'Tidak bisa arsipkan event yang sedang aktif' }
  }

  event.isArchived = true
  saveStore()
  void syncEventSnapshot({ tenantId: activeTenant.id, event })
  logAdminAction('event_archive', `Arsipkan event: ${event.name}`, actor, {
    event_id: eventId,
    reason: normalizeReason(reason)
  })
  return { success: true }
}

export function deleteEvent(eventId, actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', false)
  const event = bucket.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  if (event.id === bucket.activeEventId) {
    return { success: false, error: 'Tidak bisa hapus event yang sedang aktif' }
  }

  if (!activeTenant.deletedEventIds || typeof activeTenant.deletedEventIds !== 'object') {
    activeTenant.deletedEventIds = {}
  }
  activeTenant.deletedEventIds[eventId] = new Date().toISOString()
  delete bucket.events[eventId]
  saveStore()
  void syncTenantUpsert(activeTenant)
  void syncEventDelete({ tenantId: activeTenant.id, eventId })
  logAdminAction('event_delete', `Hapus event: ${event.name}`, actor, {
    event_id: eventId,
    reason: normalizeReason(reason)
  })
  return { success: true }
}

export function setCurrentEvent(eventId, actor = 'system') {
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', false)
  if (!bucket.events[eventId]) return false
  const prev = bucket.activeEventId
  bucket.activeEventId = eventId
  activeTenant.activeEventId = bucket.activeEventId
  saveStore()
  void syncTenantUpsert(activeTenant)
  void syncEventSnapshot({ tenantId: activeTenant.id, event: bucket.events[eventId] })
  if (prev !== eventId) {
    logAdminAction('event_switch', `Pindah event aktif ke ${bucket.events[eventId].name}`, actor, {
      from: prev,
      to: eventId
    })
  }
  return true
}

export function logAdminAction(action, description, actor = 'system', meta = null) {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const log = {
    id: generateId(),
    action,
    description,
    actor: normalizeActor(actor),
    meta,
    timestamp: new Date().toISOString()
  }
  ev.adminLogs.push(log)
  saveStore()
  void syncAuditLog({ tenantId: tenant.id, eventId: ev.id, log })
  return log
}

export const defaultWaTemplate = `🎫 *E-Ticket*

Halo *{{nama}}*,
Berikut adalah tiket masuk acara Anda untuk *Hari ke-{{hari}}*.

📋 *Ticket ID:* {{tiket}}
📂 *Kategori:* {{kategori}}

Silakan tunjukkan gambar barcode tiket ini kepada petugas gerbang event. Terima kasih.`

export function getWaTemplate() {
  const ev = getActiveEvent()
  return ev.waTemplate || safeStorageGet(WA_TEMPLATE_KEY) || safeStorageGet(LEGACY_WA_TEMPLATE_KEY) || defaultWaTemplate
}

export function getWaSendMode() {
  const ev = getActiveEvent();
  const mode = ev.waSendMode || safeStorageGet(WA_SEND_MODE_KEY) || safeStorageGet(LEGACY_WA_SEND_MODE_KEY);
  if (mode === WA_SEND_MODE_MESSAGE_ONLY) return WA_SEND_MODE_MESSAGE_ONLY;
  if (mode === WA_SEND_MODE_MESSAGE_WITH_BARCODE) return WA_SEND_MODE_MESSAGE_WITH_BARCODE;
  return DEFAULT_WA_SEND_MODE;
}

export function setWaTemplate(template, actor = 'system') {
  const nextTemplate = String(template || '').trim() || defaultWaTemplate
  const touched = []
  Object.entries(store?.tenants || {}).forEach(([tenantId, bucket]) => {
    Object.values(bucket?.events || {}).forEach((event) => {
      event.waTemplate = nextTemplate
      touched.push({ tenantId, event })
    })
  })
  safeStorageSet(WA_TEMPLATE_KEY, nextTemplate)
  safeStorageRemove(LEGACY_WA_TEMPLATE_KEY)
  saveStore()
  touched.forEach(({ tenantId, event }) => {
    void syncEventSnapshot({ tenantId, event })
  })
  logAdminAction('wa_template_update', 'Template pesan WhatsApp diperbarui', actor)
}

export function setWaSendMode(mode, actor = 'system') {
  let nextMode;
  if (mode === WA_SEND_MODE_MESSAGE_ONLY) nextMode = WA_SEND_MODE_MESSAGE_ONLY;
  else if (mode === WA_SEND_MODE_MESSAGE_WITH_BARCODE) nextMode = WA_SEND_MODE_MESSAGE_WITH_BARCODE;
  else nextMode = DEFAULT_WA_SEND_MODE;
  const touched = []
  Object.entries(store?.tenants || {}).forEach(([tenantId, bucket]) => {
    Object.values(bucket?.events || {}).forEach((event) => {
      event.waSendMode = nextMode
      touched.push({ tenantId, event })
    })
  })
  safeStorageSet(WA_SEND_MODE_KEY, nextMode);
  safeStorageRemove(LEGACY_WA_SEND_MODE_KEY);
  saveStore();
  touched.forEach(({ tenantId, event }) => {
    void syncEventSnapshot({ tenantId, event })
  })
  logAdminAction('wa_send_mode_update', `Mode kirim WhatsApp diubah ke ${nextMode}`, actor, { mode: nextMode });
}

export function getMaxPendingAttempts() {
  return getActiveEvent().offlineConfig?.maxPendingAttempts || DEFAULT_MAX_PENDING_ATTEMPTS
}

export function setMaxPendingAttempts(value, actor = 'system') {
  const parsed = Number(value)
  const safe = Number.isInteger(parsed) ? Math.min(20, Math.max(1, parsed)) : DEFAULT_MAX_PENDING_ATTEMPTS
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const previous = getMaxPendingAttempts()
  ev.offlineConfig = { ...(ev.offlineConfig || {}), maxPendingAttempts: safe }
  saveStore()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  if (previous !== safe) {
    logAdminAction('offline_config_update', `Ubah batas retry offline dari ${previous} ke ${safe}`, actor, {
      from: previous,
      to: safe
    })
  }
  return safe
}

export function subscribeToCheckIns(callback) {
  realtimeListeners.push(callback)
  return () => {
    realtimeListeners = realtimeListeners.filter(cb => cb !== callback)
  }
}

function notifyListeners(event) {
  realtimeListeners.forEach(cb => cb(event))
}

const USERS = {
  owner: { username: 'owner', email: 'owner@ons.local', password: 'owner123', role: 'owner', name: 'Owner Platform' },
  admin: { username: 'admin', email: 'admin@ons.local', password: 'admin123', role: 'super_admin', name: 'Super Admin' },
  gate1: { username: 'gate1', email: 'gate1@ons.local', password: 'gate123', role: 'gate_front', name: 'Panitia Depan' },
  gate2: { username: 'gate2', email: 'gate2@ons.local', password: 'gate123', role: 'gate_back', name: 'Panitia Belakang' }
}

function normalizeLoginIdentifier(value) {
  return String(value || '').trim().toLowerCase()
}

function isEmailLike(value) {
  const str = String(value || '').trim()
  // Valid email harus: ada@domain.xxx format
  // Harus ada minimal 1 karakter sebelum @, dan domain dengan dot
  return /^[^@]+@[^@]+\.[^@]+$/.test(str)
}

function persistSession(session) {
  safeStorageSet(SESSION_KEY, JSON.stringify(session))
  safeStorageRemove(LEGACY_SESSION_KEY)
}

function setActiveTenantContext(tenantId) {
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return null

  tenantRegistry.activeTenantId = tenant.id
  saveTenantRegistry()
  dispatchTenantChangeEvent()
  return tenant
}

function buildSessionForGlobalUser(globalUser) {
  const fallbackTenant = tenantRegistry.tenants[DEFAULT_TENANT_ID] || getActiveTenantState()
  const activeTenant = setActiveTenantContext(fallbackTenant.id) || fallbackTenant

  ensureTenantStore(
    activeTenant.id,
    activeTenant.eventName || 'Event 1',
    false
  )
  saveStore()

  return {
    ...globalUser,
    tenant: {
      id: activeTenant.id,
      brandName: activeTenant.brandName,
      eventName: activeTenant.eventName
    }
  }
}

function buildSessionForTenantUser(foundUser, foundTenant) {
  setActiveTenantContext(foundTenant.id)

  ensureTenantStore(foundTenant.id, foundTenant.eventName || 'Event 1', false)
  saveStore()

  return {
    ...foundUser,
    tenant: {
      id: foundTenant.id,
      brandName: foundTenant.brandName,
      eventName: foundTenant.eventName
    }
  }
}

function findUserByIdentifier(identifier, password, skipPasswordCheck = false, preferredTenantId = '') {
  const cleanIdentifier = normalizeLoginIdentifier(identifier)

  const globalUser = Object.values(USERS).find(u => {
    const matchUsername = normalizeLoginIdentifier(u.username) === cleanIdentifier
    const matchEmail = normalizeLoginIdentifier(u.email) === cleanIdentifier
    if (!(matchUsername || matchEmail)) return false
    return skipPasswordCheck ? true : u.password === password
  })

  if (globalUser) {
    return { scope: 'global', user: globalUser, tenant: null }
  }

  const preferredTenant = preferredTenantId ? tenantRegistry.tenants[preferredTenantId] : null
  if (preferredTenant) {
    const scopedUser = asArray(preferredTenant.users).find((u) => {
      const matchUsername = normalizeLoginIdentifier(u.username) === cleanIdentifier
      const matchEmail = normalizeLoginIdentifier(u.email) === cleanIdentifier
      if (!(matchUsername || matchEmail)) return false
      return skipPasswordCheck ? true : u.password === password
    })
    if (scopedUser) {
      return { scope: 'tenant', user: scopedUser, tenant: preferredTenant }
    }
  }

  let foundUser = null
  let foundTenant = null

  Object.values(tenantRegistry.tenants).forEach(tenant => {
    if (preferredTenant && tenant.id === preferredTenant.id) return
    const user = asArray(tenant.users).find(u => {
      const matchUsername = normalizeLoginIdentifier(u.username) === cleanIdentifier
      const matchEmail = normalizeLoginIdentifier(u.email) === cleanIdentifier
      if (!(matchUsername || matchEmail)) return false
      return skipPasswordCheck ? true : u.password === password
    })

    if (user) {
      foundUser = user
      foundTenant = tenant
    }
  })

  if (!foundUser || !foundTenant) return null
  return { scope: 'tenant', user: foundUser, tenant: foundTenant }
}

function signInWithResolvedUser(resolvedUser) {
  if (!resolvedUser) return { success: false, error: 'Username atau password salah' }

  if (resolvedUser.scope === 'global') {
    const session = buildSessionForGlobalUser(resolvedUser.user)
    persistSession(session)
    return { success: true, user: session }
  }

  if (!resolvedUser.user.is_active) {
    return { success: false, error: 'Akun Anda dinonaktifkan' }
  }

  if (!canUseTenant(resolvedUser.tenant)) {
    return { success: false, error: 'Tenant tidak aktif atau expired. Hubungi owner.' }
  }

  const session = buildSessionForTenantUser(resolvedUser.user, resolvedUser.tenant)
  persistSession(session)
  return { success: true, user: session }
}

export function resolveLoginEmail(identifier) {
  const cleanIdentifier = normalizeLoginIdentifier(identifier)
  if (!cleanIdentifier) return null
  if (isEmailLike(cleanIdentifier)) return cleanIdentifier

  const resolved = findUserByIdentifier(cleanIdentifier, null, true)
  if (!resolved?.user) return null

  const email = normalizeLoginIdentifier(resolved.user.email)
  return email || null
}

export function loginByIdentity(identifier, options = {}) {
  const preferredTenantId = String(options?.tenantId || '').trim()
  const resolved = findUserByIdentifier(identifier, null, true, preferredTenantId)
  return signInWithResolvedUser(resolved)
}

export function login(username, password, options = {}) {
  const preferredTenantId = String(options?.tenantId || '').trim()
  const resolved = findUserByIdentifier(username, password, false, preferredTenantId)
  return signInWithResolvedUser(resolved)
}

export function getSession() {
  const active = safeStorageGet(SESSION_KEY)
  const parsedActive = parseStoredJSON(active)
  if (parsedActive) {
    const role = String(parsedActive.role || '').toLowerCase()
    const isGlobalRole = role === 'owner' || role === 'super_admin'
    const preferredTenantId = String(parsedActive?.tenant?.id || '').trim()

    if (isGlobalRole) {
      const fallbackGlobalTenantId = tenantRegistry.tenants[DEFAULT_TENANT_ID]
        ? DEFAULT_TENANT_ID
        : Object.keys(tenantRegistry.tenants)[0]

      if (!fallbackGlobalTenantId) {
        safeStorageRemove(SESSION_KEY)
        return null
      }

      const resolvedGlobalTenant = setActiveTenantContext(fallbackGlobalTenantId) || tenantRegistry.tenants[fallbackGlobalTenantId]
      ensureTenantStore(
        resolvedGlobalTenant.id,
        resolvedGlobalTenant.eventName || 'Event 1',
        false
      )

      return {
        ...parsedActive,
        tenant: {
          id: resolvedGlobalTenant.id,
          brandName: resolvedGlobalTenant.brandName,
          eventName: resolvedGlobalTenant.eventName
        }
      }
    }

    let resolvedTenant = preferredTenantId ? tenantRegistry.tenants[preferredTenantId] : null
    if (!resolvedTenant) {
      resolvedTenant = getActiveTenantState()
    }

    if (!canUseTenant(resolvedTenant)) {
      const fallbackTenant = Object.values(tenantRegistry.tenants).find(canUseTenant)
      if (fallbackTenant) {
        resolvedTenant = fallbackTenant
        setActiveTenantContext(fallbackTenant.id)
      } else {
        safeStorageRemove(SESSION_KEY)
        return null
      }
    }

    setActiveTenantContext(resolvedTenant.id)

    ensureTenantStore(
      resolvedTenant.id,
      resolvedTenant.eventName || 'Event 1',
      false
    )

    return {
      ...parsedActive,
      tenant: {
        id: resolvedTenant.id,
        brandName: resolvedTenant.brandName,
        eventName: resolvedTenant.eventName
      }
    }
  }

  const legacy = safeStorageGet(LEGACY_SESSION_KEY)
  const parsedLegacy = parseStoredJSON(legacy)
  if (!parsedLegacy) {
    if (active) safeStorageRemove(SESSION_KEY)
    return null
  }

  safeStorageSet(SESSION_KEY, JSON.stringify(parsedLegacy))
  safeStorageRemove(LEGACY_SESSION_KEY)
  return parsedLegacy
}

export function logout() {
  safeStorageRemove(SESSION_KEY)
  safeStorageRemove(LEGACY_SESSION_KEY)
}

export function getParticipants(dayFilter = null) {
  const ev = getActiveEvent()
  return getActiveParticipantsFromEvent(ev, dayFilter)
}

export function getParticipant(id) {
  const ev = getActiveEvent()
  return ev.participants.find(p => p.id === id) || null
}

export function addParticipant(data) {
  const ev = getActiveEvent()
  if (!Array.isArray(ev.participants)) ev.participants = []
  const tenant = getActiveTenantState()
  const clean = sanitizeParticipantInput(data, ev.currentDay || 1)
  const name = clean.name || 'Peserta'
  const dayCount = ev.participants.filter(p => p.day_number === clean.day_number).length
  const ticketId = buildTicketId(clean.day_number, dayCount + 1, tenant)
  const security = ensureParticipantSecurity({})
  const participant = {
    id: generateId(),
    ticket_id: ticketId,
    name,
    secure_code: security.secure_code,
    secure_ref: security.secure_ref,
    phone: clean.phone,
    email: clean.email,
    category: clean.category,
    day_number: clean.day_number,
    meta: clean.meta || {},
    qr_data: encodeQrPayload({
      ticketId,
      name,
      dayNumber: clean.day_number,
      tenantId: tenant.id,
      eventId: ev.id,
      secureCode: security.secure_code,
      secureRef: security.secure_ref
    }),
    is_checked_in: false,
    qr_locked: false,
    wa_sent_at: null,
    wa_send_mode: null,
    checked_in_at: null,
    checked_in_by: null,
    created_at: new Date().toISOString()
  }
  clearDeletedParticipantMark(participant.id)
  ev.participants.push(participant)

  // Skip save/sync during bulk import to avoid N saves for N participants.
  // bulkAddParticipants will do a single save at the end.
  if (!data._skipSave) {
    saveStore()
    void syncEventSnapshot({ tenantId: tenant.id, event: ev })
    void syncParticipantUpsert({ tenantId: tenant.id, eventId: ev.id, participant })
  }


  logAdminAction('participant_add', `Tambah peserta ${participant.name} (${participant.ticket_id})`, data.actor, {
    participant_id: participant.id,
    day_number: participant.day_number,
    category: participant.category
  })

  if (data.auto_send && (participant.phone || participant.email)) {
    const template = getWaTemplate()
    const waSendMode = getWaSendMode()
    const wa_message = template
      .replace(/\{\{nama\}\}/g, participant.name || '')
      .replace(/\{\{tiket\}\}/g, participant.ticket_id || '')
      .replace(/\{\{hari\}\}/g, participant.day_number || '')
      .replace(/\{\{kategori\}\}/g, participant.category || '')

    apiFetch('/api/send-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...participant,
        tenant_id: tenant.id,
        send_wa: !!participant.phone,
        send_email: !!participant.email,
        wa_message,
        wa_send_mode: waSendMode
      })
    })
      .then(async (res) => {
        const payload = await res.json().catch(() => ({}))
        if (!res.ok || payload?.success === false) return
        const latest = getParticipant(participant.id)
        if (latest) {
          const sentWithBarcode = waSendMode !== WA_SEND_MODE_MESSAGE_ONLY
          latest.qr_locked = sentWithBarcode
          latest.wa_sent_at = sentWithBarcode ? new Date().toISOString() : latest.wa_sent_at
          latest.wa_send_mode = waSendMode
          saveStore()
          void syncParticipantUpsert({ tenantId: tenant.id, eventId: ev.id, participant: latest })
        }
      })
      .catch(e => console.error('Bot Server Offline:', e))
  }

  return participant
}

export function regenerateSecureQRTokens(dayFilter = null, actor = 'system') {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const targets = dayFilter
    ? ev.participants.filter(p => p.day_number === dayFilter)
    : ev.participants

  let updated = 0

  targets.forEach(participant => {
    if (isParticipantTicketLocked(participant)) return
    const security = ensureParticipantSecurity(participant)
    const expectedSig = buildQrSignature({
      tenantId: tenant.id,
      eventId: ev.id,
      ticketId: participant.ticket_id,
      dayNumber: participant.day_number,
      secureCode: security.secure_code,
      secureRef: security.secure_ref
    })

    let parsed = null
    try {
      parsed = JSON.parse(String(participant.qr_data || ''))
    } catch {
      parsed = null
    }

    const alreadySecure =
      parsed?.v === 3 &&
      parsed?.r === security.secure_ref &&
      parsed?.sig === expectedSig

    if (alreadySecure) return

    participant.secure_code = security.secure_code
    participant.secure_ref = security.secure_ref
    participant.qr_data = encodeQrPayload({
      ticketId: participant.ticket_id,
      name: participant.name,
      dayNumber: participant.day_number,
      tenantId: tenant.id,
      eventId: ev.id,
      secureCode: participant.secure_code,
      secureRef: participant.secure_ref
    })

    updated += 1
    void syncParticipantUpsert({ tenantId: tenant.id, eventId: ev.id, participant })
  })

  if (updated > 0) {
    saveStore()
    logAdminAction(
      'participant_qr_secure_regenerate',
      `Regenerate QR aman ${updated} peserta`,
      actor,
      { day_number: dayFilter || null, total_target: targets.length, updated }
    )
  }

  return {
    success: true,
    updated,
    total: targets.length,
    skipped: Math.max(0, targets.length - updated)
  }
}

export function deleteParticipant(id, actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const participant = ev.participants.find(p => p.id === id)
  ev.participants = ev.participants.filter(p => p.id !== id)
  if (participant?.id) {
    markParticipantDeleted(participant.id)
    if (!ev.deletedParticipantIds || typeof ev.deletedParticipantIds !== 'object') {
      ev.deletedParticipantIds = {}
    }
    ev.deletedParticipantIds[participant.id] = new Date().toISOString()
  }
  saveStore()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })

  if (participant) {
    void syncParticipantDelete({ tenantId: tenant.id, eventId: ev.id, participantId: participant.id })
  }

  if (participant) {
    const cleanReason = normalizeReason(reason)
    const description = cleanReason
      ? `Hapus peserta ${participant.name} (${participant.ticket_id}) | Alasan: ${cleanReason}`
      : `Hapus peserta ${participant.name} (${participant.ticket_id})`

    logAdminAction('participant_delete', description, actor, {
      participant_id: participant.id,
      day_number: participant.day_number,
      reason: cleanReason || null
    })
  }

  if (participant) {
    notifyListeners({ type: 'participant_delete', participant })
  }

  return { success: true }
}

export function updateParticipant(id, actor = 'system', patch = {}, reason = '') {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const participant = ev.participants.find(p => p.id === id)
  if (!participant) return { success: false, error: 'Peserta tidak ditemukan' }
  // Keep barcode immutable after ticket was sent to participant.
  if (isParticipantTicketLocked(participant)) {
    const nextName = patch?.name !== undefined ? normalizeParticipantName(patch?.name) : participant.name
    const nextDay = patch?.day_number !== undefined
      ? normalizeParticipantDay(patch?.day_number, participant.day_number)
      : participant.day_number
    if (nextName !== participant.name || nextDay !== participant.day_number) {
      return { success: false, error: 'Tiket sudah terkirim. Nama/Hari tidak bisa diubah agar QR tetap sama.' }
    }
  }

  if (participant?.id && ev?.deletedParticipantIds?.[participant.id]) {
    delete ev.deletedParticipantIds[participant.id]
  }

  // Do not allow dangerous day changes after check-in (keeps audit/verification consistent).
  if (participant.is_checked_in && patch?.day_number !== undefined && patch.day_number !== participant.day_number) {
    return { success: false, error: 'Peserta sudah check-in. Hari tidak bisa diubah.' }
  }

  const safeName = patch?.name !== undefined ? normalizeParticipantName(patch?.name) : participant.name
  const safePhone = patch?.phone !== undefined ? normalizeParticipantPhone(patch?.phone) : participant.phone
  const safeEmail = patch?.email !== undefined ? normalizeParticipantEmail(patch?.email) : participant.email
  const safeCategory = patch?.category !== undefined ? normalizeParticipantCategory(patch?.category) : participant.category
  const safeDayNumber = patch?.day_number !== undefined
    ? normalizeParticipantDay(patch?.day_number, participant.day_number)
    : participant.day_number

  let safeMeta = participant.meta || {}
  if (patch?.meta && typeof patch.meta === 'object') {
    safeMeta = {}
    Object.entries(patch.meta).forEach(([k, v]) => {
      const key = String(k || '').trim()
      if (!key) return
      const value = v === undefined || v === null ? '' : String(v).trim()
      if (!value) return
      safeMeta[key] = value
    })
  }

  participant.name = safeName || participant.name
  participant.phone = safePhone
  participant.email = safeEmail
  participant.category = safeCategory
  participant.day_number = safeDayNumber
  participant.meta = safeMeta

  if (!isParticipantTicketLocked(participant)) {
    // Regenerate QR payload only while ticket is not locked/sent yet.
    participant.qr_data = encodeQrPayload({
      ticketId: participant.ticket_id,
      name: participant.name,
      dayNumber: participant.day_number,
      tenantId: tenant.id,
      eventId: ev.id,
      secureCode: participant.secure_code,
      secureRef: participant.secure_ref
    })
  }

  saveStore()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  void syncParticipantUpsert({ tenantId: tenant.id, eventId: ev.id, participant })

  const cleanReason = normalizeReason(reason)
  const description = cleanReason
    ? `Ubah peserta ${participant.name} (${participant.ticket_id}) | Alasan: ${cleanReason}`
    : `Ubah peserta ${participant.name} (${participant.ticket_id})`
  logAdminAction('participant_update', description, actor, {
    participant_id: participant.id,
    day_number: participant.day_number
  })

  return { success: true, participant }
}

export function manualCheckIn(participantId, scannedBy = 'gate_front') {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const participant = getActiveParticipantsFromEvent(ev).find((p) => p.id === participantId)
  if (!participant) {
    return { success: false, status: 'invalid', message: 'Peserta tidak ditemukan' }
  }

  if (participant.day_number !== ev.currentDay) {
    return {
      success: false,
      status: 'wrong_day',
      message: `Tiket untuk Hari ${participant.day_number}, sekarang Hari ${ev.currentDay}`,
      participant,
      security: buildSecurityMeta(participant)
    }
  }

  if (participant.is_checked_in) {
    const checkedTime = new Date(participant.checked_in_at).toLocaleTimeString('id-ID')
    return {
      success: false,
      status: 'duplicate',
      message: `Sudah check-in pukul ${checkedTime}`,
      participant,
      security: buildSecurityMeta(participant)
    }
  }

  participant.is_checked_in = true
  participant.checked_in_at = new Date().toISOString()
  participant.checked_in_by = scannedBy

  const log = {
    id: generateId(),
    participant_id: participant.id,
    participant_name: participant.name,
    participant_category: participant.category,
    ticket_id: participant.ticket_id,
    participant_ticket: participant.ticket_id,
    scanned_by: scannedBy,
    action: 'check_in',
    timestamp: new Date().toISOString()
  }
  ev.checkInLogs.push(log)
  saveStore()
  void syncParticipantUpsert({ tenantId: tenant.id, eventId: ev.id, participant })
  void syncCheckInLog({ tenantId: tenant.id, eventId: ev.id, log })

  notifyListeners({ type: 'check_in', participant, log })

  return {
    success: true,
    status: 'valid',
    message: 'Manual check-in berhasil!',
    participant,
    security: buildSecurityMeta(participant)
  }
}

function normalizeImportKey(key) {
  return String(key || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
}

function readImportField(row, aliases = []) {
  if (!row || typeof row !== 'object') return ''
  const map = new Map()
  Object.entries(row).forEach(([k, v]) => {
    map.set(normalizeImportKey(k), v)
  })
  for (const alias of aliases) {
    const value = map.get(normalizeImportKey(alias))
    if (value === undefined || value === null) continue
    const text = String(value).trim()
    if (text) return text
  }
  return ''
}

/** Header Excel bervariasi; cocokkan nama kolom fleksibel (undangan, tamu, dll.). */
function readImportName(row) {
  const direct = readImportField(row, [
    'name', 'nama', 'nama_peserta', 'nama_lengkap', 'participant_name', 'peserta', 'full_name',
    'nama_tamu', 'nama_undangan', 'nama_pengunjung', 'nama_delegasi', 'guest_name', 'visitor_name',
    'guest', 'visitor', 'delegasi', 'undangan'
  ])
  if (direct) return direct
  const keyHints = ['nama', 'name', 'peserta', 'participant', 'tamu', 'undangan', 'guest', 'visitor', 'delegasi', 'pengunjung', 'lengkap', 'fullname']
  for (const [k, v] of Object.entries(row || {})) {
    if (String(k).startsWith('__')) continue
    const nk = normalizeImportKey(k)
    if (!nk) continue
    if (keyHints.some((h) => nk === h || nk.includes(h))) {
      const text = String(v ?? '').trim()
      if (text) return text
    }
  }
  const skipKeys = new Set([
    'kategori', 'category', 'type', 'jenis', 'hari', 'day', 'day_number', 'email', 'mail',
    'telepon', 'telpon', 'phone', 'hp', 'wa', 'whatsapp', 'telp', 'mobile', 'nomor', 'status',
    'tiket', 'ticket', 'id', 'nomor_tiket'
  ])
  for (const [k, v] of Object.entries(row || {})) {
    if (String(k).startsWith('__')) continue
    const nk = normalizeImportKey(k)
    if (skipKeys.has(nk)) continue
    if ([...skipKeys].some((s) => nk.startsWith(`${s}_`))) continue
    if (rowKeyLooksLikePhoneColumn(nk)) continue
    const text = String(v ?? '').trim()
    if (text.length < 2) continue
    if (/^\d+([.,]\d+)?$/.test(text.replace(/\s/g, ''))) continue
    if (/[a-zA-Z\u0080-\uFFFF]/.test(text)) return text
  }
  return ''
}

function rowKeyLooksLikePhoneColumn(nk) {
  if (!nk) return false
  if (nk.includes('nama')) return false
  if (nk.includes('email')) return false
  if (nk.includes('kategori') || nk === 'category' || nk.includes('hari') || nk.includes('tiket')) return false
  return (
    nk.includes('tel') ||
    nk.includes('phone') ||
    nk.includes('hp') ||
    nk.includes('wa') ||
    nk.includes('whatsapp') ||
    nk.includes('ponsel') ||
    nk.includes('mobile') ||
    (nk.includes('nomor') && (nk.includes('hp') || nk.includes('wa') || nk.includes('tel') || nk.includes('pon')))
  )
}

/** Header telepon di file user sering beda; deteksi kolom + normalisasi. */
function readImportPhone(row) {
  const raw = readImportField(row, [
    'phone', 'telepon', 'telpon', 'hp', 'no_hp', 'nomor_hp', 'nomor_wa', 'whatsapp', 'wa', 'mobile', 'telp',
    'no_telp', 'notelp', 'nomor_telepon', 'nomor_handphone', 'phonenumber', 'phone_number', 'wa_number',
    'no_wa', 'nowa', 'nohp', 'no_hp_1', 'no_hp_2'
  ])
  if (raw) return normalizeParticipantPhone(raw)
  for (const [k, v] of Object.entries(row || {})) {
    if (String(k).startsWith('__')) continue
    const nk = normalizeImportKey(k)
    if (!rowKeyLooksLikePhoneColumn(nk)) continue
    const text = String(v ?? '').trim()
    if (text) return normalizeParticipantPhone(text)
  }
  return ''
}

export function bulkAddParticipants(rows, dayNumber, actor = 'system', options = {}) {
  const added = []
  const updated = []
  const skipped = []
  const errors = []

  const duplicatesPolicy = String(options?.duplicatesPolicy || 'add').toLowerCase() // add|skip|overwrite|block
  const matchBy = String(options?.matchBy || 'phone').toLowerCase() // saat ini: phone

  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const fallbackDay = normalizeParticipantDay(dayNumber, 1)

  rows.forEach((row, index) => {
    let name
    let phone
    let email
    let matchedCat
    let rowDay
    let extras
    try {
      name = readImportName(row)
      phone = readImportPhone(row)
      const emailRaw = readImportField(row, [
        'email', 'email_address', 'mail', 'e_mail'
      ])
      email = normalizeParticipantEmail(emailRaw)
      const category = readImportField(row, [
        'category', 'kategori', 'jenis_tiket', 'ticket_category', 'type'
      ]) || 'Regular'
      matchedCat = normalizeParticipantCategory(category)
      const rawDay = (
        readImportField(row, ['day_number', 'day', 'hari', 'ticket_day', 'day_no', 'event_day'])
        || row.day_number
        || row.day
        || row.hari
      )
      const parsedDay = parseParticipantDayValue(rawDay)
      rowDay = normalizeParticipantDay(parsedDay, fallbackDay)
      extras = extractParticipantExtras(row)
    } catch (e) {
      errors.push({ row: index + 1, error: e?.message || 'Gagal membaca baris' })
      return
    }

    if (!name) {
      errors.push({ row: index + 1, error: 'Nama kosong' })
      return
    }

    // Duplicate detection: same day + same phone (WA)
    const activeParticipants = getActiveParticipantsFromEvent(ev)
    const existing =
      matchBy === 'phone' && phone
        ? activeParticipants.find(p => p.day_number === rowDay && normalizeParticipantPhone(p.phone) === phone) || null
        : null

    if (existing) {
      // If user chooses to prevent duplicates, handle here.
      if (duplicatesPolicy === 'skip' || duplicatesPolicy === 'skipped') {
        skipped.push(existing.id)
        return
      }
      if (duplicatesPolicy === 'block') {
        errors.push({ row: index + 1, error: `Duplikat ditemukan (telepon: ${phone}). Baris dibatalkan.` })
        return
      }
      if (duplicatesPolicy === 'add') {
        // "add" means keep old behavior: still add new participant.
        // Note: ticket_id will be different, so it's technically not a duplicate in this system.
      } else if (duplicatesPolicy !== 'overwrite') {
        // Unknown policy: fallback to overwrite for safety.
      }

      if (duplicatesPolicy === 'overwrite' && existing) {
        if (existing.is_checked_in) {
          errors.push({ row: index + 1, error: `Duplikat ditemukan tapi peserta sudah check-in. Baris dilewati.` })
          return
        }
        if (isParticipantTicketLocked(existing)) {
          errors.push({ row: index + 1, error: `Duplikat ditemukan tapi tiket sudah terkirim. Baris dilewati agar QR tidak berubah.` })
          return
        }

        existing.name = name
        existing.phone = phone
        existing.email = email
        existing.category = matchedCat
        existing.day_number = rowDay
        existing.meta = { ...(existing.meta || {}), ...extras }

        // Regenerate QR payload to reflect updated name/day.
        existing.qr_data = encodeQrPayload({
          ticketId: existing.ticket_id,
          name: existing.name,
          dayNumber: existing.day_number,
          tenantId: tenant.id,
          eventId: ev.id,
          secureCode: existing.secure_code,
          secureRef: existing.secure_ref
        })

        saveStore()
        void syncEventSnapshot({ tenantId: tenant.id, event: ev })
        updated.push(existing)
        return
      }
    }

    // Default: create a new participant (existing behavior)
    let participant
    try {
      participant = addParticipant({
        name,
        phone,
        email,
        category: matchedCat,
        day_number: rowDay,
        meta: extras,
        actor,
        auto_send: false,
        _skipSave: true
      })
    } catch (e) {
      errors.push({ row: index + 1, error: e?.message || 'Gagal menyimpan peserta' })
      return
    }
    added.push(participant)
  })

  let syncPromise = null
  if (added.length + updated.length > 0) {
    saveStore()
    syncPromise = syncEventSnapshot({ tenantId: tenant.id, event: ev })
  }

  return { added, updated, skipped, errors, total: rows.length, syncPromise }
}

export function markParticipantTicketSent(participantId, waSendMode = 'message_with_barcode') {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const participant = ev.participants.find((p) => p.id === participantId)
  if (!participant) return { success: false, error: 'Peserta tidak ditemukan' }

  const safeWaSendMode = String(waSendMode || '').trim() || 'message_with_barcode'
  const sentWithBarcode = safeWaSendMode !== WA_SEND_MODE_MESSAGE_ONLY
  participant.qr_locked = sentWithBarcode
  participant.wa_sent_at = sentWithBarcode ? new Date().toISOString() : (participant.wa_sent_at || null)
  participant.wa_send_mode = safeWaSendMode
  saveStore()
  void syncParticipantUpsert({ tenantId: tenant.id, eventId: ev.id, participant })
  return { success: true, participant }
}

export function searchParticipants(query, dayFilter = null) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const ev = getActiveEvent()
  const list = getActiveParticipantsFromEvent(ev, dayFilter)
  return list.filter(p => String(p.name || '').toLowerCase().includes(q) || String(p.ticket_id || '').toLowerCase().includes(q))
}

function parseScanPayload(rawInput) {
  const raw = String(rawInput || '').trim()
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    // try legacy key-value format below
  }

  const legacy = {}
  raw.split(';').forEach((pair) => {
    const [k, ...rest] = pair.split(':')
    if (!k || rest.length === 0) return
    legacy[k.trim()] = rest.join(':').trim()
  })
  if (Object.keys(legacy).length > 0) return legacy

  return { tid: raw }
}

export function checkIn(qrData, scannedBy = 'gate_front') {
  const ev = getActiveEvent()
  const activeTenant = getActiveTenantState()
  const parsed = parseScanPayload(qrData)
  if (!parsed) {
    return { success: false, status: 'invalid', message: 'QR Code tidak valid' }
  }

  const rawQr = String(qrData || '').trim()
  const parsedTicketId = String(parsed?.tid || '').trim()
  const parsedSecureRef = String(parsed?.r || '').trim()

  // Prefer exact QR match first, then secure_ref match, then ticket_id fallback.
  // This prevents false mismatch when ticket_id collides or participants are recreated.
  const activeParticipants = getActiveParticipantsFromEvent(ev)
  const participant = activeParticipants.find(p => String(p.qr_data || '').trim() === rawQr)
    || activeParticipants.find(p => p.ticket_id === parsedTicketId && (!parsedSecureRef || String(p.secure_ref || '').trim() === parsedSecureRef))
    || activeParticipants.find(p => p.ticket_id === parsedTicketId)
  if (!participant) {
    return { success: false, status: 'invalid', message: 'Peserta tidak ditemukan' }
  }

  if (parsed.t && parsed.t !== activeTenant.id) {
    return {
      success: false,
      status: 'wrong_tenant',
      message: 'Barcode ini milik brand lain'
    }
  }

  if (parsed.e && parsed.e !== ev.id) {
    return {
      success: false,
      status: 'wrong_event',
      message: 'Barcode ini milik event lain'
    }
  }

  if (parsed.sig) {
    const hasSecureFields = !!participant.secure_code && !!participant.secure_ref
    const legacySig = btoa(`${activeTenant.id}|${ev.id}|${participant.ticket_id}|${participant.day_number}|event-2026`)

    if (hasSecureFields) {
      if (!parsed.r || parsed.r !== participant.secure_ref) {
        if (parsed.sig === legacySig) {
          // Compat mode for older tickets generated before secure token rollout.
          // Keep scan operational while migration is still in progress.
          // eslint-disable-next-line no-console
          console.warn('[SCAN COMPAT] legacy signature accepted for secure participant', participant.ticket_id)
        } else {
          return {
            success: false,
            status: 'invalid',
            message: 'Token barcode tidak cocok',
            participant,
            security: buildSecurityMeta(participant)
          }
        }
      } else {
        const secureSignature = buildQrSignature({
          tenantId: activeTenant.id,
          eventId: ev.id,
          ticketId: participant.ticket_id,
          dayNumber: participant.day_number,
          secureCode: participant.secure_code,
          secureRef: participant.secure_ref
        })

        if (parsed.sig !== secureSignature && parsed.sig !== legacySig) {
          return {
            success: false,
            status: 'invalid',
            message: 'Signature barcode tidak valid',
            participant,
            security: buildSecurityMeta(participant)
          }
        }
      }
    } else if (parsed.sig !== legacySig) {
      return {
        success: false,
        status: 'invalid',
        message: 'Signature barcode tidak valid',
        participant,
        security: buildSecurityMeta(participant)
      }
    }
  }

  if (participant.day_number !== ev.currentDay) {
    return {
      success: false,
      status: 'wrong_day',
      message: `Tiket untuk Hari ${participant.day_number}, sekarang Hari ${ev.currentDay}`,
      participant,
      security: buildSecurityMeta(participant)
    }
  }

  if (participant.is_checked_in) {
    const checkedTime = new Date(participant.checked_in_at).toLocaleTimeString('id-ID')
    return {
      success: false,
      status: 'duplicate',
      message: `Sudah check-in pukul ${checkedTime}`,
      participant,
      security: buildSecurityMeta(participant)
    }
  }

  participant.is_checked_in = true
  participant.checked_in_at = new Date().toISOString()
  participant.checked_in_by = scannedBy

  const log = {
    id: generateId(),
    participant_id: participant.id,
    participant_name: participant.name,
    participant_category: participant.category,
    ticket_id: participant.ticket_id,
    participant_ticket: participant.ticket_id,
    scanned_by: scannedBy,
    action: 'check_in',
    timestamp: new Date().toISOString()
  }
  ev.checkInLogs.push(log)
  saveStore()
  void syncParticipantUpsert({ tenantId: activeTenant.id, eventId: ev.id, participant })
  void syncCheckInLog({ tenantId: activeTenant.id, eventId: ev.id, log })

  notifyListeners({ type: 'check_in', participant, log })

  return {
    success: true,
    status: 'valid',
    message: 'Check-in berhasil!',
    participant,
    security: buildSecurityMeta(participant)
  }
}

export function getStats(day = null) {
  const ev = getActiveEvent()
  const participants = getActiveParticipantsFromEvent(ev, day)
  const total = participants.length
  const checkedIn = participants.filter(p => p.is_checked_in).length
  const notCheckedIn = total - checkedIn
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0

  const byCategory = {}
  participants.forEach(p => {
    if (!byCategory[p.category]) byCategory[p.category] = { total: 0, checkedIn: 0 }
    byCategory[p.category].total++
    if (p.is_checked_in) byCategory[p.category].checkedIn++
  })

  return { total, checkedIn, notCheckedIn, percentage, byCategory }
}

export function getCheckInLogs(day = null) {
  const ev = getActiveEvent()
  const activeParticipants = getActiveParticipantsFromEvent(ev)
  const activeById = new Map(activeParticipants.map((p) => [p.id, p]))

  if (day) {
    return ev.checkInLogs
      .filter(log => {
        const participant = activeById.get(log.participant_id)
        if (participant) return participant.day_number === day
        const fallbackDay = Number(log?.day_number)
        return Number.isInteger(fallbackDay) && fallbackDay === Number(day)
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }
  return ev.checkInLogs
    .filter((log) => activeById.has(log.participant_id))
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

export function getPendingCheckIns() {
  const ev = getActiveEvent()
  return [...ev.pendingCheckIns].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export function getOfflineQueueHistory(limit = 500) {
  const ev = getActiveEvent()
  const sorted = [...ev.offlineQueueHistory].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  return sorted.slice(0, limit)
}

function pushOfflineQueueHistory(type, payload = {}) {
  const ev = getActiveEvent()
  ev.offlineQueueHistory.push({
    id: generateId(),
    type,
    payload,
    timestamp: new Date().toISOString()
  })
}

export function enqueuePendingCheckIn(qrData, scannedBy = 'gate_front', source = 'scanner') {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const item = {
    id: generateId(),
    qr_data: qrData,
    scanned_by: scannedBy,
    source,
    attempts: 0,
    last_error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  ev.pendingCheckIns.push(item)
  pushOfflineQueueHistory('enqueued', {
    queue_id: item.id,
    scanned_by: scannedBy,
    source
  })
  saveStore()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  return item
}

export function syncPendingCheckIns(maxItems = 100) {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const maxPendingAttempts = getMaxPendingAttempts()
  const queue = getPendingCheckIns().slice(0, maxItems)
  let synced = 0
  let failed = 0
  let purged = 0
  const failedItems = []

  queue.forEach(item => {
    const res = checkIn(item.qr_data, item.scanned_by)
    if (res.success || res.status === 'duplicate') {
      synced++
      ev.pendingCheckIns = ev.pendingCheckIns.filter(q => q.id !== item.id)
      pushOfflineQueueHistory('sync_success', {
        queue_id: item.id,
        status: res.status || 'valid',
        scanned_by: item.scanned_by
      })
    } else {
      failed++
      failedItems.push({ id: item.id, status: res.status, message: res.message })
      let nextAttempts = item.attempts || 0
      ev.pendingCheckIns = ev.pendingCheckIns.map(q => {
        if (q.id !== item.id) return q
        nextAttempts = (q.attempts || 0) + 1
        return {
          ...q,
          attempts: nextAttempts,
          last_error: res.message || 'Gagal sinkronisasi',
          updated_at: new Date().toISOString()
        }
      })

      pushOfflineQueueHistory('sync_failed', {
        queue_id: item.id,
        status: res.status || 'failed',
        message: res.message || 'Gagal sinkronisasi',
        attempts: nextAttempts
      })

      if (nextAttempts >= maxPendingAttempts) {
        purged++
        ev.pendingCheckIns = ev.pendingCheckIns.filter(q => q.id !== item.id)
        pushOfflineQueueHistory('purged_max_attempts', {
          queue_id: item.id,
          attempts: nextAttempts,
          reason: 'Melebihi batas retry otomatis'
        })
      }
    }
  })

  if (queue.length > 0) {
    saveStore()
    void syncEventSnapshot({ tenantId: tenant.id, event: ev })
    logAdminAction(
      'offline_sync',
      `Sinkronisasi offline queue: ${synced} berhasil, ${failed} gagal, ${purged} purge`,
      'system',
      { synced, failed, purged, processed: queue.length }
    )
  }

  return {
    processed: queue.length,
    synced,
    failed,
    purged,
    remaining: ev.pendingCheckIns.length,
    failedItems
  }
}

export function retryPendingCheckIn(itemId) {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const maxPendingAttempts = getMaxPendingAttempts()
  const item = ev.pendingCheckIns.find(q => q.id === itemId)
  if (!item) return { success: false, error: 'Item antrean tidak ditemukan' }

  const res = checkIn(item.qr_data, item.scanned_by)
  if (res.success || res.status === 'duplicate') {
    ev.pendingCheckIns = ev.pendingCheckIns.filter(q => q.id !== itemId)
    pushOfflineQueueHistory('retry_success', { queue_id: itemId, status: res.status || 'valid' })
    saveStore()
    void syncEventSnapshot({ tenantId: tenant.id, event: ev })
    return { success: true, synced: true, result: res, remaining: ev.pendingCheckIns.length }
  }

  let nextAttempts = item.attempts || 0
  ev.pendingCheckIns = ev.pendingCheckIns.map(q => {
    if (q.id !== itemId) return q
    nextAttempts = (q.attempts || 0) + 1
    return {
      ...q,
      attempts: nextAttempts,
      last_error: res.message || 'Gagal sinkronisasi',
      updated_at: new Date().toISOString()
    }
  })

  pushOfflineQueueHistory('retry_failed', {
    queue_id: itemId,
    status: res.status || 'failed',
    message: res.message || 'Gagal sinkronisasi',
    attempts: nextAttempts
  })

  if (nextAttempts >= maxPendingAttempts) {
    ev.pendingCheckIns = ev.pendingCheckIns.filter(q => q.id !== itemId)
    pushOfflineQueueHistory('purged_max_attempts', {
      queue_id: itemId,
      attempts: nextAttempts,
      reason: 'Melebihi batas retry manual'
    })
  }

  saveStore()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  return { success: false, synced: false, result: res, remaining: ev.pendingCheckIns.length }
}

export function removePendingCheckIn(itemId) {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const before = ev.pendingCheckIns.length
  ev.pendingCheckIns = ev.pendingCheckIns.filter(q => q.id !== itemId)
  const removed = before !== ev.pendingCheckIns.length
  if (removed) {
    pushOfflineQueueHistory('removed_manual', { queue_id: itemId })
    saveStore()
    void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  }
  return { success: removed, remaining: ev.pendingCheckIns.length }
}

export function clearPendingCheckIns() {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const cleared = ev.pendingCheckIns.length
  ev.pendingCheckIns = []
  pushOfflineQueueHistory('cleared_all', { cleared })
  saveStore()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  if (cleared > 0) {
    logAdminAction('offline_queue_clear', `Membersihkan antrean offline (${cleared} item)`, 'system', { cleared })
  }
  return { success: true, cleared, remaining: 0 }
}

export function getAdminLogs(limit = 200) {
  const ev = getActiveEvent()
  const sorted = [...ev.adminLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  return sorted.slice(0, limit)
}

export function getCurrentDay() {
  return getActiveEvent().currentDay
}

export function getAvailableDays() {
  const ev = getActiveEvent()
  const uniqueDays = [...new Set(ev.participants.map(p => Number(p.day_number)).filter(day => Number.isInteger(day) && day > 0))]
  if (!uniqueDays.includes(ev.currentDay)) uniqueDays.push(ev.currentDay)
  return uniqueDays.sort((a, b) => a - b)
}

export function setCurrentDay(day, actor = 'system') {
  const ev = getActiveEvent()
  const previousDay = ev.currentDay
  const safeDay = Number(day)
  ev.currentDay = Number.isInteger(safeDay) && safeDay > 0 ? safeDay : 1
  saveStore()
  if (previousDay !== ev.currentDay) {
    const tenant = getActiveTenantState()
    void syncEventSnapshot({ tenantId: tenant.id, event: ev })
    logAdminAction('current_day_update', `Ubah hari aktif dari ${previousDay} ke ${ev.currentDay}`, actor, {
      from: previousDay,
      to: ev.currentDay
    })
  }
}

export function createNewDay(actor = 'system') {
  const ev = getActiveEvent()
  const days = getAvailableDays()
  const nextDay = (days.length > 0 ? Math.max(...days) : 0) + 1
  setCurrentDay(nextDay, actor)
  
  // Sync so it's not lost on re-fetch
  const tenant = getActiveTenantState()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  
  return nextDay
}

export function deleteCurrentDay(actor = 'system') {
  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const dayToDelete = ev.currentDay
  if (dayToDelete <= 1) return { success: false, error: 'Hari 1 tidak bisa dihapus' }
  
  // Collect participants for this day
  const participantsToDelete = ev.participants.filter(p => p.day_number === dayToDelete)
  
  // Delete from local array
  ev.participants = ev.participants.filter(p => p.day_number !== dayToDelete)
  
  // Sync deletions
  if (!ev.deletedParticipantIds || typeof ev.deletedParticipantIds !== 'object') {
    ev.deletedParticipantIds = {}
  }
  for (const p of participantsToDelete) {
    deletedParticipantTombstones[p.id] = Date.now()
    ev.deletedParticipantIds[p.id] = new Date().toISOString()
    void syncParticipantDelete({ tenantId: tenant.id, eventId: ev.id, participantId: p.id })
  }
  saveDeletedParticipantTombstones(deletedParticipantTombstones)
  
  // Revert to Day 1 locally
  ev.currentDay = 1
  saveStore()
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })
  
  logAdminAction('delete_day', `Hari ${dayToDelete} dihapus beserta ${participantsToDelete.length} peserta`, actor)
  return { success: true }
}

export function resetCheckIns(actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const totalBeforeReset = ev.participants.filter(p => p.is_checked_in).length
  ev.participants.forEach(p => {
    p.is_checked_in = false
    p.checked_in_at = null
    p.checked_in_by = null
    void syncParticipantUpsert({ tenantId: tenant.id, eventId: ev.id, participant: p })
  })
  ev.checkInLogs = []
  saveStore()
  void syncResetCheckInLogs({ tenantId: tenant.id, eventId: ev.id })
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })

  const cleanReason = normalizeReason(reason)
  const description = cleanReason
    ? `Reset status check-in (${totalBeforeReset} peserta) | Alasan: ${cleanReason}`
    : `Reset status check-in (${totalBeforeReset} peserta)`
  logAdminAction('checkin_reset', description, actor, { totalBeforeReset, reason: cleanReason || null })

  return { success: true }
}

export function deleteAllParticipants(actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const ev = getActiveEvent()
  const tenant = getActiveTenantState()
  const totalParticipants = ev.participants.length
  if (!ev.deletedParticipantIds || typeof ev.deletedParticipantIds !== 'object') {
    ev.deletedParticipantIds = {}
  }
  for (const participant of ev.participants) {
    if (!participant?.id) continue
    deletedParticipantTombstones[participant.id] = Date.now()
    ev.deletedParticipantIds[participant.id] = new Date().toISOString()
    void syncParticipantDelete({ tenantId: tenant.id, eventId: ev.id, participantId: participant.id })
  }
  saveDeletedParticipantTombstones(deletedParticipantTombstones)
  ev.participants = []
  ev.checkInLogs = []
  saveStore()
  void syncResetCheckInLogs({ tenantId: tenant.id, eventId: ev.id })
  void syncEventSnapshot({ tenantId: tenant.id, event: ev })

  const cleanReason = normalizeReason(reason)
  const description = cleanReason
    ? `Hapus semua peserta (${totalParticipants} data) | Alasan: ${cleanReason}`
    : `Hapus semua peserta (${totalParticipants} data)`
  logAdminAction('participants_delete_all', description, actor, { totalParticipants, reason: cleanReason || null })

  return { success: true }
}

export function getPeakHours(day = null) {
  const logs = day ? getCheckInLogs(day) : getCheckInLogs()
  const hourlyCount = {}

  for (let i = 7; i <= 17; i++) {
    const hour = `${i.toString().padStart(2, '0')}:00`
    hourlyCount[hour] = 0
  }

  logs.forEach(log => {
    if (log.action === 'check_in') {
      const date = new Date(log.timestamp)
      const hourStr = `${date.getHours().toString().padStart(2, '0')}:00`
      if (hourlyCount[hourStr] !== undefined) hourlyCount[hourStr]++
      else hourlyCount[hourStr] = 1
    }
  })

  return Object.keys(hourlyCount)
    .sort((a, b) => a.localeCompare(b))
    .map(time => ({ time, count: hourlyCount[time] }))
    .filter(item => {
      const h = parseInt(item.time.split(':')[0])
      return (h >= 7 && h <= 17) || item.count > 0
    })
}

export function simulateCheckIns(count = 5) {
  const ev = getActiveEvent()
  const unchecked = ev.participants.filter(p => !p.is_checked_in && p.day_number === ev.currentDay)
  const toCheck = unchecked.slice(0, Math.min(count, unchecked.length))

  toCheck.forEach((p, i) => {
    setTimeout(() => {
      checkIn(p.qr_data, 'gate_front')
    }, i * 800)
  })
}
