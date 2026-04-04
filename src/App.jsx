import { Suspense, lazy, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './contexts/useAuth'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout/Layout'
import OfflineIndicator from './components/OfflineIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'

const loadLogin = () => import('./pages/Login')
const loadDashboard = () => import('./pages/admin/Dashboard')
const loadParticipants = () => import('./pages/admin/Participants')
const loadQRGenerate = () => import('./pages/admin/QRGenerate')
const loadReports = () => import('./pages/admin/Reports')
const loadFrontGate = () => import('./pages/gate/FrontGate')
const loadBackGate = () => import('./pages/gate/BackGate')
const loadSettings = () => import('./pages/admin/Settings')
const loadConnectDevice = () => import('./pages/admin/ConnectDevice')
const loadOwnerPanel = () => import('./pages/owner/OwnerPanel')

const Login = lazy(loadLogin)
const Dashboard = lazy(loadDashboard)
const Participants = lazy(loadParticipants)
const QRGenerate = lazy(loadQRGenerate)
const Reports = lazy(loadReports)
const FrontGate = lazy(loadFrontGate)
const BackGate = lazy(loadBackGate)
const Settings = lazy(loadSettings)
const ConnectDevice = lazy(loadConnectDevice)
const OwnerPanel = lazy(loadOwnerPanel)

function RouteFallback() {
  return (
    <div className="flex-center full-height-screen">
      <div className="spinner spinner-lg"></div>
    </div>
  )
}

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="flex-center full-height-screen">
        <div className="spinner spinner-lg"></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect based on role
    if (user.role === 'owner') return <Navigate to="/owner" replace />
    if (user.role === 'gate_front') return <Navigate to="/gate/scan" replace />
    if (user.role === 'gate_back') return <Navigate to="/gate/monitor" replace />
    return <Navigate to="/admin" replace />
  }

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()

  useEffect(() => {
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

      if (user.role === 'owner') {
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
        user.role === 'owner' ? '/owner' :
        (user.role === 'super_admin' || user.role === 'admin_client') ? '/admin' :
        user.role === 'gate_front' ? '/gate/scan' :
        '/gate/monitor'
      } replace /> : <Login />} />

      {/* Owner Route */}
      <Route path="/owner" element={<Navigate to="/owner/tenants" replace />} />
      <Route path="/owner/:activeTab" element={
        <ProtectedRoute allowedRoles={['owner']}>
          <OwnerPanel />
        </ProtectedRoute>
      } />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client']}>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/participants" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client']}>
          <Participants />
        </ProtectedRoute>
      } />
      <Route path="/admin/qr-generate" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client']}>
          <QRGenerate />
        </ProtectedRoute>
      } />
      <Route path="/admin/connect" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client']}>
          <ConnectDevice />
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client']}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client']}>
          <Settings />
        </ProtectedRoute>
      } />

      {/* Gate Routes */}
      <Route path="/gate/scan" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'gate_front']}>
          <FrontGate />
        </ProtectedRoute>
      } />
      <Route path="/gate/monitor" element={
        <ProtectedRoute allowedRoles={['super_admin', 'admin_client', 'gate_back']}>
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
