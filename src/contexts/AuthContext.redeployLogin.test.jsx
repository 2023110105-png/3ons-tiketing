import { useContext } from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthContext, AuthProvider } from './AuthContext'

const signInWithEmailAndPasswordMock = vi.fn()
const createUserWithEmailAndPasswordMock = vi.fn()
const signOutMock = vi.fn()

const bootstrapStoreFromFirebaseMock = vi.fn()
const getSessionMock = vi.fn()
const doLoginMock = vi.fn()
const loginByIdentityMock = vi.fn()
const doLogoutMock = vi.fn()
const resolveLoginEmailMock = vi.fn()

vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: (...args) => signInWithEmailAndPasswordMock(...args),
  createUserWithEmailAndPassword: (...args) => createUserWithEmailAndPasswordMock(...args),
  signOut: (...args) => signOutMock(...args)
}))

vi.mock('../lib/firebase', () => ({
  isFirebaseEnabled: true,
  auth: { currentUser: null }
}))

vi.mock('../store/mockData', () => ({
  bootstrapStoreFromFirebase: (...args) => bootstrapStoreFromFirebaseMock(...args),
  getSession: (...args) => getSessionMock(...args),
  login: (...args) => doLoginMock(...args),
  loginByIdentity: (...args) => loginByIdentityMock(...args),
  logout: (...args) => doLogoutMock(...args),
  resolveLoginEmail: (...args) => resolveLoginEmailMock(...args)
}))

function Harness() {
  const auth = useContext(AuthContext)

  const handleLogin = async () => {
    const result = await auth.login('tenant.user@example.com', 'pass123')
    window.__authTestResult = result
  }

  return (
    <button type="button" onClick={handleLogin}>Run Login</button>
  )
}

describe('AuthContext redeploy login flow', () => {
  beforeEach(() => {
    signInWithEmailAndPasswordMock.mockReset()
    createUserWithEmailAndPasswordMock.mockReset()
    signOutMock.mockReset()
    bootstrapStoreFromFirebaseMock.mockReset()
    getSessionMock.mockReset()
    doLoginMock.mockReset()
    loginByIdentityMock.mockReset()
    doLogoutMock.mockReset()
    resolveLoginEmailMock.mockReset()
    window.__authTestResult = undefined

    bootstrapStoreFromFirebaseMock.mockResolvedValue(false)
    getSessionMock.mockReturnValue(null)
    signInWithEmailAndPasswordMock.mockResolvedValue({ user: { uid: 'uid-1' } })
    resolveLoginEmailMock.mockReturnValue(null)
    doLoginMock.mockReturnValue({ success: false, error: 'Username atau password salah' })
    loginByIdentityMock
      .mockReturnValueOnce({ success: false, error: 'not found by username' })
      .mockReturnValueOnce({
        success: true,
        user: {
          username: 'tenant.user',
          role: 'admin_client',
          tenant: { id: 'tenant-redeploy', brandName: 'Brand Redeploy', eventName: 'Event Redeploy' }
        }
      })
  })

  it('mengizinkan login tenant via email valid tanpa perlu owner login dulu setelah redeploy', async () => {
    render(
      <AuthProvider>
        <Harness />
      </AuthProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: 'Run Login' }))

    await waitFor(() => {
      expect(signInWithEmailAndPasswordMock).toHaveBeenCalledTimes(1)
    })

    expect(signInWithEmailAndPasswordMock.mock.calls[0][1]).toBe('tenant.user@example.com')
    expect(bootstrapStoreFromFirebaseMock).toHaveBeenCalledWith(true)
    expect(loginByIdentityMock).toHaveBeenNthCalledWith(1, 'tenant.user@example.com')
    expect(loginByIdentityMock).toHaveBeenNthCalledWith(2, 'tenant.user@example.com')

    await waitFor(() => {
      expect(window.__authTestResult?.success).toBe(true)
      expect(window.__authTestResult?.user?.tenant?.id).toBe('tenant-redeploy')
    })
  })
})
