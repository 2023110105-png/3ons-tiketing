// Mock data store - simulates Supabase backend
// Replace with real Supabase client when ready

const generateId = () => crypto.randomUUID()
const MIN_HIGH_IMPACT_REASON_LENGTH = 15
const DEFAULT_MAX_PENDING_ATTEMPTS = 5
const DEFAULT_EVENT_ID = 'event-1'
const STORE_KEY = 'ons_event_data'
const LEGACY_STORE_KEY = 'yamaha_event_data'
const STORE_BACKUP_PREFIX = 'ons_event_data_backup_'
const MAX_STORE_BACKUPS = 3
const WA_TEMPLATE_KEY = 'ons_wa_template'
const LEGACY_WA_TEMPLATE_KEY = 'yamaha_wa_template'
const SESSION_KEY = 'ons_session'
const LEGACY_SESSION_KEY = 'yamaha_session'
const TENANT_REGISTRY_KEY = 'ons_tenant_registry'
const LEGACY_TENANT_REGISTRY_KEY = 'yamaha_tenant_registry'

const DEFAULT_TENANT_ID = 'tenant-default'
const DEFAULT_TENANT = {
  id: DEFAULT_TENANT_ID,
  brandName: '3oNs Project',
  eventName: 'Event Platform',
  status: 'active',
  expires_at: null,
  created_at: new Date().toISOString()
}

const categories = ['Regular', 'VIP', 'Dealer', 'Media']

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function safeStorageRemove(key) {
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
  return {
    id,
    brandName: String(raw?.brandName || raw?.name || 'Tenant').trim() || 'Tenant',
    eventName: String(raw?.eventName || 'Event Platform').trim() || 'Event Platform',
    status: raw?.status === 'inactive' ? 'inactive' : 'active',
    expires_at: raw?.expires_at || null,
    created_at: raw?.created_at || new Date().toISOString()
  }
}

function createDefaultTenantRegistry() {
  return {
    activeTenantId: DEFAULT_TENANT_ID,
    tenants: {
      [DEFAULT_TENANT_ID]: { ...DEFAULT_TENANT }
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
      normalizedTenants[DEFAULT_TENANT_ID] = { ...DEFAULT_TENANT }
    }

    const activeTenantId = normalizedTenants[parsed.activeTenantId] ? parsed.activeTenantId : DEFAULT_TENANT_ID
    return {
      activeTenantId,
      tenants: normalizedTenants
    }
  }

  return createDefaultTenantRegistry()
}

let tenantRegistry = getTenantRegistry()

function saveTenantRegistry() {
  safeStorageSet(TENANT_REGISTRY_KEY, JSON.stringify(tenantRegistry))
  safeStorageRemove(LEGACY_TENANT_REGISTRY_KEY)
}

function ensureActiveTenant() {
  if (!tenantRegistry.tenants[tenantRegistry.activeTenantId]) {
    tenantRegistry.activeTenantId = DEFAULT_TENANT_ID
    if (!tenantRegistry.tenants[DEFAULT_TENANT_ID]) {
      tenantRegistry.tenants[DEFAULT_TENANT_ID] = { ...DEFAULT_TENANT }
    }
    saveTenantRegistry()
  }
}

function getActiveTenantState() {
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
  const tenant = tenantRegistry.tenants[tenantId]
  if (!tenant) return { success: false, error: 'Tenant tidak ditemukan' }
  if (!canUseTenant(tenant)) return { success: false, error: 'Tenant tidak aktif atau sudah expired' }

  ensureTenantStore(tenant.id, tenant.eventName || 'Event 1', false)
  const previous = tenantRegistry.activeTenantId
  tenantRegistry.activeTenantId = tenant.id
  saveStore()
  saveTenantRegistry()
  dispatchTenantChangeEvent()

  if (previous !== tenant.id) {
    logAdminAction('tenant_switch', `Pindah tenant aktif ke ${tenant.brandName}`, actor, {
      from: previous,
      to: tenant.id
    })
  }

  return { success: true, tenant: { ...tenant } }
}

export function createTenant(data, actor = 'system') {
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
    created_at: new Date().toISOString()
  }

  tenantRegistry.tenants[tenant.id] = tenant
  ensureTenantStore(tenant.id, tenant.eventName || 'Event 1', false)
  saveStore()
  saveTenantRegistry()

  logAdminAction('tenant_create', `Membuat tenant ${brandName}`, actor, {
    tenant_id: tenant.id
  })

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
    ensureTenantStore(DEFAULT_TENANT_ID, '3oNs Project 2026', true)
  }

  saveStore()
  saveTenantRegistry()
  dispatchTenantChangeEvent()

  logAdminAction('tenant_status_update', `Ubah status tenant ${tenant.brandName} menjadi ${normalizedStatus}`, actor, {
    tenant_id: tenant.id,
    status: normalizedStatus
  })

  return { success: true }
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
    ensureTenantStore(DEFAULT_TENANT_ID, '3oNs Project 2026', true)
  }

  saveStore()
  saveTenantRegistry()
  dispatchTenantChangeEvent()

  logAdminAction('tenant_delete', `Hapus tenant ${tenant.brandName}`, actor, {
    tenant_id: tenant.id
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
  return String(value || '').trim()
}

function normalizeParticipantEmail(value) {
  const clean = String(value || '').trim().toLowerCase()
  return clean || null
}

function normalizeParticipantDay(value, fallback = 1) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeParticipantCategory(value) {
  const clean = String(value || '').trim()
  return categories.find(c => c.toLowerCase() === clean.toLowerCase()) || 'Regular'
}

function normalizeStoredParticipant(raw, index = 0) {
  const dayNumber = normalizeParticipantDay(raw?.day_number, 1)
  const ticketId = String(raw?.ticket_id || '').trim() || `YMH-D${dayNumber}-${String(index + 1).padStart(3, '0')}`
  const name = normalizeParticipantName(raw?.name) || 'Peserta'

  return {
    ...raw,
    id: raw?.id || generateId(),
    ticket_id: ticketId,
    name,
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
  return {
    name: normalizeParticipantName(data?.name),
    phone: normalizeParticipantPhone(data?.phone),
    email: normalizeParticipantEmail(data?.email),
    category: normalizeParticipantCategory(data?.category),
    day_number: normalizeParticipantDay(data?.day_number, fallbackDay)
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

function generateMockParticipants() {
  const namesDay1 = [
    'Ahmad Rizki', 'Budi Santoso', 'Citra Dewi', 'Dian Pratama', 'Eko Wahyudi',
    'Fitri Handayani', 'Gunawan Setiawan', 'Hana Puspita', 'Irfan Maulana', 'Joko Widodo',
    'Kartika Sari', 'Lukman Hakim', 'Maya Anggraini', 'Nur Hidayat', 'Oki Setiana',
    'Putri Rahayu', 'Qori Ramadhani', 'Rudi Hermawan', 'Siti Aminah', 'Tono Sucipto',
    'Umi Kalsum', 'Vina Panduwinata', 'Wahyu Nugroho', 'Xena Maharani', 'Yusuf Ibrahim',
    'Zahra Fadillah', 'Agus Prayitno', 'Bayu Aji', 'Cahya Utami', 'Deni Kurniawan',
    'Elsa Natalia', 'Fajar Sidik', 'Gita Pertiwi', 'Hendra Gunawan', 'Indah Permata',
    'Joni Iskandar', 'Kiki Amelia', 'Lina Marlina', 'Mulyadi Putra', 'Nanda Pratiwi',
    'Oscar Tanoto', 'Prayoga Ananta', 'Ratna Kumala', 'Surya Dharma', 'Tika Maharani',
    'Udin Samsudin', 'Vera Fransiska', 'Wawan Setiawan', 'Yoga Pratama', 'Zainal Abidin',
    'Andi Firman', 'Bella Safitri', 'Chandra Wijaya', 'Devi Anggraeni', 'Edwin Tan',
    'Farhan Akbar', 'Gina Lestari', 'Helmi Aziz', 'Ira Puspasari', 'Joni Lesmana'
  ]

  const namesDay2 = [
    'Adi Nugroho', 'Bambang Tri', 'Caca Handayani', 'Dodo Supriyadi', 'Endah Laras',
    'Faisal Rahman', 'Galih Prakoso', 'Helena Putri', 'Ibrahim Malik', 'Jessica Tan',
    'Kusnadi Surya', 'Lestari Dewi', 'Miftah Ulum', 'Niken Larasati', 'Omar Bakri',
    'Pandu Wibowo', 'Qistina Azzahra', 'Rangga Aditya', 'Siska Melani', 'Teguh Prasetyo',
    'Utari Kencana', 'Vito Pratama', 'Wulan Sari', 'Xander Malik', 'Yanti Susanti',
    'Zulfiqar Ali', 'Anisa Rahma', 'Brama Putra', 'Cindy Octavia', 'Danish Ibrahim',
    'Eva Nurdiana', 'Fahmi Hidayat', 'Gilang Ramadhan', 'Hesti Purnamasari', 'Iwan Fauzi',
    'Julia Permata', 'Kevin Anggara', 'Lita Wulandari', 'Mahesa Anom', 'Novita Sari',
    'Ogi Suryaman', 'Priska Tanaya', 'Rizky Aditama', 'Sandy Hermawan', 'Tirta Mandala',
    'Ulfa Maysaroh', 'Vicky Prasetya', 'Widi Astuti', 'Yolanda Safira', 'Zaki Mubaraq',
    'Arief Budiman', 'Bunga Citra', 'Cakra Buana', 'Dinda Ayu', 'Eri Susanto',
    'Fiona Angelica', 'Gery Mahesa', 'Hadi Wibowo', 'Intan Permata', 'Jaka Taruna',
    'Kartini Lestari', 'Latif Hakim', 'Mala Sari', 'Nabil Putra', 'Olivia Chen',
    'Putu Bagus', 'Ratih Kumala', 'Satria Agung', 'Tiara Dewi', 'Ucok Siregar',
    'Valencia Rose', 'Wisnu Wardana', 'Yogi Saputra', 'Zara Adelia', 'Anggit Prabowo',
    'Berliana Dewi', 'Cahyo Nugroho', 'Dewi Pertiwi', 'Erlangga Putra', 'Fransisca Lie',
    'Guntur Pamungkas', 'Hasna Ulfah', 'Iqbal Maulana', 'Jasmine Putri', 'Kenji Tanaka',
    'Lidya Agustin', 'Mulyo Hadi', 'Nayla Zahra', 'Oktavian Dwi', 'Patricia Gunawan',
    'Rio Ferdinan', 'Silvia Melinda', 'Taufik Ismail', 'Umar Said', 'Vinka Maharani'
  ]

  const participants = []

  namesDay1.forEach((name, i) => {
    const ticketId = `YMH-D1-${String(i + 1).padStart(3, '0')}`
    participants.push({
      id: generateId(),
      ticket_id: ticketId,
      name,
      phone: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      day_number: 1,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      qr_data: JSON.stringify({ tid: ticketId, n: name, d: 1, h: btoa(ticketId + '-3ons-2026') }),
      is_checked_in: false,
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString()
    })
  })

  namesDay2.forEach((name, i) => {
    const ticketId = `YMH-D2-${String(i + 1).padStart(3, '0')}`
    participants.push({
      id: generateId(),
      ticket_id: ticketId,
      name,
      phone: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      day_number: 2,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      qr_data: JSON.stringify({ tid: ticketId, n: name, d: 2, h: btoa(ticketId + '-3ons-2026') }),
      is_checked_in: false,
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString()
    })
  })

  return participants
}

function createEmptyEventState(name = '3oNs Project') {
  return {
    id: generateId(),
    name,
    isArchived: false,
    created_at: new Date().toISOString(),
    currentDay: 1,
    participants: [],
    checkInLogs: [],
    adminLogs: [],
    pendingCheckIns: [],
    offlineQueueHistory: [],
    offlineConfig: { maxPendingAttempts: DEFAULT_MAX_PENDING_ATTEMPTS },
    waTemplate: null
  }
}

function createDefaultStore() {
  const defaultEvent = createEmptyEventState('3oNs Project 2026')
  defaultEvent.id = DEFAULT_EVENT_ID
  defaultEvent.participants = generateMockParticipants()

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
    event.participants = generateMockParticipants()
  }

  return {
    activeEventId: event.id,
    events: {
      [event.id]: event
    }
  }
}

function normalizeSavedEvent(id, raw) {
  return {
    id,
    name: raw?.name || '3oNs Project',
    isArchived: !!raw?.isArchived,
    created_at: raw?.created_at || new Date().toISOString(),
    currentDay: Number.isInteger(raw?.currentDay) && raw.currentDay > 0 ? raw.currentDay : 1,
    participants: asArray(raw?.participants).map((p, i) => normalizeStoredParticipant(p, i)),
    checkInLogs: asArray(raw?.checkInLogs),
    adminLogs: asArray(raw?.adminLogs),
    pendingCheckIns: asArray(raw?.pendingCheckIns),
    offlineQueueHistory: asArray(raw?.offlineQueueHistory),
    offlineConfig: {
      maxPendingAttempts: Number.isInteger(raw?.offlineConfig?.maxPendingAttempts) && raw.offlineConfig.maxPendingAttempts >= 1
        ? raw.offlineConfig.maxPendingAttempts
        : DEFAULT_MAX_PENDING_ATTEMPTS
    },
    waTemplate: raw?.waTemplate || null
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
  const event = createEmptyEventState('3oNs Project 2026')
  event.id = DEFAULT_EVENT_ID
  event.currentDay = Number.isInteger(parsed?.currentDay) && parsed.currentDay > 0 ? parsed.currentDay : 1
  event.participants = asArray(parsed?.participants)
  if (event.participants.length === 0) {
    event.participants = generateMockParticipants()
  }
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
        normalizedTenants[DEFAULT_TENANT_ID] = createTenantStoreBucket('3oNs Project 2026', true)
      }

      return { tenants: normalizedTenants }
    }

    if (parsed?.events && typeof parsed.events === 'object') {
      return {
        tenants: {
          [DEFAULT_TENANT_ID]: normalizeTenantStoreBucket(parsed, '3oNs Project 2026')
        }
      }
    }

    return migrateLegacyStore(parsed)
  }
  return createDefaultStore()
}

let store = getStore()
let realtimeListeners = []

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
  const previous = safeStorageGet(STORE_KEY) || safeStorageGet(LEGACY_STORE_KEY)
  saveStoreBackupSnapshot(previous)
  safeStorageSet(STORE_KEY, JSON.stringify(store))
  safeStorageRemove(LEGACY_STORE_KEY)
}

function getActiveEvent() {
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(
    activeTenant.id,
    activeTenant.eventName || 'Event 1',
    activeTenant.id === DEFAULT_TENANT_ID
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
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID)

  return Object.values(bucket.events)
    .filter(e => includeArchived || !e.isArchived)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(e => ({ id: e.id, name: e.name, created_at: e.created_at, isArchived: !!e.isArchived }))
}

export function getCurrentEventId() {
  const activeTenant = getActiveTenantState()
  return ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID).activeEventId
}

export function getCurrentEventName() {
  return getActiveEvent()?.name || '-'
}

export function createEvent(name, actor = 'system') {
  const eventName = String(name || '').trim() || `Event ${getEvents().length + 1}`
  const event = createEmptyEventState(eventName)
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID)
  bucket.events[event.id] = event
  bucket.activeEventId = event.id
  saveStore()
  logAdminAction('event_create', `Membuat event baru: ${eventName}`, actor, { event_id: event.id })
  return { id: event.id, name: event.name }
}

export function renameEvent(eventId, newName, actor = 'system') {
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID)
  const event = bucket.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  const cleanName = String(newName || '').trim()
  if (!cleanName) return { success: false, error: 'Nama event tidak boleh kosong' }

  const prevName = event.name
  event.name = cleanName
  saveStore()

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
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID)
  const event = bucket.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  if (event.id === bucket.activeEventId) {
    return { success: false, error: 'Tidak bisa arsipkan event yang sedang aktif' }
  }

  event.isArchived = true
  saveStore()
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
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID)
  const event = bucket.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  if (event.id === bucket.activeEventId) {
    return { success: false, error: 'Tidak bisa hapus event yang sedang aktif' }
  }

  delete bucket.events[eventId]
  saveStore()
  logAdminAction('event_delete', `Hapus event: ${event.name}`, actor, {
    event_id: eventId,
    reason: normalizeReason(reason)
  })
  return { success: true }
}

export function setCurrentEvent(eventId, actor = 'system') {
  const activeTenant = getActiveTenantState()
  const bucket = ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID)
  if (!bucket.events[eventId]) return false
  const prev = bucket.activeEventId
  bucket.activeEventId = eventId
  saveStore()
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
  return log
}

export const defaultWaTemplate = `🎫 *3oNs Project - E-Ticket*

Halo *{{nama}}*,
Berikut adalah tiket masuk acara Anda untuk *Hari ke-{{hari}}*.

📋 *Ticket ID:* {{tiket}}
📂 *Kategori:* {{kategori}}

Silakan tunjukkan gambar barcode tiket ini kepada petugas gerbang event. Terima kasih.`

export function getWaTemplate() {
  const ev = getActiveEvent()
  return ev.waTemplate || safeStorageGet(WA_TEMPLATE_KEY) || safeStorageGet(LEGACY_WA_TEMPLATE_KEY) || defaultWaTemplate
}

export function setWaTemplate(template, actor = 'system') {
  const ev = getActiveEvent()
  ev.waTemplate = template
  safeStorageSet(WA_TEMPLATE_KEY, template)
  safeStorageRemove(LEGACY_WA_TEMPLATE_KEY)
  saveStore()
  logAdminAction('wa_template_update', 'Template pesan WhatsApp diperbarui', actor)
}

export function getMaxPendingAttempts() {
  return getActiveEvent().offlineConfig?.maxPendingAttempts || DEFAULT_MAX_PENDING_ATTEMPTS
}

export function setMaxPendingAttempts(value, actor = 'system') {
  const parsed = Number(value)
  const safe = Number.isInteger(parsed) ? Math.min(20, Math.max(1, parsed)) : DEFAULT_MAX_PENDING_ATTEMPTS
  const ev = getActiveEvent()
  const previous = getMaxPendingAttempts()
  ev.offlineConfig = { ...(ev.offlineConfig || {}), maxPendingAttempts: safe }
  saveStore()
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
  owner: { username: 'owner', password: 'owner123', role: 'owner', name: 'Owner Platform' },
  admin: { username: 'admin', password: 'admin123', role: 'super_admin', name: 'Super Admin' },
  gate1: { username: 'gate1', password: 'gate123', role: 'gate_front', name: 'Panitia Depan' },
  gate2: { username: 'gate2', password: 'gate123', role: 'gate_back', name: 'Panitia Belakang' }
}

export function login(username, password) {
  const activeTenant = getActiveTenantState()
  if (!canUseTenant(activeTenant)) {
    return { success: false, error: 'Tenant aktif tidak bisa digunakan. Hubungi owner aplikasi.' }
  }

  const user = Object.values(USERS).find(u => u.username === username && u.password === password)
  if (user) {
    const session = {
      ...user,
      tenant: {
        id: activeTenant.id,
        brandName: activeTenant.brandName,
        eventName: activeTenant.eventName
      }
    }
    safeStorageSet(SESSION_KEY, JSON.stringify(session))
    safeStorageRemove(LEGACY_SESSION_KEY)
    return { success: true, user: session }
  }
  return { success: false, error: 'Username atau password salah' }
}

export function getSession() {
  const active = safeStorageGet(SESSION_KEY)
  const parsedActive = parseStoredJSON(active)
  if (parsedActive) {
    const activeTenant = getActiveTenantState()
    if (!canUseTenant(activeTenant)) {
      safeStorageRemove(SESSION_KEY)
      return null
    }

    ensureTenantStore(activeTenant.id, activeTenant.eventName || 'Event 1', activeTenant.id === DEFAULT_TENANT_ID)

    return {
      ...parsedActive,
      tenant: {
        id: activeTenant.id,
        brandName: activeTenant.brandName,
        eventName: activeTenant.eventName
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
  if (dayFilter) return ev.participants.filter(p => p.day_number === dayFilter)
  return ev.participants
}

export function getParticipant(id) {
  const ev = getActiveEvent()
  return ev.participants.find(p => p.id === id) || null
}

export function addParticipant(data) {
  const ev = getActiveEvent()
  const clean = sanitizeParticipantInput(data, ev.currentDay || 1)
  const name = clean.name || 'Peserta'
  const dayCount = ev.participants.filter(p => p.day_number === clean.day_number).length
  const ticketId = `YMH-D${clean.day_number}-${String(dayCount + 1).padStart(3, '0')}`
  const participant = {
    id: generateId(),
    ticket_id: ticketId,
    name,
    phone: clean.phone,
    email: clean.email,
    category: clean.category,
    day_number: clean.day_number,
    qr_data: JSON.stringify({ tid: ticketId, n: name, d: clean.day_number, h: btoa(ticketId + '-3ons-2026') }),
    is_checked_in: false,
    checked_in_at: null,
    checked_in_by: null,
    created_at: new Date().toISOString()
  }
  ev.participants.push(participant)
  saveStore()

  logAdminAction('participant_add', `Tambah peserta ${participant.name} (${participant.ticket_id})`, data.actor, {
    participant_id: participant.id,
    day_number: participant.day_number,
    category: participant.category
  })

  if (data.auto_send && (participant.phone || participant.email)) {
    const template = getWaTemplate()
    const wa_message = template
      .replace(/\{\{nama\}\}/g, participant.name || '')
      .replace(/\{\{tiket\}\}/g, participant.ticket_id || '')
      .replace(/\{\{hari\}\}/g, participant.day_number || '')
      .replace(/\{\{kategori\}\}/g, participant.category || '')

    fetch('http://localhost:3001/api/send-ticket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...participant,
        send_wa: !!participant.phone,
        send_email: !!participant.email,
        wa_message
      })
    }).catch(e => console.error('Bot Server Offline:', e))
  }

  return participant
}

export function deleteParticipant(id, actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const ev = getActiveEvent()
  const participant = ev.participants.find(p => p.id === id)
  ev.participants = ev.participants.filter(p => p.id !== id)
  saveStore()

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

  return { success: true }
}

export function manualCheckIn(participantId, scannedBy = 'gate_front') {
  const ev = getActiveEvent()
  const participant = ev.participants.find(p => p.id === participantId)
  if (!participant) {
    return { success: false, status: 'invalid', message: 'Peserta tidak ditemukan' }
  }

  if (participant.day_number !== ev.currentDay) {
    return {
      success: false,
      status: 'wrong_day',
      message: `Tiket untuk Hari ${participant.day_number}, sekarang Hari ${ev.currentDay}`,
      participant
    }
  }

  if (participant.is_checked_in) {
    const checkedTime = new Date(participant.checked_in_at).toLocaleTimeString('id-ID')
    return {
      success: false,
      status: 'duplicate',
      message: `Sudah check-in pukul ${checkedTime}`,
      participant
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
    participant_ticket: participant.ticket_id,
    scanned_by: scannedBy,
    action: 'check_in',
    timestamp: new Date().toISOString()
  }
  ev.checkInLogs.push(log)
  saveStore()

  notifyListeners({ type: 'check_in', participant, log })

  return { success: true, status: 'valid', message: 'Manual check-in berhasil!', participant }
}

export function bulkAddParticipants(rows, dayNumber, actor = 'system') {
  const added = []
  const errors = []

  rows.forEach((row, index) => {
    const name = String(row.name || row.nama || row.Name || row.Nama || '').trim()
    const phone = String(row.phone || row.telepon || row.Phone || row.Telepon || row.hp || row.HP || '').trim()
    const email = String(row.email || row.Email || row.email_address || '').trim()
    const category = String(row.category || row.kategori || row.Category || row.Kategori || 'Regular').trim()
    const parsedDay = Number(row.day_number || row.day || row.hari || row.Hari || row.Day || row.Day_Number)
    const rowDay = normalizeParticipantDay(parsedDay, normalizeParticipantDay(dayNumber, 1))

    if (!name) {
      errors.push({ row: index + 1, error: 'Nama kosong' })
      return
    }

    const matchedCat = normalizeParticipantCategory(category)

    const participant = addParticipant({
      name,
      phone,
      email,
      category: matchedCat,
      day_number: rowDay,
      actor,
      auto_send: false
    })
    added.push(participant)
  })

  return { added, errors, total: rows.length }
}

export function searchParticipants(query, dayFilter = null) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  const ev = getActiveEvent()
  const list = dayFilter ? ev.participants.filter(p => p.day_number === dayFilter) : ev.participants
  return list.filter(p => String(p.name || '').toLowerCase().includes(q) || String(p.ticket_id || '').toLowerCase().includes(q))
}

export function checkIn(qrData, scannedBy = 'gate_front') {
  const ev = getActiveEvent()
  let parsed
  try {
    parsed = JSON.parse(qrData)
  } catch {
    return { success: false, status: 'invalid', message: 'QR Code tidak valid' }
  }

  const participant = ev.participants.find(p => p.ticket_id === parsed.tid)
  if (!participant) {
    return { success: false, status: 'invalid', message: 'Peserta tidak ditemukan' }
  }

  if (participant.day_number !== ev.currentDay) {
    return {
      success: false,
      status: 'wrong_day',
      message: `Tiket untuk Hari ${participant.day_number}, sekarang Hari ${ev.currentDay}`,
      participant
    }
  }

  if (participant.is_checked_in) {
    const checkedTime = new Date(participant.checked_in_at).toLocaleTimeString('id-ID')
    return {
      success: false,
      status: 'duplicate',
      message: `Sudah check-in pukul ${checkedTime}`,
      participant
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
    participant_ticket: participant.ticket_id,
    scanned_by: scannedBy,
    action: 'check_in',
    timestamp: new Date().toISOString()
  }
  ev.checkInLogs.push(log)
  saveStore()

  notifyListeners({ type: 'check_in', participant, log })

  return { success: true, status: 'valid', message: 'Check-in berhasil!', participant }
}

export function getStats(day = null) {
  const ev = getActiveEvent()
  const participants = day ? ev.participants.filter(p => p.day_number === day) : ev.participants
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
  if (day) {
    return ev.checkInLogs
      .filter(log => {
        const p = ev.participants.find(pp => pp.id === log.participant_id)
        return p && p.day_number === day
      })
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }
  return [...ev.checkInLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
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
  return item
}

export function syncPendingCheckIns(maxItems = 100) {
  const ev = getActiveEvent()
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
  const maxPendingAttempts = getMaxPendingAttempts()
  const item = ev.pendingCheckIns.find(q => q.id === itemId)
  if (!item) return { success: false, error: 'Item antrean tidak ditemukan' }

  const res = checkIn(item.qr_data, item.scanned_by)
  if (res.success || res.status === 'duplicate') {
    ev.pendingCheckIns = ev.pendingCheckIns.filter(q => q.id !== itemId)
    pushOfflineQueueHistory('retry_success', { queue_id: itemId, status: res.status || 'valid' })
    saveStore()
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
  return { success: false, synced: false, result: res, remaining: ev.pendingCheckIns.length }
}

export function removePendingCheckIn(itemId) {
  const ev = getActiveEvent()
  const before = ev.pendingCheckIns.length
  ev.pendingCheckIns = ev.pendingCheckIns.filter(q => q.id !== itemId)
  const removed = before !== ev.pendingCheckIns.length
  if (removed) {
    pushOfflineQueueHistory('removed_manual', { queue_id: itemId })
    saveStore()
  }
  return { success: removed, remaining: ev.pendingCheckIns.length }
}

export function clearPendingCheckIns() {
  const ev = getActiveEvent()
  const cleared = ev.pendingCheckIns.length
  ev.pendingCheckIns = []
  pushOfflineQueueHistory('cleared_all', { cleared })
  saveStore()
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
    logAdminAction('current_day_update', `Ubah hari aktif dari ${previousDay} ke ${ev.currentDay}`, actor, {
      from: previousDay,
      to: ev.currentDay
    })
  }
}

export function resetCheckIns(actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return { success: false, error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter` }
  }

  const ev = getActiveEvent()
  const totalBeforeReset = ev.participants.filter(p => p.is_checked_in).length
  ev.participants.forEach(p => {
    p.is_checked_in = false
    p.checked_in_at = null
    p.checked_in_by = null
  })
  ev.checkInLogs = []
  saveStore()

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
  const totalParticipants = ev.participants.length
  ev.participants = []
  ev.checkInLogs = []
  saveStore()

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
