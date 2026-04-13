// ===== REAL FUNCTIONS FOR WA DELIVERY =====
import { fetchWorkspaceSnapshot } from '../../lib/dataSync';
let _workspaceSnapshot = null;
async function bootstrapStoreFromServer() {
  _workspaceSnapshot = await fetchWorkspaceSnapshot();
  return _workspaceSnapshot;
}
function getParticipants(day) {
  if (!_workspaceSnapshot || !_workspaceSnapshot.store) return [];
  const tenantId = 'tenant-default';
  const eventId = 'event-default';
  const participants =
    _workspaceSnapshot.store.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
  if (typeof day === 'number') {
    return participants.filter((p) => Number(p.day) === Number(day) || Number(p.day_number) === Number(day));
  }
  return participants;
}
function getActiveTenant() { return { id: 'tenant-default' }; }
function getCurrentDay() { return 1; }
function getWaSendMode() { return 'message_only'; }

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, Send, AlertTriangle, CheckCircle2, XCircle, RotateCcw, ClipboardList } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/useAuth'
import { apiFetch } from '../../utils/api'
import { humanizeUserMessage } from '../../utils/userFriendlyMessage'
import { useWaStatus } from '../../hooks/useWaStatus'
import WaConnectBanner from '../../components/WaConnectBanner'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import { generateWaMessage } from '../../utils/whatsapp'
import { supabase } from '../../lib/supabase'
import { generateQRData } from '../../utils/qrSecurity'

// Load participants dari Supabase dengan filter day
async function _loadParticipantsFromSupabase(day) {
  try {
    let query = supabase.from('participants').select('*').order('nama', { ascending: true });
    if (typeof day === 'number') {
      // Cek multiple field names: hari, day, day_number
      query = query.or(`hari.eq.${day},day.eq.${day},day_number.eq.${day}`);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    // Filter manual untuk memastikan day yang benar
    if (typeof day === 'number' && data) {
      return data.filter(p => 
        Number(p.hari) === day || 
        Number(p.day) === day || 
        Number(p.day_number) === day
      );
    }
    return data || [];
  } catch (err) {
    console.error('Failed to load from Supabase:', err);
    return getParticipants(day);
  }
}

// Helper untuk fetch peserta langsung dari Supabase by ticket ID
async function fetchParticipantByTicketId(ticketId) {
  try {
    const { data, error } = await supabase
      .from('participants')
      .select('*')
      .eq('ticket_id', ticketId)
      .single()
    if (error) throw error
    return data
  } catch (e) {
    console.error('[fetchParticipantByTicketId] Error:', e)
    return null
  }
}

// ===== ULTRA-RELIABLE BOT SYSTEM =====
// Exponential backoff delays: 1s, 2s, 4s, 8s (max 4 retries)
const RETRY_DELAYS = [1000, 2000, 4000, 8000];
const MAX_RETRIES = 4;

// Pre-validate participant data before sending
function validateParticipant(participant) {
  const errors = [];
  if (!participant) {
    errors.push('Peserta tidak ditemukan');
    return { valid: false, errors };
  }
  if (!participant.ticket_id) {
    errors.push('Ticket ID kosong');
  }
  if (!participant.phone || !normalizePhone(participant.phone)) {
    errors.push('Nomor WhatsApp tidak valid');
  }
  if (!participant.qr_data || String(participant.qr_data).trim().length === 0) {
    errors.push('QR data kosong - generate ulang tiket');
  }
  return { 
    valid: errors.length === 0, 
    errors,
    participant: {
      ...participant,
      phone: normalizePhone(participant.phone)
    }
  };
}

// Smart retry dengan exponential backoff
async function sendWithRetry(sendFn, maxRetries = MAX_RETRIES) {
  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await sendFn();
      if (result?.success) {
        return { success: true, attempts: attempt + 1, result };
      }
      // Jika error tidak bisa di-retry (misal nomor tidak valid), langsung return
      if (result?.error && isNonRetryableError(result.error)) {
        return { success: false, attempts: attempt + 1, error: result.error, result };
      }
      lastError = result?.error || 'Unknown error';
    } catch (err) {
      lastError = err?.message || 'Network error';
      // Jika network error yang spesifik, retry
      if (!isNetworkError(lastError)) {
        return { success: false, attempts: attempt + 1, error: lastError };
      }
    }
    
    // Delay sebelum retry (kecuali attempt terakhir)
    if (attempt < maxRetries) {
      const delay = RETRY_DELAYS[Math.min(attempt, RETRY_DELAYS.length - 1)];
      console.log(`[Retry ${attempt + 1}/${maxRetries}] Waiting ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  
  return { success: false, attempts: maxRetries + 1, error: lastError };
}

// Error yang tidak perlu di-retry (permanent error)
function isNonRetryableError(error) {
  const nonRetryable = [
    'nomor tidak valid',
    'tidak terdaftar',
    'bukan user whatsapp',
    'invalid phone',
    'not a whatsapp user',
    'qr data tidak tersedia',
    'qr data kosong',
    'empty_qr_data',
    'invalid_qr_payload',
    'qr data tidak valid'
  ];
  const errLower = String(error).toLowerCase();
  return nonRetryable.some(keyword => errLower.includes(keyword));
}

// Error network yang bisa di-retry
function isNetworkError(error) {
  const networkErrors = [
    'timeout',
    'network',
    'connection',
    'econnrefused',
    'fetch failed',
    'aborted'
  ];
  const errLower = String(error).toLowerCase();
  return networkErrors.some(keyword => errLower.includes(keyword));
}

function formatTime(value) {
  try { return new Date(value).toLocaleString('id-ID') } catch { return '-' }
}

function normalizePhone(value) {
  return String(value || '').replace(/\s+/g, '').trim()
}

function statusTone(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'success') return 'badge-green'
  if (s === 'failed') return 'badge-red'
  return 'badge-gray'
}

export default function WaDelivery() {
    // Initial load peserta dari Supabase
    useEffect(() => {
      const load = async () => {
        await bootstrapStoreFromServer();
      };
      load();
    }, []);
  const resolveTenantId = (userValue) => {
    const fromStore = String(getActiveTenant()?.id || '').trim()
    if (fromStore) return fromStore
    return String(userValue?.tenant?.id || 'tenant-default').trim() || 'tenant-default'
  }
  const getIsMobileLayout = () => {
    if (typeof window === 'undefined') return false
    const isNarrow = window.matchMedia('(max-width: 768px)').matches
    const isTouch = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
    return isNarrow && isTouch
  }

  const toast = useToast()
  const { user } = useAuth()
  const [tenantId, setTenantId] = useState(() => resolveTenantId(user))

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

  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(false)
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 180)
  const [statusFilter, setStatusFilter] = useState('all') // all|success|failed|unregistered
  const [expanded, setExpanded] = useState(null)
  const [retryingKey, setRetryingKey] = useState('')
  const waConn = useWaStatus({ tenantId })

  const [isMobile, setIsMobile] = useState(getIsMobileLayout())
  useEffect(() => {
    const h = () => setIsMobile(getIsMobileLayout())
    window.addEventListener('resize', h)
    window.addEventListener('orientationchange', h)
    return () => {
      window.removeEventListener('resize', h)
      window.removeEventListener('orientationchange', h)
    }
  }, [])

  const [batchSending, setBatchSending] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0, success: 0, failed: 0 })
  const [lastBatchFailed, setLastBatchFailed] = useState([]) // Simpan hasil gagal dari batch terakhir
  const [regeneratingQR, setRegeneratingQR] = useState(false)
  const [qrRegenProgress, setQrRegenProgress] = useState({ current: 0, total: 0 })
  const [syncingToGates, setSyncingToGates] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`/api/wa/send-log?tenant_id=${encodeURIComponent(tenantId)}&limit=250`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      setLogs(Array.isArray(data?.logs) ? data.logs : [])
    } catch (err) {
      toast.error('Gagal memuat', humanizeUserMessage(err?.message, { fallback: 'Tidak bisa memuat riwayat pengiriman.' }))
      setLogs([])
    } finally {
      setLoading(false)
    }
  }, [tenantId, toast])

  useEffect(() => { loadLogs() }, [loadLogs])

  // WA status polling handled by useWaStatus()

  const flattened = useMemo(() => {
    const rows = []
    logs.forEach((entry, idx) => {
      const ticketId = String(entry?.ticket_id || '-')
      const name = String(entry?.name || '')
      const when = entry?.time
      const category = String(entry?.category || '-')
      const day = entry?.day_number
      const mode = String(entry?.wa_send_mode || '')
      const results = Array.isArray(entry?.results) ? entry.results : []
      results.forEach((r, rIdx) => {
        rows.push({
          key: `${idx}:${rIdx}`,
          entryIndex: idx,
          time: when,
          ticket_id: ticketId,
          name,
          category,
          day_number: day,
          wa_send_mode: mode,
          phone: r?.phone,
          status: r?.status,
          error: r?.error || null,
          error_code: r?.error_code || null,
          msgId: r?.msgId || null
        })
      })
    })
    return rows
  }, [logs])

  const filtered = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase()
    return flattened.filter(row => {
      if (statusFilter === 'unregistered') {
        if (String(row.error_code || '').toLowerCase() !== 'wa_number_not_registered') return false
      } else if (statusFilter !== 'all' && String(row.status || '').toLowerCase() !== statusFilter) {
        return false
      }
      if (!q) return true
      const hay = `${row.ticket_id} ${row.name} ${row.phone} ${row.category} ${row.day_number} ${row.error || ''} ${row.error_code || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [flattened, debouncedQuery, statusFilter])

  const summary = useMemo(() => {
    let success = 0
    let failed = 0
    filtered.forEach(r => {
      const s = String(r.status || '').toLowerCase()
      if (s === 'success') success++
      else if (s === 'failed') failed++
    })
    return { success, failed, total: filtered.length }
  }, [filtered])

  const buildWaMessage = (participant) => generateWaMessage(participant)

  const retrySend = async ({ ticket_id, phone, wa_send_mode }) => {
    if (!waConn.isReady) {
      toast.error('WhatsApp belum tersambung', 'Sambungkan perangkat dulu agar pengiriman ulang bisa berjalan.')
      return
    }
    setRetryingKey(String(ticket_id))
    
    // Fetch peserta langsung dari Supabase (real-time, tidak bergantung snapshot)
    const p = await fetchParticipantByTicketId(ticket_id)
    
    // Pre-validate sebelum kirim (hindari error di tengah jalan)
    const validation = validateParticipant(p)
    if (!validation.valid) {
      toast.error('Validasi gagal', validation.errors.join(', '))
      setRetryingKey('')
      return
    }
    
    const validatedParticipant = validation.participant
    const targetPhone = phone ? normalizePhone(phone) : validatedParticipant.phone
    const key = `${ticket_id}:${targetPhone}`
    
    if (retryingKey) {
      setRetryingKey('')
      return
    }
    setRetryingKey(key)
    
    try {
      const tenantIdNow = resolveTenantId(user)
      
      // Kirim dengan Smart Retry System (exponential backoff)
      const result = await sendWithRetry(async () => {
        const body = {
          ...validatedParticipant,
          tenant_id: tenantIdNow,
          phone: targetPhone,
          send_wa: true,
          send_email: false,
          wa_message: buildWaMessage(validatedParticipant),
          wa_send_mode: (wa_send_mode === 'message_with_barcode' || wa_send_mode === 'message_only')
            ? wa_send_mode
            : getWaSendMode()
        }
        
        const res = await apiFetch('/api/send-ticket', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        })
        const data = await res.json().catch(() => ({}))
        
        if (!res.ok || data?.success === false) {
          return { success: false, error: data?.error || `HTTP ${res.status}` }
        }
        // Cek hasil sebenarnya dari WA
        const waResult = data?.results?.wa?.[0]
        if (waResult?.status !== 'Success') {
          return { 
            success: false, 
            error: waResult?.error || 'Pengiriman gagal' 
          }
        }
        return { success: true, data, msgId: waResult?.msgId }
      })
      
      if (result.success) {
        toast.success(
          'Terkirim!', 
          `${p.name || ticket_id} berhasil (attempt ${result.attempts})`
        )
        await loadLogs()
      } else {
        toast.error(
          'Gagal mengirim', 
          `${p.name || ticket_id}: ${humanizeUserMessage(result.error, { fallback: 'Gagal setelah ' + result.attempts + ' percobaan' })}`
        )
      }
    } catch (err) {
      toast.error('Gagal mengirim ulang', humanizeUserMessage(err?.message, { fallback: 'Pengiriman ulang gagal.' }))
    } finally {
      setRetryingKey('')
    }
  }

  const retryBatchFailed = async () => {
    if (!waConn.isReady) {
      toast.error('WhatsApp belum tersambung', 'Sambungkan perangkat dulu agar retry massal bisa berjalan.')
      return
    }
    const failedRows = filtered.filter(r => String(r.status || '').toLowerCase() === 'failed').slice(0, 30)
    
    if (failedRows.length === 0) {
      toast.info('Tidak ada yang perlu di-retry', 'Semua pengiriman sudah berhasil.')
      return
    }
    
    const ok = window.confirm(`Coba ulang ${failedRows.length} pengiriman yang gagal?`)
    if (!ok) return
    
    // Process concurrently with batching for faster delivery
    const batchSize = 5
    let processed = 0
    for (let i = 0; i < failedRows.length; i += batchSize) {
      const batch = failedRows.slice(i, i + batchSize)
      
      // Process batch concurrently
      await Promise.all(
        batch.map(row => retrySend({ 
          ticket_id: row.ticket_id, 
          phone: row.phone, 
          wa_send_mode: row.wa_send_mode 
        }))
      )
      
      // Update progress
      processed += batch.length
      toast.info('Progress', `${processed}/${failedRows.length} pengiriman diproses...`)
    }
    await loadLogs()
  }

  // BATCH SEND ALL - Kirim ke semua peserta yang belum dikirim
  const sendBatchToAll = async () => {
    if (!waConn.isReady) {
      toast.error('WhatsApp belum tersambung', 'Sambungkan perangkat dulu agar pengiriman bisa berjalan.')
      return
    }

    // Ambil semua peserta dari Firebase/Supabase
    const participants = getParticipants(getCurrentDay())
    
    if (participants.length === 0) {
      toast.info('Tidak ada peserta', 'Tidak ditemukan peserta untuk dikirim.')
      return
    }

    // Filter hanya yang punya nomor WA valid, QR data, dan BELUM dikirim
    let skippedPhone = 0, skippedQr = 0, skippedSent = 0
    const validParticipants = participants.filter(p => {
      const phone = normalizePhone(p.phone || p.whatsapp || p.wa || '')
      const hasPhone = phone && phone.length >= 10
      const hasQrData = p.qr_data && String(p.qr_data).trim().length > 0
      const alreadySent = p.wa_sent_at && new Date(p.wa_sent_at).getTime() > 0
      if (!hasPhone) skippedPhone++
      if (!hasQrData) skippedQr++
      if (alreadySent) skippedSent++
      return hasPhone && hasQrData && !alreadySent
    })
    
    console.log(`[sendBatchToAll] Total: ${participants.length}, Valid: ${validParticipants.length}, Filtered out: ${participants.length - validParticipants.length}`)
    console.log(`[sendBatchToAll] Filtered: noPhone=${skippedPhone}, noQR=${skippedQr}, alreadySent=${skippedSent}`)

    if (validParticipants.length === 0) {
      toast.error('Tidak ada peserta valid', `Dari ${participants.length} peserta, tidak ada yang memiliki nomor WhatsApp valid dan QR data. Pastikan semua peserta sudah generate tiket.`)
      return
    }

    const estTimeMinutes = Math.ceil((validParticipants.length * 7) / 60)
    const ok = window.confirm(
      `Kirim tiket ke ${validParticipants.length} peserta?\n\n` +
      `Estimasi waktu: ~${estTimeMinutes} menit\n` +
      `• 3 pesan per batch\n` +
      `• Delay 2 detik antar pesan\n` +
      `• Delay 5 detik antar batch\n\n` +
      `Ini untuk menghindari rate limit WhatsApp.`
    )
    if (!ok) return

    setBatchSending(true)
    setBatchProgress({ current: 0, total: validParticipants.length, success: 0, failed: 0 })

    const batchSize = 3
    const delayBetweenMessages = 2000
    const delayBetweenBatches = 5000
    let successCount = 0
    let failedCount = 0
    const failedList = [] // Simpan detail yang gagal

    for (let i = 0; i < validParticipants.length; i += batchSize) {
      const batch = validParticipants.slice(i, i + batchSize)
      
      // Process batch sequentially (NOT concurrently) to avoid rate limit
      for (const p of batch) {
        try {
          // Pre-validate
          const validation = validateParticipant(p)
          if (!validation.valid) {
            failedCount++
            continue
          }
          const validated = validation.participant

          // Send with retry
          const result = await sendWithRetry(async () => {
            const body = {
              ...validated,
              tenant_id: tenantId,
              phone: validated.phone,
              send_wa: true,
              send_email: false,
              wa_message: buildWaMessage(validated),
              wa_send_mode: getWaSendMode()
            }
            const res = await apiFetch('/api/send-ticket', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            })
            const data = await res.json().catch(() => ({}))
            if (!res.ok || data?.success === false) {
              return { success: false, error: data?.error || `HTTP ${res.status}` }
            }
            // Cek hasil sebenarnya dari WA - server selalu return success: true
            // tapi kita harus cek results.wa[0].status untuk tahu berhasil/gagal
            const waResult = data?.results?.wa?.[0]
            if (waResult?.status !== 'Success') {
              return { 
                success: false, 
                error: waResult?.error || 'Pengiriman gagal (tidak ada konfirmasi sukses dari WhatsApp)' 
              }
            }
            return { success: true, data, msgId: waResult?.msgId }
          })

          if (result.success) {
            successCount++
            // Update wa_sent_at di Supabase untuk tracking
            try {
              await supabase
                .from('participants')
                .update({ wa_sent_at: new Date().toISOString() })
                .eq('ticket_id', p.ticket_id)
              console.log(`[sendBatchToAll] Marked as sent: ${p.ticket_id}`)
            } catch (updateErr) {
              console.error(`[sendBatchToAll] Failed to update wa_sent_at for ${p.ticket_id}:`, updateErr)
            }
          } else {
            failedCount++
            // Simpan detail yang gagal untuk retry nanti
            failedList.push({
              ticket_id: p.ticket_id,
              phone: p.phone,
              name: p.name,
              wa_send_mode: getWaSendMode(),
              error: result.error || 'Unknown error',
              timestamp: new Date().toISOString()
            })
          }
          
          // Update progress
          const processed = Math.min(i + batch.indexOf(p) + 1, validParticipants.length)
          setBatchProgress({ current: processed, total: validParticipants.length, success: successCount, failed: failedCount })
          
          // Delay antar pesan dalam batch
          if (batch.indexOf(p) < batch.length - 1) {
            await new Promise(r => setTimeout(r, delayBetweenMessages))
          }
        } catch (err) {
          failedCount++
          // Simpan detail yang gagal
          failedList.push({
            ticket_id: p.ticket_id,
            phone: p.phone,
            name: p.name,
            wa_send_mode: getWaSendMode(),
            error: err?.message || 'Network error',
            timestamp: new Date().toISOString()
          })
          console.error('[sendBatchToAll] Error:', err)
        }
      }

      toast.info('Progress Pengiriman', `${Math.min(i + batchSize, validParticipants.length)}/${validParticipants.length} diproses (Sukses: ${successCount}, Gagal: ${failedCount})`)
      
      // Delay antar batch (kecuali batch terakhir)
      if (i + batchSize < validParticipants.length) {
        toast.info('Cooldown', `Menunggu ${delayBetweenBatches/1000} detik untuk menghindari rate limit...`)
        await new Promise(r => setTimeout(r, delayBetweenBatches))
      }
    }

    setBatchSending(false)
    setLastBatchFailed(failedList) // Simpan ke state untuk ditampilkan
    await loadLogs()

    // Final summary
    if (failedCount === 0) {
      toast.success('Pengiriman Selesai!', `${successCount}/${validParticipants.length} berhasil dikirim.`)
      setLastBatchFailed([]) // Clear jika semua sukses
    } else {
      toast.warning('Pengiriman Selesai Sebagian', `Berhasil: ${successCount}, Gagal: ${failedCount}. Lihat daftar "Yang Gagal di Batch Terakhir" di bawah.`)
    }
  }

  // Retry yang gagal dari batch terakhir
  const retryLastBatchFailed = async () => {
    if (!waConn.isReady) {
      toast.error('WhatsApp belum tersambung', 'Sambungkan perangkat dulu.')
      return
    }
    if (lastBatchFailed.length === 0) {
      toast.info('Tidak ada yang perlu di-retry', 'Tidak ada data gagal dari batch terakhir.')
      return
    }

    const ok = window.confirm(`Retry ${lastBatchFailed.length} pengiriman yang gagal dari batch terakhir?`)
    if (!ok) return

    let newFailedList = []
    let successCount = 0

    for (const item of lastBatchFailed) {
      try {
        const result = await sendWithRetry(async () => {
          const body = {
            ticket_id: item.ticket_id,
            phone: item.phone,
            tenant_id: tenantId,
            send_wa: true,
            send_email: false,
            wa_message: buildWaMessage({ ticket_id: item.ticket_id, phone: item.phone, name: item.name }),
            wa_send_mode: item.wa_send_mode || getWaSendMode()
          }
          const res = await apiFetch('/api/send-ticket', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok || data?.success === false) {
            return { success: false, error: data?.error || `HTTP ${res.status}` }
          }
          // Cek hasil sebenarnya dari WA
          const waResult = data?.results?.wa?.[0]
          if (waResult?.status !== 'Success') {
            return { 
              success: false, 
              error: waResult?.error || 'Pengiriman gagal' 
            }
          }
          return { success: true, data, msgId: waResult?.msgId }
        })

        if (result.success) successCount++
        else {
          newFailedList.push({ ...item, error: result.error, timestamp: new Date().toISOString() })
        }
        
        // Delay antar retry
        await new Promise(r => setTimeout(r, 2000))
      } catch (err) {
        newFailedList.push({ ...item, error: err?.message || 'Network error', timestamp: new Date().toISOString() })
      }
    }

    setLastBatchFailed(newFailedList)
    await loadLogs()

    if (newFailedList.length === 0) {
      toast.success('Retry Selesai!', `Semua ${successCount} pengiriman berhasil!`)
    } else {
      toast.warning('Retry Selesai', `Berhasil: ${successCount}, Masih gagal: ${newFailedList.length}. Coba lagi nanti.`)
    }
  }

  // REGENERASI QR MASSAL - Hanya untuk peserta yang QR-nya kosong
  const regenerateAllQR = async () => {
    const ok = window.confirm(
      'Generate QR untuk peserta yang belum punya QR?\n\n' +
      'Ini akan memeriksa SEMUA peserta dan generate QR untuk yang masih kosong.'
    )
    if (!ok) return

    setRegeneratingQR(true)
    setQrRegenProgress({ current: 0, total: 0 })

    try {
      // Ambil semua peserta
      const { data: participants, error } = await supabase
        .from('participants')
        .select('*')

      if (error) throw error
      if (!participants || participants.length === 0) {
        toast.info('Tidak ada peserta', 'Tidak ditemukan peserta di database')
        setRegeneratingQR(false)
        return
      }

      // Filter hanya yang tidak punya QR data
      const needQR = participants.filter(p => !p.qr_data || String(p.qr_data).trim().length === 0)
      
      if (needQR.length === 0) {
        toast.success('Semua peserta sudah punya QR', `Dari ${participants.length} peserta, semua sudah memiliki QR data.`)
        setRegeneratingQR(false)
        return
      }

      toast.info('Generate QR Dimulai', `${needQR.length} dari ${participants.length} peserta perlu QR data.`)
      setQrRegenProgress({ current: 0, total: needQR.length })

      let updated = 0
      let failed = 0
      const TENANT_ID = 'tenant-default'
      const EVENT_ID = 'event-default'

      for (let i = 0; i < needQR.length; i++) {
        const p = needQR[i]
        
        // Generate QR data baru (day default 1 kalau tidak ada)
        const dayNumber = p.day_number || p.day || p.hari || 1
        const qrData = generateQRData({
          ticket_id: p.ticket_id,
          name: p.nama || p.name,
          day_number: dayNumber
        }, TENANT_ID, EVENT_ID)

        if (!qrData) {
          console.error(`[regenerateAllQR] Gagal generate QR untuk ${p.ticket_id}`)
          failed++
          setQrRegenProgress({ current: i + 1, total: needQR.length })
          continue
        }

        // Update ke database
        const { error: updateError } = await supabase
          .from('participants')
          .update({ 
            qr_data: qrData,
            updated_at: new Date().toISOString()
          })
          .eq('ticket_id', p.ticket_id)

        if (updateError) {
          console.error(`[regenerateAllQR] Gagal update ${p.ticket_id}:`, updateError)
          failed++
        } else {
          updated++
        }

        setQrRegenProgress({ current: i + 1, total: needQR.length })
        
        // Delay kecil untuk menghindari rate limit
        if (i % 10 === 0) {
          await new Promise(r => setTimeout(r, 100))
        }
      }

      toast.success(
        'Regenerasi QR Selesai!',
        `Berhasil: ${updated}, Gagal: ${failed}. Sekarang bisa kirim WA ke semua peserta.`
      )
      
      // Refresh participants data
      await bootstrapStoreFromServer()
    } catch (err) {
      toast.error('Gagal regenerasi QR', err?.message || 'Terjadi kesalahan saat regenerasi QR')
    } finally {
      setRegeneratingQR(false)
    }
  }

  // SYNC TO GATES - Memaksa sinkronisasi data ke semua gate
  const syncToGates = async () => {
    setSyncingToGates(true)
    try {
      const res = await apiFetch('/api/sync-to-gates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          reason: 'manual_sync_from_admin'
        })
      })
      const data = await res.json().catch(() => ({}))
      
      if (res.ok && data?.success) {
        toast.success(
          'Sync ke Gate Berhasil!',
          `Data admin telah disinkronkan ke ${data.affected_clients || 'semua gate'}. Gate akan auto-refresh dalam 2-3 detik.`
        )
      } else {
        toast.error('Sync Gagal', data?.error || 'Gagal mengirim sinyal sync ke gate')
      }
    } catch (err) {
      toast.error('Sync Error', err?.message || 'Terjadi kesalahan saat sync ke gate')
    } finally {
      setSyncingToGates(false)
    }
  }

  // ===== LAPORAN / LIST MOBILE =====
  if (isMobile) {
    const visibleRows = filtered.slice(0, 250)

    return (
      <div className="page-container animate-fade-in-up">
        <div className="page-header">
          <div className="page-title-group">
            <span className="page-kicker">Operasional</span>
            <h1>WA Delivery</h1>
            <p>Pantau hasil kirim tiket via WhatsApp, lihat alasan gagal, dan lakukan pengiriman ulang.</p>
          </div>
          <div className="admin-actions-wrap">
            <button type="button" className="btn btn-primary" onClick={sendBatchToAll} disabled={batchSending || !waConn.isReady}>
              {batchSending ? (
                <><RefreshCw size={16} className="spinner" /> {batchProgress.current}/{batchProgress.total}</>
              ) : (
                <><Send size={16} /> Kirim ke Semua</>
              )}
            </button>
            <button type="button" className="btn btn-secondary" onClick={loadLogs} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spinner' : ''} /> Muat ulang
            </button>
            <button type="button" className="btn btn-ghost" onClick={retryBatchFailed} disabled={loading || retryingKey}>
              <RotateCcw size={16} /> Retry yang gagal
            </button>
            <button type="button" className="btn btn-warning" onClick={regenerateAllQR} disabled={regeneratingQR}>
              {regeneratingQR ? (
                <><RefreshCw size={16} className="spinner" /> QR {qrRegenProgress.current}/{qrRegenProgress.total}</>
              ) : (
                <><AlertTriangle size={16} /> Regenerasi QR</>
              )}
            </button>
            <button type="button" className="btn btn-info" onClick={syncToGates} disabled={syncingToGates}>
              {syncingToGates ? (
                <><RefreshCw size={16} className="spinner" /> Syncing...</>
              ) : (
                <><Send size={16} /> Sync ke Gate</>
              )}
            </button>
          </div>
        </div>

        {!waConn.isReady && (
          <WaConnectBanner
            wa={waConn}
            title="WhatsApp belum siap"
          />
        )}

        {/* Progress bar untuk regenerasi QR */}
        {regeneratingQR && (
          <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid var(--warning)' }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>Regenerasi QR Data...</span>
                <span>{qrRegenProgress.current}/{qrRegenProgress.total}</span>
              </div>
              <div className="progress-bar" style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div 
                  className="progress-bar-fill" 
                  style={{ 
                    width: `${qrRegenProgress.total > 0 ? (qrRegenProgress.current / qrRegenProgress.total) * 100 : 0}%`,
                    background: 'var(--warning)',
                    height: '100%',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Ringkasan Status Pengiriman - Tampilkan sebelum batch send */}
        {!batchSending && (
          <div className="card" style={{ marginBottom: 12, background: 'var(--bg-elevated)' }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                  Status Pengiriman Tiket
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={sendBatchToAll}
                  disabled={!waConn.isReady}
                >
                  <Send size={14} style={{ marginRight: 6 }} />
                  Kirim ke Yang Belum
                </button>
              </div>
              {(() => {
                const all = getParticipants(getCurrentDay())
                const sent = all.filter(p => p.wa_sent_at && new Date(p.wa_sent_at).getTime() > 0)
                const unsent = all.filter(p => !p.wa_sent_at || !new Date(p.wa_sent_at).getTime())
                const withQr = unsent.filter(p => p.qr_data && String(p.qr_data).trim().length > 0)
                const withPhone = withQr.filter(p => {
                  const phone = normalizePhone(p.phone || p.whatsapp || p.wa || '')
                  return phone && phone.length >= 10
                })
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                    <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--bg-primary)', borderRadius: 8 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{all.length}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Peserta</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--success-soft)', borderRadius: 8 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>{sent.length}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sudah Dikirim ✅</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--warning-soft)', borderRadius: 8 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--warning)' }}>{withPhone.length}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Siap Kirim 📤</div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '12px 8px', background: 'var(--danger-soft)', borderRadius: 8 }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>{unsent.length - withPhone.length}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Belum Siap ⚠️</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        )}

        {/* Progress bar untuk batch sending */}
        {batchSending && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontWeight: 600 }}>Mengirim pesan massal...</span>
                <span>{batchProgress.current}/{batchProgress.total}</span>
              </div>
              <div className="progress-bar" style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div 
                  className="progress-bar-fill" 
                  style={{ 
                    width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`,
                    background: 'var(--brand-primary)',
                    height: '100%',
                    transition: 'width 0.3s ease'
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.85rem' }}>
                <span className="badge badge-green text-xs">Sukses: {batchProgress.success}</span>
                <span className="badge badge-red text-xs">Gagal: {batchProgress.failed}</span>
              </div>
            </div>
          </div>
        )}

        {/* Daftar yang gagal dari batch terakhir - Mobile */}
        {!batchSending && lastBatchFailed.length > 0 && (
          <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid var(--danger)' }}>
            <div className="card-header" style={{ background: 'var(--danger-soft)', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', width: '100%' }}>
                <div>
                  <h3 className="card-title" style={{ color: 'var(--danger)', margin: 0, fontSize: '0.9rem' }}>
                    <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Gagal di Batch Terakhir ({lastBatchFailed.length})
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={retryLastBatchFailed}
                  disabled={!waConn.isReady}
                >
                  <RotateCcw size={14} /> Retry Semua
                </button>
              </div>
            </div>
            <div style={{ maxHeight: 250, overflow: 'auto', padding: 8 }}>
              {lastBatchFailed.map((item, idx) => (
                <div key={idx} style={{ 
                  padding: '10px 12px', 
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: 2 }}>{item.name || '-'}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {item.ticket_id} • {item.phone}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4 }}>
                      {item.error}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => retrySend({ ticket_id: item.ticket_id, phone: item.phone, wa_send_mode: item.wa_send_mode })}
                    disabled={!!retryingKey || !waConn.isReady}
                  >
                    <Send size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="admin-toolbar">
          <div className="admin-filters" style={{ marginBottom: 0 }}>
            <div className="admin-search-wrap">
              <Search size={16} className="admin-search-icon" />
              <input className="form-input" placeholder="Cari tiket / nama / nomor / alasan gagal…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
            <select className="form-select admin-select-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">Semua status</option>
              <option value="success">Sukses</option>
              <option value="failed">Gagal</option>
              <option value="unregistered">Nomor tidak terdaftar WA</option>
            </select>
            <div className="badge badge-gray" title="Ringkasan filter saat ini">
              Total: {summary.total} · Sukses: {summary.success} · Gagal: {summary.failed}
            </div>
          </div>
        </div>

        <div className="m-section">
          <div className="m-section-header">
            <span className="m-section-title">Riwayat pengiriman</span>
            <span className="badge badge-gray badge-xs">Hari: {getCurrentDay()}</span>
          </div>

          {visibleRows.length === 0 ? (
            <div className="m-empty">
              <span><ClipboardList size={28} /></span>
              <div style={{ marginTop: 4 }}>Belum ada riwayat pengiriman pada filter ini.</div>
            </div>
          ) : (
            <div className="m-activity-list">
              {visibleRows.map(row => {
                const s = String(row.status || '').toLowerCase()
                const isFailed = s === 'failed'
                const isOpen = expanded === row.key
                const avatarClass = s === 'success' ? 'm-activity-avatar-success' : 'm-activity-avatar-warning'
                const avatarIcon = s === 'success'
                  ? <CheckCircle2 size={16} />
                  : isFailed ? <XCircle size={16} /> : <AlertTriangle size={16} />

                return (
                  <div key={row.key}>
                    <div className="m-activity-card">
                      <div className={`m-activity-avatar ${avatarClass}`}>
                        {avatarIcon}
                      </div>

                      <div className="m-activity-info">
                        <div className="m-activity-name">{row.name || row.ticket_id || '-'}</div>
                        <div className="m-activity-meta">
                          <span className="badge badge-gray text-xs">Kategori: {row.category || '-'}</span>
                          <span className="badge badge-gray text-xs">Hari: {row.day_number || '-'}</span>
                          {row.wa_send_mode ? (
                            <span className="badge badge-gray text-xs">Mode: {row.wa_send_mode}</span>
                          ) : null}
                          {row.msgId ? <span className="badge badge-green text-xs">msgId</span> : null}
                        </div>
                      </div>

                      <div className="m-activity-actions">
                        <div className="m-activity-time">{formatTime(row.time)}</div>
                        <div className="m-activity-actions-row">
                          {isFailed && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              onClick={() => retrySend({ ticket_id: row.ticket_id, phone: row.phone, wa_send_mode: row.wa_send_mode })}
                              disabled={!!retryingKey || !waConn.isReady}
                              title={!waConn.isReady ? 'Sambungkan WhatsApp dulu' : ''}
                            >
                              <Send size={14} /> Retry
                            </button>
                          )}
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(isOpen ? null : row.key)}>
                            {isOpen ? 'Tutup' : 'Detail'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div style={{ padding: 12, background: 'var(--bg-elevated)', borderTop: '1px solid var(--border-color)' }}>
                        {row.error && (
                          <div style={{ color: 'var(--danger)', fontWeight: 650, marginBottom: 8 }}>
                            Alasan gagal: {humanizeUserMessage(row.error, { fallback: String(row.error) })}
                          </div>
                        )}
                        <div className="code-muted-sm">
                          Tips: pastikan WhatsApp status <b>Siap</b> di menu Sambungkan Perangkat, lalu coba retry.
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-kicker">Operasional</span>
          <h1>WA Delivery Queue</h1>
          <p>Pantau hasil kirim tiket via WhatsApp, lihat alasan gagal, dan lakukan pengiriman ulang tanpa harus membuka daftar peserta satu per satu.</p>
        </div>
        <div className="admin-actions-wrap">
          <button type="button" className="btn btn-primary" onClick={sendBatchToAll} disabled={batchSending || !waConn.isReady}>
            {batchSending ? (
              <><RefreshCw size={16} className="spinner" /> {batchProgress.current}/{batchProgress.total}</>
            ) : (
              <><Send size={16} /> Kirim ke Semua</>
            )}
          </button>
          <button type="button" className="btn btn-secondary" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinner' : ''} /> Muat ulang
          </button>
          <button type="button" className="btn btn-ghost" onClick={retryBatchFailed} disabled={loading || retryingKey}>
            <RotateCcw size={16} /> Retry yang gagal
          </button>
          <button type="button" className="btn btn-warning" onClick={regenerateAllQR} disabled={regeneratingQR}>
            {regeneratingQR ? (
              <><RefreshCw size={16} className="spinner" /> QR {qrRegenProgress.current}/{qrRegenProgress.total}</>
            ) : (
              <><AlertTriangle size={16} /> Regenerasi QR</>
            )}
          </button>
          <button type="button" className="btn btn-info" onClick={syncToGates} disabled={syncingToGates}>
            {syncingToGates ? (
              <><RefreshCw size={16} className="spinner" /> Syncing...</>
            ) : (
              <><Send size={16} /> Sync ke Gate</>
            )}
          </button>
        </div>
      </div>

      {!waConn.isReady && (
        <WaConnectBanner
          wa={waConn}
          title="WhatsApp belum siap"
        />
      )}

      {/* Progress bar untuk regenerasi QR */}
      {regeneratingQR && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid var(--warning)' }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Regenerasi QR Data...</span>
              <span>{qrRegenProgress.current}/{qrRegenProgress.total}</span>
            </div>
            <div className="progress-bar" style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${qrRegenProgress.total > 0 ? (qrRegenProgress.current / qrRegenProgress.total) * 100 : 0}%`,
                  background: 'var(--warning)',
                  height: '100%',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Progress bar untuk batch sending */}
      {batchSending && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 600 }}>Mengirim pesan massal...</span>
              <span>{batchProgress.current}/{batchProgress.total}</span>
            </div>
            <div className="progress-bar" style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${batchProgress.total > 0 ? (batchProgress.current / batchProgress.total) * 100 : 0}%`,
                  background: 'var(--brand-primary)',
                  height: '100%',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.85rem' }}>
              <span className="badge badge-green text-xs">Sukses: {batchProgress.success}</span>
              <span className="badge badge-red text-xs">Gagal: {batchProgress.failed}</span>
            </div>
          </div>
        </div>
      )}

      {/* Daftar yang gagal dari batch terakhir */}
      {!batchSending && lastBatchFailed.length > 0 && (
        <div className="card" style={{ marginBottom: 12, borderLeft: '4px solid var(--danger)' }}>
          <div className="card-header" style={{ background: 'var(--danger-soft)', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between', width: '100%' }}>
              <div>
                <h3 className="card-title" style={{ color: 'var(--danger)', margin: 0 }}>
                  <AlertTriangle size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                  Yang Gagal di Batch Terakhir ({lastBatchFailed.length} peserta)
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={retryLastBatchFailed}
                disabled={!waConn.isReady}
              >
                <RotateCcw size={14} /> Retry Semua
              </button>
            </div>
          </div>
          <div style={{ maxHeight: 300, overflow: 'auto' }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Ticket ID</th>
                  <th>Nomor</th>
                  <th>Alasan Gagal</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {lastBatchFailed.map((item, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 600 }}>{item.name || '-'}</td>
                    <td className="ticket-id-code">{item.ticket_id}</td>
                    <td>{item.phone}</td>
                    <td style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{item.error}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => retrySend({ ticket_id: item.ticket_id, phone: item.phone, wa_send_mode: item.wa_send_mode })}
                        disabled={!!retryingKey || !waConn.isReady}
                      >
                        <Send size={14} /> Retry
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="admin-toolbar">
        <div className="admin-filters" style={{ marginBottom: 0 }}>
          <div className="admin-search-wrap">
            <Search size={16} className="admin-search-icon" />
            <input className="form-input" placeholder="Cari tiket / nama / nomor / alasan gagal…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <select className="form-select admin-select-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Semua status</option>
            <option value="success">Sukses</option>
            <option value="failed">Gagal</option>
            <option value="unregistered">Nomor tidak terdaftar WA</option>
          </select>
          <div className="badge badge-gray" title="Ringkasan filter saat ini">
            Total: {summary.total} · Sukses: {summary.success} · Gagal: {summary.failed}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <h3 className="card-title">Riwayat pengiriman</h3>
          <div className="badge badge-gray text-xs">Tenant: {tenantId} · Hari: {getCurrentDay()}</div>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>ID Tiket</th>
                <th>Nama</th>
                <th>Nomor</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>
                    Belum ada riwayat pengiriman pada filter ini.
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 250).map(row => {
                  const isFailed = String(row.status || '').toLowerCase() === 'failed'
                  const isOpen = expanded === row.key
                  return (
                    <Fragment key={row.key}>
                      <tr>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{formatTime(row.time)}</td>
                        <td className="ticket-id-code">{row.ticket_id}</td>
                        <td style={{ fontWeight: 700 }}>{row.name || '-'}</td>
                        <td>{row.phone || '-'}</td>
                        <td>
                          <span className={`badge ${statusTone(row.status)} text-xs`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            {String(row.status || 'unknown').toUpperCase() === 'SUCCESS' ? <CheckCircle2 size={12} /> : String(row.status || '').toLowerCase() === 'failed' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                            {String(row.status || 'unknown').toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {isFailed && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => retrySend({ ticket_id: row.ticket_id, phone: row.phone, wa_send_mode: row.wa_send_mode })}
                                disabled={!!retryingKey || !waConn.isReady}
                                title={!waConn.isReady ? 'Sambungkan WhatsApp dulu' : ''}
                              >
                                <Send size={14} /> Retry
                              </button>
                            )}
                            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setExpanded(isOpen ? null : row.key)}>
                              {isOpen ? 'Tutup' : 'Detail'}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan="6" style={{ background: 'var(--bg-elevated)' }}>
                            <div style={{ padding: 12, display: 'grid', gap: 6 }}>
                              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                                <span className="badge badge-gray text-xs">Kategori: {row.category || '-'}</span>
                                <span className="badge badge-gray text-xs">Hari: {row.day_number || '-'}</span>
                                <span className="badge badge-gray text-xs">Mode: {row.wa_send_mode || '-'}</span>
                                {row.msgId && <span className="badge badge-green text-xs">msgId: {row.msgId}</span>}
                              </div>
                              {row.error && (
                                <div style={{ color: 'var(--danger)', fontWeight: 650 }}>
                                  Alasan gagal: {humanizeUserMessage(row.error, { fallback: String(row.error) })}
                                </div>
                              )}
                              {String(row.error_code || '').toLowerCase() === 'wa_number_not_registered' && (
                                <div className="badge badge-red text-xs" style={{ width: 'fit-content' }}>
                                  Nomor tidak terdaftar di WhatsApp
                                </div>
                              )}
                              <div className="code-muted-sm">
                                Tips: pastikan WhatsApp status <b>Siap</b> di menu Sambungkan Perangkat, lalu coba retry.
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

