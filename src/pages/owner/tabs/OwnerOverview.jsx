import { Building2, Users, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'

export default function OwnerOverview({ onNavigate }) {
  const stats = {
    tenants: 1,
    totalUsers: 3,
    activeEvents: 1,
    totalParticipants: 217,
    checkedIn: 212,
    systemStatus: 'healthy'
  }

  return (
    <div className="owner-overview">
      {/* Stats Grid */}
      <div className="owner-stats-grid">
        <div className="owner-stat-card">
          <div className="owner-stat-icon blue"><Building2 size={24} /></div>
          <div className="owner-stat-value">{stats.tenants}</div>
          <div className="owner-stat-label">Active Tenants</div>
        </div>
        
        <div className="owner-stat-card">
          <div className="owner-stat-icon green"><Users size={24} /></div>
          <div className="owner-stat-value">{stats.totalUsers}</div>
          <div className="owner-stat-label">Total Users</div>
        </div>
        
        <div className="owner-stat-card">
          <div className="owner-stat-icon purple"><CheckCircle size={24} /></div>
          <div className="owner-stat-value">{stats.totalParticipants}</div>
          <div className="owner-stat-label">Total Participants</div>
        </div>
        
        <div className="owner-stat-card">
          <div className="owner-stat-icon orange"><AlertTriangle size={24} /></div>
          <div className="owner-stat-value">{stats.checkedIn}</div>
          <div className="owner-stat-label">Checked In</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="owner-section">
        <h3>Quick Actions</h3>
        <div className="owner-actions">
          <button className="owner-action-btn" onClick={() => onNavigate('tenants')}>
            <Building2 size={18} />
            <span>Manage Tenants</span>
            <ArrowRight size={16} />
          </button>
          <button className="owner-action-btn" onClick={() => onNavigate('audit')}>
            <CheckCircle size={18} />
            <span>View Audit Logs</span>
            <ArrowRight size={16} />
          </button>
          <button className="owner-action-btn" onClick={() => onNavigate('system')}>
            <AlertTriangle size={18} />
            <span>System Health</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* System Status */}
      <div className="owner-section">
        <h3>System Status</h3>
        <div className="owner-status-card">
          <div className={`owner-status-indicator ${stats.systemStatus}`}>
            <span className="owner-status-dot"></span>
            <span className="owner-status-text">
              {stats.systemStatus === 'healthy' ? 'All Systems Operational' : 'Issues Detected'}
            </span>
          </div>
          <div className="owner-status-details">
            <p>Supabase: Connected</p>
            <p>Last sync: Just now</p>
          </div>
        </div>
      </div>
    </div>
  )
}
