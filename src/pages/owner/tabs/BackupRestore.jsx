import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { 
  Database, RefreshCw, Download, Trash2, 
  Search, ShieldAlert, History, Archive, Clock 
} from 'lucide-react'

import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/useAuth'

export default function BackupRestore() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [backups, setBackups] = useState(getStoreBackups())
  const [isRestoring, setIsRestoring] = useState(false)

  const initialHydrationDoneRef = useRef(false)

  const runFirebaseHydrate = useCallback(async () => {
    if (typeof bootstrapStoreFromFirebase !== 'function') return
    try {
      await bootstrapStoreFromFirebase(true)
    } catch {
      // Keep owner UI responsive when Firebase hydrate is unavailable.
    }
  }, [])

  const refreshBackups = useCallback(async (forceFirebase = true) => {
    if (forceFirebase) {
      await runFirebaseHydrate()
    }
    setBackups(getStoreBackups())
  }, [runFirebaseHydrate])

  // Only hydrate once on initial mount, not on every render
  useEffect(() => {
    if (initialHydrationDoneRef.current) return
    initialHydrationDoneRef.current = true
    const timerId = window.setTimeout(() => {
      void refreshBackups(true)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [refreshBackups])

  const handleRestore = (backup) => {
    const reason = window.prompt(`Konfirmasi pemulihan data dari ${new Date(backup.timestamp).toLocaleString()}? Masukkan alasan (min 15 karakter):`, 'Permintaan klien untuk pemulihan data')
    
    if (reason === null) return
    
    setIsRestoring(true)
    const result = restoreStoreBackup(backup.key, currentUser, reason)
    
    if (result.success) {
      toast.success('Sukses', 'Data berhasil dipulihkan ke kondisi ini')
      setTimeout(() => window.location.reload(), 1500)
    } else {
      toast.error('Gagal', result.error)
      setIsRestoring(false)
    }
  }

  const handleDownload = (backup) => {
    const result = exportStoreBackup(backup.key)
    if (result.success) {
      const blob = new Blob([result.content], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Sukses', 'Cadangan berhasil diunduh')
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const filteredBackups = useMemo(() => {
    return backups.filter(b => b.isValid)
  }, [backups])

  return (
    <div className="backup-restore-container owner-fade-in-up">
      <div className="owner-tab-intro">
        <span className="page-kicker">Cadangan data</span>
        <h2>Pulihan &amp; unduhan snapshot</h2>
        <p>Cadangan lokal mewakili snapshot store pada titik waktu tertentu. Pemulihan akan mengganti data aktif di browser ini—lakukan hanya setelah konfirmasi.</p>
      </div>
      <div className="owner-card-container" style={{ background: 'var(--info-bg)', borderColor: 'var(--info)' }}>
        <div className="card-pad flex gap-16 items-center">
          <div className="p-12 bg-primary rounded-full text-white">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 className="font-bold">Peringatan Keamanan</h3>
            <p className="text-sm text-muted">Aksi pemulihan akan mengganti seluruh data aktif saat ini dengan data cadangan. Pastikan Anda menyimpan cadangan terbaru sebelum melanjutkan.</p>
          </div>
        </div>
      </div>

      <div className="toolbar mb-16 flex justify-between items-center">
        <h3 className="card-title">Riwayat Cadangan Sistem</h3>
        <button className="btn btn-ghost" onClick={() => { void refreshBackups(true) }}>
          <RefreshCw size={18} /> Muat Ulang Daftar
        </button>
      </div>

      <div className="grid-responsive gap-16">
        {filteredBackups.length === 0 ? (
          <div className="card card-pad text-center col-span-2 p-48">
            <Archive size={48} className="text-muted mx-auto mb-16" />
            <p className="text-muted">Belum ada cadangan otomatis yang tersedia.</p>
          </div>
        ) : (
          filteredBackups.map(backup => (
            <div key={backup.key} className="card">
              <div className="card-pad">
                <div className="flex justify-between items-start mb-16">
                  <div>
                    <div className="flex items-center gap-8 mb-4">
                      <Database size={16} className="text-primary" />
                      <span className="font-bold">Cadangan {new Date(backup.timestamp).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-muted flex items-center gap-4">
                      <Clock size={12} /> {new Date(backup.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="badge badge-blue">
                    {(backup.size / 1024).toFixed(1)} KB
                  </div>
                </div>

                <div className="bg-subtle p-12 rounded mb-16 text-xs text-muted">
                   <div className="flex justify-between mb-4">
                      <span>Jumlah Acara Terdeteksi:</span>
                      <span className="font-bold text-primary">{backup.eventCount}</span>
                   </div>
                   <div className="flex justify-between">
                      <span>Integritas File:</span>
                      <span className="text-green font-bold">Terverifikasi</span>
                   </div>
                </div>

                <div className="actions flex gap-8">
                  <button 
                    className="btn btn-primary btn-sm flex-1" 
                    onClick={() => handleRestore(backup)}
                    disabled={isRestoring}
                  >
                    <RefreshCw size={14} className="mr-4" /> Pulihkan Data
                  </button>
                  <button className="btn btn-ghost btn-sm" title="Unduh Berkas Data" onClick={() => handleDownload(backup)}>
                    <Download size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-24 p-24 bg-white rounded border border-color">
         <h4 className="font-bold mb-8 flex items-center gap-8">
           <History size={18} className="text-muted" /> Riwayat Cadangan Terakhir
         </h4>
        <p className="text-xs text-muted">Sistem membuat cadangan otomatis setiap ada perubahan data penting di panel pemilik. Maksimal 3 cadangan terakhir disimpan di perangkat ini.</p>
      </div>
    </div>
  )
}
