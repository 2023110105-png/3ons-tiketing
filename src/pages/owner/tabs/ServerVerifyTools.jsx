import { useState } from 'react'
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { apiFetch } from '../../../utils/api'
import { bootstrapStoreFromFirebase } from '../../../store/mockData'

export default function ServerVerifyTools() {
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null)
  const [connectionRunning, setConnectionRunning] = useState(false)
  const [connectionReport, setConnectionReport] = useState(null)
  const [tenantProbeId, setTenantProbeId] = useState('tenant-default')
  const [tenantProbeRunning, setTenantProbeRunning] = useState(false)
  const [tenantProbeResult, setTenantProbeResult] = useState(null)
  const [healthRunning, setHealthRunning] = useState(false)
  const [healthReport, setHealthReport] = useState(null)

  const prettyJson = (data) => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
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
      setReport({
        checkedAt: new Date().toISOString(),
        passed,
        total: results.length,
        allPassed: passed === results.length,
        results
      })
    } finally {
      setRunning(false)
    }
  }

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

      const allGood = normalized.length > 0 && normalized.every((item) => item.valid)
      setConnectionReport({
        checkedAt: new Date().toISOString(),
        total: normalized.length,
        allGood,
        summary,
        sessions: normalized,
        error: ''
      })
    } catch (err) {
      setConnectionReport({
        checkedAt: new Date().toISOString(),
        total: 0,
        allGood: false,
        summary: { ready: 0, qr: 0, checking: 0, offline: 0, other: 0 },
        sessions: [],
        error: err?.message || 'Gagal memeriksa koneksi device.'
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
      setTenantProbeResult({
        tenantId,
        isReady: !!data?.isReady,
        statusLabel: mapped.label,
        tone: data?.isReady || mapped.key === 'ready' ? 'ok' : mapped.tone,
        raw: data,
        checkedAt: new Date().toISOString(),
        error: ''
      })
    } catch (err) {
      setTenantProbeResult({
        tenantId,
        isReady: false,
        statusLabel: 'Gagal probe',
        tone: 'error',
        raw: null,
        checkedAt: new Date().toISOString(),
        error: err?.message || 'Gagal memeriksa tenant.'
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
      setHealthReport({
        checkedAt: new Date().toISOString(),
        passed,
        total: checks.length,
        allPassed: passed === checks.length,
        checks
      })
    } finally {
      setHealthRunning(false)
    }
  }

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
    </div>
  )
}
