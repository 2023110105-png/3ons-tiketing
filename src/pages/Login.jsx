import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const getFriendlyLoginError = (message) => {
    const text = String(message || '').toLowerCase()
    if (!text) return 'Proses masuk gagal. Silakan coba lagi.'
    if (text.includes('invalid credentials') || text.includes('kredensial tidak cocok')) {
      return 'Nama pengguna atau kata sandi tidak sesuai.'
    }
    if (text.includes('too many requests')) {
      return 'Terlalu banyak percobaan. Silakan tunggu sebentar lalu coba lagi.'
    }
    if (text.includes('firebase')) {
      return 'Layanan masuk sedang bermasalah. Silakan coba lagi beberapa saat.'
    }
    return message
  }

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
      setError(getFriendlyLoginError(result.error))
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
        <div className="login-brand">
          <div className="logo-3ons login-logo">
            <span className="l3">3</span>
            <span className="lo">o</span>
            <span className="lN">N</span>
            <span className="ls">s</span>
          </div>
          <div className="login-brand-subtitle">Digital</div>
        </div>
        <h1 className="login-title">Selamat Datang</h1>
        <p className="login-subtitle">Silakan masuk untuk melanjutkan pengelolaan acara dan data peserta.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nama Pengguna</label>
            <input
              id="login-username"
              type="text"
              className="form-input"
              placeholder="Contoh: admin, petugas depan, petugas belakang"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label">Kata sandi</label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="Masukkan kata sandi"
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
                Sedang memverifikasi...
              </>
            ) : 'Masuk'}
          </button>
        </form>

        <div className="login-demo-card">
          <div className="login-demo-title">Informasi Akses</div>
          <p className="login-demo-text">
            Jika belum memiliki akun, silakan hubungi tim kami melalui WhatsApp untuk permintaan akun
            dan pengaturan akses.
          </p>
          <p className="login-demo-text login-demo-text-muted">
            Hak akses akan disesuaikan dengan kebutuhan peran Anda di sistem.
          </p>
        </div>
      </div>
    </div>
  )
}
