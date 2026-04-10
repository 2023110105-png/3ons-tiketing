// ===== REAL FUNCTIONS FOR WA DELIVERY =====
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

// Helper untuk fetch peserta langsung dari Supabase
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

// Helper function to get active tenant (same as other admin pages)
function getActiveTenant() { 
  return { id: 'tenant-default' };
}

// Missing functions
async function bootstrapStoreFromFirebase() {
  // Dummy implementation
  return {};
}

async function _loadParticipantsFromSupabase() {
  // Dummy implementation
  return [];
}

function getWaSendMode() {
  return 'batch';
}

function getCurrentDay() {
  return 1;
}

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
  if (!participant.qr_data) {
    errors.push('QR data tidak tersedia');
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
    'qr data tidak tersedia'
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
        await bootstrapStoreFromFirebase();
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
        return { success: true, data }
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
      toast.info('Tidak ada', 'Tidak ada item gagal pada filter saat ini.')
      return
    }
    const ok = window.confirm(`Coba ulang ${failedRows.length} pengiriman yang gagal?`)
    if (!ok) return
    
    // Process concurrently with batching for faster delivery
    const batchSize = 5
    let processed = 0
    for (let i = 0; i < failedRows.length; i += batchSize) {
      const batch = failedRows.slice(i, i + batchSize)
      await Promise.all(
        batch.map(row => retrySend({ 
          ticket_id: row.ticket_id, 
          phone: row.phone, 
          wa_send_mode: row.wa_send_mode 
        }))
      )
      processed += batch.length
      toast.info('Progress', `${processed}/${failedRows.length} pengiriman diproses...`)
    }
    await loadLogs()
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
            <button type="button" className="btn btn-secondary" onClick={loadLogs} disabled={loading}>
              <RefreshCw size={16} className={loading ? 'spinner' : ''} /> Muat ulang
            </button>
            <button type="button" className="btn btn-ghost" onClick={retryBatchFailed} disabled={loading || retryingKey}>
              <RotateCcw size={16} /> Retry yang gagal
            </button>
          </div>
        </div>

        {!waConn.isReady && (
          <WaConnectBanner
            wa={waConn}
            title="WhatsApp belum siap"
          />
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
          <button type="button" className="btn btn-secondary" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spinner' : ''} /> Muat ulang
          </button>
          <button type="button" className="btn btn-ghost" onClick={retryBatchFailed} disabled={loading || retryingKey}>
            <RotateCcw size={16} /> Retry yang gagal
          </button>
        </div>
      </div>

      {!waConn.isReady && (
        <WaConnectBanner
          wa={waConn}
          title="WhatsApp belum siap"
        />
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

