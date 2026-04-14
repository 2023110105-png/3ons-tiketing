/**
 * Tenant Service
 * Business logic for tenant operations
 */
import { supabase } from '../api/supabase'

const TABLES = {
  TENANTS: 'tenants',
  GATE_USERS: 'gate_users',
  TENANT_ADMINS: 'tenant_admins',
  WORKSPACE_STATE: 'workspace_state',
}

/**
 * Get all tenants
 */
export async function getAllTenants() {
  const { data, error } = await supabase
    .from(TABLES.TENANTS)
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

/**
 * Get tenant by ID
 */
export async function getTenantById(id) {
  const { data, error } = await supabase
    .from(TABLES.TENANTS)
    .select('*, gate_users(*)')
    .eq('id', id)
    .single()

  if (error) throw error
  return data
}

/**
 * Create new tenant
 */
export async function createTenant(tenantData) {
  const { data, error } = await supabase
    .from(TABLES.TENANTS)
    .insert({
      name: tenantData.name,
      code: tenantData.code,
      description: tenantData.description,
      is_active: tenantData.is_active ?? true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update tenant
 */
export async function updateTenant(id, updates) {
  const { data, error } = await supabase
    .from(TABLES.TENANTS)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete tenant
 */
export async function deleteTenant(id) {
  const { error } = await supabase
    .from(TABLES.TENANTS)
    .delete()
    .eq('id', id)

  if (error) throw error
  return { success: true }
}

/**
 * Get gate users for tenant
 */
export async function getGateUsersByTenant(tenantId) {
  const { data, error } = await supabase
    .from(TABLES.GATE_USERS)
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  if (error) throw error
  return data || []
}

/**
 * Create gate user
 */
export async function createGateUser(userData) {
  const { data, error } = await supabase
    .from(TABLES.GATE_USERS)
    .insert({
      tenant_id: userData.tenantId,
      username: userData.username,
      name: userData.name,
      full_name: userData.fullName,
      gate_assignment: userData.gateAssignment || 'front',
      password_hash: userData.password || '123456', // Should be hashed
      is_active: true,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Update gate user
 */
export async function updateGateUser(id, updates) {
  const { data, error } = await supabase
    .from(TABLES.GATE_USERS)
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete gate user
 */
export async function deleteGateUser(id) {
  const { error } = await supabase
    .from(TABLES.GATE_USERS)
    .delete()
    .eq('id', id)

  if (error) throw error
  return { success: true }
}

/**
 * Sync tenant to workspace state
 */
export async function syncTenantToWorkspace(tenant) {
  // This would sync tenant data to workspace_state table
  // Implementation depends on your dataSync.js logic
  const { syncTenantUpsert } = await import('../lib/dataSync')
  return syncTenantUpsert({
    tenantId: tenant.id,
    tenant: tenant,
  })
}
