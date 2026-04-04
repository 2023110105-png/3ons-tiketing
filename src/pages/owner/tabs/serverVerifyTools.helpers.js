export const DEFAULT_ALERT_RULES = {
  enabled: true,
  autoMonitor: true,
  offlineMinutes: 10,
  nonReadyTenantThreshold: 3,
  cooldownMinutes: 5
}

export const ALERT_RULE_PRESETS = {
  conservative: { enabled: true, autoMonitor: true, offlineMinutes: 15, nonReadyTenantThreshold: 5, cooldownMinutes: 10 },
  normal: { ...DEFAULT_ALERT_RULES },
  aggressive: { enabled: true, autoMonitor: true, offlineMinutes: 5, nonReadyTenantThreshold: 2, cooldownMinutes: 3 }
}

export const DEFAULT_SAFE_MODE = {
  enabled: false,
  note: ''
}

export function normalizeAlertRules(value) {
  const merged = { ...DEFAULT_ALERT_RULES, ...(value || {}) }
  return {
    enabled: Boolean(merged.enabled),
    autoMonitor: Boolean(merged.autoMonitor),
    offlineMinutes: Math.max(1, Number(merged.offlineMinutes) || DEFAULT_ALERT_RULES.offlineMinutes),
    nonReadyTenantThreshold: Math.max(1, Number(merged.nonReadyTenantThreshold) || DEFAULT_ALERT_RULES.nonReadyTenantThreshold),
    cooldownMinutes: Math.max(1, Number(merged.cooldownMinutes) || DEFAULT_ALERT_RULES.cooldownMinutes)
  }
}

export function normalizeSafeMode(value) {
  const merged = { ...DEFAULT_SAFE_MODE, ...(value || {}) }
  return {
    enabled: Boolean(merged.enabled),
    note: String(merged.note || '')
  }
}

export function filterDiagnosticLogs(logs, { tenantQuery = '', statusFilter = 'all', typeFilter = 'all', timeFilter = '24h' } = {}) {
  const now = Date.now()
  const query = String(tenantQuery || '').trim().toLowerCase()

  return (Array.isArray(logs) ? logs : []).filter((item) => {
    const tenantMatch = !query || String(item?.tenantId || '').toLowerCase().includes(query)
    const statusMatch = statusFilter === 'all' || item?.status === statusFilter
    const typeMatch = typeFilter === 'all' || item?.type === typeFilter

    let timeMatch = true
    if (timeFilter !== 'all') {
      const checkedAtMs = new Date(item?.checkedAt || 0).getTime()
      const limitMs = timeFilter === '1h' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000
      timeMatch = Number.isFinite(checkedAtMs) && now - checkedAtMs <= limitMs
    }

    return tenantMatch && statusMatch && typeMatch && timeMatch
  })
}

export function buildIncidentTimeline(logs, { tenantFilter = '', typeFilter = 'all', limit = 30 } = {}) {
  const incidentTypeSet = new Set(['alert-rule', 'alert-evaluation', 'device-connection-check', 'auto-fix', 'runtime-info'])
  const tenantQuery = String(tenantFilter || '').trim().toLowerCase()

  return (Array.isArray(logs) ? logs : [])
    .filter((item) => incidentTypeSet.has(item?.type) && (item?.status === 'warn' || item?.status === 'fail'))
    .filter((item) => {
      const tenantMatch = !tenantQuery || String(item?.tenantId || '').toLowerCase().includes(tenantQuery)
      const typeMatch = typeFilter === 'all' || item?.type === typeFilter
      return tenantMatch && typeMatch
    })
    .slice(0, Math.max(1, Number(limit) || 30))
}

export function summarizeDiagnosticLogs(logs) {
  return (Array.isArray(logs) ? logs : []).reduce((acc, item) => {
    acc.total += 1
    if (item?.status === 'pass') acc.pass += 1
    else if (item?.status === 'warn') acc.warn += 1
    else if (item?.status === 'fail') acc.fail += 1
    return acc
  }, { total: 0, pass: 0, warn: 0, fail: 0 })
}

export function summarizeIncidentTimeline(incidentTimeline) {
  return (Array.isArray(incidentTimeline) ? incidentTimeline : []).reduce((acc, item) => {
    if (item?.status === 'warn') acc.warn += 1
    if (item?.status === 'fail') acc.fail += 1
    return acc
  }, { warn: 0, fail: 0 })
}
