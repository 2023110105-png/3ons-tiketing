import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { getParticipants, addParticipant, deleteParticipant, bulkAddParticipants, updateParticipant, getCurrentDay, getAvailableDays, bootstrapStoreFromFirebase, getActiveTenant, createNewDay, deleteCurrentDay } from '../../store/mockData'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/useAuth'
import { UserPlus, Search, Trash2, Upload, FileSpreadsheet, X, CheckCircle, AlertCircle, Download, MessageCircle, Bot, Zap, Edit3, Plus } from 'lucide-react'
import { getWhatsAppShareLink, generateWaMessage } from '../../utils/whatsapp'
import { apiFetch } from '../../utils/api'
import { humanizeUserMessage } from '../../utils/userFriendlyMessage'
import { useNavigate, Link } from 'react-router-dom'
import { useWaStatus } from '../../hooks/useWaStatus'
import WaConnectBanner from '../../components/WaConnectBanner'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import * as XLSX from 'xlsx'

export default function Participants() {
  const resolveTenantId = (userValue) => {
    const fromStore = String(getActiveTenant()?.id || '').trim()
    if (fromStore) return fromStore
    return String(userValue?.tenant?.id || 'tenant-default').trim() || 'tenant-default'
  }
  const currentDay = getCurrentDay()
  const [participants, setParticipants] = useState([])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 180)
  const [dayFilter, setDayFilter] = useState(currentDay)
  const [availableDays, setAvailableDays] = useState(getAvailableDays())
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importResult, setImportResult] = useState(null)
  const [importPreview, setImportPreview] = useState(null)
  const [importDuplicatePolicy, setImportDuplicatePolicy] = useState('overwrite') // overwrite|skip|block
    const [importManualDay, setImportManualDay] = useState('')
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
    // Synchronize to UI
    updateLocalView()
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
      await bootstrapStoreFromFirebase(true)
    }
    setAvailableDays(getAvailableDays())
    // Let dayFilter effect handle participant setting
  }, [])

  const updateLocalView = useCallback(() => {
    setParticipants(getParticipants(dayFilter))
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
  useEffect(() => {
    const load = async () => {
      await refreshData(true)
      updateLocalView()
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // View dependency on dayFilter
  useEffect(() => {
    updateLocalView()
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
    const p = addParticipant({
      name: newParticipant.name,
      phone: newParticipant.phone,
      email: newParticipant.email,
      category: newParticipant.category,
      day_number: safeDay,
      auto_send: newParticipant.auto_send,
      actor: user,
      ...extras
    })
    if (newParticipant.auto_send) {
      toast.success('Peserta ditambahkan', `${p.name} — sedang dikirim lewat WhatsApp…`)
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

  const sendTicketViaBot = async (participant) => {
    if (!hasValidWaTarget(participant)) {
      return { success: false, error: 'Nomor WhatsApp peserta kosong atau tidak valid.' }
    }
    const tenantIdNow = resolveTenantId(user)
    // Force desain tiket WA agar tidak jatuh ke mode QR polos.
    const waSendMode = 'message_with_barcode';
    const wa_message = generateWaMessage(participant)
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
        const serverError = data?.error || `HTTP ${res.status}`
        console.error('Broadcast send-ticket failed:', { tenant_id: tenantIdNow, ticket_id: participant?.ticket_id, serverError })
        return { success: false, error: serverError }
      }
      return { success: true, error: null }
    } catch (e) {
      console.error('Layanan pengiriman sedang tidak aktif:', e);
      return { success: false, error: e?.message || 'Tidak bisa terhubung ke layanan pengiriman' }
    }
  }

  const handleSingleBotSend = async (participant) => {
    toast.info('Mengirim...', `Meneruskan tiket ${participant.name} ke layanan pengiriman`);
    const result = await sendTicketViaBot(participant);
    if (result?.success) toast.success('Terkirim!', `Tiket berhasil masuk antrean kirim untuk ${participant.name}`);
    else toast.error('Gagal', humanizeUserMessage(result?.error, { fallback: 'Layanan pengiriman sedang tidak aktif.' }));
  }

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
    let s = 0; let f = 0;
    const failureReasons = []
    for (let i = 0; i < targetParticipants.length; i++) {
      setBroadcastProgress(prev => ({ ...prev, current: i + 1 }));
      const result = await sendTicketViaBot(targetParticipants[i]);
      if (result?.success) {
        s++
      } else {
        f++
        if (failureReasons.length < 3) {
          failureReasons.push(humanizeUserMessage(result?.error, { fallback: 'Pengiriman gagal tanpa alasan terinci.' }))
        }
      }
      // Artificial delay 2.5 seconds to prevent WA Ban
      if (i < targetParticipants.length - 1) {
        await new Promise(r => setTimeout(r, 2500));
      }
    }
    setBroadcastProgress(prev => ({ ...prev, success: s, failed: f }));
    if (f > 0) {
      const reasonText = failureReasons.length > 0 ? ` Alasan utama: ${failureReasons.join(' | ')}` : ''
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

  const validateImportRows = (rows) => {
    const invalidDayRows = []
    rows.forEach((row, index) => {
      const dayValue = getRowDayValue(row)
      if (dayValue === undefined || dayValue === null || String(dayValue).trim() === '') return
      const parsed = Number(dayValue)
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
      const preferredIdx = names.findIndex((n) => String(n || '').trim().toLowerCase() === 'template peserta')
      const sheetName = preferredIdx >= 0 ? names[preferredIdx] : names[0]
      const sheet = workbook.Sheets[sheetName]
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, blankrows: false })
      const rows = rawRows.map(sanitizeImportRowKeys).filter((r) => r && Object.keys(r).length > 0)

      if (rows.length === 0) {
        toast.error('File kosong', 'Tidak ada data di file Excel')
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

  const executeImportRows = (rows, invalidDayRows = [], manualDay = null) => {
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
      result = bulkAddParticipants(
        finalRows,
        dayFilter,
        user,
        { duplicatesPolicy: importDuplicatePolicy, matchBy: 'phone' }
      );
      console.log('[IMPORT DEBUG] Hasil bulkAddParticipants:', result);
    } catch (err) {
      console.error('[import]', err);
      toast.error('Import gagal', err?.message || 'Terjadi kesalahan saat memproses baris. Coba lagi atau kurangi jumlah baris.');
      return;
    }
    setImportResult(result);
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
    // Refresh participant list with the correct day
    setParticipants(getParticipants(listDay));
  }

  const confirmImport = () => {
    if (!importPreview) return
    executeImportRows(importPreview.rows, importPreview.invalidDayRows || [])
    setImportManualDay('')
    // Tambahkan input manual hari pada modal import jika diperlukan
    // (Letakkan pada komponen/modal import Excel)
    // Contoh:
    // {importPreview?.allNoDay && (
    //   <div style={{margin: '12px 0'}}>
    //     <label>Pilih Hari untuk Semua Peserta: </label>
    //     <select value={importManualDay} onChange={e => setImportManualDay(e.target.value)}>
    //       <option value="">Pilih Hari</option>
    //       {availableDays.map((d) => (
    //         <option key={d} value={d}>{`Hari ${d}`}</option>
    //       ))}
    //     </select>
    //   </div>
    // )}
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
        { nama: 'Budi Santoso', telepon: '081234567890', kategori: 'Dealer', hari: 1, 'Tanggal Lahir': '1990-01-01', Catatan: 'VIP' },
        { nama: 'Citra Dewi', telepon: '089876543210', kategori: 'VIP', hari: 2, 'Tanggal Lahir': '1992-03-10', Catatan: '' },
        { nama: 'Dian Pratama', telepon: '08111222333', kategori: 'Regular', hari: 3, 'Tanggal Lahir': '1995-07-21', Catatan: '' },
        { nama: 'Eko Wahyudi', telepon: '082233445566', kategori: 'Media', hari: 1, 'Tanggal Lahir': '1988-11-02', Catatan: '' },
        { nama: 'Fajar Nugraha', telepon: '081998877665', kategori: 'Regular', hari: 2, 'Tanggal Lahir': '1991-05-15', Catatan: '' },
        { nama: 'Gita Pertiwi', telepon: '083811223344', kategori: 'VIP', hari: 3, 'Tanggal Lahir': '1993-09-09', Catatan: 'Prioritas' },
        { nama: 'Hendra Saputra', telepon: '085700112233', kategori: 'Dealer', hari: 4, 'Tanggal Lahir': '1989-12-28', Catatan: '' },
        { nama: 'Intan Maharani', telepon: '082122334455', kategori: 'Media', hari: 5, 'Tanggal Lahir': '1994-02-17', Catatan: '' }
      ]
      
      const ws = XLSX.utils.json_to_sheet(templateData)
      const guideData = [
        { kolom: 'nama', wajib: 'Ya', keterangan: 'Nama lengkap peserta', contoh: 'Budi Santoso' },
        { kolom: 'telepon', wajib: 'Tidak', keterangan: 'Nomor WA peserta', contoh: '081234567890' },
        { kolom: 'kategori', wajib: 'Tidak', keterangan: 'Kategori peserta: boleh sesuai kategori Anda (bebas). Sistem menampilkan nama kategori apa adanya.', contoh: 'VIP / Kelas A / Premium' },
        { kolom: 'hari', wajib: 'Tidak', keterangan: 'Hari tiket (angka, minimal 1). Jika kosong, pakai hari default filter', contoh: '2' },
        { kolom: 'Tanggal Lahir', wajib: 'Tidak', keterangan: 'Opsional. Akan masuk sebagai Data Tambahan dan bisa diubah di daftar peserta.', contoh: '1990-01-01' },
        { kolom: 'Catatan', wajib: 'Tidak', keterangan: 'Opsional. Akan masuk sebagai Data Tambahan dan bisa diubah di daftar peserta.', contoh: 'VIP' },
        { kolom: 'Kolom lain', wajib: 'Tidak', keterangan: 'Kolom selain yang dikenali akan disimpan sebagai Data Tambahan (contoh: Alamat, Golongan, dll).', contoh: 'Alamat' }
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

  // Import Modal Component
  const ImportModal = () => {
    if (!showImportModal) return null

    return (
      <div className="modal-overlay" onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null) }}>
        <div className="modal import-modal" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3 className="modal-title modal-title-inline">
              <FileSpreadsheet size={18} /> Import Peserta
            </h3>
            <button className="modal-close" onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null) }}><X size={14} /></button>
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
                    <div className="import-preview-file-count">{importPreview.rows.length} baris data</div>
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
                  Duplikat dipadankan berdasarkan <strong>nomor telepon/WA</strong>.
                </div>
                <div className="form-group" style={{ marginTop: 10 }}>
                  <label className="form-label" style={{ marginBottom: 6 }}>Tindakan saat duplikat ditemukan</label>
                  <select
                    className="form-select"
                    value={importDuplicatePolicy}
                    onChange={(e) => setImportDuplicatePolicy(e.target.value)}
                  >
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
                  Kolom yang didukung: <strong>nama/name</strong>, <strong>telepon/phone</strong>, <strong>kategori/category</strong>, <strong>hari/day/day_number</strong>. <strong>Kategori bebas</strong> (contoh: VIP, Dealer, Kelas A, Premium, dll).
                  <br />
                  Kolom lain yang tidak dikenali (contoh: <strong>Tanggal Lahir</strong>) akan otomatis disimpan sebagai <strong>Data Tambahan</strong>.
                </p>
              </>
            ) : null}
          </div>
          <div className="modal-footer">
            {importResult ? (
              <button className="btn btn-primary flex-1" onClick={() => { setShowImportModal(false); setImportResult(null); setImportPreview(null) }}>Selesai</button>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={() => { setShowImportModal(false); setImportPreview(null) }}>Batal</button>
                <button
                  className="btn btn-primary btn-inline-icon"
                  onClick={confirmImport}
                >
                  <Upload size={14} /> Import {importPreview?.rows.length} Peserta
                </button>
              </>
            )}
          </div>
        </div>
      </div>
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
                <label className="form-label">Nama</label>
                <input className="form-input" value={editData.name} onChange={e => setEditData({ ...editData, name: e.target.value })} required autoFocus />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Telepon (WA)</label>
                  <input className="form-input" value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" type="email" value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Hari Tiket</label>
                  <input
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
                  <label className="form-label">Kategori (bebas)</label>
                  <input className="form-input" value={editData.category} onChange={e => setEditData({ ...editData, category: e.target.value })} />
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
            className="form-input m-participant-search-input"
            placeholder="Cari nama atau tiket..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="m-filter-chips">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <select className="m-filter-select" value={dayFilter} onChange={e => handleDayFilterChange(Number(e.target.value))}>
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
            visibleParticipants.map(p => (
              <div key={p.id} className="m-participant-card">
                <div className={`m-p-avatar ${p.is_checked_in ? 'm-p-avatar-checked' : 'm-p-avatar-pending'}`}>
                  {p.is_checked_in ? <CheckCircle size={16} /> : p.name.charAt(0)}
                </div>
                <div className="m-p-info">
                  <div className="m-p-name">{p.name}</div>
                  <div className="m-p-meta">
                    <span className={`badge ${getCategoryBadge(p.category)}`}>{p.category}</span>
                    <span className="m-p-ticket">{p.ticket_id}</span>
                  </div>
                  {getMetaPreview(p.meta) && (
                    <div className="m-p-extra">{getMetaPreview(p.meta)}</div>
                  )}
                  {p.checked_in_at && (
                    <div className="m-p-time">
                      Check-in {new Date(p.checked_in_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
                <div className="m-p-actions">
                  <button className="m-p-delete m-p-delete-bot" onClick={() => handleSingleBotSend(p)} title="Kirim otomatis">
                    <Bot size={16} />
                  </button>
                  <a href={getWhatsAppShareLink(p)} target="_blank" rel="noopener noreferrer" className="m-p-delete m-p-delete-wa" title="Kirim WA">
                    <MessageCircle size={16} />
                  </a>
                  <button className="m-p-delete m-p-delete-edit" onClick={() => openEditParticipant(p)} title="Ubah data">
                    <Edit3 size={16} />
                  </button>
                  <button className="m-p-delete" onClick={() => handleDelete(p)} title="Hapus">
                    <Trash2 size={16} />
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
                  <div className="form-group"><label className="form-label">Nama</label><input className="form-input" placeholder="Nama lengkap" value={newParticipant.name} onChange={e => setNewParticipant({ ...newParticipant, name: e.target.value })} required autoFocus /></div>
                  <div className="form-group"><label className="form-label">Telepon (WA)</label><input className="form-input" placeholder="08xxx (untuk WA)" value={newParticipant.phone} onChange={e => setNewParticipant({ ...newParticipant, phone: e.target.value })} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" placeholder="email@contoh.com" value={newParticipant.email} onChange={e => setNewParticipant({ ...newParticipant, email: e.target.value })} /></div>
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
                  <label className="form-label">Alasan Penghapusan <span style={{color: 'red'}}>*</span></label>
                  <textarea className="form-input" placeholder="Masukkan alasan minimal 15 karakter" value={deleteReason} onChange={e => setDeleteReason(e.target.value)} rows={3} required />
                </div>
                <div className="form-group mt-16">
                  <label className="form-label">Konfirmasi Kedua <span style={{color: 'red'}}>*</span></label>
                  <input className="form-input" placeholder="Ketik SETUJU untuk melanjutkan" value={deleteApproval} onChange={e => setDeleteApproval(e.target.value)} required />
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
          <input placeholder="Cari nama atau ID tiket..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select select-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
          <option value="all">Semua Kategori</option>
          {dynamicCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <select className="form-select select-sm" value={dayFilter} onChange={e => handleDayFilterChange(Number(e.target.value))}>
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
        <select className="form-select select-md" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
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
    </div>
  )
}
