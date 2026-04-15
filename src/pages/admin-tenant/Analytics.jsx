// ===== IMPORT SHARED UTILITIES =====
// Using tenantUtils.js to avoid function duplication across pages
import {
  bootstrapStoreFromServer,
  getParticipants,
  getCheckInLogs,
  getAvailableDays,
  getCurrentDay
} from '../../lib/tenantUtils';

// Local subscription unsubscribe function
let _unsubscribeRealtime = null;

function getAnalyticsData(day) {
  const participants = getParticipants(day);
  const logs = getCheckInLogs(day);
  const checkedInTicketIds = new Set(logs.map(log => log.ticket_id));
  
  // Stats by category
  const byCategory = {};
  participants.forEach(p => {
    const cat = p.category || 'Regular';
    if (!byCategory[cat]) {
      byCategory[cat] = { total: 0, checkedIn: 0, percentage: 0 };
    }
    byCategory[cat].total++;
    if (checkedInTicketIds.has(p.ticket_id)) {
      byCategory[cat].checkedIn++;
    }
  });
  
  // Calculate percentages
  Object.keys(byCategory).forEach(cat => {
    const c = byCategory[cat];
    c.percentage = c.total > 0 ? Math.round((c.checkedIn / c.total) * 100) : 0;
  });
  
  // Hourly heatmap data
  const hourlyData = Array(24).fill(0).map((_, hour) => ({
    hour,
    count: 0,
    label: `${hour.toString().padStart(2, '0')}:00`
  }));
  
  logs.forEach(log => {
    const timestamp = new Date(log.timestamp);
    const hour = timestamp.getHours();
    if (hourlyData[hour]) {
      hourlyData[hour].count++;
    }
  });
  
  // Peak hours (top 5)
  const peakHours = [...hourlyData]
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  // Trend (check-ins per 30 min intervals for last 6 hours)
  const now = new Date();
  const trendData = [];
  for (let i = 11; i >= 0; i--) {
    const intervalStart = new Date(now - i * 30 * 60 * 1000);
    const intervalEnd = new Date(intervalStart.getTime() + 30 * 60 * 1000);
    const count = logs.filter(log => {
      const t = new Date(log.timestamp);
      return t >= intervalStart && t < intervalEnd;
    }).length;
    
    trendData.push({
      time: intervalStart.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      count,
      fullTime: intervalStart
    });
  }
  
  // Summary stats
  const total = participants.length;
  const checkedIn = checkedInTicketIds.size;
  const notCheckedIn = total - checkedIn;
  const percentage = total > 0 ? Math.round((checkedIn / total) * 100) : 0;
  
  // Estimated completion time (based on average check-in rate)
  const avgRate = trendData.reduce((sum, d) => sum + d.count, 0) / trendData.length || 0;
  const remaining = notCheckedIn;
  const estimatedMinutes = avgRate > 0 ? Math.round(remaining / avgRate * 30) : 0;
  
  return {
    summary: {
      total,
      checkedIn,
      notCheckedIn,
      percentage,
      estimatedMinutes,
      avgRate: Math.round(avgRate * 10) / 10
    },
    byCategory,
    hourlyData,
    peakHours,
    trendData,
    recentLogs: logs.slice(-10).reverse()
  };
}

import { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { 
  Users, UserCheck, Clock, TrendingUp, Activity, Target, 
  Calendar, BarChart3, Download, RefreshCw, AlertCircle
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { exportToCSV } from '../../utils/csvExport';
import { analyticsStyles, analyticsAnimations } from './AnalyticsStyles';

const CATEGORY_COLORS = {
  VIP: '#e84040',
  Dealer: '#4da6e8',
  Media: '#f5c800',
  Regular: '#2eab6e'
};

// StatCard component di luar render function
function StatCard({ icon, title, value, subtext, color = 'blue', trend = null }) {
  const Icon = icon
  return (
    <div className="analytics-card" style={{ borderTop: `3px solid var(--brand-${color})` }}>
      <div className="analytics-card-header">
        <div className={`analytics-icon bg-${color}`}>
          <Icon size={20} />
        </div>
        <span className="analytics-card-title">{title}</span>
      </div>
      <div className="analytics-card-value">{value}</div>
      {trend !== null && (
        <div className={`analytics-trend ${trend >= 0 ? 'up' : 'down'}`}>
          <TrendingUp size={14} />
          {trend > 0 ? '+' : ''}{trend}%
        </div>
      )}
      <div className="analytics-card-subtext">{subtext}</div>
    </div>
  );
}

export default function Analytics() {
  const [selectedDay, setSelectedDay] = useState(getCurrentDay());
  const [availableDays, setAvailableDays] = useState(getAvailableDays());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const toast = useToast();
  
  const data = useMemo(() => {
    return getAnalyticsData(selectedDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, refreshKey]);
  
  const refreshData = async () => {
    setIsLoading(true);
    await bootstrapStoreFromServer(true);
    setRefreshKey(k => k + 1);
    setLastUpdated(new Date());
    setAvailableDays(getAvailableDays());
    setIsLoading(false);
    toast.success('Data diperbarui', 'Analitik berhasil di-refresh');
  };
  
  useEffect(() => {
    const load = async () => {
      await bootstrapStoreFromServer();
      setRefreshKey(k => k + 1);
      setAvailableDays(getAvailableDays());
    };
    load();
    
    // Auto-refresh setiap 10 detik
    const interval = setInterval(async () => {
      await bootstrapStoreFromServer(true);
      setRefreshKey(k => k + 1);
      setLastUpdated(new Date());
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);
  
  const handleExport = () => {
    const exportData = [
      ['Kategori', 'Total', 'Hadir', 'Persentase'],
      ...Object.entries(data.byCategory).map(([cat, stats]) => [
        cat, stats.total, stats.checkedIn, `${stats.percentage}%`
      ]),
      ['', '', '', ''],
      ['Ringkasan', '', '', ''],
      ['Total Peserta', data.summary.total, '', ''],
      ['Sudah Check-in', data.summary.checkedIn, '', `${data.summary.percentage}%`],
      ['Belum Check-in', data.summary.notCheckedIn, '', '']
    ];
    
    exportToCSV(exportData, `Analytics_Hari${selectedDay}_${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Export berhasil', 'File analitik telah diunduh');
  };
  
  return (
    <div className="page-container analytics-page" style={analyticsStyles.pageContainer}>
      <div className="page-header" style={analyticsStyles.pageHeader}>
        <span className="page-kicker" style={analyticsStyles.pageKicker}>Analitik</span>
        <h1 style={analyticsStyles.pageTitle}>Dashboard Analitik Event</h1>
        <p style={analyticsStyles.pageSubtitle}>Monitor kehadiran real-time, analisis tren, dan perkiraan waktu penyelesaian.</p>
        
        <div className="analytics-header-actions">
          <select 
            className="form-select" 
            value={selectedDay} 
            onChange={(e) => setSelectedDay(Number(e.target.value))}
          >
            {availableDays.map(day => (
              <option key={day} value={day}>Hari {day}</option>
            ))}
          </select>
          
          <button className="btn btn-secondary" onClick={refreshData} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
            Refresh
          </button>
          
          <button className="btn btn-primary" onClick={handleExport}>
            <Download size={16} />
            Export CSV
          </button>
        </div>
        
        <div className="analytics-last-updated">
          Terakhir diperbarui: {lastUpdated.toLocaleTimeString('id-ID')}
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="analytics-grid-4">
        <StatCard 
          icon={Users}
          title="Total Peserta"
          value={data.summary.total.toLocaleString()}
          subtext="Terdaftar untuk hari ini"
          color="blue"
        />
        <StatCard 
          icon={UserCheck}
          title="Sudah Hadir"
          value={data.summary.checkedIn.toLocaleString()}
          subtext={`${data.summary.percentage}% dari total`}
          color="green"
          trend={data.summary.percentage}
        />
        <StatCard 
          icon={Target}
          title="Belum Hadir"
          value={data.summary.notCheckedIn.toLocaleString()}
          subtext={`Estimasi ${data.summary.estimatedMinutes} menit lagi`}
          color="yellow"
        />
        <StatCard 
          icon={Activity}
          title="Rate Check-in"
          value={`${data.summary.avgRate}/30min`}
          subtext="Rata-rata per 30 menit"
          color="pink"
        />
      </div>
      
      {/* Main Charts Row */}
      <div className="analytics-grid-2">
        {/* Trend Chart */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <TrendingUp size={18} />
            <h3>Tren Check-in (6 Jam Terakhir)</h3>
          </div>
          <div className="analytics-chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.trendData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e84040" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#e84040" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d4" />
                <XAxis dataKey="time" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip 
                  contentStyle={{background: 'white', border: '1px solid #e4e0d4', borderRadius: 8}}
                  labelStyle={{color: '#1a1a1a', fontWeight: 600}}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#e84040" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
        {/* Category Breakdown */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <BarChart3 size={18} />
            <h3>Distribusi per Kategori</h3>
          </div>
          <div className="analytics-chart-body">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={Object.entries(data.byCategory).map(([name, stats]) => ({ name, ...stats }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e0d4" />
                <XAxis dataKey="name" tick={{fontSize: 11}} />
                <YAxis tick={{fontSize: 11}} />
                <Tooltip 
                  contentStyle={{background: 'white', border: '1px solid #e4e0d4', borderRadius: 8}}
                />
                <Bar dataKey="total" fill="#e4e0d4" radius={[4, 4, 0, 0]} name="Total" />
                <Bar dataKey="checkedIn" fill="#e84040" radius={[4, 4, 0, 0]} name="Hadir" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Heatmap Row */}
      <div className="analytics-grid-2">
        {/* Hourly Heatmap */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <Clock size={18} />
            <h3>Heatmap Jam Check-in</h3>
          </div>
          <div className="analytics-heatmap">
            {data.hourlyData.map((hour, idx) => (
              <div 
                key={idx} 
                className="analytics-heatmap-cell"
                style={{
                  backgroundColor: hour.count > 0 
                    ? `rgba(232, 64, 64, ${Math.min(0.1 + hour.count * 0.15, 1)})`
                    : 'transparent',
                  border: hour.count > 0 ? '1px solid rgba(232, 64, 64, 0.3)' : '1px solid #e4e0d4'
                }}
                title={`${hour.label}: ${hour.count} check-in`}
              >
                <span className="analytics-heatmap-hour">{hour.hour}</span>
                <span className="analytics-heatmap-count">{hour.count > 0 ? hour.count : ''}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Peak Hours & Recent Activity */}
        <div className="analytics-chart-card">
          <div className="analytics-chart-header">
            <Activity size={18} />
            <h3>Jam Sibuk & Aktivitas Terbaru</h3>
          </div>
          
          <div className="analytics-section">
            <h4 className="analytics-subtitle">Top 5 Jam Sibuk</h4>
            <div className="analytics-peak-list">
              {data.peakHours.length > 0 ? data.peakHours.map((peak, idx) => (
                <div key={idx} className="analytics-peak-item">
                  <span className="analytics-peak-rank">#{idx + 1}</span>
                  <span className="analytics-peak-time">{peak.label}</span>
                  <span className="analytics-peak-count">{peak.count} check-in</span>
                  <div className="analytics-peak-bar" style={{width: `${Math.min(peak.count * 10, 100)}%`}} />
                </div>
              )) : (
                <p className="analytics-empty">Belum ada data check-in</p>
              )}
            </div>
          </div>
          
          <div className="analytics-section">
            <h4 className="analytics-subtitle">10 Check-in Terakhir</h4>
            <div className="analytics-recent-list">
              {data.recentLogs.map((log, idx) => (
                <div key={idx} className="analytics-recent-item">
                  <span className="analytics-recent-name">{log.participant_name || log.ticket_id}</span>
                  <span className="analytics-recent-time">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Category Detail Table */}
      <div className="analytics-table-card">
        <div className="analytics-chart-header">
          <Users size={18} />
          <h3>Detail per Kategori</h3>
        </div>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Total</th>
              <th>Hadir</th>
              <th>Belum</th>
              <th>Persentase</th>
              <th>Progress</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(data.byCategory).map(([cat, stats]) => (
              <tr key={cat}>
                <td>
                  <span className={`analytics-badge badge-${cat.toLowerCase()}`}>{cat}</span>
                </td>
                <td>{stats.total}</td>
                <td className="text-green">{stats.checkedIn}</td>
                <td className="text-muted">{stats.total - stats.checkedIn}</td>
                <td>{stats.percentage}%</td>
                <td>
                  <div className="analytics-progress-bar">
                    <div 
                      className="analytics-progress-fill" 
                      style={{width: `${stats.percentage}%`, background: CATEGORY_COLORS[cat] || '#2eab6e'}}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* v2.0 Styles */}
      <style>{analyticsAnimations}</style>
    </div>
  );
}
