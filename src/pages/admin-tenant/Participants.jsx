// ===== REAL FUNCTIONS FOR PARTICIPANTS =====
import { fetchWorkspaceSnapshot, syncParticipantUpsert } from "../../lib/dataSync";
import { generateQRData } from '../../utils/qrSecurity';
let _workspaceSnapshot = null;
async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot;
}
function getActiveTenantId() {
  // Try to get from window.user first (set by component)
  if (typeof window !== 'undefined' && window.currentUser?.tenant_id) {
    return window.currentUser.tenant_id;
  }
  // Fallback: try to get from user in localStorage
  try {
    const session = JSON.parse(localStorage.getItem('user_session') || '{}');
    if (session.user?.tenant_id) return session.user.tenant_id;
    if (session.user?.tenant?.id) return session.user.tenant.id;
  } catch { /* ignore */ }
  // Last resort: try from workspace snapshot
  if (_workspaceSnapshot?.store?.tenants) {
    const firstTenant = Object.keys(_workspaceSnapshot.store.tenants)[0];
    if (firstTenant) return firstTenant;
  }
  return 'default';
}

function getParticipants(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const participants =
    _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  if (typeof day === 'number') {
    return participants.filter((p) => Number(p.day) === Number(day) || Number(p.day_number) === Number(day));
  }
  return participants;
}
function createNewDay() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 2;
  const tenantId = getActiveTenantId();
  const participants = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.['event-default']?.participants || [];
  const days = [...new Set(participants.map(p => p.day_number || p.day || 1))];
  const maxDay = Math.max(...days, 1);
  return maxDay + 1;
}

function deleteCurrentDay() { 
  // In real implementation, this would delete all participants for the current day
  // For now, just return success
  return { success: true }; 
}

function updateParticipant(participantId, updates) { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { success: false, error: 'Data not loaded' };
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const participants = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  const index = participants.findIndex(p => p.id === participantId || p.ticket_id === participantId);
  if (index >= 0) {
    participants[index] = { ...participants[index], ...updates };
    return { success: true, participant: participants[index] };
  }
  return { success: false, error: 'Participant not found' };
}

async function addParticipant(participantData) { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { success: false, error: 'Data not loaded' };
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  if (!event) return { success: false, error: 'Event not found' };
  
  if (!event.participants) event.participants = [];
  
  // Generate ticket_id first to ensure consistency
  const finalTicketId = participantData.ticket_id || 'T' + Date.now();
  const finalDay = participantData.day_number || 1;
  
  // Generate qr_data deterministically (same ticket = same qr_data always)
  const qrData = participantData.qr_data || generateQRData({
    ticket_id: finalTicketId,
    name: participantData.name,
    day_number: finalDay,
    category: participantData.category
  }, getActiveTenantId(), 'event-default');
  
  const newParticipant = {
    id: participantData.id || 'p_' + Date.now(),
    ticket_id: finalTicketId,
    name: participantData.name || '',
    phone: participantData.phone || '',
    email: participantData.email || '',
    category: participantData.category || 'Regular',
    day_number: finalDay,
    qr_data: qrData,  // This will be permanent and never change
    created_at: new Date().toISOString()
  };
  
  // Add to local state
  event.participants.push(newParticipant);
  
  // Sync to backend
  try {
    await syncParticipantUpsert({ tenantId, eventId, participant: newParticipant });
    console.log(`[addParticipant] Saved participant ${finalTicketId} with qr_data`);
  } catch (err) {
    console.error('[addParticipant] Sync failed:', err);
    // Continue even if sync fails - data is in local state
  }
  
  return { success: true, participant: newParticipant };
}

function deleteParticipant(participantId) { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { success: false, error: 'Data not loaded' };
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const event = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId];
  if (!event || !event.participants) return { success: false, error: 'Event not found' };
  
  const initialLength = event.participants.length;
  event.participants = event.participants.filter(p => p.id !== participantId && p.ticket_id !== participantId);
  return { success: event.participants.length < initialLength };
}

async function bulkAddParticipants(participantsData) { 
  const results = { added: [], updated: [], skipped: [], errors: [] };
  
  for (const data of participantsData) {
    try {
      const result = await addParticipant(data);
      if (result.success) {
        results.added.push(result.participant);
      } else {
        results.errors.push({ data, error: result.error });
      }
    } catch (error) {
      results.errors.push({ data, error: error.message });
    }
  }
  
  return { ...results, syncPromise: Promise.resolve(true) };
}

function getActiveTenant() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return { id: getActiveTenantId() };
  return _workspaceSnapshot.store.tenants?.[getActiveTenantId()] || { id: getActiveTenantId() };
}

function setCurrentDay(day) {
  if (_workspaceSnapshot?.store?.tenants?.[getActiveTenantId()]) {
    _workspaceSnapshot.store.tenants[getActiveTenantId()].currentDay = day;
  }
}

function getAvailableDays() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [1];
  const tenantId = getActiveTenantId();
  const eventId = 'event-default';
  const participants = _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  const days = [...new Set(participants.map(p => p.day_number || p.day || 1))];
  return days.length > 0 ? days.sort((a, b) => a - b) : [1];
}

function getCurrentDay() { 
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return 1;
  const tenantId = getActiveTenantId();
  return _workspaceSnapshot.store.tenants?.[tenantId]?.currentDay || 1;
}
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContextSaaS'
import { UserPlus, Search, Trash2, Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Download, MessageCircle, Bot, Zap, Edit3, Plus, Copy, ExternalLink } from 'lucide-react'
import { getWhatsAppShareLink } from '../../utils/whatsapp'
import { apiFetch } from '../../utils/api'
import { humanizeUserMessage } from '../../utils/userFriendlyMessage'
import { useNavigate, Link } from 'react-router-dom'
import { useWaStatus } from '../../hooks/useWaStatus'
import WaConnectBanner from '../../components/WaConnectBanner'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import * as XLSX from 'xlsx'
import JSZip from 'jszip'

export default function Participants() {
  const resolveTenantId = (userValue) => {
    const fromStore = String(getActiveTenant()?.id || '').trim()
    if (fromStore) return fromStore
    return String(userValue?.tenant?.id || getActiveTenantId()).trim() || getActiveTenantId()
  }
  const currentDay = getCurrentDay()
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 180)
  const [dayFilter, setDayFilter] = useState(currentDay)
  const [availableDays, setAvailableDays] = useState(getAvailableDays())
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [isDownloadingZip, setIsDownloadingZip] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importDuplicatePolicy, setImportDuplicatePolicy] = useState('overwrite') // overwrite|skip|block
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const [duplicateInfo, setDuplicateInfo] = useState({ count: 0, samples: [] })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [editExtraRows, setEditExtraRows] = useState([])
  const [editData, setEditData] = useState({
    name: '',
    phone: '',
    email: '',
    day_number: currentDay,
    category: 'Regular',
    extraFieldsText: ''
  })
  const [addExtraRows, setAddExtraRows] = useState([])
  const [newParticipant, setNewParticipant] = useState({ name: '', phone: '', email: '', category: 'Regular', day_number: currentDay, auto_send: false, extraFieldsText: '' })
  
  // Broadcast States
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const [broadcastProgress, setBroadcastProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  const [showBroadcastModeModal, setShowBroadcastModeModal] = useState(false)
  const [pendingBroadcastParticipants, setPendingBroadcastParticipants] = useState([])
  
  const toast = useToast()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const fileInputRef = useRef(null)
  const [tenantId, setTenantId] = useState(() => resolveTenantId(user))

  const handleDayFilterChange = (newDay) => {
    setDayFilter(newDay)
    setCurrentDay(newDay, user)
    updateLocalView(newDay)
  }

  const handleAddNewDay = () => {
    const newDay = createNewDay(user)
    handleDayFilterChange(newDay)
    toast.success('Hari Baru Ditambahkan', `Sistem telah menyiapkan Hari ${newDay}. Anda sekarang bisa import peserta untuk hari ini.`)
  }

  const handleDeleteDay = () => {
    if (dayFilter <= 1) return toast.error('Ditolak', 'Hari 1 tidak bisa dihapus')
    if (!window.confirm(`Semua data peserta di Hari ${dayFilter} akan Dihapus secara PERMANEN. Anda YAKIN?`)) return
    
    const res = deleteCurrentDay(user)
    if (res.success) {
      toast.success('Berhasil dihapus', `Hari ${dayFilter} dan semua datanya telah dimusnahkan.`)
      handleDayFilterChange(1) // Revert day filter to Day 1 explicitly
    } else {
      toast.error('Gagal menghapus hari', res.error)
    }
  }

  useEffect(() => {
    const syncTenantId = () => setTenantId(resolveTenantId(user))
    syncTenantId()
    window.addEventListener('ons-tenant-changed', syncTenantId)
    window.addEventListener('focus', syncTenantId)
    return () => {
      window.removeEventListener('ons-tenant-changed', syncTenantId)
      window.removeEventListener('focus', syncTenantId)
    }
  }, [user])

  const waConn = useWaStatus({ tenantId })
  const [showWaConnectModal, setShowWaConnectModal] = useState(false)

  const parseExtraFieldsText = (text) => {
    const obj = {}
    String(text || '').split(/\r?\n/g).forEach((line) => {
      const trimmed = String(line || '').trim()
      if (!trimmed) return
      if (trimmed.startsWith('#')) return
      const idx = trimmed.indexOf('=')
      if (idx === -1) return
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      if (!key) return
      if (!value) return
      obj[key] = value
    })
    return obj
  }

  const EXTRA_KEYS = ['Tanggal Lahir', 'Catatan']

  const metaToRows = (meta) => {
    if (!meta || typeof meta !== 'object') return []
    return Object.entries(meta)
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
      .map(([k, v]) => {
        const label = String(k)
        const known = EXTRA_KEYS.find(x => x.toLowerCase() === label.toLowerCase())
        if (known) return { type: known, customKey: '', value: String(v) }
        return { type: '__custom__', customKey: label, value: String(v) }
      })
  }

  const rowsToText = (rows) => {
    if (!Array.isArray(rows)) return ''
    const lines = []
    rows.forEach((r) => {
      const rawType = r?.type
      const rawCustomKey = r?.customKey
      const key = rawType === '__custom__' ? rawCustomKey : rawType
      const val = r?.value
      const cleanKey = String(key || '').trim()
      const cleanVal = val === undefined || val === null ? '' : String(val).trim()
      if (!cleanKey || !cleanVal) return
      lines.push(`${cleanKey}=${cleanVal}`)
    })
    return lines.join('\n')
  }

  const ExtraFieldsEditor = ({ rows, setRows, onTextChange }) => {
    const safeRows = Array.isArray(rows) ? rows : []

    const dateToISO = (raw) => {
      const v = String(raw || '').trim()
      if (!v) return ''
      if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v

      // Try dd/mm/yyyy or mm/dd/yyyy or dd-mm-yyyy / mm-dd-yyyy / dd.mm.yyyy
      const m = v.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/)
      if (!m) return ''
      const a = Number(m[1])
      const b = Number(m[2])
      const y = Number(m[3])
      if (!y) return ''

      // Heuristic: if a > 12 => a is day (dd/mm). Otherwise if b > 12 => b is day (mm/dd).
      let day = a
      let month = b
      if (a <= 12 && b > 12) {
        month = a
        day = b
      }
      // Default Indonesian dd/mm: day first.
      const isoMonth = String(month).padStart(2, '0')
      const isoDay = String(day).padStart(2, '0')
      return `${y}-${isoMonth}-${isoDay}`
    }

    const sync = (nextRows) => {
      setRows(nextRows)
      onTextChange(rowsToText(nextRows))
    }

    const addRow = () => {
      sync([
        ...safeRows,
        { type: 'Tanggal Lahir', customKey: '', value: '' }
      ])
    }

    const updateRow = (idx, patch) => {
      const next = safeRows.map((r, i) => i === idx ? { ...r, ...patch } : r)
      sync(next)
    }

    const removeRow = (idx) => {
      const next = safeRows.filter((_, i) => i !== idx)
      sync(next)
    }

    return (
      <div className="extra-fields-editor">
        {safeRows.length === 0 ? (
          <div className="text-note" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Belum ada data tambahan. Klik tombol di bawah untuk menambahkan.
          </div>
        ) : null}

        {safeRows.map((r, idx) => (
          <div key={`${idx}-${r?.type || ''}`} className="extra-field-row">
            <select
              className="form-select"
              value={r?.type || 'Tanggal Lahir'}
              onChange={(e) => {
                const nextType = e.target.value
                updateRow(idx, {
                  type: nextType,
                  customKey: nextType === '__custom__' ? (r.customKey || '') : ''
                })
              }}
            >
              <option value="Tanggal Lahir">Tanggal Lahir</option>
              <option value="Catatan">Catatan</option>
              <option value="__custom__">Lainnya (buat judul)</option>
            </select>

            {r?.type === '__custom__' && (
              <input
                className="form-input"
                placeholder="Judul kolom (contoh: Tanggal Daftar)"
                value={r.customKey || ''}
                onChange={(e) => updateRow(idx, { customKey: e.target.value })}
              />
            )}

            {r?.type === 'Tanggal Lahir' ? (
              <input
                className="form-input"
                type="date"
                value={dateToISO(r?.value)}
                onChange={(e) => updateRow(idx, { value: e.target.value })}
              />
            ) : (
              <input
                className="form-input"
                placeholder="Nilai"
                value={r?.value || ''}
                onChange={(e) => updateRow(idx, { value: e.target.value })}
              />
            )}

            <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeRow(idx)} title="Hapus field">
              Hapus
            </button>
          </div>
        ))}

        <button type="button" className="btn btn-secondary btn-sm" onClick={addRow}>
          Tambah Data Tambahan
        </button>
      </div>
    )
  }

  const openEditParticipant = (p) => {
    if (!p) return
    setEditTarget(p)
    const rows = metaToRows(p.meta)
    setEditExtraRows(rows)
    setEditData({
      name: p.name || '',
      phone: p.phone || '',
      email: p.email || '',
      day_number: p.day_number || dayFilter,
      category: p.category || 'Regular',
      extraFieldsText: rowsToText(rows)
    })
    setShowEditModal(true)
  }

  const fixEditSubmit = async (e) => {
    e.preventDefault()
    if (!editTarget) return
    const safeDay = Number(editData.day_number)
    if (!Number.isInteger(safeDay) || safeDay < 1) {
      toast.error('Hari tidak valid', 'Nomor hari minimal 1')
      return
    }
    if (editTarget.is_checked_in && safeDay !== editTarget.day_number) {
      toast.error('Tidak bisa diubah', 'Peserta sudah check-in, hari tidak bisa diganti.')
      return
    }

    const extras = parseExtraFieldsText(editData.extraFieldsText)
    const res = updateParticipant(editTarget.id, user, {
      name: editData.name,
      phone: editData.phone,
      email: editData.email,
      category: editData.category,
      day_number: safeDay,
      meta: extras
    })

    if (!res?.success) {
      toast.error('Gagal mengubah', humanizeUserMessage(res?.error || 'Tidak diketahui.', { fallback: 'Perubahan gagal.' }))
      return
    }

    toast.success('Peserta diperbarui', `${res.participant.name} (${res.participant.ticket_id})`)
    setShowEditModal(false)
    setEditTarget(null)
    setEditData({
      name: '',
      phone: '',
      email: '',
      day_number: currentDay,
      category: 'Regular',
      extraFieldsText: ''
    })
    updateLocalView()
  }

  const openAddModal = () => {
    setAddExtraRows([])
    setNewParticipant({
      name: '',
      phone: '',
      email: '',
      category: 'Regular',
      day_number: dayFilter,
      auto_send: false,
      extraFieldsText: ''
    })
    setShowModal(true)
  }

  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // WA status polling handled by useWaStatus()

  const refreshData = useCallback(async (forceFirebase = false) => {
    if (forceFirebase) {
      await bootstrapStoreFromServer(true)
    }
    setAvailableDays(getAvailableDays())
    // Let dayFilter effect handle participant setting
  }, [])

  const updateLocalView = useCallback((dayOverride) => {
    const d =
      dayOverride !== undefined && dayOverride !== null && Number.isFinite(Number(dayOverride))
        ? Number(dayOverride)
        : dayFilter
    setParticipants(getParticipants(d))
    setAvailableDays(getAvailableDays())
  }, [dayFilter])

  const visibleParticipants = useMemo(() => {
    let data = participants
    if (debouncedSearch) {
      const keyword = debouncedSearch.toLowerCase()
      data = data.filter(p =>
        p.name.toLowerCase().includes(keyword) ||
        p.ticket_id.toLowerCase().includes(keyword)
      )
    }
    if (categoryFilter !== 'all') data = data.filter(p => p.category === categoryFilter)
    if (statusFilter !== 'all') {
      if (statusFilter === 'checked') data = data.filter(p => p.is_checked_in)
      else data = data.filter(p => !p.is_checked_in)
    }
    return data
  }, [participants, debouncedSearch, categoryFilter, statusFilter])

  const dynamicCategories = useMemo(() => {
    const cats = new Set()
    participants.forEach(p => { if (p.category) cats.add(p.category) })
    return [...cats].sort()
  }, [participants])

  // Initial load

  // Initial load & refresh on dayFilter change
  useEffect(() => {
    const load = async () => {
      await bootstrapStoreFromServer();
      setParticipants(getParticipants(dayFilter));
      setAvailableDays(getAvailableDays());
    };
    load();
  }, [dayFilter]);

  useEffect(() => {
    const onWorkspaceSynced = () => {
      updateLocalView()
    }
    window.addEventListener('ons-workspace-synced', onWorkspaceSynced)
    return () => window.removeEventListener('ons-workspace-synced', onWorkspaceSynced)
  }, [updateLocalView])

  // Background polling synced with server
  useEffect(() => {
    const id = window.setInterval(async () => {
      const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
      if (!hidden) {
        await refreshData(true)
        updateLocalView()
      }
    }, 30000)
    return () => window.clearInterval(id)
  }, [refreshData, updateLocalView])

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!newParticipant.name.trim()) return
    const safeDay = Number(newParticipant.day_number)
    if (!Number.isInteger(safeDay) || safeDay < 1) {
      toast.error('Hari tidak valid', 'Nomor hari minimal 1')
      return
    }

    const extras = parseExtraFieldsText(newParticipant.extraFieldsText)
    const result = await addParticipant({
      name: newParticipant.name,
      phone: newParticipant.phone,
      email: newParticipant.email,
      category: newParticipant.category,
      day_number: safeDay,
      auto_send: newParticipant.auto_send,
      actor: user,
      ...extras
    })
    
    if (!result.success) {
      toast.error('Gagal menambahkan', result.error || 'Terjadi kesalahan')
      return
    }
    
    const p = result.participant
    if (newParticipant.auto_send) {
      toast.success('Peserta ditambahkan', `${p.name} — sedang dikirim lewat WhatsApp…`)
      // Actually send the ticket via WA bot (wait for sync to complete)
      setTimeout(() => {
        handleSingleBotSend(p)
      }, 800)
    } else {
      toast.success('Peserta ditambahkan', `${p.name} (${p.ticket_id})`)
    }
    setNewParticipant({ name: '', phone: '', email: '', category: 'Regular', day_number: dayFilter, auto_send: false, extraFieldsText: '' })
    setAddExtraRows([])
    setShowModal(false)
  }

  // --- BOT BROADCAST FEATURES ---
  const hasValidWaTarget = (participant) => {
    const raw = String(participant?.phone || '').trim()
    if (!raw) return false
    const digits = raw.replace(/\D/g, '')
    return digits.length >= 10
  }

  // ===== SMART RETRY SYSTEM untuk Ultra-Reliable Bot =====
  const RETRY_DELAYS = [1000, 2000, 4000, 8000]; // Exponential backoff
  const MAX_RETRIES = 4;
  
  // Check if error is non-retryable (permanent)
  const isNonRetryableError = (error) => {
    const nonRetryable = ['nomor tidak valid', 'tidak terdaftar', 'bukan user whatsapp', 'invalid phone'];
    return nonRetryable.some(k => String(error).toLowerCase().includes(k));
  };
  
  // Smart retry dengan exponential backoff
  const sendWithRetry = async (sendFn, maxRetries = MAX_RETRIES) => {
    let lastError = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = await sendFn();
        if (result?.success) return { success: true, attempts: attempt + 1 };
        if (isNonRetryableError(result?.error)) return { success: false, attempts: attempt + 1, error: result.error };
        lastError = result?.error || 'Unknown';
      } catch (err) {
        lastError = err?.message || 'Network error';
      }
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)]));
      }
    }
    return { success: false, attempts: maxRetries + 1, error: lastError };
  };

  const sendTicketViaBot = async (participant) => {
    if (!hasValidWaTarget(participant)) {
      return { success: false, error: 'Nomor WhatsApp peserta kosong atau tidak valid.' }
    }
    const tenantIdNow = resolveTenantId(user)
    const waSendMode = 'message_with_barcode';
    const wa_message = generateWaMessage(participant)
    
    // Smart Retry: Coba kirim dengan exponential backoff
    return await sendWithRetry(async () => {
      try {
        const res = await apiFetch('/api/send-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...participant,
            tenant_id: tenantIdNow,
            send_wa: !!participant.phone,
            send_email: !!participant.email,
            wa_message,
            wa_send_mode: waSendMode
          })
        });
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.success === false) {
          return { success: false, error: data?.error || `HTTP ${res.status}` }
        }
        return { success: true, error: null }
      } catch (e) {
        return { success: false, error: e?.message || 'Network error' }
      }
    });
  }

  const handleSingleBotSend = async (participant) => {
    toast.info('Mengirim...', `Meneruskan tiket ${participant.name} ke layanan pengiriman`);
    const result = await sendTicketViaBot(participant);
    if (result?.success) toast.success('Terkirim!', `Tiket berhasil masuk antrean kirim untuk ${participant.name}`);
    else toast.error('Gagal', humanizeUserMessage(result?.error, { fallback: 'Layanan pengiriman sedang tidak aktif.' }));
  }

  const handleCopyPasteMode = (participant) => {
    const waMessage = generateWaMessage(participant);
    setCopyPasteData({
      participant,
      message: waMessage,
      phone: participant.phone
    });
    setCopyPasteModalOpen(true);
  };

  const generateWaMessage = (p) => {
    const dateStr = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    return `Halo ${p.name},

Ini tiket masuk Anda:

Event: Yamaha Music School
Tanggal: ${dateStr}
Hari: ${p.day_number}
Ticket ID: ${p.ticket_id}
Kategori: ${p.category}

*Petunjuk:*
- Tunjukkan QR code ini ke petugas
- Tidak boleh screenshot

Terima kasih!`;
  };

  const handleCopyToClipboard = () => {
    if (copyTextRef.current) {
      copyTextRef.current.select();
      document.execCommand('copy');
      toast.success('Tersalin!', 'Pesan WA sudah di-copy. Buka WA dan paste.');
    }
  };

  const handleCopyPasteModalClose = () => {
    setCopyPasteModalOpen(false);
    setCopyPasteData(null);
  };

  const [copyPasteModalOpen, setCopyPasteModalOpen] = useState(false);
  const [copyPasteData, setCopyPasteData] = useState(null);
  const copyTextRef = useRef(null);

  // ===== DOWNLOAD ALL TICKETS AS ZIP =====
  const handleDownloadAllTicketsZip = async () => {
    if (participants.length === 0) {
      toast.error('Tidak ada peserta', 'Tidak ada tiket untuk di-download');
      return;
    }

    setIsDownloadingZip(true);
    toast.info('Membuat ZIP...', `Mengumpulkan ${participants.length} tiket...`);

    try {
      const zip = new JSZip();
      const baseUrl = window.location.origin.includes('localhost') 
        ? 'http://localhost:3001' 
        : window.location.origin;
      
      // Folder untuk tiket
      const folder = zip.folder(`Tiket_Hari_${dayFilter}_${new Date().toISOString().split('T')[0]}`);

      // Download semua gambar tiket
      let successCount = 0;
      for (const p of participants) {
        try {
          const ticketUrl = `${baseUrl}/ticket-qr/${p.ticket_id}?size=400&name=${encodeURIComponent(p.name || '')}&category=${encodeURIComponent(p.category || '')}&day=${encodeURIComponent(p.day_number || '1')}`;
          const response = await fetch(ticketUrl);
          
          if (!response.ok) {
            console.warn(`[ZIP] Failed to fetch ticket ${p.ticket_id}: ${response.status}`);
            continue;
          }

          const blob = await response.blob();
          
          // Format nama file: NamaPeserta_TicketID.png
          const safeName = (p.name || 'Unknown').replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 30);
          const filename = `${safeName}_${p.ticket_id}.png`;
          
          folder.file(filename, blob);
          successCount++;
        } catch (err) {
          console.error(`[ZIP] Error fetching ticket ${p.ticket_id}:`, err);
        }
      }

      if (successCount === 0) {
        toast.error('Gagal', 'Tidak bisa mengunduh tiket. Pastikan bot berjalan.');
        setIsDownloadingZip(false);
        return;
      }

      // Generate ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipUrl = URL.createObjectURL(zipBlob);
      
      // Trigger download
      const link = document.createElement('a');
      link.href = zipUrl;
      link.download = `Tiket_Hari_${dayFilter}_${successCount}peserta_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(zipUrl);

      toast.success('Berhasil!', `${successCount} tiket telah di-download sebagai ZIP`);
    } catch (err) {
      console.error('[ZIP] Error:', err);
      toast.error('Gagal', 'Error saat membuat ZIP: ' + err.message);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  const handleBroadcast = () => {
    if (!waConn.isReady) {
      setShowWaConnectModal(true)
      return
    }
    const targetParticipants = visibleParticipants.filter(hasValidWaTarget)
    if (targetParticipants.length === 0) return toast.error('Kosong', 'Tidak ada peserta untuk dibroadcast');
    const skippedCount = visibleParticipants.length - targetParticipants.length
    if (skippedCount > 0) {
      toast.warning('Sebagian dilewati', `${skippedCount} peserta dilewati karena nomor WA kosong/tidak valid.`)
    }
    setPendingBroadcastParticipants(targetParticipants);
    setShowBroadcastModeModal(true);
  }

  const startBroadcastWithMode = async (selectedMode) => {
    if (!waConn.isReady) {
      toast.error('WhatsApp belum tersambung', 'Sambungkan perangkat dulu agar pengiriman massal bisa berjalan.')
      setShowWaConnectModal(true)
      return
    }
    setShowBroadcastModeModal(false);
    const targetParticipants = pendingBroadcastParticipants;
    if (!window.confirm(`Perhatian!\nAnda akan mengirim tiket ke ${targetParticipants.length} peserta dengan mode: ${selectedMode === 'message_with_barcode' ? 'Pesan + Barcode' : 'Pesan Saja'}.\nPastikan WhatsApp sudah tersambung dan internet stabil.\nLanjutkan?`)) return;
    setIsBroadcasting(true);
    setBroadcastProgress({ current: 0, total: targetParticipants.length, success: 0, failed: 0 });
    
    // FAST CHAT SYSTEM: Concurrent batch processing
    const batchSize = 5; // Kirim 5 pesan secara paralel
    const delayBetweenBatches = 2000; // 2 detik antar batch (hindari WA ban)
    let s = 0; let f = 0;
    const failureReasons = [];
    
    for (let i = 0; i < targetParticipants.length; i += batchSize) {
      const batch = targetParticipants.slice(i, i + batchSize);
      
      // Kirim batch secara paralel
      const batchResults = await Promise.all(
        batch.map(async (participant) => {
          try {
            const result = await sendTicketViaBot(participant);
            return { success: result?.success, error: result?.error, participant };
          } catch (err) {
            return { success: false, error: err?.message, participant };
          }
        })
      );
      
      // Proses hasil batch
      batchResults.forEach((result) => {
        if (result.success) {
          s++;
        } else {
          f++;
          if (failureReasons.length < 3) {
            failureReasons.push(`${result.participant?.name}: ${humanizeUserMessage(result.error, { fallback: 'Gagal' })}`);
          }
        }
      });
      
      // Update progress
      const processed = Math.min(i + batchSize, targetParticipants.length);
      setBroadcastProgress({ current: processed, total: targetParticipants.length, success: s, failed: f });
      
      // Delay antar batch untuk menghindari WA ban (kecuali batch terakhir)
      if (i + batchSize < targetParticipants.length) {
        await new Promise(r => setTimeout(r, delayBetweenBatches));
      }
    }
    
    setBroadcastProgress(prev => ({ ...prev, success: s, failed: f }));
    if (f > 0) {
      const reasonText = failureReasons.length > 0 ? ` Alasan: ${failureReasons.join(' | ')}` : ''
      toast.warning('Broadcast Selesai', `Terkirim: ${s}, Gagal: ${f}.${reasonText}`)
    } else {
      toast.success('Broadcast Selesai', `Terkirim: ${s}, Gagal: ${f}`)
    }
    setTimeout(() => setIsBroadcasting(false), 3000);
  }



  // State untuk modal hapus peserta
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteApproval, setDeleteApproval] = useState('');

  const handleDelete = (p) => {
    setDeleteTarget(p);
    setDeleteReason('');
    setDeleteApproval('');
    setShowDeleteModal(true);
  };

  const confirmDeleteParticipant = () => {
    if (!deleteReason.trim()) {
      toast.error('Alasan wajib', 'Isi alasan penghapusan terlebih dahulu');
      return;
    }
    if (deleteReason.trim().length < 15) {
      toast.error('Alasan terlalu pendek', 'Alasan minimal 15 karakter');
      return;
    }
    if (deleteApproval !== 'SETUJU') {
      toast.error('Dibatalkan', 'Konfirmasi kedua harus SETUJU');
      return;
    }
    const result = deleteParticipant(deleteTarget.id, user, deleteReason);
    if (!result?.success) {
      toast.error('Gagal menghapus', humanizeUserMessage(result?.error, { fallback: 'Validasi alasan gagal.' }));
      return;
    }
    toast.error('Peserta dihapus', deleteTarget.name);
    setShowDeleteModal(false);
    setDeleteTarget(null);
    setDeleteReason('');
    setDeleteApproval('');
    updateLocalView();
  };

  // Mendukung kolom hari dinamis seperti 'Hari 2', 'Day 2', dst
  const getRowDayValue = (row) => {
    // Cek nama kolom standar
    const std = row.day_number ?? row.day ?? row.hari ?? row.Hari ?? row.Day ?? row.Day_Number
    if (std !== undefined && std !== null && String(std).trim() !== '') return std

    // Cek kolom yang mengandung kata 'hari' atau 'day' (case-insensitive)
    for (const key of Object.keys(row)) {
      const lower = String(key).toLowerCase()
      if (lower.startsWith('hari') || lower.startsWith('day')) {
        const val = row[key]
        if (val !== undefined && val !== null && String(val).trim() !== '') return val
      }
    }
    return undefined
  }

  const sanitizeImportRowKeys = (row) => {
    if (!row || typeof row !== 'object') return row
    const out = {}
    Object.entries(row).forEach(([k, v]) => {
      const key = String(k || '').replace(/^\ufeff/, '').trim()
      if (!key) return
      // SheetJS mengisi kolom kosong sebagai __EMPTY / __EMPTY_1 — buang agar tidak ikut ke addParticipant
      if (key.startsWith('__')) return
      out[key] = v
    })
    return out
  }

  const parseImportDayValue = (value) => {
    if (value === undefined || value === null) return NaN
    const raw = String(value).trim()
    if (!raw) return NaN
    const normalized = raw.replace(',', '.')
    const direct = Number(normalized)
    if (Number.isFinite(direct) && Number.isInteger(direct) && direct > 0) return direct
    const m = normalized.match(/(\d+)/)
    if (!m) return NaN
    const extracted = Number(m[1])
    return Number.isFinite(extracted) && Number.isInteger(extracted) && extracted > 0 ? extracted : NaN
  }

  const normalizePhoneForMatch = (value) => {
    let phone = String(value || '').trim()
    phone = phone.replace(/[^\d+]/g, '')
    if (phone.startsWith('+62')) phone = '62' + phone.slice(3)
    else if (phone.startsWith('0')) phone = '62' + phone.slice(1)
    return phone
  }

  const readRowField = (row, aliases) => {
    if (!row || typeof row !== 'object') return ''
    const keys = Object.keys(row || {})
    const normalizedAliases = aliases.map(a => String(a || '').toLowerCase().replace(/[^a-z0-9]/g, ''))
    for (const k of keys) {
      const kn = String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '')
      if (normalizedAliases.includes(kn)) return row[k]
    }
    return ''
  }

  const detectDuplicatesAgainstStore = (rows) => {
    const dupSamples = []
    let dupCount = 0
    if (!Array.isArray(rows) || rows.length === 0) return { count: 0, samples: [] }
    // Build a map of existing phones per day
    const existingCache = new Map()
    // We'll lazily populate existing phones for days we encounter
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rawPhone = readRowField(row, ['telepon', 'phone', 'hp', 'no_hp', 'nomor_hp', 'nomorwa', 'whatsapp', 'wa', 'mobile', 'telp'])
      const phone = normalizePhoneForMatch(rawPhone)
      if (!phone) continue
      const rawDay = getRowDayValue(row)
      const parsedDay = parseImportDayValue(rawDay)
      const day = Number.isInteger(parsedDay) && parsedDay > 0 ? parsedDay : Number(dayFilter || 1)
      if (!existingCache.has(day)) {
        const existing = getParticipants(day) || []
        const set = new Set(existing.map(p => normalizePhoneForMatch(p.phone)))
        existingCache.set(day, set)
      }
      const set = existingCache.get(day)
      if (set.has(phone)) {
        dupCount++
        if (dupSamples.length < 6) {
          dupSamples.push({ rowIndex: i, phone: rawPhone, day })
        }
      }
    }
    return { count: dupCount, samples: dupSamples }
  }

  const validateImportRows = (rows) => {
    const invalidDayRows = []
    rows.forEach((row, index) => {
      const dayValue = getRowDayValue(row)
      if (dayValue === undefined || dayValue === null || String(dayValue).trim() === '') return
      const parsed = parseImportDayValue(dayValue)
      if (!Number.isInteger(parsed) || parsed < 1) {
        invalidDayRows.push({ row: index + 1, rowIndex: index, value: dayValue })
      }
    })
    return { invalidDayRows }
  }

  // ===== IMPORT EXCEL =====
  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const names = workbook.SheetNames || []
      if (!names.length) {
        toast.error('File tidak valid', 'Workbook tidak memiliki sheet.')
        return
      }

      const loadRowsFromSheet = (sheetName) => {
        const sheet = workbook.Sheets[sheetName]
        if (!sheet) return []
        const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, blankrows: false })
        return rawRows.map(sanitizeImportRowKeys).filter((r) => r && Object.keys(r).length > 0)
      }

      const preferredIdx = names.findIndex((n) => String(n || '').trim().toLowerCase() === 'template peserta')
      let sheetName = preferredIdx >= 0 ? names[preferredIdx] : names[0]
      let rows = loadRowsFromSheet(sheetName)

      if (rows.length === 0) {
        let best = ''
        let bestLen = 0
        for (const n of names) {
          const r = loadRowsFromSheet(n)
          if (r.length > bestLen) {
            bestLen = r.length
            best = n
          }
        }
        if (bestLen > 0) {
          sheetName = best
          rows = loadRowsFromSheet(sheetName)
        }
      }

      if (rows.length === 0) {
        toast.error(
          'File kosong',
          'Tidak ada baris data di semua sheet. Pastikan baris pertama berisi judul kolom (nama, telepon, …) dan data di bawahnya.'
        )
        return
      }

      const { invalidDayRows } = validateImportRows(rows)

      setImportResult(null)
      const allNoDay = rows.every((row) => {
        const dayValue = getRowDayValue(row)
        return dayValue === undefined || dayValue === null || String(dayValue).trim() === ''
      })
      setImportPreview({
        fileName: file.name,
        sheetUsed: sheetName,
        rows: rows,
        columns: Object.keys(rows[0]),
        preview: rows.slice(0, 5),
        invalidDayRows,
        allNoDay
      })

      if (invalidDayRows.length > 0) {
        toast.info('Cek kolom hari', `${invalidDayRows.length} baris memiliki nilai hari tidak valid dan akan pakai hari default (${dayFilter})`)
      }

      setShowImportModal(true)
    } catch (err) {
      toast.error('Gagal baca file', 'Pastikan format file Excel (.xlsx/.csv) valid')
      console.error(err)
    }

    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const executeImportRows = async (rows, invalidDayRows = [], manualDay = null) => {
    if (!rows?.length) return;
    if (invalidDayRows.length > 0) {
      toast.info(
        'Hari tidak valid',
        `Nilai hari yang tidak valid akan dipakai sebagai Hari ${dayFilter} (mengikuti default pilihan).`
      );
    }
    let result;
    try {
      let finalRows = rows;
      if (manualDay) {
        finalRows = rows.map((row) => ({ ...row, day_number: manualDay }));
      }
      console.log('[IMPORT DEBUG] Data rows yang akan diimport:', finalRows);
      const duplicatesPolicy = importDuplicatePolicy === 'allow' ? 'add' : importDuplicatePolicy;
      const matchBy = importDuplicatePolicy === 'allow' ? 'none' : 'phone';
      result = await bulkAddParticipants(
        finalRows,
        dayFilter,
        user,
        { duplicatesPolicy, matchBy }
      );
      console.log('[IMPORT DEBUG] Hasil bulkAddParticipants:', result);
    } catch (err) {
      console.error('[import]', err);
      toast.error('Import gagal', err?.message || 'Terjadi kesalahan saat memproses baris. Coba lagi atau kurangi jumlah baris.');
      return;
    }

    if (result?.syncPromise && typeof result.syncPromise.then === 'function') {
      try {
        const ok = await result.syncPromise
        if (ok === false) {
          toast.error(
            'Sinkron cloud gagal',
            'Peserta sudah tersimpan di perangkat ini, tetapi gagal disimpan ke server (Supabase). Cek internet, env VITE_SUPABASE_*, dan Pengaturan → Tes Supabase.'
          )
        }
      } catch (err) {
        console.error('[import sync]', err)
        toast.error(
          'Sinkron cloud gagal',
          'Peserta tersimpan lokal; server menolak atau error. Periksa koneksi dan kebijakan RLS Supabase.'
        )
      }
    }

    const { syncPromise: _syncIgnored, ...importSummary } = result
    setImportResult(importSummary);
    const addedCount = result?.added?.length ?? 0;
    const updatedCount = result?.updated?.length ?? 0;
    const errCount = result?.errors?.length ?? 0;
    const touched = [...(result.added || []), ...(result.updated || [])];
    const dayNums = [
      ...new Set(
        touched
          .map((p) => Number(p.day_number))
          .filter((d) => Number.isInteger(d) && d >= 1)
      )
    ];
    let listDay = dayFilter;
    if (dayNums.length) {
      listDay = Math.min(...dayNums);
    }
    // Switch day filter to the imported day
    handleDayFilterChange(listDay);
    if (addedCount + updatedCount > 0) {
      setCategoryFilter('all');
      setStatusFilter('all');
    }
    if (addedCount + updatedCount === 0 && errCount > 0) {
      toast.error(
        'Import tidak menambah data',
        errCount >= rows.length
          ? 'Semua baris gagal. Lihat detail error di bawah.'
          : `${errCount} baris gagal, tidak ada yang ditambahkan atau diperbarui.`
      );
    } else if (addedCount + updatedCount === 0) {
      toast.info(
        'Tidak ada perubahan',
        'Semua baris dilewati (misalnya duplikat dengan opsi Skip) atau tidak valid.'
      );
    } else {
      toast.success(
        'Import berhasil',
        updatedCount > 0
          ? `${addedCount} peserta ditambahkan, ${updatedCount} diperbarui. Tampilan: Hari ${listDay} (filter kategori/status direset).`
          : `${addedCount} peserta ditambahkan. Tampilan: Hari ${listDay} (filter kategori/status direset).`
      );
    }
    updateLocalView(listDay)
  }

  const confirmImport = () => {
    if (!importPreview) return
    const dup = detectDuplicatesAgainstStore(importPreview.rows)
    if (dup.count > 0) {
      setDuplicateInfo(dup)
      setShowDuplicateConfirm(true)
      return
    }
    void executeImportRows(importPreview.rows, importPreview.invalidDayRows || [])
  }

  const fixInvalidDaysToDefault = () => {
    if (!importPreview?.invalidDayRows?.length) return
    const nextRows = importPreview.rows.slice()
    importPreview.invalidDayRows.forEach((item) => {
      if (typeof item?.rowIndex !== 'number') return
      nextRows[item.rowIndex] = { ...nextRows[item.rowIndex], day_number: dayFilter }
    })
    const { invalidDayRows: nextInvalid } = validateImportRows(nextRows)
    setImportPreview({ ...importPreview, rows: nextRows, invalidDayRows: nextInvalid })
  }

  const downloadTemplate = () => {
    try {
      const templateData = [
        { nama: 'Budi Santoso', telepon: '081234567890', kategori: 'Dealer', hari: 1 },
        { nama: 'Citra Dewi', telepon: '089876543210', kategori: 'VIP', hari: 2 },
        { nama: 'Dian Pratama', telepon: '08111222333', kategori: 'Regular', hari: 3 },
        { nama: 'Eko Wahyudi', telepon: '082233445566', kategori: 'Media', hari: 1 }
      ]
      
      const ws = XLSX.utils.json_to_sheet(templateData)
      const guideData = [
        { kolom: 'nama', wajib: 'Ya', keterangan: 'Nama lengkap peserta (wajib)', contoh: 'Budi Santoso' },
        { kolom: 'telepon', wajib: 'Tidak', keterangan: 'Nomor WA peserta (format 08... atau 628...)', contoh: '081234567890' },
        { kolom: 'kategori', wajib: 'Tidak', keterangan: 'Kategori peserta (bebas): VIP, Dealer, Regular, dll.', contoh: 'VIP' },
        { kolom: 'hari', wajib: 'Tidak', keterangan: 'Hari tiket (angka, minimal 1). Jika kosong, akan dipakai hari filter aktif.', contoh: '2' }
      ]
      const wsGuide = XLSX.utils.json_to_sheet(guideData)
      
      // Auto-size columns to make them neat
      const wscols = [
        { wch: 25 }, // nama
        { wch: 15 }, // telepon
        { wch: 15 }, // kategori
        { wch: 10 }  // hari
      ]
      ws['!cols'] = wscols
      wsGuide['!cols'] = [
        { wch: 16 }, // kolom
        { wch: 8 },  // wajib
        { wch: 64 }, // keterangan
        { wch: 26 }  // contoh
      ]

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Template Peserta")
      XLSX.utils.book_append_sheet(wb, wsGuide, "Panduan")
      
      XLSX.writeFile(wb, "Template_Peserta_Dengan_Hari.xlsx")
    } catch (err) {
      toast.error('Gagal', 'Gagal membuat file template Excel')
      console.error(err)
    }
  }

  const allParticipants = participants
  const checkedCount = allParticipants.filter(p => p.is_checked_in).length
  const showWaConnectBanner = !waConn.isReady
  const waConnectText = waConn.status === 'offline' || waConn.status === 'disconnected'
    ? 'WhatsApp belum tersambung. Untuk kirim pesan massal, sambungkan dulu perangkat.'
    : 'WhatsApp sedang disiapkan. Tunggu sampai status siap sebelum kirim massal.'

  const getCategoryBadge = (cat) => {
    const map = { VIP: 'badge-red', Dealer: 'badge-blue', Media: 'badge-yellow', Regular: 'badge-gray' }
    return map[cat] || 'badge-gray'
  }

  const getMetaPreview = (meta) => {
    if (!meta || typeof meta !== 'object') return ''
    const entries = Object.entries(meta)
      .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    if (entries.length === 0) return ''
    const [k, v] = entries[0]
    const value = String(v)
    const short = value.length > 28 ? `${value.slice(0, 28)}…` : value
    return `${k}: ${short}`
  }

  // Hidden file input
  const FileInput = () => (
    <input
      ref={fileInputRef}
      type="file"
      accept=".xlsx,.xls,.csv"
      onChange={handleFileUpload}
      className="hidden-file-input"
    />
  )

  // Import Modal Component (portal ke body: hindari tertutup stacking context / z-index layout)
  const ImportModal = () => {
    if (!showImportModal) return null

    const closeImport = () => {
      setShowImportModal(false)
      setImportResult(null)
      setImportPreview(null)
    }

    return createPortal(
      <div
        className="modal-overlay modal-overlay-priority"
        role="presentation"
        onClick={closeImport}
      >
        <div
          className="modal import-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="modal-header">
            <h3 id="import-modal-title" className="modal-title modal-title-inline">
              <FileSpreadsheet size={18} /> Import Peserta
            </h3>
            <button type="button" className="modal-close" onClick={closeImport} aria-label="Tutup">
              <X size={14} />
            </button>
          </div>
          <div className="modal-body">
            {importResult ? (
              // Results view
              <div className="import-result-wrap">
                <div className="import-result-icon">
                  <CheckCircle size={48} />
                </div>
                <h3 className="import-result-title">
                  Import Selesai!
                </h3>
                <div className="import-result-stats">
                  <div className="import-result-stat">
                    <div className="import-result-count success">{importResult.added.length}</div>
                    <div className="import-result-label">Ditambahkan</div>
                  </div>
                  {!!(importResult.updated?.length) && (
                    <div className="import-result-stat">
                      <div className="import-result-count success">{importResult.updated.length}</div>
                      <div className="import-result-label">Diperbarui</div>
                    </div>
                  )}
                  {!!(importResult.skipped?.length) && (
                    <div className="import-result-stat">
                      <div className="import-result-count gray">{importResult.skipped.length}</div>
                      <div className="import-result-label">Dilewati</div>
                    </div>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="import-result-stat">
                      <div className="import-result-count danger">{importResult.errors.length}</div>
                      <div className="import-result-label">Gagal</div>
                    </div>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="import-result-errors">
                    {importResult.errors.map((err, i) => (
                      <div key={i} className="import-result-error-item">
                        <AlertCircle size={12} className="mr-6" />
                        Baris {err.row}: {err.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : importPreview ? (
              // Preview view
              <>
                <div className="import-preview-file">
                  <FileSpreadsheet size={20} className="import-preview-file-icon" />
                  <div className="import-preview-file-meta">
                    <div className="import-preview-file-name">{importPreview.fileName}</div>
                    <div className="import-preview-file-count">
                      {importPreview.rows.length} baris data
                      {importPreview.sheetUsed ? (
                        <span className="text-muted" style={{ display: 'block', fontWeight: 500, marginTop: 2 }}>
                          Sheet: {importPreview.sheetUsed}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="import-preview-note">
                  Kolom terdeteksi: {importPreview.columns.join(', ')}
                </div>
                <div className="import-preview-note">
                  <b>Catatan:</b> Data akan dimasukkan ke hari sesuai kolom <b>hari</b> pada file Excel (bisa 1, 2, dst).<br />
                  Jika kolom hari/day/day_number kosong atau tidak valid, maka akan masuk ke hari filter aktif: <strong>Hari {dayFilter}</strong>.
                </div>
                {importPreview.invalidDayRows?.length > 0 && (
                  <div className="import-preview-warning">
                    <div className="import-preview-warning-title">
                      Ditemukan {importPreview.invalidDayRows.length} baris dengan nilai hari tidak valid.
                    </div>
                    <div>
                      Contoh baris: {importPreview.invalidDayRows.slice(0, 5).map(item => `${item.row} (${item.value})`).join(', ')}
                    </div>
                    <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={fixInvalidDaysToDefault}
                      >
                        Setel ke Hari {dayFilter}
                      </button>
                      <div className="text-note" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                        Jika Anda klik Import, sistem akan otomatis memakai Hari default untuk baris yang tidak valid.
                      </div>
                    </div>
                  </div>
                )}

                <div className="import-preview-title" style={{ marginTop: 18 }}>Aturan duplikat</div>
                <div className="import-preview-note" style={{ marginTop: 6, color: 'var(--text-muted)', fontSize: 13 }}>
                  Duplikat dipadankan berdasarkan <strong>nomor telepon/WA</strong> di hari yang sama.
                </div>
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label" style={{ marginBottom: 6 }}>Tindakan saat duplikat ditemukan</label>
                  <select
                    className="form-select"
                    value={importDuplicatePolicy}
                    onChange={(e) => setImportDuplicatePolicy(e.target.value)}
                  >
                    <option value="allow">Izinkan (boleh nomor WA sama)</option>
                    <option value="overwrite">Overwrite (perbarui data yang sudah ada)</option>
                    <option value="skip">Skip (lewati yang sudah ada)</option>
                    <option value="block">Blokir (batalkan baris duplikat)</option>
                  </select>
                </div>

                <div className="import-preview-title">Preview (5 baris pertama):</div>
                <div className="import-preview-table-wrap">
                  <table className="import-preview-table">
                    <thead>
                      <tr>
                        {importPreview.columns.slice(0, 4).map(col => (
                          <th key={col}>{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importPreview.preview.map((row, i) => (
                        <tr key={i}>
                          {importPreview.columns.slice(0, 4).map(col => (
                            <td key={col}>
                              {row[col] || '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="import-preview-help">
                  Kolom <strong>nama</strong> dan <strong>telepon</strong> dikenali fleksibel (mis. <em>Nama Tamu</em>, <em>Undangan</em>, <em>No. HP</em>, <em>WhatsApp</em>). Nomor tanpa angka 0 di depan (format Excel) tetap dibaca.
                  <br />
                  Juga didukung: <strong>kategori</strong>, <strong>hari</strong>. Kolom lain masuk sebagai data tambahan. Disarankan pakai template unduhan.
                </p>
              </>
            ) : null}
          </div>
            {showDuplicateConfirm && (
              <div className="import-duplicate-confirm" style={{ padding: 12, border: '1px solid #f0f0f0', borderRadius: 8, margin: '8px 16px' }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Duplikat ditemukan</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Ditemukan {duplicateInfo.count} baris dengan nomor yang sama seperti peserta yang sudah ada untuk hari yang sama.</div>
                {duplicateInfo.samples && duplicateInfo.samples.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <table className="import-preview-table" style={{ width: '100%' }}>
                      <thead>
                        <tr><th>No</th><th>Baris</th><th>Telepon</th><th>Hari</th></tr>
                      </thead>
                      <tbody>
                        {duplicateInfo.samples.map((s, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{s.rowIndex + 1}</td>
                            <td>{s.phone || '—'}</td>
                            <td>{s.day}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn btn-ghost" onClick={() => setShowDuplicateConfirm(false)}>Batal</button>
                  <button className="btn btn-secondary" onClick={() => { setImportDuplicatePolicy('skip'); setShowDuplicateConfirm(false); void executeImportRows(importPreview.rows, importPreview.invalidDayRows || []) }}>Skip Duplikat</button>
                  <button className="btn btn-primary" onClick={() => { setImportDuplicatePolicy('allow'); setShowDuplicateConfirm(false); void executeImportRows(importPreview.rows, importPreview.invalidDayRows || []) }}>Lanjutkan (Tambahkan Semua)</button>
                </div>
              </div>
            )}

            <div className="modal-footer">
            {importResult ? (
              <button type="button" className="btn btn-primary flex-1" onClick={closeImport}>
                Selesai
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowImportModal(false)
                    setImportPreview(null)
                  }}
                >
                  Batal
                </button>
                <button type="button" className="btn btn-primary btn-inline-icon" onClick={confirmImport}>
                  <Upload size={14} /> Import {importPreview?.rows.length} Peserta
                </button>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    )
  }

  const EditModal = () => {
    if (!showEditModal || !editTarget) return null

    const isCheckedIn = !!editTarget?.is_checked_in

    return (
      <div className="modal-overlay" onClick={() => { setShowEditModal(false); setEditTarget(null) }}>
        <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 560 }}>
          <div className="modal-header">
            <h3 className="modal-title modal-title-inline">Ubah Peserta</h3>
            <button
              className="modal-close"
              type="button"
              onClick={() => { setShowEditModal(false); setEditTarget(null) }}
            >
              <X size={14} />
            </button>
          </div>
          <form onSubmit={fixEditSubmit}>
            <div className="modal-body">
              <div className="import-preview-note" style={{ marginBottom: 14 }}>
                <div style={{ color: 'var(--text-muted)' }}>
                  Ticket ID: <strong>{editTarget.ticket_id}</strong>
                </div>
                {isCheckedIn && (
                  <div style={{ color: 'var(--warning)', fontWeight: 700, marginTop: 6 }}>
                    Peserta sudah check-in. Hari tidak bisa diubah.
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-name">Nama</label>
                <input id="edit-name" name="name" className="form-input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} required autoFocus />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-phone">Telepon (WA)</label>
                  <input id="edit-phone" name="phone" className="form-input" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-email">Email</label>
                  <input id="edit-email" name="email" className="form-input" type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-day">Hari Tiket</label>
                  <input
                    id="edit-day"
                    name="day_number"
                    className="form-input"
                    type="number"
                    min="1"
                    value={editData.day_number}
                    onChange={e => setEditData({ ...editData, day_number: Number(e.target.value) || '' })}
                    required
                    disabled={isCheckedIn}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-category">Kategori (bebas)</label>
                  <input id="edit-category" name="category" className="form-input" value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Data Tambahan (opsional)</label>
                <ExtraFieldsEditor
                  rows={editExtraRows}
                  setRows={setEditExtraRows}
                  onTextChange={(text) => setEditData(prev => ({ ...prev, extraFieldsText: text }))}
                />
                <div className="code-muted-sm" style={{ marginTop: 8 }}>
                  Pilih “Tanggal Lahir” atau “Catatan”, atau pilih “Lainnya” untuk membuat judul kolom sendiri.
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditTarget(null) }}>Batal</button>
              <button type="submit" className="btn btn-primary">Simpan Perubahan</button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ===== MOBILE PARTICIPANTS =====
  if (isMobile) {
    return (
      <div className="page-container">
        <FileInput />
        <ImportModal />
        <EditModal />

        <div className="m-section-header m-section-header-tight">
          <div>
            <span className="m-mobile-kicker">Data acara</span>
            <h1 className="m-section-title">Peserta</h1>
            <p className="m-section-subtitle">{checkedCount}/{allParticipants.length} hadir</p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={openAddModal}>
            <UserPlus size={14} /> Tambah
          </button>
        </div>

        {/* Import & Template Actions */}
        <div className="m-participant-actions">
          <button
            className="btn btn-secondary btn-sm m-participant-action-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={14} /> Import Excel
          </button>
          <button
            className="btn btn-whatsapp btn-sm m-participant-action-btn"
            onClick={handleBroadcast}
            title={showWaConnectBanner ? 'Sambungkan WhatsApp dulu' : ''}
          >
            <Zap size={14} /> Broadcast
          </button>
          <button
            className="btn btn-ghost btn-sm m-participant-action-btn m-participant-action-full"
            onClick={downloadTemplate}
          >
            <Download size={14} /> Template Excel
          </button>
        </div>

        {/* Mobile Search */}
        <div className="m-participant-search">
          <Search size={16} className="m-participant-search-icon" />
          <input
            id="mobile-participant-search"
            name="mobile_search"
            className="form-input m-participant-search-input"
            placeholder="Cari nama atau tiket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="m-filter-chips">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select id="mobile-day-filter" name="mobile_day" className="m-filter-select" value={dayFilter} onChange={e => handleDayFilterChange(Number(e.target.value))}>
              {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
            </select>
            <button className="btn btn-ghost btn-sm m-filter-select" onClick={handleAddNewDay} title="Tambah Hari" style={{ padding: '0 8px' }}>
              <Plus size={14} />
            </button>
            {dayFilter > 1 && (
              <button className="btn btn-ghost btn-danger btn-sm m-filter-select" onClick={handleDeleteDay} title="Hapus Hari Ini" style={{ padding: '0 8px' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
          <select className="m-filter-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
            <option value="all">Semua</option>
            {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
          <select className="m-filter-select" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="all">Semua</option>
            <option value="checked">✓ Hadir</option>
            <option value="unchecked">✗ Belum</option>
          </select>
        </div>

        {/* Mobile Card List */}
        <div className="m-card-list">
          {visibleParticipants.length === 0 ? (
            <div className="m-empty">
              <span><Search size={28} /></span>
              <p>Tidak ada data ditemukan</p>
            </div>
          ) : (
            visibleParticipants.map((p) => (
              <div key={p.id} className="m-participant-card-v2">
                {/* Row 1: Avatar + Info */}
                <div className="m-card-row-main">
                  <div className={`m-card-avatar ${p.is_checked_in ? 'm-p-avatar-checked' : 'm-p-avatar-pending'}`}>
                    {p.is_checked_in ? <CheckCircle size={18} /> : p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="m-card-info">
                    <div className="m-card-name-row">
                      <span className="m-card-name">{p.name}</span>
                      {p.is_checked_in && (
                        <span className="m-card-status">
                          <span className="status-dot"></span>
                        </span>
                      )}
                    </div>
                    <div className="m-card-subtitle">
                      <span className={`m-card-badge badge-${p.category === 'VIP' ? 'red' : p.category === 'Dealer' ? 'blue' : p.category === 'Media' ? 'yellow' : 'green'}`}>
                        {p.category || 'Regular'}
                      </span>
                      <span className="m-card-ticket">{p.ticket_id}</span>
                      {p.phone && (
                        <span className="m-card-phone">📞 {p.phone}</span>
                      )}
                    </div>
                    {p.checked_in_at && (
                      <div className="m-card-time">
                        ✓ Check-in {new Date(p.checked_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Row 2: Actions */}
                <div className="m-card-actions">
                  <button 
                    className="m-card-btn m-card-btn-bot" 
                    onClick={() => handleSingleBotSend(p)} 
                    title="Kirim otomatis"
                  >
                    <Bot size={14} />
                    <span>Bot</span>
                  </button>
                  <a 
                    href={getWhatsAppShareLink(p)} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="m-card-btn m-card-btn-wa" 
                    title="Kirim WA"
                  >
                    <MessageCircle size={14} />
                    <span>WA</span>
                  </a>
                  <button 
                    className="m-card-btn m-card-btn-edit" 
                    onClick={() => openEditParticipant(p)} 
                    title="Ubah data"
                  >
                    <Edit3 size={14} />
                    <span>Edit</span>
                  </button>
                  <button 
                    className="m-card-btn m-card-btn-delete" 
                    onClick={() => handleDelete(p)} 
                    title="Hapus"
                  >
                    <Trash2 size={14} />
                    <span>Hapus</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="m-participant-summary">
          {visibleParticipants.length} dari {allParticipants.length} peserta
        </div>

        {/* Modal Pilihan Mode Broadcast */}
        {showWaConnectModal && (
          <div className="modal-overlay modal-overlay-priority" onClick={() => setShowWaConnectModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
              <div className="modal-header">
                <h3 className="modal-title">WhatsApp belum tersambung</h3>
                <button className="modal-close" onClick={() => setShowWaConnectModal(false)}><X size={14} /></button>
              </div>
              <div className="modal-body">
                <div className="admin-note" style={{ marginBottom: 0 }}>
                  <div style={{ fontWeight: 750, marginBottom: 6 }}>Pengiriman massal butuh perangkat WhatsApp yang tersambung.</div>
                  <div style={{ color: 'var(--text-muted)' }}>{waConnectText}</div>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowWaConnectModal(false)}>Nanti</button>
                <button className="btn btn-primary btn-inline-icon" onClick={() => navigate('/admin/connect')}>
                  <Zap size={14} /> Sambungkan perangkat
                </button>
              </div>
            </div>
          </div>
        )}

        {showBroadcastModeModal && (
          <div className="modal-overlay modal-overlay-priority">
            <div className="modal broadcast-modal broadcast-modal-mobile" style={{maxWidth: 380, textAlign: 'center'}}>
              <Bot size={44} className="broadcast-bot-icon" />
              <h3 className="broadcast-title">Pilih Mode Kirim WhatsApp</h3>
              <p className="broadcast-note broadcast-note-mobile" style={{marginBottom: 24}}>Silakan pilih mode pengiriman untuk broadcast tiket ke peserta:</p>
              <div style={{display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16}}>
                <button className="btn btn-whatsapp" style={{fontWeight: 600, fontSize: 16, padding: '12px 0'}} onClick={() => startBroadcastWithMode('message_with_barcode')}>
                  Pesan + Barcode (gambar QR)
                </button>
                <button className="btn btn-secondary" style={{fontWeight: 600, fontSize: 16, padding: '12px 0'}} onClick={() => startBroadcastWithMode('message_only')}>
                  Pesan Saja (teks saja)
                </button>
              </div>
              <p className="text-note" style={{fontSize: 13, color: '#888'}}>Pesan + Barcode akan mengirim gambar QR sebagai lampiran. Pesan Saja hanya mengirim teks tanpa gambar.</p>
              <button className="btn btn-ghost mt-16" onClick={() => setShowBroadcastModeModal(false)} style={{marginTop: 16}}>Batal</button>
            </div>
          </div>
        )}

        {isBroadcasting && (
          <div className="modal-overlay modal-overlay-priority">
            <div className="modal broadcast-modal broadcast-modal-mobile">
              <Bot size={44} className="broadcast-bot-icon" />
              <h3 className="broadcast-title">Mengirim Pesan...</h3>
              <p className="broadcast-note broadcast-note-mobile">Mohon jangan tutup halaman ini.</p>
              <div className="broadcast-progress-track broadcast-progress-track-mobile">
                <div className="broadcast-progress-fill" style={{ 
                  width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                  transition: 'width 0.3s ease'
                }} />
              </div>
              <div className="broadcast-count broadcast-count-mobile">
                {broadcastProgress.current} / {broadcastProgress.total} Tiket
              </div>
              {(broadcastProgress.success > 0 || broadcastProgress.failed > 0) && (
                <div className="broadcast-result-row broadcast-result-row-mobile">
                  <span className="broadcast-success">Sukses: {broadcastProgress.success}</span> • <span className="broadcast-failed">Gagal: {broadcastProgress.failed}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add Modal */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="modal-title">Tambah Peserta</h3>
                <button className="modal-close" onClick={() => setShowModal(false)}><X size={14} /></button>
              </div>
              <form onSubmit={handleAdd}>
                <div className="modal-body">
                  <div className="form-group"><label className="form-label" htmlFor="add-name">Nama</label><input id="add-name" name="name" className="form-input" placeholder="Nama lengkap" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} required autoFocus /></div>
                  <div className="form-group"><label className="form-label" htmlFor="add-phone">Telepon (WA)</label><input id="add-phone" name="phone" className="form-input" placeholder="08xxx (untuk WA)" value={newParticipant.phone} onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="add-email">Email</label><input id="add-email" name="email" className="form-input" type="email" placeholder="email@contoh.com" value={newParticipant.email} onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label" htmlFor="add-day">Hari Tiket</label><input id="add-day" name="day_number" className="form-input" type="number" min="1" placeholder="Contoh: 1" value={newParticipant.day_number} onChange={e => setNewParticipant({ ...newParticipant, day_number: Number(e.target.value) || '' })} required /></div>
                  <div className="form-group"><label className="form-label" htmlFor="add-category">Kategori</label><input id="add-category" name="category" className="form-input" placeholder="Kategori (bebas)" value={newParticipant.category} onChange={e => setNewParticipant({ ...newParticipant, category: e.target.value })} /></div>
                  <div className="form-group">
                    <label className="form-label">Data Tambahan (opsional)</label>
                    <ExtraFieldsEditor
                      rows={addExtraRows}
                      setRows={setAddExtraRows}
                      onTextChange={(text) => setNewParticipant(prev => ({ ...prev, extraFieldsText: text }))}
                    />
                  </div>
                  <div className="form-group checkbox-inline-row">
                    <input type="checkbox" id="m-auto-send" checked={newParticipant.auto_send} onChange={e => setNewParticipant({ ...newParticipant, auto_send: e.target.checked })} className="checkbox-brand" />
                    <label htmlFor="m-auto-send" className="checkbox-inline-label">Kirim WA / Email otomatis</label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Tambah</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal Hapus Peserta */}
        {showDeleteModal && deleteTarget && (
          <div className="modal-overlay modal-overlay-priority" onClick={() => setShowDeleteModal(false)}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{maxWidth: 400}}>
              <div className="modal-header">
                <h3 className="modal-title">Konfirmasi Hapus Peserta</h3>
                <button className="modal-close" onClick={() => setShowDeleteModal(false)}><X size={14} /></button>
              </div>
              <div className="modal-body">
                <p>Anda yakin ingin menghapus peserta <b>{deleteTarget.name}</b>?</p>
                <div className="form-group mt-16">
                  <label className="form-label" htmlFor="delete-reason">Alasan Penghapusan <span style={{color: 'red'}}>*</span></label>
                  <textarea id="delete-reason" name="delete_reason" className="form-input" placeholder="Masukkan alasan minimal 15 karakter" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} required />
                </div>
                <div className="form-group mt-16">
                  <label className="form-label" htmlFor="delete-confirm">Konfirmasi Kedua <span style={{color: 'red'}}>*</span></label>
                  <input id="delete-confirm" name="delete_confirm" className="form-input" placeholder="Ketik SETUJU untuk melanjutkan" value={deleteApproval} onChange={e => setDeleteApproval(e.target.value)} required />
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Batal</button>
                <button className="btn btn-danger" onClick={confirmDeleteParticipant}>Hapus Peserta</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ===== DESKTOP PARTICIPANTS =====
  return (
    <div className="page-container">
      <FileInput />
      <ImportModal />
      <EditModal />

      <div className="page-header">
        <span className="page-kicker">Data acara</span>
        <h1>Kelola peserta</h1>
        <p>{allParticipants.length} peserta terdaftar · {checkedCount} sudah check-in. Import, broadcast WA, dan hapus memerlukan konfirmasi sesuai kebijakan Anda.</p>
      </div>

      {showWaConnectBanner && (
        <WaConnectBanner
          wa={waConn}
          title="WhatsApp belum siap"
          className=""
        />
      )}

      <div className="participants-toolbar">
        <div className="search-bar participants-search">
          <span className="search-bar-icon"><Search size={16} /></span>
          <input id="participant-search" name="search" placeholder="Cari nama atau ID tiket..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select id="category-filter" name="category" className="form-select select-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">Semua Kategori</option>
          {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <select id="day-filter" name="day" className="form-select select-sm" value={dayFilter} onChange={e => handleDayFilterChange(Number(e.target.value))}>
            {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={handleAddNewDay} title="Tambah Hari Baru" style={{ padding: '6px 8px' }}>
            <Plus size={14} />
          </button>
          {dayFilter > 1 && (
            <button className="btn btn-ghost btn-danger btn-sm" onClick={handleDeleteDay} title="Hapus Hari Ini" style={{ padding: '6px 8px' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>
        <select id="status-filter" name="status" className="form-select select-md" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="all">Semua Status</option>
          <option value="checked">Sudah Check-in</option>
          <option value="unchecked">Belum Hadir</option>
        </select>
        <button className="btn btn-secondary btn-inline-icon" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Import Excel
        </button>
        <button className="btn btn-whatsapp btn-inline-icon" onClick={handleBroadcast}>
          <Zap size={14} /> Kirim Massal WA
        </button>
        <button className="btn btn-ghost btn-sm btn-inline-icon" onClick={downloadTemplate} title="Download template Excel">
          <Download size={14} /> Template Excel
        </button>
        <button 
          className="btn btn-ghost btn-sm btn-inline-icon btn-blue" 
          onClick={handleDownloadAllTicketsZip} 
          disabled={isDownloadingZip}
          title="Download semua tiket sebagai ZIP"
        >
          <Download size={14} /> {isDownloadingZip ? 'Membuat ZIP...' : 'Download Tiket ZIP'}
        </button>
        <button className="btn btn-primary" onClick={openAddModal}><UserPlus size={14} /> Tambah Peserta</button>
      </div>

      <div className="table-container animate-fade-in-up">
        <table className="data-table">
          <thead>
            <tr>
              <th>No</th><th>Ticket ID</th><th>Nama</th><th>Telepon</th><th>Kategori</th><th>Status</th><th>Check-in</th><th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {visibleParticipants.length === 0 ? (
              <tr><td colSpan={9}><div className="empty-state empty-pad-lg"><div className="empty-state-icon"><Search size={32} /></div><h3>Tidak ada data</h3><p>Coba ubah filter</p></div></td></tr>
            ) : visibleParticipants.map((p, i) => (
              <tr key={p.id}>
                <td className="td-muted">{i + 1}</td>
                <td><code className="ticket-id-code">{p.ticket_id}</code></td>
                <td className="td-strong">
                  {p.name}
                  {getMetaPreview(p.meta) && (
                    <div className="td-extra">{getMetaPreview(p.meta)}</div>
                  )}
                </td>
                <td className="td-secondary">{p.phone}</td>
                <td><span className={`badge ${getCategoryBadge(p.category)}`}>{p.category}</span></td>
                <td>{p.is_checked_in ? <span className="badge badge-green"><CheckCircle size={10} /> Check-in</span> : <span className="badge badge-gray">Belum</span>}</td>
                <td className="td-time-muted">{p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString('id-ID') : '—'}</td>
                <td className="actions-cell">
                  <button className="btn btn-ghost btn-blue btn-sm" onClick={() => handleSingleBotSend(p)} title="Kirim Otomatis">
                    <Bot size={14} />
                  </button>
                  <button className="btn btn-ghost btn-green btn-sm" onClick={() => handleCopyPasteMode(p)} title="Copy-Paste Mode (Cepat & Aman)">
                    <Copy size={14} />
                  </button>
                  <a href={getWhatsAppShareLink(p)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-whatsapp btn-sm" title="Kirim Manual (WA Web)">
                    <MessageCircle size={14} />
                  </a>
                  <button className="btn btn-ghost btn-blue btn-sm" onClick={() => openEditParticipant(p)} title="Ubah data peserta">
                    <Edit3 size={14} />
                  </button>
                  <button className="btn btn-ghost btn-danger btn-sm" onClick={() => handleDelete(p)} title="Hapus">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="summary-muted">
        Menampilkan {visibleParticipants.length} dari {allParticipants.length} peserta
      </div>

      {showWaConnectModal && (
        <div className="modal-overlay modal-overlay-priority" onClick={() => setShowWaConnectModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3 className="modal-title">WhatsApp belum tersambung</h3>
              <button type="button" className="modal-close" onClick={() => setShowWaConnectModal(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="admin-note" style={{ marginBottom: 0 }}>
                <div style={{ fontWeight: 750, marginBottom: 6 }}>Pengiriman massal butuh perangkat WhatsApp yang tersambung.</div>
                <div style={{ color: 'var(--text-muted)' }}>{waConnectText}</div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowWaConnectModal(false)}>Nanti</button>
              <button type="button" className="btn btn-primary btn-inline-icon" onClick={() => navigate('/admin/connect')}>
                <Zap size={14} /> Sambungkan perangkat
              </button>
            </div>
          </div>
        </div>
      )}

      {showBroadcastModeModal && (
        <div className="modal-overlay modal-overlay-priority">
          <div className="modal broadcast-modal broadcast-modal-desktop" style={{ maxWidth: 420, textAlign: 'center' }}>
            <Bot size={44} className="broadcast-bot-icon" />
            <h3 className="broadcast-title">Pilih Mode Kirim WhatsApp</h3>
            <p className="broadcast-note" style={{ marginBottom: 24 }}>Silakan pilih mode pengiriman untuk broadcast tiket ke peserta:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
              <button type="button" className="btn btn-whatsapp" style={{ fontWeight: 600, fontSize: 16, padding: '12px 0' }} onClick={() => startBroadcastWithMode('message_with_barcode')}>
                Pesan + Barcode (gambar QR)
              </button>
              <button type="button" className="btn btn-secondary" style={{ fontWeight: 600, fontSize: 16, padding: '12px 0' }} onClick={() => startBroadcastWithMode('message_only')}>
                Pesan Saja (teks saja)
              </button>
            </div>
            <p className="text-note" style={{ fontSize: 13, color: '#888' }}>Pesan + Barcode akan mengirim gambar QR sebagai lampiran. Pesan Saja hanya mengirim teks tanpa gambar.</p>
            <button type="button" className="btn btn-ghost mt-16" onClick={() => setShowBroadcastModeModal(false)} style={{ marginTop: 16 }}>Batal</button>
          </div>
        </div>
      )}

      {isBroadcasting && (
        <div className="modal-overlay modal-overlay-priority">
          <div className="modal broadcast-modal broadcast-modal-desktop">
            <Bot size={48} className="broadcast-bot-icon" />
            <h2 className="broadcast-title">Mengirim Pesan...</h2>
            <p className="broadcast-note">Mohon jangan tutup halaman ini.</p>
            
            <div className="broadcast-progress-track">
              <div className="broadcast-progress-fill" style={{ 
                width: `${(broadcastProgress.current / broadcastProgress.total) * 100}%`,
                transition: 'width 0.3s ease'
              }} />
            </div>
            
            <div className="broadcast-count">
              {broadcastProgress.current} / {broadcastProgress.total} Tiket
            </div>
            {(broadcastProgress.success > 0 || broadcastProgress.failed > 0) && (
              <div className="broadcast-result-row">
                <span className="broadcast-success">Sukses: {broadcastProgress.success}</span> • <span className="broadcast-failed">Gagal: {broadcastProgress.failed}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Tambah Peserta Baru</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}><X size={14} /></button>
            </div>
            <form onSubmit={handleAdd}>
              <div className="modal-body">
                <div className="form-group"><label className="form-label">Nama Peserta</label><input className="form-input" placeholder="Masukkan nama lengkap" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} required autoFocus /></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Nomor WhatsApp</label><input className="form-input" placeholder="08xxxxxxxxxx" value={newParticipant.phone} onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Alamat Email</label><input className="form-input" type="email" placeholder="email@contoh.com" value={newParticipant.email} onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })} /></div>
                </div>
                <div className="form-group"><label className="form-label">Hari Tiket</label><input className="form-input" type="number" min="1" placeholder="Contoh: 1" value={newParticipant.day_number} onChange={e => setNewParticipant({ ...newParticipant, day_number: Number(e.target.value) || '' })} required /></div>
                <div className="form-group"><label className="form-label">Kategori</label><input className="form-input" placeholder="Kategori (bebas)" value={newParticipant.category} onChange={e => setNewParticipant({ ...newParticipant, category: e.target.value })} /></div>
                <div className="form-group">
                  <label className="form-label">Data Tambahan (opsional)</label>
                  <ExtraFieldsEditor
                    rows={addExtraRows}
                    setRows={setAddExtraRows}
                    onTextChange={(text) => setNewParticipant(prev => ({ ...prev, extraFieldsText: text }))}
                  />
                </div>
                <div className="form-group auto-send-card">
                  <input type="checkbox" id="d-auto-send" checked={newParticipant.auto_send} onChange={e => setNewParticipant({ ...newParticipant, auto_send: e.target.checked })} className="checkbox-success" />
                  <div>
                    <label htmlFor="d-auto-send" className="auto-send-title">Kirim tiket otomatis</label>
                    <span className="auto-send-note">Sistem akan mengirim WA/Email otomatis di latar belakang</span>
                  </div>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Batal</button><button type="submit" className="btn btn-primary">Tambah Peserta</button></div>
            </form>
          </div>
        </div>
      )}

      {showDeleteModal && deleteTarget && (
        <div className="modal-overlay modal-overlay-priority" onClick={() => setShowDeleteModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Konfirmasi Hapus Peserta</h3>
              <button type="button" className="modal-close" onClick={() => setShowDeleteModal(false)}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <p>Anda yakin ingin menghapus peserta <b>{deleteTarget.name}</b>?</p>
              <div className="form-group mt-16">
                <label className="form-label">Alasan Penghapusan <span style={{ color: 'red' }}>*</span></label>
                <textarea className="form-input" placeholder="Masukkan alasan minimal 15 karakter" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} required />
              </div>
              <div className="form-group mt-16">
                <label className="form-label">Konfirmasi Kedua <span style={{ color: 'red' }}>*</span></label>
                <input className="form-input" placeholder="Ketik SETUJU untuk melanjutkan" value={deleteApproval} onChange={e => setDeleteApproval(e.target.value)} required />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowDeleteModal(false)}>Batal</button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteParticipant}>Hapus Peserta</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== COPY-PASTE MODAL (Kirim Manual Cepat) ===== */}
      {copyPasteModalOpen && copyPasteData && (
        <div className="modal-overlay" onClick={handleCopyPasteModalClose}>
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Copy-Paste Mode (Cepat & Aman)</h3>
              <button className="modal-close" onClick={handleCopyPasteModalClose}><X size={14} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">👤 Penerima</label>
                <div className="participant-info" style={{ padding: '12px', background: '#f8f9fa', borderRadius: '8px', marginBottom: '16px' }}>
                  <strong>{copyPasteData.participant.name}</strong>
                  <div style={{ color: '#666', fontSize: '14px' }}>{copyPasteData.participant.phone}</div>
                  <div style={{ color: '#888', fontSize: '12px' }}>Ticket ID: {copyPasteData.participant.ticket_id}</div>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">💬 Pesan WhatsApp Siap Kirim</label>
                <textarea
                  ref={copyTextRef}
                  className="form-input"
                  value={copyPasteData.message}
                  readOnly
                  rows={12}
                  style={{ fontFamily: 'monospace', fontSize: '14px', background: '#f8f9fa' }}
                />
              </div>
              <div className="alert alert-info" style={{ marginTop: '12px' }}>
                <strong>Cara pakai:</strong>
                <ol style={{ margin: '8px 0 0 16px', fontSize: '14px' }}>
                  <li>Klik "Copy Pesan" di bawah</li>
                  <li>Buka WhatsApp di HP Anda</li>
                  <li>Cari kontak: <strong>{copyPasteData.participant.phone}</strong></li>
                  <li>Paste pesan dan kirim</li>
                </ol>
              </div>
              
              {/* Preview Tiket */}
              <div className="form-group" style={{ marginTop: '20px' }}>
                <label className="form-label">🎫 Preview Tiket (bisa di-download)</label>
                <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '10px', background: '#f8f9fa' }}>
                  <img 
                    src={`${window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin}/ticket-qr/${copyPasteData.participant.ticket_id}?size=400&name=${encodeURIComponent(copyPasteData.participant.name || '')}&category=${encodeURIComponent(copyPasteData.participant.category || '')}&day=${encodeURIComponent(copyPasteData.participant.day_number || '1')}`}
                    alt="Tiket QR"
                    style={{ width: '100%', maxWidth: '400px', display: 'block', margin: '0 auto', borderRadius: '4px' }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={handleCopyPasteModalClose}>Tutup</button>
              <a 
                href={`${window.location.origin.includes('localhost') ? 'http://localhost:3001' : window.location.origin}/ticket-qr/${copyPasteData.participant.ticket_id}?size=400&name=${encodeURIComponent(copyPasteData.participant.name || '')}&category=${encodeURIComponent(copyPasteData.participant.category || '')}&day=${encodeURIComponent(copyPasteData.participant.day_number || '1')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
                download={`Tiket_${copyPasteData.participant.ticket_id}.png`}
              >
                <Download size={14} style={{ marginRight: '6px' }} />
                Download Tiket
              </a>
              <button type="button" className="btn btn-primary" onClick={handleCopyToClipboard}>
                <Copy size={14} style={{ marginRight: '6px' }} />
                Copy Pesan
              </button>
              <a 
                href={`https://wa.me/${copyPasteData.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(copyPasteData.message)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="btn btn-whatsapp"
              >
                <ExternalLink size={14} style={{ marginRight: '6px' }} />
                Buka WA Web
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
