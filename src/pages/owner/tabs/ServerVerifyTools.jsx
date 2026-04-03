import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { apiFetch } from '../../../utils/api'

export default function ServerVerifyTools() {
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState(null)

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
    </div>
  )
}
