import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContextSaaS'
import { humanizeUserMessage } from '../utils/userFriendlyMessage'
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Alert } from '../components'
import { Ticket, User, Lock } from 'lucide-react'

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
        else if (role === 'super_admin' || role === 'admin_client' || role === 'admin') navigate('/admin')
        else if (role === 'gate_front') navigate('/gate/scan')
        else if (role === 'gate_back') navigate('/gate/monitor')
        else navigate('/admin') // Default fallback
      } else {
        setError(getFriendlyLoginError(result.error))
        setLoading(false)
      }
    } catch {
      setError('Terjadi kesalahan. Silakan coba lagi.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-3ons-50 via-white to-secondary-100 flex items-center justify-center p-4">
      {/* Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-3ons-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-bounce-soft" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-3ons-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      </div>

      {/* Login Card */}
      <Card 
        padding="xl" 
        shadow="xl" 
        className="w-full max-w-md relative z-10 animate-scale-in"
      >
        {/* Brand Header */}
        <div className="text-center mb-8">
          {/* 3ONS Logo */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-3ons-500 rounded-2xl shadow-lg shadow-3ons-500/30 mb-4">
            <Ticket className="w-8 h-8 text-white" />
          </div>
          
          {/* Brand Name */}
          <h1 className="text-3xl font-bold text-secondary-900 tracking-tight">
            3<span className="text-3ons-500">O</span>N<span className="text-3ons-500">S</span>
          </h1>
          <p className="text-secondary-500 text-sm mt-1">Digital Ticketing System</p>
        </div>

        {/* Title */}
        <CardHeader className="text-center mb-6">
          <CardTitle className="text-xl">Masuk ke Akun Anda</CardTitle>
          <p className="text-secondary-500 text-sm mt-2">
            Sistem manajemen tiket multi-tenant untuk event Anda
          </p>
        </CardHeader>

        <CardContent>
          {/* Error Alert */}
          {error && (
            <Alert 
              variant="error" 
              className="mb-4"
            >
              {error}
            </Alert>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nama Pengguna"
              icon={User}
              placeholder="Ketik nama pengguna Anda"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              autoComplete="username"
              fullWidth
              helper="Contoh: admin, petugas-depan, petugas-belakang"
            />

            <Input
              label="Kata Sandi"
              icon={Lock}
              type="password"
              placeholder="Masukkan kata sandi"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              fullWidth
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              className="mt-2"
            >
              {loading ? 'Sedang Memverifikasi...' : 'Masuk'}
            </Button>
          </form>

          {/* Info Card */}
          <div className="mt-6 p-4 bg-secondary-50 rounded-lg border border-secondary-200">
            <h3 className="text-sm font-semibold text-secondary-700 mb-2">
              Butuh akun baru?
            </h3>
            <p className="text-xs text-secondary-500 leading-relaxed">
              Hubungi administrator atau tim 3ONS Digital. Akun hanya dibuat untuk peran yang sudah disetujui.
            </p>
            <p className="text-xs text-secondary-400 mt-2">
              Jangan bagikan kata sandi. Keluar dari perangkat bersama setelah selesai bekerja.
            </p>
          </div>
        </CardContent>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-secondary-400">
            3ONS Ticketing System v2.0.0
          </p>
        </div>
      </Card>
    </div>
  )
}
