import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/useAuth'
import { humanizeUserMessage } from '../utils/userFriendlyMessage'

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
    if (text.includes('invalid credentials') || text.includes('kredensial tidak cocok') || text.includes('username atau password salah')) {
      return 'Nama pengguna atau kata sandi tidak sesuai.'
    }
    if (text.includes('tidak aktif') || text.includes('nonaktif') || text.includes('disabled')) {
      return 'Akun tidak aktif. Hubungi administrator untuk mengaktifkan akun.'
    }
    if (text.includes('tidak memiliki peran') || text.includes('role')) {
      return 'Akun tidak memiliki akses yang valid. Hubungi administrator.'
    }
    if (text.includes('tidak ditemukan') || text.includes('not found')) {
      return 'Akun tidak ditemukan. Pastikan username/email benar.'
    }
    if (text.includes('too many requests')) {
      return 'Terlalu banyak percobaan. Silakan tunggu sebentar lalu coba lagi.'
    }
    if (text.includes('firebase')) {
      return 'Layanan masuk sedang bermasalah. Silakan coba lagi beberapa saat.'
    }
    return humanizeUserMessage(message, { fallback: 'Proses masuk gagal. Silakan coba lagi.' })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await login(username, password)
      if (result.success) {
        const role = result.user.role
        // Immediate navigation - no delay
        if (role === 'owner') navigate('/owner')
        else if (role === 'super_admin' || role === 'admin_client') navigate('/admin')
        else if (role === 'gate_front') navigate('/gate/scan')
        else if (role === 'gate_back') navigate('/gate/monitor')
        else navigate('/admin') // Default fallback
      } else {
        setError(getFriendlyLoginError(result.error))
        setLoading(false)
      }
    } catch (err) {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
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
        <h1 className="login-title">Masuk ke akun Anda</h1>
        <p className="login-subtitle">Satu pintu masuk untuk admin acara, pemilik platform, dan petugas pintu. Gunakan kredensial yang diberikan tim Anda.</p>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group login-form-group">
            <label className="form-label" htmlFor="login-username">Nama Pengguna</label>
            <input
              id="login-username"
              type="text"
              className="form-input login-form-input"
              placeholder="Ketik nama pengguna Anda"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
            />
            <p className="login-field-hint">
              Contoh: admin, petugas depan, petugas belakang
            </p>
          </div>

          <div className="form-group login-form-group">
            <label className="form-label" htmlFor="login-password">Kata sandi</label>
            <input
              id="login-password"
              type="password"
              className="form-input login-form-input"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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
          <div className="login-demo-title">Butuh akun baru?</div>
          <p className="login-demo-text">
            Hubungi administrator atau tim 3oNs Digital. Akun hanya dibuat untuk peran yang sudah disetujui
            (admin, owner, atau petugas gate).
          </p>
          <p className="login-demo-text login-demo-text-muted">
            Jangan bagikan kata sandi. Keluar dari perangkat bersama setelah selesai bekerja.
          </p>
        </div>
      </div>
    </div>
  )
}
