import { createContext, useEffect, useState, useCallback } from 'react'
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { auth, isFirebaseEnabled } from '../lib/firebase'
import {
  bootstrapStoreFromFirebase,
  getSession,
  login as doLogin,
  loginByIdentity,
  logout as doLogout,
  resolveLoginEmail
} from '../store/mockData'

export const AuthContext = createContext(null)
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
    default:
      return 'Proses masuk gagal'
  }
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
      setUser(getSession())
      setLoading(false)
    }

    hydrate()

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (username, password) => {
    if (FIREBASE_AUTH_MODE === 'strict') {
      if (!isFirebaseEnabled || !auth) {
        return { success: false, error: 'Konfigurasi Firebase belum aktif untuk mode strict' }
      }

      // Always refresh latest tenant/user snapshot before credential checks.
      try {
        await bootstrapStoreFromFirebase(true)
      } catch {
        // Continue with current snapshot if refresh fails.
      }

      const candidateEmail = resolveLoginEmail(username)
      if (!candidateEmail) {
        const localResult = doLogin(username, password)
        if (localResult.success) {
          setUser(localResult.user)
          return localResult
        }
        return { success: false, error: 'Akun ini belum memiliki email masuk' }
      }

      try {
        await signInWithEmailAndPassword(auth, candidateEmail, password)
        const identityResult = loginByIdentity(username)
        if (identityResult.success) {
          setUser(identityResult.user)
          return identityResult
        }

        await signOut(auth)
        return {
          success: false,
          error: 'Akun valid, tetapi belum terdaftar di sistem tenant'
        }
      } catch (error) {
        // Some owner-created tenant users exist in tenant registry but are not yet provisioned in Firebase Auth.
        // Fallback to tenant credential check so those accounts can still log in.
        const localResult = doLogin(username, password)
        if (localResult.success) {
          setUser(localResult.user)
          return localResult
        }
        return { success: false, error: mapFirebaseAuthError(error?.code) }
      }
    }

    if (isFirebaseEnabled && auth) {
      const candidateEmail = resolveLoginEmail(username)
      if (candidateEmail) {
        try {
          await signInWithEmailAndPassword(auth, candidateEmail, password)
          const identityResult = loginByIdentity(username)
          if (identityResult.success) {
            setUser(identityResult.user)
            return identityResult
          }
        } catch {
          // Hybrid mode keeps local fallback.
        }
      }
    }

    const result = doLogin(username, password)
    if (result.success) {
      setUser(result.user)
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

