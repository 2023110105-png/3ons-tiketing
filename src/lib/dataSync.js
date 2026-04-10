import * as supabaseSync from './supabaseSync.js'
import { isSupabaseEnabled } from './supabase.js'

const DEFAULT_TENANT_ID = 'tenant-default'

function provider() {
  return supabaseSync
}

export function isWorkspaceSyncEnabled() {
  return isSupabaseEnabled
}

function scopeTenantPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') return payload
  const next = { ...payload }
  if (Object.prototype.hasOwnProperty.call(next, 'tenantId')) {
    next.tenantId = DEFAULT_TENANT_ID
  }
  if (Object.prototype.hasOwnProperty.call(next, 'tenant_id')) {
    next.tenant_id = DEFAULT_TENANT_ID
  }
  return next
}

export function fetchFirebaseWorkspaceSnapshot() {
  return provider().fetchFirebaseWorkspaceSnapshot()
}

export function subscribeWorkspaceChanges(onChange) {
  if (typeof provider().subscribeWorkspaceChanges !== 'function') {
    return () => {}
  }
  return provider().subscribeWorkspaceChanges(onChange)
}

export function syncAuditLog(payload) {
  return provider().syncAuditLog(scopeTenantPayload(payload))
}

export function syncCheckInLog(payload) {
  return provider().syncCheckInLog(scopeTenantPayload(payload))
}

export function syncResetCheckInLogs(payload) {
  return provider().syncResetCheckInLogs(scopeTenantPayload(payload))
}

export function syncResetAdminLogs(payload) {
  return provider().syncResetAdminLogs(scopeTenantPayload(payload))
}

export function syncEventDelete(payload) {
  return provider().syncEventDelete(scopeTenantPayload(payload))
}

export function syncEventSnapshot(payload) {
  return provider().syncEventSnapshot(scopeTenantPayload(payload))
}

export function syncParticipantDelete(payload) {
  return provider().syncParticipantDelete(scopeTenantPayload(payload))
}

export function syncParticipantUpsert(payload) {
  return provider().syncParticipantUpsert(scopeTenantPayload(payload))
}

export function syncTenantDelete(tenantId) {
  const scopedTenantId = String(tenantId || '').trim()
  if (scopedTenantId && scopedTenantId !== DEFAULT_TENANT_ID) {
    return Promise.resolve(false)
  }
  return provider().syncTenantDelete(DEFAULT_TENANT_ID)
}

export function syncTenantUserDelete(payload) {
  return provider().syncTenantUserDelete(scopeTenantPayload(payload))
}

export function syncTenantUserUpsert(payload) {
  return provider().syncTenantUserUpsert(scopeTenantPayload(payload))
}

export function syncTenantUpsert(tenant) {
  const nextTenant = {
    ...(tenant || {}),
    id: DEFAULT_TENANT_ID
  }
  return provider().syncTenantUpsert(nextTenant)
}

