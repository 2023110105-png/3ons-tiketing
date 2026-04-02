import { useState, useEffect } from 'react'
import { 
  Activity, Users, CheckCircle, XCircle, 
  Clock, AlertTriangle, RefreshCw, BarChart 
} from 'lucide-react'
import { getTenantHealth } from '../../../store/mockData'

export default function TenantHealth() {
  const [healthData, setHealthData] = useState(getTenantHealth())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => {
      setHealthData(getTenantHealth())
      setIsRefreshing(false)
    }, 800)
  }

  useEffect(() => {
    const interval = setInterval(handleRefresh, 30000) // Auto refresh every 30s
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="tenant-health-container owner-fade-in-up">
      <div className="owner-toolbar">
        <div className="owner-card-title">🏥 Pantauan Kesehatan Sistem</div>
        <button className="btn btn-ghost" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw size={18} className={isRefreshing ? 'spinner' : ''} /> Segarkan Data
        </button>
      </div>

      <div className="grid-responsive mt-24">
        {healthData.map(health => (
          <div key={health.tenantId} className="card">
            <div className="card-pad">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <h3 className="card-title text-sm">{health.brandName}</h3>
                  <div className="flex items-center gap-4 text-xs text-muted mt-4">
                    {health.isOnline ? (
                      <span className="flex items-center gap-2 text-green font-bold">
                        <span className="pulse-dot"></span> ONLINE
                      </span>
                    ) : (
                      <span className="flex items-center gap-2 text-muted">
                        <Clock size={12} /> Terakhir aktif: {new Date(health.lastBackup).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className={`badge ${health.status === 'active' ? 'badge-green' : 'badge-yellow'}`}>
                  {health.status === 'active' ? 'AKTIF' : 'NONAKTIF'}
                </div>
              </div>

              <div className="grid-responsive gap-8 mt-16">
                <div className="bg-subtle p-12 rounded border border-color text-center">
                  <div className="text-xs text-muted font-bold mb-4">CHECK-IN</div>
                  <div className="text-xl font-bold flex justify-center items-center gap-4">
                    <CheckCircle size={16} className="text-green" />
                    {health.totalCheckins}
                  </div>
                </div>
                <div className="bg-subtle p-12 rounded border border-color text-center">
                  <div className="text-xs text-muted font-bold mb-4">PESERTA</div>
                  <div className="text-xl font-bold flex justify-center items-center gap-4">
                    <Users size={16} className="text-primary" />
                    {health.totalParticipants}
                  </div>
                </div>
              </div>

              <div className="mt-16 pt-16" style={{ borderTop: '1px solid var(--border-color)' }}>
                <div className="flex justify-between text-xs font-bold mb-8">
                  <span>PENGGUNAAN KUOTA</span>
                  <span className={health.usageParticipants > 90 ? 'text-red' : health.usageParticipants > 75 ? 'text-warning' : 'text-primary'}>
                    {health.usageParticipants}%
                  </span>
                </div>
                <div className="progress-bar-bg" style={{ height: '6px', background: 'var(--bg-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      className={`progress-bar-fill ${health.usageParticipants > 90 ? 'bg-danger' : health.usageParticipants > 75 ? 'bg-warning' : 'bg-primary'}`} 
                      style={{ height: '100%', width: `${Math.min(100, health.usageParticipants)}%` }}
                    ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-24" style={{ background: 'var(--card-bg)' }}>
        <div className="card-pad flex items-center gap-16">
          <div className="bg-primary p-12 rounded-full text-white">
            <Activity size={24} />
          </div>
          <div>
            <h4 className="font-bold">Status Sistem: Normal</h4>
            <p className="text-sm text-muted">Semua layanan antrean, pemindai, dan sinkronisasi berjalan normal. Data diperbarui secara otomatis.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
