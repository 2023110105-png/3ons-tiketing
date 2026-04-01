import { useState, useEffect } from 'react'

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [showBanner, setShowBanner] = useState(false)
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      if (wasOffline) {
        setShowBanner(true)
        setTimeout(() => setShowBanner(false), 3000)
      }
    }

    const handleOffline = () => {
      setIsOnline(false)
      setWasOffline(true)
      setShowBanner(true)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [wasOffline])

  if (!showBanner && isOnline) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      padding: '0 20px 20px',
      pointerEvents: 'none',
      animation: 'fadeInUp 0.3s ease-out'
    }}>
      <div style={{
        maxWidth: 400,
        margin: '0 auto',
        padding: '12px 20px',
        borderRadius: 'var(--radius-lg, 16px)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'auto',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: `1px solid ${isOnline ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
        background: isOnline ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
        boxShadow: `0 8px 32px ${isOnline ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
        fontSize: '0.85rem',
        fontWeight: 600,
        color: isOnline ? '#10B981' : '#EF4444',
      }}>
        <span style={{ fontSize: '1.2rem' }}>
          {isOnline ? '🟢' : '🔴'}
        </span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>
            {isOnline ? 'Kembali Online' : 'Koneksi Terputus'}
          </div>
          <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: 2 }}>
            {isOnline
              ? 'Koneksi internet sudah pulih, data akan sync otomatis'
              : 'Tidak ada koneksi internet. Data scan akan disimpan lokal'}
          </div>
        </div>
        {showBanner && (
          <button
            onClick={() => setShowBanner(false)}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              padding: 4,
              opacity: 0.6,
              fontSize: '1rem',
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
