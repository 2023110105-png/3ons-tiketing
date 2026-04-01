import { useState, useEffect } from 'react'
import { MessageCircle, CheckCircle, RefreshCw, Smartphone, LogOut, ShieldAlert } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'

export default function ConnectDevice() {
  const [waState, setWaState] = useState({ status: 'checking', isReady: false, qrCode: null })
  const toast = useToast()

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

    checkWaStatus();
    // Poll every 3 seconds
    interval = setInterval(checkWaStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3001/api/wa/logout', { method: 'POST' });
      setWaState({ status: 'qr', isReady: false, qrCode: null });
      toast.info('Session WhatsApp diputuskan.');
    } catch(e) {
      toast.error('Gagal memutus server', 'Pastikan Bot Server menyala.');
    }
  };

  return (
    <div className="page-container animate-fade-in-up">
      <div className="page-header">
        <div className="page-title-group">
          <h1>Tautkan Perangkat (Bot WA)</h1>
          <p>Kelola koneksi nomor WhatsApp panitia untuk pengiriman tiket otomatis.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, marginTop: 20 }}>
        {/* Kolom Informasi & Status */}
        <div className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ 
              width: 50, height: 50, borderRadius: '50%', 
              background: waState.status === 'offline' ? 'var(--danger)' : waState.isReady ? 'var(--success)' : 'var(--warning)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' 
            }}>
              <Smartphone size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Status Koneksi Server</h3>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {waState.status === 'offline' ? 'Server Terputus' : waState.isReady ? 'Sedang Aktif' : 'Menunggu Login'}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-elevated)', padding: 20, borderRadius: 12 }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <ShieldAlert size={16} /> Cara Kerja Sistem Otomatis
            </h4>
            <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              <li>Sistem ini akan meminjam nomor WhatsApp yang sedang kalian "Tautkan" (Scan).</li>
              <li>Aplikasi web membutuhkan server lokal (`Mulai_Yamaha_Event.bat`) aktif di memori untuk mengirimnya.</li>
              <li>Tampilan QR akan disegarkan (*refresh*) otomatis jika kadaluwarsa.</li>
            </ul>
          </div>

          {waState.isReady && (
            <button onClick={handleLogout} className="btn danger" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, marginTop: 'auto' }}>
              <LogOut size={18} /> Putuskan Koneksi WA (Logout)
            </button>
          )}
        </div>

        {/* Kolom Scanner layaknya Web WhatsApp */}
        <div className="card" style={{ padding: 30, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, border: '2px dashed var(--border-color)', background: 'var(--bg-elevated)' }}>
          {waState.status === 'offline' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--danger)', marginBottom: 20 }}><RefreshCw size={64} /></div>
              <h2>Bot Server Terputus</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 10 }}>Sistem gagal mendeteksi sinyal lokal. Pastikan Anda telah menjalankan aplikasi menggunakan <b>`Mulai_Yamaha_Event.bat`</b> yang membangkitkan sinyal di port 3001.</p>
            </div>
          )}

          {waState.status === 'ready' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: 'var(--success)', marginBottom: 20 }}><CheckCircle size={80} /></div>
              <h2>Perangkat Terhubung Sempurna!</h2>
              <p style={{ color: 'var(--text-muted)', marginTop: 10 }}>Nomor penyelenggara yang digunakan saat scan tadi akan bertugas mengirim tiket setiap kali Anda mencentang tombol "Simpan & Auto-Kirim" di halaman pendaftaran peserta.</p>
            </div>
          )}

          {waState.status === 'qr' && (
            <div style={{ background: 'white', padding: 30, borderRadius: 20, boxShadow: '0 10px 30px rgba(0,0,0,0.1)', textAlign: 'center' }}>
              {waState.qrCode ? (
                <>
                  <h3 style={{ color: '#25D366', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 16 }}>
                    <MessageCircle size={20} /> Pindai Kode Berikut
                  </h3>
                  <img src={waState.qrCode} alt="WhatsApp QR" style={{ width: 260, height: 260, display: 'block', margin: '0 auto' }} />
                  <p style={{ fontSize: '0.8rem', color: '#666', marginTop: 16, maxWidth: 260 }}>1. Buka <b>WhatsApp</b> di Ponsel<br/>2. Ketuk <b>Titik Tiga</b> atau <b>Pengaturan</b><br/>3. Pilih <b>Perangkat Tertaut</b><br/>4. <b>Tautkan Perangkat</b> ke layar ini.</p>
                </>
              ) : (
                <div style={{ padding: 60 }}>
                  <RefreshCw size={40} className="animate-spin" style={{ color: '#ccc', margin: '0 auto 16px auto' }} />
                  <div style={{ color: '#888', fontWeight: 600 }}>Meracik QR Code baru...</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
