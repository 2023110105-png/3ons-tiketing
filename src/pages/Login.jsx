import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ShieldCheck } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    await new Promise(resolve => setTimeout(resolve, 250))
    const result = await login(username, password)
    if (result.success) {
      const role = result.user.role
      if (role === 'owner') navigate('/owner')
      else if (role === 'super_admin' || role === 'admin_client') navigate('/admin')
      else if (role === 'gate_front') navigate('/gate/scan')
      else if (role === 'gate_back') navigate('/gate/monitor')
    } else {
      setError(result.error)
    }
    setLoading(false)
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
        <div className="logo-3ons login-logo">
          <span className="l3">3</span>
          <span className="lo">o</span>
          <span className="lN">N</span>
          <span className="ls">s</span>
          <span className="digital-tag">Digital</span>
        </div>
        <h1 className="login-title">Masuk Aplikasi</h1>
        <p className="login-subtitle">Silakan masukkan kredensial Anda</p>

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
