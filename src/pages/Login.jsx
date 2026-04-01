import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getTenantBranding } from '../store/mockData'
import { ShieldCheck } from 'lucide-react'

export default function Login() {
  const branding = getTenantBranding()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [tenantToken, setTenantToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const result = login(username, password, tenantToken)
      if (result.success) {
        const role = result.user.role
        if (role === 'owner') navigate('/owner')
        else if (role === 'super_admin') navigate('/admin')
        else if (role === 'gate_front') navigate('/gate/scan')
        else if (role === 'gate_back') navigate('/gate/monitor')
      } else {
        setError(result.error)
      }
      setLoading(false)
    }, 500)
  }

  return (
    <div className="login-page">
      {/* Background Effects */}
      <div className="login-bg">
        <div className="login-bg-gradient g1"></div>
        <div className="login-bg-gradient g2"></div>
      </div>

      {/* Login Card */}
      <div className="login-card">
        <div className="login-logo">
          <img src="/brand-logo.svg" alt="3oNs" />
        </div>
        
        <h1 className="login-title">{branding.brandName}</h1>
        <p className="login-subtitle">Masuk ke {branding.eventName}</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              placeholder="Masukkan username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Masukkan password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Token Tenant (Opsional)</label>
            <input
              id="login-tenant-token"
              type="text"
              className="form-input"
              placeholder="Contoh: YAMAHA-EXPO-2026"
              value={tenantToken}
              onChange={e => setTenantToken(e.target.value.toUpperCase())}
            />
          </div>

          {error && (
            <div className="login-error-alert">
              {error}
            </div>
          )}

          <button
            id="login-submit"
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner login-spinner"></span>
                Memproses...
              </>
            ) : 'Masuk'}
          </button>
        </form>

        {/* Demo Credentials */}
        <div className="login-demo-card">
          <div className="login-demo-title">
            <ShieldCheck size={14} className="login-demo-title-icon" /> Demo Credentials
          </div>
          <div className="login-demo-grid">
            <div><strong className="login-demo-admin">Owner:</strong> owner / owner123</div>
            <div><strong className="login-demo-admin">Admin:</strong> admin / admin123</div>
            <div><strong className="login-demo-front">Gate Depan:</strong> gate1 / gate123</div>
            <div><strong className="login-demo-back">Gate Belakang:</strong> gate2 / gate123</div>
          </div>
        </div>
      </div>
    </div>
  )
}
