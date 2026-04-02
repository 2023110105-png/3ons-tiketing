import { useState, useEffect } from 'react'
import { MessageCircle, CheckCircle, RefreshCw, Smartphone, LogOut, ShieldAlert } from 'lucide-react'
import { useToast } from '../../contexts/ToastContext'
import { apiFetch } from '../../utils/api'

export default function ConnectDevice() {
  const [waState, setWaState] = useState({ status: 'checking', isReady: false, qrCode: null })
  const toast = useToast()
  const statusTone = waState.status === 'offline' ? 'offline' : waState.isReady ? 'ready' : 'pending'

  useEffect(() => {
    let interval;
    
    const checkWaStatus = async () => {
      try {
        const res = await apiFetch('/api/wa/status');
        const data = await res.json();
        setWaState(data);
      } catch {
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
      await apiFetch('/api/wa/logout', { method: 'POST' });
      setWaState({ status: 'qr', isReady: false, qrCode: null });
      toast.info('Session WhatsApp diputuskan.');
    } catch {
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

      <div className="admin-grid-2">
        {/* Kolom Informasi & Status */}
        <div className="card admin-panel">
          <div className="status-head">
            <div className={`status-bubble ${statusTone}`}>
              <Smartphone size={24} />
            </div>
            <div>
              <h3 className="status-title">Status Koneksi Server</h3>
              <div className="status-subtitle">
                {waState.status === 'offline' ? 'Server Terputus' : waState.isReady ? 'Sedang Aktif' : 'Menunggu Login'}
              </div>
            </div>
          </div>

          <div className="admin-note">
            <h4 className="admin-note-title">
              <ShieldAlert size={16} /> Cara Kerja Sistem Otomatis
            </h4>
            <ul className="admin-note-list">
              <li>Sistem ini akan meminjam nomor WhatsApp yang sedang kalian "Tautkan" (Scan).</li>
              <li>Aplikasi web membutuhkan server lokal (`Mulai_Event_Platform.bat`) aktif di memori untuk mengirimnya.</li>
              <li>Tampilan QR akan disegarkan (*refresh*) otomatis jika kadaluwarsa.</li>
            </ul>
          </div>

          {waState.isReady && (
            <button onClick={handleLogout} className="btn btn-danger admin-full-btn">
              <LogOut size={18} /> Putuskan Koneksi WA (Logout)
            </button>
          )}
        </div>

        {/* Kolom Scanner layaknya Web WhatsApp */}
        <div className="card admin-qr-shell">
          {waState.status === 'offline' && (
            <div className="admin-center">
              <div className="status-icon-danger"><RefreshCw size={64} /></div>
              <h2>Bot Server Terputus</h2>
              <p className="status-note">Sistem gagal mendeteksi server bot. Pastikan backend WhatsApp berjalan di URL yang diatur lewat <b>VITE_API_BASE_URL</b> atau, saat development lokal, lewat proxy Vite ke port 3001.</p>
            </div>
          )}

          {waState.status === 'ready' && (
            <div className="admin-center">
              <div className="status-icon-success"><CheckCircle size={80} /></div>
              <h2>Perangkat Terhubung Sempurna!</h2>
              <p className="status-note">Nomor penyelenggara yang digunakan saat scan tadi akan bertugas mengirim tiket setiap kali Anda mencentang tombol "Simpan & Auto-Kirim" di halaman pendaftaran peserta.</p>
            </div>
          )}

          {waState.status === 'qr' && (
            <div className="wa-qr-box">
              {waState.qrCode ? (
                <>
                  <h3 className="wa-qr-title">
                    <MessageCircle size={20} /> Pindai Kode Berikut
                  </h3>
                  <img src={waState.qrCode} alt="WhatsApp QR" className="wa-qr-image" />
                  <p className="wa-qr-help">1. Buka <b>WhatsApp</b> di Ponsel<br/>2. Ketuk <b>Titik Tiga</b> atau <b>Pengaturan</b><br/>3. Pilih <b>Perangkat Tertaut</b><br/>4. <b>Tautkan Perangkat</b> ke layar ini.</p>
                </>
              ) : (
                <div className="wa-qr-loading">
                  <RefreshCw size={40} className="animate-spin qr-spinner" />
                  <div className="wa-qr-loading-text">Meracik QR Code baru...</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
