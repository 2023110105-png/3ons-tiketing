import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout/Layout'
import OfflineIndicator from './components/OfflineIndicator'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/Login'
import Dashboard from './pages/admin/Dashboard'
import Participants from './pages/admin/Participants'
import QRGenerate from './pages/admin/QRGenerate'
import Reports from './pages/admin/Reports'
import FrontGate from './pages/gate/FrontGate'
import BackGate from './pages/gate/BackGate'
import Settings from './pages/admin/Settings'
import ConnectDevice from './pages/admin/ConnectDevice'

function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh' }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }}></div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect based on role
    if (user.role === 'gate_front') return <Navigate to="/gate/scan" replace />
    if (user.role === 'gate_back') return <Navigate to="/gate/monitor" replace />
    return <Navigate to="/admin" replace />
  }

  return <Layout>{children}</Layout>
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to={
        user.role === 'super_admin' ? '/admin' :
        user.role === 'gate_front' ? '/gate/scan' :
        '/gate/monitor'
      } replace /> : <Login />} />
      
      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Dashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/participants" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Participants />
        </ProtectedRoute>
      } />
      <Route path="/admin/qr-generate" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <QRGenerate />
        </ProtectedRoute>
      } />
      <Route path="/admin/connect" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <ConnectDevice />
        </ProtectedRoute>
      } />
      <Route path="/admin/reports" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Reports />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={['super_admin']}>
          <Settings />
        </ProtectedRoute>
      } />

      {/* Gate Routes */}
      <Route path="/gate/scan" element={
        <ProtectedRoute allowedRoles={['super_admin', 'gate_front']}>
          <FrontGate />
        </ProtectedRoute>
      } />
      <Route path="/gate/monitor" element={
        <ProtectedRoute allowedRoles={['super_admin', 'gate_back']}>
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
            <AppRoutes />
            <OfflineIndicator />
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
