import * as firebaseSync from './firebaseSync'
import * as supabaseSync from './supabaseSync'
import { isFirebaseEnabled } from './firebase'
import { isSupabaseEnabled } from './supabase'

function getBackend() {
  const mode = String(import.meta.env.VITE_DATA_BACKEND || 'supabase').trim().toLowerCase()
  return mode === 'supabase' ? 'supabase' : 'firebase'
}

function provider() {
  return getBackend() === 'supabase' ? supabaseSync : firebaseSync
}

export function isWorkspaceSyncEnabled() {
  return getBackend() === 'supabase' ? isSupabaseEnabled : isFirebaseEnabled
}

export function fetchFirebaseWorkspaceSnapshot() {
  return provider().fetchFirebaseWorkspaceSnapshot()
}

export function syncAuditLog(payload) {
  return provider().syncAuditLog(payload)
}

export function syncCheckInLog(payload) {
  return provider().syncCheckInLog(payload)
}

export function syncResetCheckInLogs(payload) {
  return provider().syncResetCheckInLogs(payload)
}

export function syncResetAdminLogs(payload) {
  return provider().syncResetAdminLogs(payload)
}

export function syncEventDelete(payload) {
  return provider().syncEventDelete(payload)
}

export function syncEventSnapshot(payload) {
  return provider().syncEventSnapshot(payload)
}

export function syncParticipantDelete(payload) {
  return provider().syncParticipantDelete(payload)
}

export function syncParticipantUpsert(payload) {
  return provider().syncParticipantUpsert(payload)
}

export function syncTenantDelete(tenantId) {
  return provider().syncTenantDelete(tenantId)
}

export function syncTenantUserDelete(payload) {
  return provider().syncTenantUserDelete(payload)
}

export function syncTenantUserUpsert(payload) {
  return provider().syncTenantUserUpsert(payload)
}

export function syncTenantUpsert(tenant) {
  return provider().syncTenantUpsert(tenant)
}

