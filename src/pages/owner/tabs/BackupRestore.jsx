import { useState, useMemo } from 'react'
import { 
  Database, RefreshCw, Download, Trash2, 
  Search, ShieldAlert, History, Archive, Clock 
} from 'lucide-react'
import { getStoreBackups, restoreStoreBackup, exportStoreBackup } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/AuthContext'

export default function BackupRestore() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  const [backups, setBackups] = useState(getStoreBackups())
  const [isRestoring, setIsRestoring] = useState(false)

  const handleRestore = (backup) => {
    const reason = window.prompt(`Konfirmasi Restore data dari ${new Date(backup.timestamp).toLocaleString()}? Masukkan alasan (min 15 karakter):`, 'Permintaan client untuk restore data')
    
    if (reason === null) return
    
    setIsRestoring(true)
    const result = restoreStoreBackup(backup.key, currentUser, reason)
    
    if (result.success) {
      toast.success('Sukses', 'Data berhasil direstore ke titik ini')
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
      toast.success('Sukses', 'Backup berhasil didownload')
    } else {
      toast.error('Gagal', result.error)
    }
  }

  const filteredBackups = useMemo(() => {
    return backups.filter(b => b.isValid)
  }, [backups])

  return (
    <div className="backup-restore-container owner-fade-in-up">
      <div className="owner-card-container" style={{ background: 'var(--info-bg)', borderColor: 'var(--info)' }}>
        <div className="card-pad flex gap-16 items-center">
          <div className="p-12 bg-primary rounded-full text-white">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h3 className="font-bold">Peringatan Keamanan</h3>
            <p className="text-sm text-muted">Aksi restore akan menimpa seluruh data AKTIF saat ini dengan data dari cadangan. Pastikan Anda melakukan backup manual sebelum melakukan restore.</p>
          </div>
        </div>
      </div>

      <div className="toolbar mb-16 flex justify-between items-center">
        <h3 className="card-title">Riwayat Cadangan Sistem (Auto-Snapshots)</h3>
        <button className="btn btn-ghost" onClick={() => setBackups(getStoreBackups())}>
          <RefreshCw size={18} /> Refresh List
        </button>
      </div>

      <div className="grid-responsive gap-16">
        {filteredBackups.length === 0 ? (
          <div className="card card-pad text-center col-span-2 p-48">
            <Archive size={48} className="text-muted mx-auto mb-16" />
            <p className="text-muted">Belum ada snapshot cadangan otomatis yang tersedia.</p>
          </div>
        ) : (
          filteredBackups.map(backup => (
            <div key={backup.key} className="card">
              <div className="card-pad">
                <div className="flex justify-between items-start mb-16">
                  <div>
                    <div className="flex items-center gap-8 mb-4">
                      <Database size={16} className="text-primary" />
                      <span className="font-bold">Snapshot {new Date(backup.timestamp).toLocaleDateString()}</span>
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
                      <span>Jumlah Event Terdeteksi:</span>
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
                    <RefreshCw size={14} className="mr-4" /> Restore Data
                  </button>
                  <button className="btn btn-ghost btn-sm" title="Download JSON" onClick={() => handleDownload(backup)}>
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
           <History size={18} className="text-muted" /> Audit Backup Terakhir
         </h4>
         <p className="text-xs text-muted">Sistem melakukan pencadangan otomatis setiap kali ada perubahan data signifikan di tingkat owner. Maksimal 3 snapshot terakhir disimpan secara lokal.</p>
      </div>
    </div>
  )
}
