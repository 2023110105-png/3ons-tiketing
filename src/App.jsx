import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout/Layout'
import OfflineIndicator from './components/OfflineIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'

// Helper untuk lazy load dengan timeout dan error handling
function lazyWithTimeout(importFn, timeoutMs = 10000) {
  return async () => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Loading timeout')), timeoutMs)
    )
    try {
      return await Promise.race([importFn(), timeoutPromise])
    } catch (err) {
      console.error('Failed to load component:', err)
      // Return a fallback error component
      return {
        default: function ErrorComponent() {
          return (
            <div className="flex-center full-height-screen" style={{ padding: 20, textAlign: 'center' }}>
              <div>
                <h2 style={{ color: '#dc2626', marginBottom: 10 }}>Gagal memuat halaman</h2>
                <p style={{ color: '#666' }}>Silakan refresh halaman atau coba lagi</p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn btn-primary"
                  style={{ marginTop: 20 }}
                >
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

const loadLogin = () => import('./pages/Login')
const loadDashboard = lazyWithTimeout(() => import('./pages/admin/Dashboard'))
const loadParticipants = lazyWithTimeout(() => import('./pages/admin/Participants'))
const loadQRGenerate = lazyWithTimeout(() => import('./pages/admin/QRGenerate'))
const loadReports = lazyWithTimeout(() => import('./pages/admin/Reports'))
const loadFrontGate = lazyWithTimeout(() => import('./pages/gate/FrontGate'))
const loadBackGate = lazyWithTimeout(() => import('./pages/gate/BackGate'))
const loadSettings = lazyWithTimeout(() => import('./pages/admin/Settings'))
const loadConnectDevice = lazyWithTimeout(() => import('./pages/admin/ConnectDevice'))
const loadOpsMonitor = lazyWithTimeout(() => import('./pages/admin/OpsMonitor'))
const loadWaDelivery = lazyWithTimeout(() => import('./pages/admin/WaDelivery'))
const loadAnalytics = lazyWithTimeout(() => import('./pages/admin/Analytics'))
const loadOwnerPanel = lazyWithTimeout(() => import('./pages/owner/OwnerPanel'))

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
const OwnerPanel = lazy(loadOwnerPanel)
const OWNER_FEATURES_ENABLED = String(import.meta.env.VITE_ENABLE_OWNER_FEATURES || 'false').trim().toLowerCase() === 'true'

function RouteFallback() {
  return (
    <div className="flex-center full-height-screen" style={{ flexDirection: 'column', gap: 16 }}>
      <div className="spinner spinner-lg"></div>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>Memuat halaman...</p>
    </div>
  )
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  
  console.log('[ProtectedRoute] loading:', loading, 'user:', user?.role || 'null')
  
  if (loading) {
    return (
      <div className="flex-center full-height-screen" style={{ flexDirection: 'column', gap: 12 }}>
        <div className="spinner spinner-lg"></div>
        <p style={{ color: '#666' }}>Memuat sesi...</p>
      </div>
    )
  }

  if (!user) {
    console.log('[ProtectedRoute] No user, redirecting to login')
    return <Navigate to="/login" replace />
  }
  if (!OWNER_FEATURES_ENABLED && user?.role === 'owner') {
    return <Navigate to="/admin" replace />
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect based on role
    if (user.role === 'owner') return <Navigate to={OWNER_FEATURES_ENABLED ? '/owner' : '/admin'} replace />
    if (user.role === 'gate_front') return <Navigate to="/gate/scan" replace />
    if (user.role === 'gate_back') return <Navigate to="/gate/monitor" replace />
    // Admin and super_admin go to admin
    if (user.role === 'admin' || user.role === 'super_admin' || user.role === 'admin_client') {
      return <Navigate to="/admin" replace />
    }
    return <Navigate to="/login" replace />
  }

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()
  
  console.log('[AppRoutes] Rendering with user:', user?.role || 'null')

  useEffect(() => {
    console.log('[AppRoutes] useEffect - user:', user?.role || 'null')
    if (!user) return

    const preloadForRole = () => {
      if (user.role === 'super_admin') {
        loadDashboard()
        loadParticipants()
        loadQRGenerate()
        loadConnectDevice()
        loadSettings()
        loadFrontGate()
        loadBackGate()
        loadReports()
        loadAnalytics()
        return
      }

      if (user.role === 'gate_front') {
        loadFrontGate()
        loadBackGate()
        return
      }

      if (user.role === 'gate_back') {
        loadBackGate()
        loadFrontGate()
        return
      }

      if (user.role === 'owner' && OWNER_FEATURES_ENABLED) {
        loadOwnerPanel()
      }
    }

    let idleId
    let timeoutId

    if ('requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(preloadForRole, { timeout: 1200 })
    } else {
      timeoutId = window.setTimeout(preloadForRole, 600)
    }

    return () => {
      if (typeof idleId === 'number' && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId)
      }
      if (typeof timeoutId === 'number') {
        window.clearTimeout(timeoutId)
      }
    }
  }, [user])

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={
        user.role === 'owner' ? (OWNER_FEATURES_ENABLED ? '/owner' : '/admin') :
        (user.role === 'super_admin' || user.role === 'admin_client') ? '/admin' :
        user.role === 'gate_front' ? '/gate/scan' :
        '/gate/monitor'
      } replace /> : <Login />} />

      {/* Owner Route */}
      <Route path="/owner" element={<Navigate to={OWNER_FEATURES_ENABLED ? '/owner/tenants' : '/admin'} replace />} />
      <Route path="/owner/:activeTab" element={
        OWNER_FEATURES_ENABLED ? (
          <ProtectedRoute allowedRoles={['owner']}>
            <OwnerPanel />
          </ProtectedRoute>
        ) : (
          <Navigate to="/admin" replace />
        )
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/participants" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <Participants />
        </ProtectedRoute>
      } />
      <Route path="/admin/qr-generate" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <QRGenerate />
        </ProtectedRoute>
      } />
      <Route path="/admin/connect" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <ConnectDevice />
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/admin/ops" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <OpsMonitor />
        </ProtectedRoute>
      } />
      <Route path="/admin/wa-delivery" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <WaDelivery />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <Settings />
        </ProtectedRoute>
      } />
      <Route path="/admin/analytics" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin']}>
          <Analytics />
        </ProtectedRoute>
      } />

      {/* Gate Routes */}
      <Route path="/gate/scan" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin', 'gate_front']}>
          <FrontGate />
        </ProtectedRoute>
      } />
      <Route path="/gate/monitor" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'admin', 'gate_back']}>
          <BackGate />
        </ProtectedRoute>
      } />




      {/* Default redirect */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <AppRoutes />
            </Suspense>
            <OfflineIndicator />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
