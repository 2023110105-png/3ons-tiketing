// Mock data store - simulates Supabase backend
// Replace with real Supabase client when ready

const generateId = () => crypto.randomUUID()
const MIN_HIGH_IMPACT_REASON_LENGTH = 15

// Generate mock participants
const categories = ['Regular', 'VIP', 'Dealer', 'Media']

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

  // Day 1 - 60 peserta
  namesDay1.forEach((name, i) => {
    const ticketId = `YMH-D1-${String(i + 1).padStart(3, '0')}`
    const id = generateId()
    participants.push({
      id,
      ticket_id: ticketId,
      name,
      phone: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      day_number: 1,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      qr_data: JSON.stringify({ tid: ticketId, n: name, d: 1, h: btoa(ticketId + '-yamaha-2026') }),
      is_checked_in: false,
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString()
    })
  })

  // Day 2 - 100 peserta
  namesDay2.forEach((name, i) => {
    const ticketId = `YMH-D2-${String(i + 1).padStart(3, '0')}`
    const id = generateId()
    participants.push({
      id,
      ticket_id: ticketId,
      name,
      phone: `08${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category: categories[Math.floor(Math.random() * categories.length)],
      day_number: 2,
      email: `${name.toLowerCase().replace(/\s+/g, '')}@example.com`,
      qr_data: JSON.stringify({ tid: ticketId, n: name, d: 2, h: btoa(ticketId + '-yamaha-2026') }),
      is_checked_in: false,
      checked_in_at: null,
      checked_in_by: null,
      created_at: new Date().toISOString()
    })
  })

  return participants
}

// Initialize store from localStorage or generate fresh
function getStore() {
  try {
    const saved = localStorage.getItem('yamaha_event_data')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        participants: parsed.participants || [],
        checkInLogs: parsed.checkInLogs || [],
        adminLogs: parsed.adminLogs || [],
        currentDay: Number.isInteger(parsed.currentDay) && parsed.currentDay > 0 ? parsed.currentDay : 1
      }
    }
  } catch (e) {
    // ignore
  }
  const data = {
    participants: generateMockParticipants(),
    checkInLogs: [],
    adminLogs: [],
    currentDay: 1
  }
  localStorage.setItem('yamaha_event_data', JSON.stringify(data))
  return data
}

let store = getStore()
let realtimeListeners = []

function saveStore() {
  localStorage.setItem('yamaha_event_data', JSON.stringify(store))
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

export function logAdminAction(action, description, actor = 'system', meta = null) {
  const log = {
    id: generateId(),
    action,
    description,
    actor: normalizeActor(actor),
    meta,
    timestamp: new Date().toISOString()
  }
  store.adminLogs.push(log)
  saveStore()
  return log
}

export const defaultWaTemplate = `🎫 *Yamaha Event - E-Ticket*

Halo *{{nama}}*,
Berikut adalah tiket masuk acara Anda untuk *Hari ke-{{hari}}*.

📋 *Ticket ID:* {{tiket}}
📂 *Kategori:* {{kategori}}

Silakan tunjukkan gambar barcode tiket ini kepada petugas gerbang event. Terima kasih.`;

export function getWaTemplate() {
  return localStorage.getItem('yamaha_wa_template') || defaultWaTemplate;
}

export function setWaTemplate(template, actor = 'system') {
  localStorage.setItem('yamaha_wa_template', template);
  logAdminAction('wa_template_update', 'Template pesan WhatsApp diperbarui', actor)
}

// Subscribe to realtime updates
export function subscribeToCheckIns(callback) {
  realtimeListeners.push(callback)
  return () => {
    realtimeListeners = realtimeListeners.filter(cb => cb !== callback)
  }
}

function notifyListeners(event) {
  realtimeListeners.forEach(cb => cb(event))
}

// Users / Auth
const USERS = {
  admin: { username: 'admin', password: 'admin123', role: 'super_admin', name: 'Super Admin' },
  gate1: { username: 'gate1', password: 'gate123', role: 'gate_front', name: 'Panitia Depan' },
  gate2: { username: 'gate2', password: 'gate123', role: 'gate_back', name: 'Panitia Belakang' }
}

export function login(username, password) {
  const user = Object.values(USERS).find(u => u.username === username && u.password === password)
  if (user) {
    const session = { ...user }
    localStorage.setItem('yamaha_session', JSON.stringify(session))
    return { success: true, user: session }
  }
  return { success: false, error: 'Username atau password salah' }
}

export function getSession() {
  try {
    const session = localStorage.getItem('yamaha_session')
    return session ? JSON.parse(session) : null
  } catch { return null }
}

export function logout() {
  localStorage.removeItem('yamaha_session')
}

// Participants
export function getParticipants(dayFilter = null) {
  if (dayFilter) return store.participants.filter(p => p.day_number === dayFilter)
  return store.participants
}

export function getParticipant(id) {
  return store.participants.find(p => p.id === id) || null
}

export function addParticipant(data) {
  const dayCount = store.participants.filter(p => p.day_number === data.day_number).length
  const ticketId = `YMH-D${data.day_number}-${String(dayCount + 1).padStart(3, '0')}`
  const participant = {
    id: generateId(),
    ticket_id: ticketId,
    name: data.name,
    phone: data.phone || '',
    email: data.email || null,
    category: data.category || 'Regular',
    day_number: data.day_number,
    qr_data: JSON.stringify({ tid: ticketId, n: data.name, d: data.day_number, h: btoa(ticketId + '-yamaha-2026') }),
    is_checked_in: false,
    checked_in_at: null,
    checked_in_by: null,
    created_at: new Date().toISOString()
  }
  store.participants.push(participant)
  saveStore()
  logAdminAction('participant_add', `Tambah peserta ${participant.name} (${participant.ticket_id})`, data.actor, {
    participant_id: participant.id,
    day_number: participant.day_number,
    category: participant.category
  })

  // Auto-send via Local Bot Server if requested
  if (data.auto_send && (participant.phone || participant.email)) {
    const template = getWaTemplate();
    const wa_message = template
      .replace(/\{\{nama\}\}/g, participant.name || '')
      .replace(/\{\{tiket\}\}/g, participant.ticket_id || '')
      .replace(/\{\{hari\}\}/g, participant.day_number || '')
      .replace(/\{\{kategori\}\}/g, participant.category || '');

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
    return {
      success: false,
      error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter`
    }
  }

  const participant = store.participants.find(p => p.id === id)
  store.participants = store.participants.filter(p => p.id !== id)
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

// Manual check-in by participant ID (without QR)
export function manualCheckIn(participantId, scannedBy = 'gate_front') {
  const participant = store.participants.find(p => p.id === participantId)
  if (!participant) {
    return { success: false, status: 'invalid', message: 'Peserta tidak ditemukan' }
  }

  if (participant.day_number !== store.currentDay) {
    return {
      success: false,
      status: 'wrong_day',
      message: `Tiket untuk Hari ${participant.day_number}, sekarang Hari ${store.currentDay}`,
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
  store.checkInLogs.push(log)
  saveStore()

  notifyListeners({ type: 'check_in', participant, log })

  return {
    success: true,
    status: 'valid',
    message: 'Manual check-in berhasil!',
    participant
  }
}

// Bulk add participants from CSV/Excel
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

    // Validate category
    const validCategories = ['Regular', 'VIP', 'Dealer', 'Media']
    const matchedCat = validCategories.find(c => c.toLowerCase() === category.toLowerCase()) || 'Regular'

    const participant = addParticipant({
      name,
      phone,
      email,
      category: matchedCat,
      day_number: rowDay,
      actor,
      auto_send: false // Prevent bulk spam intentionally via bot for now
    })
    added.push(participant)
  })

  return { added, errors, total: rows.length }
}

// Search participants by name
export function searchParticipants(query, dayFilter = null) {
  const q = query.toLowerCase().trim()
  if (!q) return []
  let list = dayFilter ? store.participants.filter(p => p.day_number === dayFilter) : store.participants
  return list.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.ticket_id.toLowerCase().includes(q)
  )
}

// Check-in
export function checkIn(qrData, scannedBy = 'gate_front') {
  let parsed
  try {
    parsed = JSON.parse(qrData)
  } catch {
    return { success: false, status: 'invalid', message: 'QR Code tidak valid' }
  }

  const participant = store.participants.find(p => p.ticket_id === parsed.tid)
  if (!participant) {
    return { success: false, status: 'invalid', message: 'Peserta tidak ditemukan' }
  }

  if (participant.day_number !== store.currentDay) {
    return { 
      success: false, 
      status: 'wrong_day', 
      message: `Tiket untuk Hari ${participant.day_number}, sekarang Hari ${store.currentDay}`,
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

  // Perform check-in
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
  store.checkInLogs.push(log)
  saveStore()

  // Notify realtime listeners
  notifyListeners({ type: 'check_in', participant, log })

  return { 
    success: true, 
    status: 'valid', 
    message: 'Check-in berhasil!',
    participant 
  }
}

// Stats
export function getStats(day = null) {
  const participants = day ? store.participants.filter(p => p.day_number === day) : store.participants
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

// Logs
export function getCheckInLogs(day = null) {
  if (day) {
    return store.checkInLogs.filter(log => {
      const p = store.participants.find(pp => pp.id === log.participant_id)
      return p && p.day_number === day
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }
  return [...store.checkInLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
}

export function getAdminLogs(limit = 200) {
  const sorted = [...store.adminLogs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  return sorted.slice(0, limit)
}

// Current day
export function getCurrentDay() {
  return store.currentDay
}

export function getAvailableDays() {
  const uniqueDays = [...new Set(store.participants.map(p => p.day_number))]
  if (!uniqueDays.includes(store.currentDay)) {
    uniqueDays.push(store.currentDay)
  }
  return uniqueDays.sort((a, b) => a - b)
}

export function setCurrentDay(day, actor = 'system') {
  const previousDay = store.currentDay
  const safeDay = Number(day)
  store.currentDay = Number.isInteger(safeDay) && safeDay > 0 ? safeDay : 1
  saveStore()
  if (previousDay !== store.currentDay) {
    logAdminAction('current_day_update', `Ubah hari aktif dari ${previousDay} ke ${store.currentDay}`, actor, {
      from: previousDay,
      to: store.currentDay
    })
  }
}

// Reset all check-ins (for testing)
export function resetCheckIns(actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return {
      success: false,
      error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter`
    }
  }

  const totalBeforeReset = store.participants.filter(p => p.is_checked_in).length
  store.participants.forEach(p => {
    p.is_checked_in = false
    p.checked_in_at = null
    p.checked_in_by = null
  })
  store.checkInLogs = []
  saveStore()
  const cleanReason = normalizeReason(reason)
  const description = cleanReason
    ? `Reset status check-in (${totalBeforeReset} peserta) | Alasan: ${cleanReason}`
    : `Reset status check-in (${totalBeforeReset} peserta)`
  logAdminAction('checkin_reset', description, actor, { totalBeforeReset, reason: cleanReason || null })

  return { success: true }
}

// Delete all participants
export function deleteAllParticipants(actor = 'system', reason = '') {
  if (!isStrongReason(reason)) {
    return {
      success: false,
      error: `Alasan minimal ${MIN_HIGH_IMPACT_REASON_LENGTH} karakter`
    }
  }

  const totalParticipants = store.participants.length
  store.participants = []
  store.checkInLogs = []
  saveStore()
  const cleanReason = normalizeReason(reason)
  const description = cleanReason
    ? `Hapus semua peserta (${totalParticipants} data) | Alasan: ${cleanReason}`
    : `Hapus semua peserta (${totalParticipants} data)`
  logAdminAction('participants_delete_all', description, actor, { totalParticipants, reason: cleanReason || null })

  return { success: true }
}

// Get check-in peak hours stats for charts
export function getPeakHours(day = null) {
  const logs = day ? getCheckInLogs(day) : getCheckInLogs()
  const hourlyCount = {}

  // Initialize common hours (e.g. 07:00 to 17:00) with 0
  for (let i = 7; i <= 17; i++) {
    const hour = `${i.toString().padStart(2, '0')}:00`
    hourlyCount[hour] = 0
  }

  logs.forEach(log => {
    if (log.action === 'check_in') {
      const date = new Date(log.timestamp)
      const hourStr = `${date.getHours().toString().padStart(2, '0')}:00`
      if (hourlyCount[hourStr] !== undefined) {
        hourlyCount[hourStr]++
      } else {
        hourlyCount[hourStr] = 1
      }
    }
  })

  // Convert to array format for Recharts
  return Object.keys(hourlyCount)
    .sort((a, b) => a.localeCompare(b))
    .map(time => ({
      time,
      count: hourlyCount[time]
    }))
    // Filter out edge hours that are completely 0 if they're outside normal event hours
    .filter(item => {
      const h = parseInt(item.time.split(':')[0])
      return (h >= 7 && h <= 17) || item.count > 0
    })
}

// Simulate some check-ins for demo
export function simulateCheckIns(count = 5) {
  const unchecked = store.participants.filter(p => !p.is_checked_in && p.day_number === store.currentDay)
  const toCheck = unchecked.slice(0, Math.min(count, unchecked.length))
  
  toCheck.forEach((p, i) => {
    setTimeout(() => {
      checkIn(p.qr_data, 'gate_front')
    }, i * 800)
  })
}
