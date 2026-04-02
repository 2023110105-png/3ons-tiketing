import { createContext, useContext, useEffect, useState, useCallback } from 'react'
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

const AuthContext = createContext(null)
const FIREBASE_AUTH_MODE = import.meta.env.VITE_FIREBASE_AUTH_MODE === 'strict' ? 'strict' : 'hybrid'

function mapFirebaseAuthError(errorCode) {
  switch (errorCode) {
    case 'auth/invalid-email':
      return 'Format email tidak valid'
    case 'auth/user-disabled':
      return 'Akun Firebase dinonaktifkan'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Kredensial tidak cocok'
    case 'auth/too-many-requests':
      return 'Terlalu banyak percobaan login, coba lagi sebentar'
    default:
      return 'Autentikasi Firebase gagal'
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

          await signOut(auth)
          return {
            success: false,
            error: 'Akun Firebase valid, tetapi tidak terdaftar di tenant sistem'
          }
        } catch (error) {
          if (FIREBASE_AUTH_MODE === 'strict') {
            return { success: false, error: mapFirebaseAuthError(error?.code) }
          }
        }
      } else if (FIREBASE_AUTH_MODE === 'strict') {
        return { success: false, error: 'Akun belum memiliki email login Firebase' }
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

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
