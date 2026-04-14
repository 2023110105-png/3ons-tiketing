// ===== AUTH CONTEXT SaaS - Multi-Tenant Architecture =====
// 3 Levels: system_admin → tenant_admin → gate_user
// Tables: system_admins, tenant_admins, gate_users
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export const AuthContext = createContext(null)

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/**
 * Check system_admins table (Developer/System Admin Level)
 */
async function checkSystemAdmin(username, password) {
  try {
    const { data, error } = await supabase
      .from('system_admins')
      .select('*')
      .eq('username', username.trim().toLowerCase())
      .eq('is_active', true)
      .single()
    
    if (error || !data) return { success: false }
    
    const passwordMatch = data.password_hash === password
    
    if (!passwordMatch) return { success: false }
    
    // Update last login
    await supabase
      .from('system_admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.id)
    
    return {
      success: true,
      user: {
        id: data.id,
        username: data.username,
        name: data.name,
        email: data.email,
        role: 'system_admin', // LEVEL 1: System Admin
        user_type: 'system_admin',
        is_system_admin: true,
        tenant_id: null,
        tenant: null,
        can_access: ['tenants', 'system_settings', 'audit_logs']
      }
    }
  } catch (err) {
    console.error('[AuthSaaS] System admin check error:', err)
    return { success: false }
  }
}

/**
 * Check tenant_admins table (Tenant Admin Level)
 */
async function checkTenantAdmin(username, password) {
  try {
    const { data, error } = await supabase
      .from('tenant_admins')
      .select(`
        *,
        tenant:tenants(id, name, brand_name, slug)
      `)
      .eq('username', username.trim().toLowerCase())
      .eq('is_active', true)
      .single()
    
    if (error || !data) return { success: false }
    
    const passwordMatch = data.password_hash === password
    
    if (!passwordMatch) return { success: false }
    
    // Update last login
    await supabase
      .from('tenant_admins')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.id)
    
    return {
      success: true,
      user: {
        id: data.id,
        username: data.username,
        name: data.name,
        email: data.email,
        role: 'tenant_admin', // LEVEL 2: Tenant Admin
        user_type: 'tenant_admin',
        is_tenant_admin: true,
        tenant_id: data.tenant_id,
        tenant: data.tenant,
        // Permissions
        can_manage_gate_users: data.can_manage_gate_users,
        can_manage_events: data.can_manage_events,
        can_view_reports: data.can_view_reports,
        can_export_data: data.can_export_data,
        can_access: ['dashboard', 'participants', 'events', 'gate_users', 'reports', 'settings', 'gate_front', 'gate_back']
      }
    }
  } catch (err) {
    console.error('[AuthSaaS] Tenant admin check error:', err)
    return { success: false }
  }
}

/**
 * Check gate_users table (Gate User Level)
 */
async function checkGateUser(username, password) {
  try {
    const { data, error } = await supabase
      .from('gate_users')
      .select(`
        *,
        tenant:tenants(id, name, brand_name)
      `)
      .eq('username', username.trim().toLowerCase())
      .eq('is_active', true)
      .single()
    
    if (error || !data) return { success: false }
    
    const passwordMatch = data.password_hash === password
    
    if (!passwordMatch) return { success: false }
    
    // Update last login
    await supabase
      .from('gate_users')
      .update({ last_login_at: new Date().toISOString() })
      .eq('id', data.id)
    
    // Determine gate access
    const gate_assignment = data.gate_assignment || 'front'
    const can_access = []
    if (gate_assignment === 'front' || gate_assignment === 'both') {
      can_access.push('gate_front')
    }
    if (gate_assignment === 'back' || gate_assignment === 'both') {
      can_access.push('gate_back')
    }
    
    return {
      success: true,
      user: {
        id: data.id,
        username: data.username,
        name: data.name,
        email: data.email,
        role: 'gate_user', // LEVEL 3: Gate User
        user_type: 'gate_user',
        is_gate_user: true,
        tenant_id: data.tenant_id,
        tenant: data.tenant,
        gate_assignment: gate_assignment,
        can_access: can_access // Only gate access
      }
    }
  } catch (err) {
    console.error('[AuthSaaS] Gate user check error:', err)
    return { success: false }
  }
}

/**
 * Main Login Function SaaS
 * Check 3 tables in order: system_admin → tenant_admin → gate_user
 */
async function loginSaaS(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username dan password wajib diisi' }
  }
  
  console.log('[AuthSaaS] Login attempt:', username)
  
  // Step 1: Check system_admins (Level 1)
  const systemAdminResult = await checkSystemAdmin(username, password)
  if (systemAdminResult.success) {
    console.log('[AuthSaaS] System admin login success')
    return systemAdminResult
  }
  
  // Step 2: Check tenant_admins (Level 2)
  const tenantAdminResult = await checkTenantAdmin(username, password)
  if (tenantAdminResult.success) {
    console.log('[AuthSaaS] Tenant admin login success')
    return tenantAdminResult
  }
  
  // Step 3: Check gate_users (Level 3)
  const gateUserResult = await checkGateUser(username, password)
  if (gateUserResult.success) {
    console.log('[AuthSaaS] Gate user login success')
    return gateUserResult
  }
  
  // Login failed
  return { 
    success: false, 
    error: 'Username atau password salah'
  }
}

/**
 * Check if user has gate permission
 */
export function hasGatePermission(user, gateType) {
  if (!user) return false
  if (user.user_type === 'system_admin') return true // System admin can access all
  if (user.user_type === 'tenant_admin') return true // Tenant admin can access all gates
  if (user.user_type === 'gate_user') {
    const assignment = user.gate_assignment
    if (assignment === 'both') return true
    return assignment === gateType
  }
  return false
}

/**
 * Check if user can access admin panel (system or tenant admin)
 */
export function canAccessAdminPanel(user) {
  if (!user) return false
  return user.user_type === 'system_admin' || user.user_type === 'tenant_admin'
}

/**
 * Check if user can access system admin features only
 */
export function canAccessSystemAdmin(user) {
  if (!user) return false
  return user.user_type === 'system_admin'
}

/**
 * Check if user can access tenant admin features
 */
export function canAccessTenantAdmin(user) {
  if (!user) return false
  return user.user_type === 'tenant_admin' || user.user_type === 'system_admin'
}

/**
 * Check if user can access gate
 */
export function canAccessGate(user) {
  if (!user) return false
  return user.user_type === 'gate_user' || user.user_type === 'tenant_admin' || user.user_type === 'system_admin'
}

/**
 * AuthProvider Component
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load user session on mount
  useEffect(() => {
    const session = localStorage.getItem('user_session')
    if (session) {
      try {
        const parsed = JSON.parse(session)
        // Use setTimeout to avoid synchronous setState in effect
        setTimeout(() => {
          setUser(parsed.user)
          setLoading(false)
        }, 0)
      } catch (e) {
        console.error('Failed to parse session:', e)
        localStorage.removeItem('user_session')
        setTimeout(() => setLoading(false), 0)
      }
    } else {
      setTimeout(() => setLoading(false), 0)
    }
  }, [])

  const login = useCallback(async (username, password) => {
    const result = await loginSaaS(username, password)
    
    if (result.success) {
      setUser(result.user)
      // Save to localStorage for persistence
      localStorage.setItem('user_session', JSON.stringify({
        user: result.user,
        loginAt: new Date().toISOString()
      }))
      // Set window.currentUser for operator pages
      if (typeof window !== 'undefined') {
        window.currentUser = result.user
      }
    }
    
    return result
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    localStorage.removeItem('user_session')
    if (typeof window !== 'undefined') {
      window.currentUser = null
    }
  }, [])

  const value = {
    user,
    isLoading: loading,
    login,
    logout,
    isAuthenticated: !!user,
    // Helper checks
    isSystemAdmin: user?.user_type === 'system_admin',
    isTenantAdmin: user?.user_type === 'tenant_admin',
    isGateUser: user?.user_type === 'gate_user',
    // Permission helpers
    hasGatePermission: (gateType) => hasGatePermission(user, gateType),
    canAccessAdminPanel: () => canAccessAdminPanel(user),
    canAccessSystemAdmin: () => canAccessSystemAdmin(user),
    canAccessTenantAdmin: () => canAccessTenantAdmin(user),
    canAccessGate: () => canAccessGate(user)
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// Default export
export default AuthContext
