import { useState, useMemo } from 'react'
import { 
  Bell, BellOff, CheckCircle, Clock, 
  Trash2, AlertTriangle, Info, Search 
} from 'lucide-react'
import { getOwnerNotifications, markNotificationRead } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'

export default function NotificationCenter() {
  const toast = useToast()
  const [notifications, setNotifications] = useState(getOwnerNotifications())
  const [searchQuery, setSearchQuery] = useState('')

  const handleMarkRead = (id) => {
    markNotificationRead(id)
    setNotifications(getOwnerNotifications())
  }

  const handleMarkAllRead = () => {
    notifications.forEach(n => !n.read && markNotificationRead(n.id))
    setNotifications(getOwnerNotifications())
    toast.success('Sukses', 'Semua notifikasi sudah ditandai dibaca')
  }

  const handleDelete = () => {
    // In real app, call a delete notification function
    toast.success('Dihapus', 'Notifikasi berhasil dihapus')
  }

  const filteredNotifs = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return notifications.filter(n => 
      !q || n.message.toLowerCase().includes(q)
    )
  }, [notifications, searchQuery])

  return (
    <div className="notification-center-container owner-fade-in-up">
      <div className="owner-toolbar">
         <div className="owner-toolbar-left flex-1">
            <div className="owner-search-input" style={{ maxWidth: '400px' }}>
              <Search size={16} />
              <input 
                className="owner-form-input" 
                placeholder="Cari notifikasi..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <span className="text-xs text-muted font-bold">Total: {notifications.length}</span>
         </div>
         <div className="owner-toolbar-right">
            <button className="btn btn-ghost text-primary" onClick={handleMarkAllRead}>
            Tandai Semua Sudah Dibaca
            </button>
         </div>
      </div>

      <div className="owner-grid-cols-1">
        {filteredNotifs.length === 0 ? (
          <div className="owner-empty-state">
             <BellOff size={48} className="text-muted mx-auto mb-16" />
             <p className="text-muted">Tidak ada notifikasi untuk saat ini.</p>
          </div>
        ) : (
          filteredNotifs.map(n => (
            <div 
              key={n.id} 
              className={`card notification-card ${!n.read ? 'border-primary unread-bg' : ''}`}
            >
              <div className="card-pad flex gap-12 p-16">
                 <div className={`p-8 rounded-full h-fit ${
                   n.type === 'expired' ? 'bg-red-light text-red' : 
                   n.type === 'quota_warning' ? 'bg-yellow-light text-yellow' : 
                   'bg-blue-light text-blue'
                 }`}>
                   {n.type === 'expired' ? <AlertTriangle size={18} /> : 
                    n.type === 'quota_warning' ? <Info size={18} /> : 
                    <Bell size={18} />}
                 </div>
                 <div style={{ flex: 1 }}>
                    <div className="flex justify-between items-start flex-wrap gap-8">
                       <p className={`text-sm flex-1 min-w-[200px] ${!n.read ? 'font-bold' : ''}`}>{n.message}</p>
                       <span className="text-xs text-muted flex items-center gap-4 whitespace-nowrap h-fit">
                          <Clock size={12} /> {new Date(n.created_at).toLocaleString('id-ID')}
                       </span>
                    </div>
                    <div className="mt-12 flex gap-8">
                       {!n.read && (
                          <button className="btn btn-ghost btn-sm text-xs px-8 h-24" onClick={() => handleMarkRead(n.id)}>
                            Tandai Dibaca
                          </button>
                       )}
                       <button className="btn btn-ghost btn-sm text-xs px-8 h-24 text-danger" onClick={() => handleDelete(n.id)}>
                         Hapus
                       </button>
                    </div>
                 </div>
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .unread-bg { background: aliceblue; }
        .bg-red-light { background: #fef2f2; }
        .bg-yellow-light { background: #fffbeb; }
        .bg-blue-light { background: #eff6ff; }
      `}</style>
    </div>
  )
}
