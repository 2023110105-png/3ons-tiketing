// Mock data store - simulates Supabase backend
// Replace with real Supabase client when ready

const generateId = () => crypto.randomUUID()
const MIN_HIGH_IMPACT_REASON_LENGTH = 15
const DEFAULT_MAX_PENDING_ATTEMPTS = 5
const DEFAULT_EVENT_ID = 'event-1'
const STORE_KEY = 'ons_event_data'
const LEGACY_STORE_KEY = 'yamaha_event_data'
const WA_TEMPLATE_KEY = 'ons_wa_template'
const LEGACY_WA_TEMPLATE_KEY = 'yamaha_wa_template'
const SESSION_KEY = 'ons_session'
const LEGACY_SESSION_KEY = 'yamaha_session'

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
    activeEventId: defaultEvent.id,
    events: {
      [defaultEvent.id]: defaultEvent
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
    participants: asArray(raw?.participants),
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
    activeEventId: event.id,
    events: {
      [event.id]: event
    }
  }
}

function getStore() {
  const saved = safeStorageGet(STORE_KEY) || safeStorageGet(LEGACY_STORE_KEY)
  const parsed = parseStoredJSON(saved)
  if (parsed) {
    if (parsed?.events && typeof parsed.events === 'object') {
      const normalizedEvents = {}
      Object.keys(parsed.events).forEach(id => {
        normalizedEvents[id] = normalizeSavedEvent(id, parsed.events[id])
      })
      const eventIds = Object.keys(normalizedEvents)
      if (eventIds.length > 0) {
        const fallbackId = eventIds[0]
        return {
          activeEventId: normalizedEvents[parsed.activeEventId] ? parsed.activeEventId : fallbackId,
          events: normalizedEvents
        }
      }
    }
    return migrateLegacyStore(parsed)
  }
  return createDefaultStore()
}

let store = getStore()
let realtimeListeners = []

function saveStore() {
  safeStorageSet(STORE_KEY, JSON.stringify(store))
  safeStorageRemove(LEGACY_STORE_KEY)
}

function getActiveEvent() {
  if (!store.events[store.activeEventId]) {
    const firstId = Object.keys(store.events)[0]
    store.activeEventId = firstId
  }
  return store.events[store.activeEventId]
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

export function getEventsWithOptions(options = {}) {
  const includeArchived = !!options.includeArchived
  return Object.values(store.events)
    .filter(e => includeArchived || !e.isArchived)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(e => ({ id: e.id, name: e.name, created_at: e.created_at, isArchived: !!e.isArchived }))
}

export function getCurrentEventId() {
  return store.activeEventId
}

export function getCurrentEventName() {
  return getActiveEvent()?.name || '-'
}

export function createEvent(name, actor = 'system') {
  const eventName = String(name || '').trim() || `Event ${getEvents().length + 1}`
  const event = createEmptyEventState(eventName)
  store.events[event.id] = event
  saveStore()
  logAdminAction('event_create', `Membuat event baru: ${eventName}`, actor, { event_id: event.id })
  return { id: event.id, name: event.name }
}

export function renameEvent(eventId, newName, actor = 'system') {
  const event = store.events[eventId]
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
  const event = store.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  if (event.id === store.activeEventId) {
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
  const event = store.events[eventId]
  if (!event) return { success: false, error: 'Event tidak ditemukan' }
  if (event.id === store.activeEventId) {
    return { success: false, error: 'Tidak bisa hapus event yang sedang aktif' }
  }

  delete store.events[eventId]
  saveStore()
  logAdminAction('event_delete', `Hapus event: ${event.name}`, actor, {
    event_id: eventId,
    reason: normalizeReason(reason)
  })
  return { success: true }
}

export function setCurrentEvent(eventId, actor = 'system') {
  if (!store.events[eventId]) return false
  const prev = store.activeEventId
  store.activeEventId = eventId
  saveStore()
  if (prev !== eventId) {
    logAdminAction('event_switch', `Pindah event aktif ke ${store.events[eventId].name}`, actor, {
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
  admin: { username: 'admin', password: 'admin123', role: 'super_admin', name: 'Super Admin' },
  gate1: { username: 'gate1', password: 'gate123', role: 'gate_front', name: 'Panitia Depan' },
  gate2: { username: 'gate2', password: 'gate123', role: 'gate_back', name: 'Panitia Belakang' }
}

export function login(username, password) {
  const user = Object.values(USERS).find(u => u.username === username && u.password === password)
  if (user) {
    const session = { ...user }
    safeStorageSet(SESSION_KEY, JSON.stringify(session))
    safeStorageRemove(LEGACY_SESSION_KEY)
    return { success: true, user: session }
  }
  return { success: false, error: 'Username atau password salah' }
}

export function getSession() {
  const active = safeStorageGet(SESSION_KEY)
  const parsedActive = parseStoredJSON(active)
  if (parsedActive) return parsedActive

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
  const dayCount = ev.participants.filter(p => p.day_number === data.day_number).length
  const ticketId = `YMH-D${data.day_number}-${String(dayCount + 1).padStart(3, '0')}`
  const participant = {
    id: generateId(),
    ticket_id: ticketId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || null,
    category: data.category || 'Regular',
    day_number: data.day_number,
    qr_data: JSON.stringify({ tid: ticketId, n: data.name, d: data.day_number, h: btoa(ticketId + '-3ons-2026') }),
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
    const rowDay = Number.isInteger(parsedDay) && parsedDay > 0 ? parsedDay : dayNumber

    if (!name) {
      errors.push({ row: index + 1, error: 'Nama kosong' })
      return
    }

    const matchedCat = categories.find(c => c.toLowerCase() === category.toLowerCase()) || 'Regular'

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
  return list.filter(p => p.name.toLowerCase().includes(q) || p.ticket_id.toLowerCase().includes(q))
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
  const uniqueDays = [...new Set(ev.participants.map(p => p.day_number))]
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
