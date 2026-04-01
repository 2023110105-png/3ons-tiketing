import { useState, useEffect } from 'react'
import { MessageCircle, CheckCircle, RefreshCw, Smartphone } from 'lucide-react'

export default function WhatsAppStatus() {
  const [waState, setWaState] = useState({ status: 'checking', isReady: false, qrCode: null })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    let interval;
    
    const checkWaStatus = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/wa/status');
        const data = await res.json();
        setWaState(data);
      } catch (err) {
        setWaState({ status: 'offline', isReady: false, qrCode: null });
      }
    };

    // Poll every 3 seconds if modal is open or bot is not ready, else every 10 seconds
    if (isOpen || !waState.isReady) {
      checkWaStatus();
      interval = setInterval(checkWaStatus, 3000);
    } else {
      interval = setInterval(checkWaStatus, 10000);
    }

    return () => clearInterval(interval);
  }, [isOpen, waState.isReady]);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/wa/logout', { method: 'POST' });
      setWaState({ status: 'qr', isReady: false, qrCode: null });
    } catch(e) {}
  };

  return (
    <>
      {/* Floating Status Badge */}
      <button 
        onClick={() => setIsOpen(true)}
        className="wa-floating-badge"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          background: waState.status === 'offline' ? 'var(--danger)' : waState.isReady ? '#25D366' : 'var(--warning)',
          color: 'white',
          padding: '10px 16px',
          borderRadius: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          border: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          zIndex: 100,
          fontWeight: 600,
          fontSize: '0.85rem'
        }}
      >
        <MessageCircle size={18} />
        {waState.status === 'offline' ? 'Bot Server Offline' : waState.isReady ? 'WhatsApp Ready' : 'Bot Butuh Scan'}
      </button>

      {/* Connection Modal */}
      {isOpen && (
        <div className="modal-overlay" onClick={() => setIsOpen(false)} style={{ zIndex: 1000 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'center' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', width: '100%' }}>
                <MessageCircle color="#25D366" /> Status WhatsApp Bot
              </h3>
            </div>
            
            <div className="modal-body" style={{ padding: '30px 20px' }}>
              {waState.status === 'offline' && (
                <div>
                  <div style={{ color: 'var(--danger)', marginBottom: 16 }}><RefreshCw size={48} /></div>
                  <h4>Bot Server Mati</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>Pastikan Anda menjalankan Mulai_Yamaha_Event.bat dan server tetap menyala.</p>
                </div>
              )}

              {waState.status === 'ready' && (
                <div>
                  <div style={{ color: '#25D366', marginBottom: 16 }}><CheckCircle size={56} /></div>
                  <h4>Tersambung!</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8 }}>Sistem pengiriman tiket otomatis siap digunakan.</p>
                  
                  <button onClick={handleLogout} className="btn" style={{ marginTop: 24, fontSize: '0.8rem', color: 'var(--danger)', background: 'rgba(239, 68, 68, 0.1)', border: 'none' }}>
                    Putuskan (Logout)
                  </button>
                </div>
              )}

              {waState.status === 'qr' && (
                <div>
                  <h4>Scan untuk Login</h4>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 8, marginBottom: 20 }}>Buka WhatsApp di HP Anda - Perangkat Tertaut - Tautkan Perangkat</p>
                  
                  {waState.qrCode ? (
                    <div style={{ padding: 10, background: 'white', borderRadius: 10, display: 'inline-block' }}>
                      <img src={waState.qrCode} alt="WhatsApp QR" style={{ width: 220, height: 220 }} />
                    </div>
                  ) : (
                    <div style={{ padding: 40, background: 'var(--bg-elevated)', borderRadius: 10 }}>
                      <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                      <div style={{ fontSize: '0.8rem', marginTop: 10, color: 'var(--text-muted)' }}>Memuat QR Code...</div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setIsOpen(false)}>Tutup</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
