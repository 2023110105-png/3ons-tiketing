import { createContext, useEffect, useState, useCallback } from 'react'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, isFirebaseEnabled } from '../lib/firebase'
import { apiFetch } from '../utils/api'
import {
  bootstrapStoreFromFirebase,
  getSession,
  login as doLogin,
  loginByIdentity,
  logout as doLogout,
  resolveLoginEmail

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

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      try {
        await bootstrapStoreFromFirebase()
      } catch {
        // Keep local fallback available even if Firebase hydration fails.
      }

      if (cancelled) return

      let session = getSession()
      if (session?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
        doLogout()
        session = null
      }
      if (!session && isFirebaseEnabled && auth) {
        await waitForFirebaseAuthReady()
        const firebaseEmail = auth.currentUser?.email
        if (firebaseEmail) {
          const recovered = loginByIdentity(firebaseEmail)
          if (recovered.success) {
            session = recovered.user
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
        await bootstrapStoreFromFirebase(true)
      } catch (hydrateErr) {
        if (isQuotaExhaustedError(hydrateErr)) {
          const localOnly = scopedOptions ? doLogin(username, password, scopedOptions) : doLogin(username, password)
          if (localOnly.success) {
            setUser(localOnly.user)
            void bootstrapWaSessionAfterLogin(localOnly.user)
            return localOnly
          }
        }
        // Continue with current snapshot if refresh fails.
      }

      const normalizedIdentity = String(username || '').trim().toLowerCase()
      const resolvedLoginEmail = resolveLoginEmail(username)
      const candidateEmail = isValidEmail(resolvedLoginEmail)
        ? resolvedLoginEmail
        : (isValidEmail(normalizedIdentity) ? normalizedIdentity : null)
      if (!candidateEmail) {
        // Akun tidak punya email, gunakan fallback local authentication
        const localResult = doLogin(username, password)
        if (localResult.success) {
          setUser(localResult.user)
          return localResult
        }
        // Return local auth error jika username/password salah
        return localResult
      }

      try {
        await signInWithEmailAndPassword(auth, candidateEmail, password)
        try {
          await bootstrapStoreFromFirebase(true)
        } catch {
          // Continue with last known snapshot.
        }

        const identityResult = loginIdentity(username)
        if (identityResult.success) {
          if (identityResult.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
            await signOut(auth).catch(() => {})
            doLogout()
            return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
          }
          setUser(identityResult.user)
          void bootstrapWaSessionAfterLogin(identityResult.user)
          return identityResult
        }

        const emailIdentityResult = loginIdentity(candidateEmail)
        if (emailIdentityResult.success) {
          if (emailIdentityResult.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
            await signOut(auth).catch(() => {})
            doLogout()
            return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
          }
          setUser(emailIdentityResult.user)
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
          const localOnly = loginLocal(username, password)
          if (localOnly.success) {
            if (localOnly.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
              doLogout()
              return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
            }
            setUser(localOnly.user)
            void bootstrapWaSessionAfterLogin(localOnly.user)
            return localOnly
          }
        }
        // Jika akun valid di registry lokal tapi belum ada di Firebase Auth, otomatis buat.
        const localResult = loginLocal(username, password)
        if (localResult.success) {
          if (localResult.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
            doLogout()
            return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
          }
          try {
            await createUserWithEmailAndPassword(auth, candidateEmail, password)
            setUser(localResult.user)
            void bootstrapWaSessionAfterLogin(localResult.user)
            return localResult
          } catch (createErr) {
            const createCode = String(createErr?.code || '').toLowerCase()
            // If Firebase account already exists (common after password reset desync),
            // keep tenant operational via local auth instead of hard-blocking login.
            if (createCode === 'auth/email-already-in-use' || createCode === 'email-already-in-use') {
              setUser(localResult.user)
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
      const candidateEmail = resolveLoginEmail(username)
      if (candidateEmail) {
        try {
          await signInWithEmailAndPassword(auth, candidateEmail, password)
          const scopedOptions = options?.tenantId ? { tenantId: options.tenantId } : null
          const identityResult = scopedOptions ? loginByIdentity(username, scopedOptions) : loginByIdentity(username)
          if (identityResult.success) {
            setUser(identityResult.user)
            void bootstrapWaSessionAfterLogin(identityResult.user)
            return identityResult
          }
        } catch {
          // Hybrid mode keeps local fallback.
        }
      }
    }

    const preferredTenantId = String(options?.tenantId || '').trim()
    const result = preferredTenantId
      ? doLogin(username, password, { tenantId: preferredTenantId })
      : doLogin(username, password)
    if (result.success) {
      if (result.user?.role === 'owner' && !OWNER_FEATURES_ENABLED) {
        doLogout()
        return { success: false, error: 'Akses owner sedang dinonaktifkan. Gunakan akun admin/gate.' }
      }
      setUser(result.user)
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
    doLogout()
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

