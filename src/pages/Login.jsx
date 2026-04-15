import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContextSaaS'
import { humanizeUserMessage } from '../utils/userFriendlyMessage'
import { Ticket, User, Lock, Eye, EyeOff, AlertCircle, Info } from 'lucide-react'

export default function Login() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showQR, setShowQR] = useState(false)
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
        // Show success animation
        setSuccess(true)
        // Navigate after short delay
        setTimeout(() => {
          if (role === 'owner') navigate('/owner')
          else if (role === 'super_admin' || role === 'admin_client' || role === 'admin') navigate('/admin')
          else if (role === 'gate_front') navigate('/gate/scan')
          else if (role === 'gate_back') navigate('/gate/monitor')
          else navigate('/admin') // Default fallback
        }, 800)
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
    <div style={styles.page}>
      {/* Background Decorative */}
      <div style={styles.bgDecorative}>
        {/* Animated gradient background */}
        <div style={styles.animatedGradient} />
        
        {/* Moving grid pattern */}
        <div style={styles.gridPattern} />
        
        {/* Large floating shapes */}
        <div style={styles.floatingSquare1} />
        <div style={styles.floatingSquare2} />
        <div style={styles.floatingTriangle} />
        
        {/* Shooting stars */}
        <div style={styles.shootingStar1} />
        <div style={styles.shootingStar2} />
        
        {/* Original elements */}
        <div style={styles.bgCircle1} />
        <div style={styles.bgCircle2} />
        <div style={styles.floatingParticle1} />
        <div style={styles.floatingParticle2} />
        <div style={styles.floatingParticle3} />
        <div style={styles.wave1} />
        <div style={styles.wave2} />
      </div>

      {/* Main Card Container */}
      <div style={styles.container}>
        {/* Card */}
        <div style={styles.card}>
          
          {/* Logo & Brand Section */}
          <div style={styles.brandSection}>
            <div style={styles.logoContainer}>
              <Ticket size={32} color="white" strokeWidth={2} />
            </div>
            
            <h1 style={styles.brandName}>
              <span style={{ color: '#3b82f6' }}>3</span>
              <span style={{ color: '#10b981' }}>O</span>
              <span style={{ color: '#ef4444' }}>N</span>
              <span style={{ color: '#ec4899' }}>S</span>
            </h1>
            
            <p style={styles.brandTagline}>Digital Ticketing System</p>
          </div>

          {/* Header */}
          <div style={styles.header}>
            <h2 style={styles.title}>Selamat Datang</h2>
            <p style={styles.subtitle}>Masuk ke sistem manajemen event Anda</p>
          </div>

          {/* Content */}
          <div style={styles.content}>
            
            {/* Error Message */}
            {error && (
              <div style={styles.errorBox}>
                <AlertCircle size={18} color="#dc2626" />
                <span style={styles.errorText}>{error}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} style={styles.form}>
              
              {/* Username Field */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Nama Pengguna <span style={styles.required}>*</span>
                </label>
                <div style={styles.inputWrapper}>
                  <div style={styles.inputIcon}>
                    <User size={18} color="#9ca3af" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="admin, petugas-depan, dll"
                    required
                    autoFocus
                    autoComplete="username"
                    style={styles.input}
                  />
                </div>
                <span style={styles.helperText}>Contoh: admin, petugas-depan, petugas-belakang</span>
              </div>

              {/* Password Field */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>
                  Kata Sandi <span style={styles.required}>*</span>
                </label>
                <div style={styles.inputWrapper}>
                  <div style={styles.inputIcon}>
                    <Lock size={18} color="#9ca3af" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    required
                    autoComplete="current-password"
                    style={{ ...styles.input, paddingRight: '44px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} color="#9ca3af" /> : <Eye size={18} color="#9ca3af" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                style={loading ? { ...styles.button, ...styles.buttonDisabled } : styles.button}
              >
                {loading ? (
                  <div style={styles.buttonContent}>
                    <div style={styles.spinner} />
                    <span>Memverifikasi...</span>
                  </div>
                ) : (
                  'Masuk ke Sistem'
                )}
              </button>

              {/* QR Code Login (for Gate Users) */}
              <button
                type="button"
                onClick={() => setShowQR(!showQR)}
                style={{
                  ...styles.qrButton,
                  borderColor: showQR ? '#ef4444' : '#d1d5db',
                  color: showQR ? '#ef4444' : '#6b7280',
                }}
              >
                <Ticket size={18} />
                <span>{showQR ? 'Tutup QR Scanner' : 'Login dengan QR Code'}</span>
              </button>

              {/* QR Scanner Placeholder */}
              {showQR && (
                <div style={{
                  padding: '20px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '12px',
                  textAlign: 'center',
                }}>
                  <div style={{
                    width: '200px',
                    height: '200px',
                    margin: '0 auto',
                    border: '2px dashed #d1d5db',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: '12px',
                  }}>
                    <Ticket size={48} color="#9ca3af" />
                    <p style={{ fontSize: '14px', color: '#6b7280' }}>
                      QR Scanner akan muncul di sini
                    </p>
                  </div>
                  <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '12px' }}>
                    Scan QR code tiket untuk login cepat sebagai petugas gate
                  </p>
                </div>
              )}
            </form>

            {/* Success Animation Overlay */}
            {success && (
              <div style={styles.successOverlay}>
                <div style={styles.successCheck}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </div>
              </div>
            )}

            {/* Info Box */}
            <div style={styles.infoBox}>
              <div style={styles.infoIcon}>
                <Info size={18} color="#2563eb" />
              </div>
              <div>
                <h4 style={styles.infoTitle}>Butuh akun baru?</h4>
                <p style={styles.infoText}>
                  Hubungi administrator untuk membuat akun. Akun hanya untuk peran yang disetujui.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p style={styles.footer}>3ONS Ticketing System v2.0.0</p>
      </div>

      <style>{`
        @keyframes gradientShift {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.6; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0); }
          to { transform: scale(1); }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-30px) translateX(5px); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0) translateX(0); }
          33% { transform: translateY(15px) translateX(-15px); }
          66% { transform: translateY(-25px) translateX(10px); }
        }
        @keyframes float3 {
          0%, 100% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(-40px) translateX(-20px) scale(1.1); }
        }
        @keyframes wave {
          0% { transform: translateX(-100%) rotate(0deg); }
          100% { transform: translateX(100%) rotate(360deg); }
        }
        @keyframes wave2 {
          0% { transform: translateX(100%) rotate(0deg); }
          100% { transform: translateX(-100%) rotate(-360deg); }
        }
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes gridMove {
          0% { transform: perspective(500px) rotateX(60deg) translateY(0); }
          100% { transform: perspective(500px) rotateX(60deg) translateY(50px); }
        }
        @keyframes shoot {
          0% { transform: translateX(0) translateY(0) rotate(-45deg) scale(1); opacity: 1; }
          100% { transform: translateX(500px) translateY(500px) rotate(-45deg) scale(0); opacity: 0; }
        }
        @keyframes shoot2 {
          0% { transform: translateX(0) translateY(0) rotate(-45deg) scale(1); opacity: 1; }
          100% { transform: translateX(400px) translateY(400px) rotate(-45deg) scale(0); opacity: 0; }
        }
        @keyframes rotate3d {
          0% { transform: rotateY(0deg) rotateX(0deg); }
          100% { transform: rotateY(360deg) rotateX(180deg); }
        }
        @keyframes rotate3dReverse {
          0% { transform: rotateY(360deg) rotateX(0deg); }
          100% { transform: rotateY(0deg) rotateX(180deg); }
        }
        input:focus {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.1) !important;
          background-color: white !important;
        }
      `}</style>
    </div>
  )
}

// Styles object for maintainability
const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  bgDecorative: {
    position: 'fixed',
    inset: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  bgCircle1: {
    position: 'absolute',
    top: '-10%',
    right: '-5%',
    width: '500px',
    height: '500px',
    background: 'radial-gradient(circle, rgba(239,68,68,0.15) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'gradientShift 8s ease-in-out infinite',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: '-10%',
    left: '-5%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, transparent 70%)',
    borderRadius: '50%',
    animation: 'gradientShift 8s ease-in-out infinite 4s',
  },
  floatingParticle1: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    width: '20px',
    height: '20px',
    background: 'linear-gradient(135deg, rgba(239,68,68,0.4) 0%, rgba(239,68,68,0.1) 100%)',
    borderRadius: '50%',
    animation: 'float 6s ease-in-out infinite',
    filter: 'blur(2px)',
  },
  floatingParticle2: {
    position: 'absolute',
    top: '60%',
    right: '15%',
    width: '30px',
    height: '30px',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.4) 0%, rgba(59,130,246,0.1) 100%)',
    borderRadius: '50%',
    animation: 'float2 8s ease-in-out infinite 1s',
    filter: 'blur(3px)',
  },
  floatingParticle3: {
    position: 'absolute',
    top: '40%',
    right: '25%',
    width: '15px',
    height: '15px',
    background: 'linear-gradient(135deg, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0.2) 100%)',
    borderRadius: '50%',
    animation: 'float3 7s ease-in-out infinite 2s',
    filter: 'blur(1px)',
  },
  wave1: {
    position: 'absolute',
    bottom: '0',
    left: '-50%',
    width: '200%',
    height: '300px',
    background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.03), transparent)',
    borderRadius: '40%',
    animation: 'wave 20s linear infinite',
    filter: 'blur(40px)',
  },
  wave2: {
    position: 'absolute',
    bottom: '0',
    right: '-50%',
    width: '200%',
    height: '250px',
    background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.03), transparent)',
    borderRadius: '45%',
    animation: 'wave2 25s linear infinite',
    filter: 'blur(50px)',
  },
  animatedGradient: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(-45deg, #f8fafc, #fef2f2, #f0f9ff, #fefce8)',
    backgroundSize: '400% 400%',
    animation: 'gradientMove 15s ease infinite',
    zIndex: -1,
  },
  gridPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(rgba(239,68,68,0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(239,68,68,0.03) 1px, transparent 1px)
    `,
    backgroundSize: '50px 50px',
    animation: 'gridMove 20s linear infinite',
    opacity: 0.6,
  },
  floatingSquare1: {
    position: 'absolute',
    top: '15%',
    left: '5%',
    width: '60px',
    height: '60px',
    border: '2px solid rgba(239,68,68,0.2)',
    borderRadius: '12px',
    animation: 'rotate3d 10s linear infinite',
    background: 'linear-gradient(135deg, rgba(239,68,68,0.1), transparent)',
    boxShadow: '0 0 30px rgba(239,68,68,0.1)',
  },
  floatingSquare2: {
    position: 'absolute',
    bottom: '20%',
    right: '10%',
    width: '80px',
    height: '80px',
    border: '2px solid rgba(59,130,246,0.2)',
    borderRadius: '16px',
    animation: 'rotate3dReverse 12s linear infinite',
    background: 'linear-gradient(135deg, rgba(59,130,246,0.1), transparent)',
    boxShadow: '0 0 30px rgba(59,130,246,0.1)',
  },
  floatingTriangle: {
    position: 'absolute',
    top: '70%',
    left: '8%',
    width: 0,
    height: 0,
    borderLeft: '30px solid transparent',
    borderRight: '30px solid transparent',
    borderBottom: '50px solid rgba(16,185,129,0.15)',
    animation: 'float3 8s ease-in-out infinite',
    filter: 'drop-shadow(0 0 20px rgba(16,185,129,0.2))',
  },
  shootingStar1: {
    position: 'absolute',
    top: '10%',
    left: '20%',
    width: '100px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.6), transparent)',
    animation: 'shoot 3s linear infinite',
    borderRadius: '2px',
    boxShadow: '0 0 10px rgba(239,68,68,0.5)',
  },
  shootingStar2: {
    position: 'absolute',
    top: '30%',
    right: '30%',
    width: '80px',
    height: '2px',
    background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.6), transparent)',
    animation: 'shoot2 4s linear infinite 1s',
    borderRadius: '2px',
    boxShadow: '0 0 10px rgba(59,130,246,0.5)',
  },
  container: {
    width: '100%',
    maxWidth: '420px',
    position: 'relative',
    zIndex: 10,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '20px',
    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04), 0 0 0 1px rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  brandSection: {
    textAlign: 'center',
    padding: '32px 24px 20px',
    background: 'linear-gradient(180deg, #fef2f2 0%, #ffffff 100%)',
  },
  logoContainer: {
    width: '64px',
    height: '64px',
    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    borderRadius: '16px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '16px',
    boxShadow: '0 10px 20px rgba(239,68,68,0.3)',
  },
  brandName: {
    fontSize: '32px',
    fontWeight: 800,
    marginBottom: '4px',
    letterSpacing: '-0.02em',
  },
  brandTagline: {
    color: '#d97706',
    fontSize: '13px',
    fontWeight: 600,
  },
  header: {
    textAlign: 'center',
    padding: '0 24px 20px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: '#111827',
    marginBottom: '6px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#6b7280',
  },
  content: {
    padding: '0 24px 28px',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    padding: '12px 16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '10px',
    marginBottom: '20px',
  },
  errorText: {
    fontSize: '14px',
    color: '#dc2626',
    lineHeight: '1.4',
    flex: 1,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#374151',
  },
  required: {
    color: '#ef4444',
  },
  inputWrapper: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '13px 16px 13px 42px',
    fontSize: '15px',
    color: '#111827',
    backgroundColor: '#f9fafb',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box',
  },
  inputFocus: {
    borderColor: '#ef4444',
    boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.1)',
    backgroundColor: 'white',
  },
  eyeButton: {
    position: 'absolute',
    right: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '4px',
  },
  button: {
    marginTop: '8px',
    width: '100%',
    padding: '14px 24px',
    fontSize: '15px',
    fontWeight: 600,
    color: 'white',
    background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 6px -1px rgba(220,38,38,0.2)',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  buttonContent: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: 'white',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  successOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(255,255,255,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    animation: 'fadeIn 0.3s ease',
  },
  successCheck: {
    width: '80px',
    height: '80px',
    backgroundColor: '#22c55e',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    animation: 'scaleIn 0.3s ease, fadeOut 0.3s ease 1s',
  },
  qrButton: {
    marginTop: '16px',
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    color: '#6b7280',
    backgroundColor: 'transparent',
    border: '2px dashed #d1d5db',
    borderRadius: '12px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'all 0.2s ease',
  },
  infoBox: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    padding: '16px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: '12px',
  },
  infoIcon: {
    width: '36px',
    height: '36px',
    backgroundColor: '#dbeafe',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  infoTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#1e293b',
    marginBottom: '4px',
  },
  infoText: {
    fontSize: '13px',
    color: '#64748b',
    lineHeight: '1.5',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
    fontSize: '12px',
    color: '#94a3b8',
    fontWeight: 500,
  }
 }