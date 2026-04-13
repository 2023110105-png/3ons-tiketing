// ===== FAST LOGIN SUPABASE =====
import { supabase } from '../lib/supabase'

// Cache untuk workspace users (expire setelah 5 menit)
let workspaceUsersCache = null;
let workspaceUsersCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 menit

// Ambil data users dari Supabase workspace_state dengan caching
async function getWorkspaceUsersFromSupabase() {
  const now = Date.now();
  if (workspaceUsersCache && (now - workspaceUsersCacheTime) < CACHE_TTL) {
    return { success: true, users: workspaceUsersCache, fromCache: true };
  }
  
  try {
    const { data, error } = await supabase
      .from('workspace_state')
      .select('tenant_registry')
      .eq('id', 'default')
      .maybeSingle();
    
    if (error) {
      console.error('[getWorkspaceUsers] Supabase error:', error);
      return { success: false, error: 'Gagal akses data pengguna' };
    }
    
    if (!data || !data.tenant_registry) {
      return { success: false, error: 'Data workspace tidak ditemukan' };
    }
    
    const tenants = data.tenant_registry?.tenants || {};
    const tenant = tenants['tenant-default'] || Object.values(tenants)[0];
    
    if (!tenant) {
      return { success: false, error: 'Tenant tidak ditemukan' };
    }
    
    const users = Array.isArray(tenant.users) ? tenant.users : [];
    
    // Validasi: pastikan users memiliki field yang required
    const validUsers = users.filter(u => 
      u && 
      (u.username || u.email || u.id) && 
      u.password &&
      u.role
    );
    
    // Update cache
    workspaceUsersCache = validUsers;
    workspaceUsersCacheTime = now;
    
    return { success: true, users: validUsers, tenant };
  } catch (err) {
    console.error('[getWorkspaceUsers] Error:', err);
    return { success: false, error: 'Terjadi kesalahan sistem' };
  }
}

// Fungsi login lokal langsung ke Supabase workspace_state
async function fastLoginSupabase(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Username dan password wajib diisi' };
  }
  
  const result = await getWorkspaceUsersFromSupabase();
  if (!result.success) {
    return result;
  }
  
  const normalizedUsername = String(username).trim().toLowerCase();
  const normalizedPassword = String(password);
  
  // Cari user dengan username atau email yang cocok
  const user = result.users.find(u => {
    const userUsername = String(u.username || '').trim().toLowerCase();
    const userEmail = String(u.email || '').trim().toLowerCase();
    const userId = String(u.id || '').trim().toLowerCase();
    
    return (userUsername === normalizedUsername || 
            userEmail === normalizedUsername || 
            userId === normalizedUsername) && 
           u.password === normalizedPassword;
  });
  
  if (!user) {
    return { success: false, error: 'Username atau password salah' };
  }
  
  // Validasi: pastikan user aktif
  if (user.is_active === false || user.active === false || user.disabled === true) {
    return { success: false, error: 'Akun tidak aktif. Hubungi administrator.' };
  }
  
  // Validasi: pastikan role valid
  const validRoles = ['admin', 'operator'];
  const userRole = String(user.role || '').trim().toLowerCase();
  if (!validRoles.includes(userRole)) {
    return { success: false, error: 'Akun tidak memiliki peran yang valid' };
  }
  
  return { 
    success: true, 
    user: {
      ...user,
      tenant_id: user.tenant_id || user.tenant?.id || 'tenant-default',
      tenant: user.tenant || { id: 'tenant-default', name: 'Default' }
    }
  };
}

// Local login dengan validasi penuh
async function doLogin(username, password, _options = {}) {
  void _options;
  // Gunakan fastLoginSupabase yang sudah ada validasi lengkap
  return fastLoginSupabase(username, password);
}

// Logout helper
function doLogout() {
  // Clear cache saat logout
  workspaceUsersCache = null;
  workspaceUsersCacheTime = 0;
}
import { createContext, useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../utils/api'

export const AuthContext = createContext(null)
const OWNER_FEATURES_ENABLED = String(import.meta.env.VITE_ENABLE_OWNER_FEATURES || 'false').trim().toLowerCase() === 'true'

function resolveTenantIdFromUser(user) {
  const fromTenantObject = String(user?.tenant?.id || '').trim()
  if (fromTenantObject) return fromTenantObject
  const fromTenantId = String(user?.tenant_id || '').trim()
  if (fromTenantId) return fromTenantId
  return ''
}

function resolveTenantBrandFromUser(user) {
  const fromTenantObject = String(user?.tenant?.brandName || '').trim()
  if (fromTenantObject) return fromTenantObject
  const fromTenantName = String(user?.tenant_name || '').trim()
  if (fromTenantName) return fromTenantName
  return ''
}

function shouldBootstrapWaOnLogin(user) {
  const role = String(user?.role || '').trim().toLowerCase()
  return role === 'owner' || role === 'super_admin' || role === 'admin_client'
}

async function bootstrapWaSessionAfterLogin(user) {
  if (!shouldBootstrapWaOnLogin(user)) return
  const tenantId = resolveTenantIdFromUser(user)
  if (!tenantId) return
  const tenantBrand = resolveTenantBrandFromUser(user)
  try {
    await apiFetch('/api/wa/bootstrap-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-requested-by': String(user?.username || user?.email || 'login') },
      body: JSON.stringify({ tenant_id: tenantId, tenant_brand: tenantBrand })
    })
  } catch {
    // Keep login flow non-blocking when WA runtime is temporarily unavailable.
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Save user session to localStorage
  const saveUserSession = (userData) => {
    try {
      if (userData) {
        localStorage.setItem('yamaha_scan_user', JSON.stringify(userData))
      } else {
        localStorage.removeItem('yamaha_scan_user')
      }
    } catch (error) {
      console.warn('Failed to save user session:', error)
    }
  }

  // Load user session from localStorage
  const loadUserSession = () => {
    try {
      const saved = localStorage.getItem('yamaha_scan_user')
      if (saved) {
        const userData = JSON.parse(saved)
        return userData
      }
    } catch (error) {
      console.warn('Failed to load user session:', error)
      localStorage.removeItem('yamaha_scan_user')
    }
    return null
  }

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      if (cancelled) return

      // Try to restore session from localStorage first
      let session = loadUserSession()
      
          setUser(session)
      setLoading(false)
    }

    hydrate()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username, password, options = {}) => {
    // Fast login Supabase
    const fastResult = await fastLoginSupabase(username, password);
    if (fastResult.success) {
      setUser(fastResult.user);
      saveUserSession(fastResult.user); // Save to localStorage for persistence
      void bootstrapWaSessionAfterLogin(fastResult.user);
      return fastResult;
    }
    const preferredTenantId = String(options?.tenantId || '').trim()
    const result = await (preferredTenantId
      ? doLogin(username, password, { tenantId: preferredTenantId })
      : doLogin(username, password))
    if (result.success) {
      if (result.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
        doLogout()
        return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
      }
      setUser(result.user)
      saveUserSession(result.user) // Save to localStorage for persistence
      void bootstrapWaSessionAfterLogin(result.user)
    }
    return result
  }, [])

  const logout = useCallback(async () => {
    saveUserSession(null); // Clear session from localStorage
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

