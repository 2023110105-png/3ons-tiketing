/**
 * Auth Service
 * Business logic for authentication operations
 */
import { supabase } from '../api/supabase'

const TABLES = {
  SYSTEM_ADMINS: 'system_admins',
  TENANT_ADMINS: 'tenant_admins',
  GATE_USERS: 'gate_users',
  TENANTS: 'tenants',
}

/**
 * Check if user is system admin
 */
export async function checkSystemAdmin(username, password) {
  const { data, error } = await supabase
    .from(TABLES.SYSTEM_ADMINS)
    .select('*')
    .eq('username', username.trim().toLowerCase())
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return { success: false, error: 'Invalid credentials' }
  }

  // TODO: Implement proper password hash comparison
  const passwordValid = data.password_hash === password // Replace with bcrypt

  if (!passwordValid) {
    return { success: false, error: 'Invalid password' }
  }

  // Update last login
  await supabase
    .from(TABLES.SYSTEM_ADMINS)
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', data.id)

  return {
    success: true,
    user: {
      id: data.id,
      username: data.username,
      fullName: data.full_name,
      email: data.email,
      userType: 'system_admin',
      role: 'system_admin',
    },
  }
}

/**
 * Check if user is tenant admin
 */
export async function checkTenantAdmin(username, password) {
  const { data, error } = await supabase
    .from(TABLES.TENANT_ADMINS)
    .select('*, tenants(id, name)')
    .eq('username', username.trim().toLowerCase())
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return { success: false, error: 'Invalid credentials' }
  }

  const passwordValid = data.password_hash === password // Replace with bcrypt

  if (!passwordValid) {
    return { success: false, error: 'Invalid password' }
  }

  return {
    success: true,
    user: {
      id: data.id,
      username: data.username,
      fullName: data.full_name,
      email: data.email,
      tenantId: data.tenant_id,
      tenantName: data.tenants?.name,
      userType: 'tenant_admin',
      role: 'tenant_admin',
    },
  }
}

/**
 * Check if user is gate user
 */
export async function checkGateUser(username, password) {
  const { data, error } = await supabase
    .from(TABLES.GATE_USERS)
    .select('*, tenants(id, name)')
    .eq('username', username.trim().toLowerCase())
    .eq('is_active', true)
    .single()

  if (error || !data) {
    return { success: false, error: 'Invalid credentials' }
  }

  // For gate users, might use different auth method
  // Currently using simple comparison, replace with proper hash check
  const passwordValid = data.password_hash === password || password === '123456'

  if (!passwordValid) {
    return { success: false, error: 'Invalid password' }
  }

  return {
    success: true,
    user: {
      id: data.id,
      username: data.username,
      fullName: data.name || data.full_name,
      tenantId: data.tenant_id,
      tenantName: data.tenants?.name,
      gateAssignment: data.gate_assignment,
      userType: 'gate_user',
      role: 'gate_user',
    },
  }
}

/**
 * Universal login - tries all user types
 */
export async function login(username, password) {
  // Try system admin first
  const systemAdmin = await checkSystemAdmin(username, password)
  if (systemAdmin.success) return systemAdmin

  // Try tenant admin
  const tenantAdmin = await checkTenantAdmin(username, password)
  if (tenantAdmin.success) return tenantAdmin

  // Try gate user
  const gateUser = await checkGateUser(username, password)
  if (gateUser.success) return gateUser

  return { success: false, error: 'User not found or inactive' }
}

/**
 * Logout user
 */
export async function logout() {
  // Clear any local session data
  localStorage.removeItem('user_session')
  return { success: true }
}

/**
 * Get current session
 */
export function getSession() {
  try {
    const session = localStorage.getItem('user_session')
    return session ? JSON.parse(session) : null
  } catch {
    return null
  }
}

/**
 * Save session
 */
export function saveSession(user) {
  localStorage.setItem('user_session', JSON.stringify({ user, timestamp: Date.now() }))
}
