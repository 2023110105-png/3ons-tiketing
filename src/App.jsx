import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContextSaaS'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout/Layout'
import OfflineIndicator from './components/OfflineIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'

// Helper untuk lazy load dengan timeout
function lazyWithTimeout(importFn, timeoutMs = 10000) {
  return async () => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Loading timeout')), timeoutMs)
    )
    try {
      return await Promise.race([importFn(), timeoutPromise])
    } catch (err) {
      console.error('Failed to load component:', err)
      return {
        default: function ErrorComponent() {
          return (
            <div className="flex-center full-height-screen" style={{ padding: 20, textAlign: 'center' }}>
              <div>
                <h2 style={{ color: '#dc2626', marginBottom: 10 }}>Gagal memuat halaman</h2>
                <p style={{ color: '#666' }}>Silakan refresh halaman atau coba lagi</p>
                <button onClick={() => window.location.reload()} className="btn btn-primary" style={{ marginTop: 20 }}>
                  Refresh Halaman
                </button>
              </div>
            </div>
          )
        }
      }
    }
  }
}

// Lazy imports
const loadLogin = () => import('./pages/Login')
const loadDashboard = lazyWithTimeout(() => import('./pages/admin-tenant/Dashboard'))
const loadParticipants = lazyWithTimeout(() => import('./pages/admin-tenant/Participants'))
const loadQRGenerate = lazyWithTimeout(() => import('./pages/admin-tenant/QRGenerate'))
const loadReports = lazyWithTimeout(() => import('./pages/admin-tenant/Reports'))
const loadSettings = lazyWithTimeout(() => import('./pages/admin-tenant/Settings'))
const loadConnectDevice = lazyWithTimeout(() => import('./pages/admin-tenant/ConnectDevice'))
const loadOpsMonitor = lazyWithTimeout(() => import('./pages/admin-tenant/OpsMonitor'))
const loadWaDelivery = lazyWithTimeout(() => import('./pages/admin-tenant/WaDelivery'))
const loadAnalytics = lazyWithTimeout(() => import('./pages/admin-tenant/Analytics'))
const loadFrontGate = lazyWithTimeout(() => import('./pages/gate/FrontGate'))
const loadBackGate = lazyWithTimeout(() => import('./pages/gate/BackGate'))
const loadAdminPanel = lazyWithTimeout(() => import('./pages/admin-panel/AdminPanel'))

const Login = lazy(loadLogin)
const Dashboard = lazy(loadDashboard)
const Participants = lazy(loadParticipants)
const QRGenerate = lazy(loadQRGenerate)
const Reports = lazy(loadReports)
const FrontGate = lazy(loadFrontGate)
const BackGate = lazy(loadBackGate)
const Settings = lazy(loadSettings)
const ConnectDevice = lazy(loadConnectDevice)
const OpsMonitor = lazy(loadOpsMonitor)
const WaDelivery = lazy(loadWaDelivery)
const Analytics = lazy(loadAnalytics)
const AdminPanel = lazy(loadAdminPanel)

const ADMIN_FEATURES_ENABLED = String(import.meta.env.VITE_ENABLE_ADMIN_FEATURES || 'true').trim().toLowerCase() === 'true'

function RouteFallback() {
  return (
    <div className="flex-center full-height-screen" style={{ flexDirection: 'column', gap: 16 }}>
      <div className="spinner spinner-lg"></div>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>Memuat halaman...</p>
    </div>
  )
}

/**
 * ProtectedRoute SaaS
 * Mendukung 3 level hierarchical roles:
 * - system_admin: Developer/System Admin (manage all tenants)
 * - tenant_admin: Admin per tenant (manage gate users, events, participants)
 * - gate_user: Petugas gate (scan QR only)
 */
function ProtectedRoute({ children, allowedUserTypes = [], requireGatePermission = null }) {
  const { user, loading, hasGatePermission } = useAuth()
  const [waitForUser, setWaitForUser] = useState(true)
  
  // Extra wait to ensure session is restored from localStorage
  useEffect(() => {
    // Always use setTimeout to avoid synchronous setState
    const timer = setTimeout(() => {
      if (!loading) {
        console.log('[ProtectedRouteSaaS] Wait complete, user:', user?.user_type || 'null')
        setWaitForUser(false)
      }
    }, loading ? 100 : 300)
    return () => clearTimeout(timer)
  }, [loading, user])
  
  console.log('[ProtectedRouteSaaS] loading:', loading, 'user:', user?.user_type || 'null', 'waitForUser:', waitForUser)
  
  if (loading || waitForUser) {
    return (
      <div className="flex-center full-height-screen" style={{ flexDirection: 'column', gap: 12 }}>
        <div className="spinner spinner-lg"></div>
        <p style={{ color: '#666' }}>Memuat sesi...</p>
      </div>
    )
  }

  if (!user) {
    console.log('[ProtectedRouteSaaS] No user, redirecting to login')
    return <Navigate to="/login" replace />
  }

  // System admin bypass semua checks
  if (user.user_type === 'system_admin') {
    return <>{children}</>
  }

  // Check allowed user types
  if (allowedUserTypes.length > 0 && !allowedUserTypes.includes(user.user_type)) {
    // Redirect berdasarkan user type
    if (user.user_type === 'tenant_admin') {
      return <Navigate to='/admin-tenant/dashboard' replace />
    }
    if (user.user_type === 'gate_user') {
      // Gate user hanya bisa ke gate yang diassign
      if (user.gate_assignment === 'front') {
        return <Navigate to="/gate/front" replace />
      } else if (user.gate_assignment === 'back') {
        return <Navigate to="/gate/back" replace />
      }
      return <Navigate to="/gate/front" replace />
    }
    return <Navigate to="/login" replace />
  }

  // Check gate permissions untuk gate_user
  if (requireGatePermission && user.user_type === 'gate_user') {
    if (!hasGatePermission(requireGatePermission)) {
      return (
        <div className="flex-center full-height-screen" style={{ padding: 20, textAlign: 'center' }}>
          <div>
            <h2 style={{ color: '#dc2626', marginBottom: 10 }}>Akses Ditolak</h2>
            <p style={{ color: '#666' }}>Anda tidak memiliki izin untuk mengakses gate ini.</p>
            <p style={{ color: '#999', fontSize: '0.85rem', marginTop: 8 }}>
              Gate assignment Anda: {user.gate_assignment || 'None'}
            </p>
            <button onClick={() => window.history.back()} className="btn btn-primary" style={{ marginTop: 20 }}>
              Kembali
            </button>
          </div>
        </div>
      )
    }
  }

  return <>{children}</>
}

/**
 * AutoRedirect - Redirect user ke dashboard yang sesuai dengan role
 */
function AutoRedirect() {
  const { user, loading } = useAuth()
  const [waitForUser, setWaitForUser] = useState(true)
  
  // Extra wait to ensure session is restored from localStorage
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        console.log('[AutoRedirect] Wait complete, user:', user?.user_type || 'null')
        setWaitForUser(false)
      }
    }, loading ? 100 : 300)
    return () => clearTimeout(timer)
  }, [loading, user])
  
  console.log('[AutoRedirect] loading:', loading, 'user:', user?.user_type || 'null', 'waitForUser:', waitForUser)
  
  if (loading || waitForUser) {
    return (
      <div className="flex-center full-height-screen" style={{ flexDirection: 'column', gap: 12 }}>
        <div className="spinner spinner-lg"></div>
        <p style={{ color: '#666' }}>Memuat...</p>
      </div>
    )
  }

  if (!user) {
    console.log('[AutoRedirect] No user, redirecting to login')
    return <Navigate to="/login" replace />
  }

  // Redirect berdasarkan user_type SaaS
  switch (user.user_type) {
    case 'system_admin':
      // System admin ke platform admin (manage tenants)
      return <Navigate to="/admin-panel" replace />
    
    case 'tenant_admin':
      // Tenant admin ke dashboard mereka
      return <Navigate to="/admin-tenant/dashboard" replace />
    
    case 'gate_user':
      // Gate user langsung ke gate yang diassign
      if (user.gate_assignment === 'front') {
        return <Navigate to="/gate/front" replace />
      } else if (user.gate_assignment === 'back') {
        return <Navigate to="/gate/back" replace />
      } else if (user.gate_assignment === 'both') {
        // Kalau both, default ke front
        return <Navigate to="/gate/front" replace />
      }
      // Fallback
      return <Navigate to="/login" replace />
    
    default:
      return <Navigate to="/login" replace />
  }
}

/**
 * AdminPanelRedirect - Redirect /admin-panel to /admin-panel/overview
 * Uses useNavigate in useEffect to prevent infinite loop
 */
function AdminPanelRedirect() {
  const navigate = useNavigate()
  const redirected = useRef(false)
  
  useEffect(() => {
    if (redirected.current) return
    redirected.current = true
    navigate('/admin-panel/overview', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once
  
  return (
    <div className="flex-center full-height-screen" style={{ flexDirection: 'column', gap: 12 }}>
      <div className="spinner spinner-lg"></div>
      <p style={{ color: '#666' }}>Redirecting to admin panel...</p>
    </div>
  )
}

function AppRoutes() {
  // Preload admin panel jika user adalah admin
  const { user } = useAuth()
  const userType = user?.user_type
  useEffect(() => {
    if (userType === 'system_admin' || userType === 'tenant_admin') {
      loadAdminPanel()
    }
  }, [userType])

  return (
    <Routes>
      {/* Public Route */}
      <Route path="/login" element={
        <Suspense fallback={<RouteFallback />}>
          <Login />
        </Suspense>
      } />

      {/* Root - Auto redirect berdasarkan role */}
      <Route path="/" element={<AutoRedirect />} />

      {/* Admin Panel Routes - SYSTEM ADMIN ONLY */}
      <Route path="/admin-panel" element={<AdminPanelRedirect />} />
      <Route path="/admin-panel/:activeTab" element={
        <ProtectedRoute allowedUserTypes={['system_admin']}>
          <Suspense fallback={<RouteFallback />}>
            <Layout>
              <AdminPanel />
            </Layout>
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Admin Tenant Routes - TENANT ADMIN ONLY */}
      <Route path="/admin-tenant/*" element={
        <ProtectedRoute allowedUserTypes={['tenant_admin', 'system_admin']}>
          <Suspense fallback={<RouteFallback />}>
            <Layout>
              <Routes>
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="participants" element={<Participants />} />
                <Route path="qr-generate" element={<QRGenerate />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
                <Route path="connect-device" element={<ConnectDevice />} />
                <Route path="ops-monitor" element={<OpsMonitor />} />
                <Route path="wa-delivery" element={<WaDelivery />} />
                <Route path="analytics" element={<Analytics />} />
              </Routes>
            </Layout>
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Legacy Operator Routes - Redirect to admin-tenant */}
      <Route path="/operator/*" element={<Navigate to="/admin-tenant/dashboard" replace />} />

      {/* Gate Routes - dengan permission checks */}
      <Route path="/gate/front" element={
        <ProtectedRoute 
          allowedUserTypes={['system_admin', 'tenant_admin', 'gate_user']} 
          requireGatePermission="front"
        >
          <Suspense fallback={<RouteFallback />}>
            <Layout>
              <FrontGate />
            </Layout>
          </Suspense>
        </ProtectedRoute>
      } />

      <Route path="/gate/back" element={
        <ProtectedRoute 
          allowedUserTypes={['system_admin', 'tenant_admin', 'gate_user']} 
          requireGatePermission="back"
        >
          <Suspense fallback={<RouteFallback />}>
            <Layout>
              <BackGate />
            </Layout>
          </Suspense>
        </ProtectedRoute>
      } />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export function AppV2() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ToastProvider>
          <AuthProvider>
            <AppRoutes />
            <OfflineIndicator />
          </AuthProvider>
        </ToastProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default AppV2
