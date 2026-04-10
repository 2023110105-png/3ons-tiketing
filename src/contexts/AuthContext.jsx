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
  const validRoles = ['owner', 'super_admin', 'admin_client', 'gate_front', 'gate_back', 'admin'];
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

// Login by identity (email/username) - untuk auto-recovery session
async function loginByIdentity(identity, _options = {}) {
  void _options;
  if (!identity) {
    return { success: false, error: 'Identity tidak valid' };
  }
  
  const result = await getWorkspaceUsersFromSupabase();
  if (!result.success) {
    return result;
  }
  
  const normalizedIdentity = String(identity).trim().toLowerCase();
  
  const user = result.users.find(u => {
    const userUsername = String(u.username || '').trim().toLowerCase();
    const userEmail = String(u.email || '').trim().toLowerCase();
    const userId = String(u.id || '').trim().toLowerCase();
    
    return userUsername === normalizedIdentity || 
           userEmail === normalizedIdentity || 
           userId === normalizedIdentity;
  });
  
  if (!user) {
    return { success: false, error: 'Pengguna tidak ditemukan' };
  }
  
  // Validasi: pastikan user aktif
  if (user.is_active === false || user.active === false || user.disabled === true) {
    return { success: false, error: 'Akun tidak aktif' };
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

// Resolve login email dari username dengan lookup ke Supabase
async function resolveLoginEmail(username) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return null;
  
  // Jika sudah format email, return as-is
  if (normalized.includes('@')) {
    return normalized;
  }
  
  // Coba cari user dengan username tersebut dan return email-nya
  const result = await getWorkspaceUsersFromSupabase();
  if (!result.success) return null;
  
  const user = result.users.find(u => {
    const userUsername = String(u.username || '').trim().toLowerCase();
    const userId = String(u.id || '').trim().toLowerCase();
    return userUsername === normalized || userId === normalized;
  });
  
  return user?.email || null;
}
import { createContext, useEffect, useState, useCallback } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, isFirebaseEnabled } from '../lib/firebase'
import { apiFetch } from '../utils/api'
export const AuthContext = createContext(null)
const OWNER_FEATURES_ENABLED = String(import.meta.env.VITE_ENABLE_OWNER_FEATURES || 'false').trim().toLowerCase() === 'true'
const FIREBASE_AUTH_MODE = isFirebaseEnabled && import.meta.env.VITE_FIREBASE_AUTH_MODE !== 'hybrid'
  ? 'strict'
  : 'hybrid'

function mapFirebaseAuthError(errorCode) {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Format email belum benar'
    case 'auth/user-disabled':
      return 'Akun dinonaktifkan'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Nama pengguna atau kata sandi tidak sesuai'
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan masuk, coba lagi sebentar'
    case 'resource-exhausted':
    case 'quota-exceeded':
      return 'Layanan cloud sedang mencapai batas kuota. Sistem masuk mode lokal sementara.'
    default:
      return 'Proses masuk gagal'
  }
}

function isValidEmail(value) {
  const text = String(value || '').trim().toLowerCase()
  if (!text) return false
  return /^[^@]+@[^@]+\.[^@]+$/.test(text)
}

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

async function waitForFirebaseAuthReady() {
  if (!isFirebaseEnabled || !auth) return
  if (typeof auth.authStateReady === 'function') {
    try {
      await auth.authStateReady()
      return
    } catch {
      // Fallback to timeout below.
    }
  }

  await new Promise((resolve) => {
    setTimeout(resolve, 500)
  })
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
      
      // If no local session, try Firebase auth
      if (!session && isFirebaseEnabled && auth) {
        await waitForFirebaseAuthReady()
        const firebaseEmail = auth.currentUser?.email
        if (firebaseEmail) {
          const recovered = await loginByIdentity(firebaseEmail)
          if (recovered.success) {
            session = recovered.user
            saveUserSession(session) // Save to localStorage
          }
        }
      }

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
    const isQuotaExhaustedError = (errLike) => {
      const code = String(errLike?.code || '').toLowerCase()
      const message = String(errLike?.message || '').toLowerCase()
      return code.includes('resource-exhausted')
        || code.includes('quota-exceeded')
        || message.includes('resource-exhausted')
        || message.includes('quota exceeded')
    }

    if (FIREBASE_AUTH_MODE === 'strict') {
      if (!isFirebaseEnabled || !auth) {
        return { success: false, error: 'Layanan masuk belum diaktifkan. Hubungi administrator.' }
      }

      const preferredTenantId = String(options?.tenantId || '').trim()
      const scopedOptions = preferredTenantId ? { tenantId: preferredTenantId } : null
      const loginLocal = (identity, secret) => (
        scopedOptions ? doLogin(identity, secret, scopedOptions) : doLogin(identity, secret)
      )
      const loginIdentity = (identity) => (
        scopedOptions ? loginByIdentity(identity, scopedOptions) : loginByIdentity(identity)
      )

      // Always refresh latest tenant/user snapshot before credential checks.
      try {
        // await bootstrapStoreFromFirebase(true) // dihapus (mockData.js sudah tidak ada)
      } catch (hydrateErr) {
        if (isQuotaExhaustedError(hydrateErr)) {
          const localOnly = scopedOptions ? doLogin(username, password, scopedOptions) : doLogin(username, password)
          if (localOnly.success) {
            setUser(localOnly.user)
            saveUserSession(localOnly.user) // Save to localStorage for persistence
            void bootstrapWaSessionAfterLogin(localOnly.user)
            return localOnly
          }
        }
        // Continue with current snapshot if refresh fails.
      }

      const normalizedIdentity = String(username || '').trim().toLowerCase()
      const resolvedEmail = await resolveLoginEmail(username)
      const candidateEmail = isValidEmail(resolvedEmail)
        ? resolvedEmail
        : (isValidEmail(normalizedIdentity) ? normalizedIdentity : null)
      if (!candidateEmail) {
        // Akun tidak punya email, gunakan fallback local authentication
        const localResult = await doLogin(username, password)
        if (localResult.success) {
          setUser(localResult.user)
          saveUserSession(localResult.user) // Save to localStorage for persistence
          return localResult
        }
        // Return local auth error jika username/password salah
        return localResult
      }

      try {
        await signInWithEmailAndPassword(auth, candidateEmail, password)
        try {
          // await bootstrapStoreFromFirebase(true) // dihapus (mockData.js sudah tidak ada)
        } catch {
          // Continue with last known snapshot.
        }

        const identityResult = await loginIdentity(username)
        if (identityResult.success) {
          if (identityResult.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
            await signOut(auth).catch(() => {})
            doLogout()
            return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
          }
          setUser(identityResult.user)
          saveUserSession(identityResult.user) // Save to localStorage for persistence
          void bootstrapWaSessionAfterLogin(identityResult.user)
          return identityResult
        }

        const emailIdentityResult = await loginIdentity(candidateEmail)
        if (emailIdentityResult.success) {
          if (emailIdentityResult.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
            await signOut(auth).catch(() => {})
            doLogout()
            return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
          }
          setUser(emailIdentityResult.user)
          saveUserSession(emailIdentityResult.user) // Save to localStorage for persistence
          void bootstrapWaSessionAfterLogin(emailIdentityResult.user)
          return emailIdentityResult
        }

        await signOut(auth)
        return {
          success: false,
          error: 'Akun valid, tetapi belum terdaftar di sistem tenant'
        }
      } catch (error) {
        if (isQuotaExhaustedError(error)) {
          const localOnly = await loginLocal(username, password)
          if (localOnly.success) {
            if (localOnly.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
              doLogout()
              return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
            }
            setUser(localOnly.user)
            saveUserSession(localOnly.user) // Save to localStorage for persistence
            void bootstrapWaSessionAfterLogin(localOnly.user)
            return localOnly
          }
        }
        // Jika akun valid di registry lokal tapi belum ada di Firebase Auth, otomatis buat.
        const localResult = await loginLocal(username, password)
        if (localResult.success) {
          if (localResult.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
            doLogout()
            return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
          }
          try {
            await createUserWithEmailAndPassword(auth, candidateEmail, password)
            setUser(localResult.user)
            saveUserSession(localResult.user) // Save to localStorage for persistence
            void bootstrapWaSessionAfterLogin(localResult.user)
            return localResult
          } catch (createErr) {
            const createCode = String(createErr?.code || '').toLowerCase()
            // If Firebase account already exists (common after password reset desync),
            // keep tenant operational via local auth instead of hard-blocking login.
            if (createCode === 'auth/email-already-in-use' || createCode === 'email-already-in-use') {
              setUser(localResult.user)
              saveUserSession(localResult.user) // Save to localStorage for persistence
              void bootstrapWaSessionAfterLogin(localResult.user)
              return localResult
            }
            return {
              success: false,
              error: 'Pendaftaran ke layanan masuk gagal. Hubungi administrator atau tim pendukung.'
            }
          }
        }
        return { success: false, error: mapFirebaseAuthError(error?.code) }
      }
    }

    if (isFirebaseEnabled && auth) {
      const candidateEmail = await resolveLoginEmail(username)
      if (candidateEmail) {
        try {
          await signInWithEmailAndPassword(auth, candidateEmail, password)
          const scopedOptions = options?.tenantId ? { tenantId: options.tenantId } : null
          const identityResult = await (scopedOptions ? loginByIdentity(username, scopedOptions) : loginByIdentity(username))
          if (identityResult.success) {
            setUser(identityResult.user)
            saveUserSession(identityResult.user) // Save to localStorage for persistence
            void bootstrapWaSessionAfterLogin(identityResult.user)
            return identityResult
          }
        } catch {
          // Hybrid mode keeps local fallback.
        }
      }
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
    if (isFirebaseEnabled && auth) {
      try {
        await signOut(auth)
      } catch {
        // Keep local logout path as source of truth.
      }
    }
    saveUserSession(null); // Clear session from localStorage
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

