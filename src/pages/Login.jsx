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

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    setTimeout(() => {
      const result = login(username, password)
      if (result.success) {
        const role = result.user.role
        if (role === 'super_admin') navigate('/admin')
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
          <img src="/yamaha-logo.svg" alt="Yamaha" />
        </div>
        
        <h1 className="login-title">Event Gate Scanner</h1>
        <p className="login-subtitle">Masuk ke sistem registrasi peserta</p>

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
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--danger-bg)',
              color: 'var(--danger)',
              fontSize: '0.85rem',
              fontWeight: 500,
              animation: 'fadeInDown 0.3s ease-out'
            }}>
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
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></span>
                Memproses...
              </>
            ) : 'Masuk'}
          </button>
        </form>

        {/* Demo Credentials */}
        <div style={{
          marginTop: 24,
          padding: 16,
          background: 'var(--bg-elevated)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)'
        }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)', fontSize: '0.8rem' }}>
            <ShieldCheck size={14} style={{ display: 'inline' }} /> Demo Credentials
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            <div><strong style={{ color: 'var(--yamaha-red)' }}>Admin:</strong> admin / admin123</div>
            <div><strong style={{ color: 'var(--success)' }}>Gate Depan:</strong> gate1 / gate123</div>
            <div><strong style={{ color: 'var(--info)' }}>Gate Belakang:</strong> gate2 / gate123</div>
          </div>
        </div>
      </div>
    </div>
  )
}
