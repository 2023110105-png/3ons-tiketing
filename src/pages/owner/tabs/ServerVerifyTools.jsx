import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileDown, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { apiFetch } from '../../../utils/api'
import { bootstrapStoreFromFirebase } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'

const MAX_DIAGNOSTIC_LOGS = 100

export default function ServerVerifyTools() {
  const toast = useToast()
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null)
  const [connectionRunning, setConnectionRunning] = useState(false)
  const [connectionReport, setConnectionReport] = useState(null)
  const [tenantProbeId, setTenantProbeId] = useState('tenant-default')
  const [tenantProbeRunning, setTenantProbeRunning] = useState(false)
  const [tenantProbeResult, setTenantProbeResult] = useState(null)
  const [healthRunning, setHealthRunning] = useState(false)
  const [healthReport, setHealthReport] = useState(null)
  const [diagnosticLogs, setDiagnosticLogs] = useState([])
  const [logTenantQuery, setLogTenantQuery] = useState('')
  const [logStatusFilter, setLogStatusFilter] = useState('all')
  const [logTypeFilter, setLogTypeFilter] = useState('all')
  const [logTimeFilter, setLogTimeFilter] = useState('24h')
  const [alertRules, setAlertRules] = useState({
    enabled: true,
    autoMonitor: true,
    offlineMinutes: 10,
    nonReadyTenantThreshold: 3,
    cooldownMinutes: 5
  })
  const [alertSummary, setAlertSummary] = useState(null)
  const [alertEvents, setAlertEvents] = useState([])
  const [alertRunning, setAlertRunning] = useState(false)
  const alertTrackerRef = useRef({ offlineSince: {}, lastAlertAt: {} })
  const runAlertEvaluationRef = useRef(null)

  const prettyJson = (data) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }

  const appendDiagnosticLog = ({ type, status, tenantId = '-', summary, payload = {} }) => {
    const nextItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      checkedAt: new Date().toISOString(),
      type,
      status,
      tenantId,
      summary,
      payload
    }

    setDiagnosticLogs((prev) => [nextItem, ...prev].slice(0, MAX_DIAGNOSTIC_LOGS))
  }

  const toCsvValue = (value) => {
    const text = String(value ?? '')
    const escaped = text.replace(/"/g, '""')
    return `"${escaped}"`
  }

  const downloadTextFile = (filename, content, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const runVerifySelfTest = async () => {
    if (running) return
    setRunning(true)

    try {
      const base64 = (value) => btoa(value)

      const legacySig = base64('tenant-default|event-1|YMH-D1-001|1|event-2026')
      const legacyQr = JSON.stringify({ tid: 'YMH-D1-001', t: 'tenant-default', e: 'event-1', d: 1, sig: legacySig, v: 2 })
      const badQr = JSON.stringify({ tid: 'YMH-D1-001', t: 'tenant-default', e: 'event-1', d: 1, sig: 'BAD_SIGNATURE', v: 2 })

      const secureCode = 'SECURE-CODE-EXAMPLE-123'
      const secureRef = 'REFABC123456'
      const v3Sig = base64(`tenant-default|event-1|YMH-D1-001|1|${secureCode}|${secureRef}|event-secure-v3`)
      const v3Qr = JSON.stringify({ tid: 'YMH-D1-001', t: 'tenant-default', e: 'event-1', d: 1, r: secureRef, sig: v3Sig, v: 3 })

      const scenarios = [
        {
          key: 'legacy_valid',
          expected: (data) => data?.valid === true && data?.mode === 'legacy-v2',
          payload: { qr_data: legacyQr, tenant_id: 'tenant-default' }
        },
        {
          key: 'legacy_invalid',
          expected: (data) => data?.valid === false && data?.reason === 'invalid_signature',
          payload: { qr_data: badQr, tenant_id: 'tenant-default' }
        },
        {
          key: 'v3_valid',
          expected: (data) => data?.valid === true && data?.mode === 'v3-secure',
          payload: { qr_data: v3Qr, tenant_id: 'tenant-default', secure_code: secureCode, secure_ref: secureRef }
        },
        {
          key: 'v3_missing_token',
          expected: (data) => data?.valid === false && data?.reason === 'missing_secure_token',
          payload: { qr_data: v3Qr, tenant_id: 'tenant-default' }
        }
      ]

      const results = []
      for (const scenario of scenarios) {
        try {
          const response = await apiFetch('/api/ticket/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(scenario.payload)
          })

          const data = await response.json().catch(() => ({}))
          results.push({
            key: scenario.key,
            ok: response.ok && scenario.expected(data),
            responseOk: response.ok,
            status: response.status,
            data
          })
        } catch (err) {
          results.push({
            key: scenario.key,
            ok: false,
            responseOk: false,
            status: 0,
            data: { error: err?.message || 'network_error' }
          })
        }
      }

      const passed = results.filter((item) => item.ok).length
      const nextReport = {
        checkedAt: new Date().toISOString(),
        passed,
        total: results.length,
        allPassed: passed === results.length,
        results
      }
      setReport(nextReport)

      appendDiagnosticLog({
        type: 'verify-self-test',
        status: nextReport.allPassed ? 'pass' : passed > 0 ? 'warn' : 'fail',
        tenantId: 'tenant-default',
        summary: `Self test ${nextReport.passed}/${nextReport.total}`,
        payload: nextReport
      })
    } finally {
      setRunning(false)
    }
  }

  const getSessionSnapshot = async () => {
    const res = await apiFetch('/api/wa/sessions')
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      throw new Error(data?.error || `HTTP ${res.status}`)
    }

    const sessions = Array.isArray(data?.sessions) ? data.sessions : []
    const normalized = sessions.map((item) => {
      const mapped = normalizeSessionStatus(item?.status)
      return {
        tenantId: item?.tenant_id || '-',
        rawStatus: item?.status || '-',
        ...mapped
      }
    })

    const summary = normalized.reduce((acc, item) => {
      if (item.key === 'ready') acc.ready += 1
      else if (item.key === 'qr') acc.qr += 1
      else if (item.key === 'checking') acc.checking += 1
      else if (item.key === 'offline') acc.offline += 1
      else acc.other += 1
      return acc
    }, { ready: 0, qr: 0, checking: 0, offline: 0, other: 0 })

    return {
      checkedAt: new Date().toISOString(),
      sessions: normalized,
      summary
    }
  }

  const pushAlertEvent = ({ ruleKey, title, message, severity = 'warn', source = 'manual' }) => {
    const event = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      checkedAt: new Date().toISOString(),
      ruleKey,
      title,
      message,
      severity,
      source
    }

    setAlertEvents((prev) => [event, ...prev].slice(0, 50))
    appendDiagnosticLog({
      type: 'alert-rule',
      status: severity === 'fail' ? 'fail' : 'warn',
      tenantId: '*',
      summary: `${title} | ${message}`,
      payload: event
    })

    if (severity === 'fail') {
      toast.error(title, message)
    } else {
      toast.warning(title, message)
    }
  }

  const evaluateAlertRules = (snapshot, source = 'manual') => {
    if (!snapshot || !Array.isArray(snapshot.sessions)) return

    const tracker = alertTrackerRef.current
    const now = Date.now()
    const cooldownMs = Math.max(1, Number(alertRules.cooldownMinutes || 0)) * 60 * 1000
    const offlineMsThreshold = Math.max(1, Number(alertRules.offlineMinutes || 0)) * 60 * 1000

    snapshot.sessions.forEach((item) => {
      if (item.key === 'offline') {
        if (!tracker.offlineSince[item.tenantId]) {
          tracker.offlineSince[item.tenantId] = now
        }
      } else {
        delete tracker.offlineSince[item.tenantId]
      }
    })

    const offlineTenants = snapshot.sessions.filter((item) => item.key === 'offline')
    const nonReadyCount = snapshot.sessions.filter((item) => !item.valid).length

    const maybeEmit = (ruleKey, title, message, severity = 'warn') => {
      if (!alertRules.enabled) return
      const lastMs = tracker.lastAlertAt[ruleKey] || 0
      if (now - lastMs < cooldownMs) return
      tracker.lastAlertAt[ruleKey] = now
      pushAlertEvent({ ruleKey, title, message, severity, source })
    }

    offlineTenants.forEach((item) => {
      const firstSeenMs = tracker.offlineSince[item.tenantId] || now
      const offlineDurationMs = now - firstSeenMs
      if (offlineDurationMs >= offlineMsThreshold) {
        const mins = Math.floor(offlineDurationMs / 60000)
        maybeEmit(
          `offline-${item.tenantId}`,
          'Tenant offline terlalu lama',
          `${item.tenantId} offline sekitar ${mins} menit`,
          'fail'
        )
      }
    })

    if (nonReadyCount >= Number(alertRules.nonReadyTenantThreshold || 0)) {
      maybeEmit(
        'bulk-nonready',
        'Banyak tenant belum siap',
        `${nonReadyCount} tenant berstatus non-ready (QR/checking/offline)`,
        nonReadyCount >= Math.max(5, Number(alertRules.nonReadyTenantThreshold || 0) + 2) ? 'fail' : 'warn'
      )
    }

    setAlertSummary({
      checkedAt: snapshot.checkedAt,
      offlineCount: offlineTenants.length,
      nonReadyCount,
      readyCount: snapshot.summary.ready,
      total: snapshot.sessions.length,
      rulesEnabled: alertRules.enabled
    })
  }

  const runAlertEvaluation = async (source = 'manual') => {
    if (alertRunning) return
    setAlertRunning(true)

    try {
      const snapshot = await getSessionSnapshot()
      evaluateAlertRules(snapshot, source)

      appendDiagnosticLog({
        type: 'alert-evaluation',
        status: snapshot.summary.offline > 0 ? 'warn' : 'pass',
        tenantId: '*',
        summary: `Alert eval total=${snapshot.sessions.length}, offline=${snapshot.summary.offline}, non-ready=${snapshot.sessions.length - snapshot.summary.ready}`,
        payload: snapshot
      })
    } catch (err) {
      const msg = err?.message || 'Gagal evaluasi alert rules'
      pushAlertEvent({
        ruleKey: 'alert-eval-error',
        title: 'Evaluasi alert gagal',
        message: msg,
        severity: 'fail',
        source
      })
    } finally {
      setAlertRunning(false)
    }
  }

  runAlertEvaluationRef.current = runAlertEvaluation

  const normalizeSessionStatus = (status) => {
    const key = String(status || '').toLowerCase()
    if (key === 'ready') return { key: 'ready', label: 'Siap', tone: 'ok', valid: true }
    if (key === 'qr') return { key: 'qr', label: 'Menunggu Scan QR', tone: 'warn', valid: false }
    if (key === 'checking') return { key: 'checking', label: 'Pengecekan', tone: 'warn', valid: false }
    if (key === 'offline' || key === 'disconnected') return { key: 'offline', label: 'Offline', tone: 'error', valid: false }
    return { key: 'unknown', label: `Tidak dikenal (${status || '-'})`, tone: 'warn', valid: false }
  }

  const runDeviceConnectionCheck = async () => {
    if (connectionRunning) return
    setConnectionRunning(true)

    try {
      const snapshot = await getSessionSnapshot()
      const normalized = snapshot.sessions
      const summary = snapshot.summary

      const allGood = normalized.length > 0 && normalized.every((item) => item.valid)
      const nextConnectionReport = {
        checkedAt: snapshot.checkedAt,
        total: normalized.length,
        allGood,
        summary,
        sessions: normalized,
        error: ''
      }
      setConnectionReport(nextConnectionReport)

      appendDiagnosticLog({
        type: 'device-connection-check',
        status: allGood ? 'pass' : summary.offline > 0 ? 'fail' : 'warn',
        tenantId: '*',
        summary: `ready=${summary.ready}, qr=${summary.qr}, checking=${summary.checking}, offline=${summary.offline}`,
        payload: nextConnectionReport
      })

      evaluateAlertRules(snapshot, 'device-check')
    } catch (err) {
      const failedReport = {
        checkedAt: new Date().toISOString(),
        total: 0,
        allGood: false,
        summary: { ready: 0, qr: 0, checking: 0, offline: 0, other: 0 },
        sessions: [],
        error: err?.message || 'Gagal memeriksa koneksi device.'
      }
      setConnectionReport(failedReport)

      appendDiagnosticLog({
        type: 'device-connection-check',
        status: 'fail',
        tenantId: '*',
        summary: failedReport.error,
        payload: failedReport
      })
    } finally {
      setConnectionRunning(false)
    }
  }

  const runTenantProbe = async () => {
    const tenantId = String(tenantProbeId || '').trim()
    if (!tenantId || tenantProbeRunning) return

    setTenantProbeRunning(true)
    try {
      const res = await apiFetch(`/api/wa/status?tenant_id=${encodeURIComponent(tenantId)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      const mapped = normalizeSessionStatus(data?.status)
      const nextProbeResult = {
        tenantId,
        isReady: !!data?.isReady,
        statusLabel: mapped.label,
        tone: data?.isReady || mapped.key === 'ready' ? 'ok' : mapped.tone,
        raw: data,
        checkedAt: new Date().toISOString(),
        error: ''
      }
      setTenantProbeResult(nextProbeResult)

      appendDiagnosticLog({
        type: 'tenant-probe',
        status: nextProbeResult.tone === 'ok' ? 'pass' : nextProbeResult.tone === 'warn' ? 'warn' : 'fail',
        tenantId,
        summary: `status=${nextProbeResult.statusLabel}, ready=${nextProbeResult.isReady ? 'true' : 'false'}`,
        payload: nextProbeResult
      })
    } catch (err) {
      const failedProbeResult = {
        tenantId,
        isReady: false,
        statusLabel: 'Gagal probe',
        tone: 'error',
        raw: null,
        checkedAt: new Date().toISOString(),
        error: err?.message || 'Gagal memeriksa tenant.'
      }
      setTenantProbeResult(failedProbeResult)

      appendDiagnosticLog({
        type: 'tenant-probe',
        status: 'fail',
        tenantId,
        summary: failedProbeResult.error,
        payload: failedProbeResult
      })
    } finally {
      setTenantProbeRunning(false)
    }
  }

  const runPlatformHealthCheck = async () => {
    if (healthRunning) return
    setHealthRunning(true)

    const checks = []

    const pushCheck = async (name, runner) => {
      const startedAt = performance.now()
      try {
        const message = await runner()
        const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))
        checks.push({ name, ok: true, latencyMs, message })
      } catch (err) {
        const latencyMs = Math.max(1, Math.round(performance.now() - startedAt))
        checks.push({
          name,
          ok: false,
          latencyMs,
          message: err?.message || 'Pemeriksaan gagal'
        })
      }
    }

    try {
      await pushCheck('Frontend Runtime', async () => {
        if (!navigator.onLine) throw new Error('Browser offline')
        return 'Browser online dan runtime aktif'
      })

      await pushCheck('WA Server Health', async () => {
        const res = await apiFetch('/health')
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.status !== 'ok') {
          throw new Error(data?.error || `HTTP ${res.status}`)
        }
        return 'Endpoint /health responsif'
      })

      await pushCheck('WA Status Endpoint', async () => {
        const res = await apiFetch('/api/wa/status?tenant_id=tenant-default')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        return `status=${String(data?.status || '-')}, ready=${data?.isReady ? 'true' : 'false'}`
      })

      await pushCheck('WA Sessions Endpoint', async () => {
        const res = await apiFetch('/api/wa/sessions')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        const total = Array.isArray(data?.sessions) ? data.sessions.length : 0
        return `jumlah tenant session=${total}`
      })

      await pushCheck('Ticket Verify Endpoint', async () => {
        const res = await apiFetch('/api/ticket/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            qr_data: JSON.stringify({ tid: 'HEALTH-CHECK', t: 'tenant-default', e: 'event-1', d: 1, sig: 'INVALID', v: 2 }),
            tenant_id: 'tenant-default'
          })
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        if (data?.valid !== false) throw new Error('Respons endpoint verify tidak sesuai ekspektasi')
        return `respons valid=${String(data?.valid)}, reason=${String(data?.reason || '-')}`
      })

      await pushCheck('Firebase Sync Probe', async () => {
        if (typeof bootstrapStoreFromFirebase !== 'function') {
          throw new Error('bootstrapStoreFromFirebase tidak tersedia')
        }
        await bootstrapStoreFromFirebase(true)
        return 'Sinkronisasi Firebase berhasil dipanggil'
      })

      const passed = checks.filter((item) => item.ok).length
      const nextHealthReport = {
        checkedAt: new Date().toISOString(),
        passed,
        total: checks.length,
        allPassed: passed === checks.length,
        checks
      }
      setHealthReport(nextHealthReport)

      appendDiagnosticLog({
        type: 'platform-health-check',
        status: nextHealthReport.allPassed ? 'pass' : passed > 0 ? 'warn' : 'fail',
        tenantId: '*',
        summary: `Health check ${nextHealthReport.passed}/${nextHealthReport.total}`,
        payload: nextHealthReport
      })
    } finally {
      setHealthRunning(false)
    }
  }

  const filteredDiagnosticLogs = diagnosticLogs.filter((item) => {
    const query = logTenantQuery.trim().toLowerCase()
    const tenantMatch = !query || String(item.tenantId || '').toLowerCase().includes(query)
    const statusMatch = logStatusFilter === 'all' || item.status === logStatusFilter
    const typeMatch = logTypeFilter === 'all' || item.type === logTypeFilter

    let timeMatch = true
    if (logTimeFilter !== 'all') {
      const now = Date.now()
      const checkedAtMs = new Date(item.checkedAt).getTime()
      const limitMs = logTimeFilter === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      timeMatch = Number.isFinite(checkedAtMs) && now - checkedAtMs <= limitMs
    }

    return tenantMatch && statusMatch && typeMatch && timeMatch
  })

  const exportDiagnosticLogsJson = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(
      `diagnostic-logs-${stamp}.json`,
      JSON.stringify(filteredDiagnosticLogs, null, 2),
      'application/json;charset=utf-8'
    )
  }

  const exportDiagnosticLogsCsv = () => {
    const headers = ['checked_at', 'type', 'status', 'tenant_id', 'summary']
    const rows = filteredDiagnosticLogs.map((item) => [
      item.checkedAt,
      item.type,
      item.status,
      item.tenantId,
      item.summary
    ])

    const csvLines = [
      headers.map(toCsvValue).join(','),
      ...rows.map((row) => row.map(toCsvValue).join(','))
    ]

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(
      `diagnostic-logs-${stamp}.csv`,
      csvLines.join('\n'),
      'text/csv;charset=utf-8'
    )
  }

  useEffect(() => {
    if (!alertRules.autoMonitor) return

    let stopped = false
    const runTick = async () => {
      if (stopped) return
      if (typeof runAlertEvaluationRef.current === 'function') {
        await runAlertEvaluationRef.current('auto')
      }
    }

    runTick()
    const id = window.setInterval(runTick, 60 * 1000)

    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [alertRules.autoMonitor])

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Alat Uji Verifikasi Server</h3>
          <span className="badge badge-yellow">Khusus Tim IT</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Gunakan halaman ini hanya untuk pengecekan teknis endpoint validasi tiket.
        </p>
        <button className="btn btn-secondary" onClick={runVerifySelfTest} disabled={running}>
          {running
            ? (<><span className="spinner qr-spinner-sm"></span> Menjalankan pengujian...</>)
            : (<><ShieldCheck size={16} /> Jalankan Uji Verifikasi</>)}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Health Check 1 Klik</h3>
          <span className="badge badge-yellow">Frontend + API + WA + Firebase</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Jalankan pemeriksaan cepat seluruh komponen utama untuk memastikan sistem siap operasional.
        </p>
        <button className="btn btn-secondary" onClick={runPlatformHealthCheck} disabled={healthRunning}>
          {healthRunning
            ? (<><span className="spinner qr-spinner-sm"></span> Menjalankan health check...</>)
            : (<><RefreshCw size={16} /> Jalankan Health Check</>)}
        </button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Cek Koneksi Device (Owner)</h3>
          <span className="badge badge-yellow">Diagnostik WA Session</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Jalankan pengecekan untuk memastikan semua akun brand tersambung dengan benar ke layanan device WhatsApp.
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={runDeviceConnectionCheck} disabled={connectionRunning}>
            {connectionRunning
              ? (<><span className="spinner qr-spinner-sm"></span> Mengecek koneksi...</>)
              : (<><RefreshCw size={16} /> Jalankan Cek Koneksi Device</>)}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ maxWidth: 280 }}
            value={tenantProbeId}
            onChange={(e) => setTenantProbeId(e.target.value)}
            placeholder="tenant-default"
          />
          <button className="btn btn-outline" onClick={runTenantProbe} disabled={tenantProbeRunning || !tenantProbeId.trim()}>
            {tenantProbeRunning ? (<><span className="spinner qr-spinner-sm"></span> Probe tenant...</>) : (<><Wifi size={16} /> Probe Tenant</>)}
          </button>
        </div>

        {tenantProbeResult && (
          <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
            <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>
              Tenant <strong>{tenantProbeResult.tenantId}</strong> | Status: <strong>{tenantProbeResult.statusLabel}</strong> | Hasil: {' '}
              <strong>{tenantProbeResult.tone === 'ok' ? 'OK' : 'PERLU TINDAKAN'}</strong>
            </p>
            {tenantProbeResult.error && (
              <p className="scanner-note scanner-note-tight" style={{ marginTop: 8, color: '#b91c1c' }}>
                {tenantProbeResult.error}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Alert Rules</h3>
          <span className="badge badge-yellow">Monitoring otomatis</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Atur aturan notifikasi agar tim teknis mendapat peringatan saat koneksi device bermasalah.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
          <label className="scanner-note scanner-note-tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={alertRules.enabled}
              onChange={(e) => setAlertRules((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Aktifkan alert rules
          </label>
          <label className="scanner-note scanner-note-tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={alertRules.autoMonitor}
              onChange={(e) => setAlertRules((prev) => ({ ...prev, autoMonitor: e.target.checked }))}
            />
            Auto monitor tiap 1 menit
          </label>
          <input
            className="form-input"
            type="number"
            min={1}
            value={alertRules.offlineMinutes}
            onChange={(e) => setAlertRules((prev) => ({ ...prev, offlineMinutes: Number(e.target.value) || 1 }))}
            placeholder="Batas offline (menit)"
          />
          <input
            className="form-input"
            type="number"
            min={1}
            value={alertRules.nonReadyTenantThreshold}
            onChange={(e) => setAlertRules((prev) => ({ ...prev, nonReadyTenantThreshold: Number(e.target.value) || 1 }))}
            placeholder="Ambang tenant non-ready"
          />
          <input
            className="form-input"
            type="number"
            min={1}
            value={alertRules.cooldownMinutes}
            onChange={(e) => setAlertRules((prev) => ({ ...prev, cooldownMinutes: Number(e.target.value) || 1 }))}
            placeholder="Cooldown alert (menit)"
          />
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className="btn btn-outline" onClick={() => runAlertEvaluation('manual')} disabled={alertRunning}>
            {alertRunning ? (<><span className="spinner qr-spinner-sm"></span> Evaluasi alert...</>) : (<><RefreshCw size={16} /> Jalankan Evaluasi Alert</>)}
          </button>
        </div>

        {alertSummary && (
          <p className="scanner-note scanner-note-tight" style={{ marginBottom: 10 }}>
            Ringkasan: total {alertSummary.total} | ready {alertSummary.readyCount} | non-ready {alertSummary.nonReadyCount} | offline {alertSummary.offlineCount}
          </p>
        )}

        {alertEvents.length > 0 && (
          <div style={{ display: 'grid', gap: 8 }}>
            {alertEvents.map((event) => (
              <div key={event.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{event.title}</div>
                  <span style={{ fontWeight: 700, color: event.severity === 'fail' ? '#b91c1c' : '#b45309' }}>
                    {event.severity.toUpperCase()}
                  </span>
                </div>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 6, marginBottom: 4 }}>{event.message}</p>
                <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>{new Date(event.checkedAt).toLocaleString('id-ID')} | source: {event.source}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {report && (
        <div className={`card ${report.allPassed ? 'border-success' : 'border-error'}`}>
          <div className="card-header">
            <h3 className="card-title">Hasil Uji Teknis</h3>
            <span className={`badge ${report.allPassed ? 'badge-green' : 'badge-red'}`}>{report.passed}/{report.total}</span>
          </div>
          <p className="scanner-note scanner-note-tight" style={{ marginBottom: 10 }}>
            {report.results.map((item) => `${item.ok ? 'PASS' : 'FAIL'} ${item.key}`).join(' | ')}
          </p>
          {report.results.map((item) => (
            <details key={item.key} style={{ marginBottom: 8 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
                {item.ok ? 'PASS' : 'FAIL'} {item.key} (HTTP {item.status || '-'})
              </summary>
              <pre style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', overflowX: 'auto', fontSize: 12 }}>
                {prettyJson(item.data)}
              </pre>
            </details>
          ))}
        </div>
      )}

      {connectionReport && (
        <div className={`card ${connectionReport.allGood ? 'border-success' : 'border-error'}`}>
          <div className="card-header">
            <h3 className="card-title">Hasil Cek Koneksi Device</h3>
            <span className={`badge ${connectionReport.allGood ? 'badge-green' : 'badge-red'}`}>
              {connectionReport.summary.ready}/{connectionReport.total} siap
            </span>
          </div>
          <p className="scanner-note scanner-note-tight" style={{ marginBottom: 10 }}>
            Ready: {connectionReport.summary.ready} | QR: {connectionReport.summary.qr} | Checking: {connectionReport.summary.checking} | Offline: {connectionReport.summary.offline} | Lainnya: {connectionReport.summary.other}
          </p>

          {connectionReport.error && (
            <p className="scanner-note scanner-note-tight" style={{ marginBottom: 10, color: '#b91c1c' }}>
              {connectionReport.error}
            </p>
          )}

          {connectionReport.sessions.length > 0 && (
            <div style={{ display: 'grid', gap: 8 }}>
              {connectionReport.sessions.map((item) => (
                <div key={item.tenantId} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700 }}>{item.tenantId}</div>
                    <div className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Raw status: {item.rawStatus}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: item.tone === 'ok' ? '#166534' : item.tone === 'error' ? '#b91c1c' : '#b45309' }}>
                    {item.tone === 'ok' ? <CheckCircle2 size={16} /> : item.tone === 'error' ? <WifiOff size={16} /> : <AlertTriangle size={16} />}
                    <span>{item.label}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {healthReport && (
        <div className={`card ${healthReport.allPassed ? 'border-success' : 'border-error'}`}>
          <div className="card-header">
            <h3 className="card-title">Hasil Health Check Platform</h3>
            <span className={`badge ${healthReport.allPassed ? 'badge-green' : 'badge-red'}`}>
              {healthReport.passed}/{healthReport.total}
            </span>
          </div>
          <p className="scanner-note scanner-note-tight" style={{ marginBottom: 10 }}>
            {healthReport.allPassed ? 'Semua komponen sehat.' : 'Ada komponen yang perlu tindakan teknis.'}
          </p>

          <div style={{ display: 'grid', gap: 8 }}>
            {healthReport.checks.map((item) => (
              <div key={item.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 10, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  <div className="scanner-note scanner-note-tight" style={{ margin: 0 }}>{item.message}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, color: item.ok ? '#166534' : '#b91c1c' }}>
                  {item.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  <span>{item.ok ? 'PASS' : 'FAIL'} · {item.latencyMs}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Log Diagnostik Terpusat</h3>
          <span className="badge badge-yellow">Maks {MAX_DIAGNOSTIC_LOGS} entri</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
          <input
            className="form-input"
            value={logTenantQuery}
            onChange={(e) => setLogTenantQuery(e.target.value)}
            placeholder="Filter tenant id"
          />
          <select className="form-select" value={logStatusFilter} onChange={(e) => setLogStatusFilter(e.target.value)}>
            <option value="all">Semua status</option>
            <option value="pass">Pass</option>
            <option value="warn">Warn</option>
            <option value="fail">Fail</option>
          </select>
          <select className="form-select" value={logTypeFilter} onChange={(e) => setLogTypeFilter(e.target.value)}>
            <option value="all">Semua jenis</option>
            <option value="platform-health-check">Platform health</option>
            <option value="device-connection-check">Device connection</option>
            <option value="alert-evaluation">Alert evaluation</option>
            <option value="alert-rule">Alert trigger</option>
            <option value="tenant-probe">Tenant probe</option>
            <option value="verify-self-test">Verify self test</option>
          </select>
          <select className="form-select" value={logTimeFilter} onChange={(e) => setLogTimeFilter(e.target.value)}>
            <option value="1h">1 jam terakhir</option>
            <option value="24h">24 jam terakhir</option>
            <option value="all">Semua waktu</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={exportDiagnosticLogsJson} disabled={filteredDiagnosticLogs.length === 0}>
            <FileDown size={16} /> Export JSON
          </button>
          <button className="btn btn-outline" onClick={exportDiagnosticLogsCsv} disabled={filteredDiagnosticLogs.length === 0}>
            <FileDown size={16} /> Export CSV
          </button>
        </div>

        <p className="scanner-note scanner-note-tight" style={{ marginBottom: 10 }}>
          Menampilkan {filteredDiagnosticLogs.length} dari {diagnosticLogs.length} entri.
        </p>

        {filteredDiagnosticLogs.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 120 }}>
            <h3>Belum ada log</h3>
            <p>Jalankan salah satu pemeriksaan teknis untuk mengisi log diagnostik.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {filteredDiagnosticLogs.map((item) => (
              <details key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700 }}>{item.type} | {item.tenantId}</span>
                  <span style={{ fontWeight: 700, color: item.status === 'pass' ? '#166534' : item.status === 'warn' ? '#b45309' : '#b91c1c' }}>
                    {item.status.toUpperCase()}
                  </span>
                </summary>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 8, marginBottom: 6 }}>{item.summary}</p>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 8 }}>{new Date(item.checkedAt).toLocaleString('id-ID')}</p>
                <pre style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', overflowX: 'auto', fontSize: 12 }}>
                  {prettyJson(item.payload)}
                </pre>
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
