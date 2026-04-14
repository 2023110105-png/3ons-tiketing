import { Building2, Users, CheckCircle, AlertTriangle } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function AdminOverview() {
  const stats = {
    tenants: 1,
    totalUsers: 3,
    activeEvents: 1,
    totalParticipants: 217,
    checkedIn: 212,
    systemStatus: 'healthy'
  }

  return (
    <div className="admin-overview">
      {/* Stats Grid */}
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon blue"><Building2 size={24} /></div>
          <div className="admin-stat-info">
            <h4>{stats.tenants}</h4>
            <p>Active Tenants</p>
          </div>
        </div>
        
        <div className="admin-stat-card">
          <div className="admin-stat-icon green"><Users size={24} /></div>
          <div className="admin-stat-info">
            <h4>{stats.totalUsers}</h4>
            <p>Total Users</p>
          </div>
        </div>
        
        <div className="admin-stat-card">
          <div className="admin-stat-icon purple"><CheckCircle size={24} /></div>
          <div className="admin-stat-info">
            <h4>{stats.totalParticipants}</h4>
            <p>Total Participants</p>
          </div>
        </div>
        
        <div className="admin-stat-card">
          <div className="admin-stat-icon orange"><AlertTriangle size={24} /></div>
          <div className="admin-stat-info">
            <h4>{stats.checkedIn}</h4>
            <p>Checked In</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="admin-section">
        <div className="owner-section-subheader">
          <span className="owner-section-kicker">Navigasi</span>
          <h3 className="owner-section-title-sm">Aksi Cepat</h3>
        </div>
        <div className="admin-actions">
          <Link to="/admin-panel/tenants" className="admin-action-btn">
            <div className="admin-action-content">
              <Building2 size={20} />
              <span>Manage Tenants</span>
            </div>
          </Link>
          <Link to="/admin-panel/audit" className="admin-action-btn">
            <div className="admin-action-content">
              <CheckCircle size={20} />
              <span>View Audit Logs</span>
            </div>
          </Link>
          <Link to="/admin-panel/system" className="admin-action-btn">
            <div className="admin-action-content">
              <AlertTriangle size={20} />
              <span>System Health</span>
            </div>
          </Link>
        </div>
      </div>

      {/* System Status */}
      <div className="admin-section">
        <div className="owner-section-subheader">
          <span className="owner-section-kicker">Monitoring</span>
          <h3 className="owner-section-title-sm">Status Sistem</h3>
        </div>
        <div className="admin-status-card">
          <div className={`admin-status-indicator ${stats.systemStatus}`}>
            <span className="admin-status-dot"></span>
            <span className="admin-status-text">
              {stats.systemStatus === 'healthy' ? 'All Systems Operational' : 'Issues Detected'}
            </span>
          </div>
          <div className="admin-status-details">
            <p>Supabase: Connected</p>
            <p>Last sync: Just now</p>
          </div>
        </div>
      </div>
    </div>
  )
}
