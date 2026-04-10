import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileDown, RefreshCw, Server, ShieldCheck, Wifi, WifiOff } from 'lucide-react'
import { apiFetch } from '../../../utils/api'
import { getDiagnosticActionHint, runDiagnosticSuite } from './serverDiagnosticSuite'
import {
  bootstrapStoreFromFirebase,
  getActiveTenant,
  getCheckInLogs,
  getCurrentDay,
  getCurrentEventId,
  getEvents,
  getEventsWithOptions,
  getAvailableDays,
  getAdminLogs,
  getStats,
  getPeakHours,
  getWaTemplate,
  getWaSendMode,
  getMaxPendingAttempts,
  getStoreBackups,
  getOwnerAuditLog,
  getOwnerNotifications,
  getParticipants,
  getTenantHealth,
  getTenants

import { useToast } from '../../../contexts/ToastContext'
import {
  ALERT_RULE_PRESETS,
  normalizeAlertRules,
  normalizeSafeMode,
  filterDiagnosticLogs,
  buildIncidentTimeline,
  buildErrorRecap,
  summarizeDiagnosticLogs,
  summarizeIncidentTimeline
} from './serverVerifyTools.helpers'

const MAX_DIAGNOSTIC_LOGS = 100
const IT_TOOLS_SETTINGS_KEY = 'ons_owner_it_tools_settings_v1'

function readItToolsSettings() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(IT_TOOLS_SETTINGS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

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
  const [matrixRunning, setMatrixRunning] = useState(false)
  const [matrixReport, setMatrixReport] = useState(null)
  const [fullAuditRunning, setFullAuditRunning] = useState(false)
  const [fullAuditReport, setFullAuditReport] = useState(null)
  const [fullAuditOnlyIssues, setFullAuditOnlyIssues] = useState(true)
  const [strictAuditMode, setStrictAuditMode] = useState(() => {
    const stored = readItToolsSettings()
    return Boolean(stored?.strictAuditMode)
  })
  const [runtimeRunning, setRuntimeRunning] = useState(false)
  const [runtimeInfo, setRuntimeInfo] = useState(null)
  const [safeMode, setSafeMode] = useState(() => {
    const stored = readItToolsSettings()
    return normalizeSafeMode(stored?.safeMode)
  })
  const [diagnosticLogs, setDiagnosticLogs] = useState([])
  const [logTenantQuery, setLogTenantQuery] = useState('')
  const [logStatusFilter, setLogStatusFilter] = useState('all')
  const [logTypeFilter, setLogTypeFilter] = useState('all')
  const [logTimeFilter, setLogTimeFilter] = useState('24h')
  const [alertRules, setAlertRules] = useState(() => {
    const stored = readItToolsSettings()
    return normalizeAlertRules(stored?.alertRules)
  })
  const [alertSummary, setAlertSummary] = useState(null)
  const [alertEvents, setAlertEvents] = useState([])
  const [alertRunning, setAlertRunning] = useState(false)
  const [autoFixRunning, setAutoFixRunning] = useState(false)
  const [autoFixResult, setAutoFixResult] = useState(null)
  const [quickTenantId, setQuickTenantId] = useState('')
  const [incidentTenantFilter, setIncidentTenantFilter] = useState('')
  const [incidentTypeFilter, setIncidentTypeFilter] = useState('all')
  const [comprehensiveDiagnosticRunning, setComprehensiveDiagnosticRunning] = useState(false)
  const [comprehensiveDiagnosticReport, setComprehensiveDiagnosticReport] = useState(null)
  const [comprehensiveDiagnosticMode, setComprehensiveDiagnosticMode] = useState('dry-run')
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

      if (nextReport.allPassed) {
        toast.success('Uji verifikasi selesai', `${nextReport.passed}/${nextReport.total} skenario PASS.`)
      } else if (passed > 0) {
        toast.warning('Uji verifikasi selesai sebagian', `${nextReport.passed}/${nextReport.total} skenario PASS.`)
      } else {
        toast.error('Uji verifikasi gagal', 'Tidak ada skenario yang berhasil.')
      }
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

      if (source === 'manual') {
        if (snapshot.summary.offline > 0) {
          toast.warning('Evaluasi alert selesai', `Offline terdeteksi: ${snapshot.summary.offline} tenant.`)
        } else {
          toast.success('Evaluasi alert selesai', 'Tidak ada tenant offline pada pemeriksaan ini.')
        }
      }
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

      if (allGood) {
        toast.success('Cek koneksi selesai', `Semua tenant siap (${summary.ready}/${normalized.length}).`)
      } else if (summary.offline > 0) {
        toast.error('Cek koneksi menemukan masalah', `Tenant offline: ${summary.offline}.`)
      } else {
        toast.warning('Cek koneksi selesai sebagian', `Tenant belum siap: ${normalized.length - summary.ready}.`)
      }

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
      toast.error('Cek koneksi gagal', failedReport.error)
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

      if (nextProbeResult.tone === 'ok') {
        toast.success('Probe tenant selesai', `${tenantId} siap digunakan.`)
      } else {
        toast.warning('Probe tenant perlu tindakan', `${tenantId}: ${nextProbeResult.statusLabel}.`)
      }
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
      toast.error('Probe tenant gagal', failedProbeResult.error)
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
        const res = await apiFetch('/api/wa/runtime')
        const data = await res.json().catch(() => ({}))
        const healthy = res.ok && !!data?.version
        if (!healthy) {
          throw new Error(data?.error || `HTTP ${res.status}`)
        }
        return 'Endpoint /api/wa/runtime responsif'
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

      await pushCheck('WA Runtime Endpoint', async () => {
        const res = await apiFetch('/api/wa/runtime')
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)
        return `version=${String(data?.version || '-')}, uptime=${String(data?.uptimeSeconds || 0)}s`
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

      await pushCheck('Sinkron data ke server', async () => {
        if (typeof bootstrapStoreFromFirebase !== 'function') {
          throw new Error('Penyegaran data tidak tersedia di aplikasi ini')
        }
        await bootstrapStoreFromFirebase(true)
        return 'Sinkronisasi data ke server berhasil dijalankan'
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

      if (nextHealthReport.allPassed) {
        toast.success('Pemeriksaan server selesai', `${nextHealthReport.passed}/${nextHealthReport.total} pemeriksaan berhasil.`)
      } else if (passed > 0) {
        toast.warning('Pemeriksaan server selesai sebagian', `${nextHealthReport.passed}/${nextHealthReport.total} pemeriksaan berhasil.`)
      } else {
        toast.error('Pemeriksaan server gagal', 'Tidak ada pemeriksaan yang berhasil.')
      }
    } finally {
      setHealthRunning(false)
    }
  }

  const runRuntimeInfoCheck = async () => {
    if (runtimeRunning) return
    setRuntimeRunning(true)

    try {
      const res = await apiFetch('/api/wa/runtime')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`)

      const nextInfo = {
        checkedAt: new Date().toISOString(),
        ...data
      }
      setRuntimeInfo(nextInfo)

      appendDiagnosticLog({
        type: 'runtime-info',
        status: 'pass',
        tenantId: '*',
        summary: `runtime version=${String(nextInfo?.version || '-')}, uptime=${String(nextInfo?.uptimeSeconds || 0)}s`,
        payload: nextInfo
      })
      toast.success('Informasi layanan berhasil dimuat', `Versi ${String(nextInfo?.version || '-')} · aktif ${String(nextInfo?.uptimeSeconds || 0)} detik`)
    } catch (err) {
      const msg = err?.message || 'Gagal memuat runtime info'
      appendDiagnosticLog({
        type: 'runtime-info',
        status: 'fail',
        tenantId: '*',
        summary: msg,
        payload: { error: msg }
      })
      toast.error('Gagal memuat informasi layanan', msg)
    } finally {
      setRuntimeRunning(false)
    }
  }

  const runEndpointMatrixTest = async () => {
    if (matrixRunning) return
    setMatrixRunning(true)

    const tests = [
      {
        key: 'health',
        label: 'GET /api/wa/runtime',
        run: async () => {
          const res = await apiFetch('/api/wa/runtime')
          const data = await res.json().catch(() => ({}))
          const ok = res.ok && !!data?.version
          return {
            ok,
            status: res.status,
            detail: ok ? 'Runtime endpoint OK' : String(data?.error || 'runtime response invalid')
          }
        }
      },
      {
        key: 'runtime',
        label: 'GET /api/wa/runtime',
        run: async () => {
          const res = await apiFetch('/api/wa/runtime')
          const data = await res.json().catch(() => ({}))
          const ok = res.ok && !!data?.version
          return {
            ok,
            status: res.status,
            detail: ok ? `version=${String(data?.version || '-')}, uptime=${String(data?.uptimeSeconds || 0)}s` : String(data?.error || 'runtime response invalid')
          }
        }
      },
      {
        key: 'wa-status-default',
        label: 'GET /api/wa/status (tenant-default)',
        run: async () => {
          const res = await apiFetch('/api/wa/status?tenant_id=tenant-default')
          const data = await res.json().catch(() => ({}))
          const ok = res.ok && typeof data?.status === 'string'
          return {
            ok,
            status: res.status,
            detail: ok ? `status=${String(data?.status || '-')}, ready=${data?.isReady ? 'true' : 'false'}` : String(data?.error || 'status response invalid')
          }
        }
      },
      {
        key: 'wa-sessions',
        label: 'GET /api/wa/sessions',
        run: async () => {
          const res = await apiFetch('/api/wa/sessions')
          const data = await res.json().catch(() => ({}))
          const ok = res.ok && Array.isArray(data?.sessions)
          return { ok, status: res.status, detail: ok ? `total=${data.sessions.length}` : String(data?.error || 'sessions response invalid') }
        }
      },
      {
        key: 'ticket-verify-invalid-signature',
        label: 'POST /api/ticket/verify (invalid signature expected)',
        run: async () => {
          const res = await apiFetch('/api/ticket/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              qr_data: JSON.stringify({ tid: 'MATRIX-TEST', t: 'tenant-default', e: 'event-1', d: 1, sig: 'INVALID_SIGNATURE', v: 2 }),
              tenant_id: 'tenant-default'
            })
          })
          const data = await res.json().catch(() => ({}))
          const ok = res.ok && data?.valid === false
          return { ok, status: res.status, detail: ok ? `reason=${String(data?.reason || '-')}` : String(data?.error || 'verify response invalid') }
        }
      },
      {
        key: 'firebase-sync-probe',
        label: 'Sinkron data di perangkat (klien)',
        run: async () => {
          if (typeof bootstrapStoreFromFirebase !== 'function') {
            return { ok: false, status: 0, detail: 'Penyegaran data tidak tersedia' }
          }
          await bootstrapStoreFromFirebase(true)
          return { ok: true, status: 200, detail: 'Sinkronisasi data berhasil' }
        }
      }
    ]

    try {
      const results = []
      for (const test of tests) {
        const startedAt = performance.now()
        try {
          const outcome = await test.run()
          results.push({
            key: test.key,
            label: test.label,
            ok: !!outcome.ok,
            status: outcome.status || 0,
            latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
            detail: String(outcome.detail || '')
          })
        } catch (err) {
          results.push({
            key: test.key,
            label: test.label,
            ok: false,
            status: 0,
            latencyMs: Math.max(1, Math.round(performance.now() - startedAt)),
            detail: err?.message || 'test error'
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
      setMatrixReport(nextReport)

      appendDiagnosticLog({
        type: 'endpoint-matrix',
        status: nextReport.allPassed ? 'pass' : passed > 0 ? 'warn' : 'fail',
        tenantId: '*',
        summary: `Endpoint matrix ${nextReport.passed}/${nextReport.total}`,
        payload: nextReport
      })

      if (nextReport.allPassed) {
        toast.success('Pemeriksaan layanan selesai', `${nextReport.passed}/${nextReport.total} layanan berhasil.`)
      } else if (passed > 0) {
        toast.warning('Pemeriksaan layanan selesai sebagian', `${nextReport.passed}/${nextReport.total} layanan berhasil.`)
      } else {
        toast.error('Pemeriksaan layanan gagal', 'Semua pemeriksaan sambungan gagal.')
      }
    } finally {
      setMatrixRunning(false)
    }
  }

  const runFullSystemAudit = async () => {
    if (fullAuditRunning) return
    setFullAuditRunning(true)

    const checks = [
      {
        category: 'backend',
        key: 'backend-health',
        label: 'Backend health endpoint',
        run: async () => {
          const res = await apiFetch('/api/wa/runtime')
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !data?.version) return { status: 'fail', detail: data?.error || `HTTP ${res.status}` }
          return { status: 'pass', detail: 'Backend runtime health OK' }
        }
      },
      {
        category: 'backend',
        key: 'backend-runtime',
        label: 'Backend runtime endpoint',
        run: async () => {
          const res = await apiFetch('/api/wa/runtime')
          const data = await res.json().catch(() => ({}))
          if (!res.ok) return { status: 'fail', detail: data?.error || `HTTP ${res.status}` }
          if (!data?.version) return { status: 'warn', detail: 'Runtime tersedia tapi versi tidak terbaca' }
          return { status: 'pass', detail: `version=${String(data.version)} uptime=${String(data?.uptimeSeconds || 0)}s` }
        }
      },
      {
        category: 'backend',
        key: 'backend-wa-sessions',
        label: 'WA sessions endpoint',
        run: async () => {
          const res = await apiFetch('/api/wa/sessions')
          const data = await res.json().catch(() => ({}))
          if (!res.ok || !Array.isArray(data?.sessions)) return { status: 'fail', detail: data?.error || `HTTP ${res.status}` }
          return { status: 'pass', detail: `total sessions=${data.sessions.length}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-current-day',
        label: 'Admin current day data',
        run: async () => {
          const day = Number(getCurrentDay())
          if (!Number.isInteger(day) || day < 1) return { status: 'fail', detail: `Current day invalid: ${String(day)}` }
          return { status: 'pass', detail: `Current day=${day}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-dashboard-stats',
        label: 'Admin dashboard stats data',
        run: async () => {
          const stats = getStats(getCurrentDay())
          if (!stats || typeof stats !== 'object') return { status: 'fail', detail: 'Stats dashboard tidak valid' }
          const requiredKeys = ['total', 'checkedIn', 'notCheckedIn', 'percentage', 'byCategory']
          const missing = requiredKeys.filter((key) => !(key in stats))
          if (missing.length > 0) return { status: 'fail', detail: `Stats missing keys: ${missing.join(', ')}` }
          return { status: 'pass', detail: `Stats total=${stats.total}, checkedIn=${stats.checkedIn}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-events',
        label: 'Admin events integrity',
        run: async () => {
          const events = getEvents()
          const activeId = getCurrentEventId()
          if (!Array.isArray(events) || events.length === 0) return { status: 'fail', detail: 'Event list kosong' }
          const found = events.some((event) => String(event?.id || '') === String(activeId || ''))
          if (!found) return { status: 'warn', detail: `Active event id tidak ditemukan: ${String(activeId || '-')}` }
          return { status: 'pass', detail: `Events=${events.length}, active=${String(activeId)}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-events-options',
        label: 'Admin settings events options',
        run: async () => {
          const list = getEventsWithOptions({ includeArchived: true })
          if (!Array.isArray(list)) return { status: 'fail', detail: 'Events options bukan array' }
          return { status: list.length === 0 ? 'warn' : 'pass', detail: `Events options=${list.length}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-participants',
        label: 'Admin participants integrity',
        run: async () => {
          const list = getParticipants(getCurrentDay())
          if (!Array.isArray(list)) return { status: 'fail', detail: 'Participants bukan array' }
          const broken = list.find((item) => !item?.name || !item?.ticket_id)
          if (broken) return { status: 'warn', detail: 'Ada peserta tanpa nama/ticket_id lengkap' }
          return { status: 'pass', detail: `Participants hari aktif=${list.length}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-qr-generate-data',
        label: 'Admin QR generate payload readiness',
        run: async () => {
          const list = getParticipants(getCurrentDay())
          if (!Array.isArray(list)) return { status: 'fail', detail: 'Participants untuk QR bukan array' }
          if (list.length === 0) return { status: 'warn', detail: 'Belum ada peserta untuk generate QR' }
          const missingQr = list.filter((item) => !item?.qr_data)
          if (missingQr.length > 0) {
            return { status: 'warn', detail: `${missingQr.length}/${list.length} peserta belum punya qr_data` }
          }
          return { status: 'pass', detail: `Semua peserta (${list.length}) siap generate QR` }
        }
      },
      {
        category: 'admin',
        key: 'admin-barcode-import-extract-api',
        label: 'Admin barcode import extract API behavior',
        run: async () => {
          const res = await apiFetch('/api/import/barcode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: 'tenant-default', source_type: 'manual_paste', qr_string: '' })
          })
          const data = await res.json().catch(() => ({}))
          const expected = res.status === 400 || data?.success === false
          if (!expected) return { status: 'warn', detail: `Respons tak terduga HTTP ${res.status}` }
          return { status: 'pass', detail: 'Endpoint import/barcode merespons validasi input' }
        }
      },
      {
        category: 'admin',
        key: 'admin-barcode-import-verify-api',
        label: 'Admin barcode import verify API behavior',
        run: async () => {
          const res = await apiFetch('/api/import/verify-and-register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tenant_id: 'tenant-default' })
          })
          const data = await res.json().catch(() => ({}))
          const expected = res.status === 400 && data?.valid === false
          if (!expected) return { status: 'warn', detail: `Respons tak terduga HTTP ${res.status}` }
          return { status: 'pass', detail: 'Endpoint verify-and-register memvalidasi field wajib' }
        }
      },
      {
        category: 'admin',
        key: 'admin-connect-device-status-api',
        label: 'Admin connect-device status API',
        run: async () => {
          const res = await apiFetch('/api/wa/status?tenant_id=tenant-default')
          const data = await res.json().catch(() => ({}))
          if (!res.ok) return { status: 'fail', detail: data?.error || `HTTP ${res.status}` }
          if (typeof data?.status !== 'string') return { status: 'warn', detail: 'status WA tidak terbaca' }
          return { status: 'pass', detail: `WA status=${String(data.status)} ready=${data?.isReady ? 'true' : 'false'}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-reports-dataset',
        label: 'Admin reports dataset readiness',
        run: async () => {
          const logs = getCheckInLogs(getCurrentDay())
          const peaks = getPeakHours(getCurrentDay())
          const days = getAvailableDays()
          const adminLogs = getAdminLogs(300)
          if (!Array.isArray(logs) || !Array.isArray(peaks) || !Array.isArray(days) || !Array.isArray(adminLogs)) {
            return { status: 'fail', detail: 'Salah satu dataset laporan tidak valid' }
          }
          return { status: 'pass', detail: `logs=${logs.length}, peaks=${peaks.length}, days=${days.length}, audit=${adminLogs.length}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-settings-integrity',
        label: 'Admin settings data integrity',
        run: async () => {
          const template = String(getWaTemplate() || '').trim()
          const mode = String(getWaSendMode() || '')
          const retry = Number(getMaxPendingAttempts())
          const backups = getStoreBackups()

          if (!template) return { status: 'warn', detail: 'Template WA kosong' }
          if (!['message_only', 'message_with_barcode'].includes(mode)) {
            return { status: 'fail', detail: `Mode WA tidak valid: ${mode}` }
          }
          if (!Number.isInteger(retry) || retry < 1) {
            return { status: 'fail', detail: `Max pending attempts tidak valid: ${String(retry)}` }
          }
          if (!Array.isArray(backups)) {
            return { status: 'fail', detail: 'Store backups bukan array' }
          }

          return { status: 'pass', detail: `WA mode=${mode}, retry=${retry}, backups=${backups.length}` }
        }
      },
      {
        category: 'admin',
        key: 'admin-checkin-logs',
        label: 'Admin check-in logs integrity',
        run: async () => {
          const logs = getCheckInLogs(getCurrentDay())
          if (!Array.isArray(logs)) return { status: 'fail', detail: 'Check-in logs bukan array' }
          return { status: logs.length === 0 ? 'warn' : 'pass', detail: `Check-in logs hari aktif=${logs.length}` }
        }
      },
      {
        category: 'admin',
        key: 'gate-scan-server-verify-path',
        label: 'Gate scan server verify path behavior',
        run: async () => {
          const res = await apiFetch('/api/ticket/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ qr_data: 'NOT_JSON', tenant_id: 'tenant-default' })
          })
          const data = await res.json().catch(() => ({}))
          if (res.status === 400 && data?.valid === false) {
            return { status: 'pass', detail: `verify invalid payload ditolak (${String(data?.reason || '-')})` }
          }
          return { status: 'warn', detail: `verify invalid payload respons tak terduga HTTP ${res.status}` }
        }
      },
      {
        category: 'owner',
        key: 'owner-tenants',
        label: 'Owner tenants integrity',
        run: async () => {
          const tenants = getTenants()
          if (!Array.isArray(tenants) || tenants.length === 0) return { status: 'fail', detail: 'Tenant list kosong' }
          const missing = tenants.find((item) => !item?.id || !item?.brandName)
          if (missing) return { status: 'warn', detail: 'Ada tenant tanpa id/brandName lengkap' }
          return { status: 'pass', detail: `Total tenant=${tenants.length}` }
        }
      },
      {
        category: 'owner',
        key: 'owner-health-data',
        label: 'Owner tenant health data',
        run: async () => {
          const health = getTenantHealth()
          if (!Array.isArray(health)) return { status: 'fail', detail: 'Tenant health bukan array' }
          return { status: 'pass', detail: `Tenant health records=${health.length}` }
        }
      },
      {
        category: 'owner',
        key: 'owner-audit-log',
        label: 'Owner audit log data',
        run: async () => {
          const logs = getOwnerAuditLog()
          if (!Array.isArray(logs)) return { status: 'fail', detail: 'Audit log owner tidak valid' }
          return { status: 'pass', detail: `Audit log entries=${logs.length}` }
        }
      },
      {
        category: 'owner',
        key: 'owner-notification-log',
        label: 'Owner notification data',
        run: async () => {
          const logs = getOwnerNotifications()
          if (!Array.isArray(logs)) return { status: 'fail', detail: 'Owner notifications tidak valid' }
          return { status: 'pass', detail: `Notification entries=${logs.length}` }
        }
      },
      {
        category: 'operational',
        key: 'it-safe-mode-state',
        label: 'IT safe mode state',
        run: async () => ({ status: 'pass', detail: safeMode.enabled ? 'Safe mode aktif (aksi berisiko diblok)' : 'Safe mode nonaktif' })
      },
      {
        category: 'operational',
        key: 'it-alert-rules-config',
        label: 'IT alert rules config',
        run: async () => {
          const isValid = alertRules.offlineMinutes >= 1 && alertRules.nonReadyTenantThreshold >= 1 && alertRules.cooldownMinutes >= 1
          return isValid
            ? { status: 'pass', detail: 'Threshold alert valid' }
            : { status: 'fail', detail: 'Threshold alert tidak valid (harus >= 1)' }
        }
      }
    ]

    try {
      const results = []
      for (const check of checks) {
        const startedAt = performance.now()
        try {
          const outcome = await check.run()
          results.push({
            category: check.category,
            key: check.key,
            label: check.label,
            status: outcome?.status || 'fail',
            detail: String(outcome?.detail || '-'),
            latencyMs: Math.max(1, Math.round(performance.now() - startedAt))
          })
        } catch (err) {
          results.push({
            category: check.category,
            key: check.key,
            label: check.label,
            status: 'fail',
            detail: err?.message || 'audit check error',
            latencyMs: Math.max(1, Math.round(performance.now() - startedAt))
          })
        }
      }

      const summary = results.reduce((acc, item) => {
        acc.total += 1
        if (item.status === 'pass') acc.pass += 1
        else if (item.status === 'warn') acc.warn += 1
        else acc.fail += 1
        return acc
      }, { total: 0, pass: 0, warn: 0, fail: 0 })

      const grouped = results.reduce((acc, item) => {
        const bucket = acc[item.category] || { category: item.category, total: 0, pass: 0, warn: 0, fail: 0, items: [] }
        bucket.total += 1
        if (item.status === 'pass') bucket.pass += 1
        else if (item.status === 'warn') bucket.warn += 1
        else bucket.fail += 1
        bucket.items.push(item)
        acc[item.category] = bucket
        return acc
      }, {})

      const effectiveFail = strictAuditMode ? summary.fail + summary.warn : summary.fail
      const strictLabel = strictAuditMode ? 'STRICT' : 'NORMAL'

      const report = {
        checkedAt: new Date().toISOString(),
        summary: {
          ...summary,
          effectiveFail,
          strictAuditMode,
          strictLabel
        },
        groups: Object.values(grouped),
        results
      }
      setFullAuditReport(report)

      appendDiagnosticLog({
        type: 'full-system-audit',
        status: effectiveFail > 0 ? 'fail' : 'pass',
        tenantId: '*',
        summary: `Full audit(${strictLabel}) pass=${summary.pass}, warn=${summary.warn}, fail=${summary.fail}, effective_fail=${effectiveFail}`,
        payload: report
      })

      if (effectiveFail > 0) {
        toast.error('Audit sistem selesai', `Mode ${strictLabel}: effective FAIL ${effectiveFail} dari ${summary.total} pemeriksaan.`)
      } else if (summary.warn > 0) {
        toast.warning('Audit sistem selesai sebagian', `Mode ${strictLabel}: WARN ${summary.warn}, PASS ${summary.pass}.`)
      } else {
        toast.success('Audit sistem sehat', `Mode ${strictLabel}: ${summary.pass}/${summary.total} pemeriksaan PASS.`)
      }
    } finally {
      setFullAuditRunning(false)
    }
  }

  const filteredDiagnosticLogs = filterDiagnosticLogs(diagnosticLogs, {
    tenantQuery: logTenantQuery,
    statusFilter: logStatusFilter,
    typeFilter: logTypeFilter,
    timeFilter: logTimeFilter
  })

  const incidentTimeline = buildIncidentTimeline(diagnosticLogs, {
    tenantFilter: incidentTenantFilter,
    typeFilter: incidentTypeFilter,
    limit: 30
  })
  const errorRecap = buildErrorRecap(diagnosticLogs, 12)

  const diagnosticSummary = summarizeDiagnosticLogs(diagnosticLogs)
  const incidentSummary = summarizeIncidentTimeline(incidentTimeline)

  const exportDiagnosticLogsJson = () => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(
      `diagnostic-logs-${stamp}.json`,
      JSON.stringify(filteredDiagnosticLogs, null, 2),
      'application/json;charset=utf-8'
    )
    toast.success('Ekspor data berhasil', `${filteredDiagnosticLogs.length} catatan log diekspor.`)
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
    toast.success('Export CSV berhasil', `${filteredDiagnosticLogs.length} log diekspor.`)
  }

  const exportIncidentTimelineCsv = () => {
    const headers = ['checked_at', 'type', 'status', 'tenant_id', 'summary']
    const rows = incidentTimeline.map((item) => [
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
      `incident-timeline-${stamp}.csv`,
      csvLines.join('\n'),
      'text/csv;charset=utf-8'
    )
    toast.success('Export incident berhasil', `${incidentTimeline.length} insiden diekspor.`)
  }

  const clearDiagnosticLogs = () => {
    if (diagnosticLogs.length === 0) return
    const confirmed = window.confirm('Hapus semua log diagnostik saat ini? Tindakan ini tidak bisa dibatalkan.')
    if (!confirmed) return

    setDiagnosticLogs([])
    setAlertEvents([])
    toast.info('Log diagnostik dibersihkan', 'Semua riwayat log lokal sudah dihapus.')
  }

  const exportErrorRecapCsv = () => {
    const headers = ['type', 'total', 'fail', 'warn', 'last_seen', 'tenants', 'latest_summary', 'recommended_action']
    const rows = errorRecap.map((item) => [
      item.type,
      item.total,
      item.fail,
      item.warn,
      item.lastSeen,
      (item.tenants || []).join('; '),
      item.latestSummary,
      item.action
    ])

    const csvLines = [
      headers.map(toCsvValue).join(','),
      ...rows.map((row) => row.map(toCsvValue).join(','))
    ]

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(
      `error-recap-${stamp}.csv`,
      csvLines.join('\n'),
      'text/csv;charset=utf-8'
    )
    toast.success('Export rekap error berhasil', `${errorRecap.length} item prioritas diekspor.`)
  }

  const exportFullAuditCsv = () => {
    if (!fullAuditReport) return
    const headers = ['category', 'key', 'label', 'status', 'latency_ms', 'detail']
    const rows = fullAuditReport.results.map((item) => [
      item.category,
      item.key,
      item.label,
      item.status,
      item.latencyMs,
      item.detail
    ])

    const csvLines = [
      headers.map(toCsvValue).join(','),
      ...rows.map((row) => row.map(toCsvValue).join(','))
    ]

    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    downloadTextFile(
      `full-audit-${stamp}.csv`,
      csvLines.join('\n'),
      'text/csv;charset=utf-8'
    )
    toast.success('Export audit CSV berhasil', `${fullAuditReport.results.length} item audit diekspor.`)
  }

  const exportFullAuditPdf = async () => {
    if (!fullAuditReport) return

    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF('p', 'mm', 'a4')

      doc.setFontSize(16)
      doc.setFont(undefined, 'bold')
      doc.text('FULL SYSTEM AUDIT REPORT', 105, 16, { align: 'center' })
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(`Generated: ${new Date().toLocaleString('id-ID')}`, 105, 23, { align: 'center' })
      doc.text(`Mode: ${fullAuditReport.summary.strictLabel || (strictAuditMode ? 'STRICT' : 'NORMAL')}`, 14, 32)
      doc.text(`PASS ${fullAuditReport.summary.pass} | WARN ${fullAuditReport.summary.warn} | FAIL ${fullAuditReport.summary.fail} | Effective FAIL ${fullAuditReport.summary.effectiveFail ?? fullAuditReport.summary.fail}`, 14, 38)

      autoTable(doc, {
        startY: 44,
        head: [['Kategori', 'Key', 'Status', 'Latency', 'Detail']],
        body: fullAuditReport.results.map((item) => [
          item.category,
          item.key,
          item.status.toUpperCase(),
          `${item.latencyMs}ms`,
          item.detail
        ]),
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 2.5 }
      })

      const stamp = new Date().toISOString().slice(0, 10)
      doc.save(`Full_Audit_${stamp}.pdf`)
      toast.success('Export audit PDF berhasil', `${fullAuditReport.results.length} item audit diekspor.`)
    } catch (err) {
      toast.error('Export audit PDF gagal', err?.message || 'Tidak dapat membuat file PDF.')
    }
  }

  const resetTenantSession = async (tenantId) => {
    const res = await apiFetch(`/api/wa/logout?tenant_id=${encodeURIComponent(tenantId)}`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || data?.success === false) {
      throw new Error(data?.error || `HTTP ${res.status}`)
    }
    return data
  }

  const runAutoFix = async (mode, source = 'manual') => {
    if (autoFixRunning) return
    if (safeMode.enabled) {
      const msg = 'Safe Mode aktif. Auto Fix diblok untuk mencegah perubahan massal saat kondisi darurat.'
      toast.warning('Aksi diblok oleh Safe Mode', msg)
      appendDiagnosticLog({
        type: 'safe-mode',
        status: 'warn',
        tenantId: '*',
        summary: `Auto Fix mode=${mode} diblok`,
        payload: { mode, reason: msg }
      })
      return
    }
    setAutoFixRunning(true)

    try {
      const snapshot = await getSessionSnapshot()
      let targets = []
      let modeLabel = ''

      if (mode === 'offline') {
        modeLabel = 'Reset tenant offline'
        targets = snapshot.sessions.filter((item) => item.key === 'offline').map((item) => item.tenantId)
      } else if (mode === 'qr') {
        modeLabel = 'Regenerate QR tenant stuck'
        targets = snapshot.sessions.filter((item) => item.key === 'qr').map((item) => item.tenantId)
      } else {
        modeLabel = 'Reset tenant non-ready'
        targets = snapshot.sessions.filter((item) => !item.valid).map((item) => item.tenantId)
      }

      if (targets.length === 0) {
        const msg = `Tidak ada target untuk mode ${modeLabel.toLowerCase()}.`
        setAutoFixResult({
          checkedAt: new Date().toISOString(),
          mode,
          modeLabel,
          total: 0,
          success: 0,
          failed: 0,
          details: [],
          message: msg
        })
        toast.info('Auto Fix', msg)
        appendDiagnosticLog({
          type: 'auto-fix',
          status: 'pass',
          tenantId: '*',
          summary: `${modeLabel}: tidak ada target`,
          payload: { mode, targets }
        })
        return
      }

      const confirmed = window.confirm(
        `Konfirmasi Auto Fix\n\nMode: ${modeLabel}\nTarget tenant: ${targets.length}\n\nLanjutkan tindakan?`
      )
      if (!confirmed) return

      let success = 0
      let failed = 0
      const details = []

      for (const tenantId of targets) {
        try {
          await resetTenantSession(tenantId)
          success += 1
          details.push({ tenantId, ok: true, message: 'reset berhasil' })
        } catch (err) {
          failed += 1
          details.push({ tenantId, ok: false, message: err?.message || 'reset gagal' })
        }
      }

      const nextResult = {
        checkedAt: new Date().toISOString(),
        mode,
        modeLabel,
        total: targets.length,
        success,
        failed,
        details,
        message: failed === 0
          ? `${modeLabel} selesai: ${success}/${targets.length} tenant berhasil.`
          : `${modeLabel} selesai sebagian: berhasil ${success}, gagal ${failed}.`
      }
      setAutoFixResult(nextResult)

      appendDiagnosticLog({
        type: 'auto-fix',
        status: failed === 0 ? 'pass' : success > 0 ? 'warn' : 'fail',
        tenantId: '*',
        summary: `${modeLabel}: success=${success}, failed=${failed}`,
        payload: nextResult
      })

      if (failed === 0) {
        toast.success('Auto Fix selesai', nextResult.message)
      } else {
        toast.warning('Auto Fix selesai sebagian', nextResult.message)
      }

      const refreshed = await getSessionSnapshot()
      const allGood = refreshed.sessions.length > 0 && refreshed.sessions.every((item) => item.valid)
      setConnectionReport({
        checkedAt: refreshed.checkedAt,
        total: refreshed.sessions.length,
        allGood,
        summary: refreshed.summary,
        sessions: refreshed.sessions,
        error: ''
      })
      evaluateAlertRules(refreshed, source)
    } catch (err) {
      const msg = err?.message || 'Auto Fix gagal dijalankan.'
      setAutoFixResult({
        checkedAt: new Date().toISOString(),
        mode,
        modeLabel: mode,
        total: 0,
        success: 0,
        failed: 0,
        details: [],
        message: msg
      })

      appendDiagnosticLog({
        type: 'auto-fix',
        status: 'fail',
        tenantId: '*',
        summary: msg,
        payload: { mode, error: msg }
      })
      toast.error('Auto Fix gagal', msg)
    } finally {
      setAutoFixRunning(false)
    }
  }

  const runQuickTenantReset = async () => {
    const tenantId = String(quickTenantId || '').trim()
    if (!tenantId || autoFixRunning) return
    if (safeMode.enabled) {
      const msg = `Safe Mode aktif. Reset tenant ${tenantId} diblok sementara.`
      toast.warning('Aksi diblok oleh Safe Mode', msg)
      appendDiagnosticLog({
        type: 'safe-mode',
        status: 'warn',
        tenantId,
        summary: 'Reset tenant spesifik diblok',
        payload: { tenantId, reason: msg }
      })
      return
    }

    const confirmed = window.confirm(`Reset sesi untuk tenant ${tenantId}?`) 
    if (!confirmed) return

    setAutoFixRunning(true)
    try {
      await resetTenantSession(tenantId)
      const result = {
        checkedAt: new Date().toISOString(),
        mode: 'single-reset',
        modeLabel: 'Reset tenant spesifik',
        total: 1,
        success: 1,
        failed: 0,
        details: [{ tenantId, ok: true, message: 'reset berhasil' }],
        message: `Tenant ${tenantId} berhasil direset.`
      }
      setAutoFixResult(result)
      appendDiagnosticLog({
        type: 'auto-fix',
        status: 'pass',
        tenantId,
        summary: result.message,
        payload: result
      })
      toast.success('Reset tenant berhasil', tenantId)

      const refreshed = await getSessionSnapshot()
      const allGood = refreshed.sessions.length > 0 && refreshed.sessions.every((item) => item.valid)
      setConnectionReport({
        checkedAt: refreshed.checkedAt,
        total: refreshed.sessions.length,
        allGood,
        summary: refreshed.summary,
        sessions: refreshed.sessions,
        error: ''
      })
      evaluateAlertRules(refreshed, 'single-reset')
    } catch (err) {
      const msg = err?.message || 'Gagal reset tenant spesifik.'
      appendDiagnosticLog({
        type: 'auto-fix',
        status: 'fail',
        tenantId,
        summary: msg,
        payload: { mode: 'single-reset', tenantId, error: msg }
      })
      toast.error('Reset tenant gagal', msg)
    } finally {
      setAutoFixRunning(false)
    }
  }

  const runComprehensiveDiagnostic = async () => {
    if (comprehensiveDiagnosticRunning) return
    if (comprehensiveDiagnosticMode === 'live' && safeMode.enabled) {
      const msg = 'Safe Mode aktif. Diagnostic mode LIVE diblok untuk mencegah perubahan data massal.'
      toast.warning('Diagnostic diblok', msg)
      appendDiagnosticLog({
        type: 'comprehensive-diagnostic',
        status: 'warn',
        tenantId: '*',
        summary: `Mode ${comprehensiveDiagnosticMode} diblok oleh Safe Mode`,
        payload: { mode: comprehensiveDiagnosticMode, reason: msg }
      })
      return
    }

    if (comprehensiveDiagnosticMode === 'live') {
      const confirmed = window.confirm(
        'Mode LIVE akan menjalankan add/check-in/delete data uji. Lanjutkan diagnostic live sekarang?'
      )
      if (!confirmed) return
    }

    setComprehensiveDiagnosticRunning(true)

    try {
      toast.info('Memulai', `Menjalankan diagnostic komprehensif mode ${comprehensiveDiagnosticMode}...`)
      const activeTenant = getActiveTenant()
      const report = await runDiagnosticSuite({
        tenantId: activeTenant?.id,
        mode: comprehensiveDiagnosticMode
      })

      setComprehensiveDiagnosticReport(report)

      appendDiagnosticLog({
        type: 'comprehensive-diagnostic',
        status: report.summary.failed === 0 ? 'pass' : report.summary.passRate >= 80 ? 'warn' : 'fail',
        tenantId: '*',
        summary: `Diagnostic ${report.summary.mode}: ${report.summary.passed}/${report.summary.total} passed (${report.summary.passRate}%)`,
        payload: report
      })

      if (report.summary.failed === 0) {
        toast.success(
          'Diagnostic Komprehensif Selesai',
          `Selesai ${report.summary.mode}: ${report.summary.passed}/${report.summary.total} test pass.`
        )
      } else {
        toast.warning(
          'Diagnostic Menemukan Issues',
          `${report.summary.mode}: ${report.summary.passed}/${report.summary.total} pass, gagal ${report.summary.failed}.`
        )
      }
    } catch (err) {
      const msg = err?.message || 'Comprehensive diagnostic gagal'
      setComprehensiveDiagnosticReport({
        summary: {
          mode: comprehensiveDiagnosticMode,
          total: 0,
          passed: 0,
          failed: 1,
          skipped: 0,
          passRate: 0,
          duration: 0,
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString()
        },
        results: [],
        failedTests: [{ test: 'DIAGNOSTIC_RUNNER', passed: false, message: msg, timestamp: new Date().toISOString() }]
      })

      appendDiagnosticLog({
        type: 'comprehensive-diagnostic',
        status: 'fail',
        tenantId: '*',
        summary: msg,
        payload: { error: msg }
      })

      toast.error('Diagnostic Gagal', msg)
    } finally {
      setComprehensiveDiagnosticRunning(false)
    }
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

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(
        IT_TOOLS_SETTINGS_KEY,
        JSON.stringify({
          alertRules: normalizeAlertRules(alertRules),
          safeMode: normalizeSafeMode(safeMode),
          strictAuditMode: Boolean(strictAuditMode)
        })
      )
    } catch {
      // Ignore persistence failures to keep IT tools usable.
    }
  }, [alertRules, safeMode, strictAuditMode])

  const toggleSafeMode = () => {
    const nextEnabled = !safeMode.enabled
    const confirmed = window.confirm(
      nextEnabled
        ? 'Aktifkan Safe Mode? Aksi berisiko seperti Auto Fix akan diblok.'
        : 'Nonaktifkan Safe Mode? Aksi berisiko akan diizinkan kembali.'
    )
    if (!confirmed) return

    const nextState = {
      ...safeMode,
      enabled: nextEnabled
    }
    setSafeMode(nextState)

    appendDiagnosticLog({
      type: 'safe-mode',
      status: nextEnabled ? 'warn' : 'pass',
      tenantId: '*',
      summary: nextEnabled ? 'Safe Mode diaktifkan' : 'Safe Mode dinonaktifkan',
      payload: {
        enabled: nextEnabled,
        note: nextState.note || ''
      }
    })

    if (nextEnabled) {
      toast.warning('Safe Mode aktif', 'Aksi berisiko diblok sementara.')
    } else {
      toast.success('Safe Mode nonaktif', 'Aksi berisiko diizinkan kembali.')
    }
  }

  const applyAlertPreset = (presetKey) => {
    const preset = ALERT_RULE_PRESETS[presetKey]
    if (!preset) return
    setAlertRules(normalizeAlertRules(preset))
    toast.info('Preset Alert diterapkan', presetKey)
  }

  return (
    <div className="server-verify-tools-page owner-fade-in-up">
      <div className="owner-tab-intro">
        <span className="page-kicker">Operasi IT</span>
        <h2>Alat verifikasi &amp; diagnostik</h2>
        <p>Suite untuk uji koneksi API, audit data, matriks keandalan, dan rekap error. Jalankan dari lingkungan tepercaya; beberapa tugas memuat data besar atau memicu permintaan jaringan beruntun.</p>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Ringkasan Real-time IT Tools</h3>
          <span className="badge badge-yellow">Snapshot lokal</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
            <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Total log</p>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{diagnosticSummary.total}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
            <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Warn log</p>
            <div style={{ fontWeight: 800, fontSize: 22, color: '#b45309' }}>{diagnosticSummary.warn}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
            <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Fail log</p>
            <div style={{ fontWeight: 800, fontSize: 22, color: '#b91c1c' }}>{diagnosticSummary.fail}</div>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
            <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Incident (warn/fail)</p>
            <div style={{ fontWeight: 800, fontSize: 22 }}>{incidentSummary.warn + incidentSummary.fail}</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Rekap Error untuk Tim</h3>
          <span className="badge badge-red">Prioritas Perbaikan</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Ringkasan output error/warning terbaru agar tim teknis bisa langsung fokus ke area bermasalah dan tindakan perbaikannya.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-outline" onClick={exportErrorRecapCsv} disabled={errorRecap.length === 0}>
            <FileDown size={16} /> Export Rekap Error (CSV)
          </button>
        </div>

        {errorRecap.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 120 }}>
            <h3>Belum ada error prioritas</h3>
            <p>Saat ini belum ada output warn/fail yang perlu tindakan khusus.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {errorRecap.map((item) => (
              <div key={`error-recap-${item.type}`} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{item.type}</div>
                  <span style={{ fontWeight: 700, color: item.fail > 0 ? '#b91c1c' : '#b45309' }}>
                    fail: {item.fail} | warn: {item.warn}
                  </span>
                </div>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 6, marginBottom: 4 }}>
                  Last seen: {new Date(item.lastSeen).toLocaleString('id-ID')} | Total kejadian: {item.total}
                </p>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 4 }}>
                  Output terbaru: {item.latestSummary}
                </p>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 4 }}>
                  Tenant terkait: {(item.tenants || []).join(', ') || '-'}
                </p>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 0, color: '#0f766e', fontWeight: 600 }}>
                  Langkah cepat: {item.action}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16, position: 'sticky', top: 8, zIndex: 5 }}>
        <div className="card-header">
          <h3 className="card-title">Quick Action Bar</h3>
          <span className="badge badge-yellow">Aksi cepat</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn btn-outline" onClick={runPlatformHealthCheck} disabled={healthRunning}>Health Check</button>
          <button className="btn btn-outline" onClick={runEndpointMatrixTest} disabled={matrixRunning}>Endpoint Matrix</button>
          <button className="btn btn-outline" onClick={runDeviceConnectionCheck} disabled={connectionRunning}>Cek Device</button>
          <button className="btn btn-outline" onClick={runRuntimeInfoCheck} disabled={runtimeRunning}>Runtime Info</button>
          <button className="btn btn-outline" onClick={() => runAlertEvaluation('manual')} disabled={alertRunning}>Evaluasi Alert</button>
          <button className="btn btn-success" onClick={runComprehensiveDiagnostic} disabled={comprehensiveDiagnosticRunning}>
            {comprehensiveDiagnosticRunning ? 'Menjalankan Diagnostic...' : 'Semua Operasi Diagnostic'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
          <label className="scanner-note scanner-note-tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            Mode diagnostic:
            <select className="form-select" value={comprehensiveDiagnosticMode} onChange={(e) => setComprehensiveDiagnosticMode(e.target.value)} style={{ minWidth: 180 }}>
              <option value="dry-run">Dry Run (aman, non-mutasi)</option>
              <option value="live">Live (uji add/scan/delete)</option>
            </select>
          </label>
          <span className={`badge ${comprehensiveDiagnosticMode === 'live' ? 'badge-red' : 'badge-green'}`}>
            {comprehensiveDiagnosticMode === 'live' ? 'Mode LIVE' : 'Mode DRY-RUN'}
          </span>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Diagnostik</h3>
        <p className="scanner-note" style={{ margin: '4px 0 0 0' }}>Pemeriksaan teknis, observability, dan audit endpoint.</p>
      </div>

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
          <span className="badge badge-yellow">Aplikasi · server · WhatsApp · penyimpanan data</span>
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
          <h3 className="card-title">Endpoint Test Matrix</h3>
          <span className="badge badge-yellow">PASS/FAIL terstruktur</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Jalankan batch pengujian endpoint inti untuk verifikasi cepat kondisi API dan integrasi client.
        </p>
        <button className="btn btn-secondary" onClick={runEndpointMatrixTest} disabled={matrixRunning}>
          {matrixRunning
            ? (<><span className="spinner qr-spinner-sm"></span> Menjalankan endpoint matrix...</>)
            : (<><RefreshCw size={16} /> Jalankan Endpoint Matrix</>)}
        </button>

        {matrixReport && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>
              Hasil: {matrixReport.passed}/{matrixReport.total} {matrixReport.allPassed ? 'PASS' : 'perlu tindakan'}
            </p>
            {matrixReport.results.map((item) => (
              <div key={item.key} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{item.label}</div>
                  <span style={{ fontWeight: 700, color: item.ok ? '#166534' : '#b91c1c' }}>
                    {item.ok ? 'PASS' : 'FAIL'} | HTTP {item.status || '-'} | {item.latencyMs}ms
                  </span>
                </div>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 6, marginBottom: 0 }}>{item.detail}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Audit Lengkap Admin + Owner + Backend</h3>
          <span className="badge badge-yellow">Cakupan fitur krusial</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Jalankan audit terpadu untuk memeriksa data backend, fitur krusial admin, dan fitur owner apakah berjalan lancar.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-secondary" onClick={runFullSystemAudit} disabled={fullAuditRunning}>
            {fullAuditRunning
              ? (<><span className="spinner qr-spinner-sm"></span> Menjalankan audit lengkap...</>)
              : (<><RefreshCw size={16} /> Jalankan Audit Lengkap</>)}
          </button>
          <label className="scanner-note scanner-note-tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={strictAuditMode}
              onChange={(e) => setStrictAuditMode(e.target.checked)}
            />
            Strict audit mode (WARN dianggap FAIL)
          </label>
          <label className="scanner-note scanner-note-tight" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={fullAuditOnlyIssues}
              onChange={(e) => setFullAuditOnlyIssues(e.target.checked)}
            />
            Tampilkan hanya warn/fail
          </label>
        </div>

        {fullAuditReport && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
            <button className="btn btn-outline" onClick={exportFullAuditCsv}>
              <FileDown size={16} /> Export Full Audit CSV
            </button>
            <button className="btn btn-outline" onClick={exportFullAuditPdf}>
              <FileDown size={16} /> Export Full Audit PDF
            </button>
          </div>
        )}

        {fullAuditReport && (
          <div style={{ display: 'grid', gap: 8 }}>
            <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>
              Ringkasan audit ({fullAuditReport.summary.strictLabel || (strictAuditMode ? 'STRICT' : 'NORMAL')}): PASS {fullAuditReport.summary.pass} | WARN {fullAuditReport.summary.warn} | FAIL {fullAuditReport.summary.fail} | Effective FAIL {fullAuditReport.summary.effectiveFail ?? fullAuditReport.summary.fail} | TOTAL {fullAuditReport.summary.total}
            </p>

            {fullAuditReport.groups.map((group) => {
              const visibleItems = fullAuditOnlyIssues
                ? group.items.filter((item) => item.status !== 'pass')
                : group.items

              if (visibleItems.length === 0) return null

              return (
                <div key={`audit-group-${group.category}`} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontWeight: 700, textTransform: 'capitalize' }}>{group.category}</div>
                    <span className="scanner-note scanner-note-tight" style={{ margin: 0 }}>
                      pass {group.pass} | warn {group.warn} | fail {group.fail}
                    </span>
                  </div>

                  <div style={{ marginTop: 8, display: 'grid', gap: 6 }}>
                    {visibleItems.map((item) => (
                      <div key={item.key} style={{ border: '1px solid #edf2f7', borderRadius: 8, padding: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                          <div style={{ fontWeight: 600 }}>{item.label}</div>
                          <span style={{ fontWeight: 700, color: item.status === 'pass' ? '#166534' : item.status === 'warn' ? '#b45309' : '#b91c1c' }}>
                            {item.status.toUpperCase()} | {item.latencyMs}ms
                          </span>
                        </div>
                        <p className="scanner-note scanner-note-tight" style={{ marginTop: 4, marginBottom: 0 }}>{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Device Version & Runtime Info</h3>
          <span className="badge badge-yellow">WA service observability</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Tampilkan informasi versi service, uptime proses, pemakaian memori, dan ringkasan sesi tenant.
        </p>
        <button className="btn btn-secondary" onClick={runRuntimeInfoCheck} disabled={runtimeRunning}>
          {runtimeRunning
            ? (<><span className="spinner qr-spinner-sm"></span> Mengambil runtime info...</>)
            : (<><Server size={16} /> Muat Runtime Info</>)}
        </button>

        {runtimeInfo && (
          <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>
                Service v{runtimeInfo.version || '-'} | Node {runtimeInfo.nodeVersion || '-'} | PID {runtimeInfo.pid || '-'}
              </p>
              <p className="scanner-note scanner-note-tight" style={{ marginTop: 6, marginBottom: 0 }}>
                Uptime: {runtimeInfo.uptimeSeconds || 0}s | Platform: {runtimeInfo.platform || '-'} | Start: {runtimeInfo.startedAt ? new Date(runtimeInfo.startedAt).toLocaleString('id-ID') : '-'}
              </p>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>
                Memory (MB) | rss: {runtimeInfo.memoryMb?.rss ?? '-'} | heapUsed: {runtimeInfo.memoryMb?.heapUsed ?? '-'} | heapTotal: {runtimeInfo.memoryMb?.heapTotal ?? '-'} | external: {runtimeInfo.memoryMb?.external ?? '-'}
              </p>
              <p className="scanner-note scanner-note-tight" style={{ marginTop: 6, marginBottom: 0 }}>
                Sessions total: {runtimeInfo.sessions?.total ?? 0} | ready: {runtimeInfo.sessions?.summary?.ready ?? 0} | qr: {runtimeInfo.sessions?.summary?.qr ?? 0} | checking: {runtimeInfo.sessions?.summary?.checking ?? 0} | offline: {runtimeInfo.sessions?.summary?.offline ?? 0}
              </p>
            </div>
          </div>
        )}
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

      <div style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Operasional</h3>
        <p className="scanner-note" style={{ margin: '4px 0 0 0' }}>Kontrol live event, alert rule, safe mode, dan aksi perbaikan.</p>
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

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-outline" onClick={() => applyAlertPreset('conservative')}>Preset Conservative</button>
          <button className="btn btn-outline" onClick={() => applyAlertPreset('normal')}>Preset Normal</button>
          <button className="btn btn-outline" onClick={() => applyAlertPreset('aggressive')}>Preset Aggressive</button>
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

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Safe Mode Switch</h3>
          <span className={`badge ${safeMode.enabled ? 'badge-red' : 'badge-green'}`}>
            {safeMode.enabled ? 'AKTIF' : 'NONAKTIF'}
          </span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Mode darurat untuk mencegah perubahan massal saat event live. Ketika aktif, tindakan Auto Fix dan reset tenant akan diblok.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button className={`btn ${safeMode.enabled ? 'btn-danger' : 'btn-secondary'}`} onClick={toggleSafeMode}>
            {safeMode.enabled ? 'Nonaktifkan Safe Mode' : 'Aktifkan Safe Mode'}
          </button>
        </div>

        <input
          className="form-input"
          value={safeMode.note}
          onChange={(e) => setSafeMode((prev) => ({ ...prev, note: e.target.value }))}
          placeholder="Catatan mode darurat (opsional)"
        />
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Auto Fix Ringan</h3>
          <span className="badge badge-yellow">Aman dengan konfirmasi</span>
        </div>
        <p className="scanner-note" style={{ marginBottom: 12 }}>
          Jalankan perbaikan cepat untuk tenant bermasalah tanpa perlu akses manual ke menu admin satu per satu.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          <button className="btn btn-outline" onClick={() => runAutoFix('offline', 'auto-fix')} disabled={autoFixRunning}>
            {autoFixRunning ? (<><span className="spinner qr-spinner-sm"></span> Menjalankan auto fix...</>) : 'Reset Semua Offline'}
          </button>
          <button className="btn btn-outline" onClick={() => runAutoFix('qr', 'auto-fix')} disabled={autoFixRunning}>
            {autoFixRunning ? (<><span className="spinner qr-spinner-sm"></span> Menjalankan auto fix...</>) : 'Regenerate Semua QR Stuck'}
          </button>
          <button className="btn btn-outline" onClick={() => runAutoFix('non-ready', 'auto-fix')} disabled={autoFixRunning}>
            {autoFixRunning ? (<><span className="spinner qr-spinner-sm"></span> Menjalankan auto fix...</>) : 'Reset Semua Non-Ready'}
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
          <input
            className="form-input"
            style={{ maxWidth: 280 }}
            value={quickTenantId}
            onChange={(e) => setQuickTenantId(e.target.value)}
            placeholder="tenant id untuk reset cepat"
          />
          <button className="btn btn-outline" onClick={runQuickTenantReset} disabled={autoFixRunning || !quickTenantId.trim()}>
            Reset Tenant Spesifik
          </button>
        </div>

        {autoFixResult && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
            <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 6 }}>
              {autoFixResult.modeLabel} | Berhasil: {autoFixResult.success} | Gagal: {autoFixResult.failed} | Target: {autoFixResult.total}
            </p>
            <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 8 }}>
              {autoFixResult.message}
            </p>
            {autoFixResult.details.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Detail Auto Fix</summary>
                <pre style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', overflowX: 'auto', fontSize: 12 }}>
                  {prettyJson(autoFixResult.details)}
                </pre>
              </details>
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

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">
          <h3 className="card-title">Incident Timeline</h3>
          <span className="badge badge-yellow">Gangguan & tindakan terbaru</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 12 }}>
          <input
            className="form-input"
            value={incidentTenantFilter}
            onChange={(e) => setIncidentTenantFilter(e.target.value)}
            placeholder="Filter tenant incident"
          />
          <select className="form-select" value={incidentTypeFilter} onChange={(e) => setIncidentTypeFilter(e.target.value)}>
            <option value="all">Semua kategori</option>
            <option value="alert-rule">Alert trigger</option>
            <option value="alert-evaluation">Alert evaluation</option>
            <option value="device-connection-check">Device connection</option>
            <option value="auto-fix">Auto fix</option>
            <option value="runtime-info">Runtime info</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <button className="btn btn-outline" onClick={exportIncidentTimelineCsv} disabled={incidentTimeline.length === 0}>
            <FileDown size={16} /> Export Incident CSV
          </button>
        </div>

        {incidentTimeline.length === 0 ? (
          <div className="empty-state" style={{ minHeight: 120 }}>
            <h3>Tidak ada insiden aktif</h3>
            <p>Timeline akan tampil saat ada event status warn/fail dari modul IT tools.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {incidentTimeline.map((item) => (
              <div key={`incident-${item.id}`} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ fontWeight: 700 }}>{item.type} | {item.tenantId}</div>
                  <span style={{ fontWeight: 700, color: item.status === 'fail' ? '#b91c1c' : '#b45309' }}>{item.status.toUpperCase()}</span>
                </div>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 6, marginBottom: 4 }}>{item.summary}</p>
                <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>{new Date(item.checkedAt).toLocaleString('id-ID')}</p>
              </div>
            ))}
          </div>
        )}
      </div>

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
            <option value="auto-fix">Auto fix</option>
            <option value="endpoint-matrix">Endpoint matrix</option>
            <option value="full-system-audit">Full system audit</option>
            <option value="runtime-info">Runtime info</option>
            <option value="safe-mode">Safe mode</option>
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
          <button className="btn btn-danger" onClick={clearDiagnosticLogs} disabled={diagnosticLogs.length === 0}>
            Hapus Semua Log
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

      {comprehensiveDiagnosticReport && (
        <div className={`card ${comprehensiveDiagnosticReport.summary.failed === 0 ?'border-success' : 'border-error'}`} style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3 className="card-title">Hasil Diagnostic Komprehensif Semua Operasi</h3>
            <span className={`badge ${comprehensiveDiagnosticReport.summary.failed === 0 ? 'badge-green' : comprehensiveDiagnosticReport.summary.passRate >= 80 ? 'badge-yellow' : 'badge-red'}`}>
              {comprehensiveDiagnosticReport.summary.passed}/{comprehensiveDiagnosticReport.summary.total} ({comprehensiveDiagnosticReport.summary.passRate}%)
            </span>
          </div>

          <p className="scanner-note" style={{ marginBottom: 12 }}>
            Diagnostic komprehensif mentest semua operasi sistem: add peserta, delete, invoice, kontrak, sync data, backup, WA server, endpoints, dan lainnya untuk memastikan data tersimpan dengan benar.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 12 }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Total Tests</p>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{comprehensiveDiagnosticReport.summary.total}</div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Passed</p>
              <div style={{ fontWeight: 800, fontSize: 22, color: '#166534' }}>{comprehensiveDiagnosticReport.summary.passed}</div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Failed</p>
              <div style={{ fontWeight: 800, fontSize: 22, color: comprehensiveDiagnosticReport.summary.failed > 0 ? '#b91c1c' : '#166534' }}>
                {comprehensiveDiagnosticReport.summary.failed}
              </div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Skipped</p>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{comprehensiveDiagnosticReport.summary.skipped || 0}</div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Pass Rate</p>
              <div style={{ fontWeight: 800, fontSize: 22 }}>{comprehensiveDiagnosticReport.summary.passRate}%</div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Duration</p>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{comprehensiveDiagnosticReport.summary.duration}ms</div>
            </div>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fff' }}>
              <p className="scanner-note scanner-note-tight" style={{ margin: 0 }}>Mode</p>
              <div style={{ fontWeight: 800, fontSize: 18 }}>{String(comprehensiveDiagnosticReport.summary.mode || 'dry-run').toUpperCase()}</div>
            </div>
          </div>

          {comprehensiveDiagnosticReport.summary.failed > 0 && (
            <div style={{ border: '1px solid #dc2626', borderRadius: 10, padding: 10, background: '#fee2e2', marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#991b1b' }}>{comprehensiveDiagnosticReport.summary.failed} test gagal - perlu perhatian</p>
              <p className="scanner-note scanner-note-tight" style={{ margin: '6px 0 0 0' }}>
                Beberapa operasi sistem tidak berfungsi normal. Lihat detail di bawah untuk tindakan perbaikan.
              </p>
            </div>
          )}

          {comprehensiveDiagnosticReport.failedTests?.length > 0 && (
            <div style={{ border: '1px solid #fde68a', borderRadius: 10, padding: 10, background: '#fffbeb', marginBottom: 12 }}>
              <p style={{ margin: 0, fontWeight: 700, color: '#92400e' }}>Rekomendasi tindakan cepat</p>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {comprehensiveDiagnosticReport.failedTests.map((item) => (
                  <div key={`action-${item.test}`} style={{ border: '1px solid #fcd34d', borderRadius: 8, padding: 8, background: '#fff' }}>
                    <div style={{ fontWeight: 700 }}>{item.test}</div>
                    <p className="scanner-note scanner-note-tight" style={{ margin: '4px 0 0 0' }}>{item.action || getDiagnosticActionHint(item.test)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            {comprehensiveDiagnosticReport.results.map((result) => (
              <details key={result.test} style={{ border: `1px solid ${result.passed ? '#d1fae5' : '#fee2e2'}`, borderRadius: 10, padding: 10, background: '#fff' }}>
                <summary style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontWeight: 700 }}>{result.test}</span>
                  <span style={{ fontWeight: 700, color: result.passed ? '#166534' : '#b91c1c' }}>
                    {result.passed ? 'PASS' : 'FAIL'}
                  </span>
                </summary>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 8, marginBottom: 6 }}>{result.message}</p>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 8, color: '#666' }}>
                  {new Date(result.timestamp).toLocaleString('id-ID')}
                </p>
                <p className="scanner-note scanner-note-tight" style={{ marginTop: 0, marginBottom: 8, color: '#0f766e', fontWeight: 600 }}>
                  Tindakan: {result.action || getDiagnosticActionHint(result.test)}
                </p>
                {result.details && (
                  <pre style={{ marginTop: 8, padding: 10, borderRadius: 8, background: '#0f172a', color: '#e2e8f0', overflowX: 'auto', fontSize: 12 }}>
                    {prettyJson(result.details)}
                  </pre>
                )}
              </details>
            ))}
          </div>

          <p className="scanner-note scanner-note-tiny" style={{ marginTop: 12, marginBottom: 0 }}>
            <strong>Interpretasi Hasil:</strong> Jika ada yang FAIL, itu berarti ada bug dalam sistem (misal: data add tapi tidak tersimpan, endpoint error, sync gagal, dll). 
            Hubungi tim teknis dengan detail error dan rekomendasi tindakan di atas. Jika semua PASS, sistem siap digunakan.
          </p>
        </div>
      )}
    </div>
  )
}
