import { describe, it, expect } from 'vitest'
import {
  normalizeAlertRules,
  normalizeSafeMode,
  filterDiagnosticLogs,
  buildIncidentTimeline,
  summarizeDiagnosticLogs,
  summarizeIncidentTimeline
} from './serverVerifyTools.helpers'

describe('serverVerifyTools.helpers', () => {
  it('normalizes alert rules with minimum safe values', () => {
    const rules = normalizeAlertRules({
      enabled: 'yes',
      autoMonitor: 1,
      offlineMinutes: 0,
      nonReadyTenantThreshold: -5,
      cooldownMinutes: null
    })

    expect(rules.enabled).toBe(true)
    expect(rules.autoMonitor).toBe(true)
    expect(rules.offlineMinutes).toBeGreaterThanOrEqual(1)
    expect(rules.nonReadyTenantThreshold).toBeGreaterThanOrEqual(1)
    expect(rules.cooldownMinutes).toBeGreaterThanOrEqual(1)
  })

  it('normalizes safe mode object', () => {
    const mode = normalizeSafeMode({ enabled: 1, note: 12345 })
    expect(mode.enabled).toBe(true)
    expect(mode.note).toBe('12345')
  })

  it('filters diagnostic logs by tenant, status, and type', () => {
    const now = new Date().toISOString()
    const logs = [
      { checkedAt: now, tenantId: 'tenant-a', status: 'warn', type: 'alert-rule' },
      { checkedAt: now, tenantId: 'tenant-b', status: 'pass', type: 'runtime-info' },
      { checkedAt: now, tenantId: 'tenant-a', status: 'fail', type: 'auto-fix' }
    ]

    const filtered = filterDiagnosticLogs(logs, {
      tenantQuery: 'tenant-a',
      statusFilter: 'fail',
      typeFilter: 'auto-fix',
      timeFilter: '24h'
    })

    expect(filtered.length).toBe(1)
    expect(filtered[0].tenantId).toBe('tenant-a')
    expect(filtered[0].status).toBe('fail')
  })

  it('builds incident timeline from warn/fail incident types only', () => {
    const now = new Date().toISOString()
    const logs = [
      { id: '1', checkedAt: now, tenantId: 'tenant-a', status: 'warn', type: 'alert-rule' },
      { id: '2', checkedAt: now, tenantId: 'tenant-a', status: 'pass', type: 'alert-rule' },
      { id: '3', checkedAt: now, tenantId: 'tenant-b', status: 'fail', type: 'auto-fix' },
      { id: '4', checkedAt: now, tenantId: 'tenant-c', status: 'fail', type: 'verify-self-test' }
    ]

    const incidents = buildIncidentTimeline(logs, { tenantFilter: '', typeFilter: 'all', limit: 30 })
    expect(incidents.length).toBe(2)
    expect(incidents.every((item) => item.status === 'warn' || item.status === 'fail')).toBe(true)
  })

  it('summarizes diagnostic and incident counts correctly', () => {
    const logs = [
      { status: 'pass' },
      { status: 'warn' },
      { status: 'fail' },
      { status: 'warn' }
    ]
    const diagnostic = summarizeDiagnosticLogs(logs)
    expect(diagnostic).toEqual({ total: 4, pass: 1, warn: 2, fail: 1 })

    const incidents = summarizeIncidentTimeline([{ status: 'warn' }, { status: 'fail' }, { status: 'pass' }])
    expect(incidents).toEqual({ warn: 1, fail: 1 })
  })
})
