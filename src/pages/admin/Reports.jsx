import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { getStats, getCheckInLogs, getParticipants, getCurrentDay, getPeakHours, getAvailableDays, getAdminLogs } from '../../store/mockData'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { useToast } from '../../contexts/ToastContext'
import { exportToCSV, exportLogsToCSV, exportAdminLogsToCSV } from '../../utils/csvExport'
import { FileText, FileSpreadsheet, ClipboardList, Users, UserCheck, UserX, TrendingUp, CheckCircle, Activity, ShieldAlert, Search } from 'lucide-react'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

export default function Reports() {
  const [dayFilter, setDayFilter] = useState(getCurrentDay())
  const [availableDays, setAvailableDays] = useState(getAvailableDays())
  const [auditActorFilter, setAuditActorFilter] = useState('all')
  const [auditDateFrom, setAuditDateFrom] = useState('')
  const [auditDateTo, setAuditDateTo] = useState('')
  const [auditSearch, setAuditSearch] = useState('')
  const stats = getStats(dayFilter)
  const logs = getCheckInLogs(dayFilter)
  const adminLogs = getAdminLogs(300)
  const participants = getParticipants(dayFilter)
  const peakData = getPeakHours(dayFilter)
  const toast = useToast()

  const getAuditSeverity = (action) => {
    const highImpact = ['participants_delete_all', 'checkin_reset', 'participant_delete']
    const mediumImpact = ['current_day_update', 'wa_template_update']
    if (highImpact.includes(action)) return 'high'
    if (mediumImpact.includes(action)) return 'medium'
    return 'low'
  }

  const severityBadgeClass = {
    high: 'badge-red',
    medium: 'badge-yellow',
    low: 'badge-gray'
  }

  const normalizedSearch = auditSearch.toLowerCase().trim()
  const enrichedAdminLogs = adminLogs.map(log => ({ ...log, severity: getAuditSeverity(log.action) }))
  const auditActorOptions = [...new Set(enrichedAdminLogs.map(log => log.actor).filter(Boolean))].sort()
  const filteredAdminLogs = enrichedAdminLogs.filter(log => {
    if (auditActorFilter !== 'all' && log.actor !== auditActorFilter) return false

    const time = new Date(log.timestamp).getTime()
    if (auditDateFrom) {
      const fromTime = new Date(`${auditDateFrom}T00:00:00`).getTime()
      if (time < fromTime) return false
    }
    if (auditDateTo) {
      const toTime = new Date(`${auditDateTo}T23:59:59`).getTime()
      if (time > toTime) return false
    }
    if (normalizedSearch) {
      const haystack = `${log.description} ${log.action} ${log.actor}`.toLowerCase()
      if (!haystack.includes(normalizedSearch)) return false
    }
    return true
  })

  useEffect(() => {
    setAvailableDays(getAvailableDays())
  }, [dayFilter])

  const exportPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      
      const doc = new jsPDF()
      
      // Header
      doc.setFontSize(20)
      doc.setFont(undefined, 'bold')
      doc.text('3ONS PROJECT', 105, 20, { align: 'center' })
      doc.setFontSize(14)
      doc.text(`Laporan Kehadiran - Hari ${dayFilter}`, 105, 30, { align: 'center' })
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(`Digenerate: ${new Date().toLocaleString('id-ID')}`, 105, 38, { align: 'center' })

      // Stats
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('Ringkasan', 14, 52)
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      doc.text(`Total Peserta: ${stats.total}`, 14, 60)
      doc.text(`Sudah Check-in: ${stats.checkedIn} (${stats.percentage}%)`, 14, 67)
      doc.text(`Belum Hadir: ${stats.notCheckedIn}`, 14, 74)

      // Category breakdown
      doc.setFont(undefined, 'bold')
      doc.text('Per Kategori:', 14, 84)
      doc.setFont(undefined, 'normal')
      let y = 91
      Object.entries(stats.byCategory).forEach(([cat, data]) => {
        doc.text(`${cat}: ${data.checkedIn}/${data.total} hadir`, 20, y)
        y += 7
      })

      // Participants table
      y += 5
      doc.setFont(undefined, 'bold')
      doc.setFontSize(12)
      doc.text('Daftar Peserta', 14, y)
      
      autoTable(doc, {
        startY: y + 5,
        head: [['No', 'Ticket ID', 'Nama', 'Kategori', 'Status', 'Waktu Check-in']],
        body: participants.map((p, i) => [
          i + 1,
          p.ticket_id,
          p.name,
          p.category,
          p.is_checked_in ? 'Hadir' : 'Belum',
          p.checked_in_at ? new Date(p.checked_in_at).toLocaleTimeString('id-ID') : '-'
        ]),
        theme: 'grid',
        headStyles: { fillColor: [230, 0, 18], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        styles: { fontSize: 8, cellPadding: 3 }
      })

      doc.save(`Laporan_Kehadiran_Hari_${dayFilter}_3ONS_Project.pdf`)
      toast.success('PDF Exported', 'Laporan kehadiran berhasil didownload')
    } catch (err) {
      console.error(err)
      toast.error('Error', 'Gagal export PDF')
    }
  }

  const exportAuditPDF = async () => {
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc = new jsPDF()
      doc.setFontSize(18)
      doc.setFont(undefined, 'bold')
      doc.text('AUDIT LOG ADMIN', 105, 18, { align: 'center' })
      doc.setFontSize(11)
      doc.setFont(undefined, 'normal')
      doc.text(`Digenerate: ${new Date().toLocaleString('id-ID')}`, 105, 26, { align: 'center' })

      const actorLabel = auditActorFilter === 'all' ? 'Semua Actor' : auditActorFilter
      const rangeLabel = `${auditDateFrom || '-'} s/d ${auditDateTo || '-'}`
      doc.text(`Filter Actor: ${actorLabel}`, 14, 36)
      doc.text(`Filter Tanggal: ${rangeLabel}`, 14, 43)
      doc.text(`Total Data: ${filteredAdminLogs.length}`, 14, 50)

      autoTable(doc, {
        startY: 56,
        head: [['No', 'Waktu', 'Actor', 'Severity', 'Aksi', 'Deskripsi']],
        body: filteredAdminLogs.map((log, i) => [
          i + 1,
          new Date(log.timestamp).toLocaleString('id-ID'),
          log.actor || '-',
          log.severity,
          log.action,
          log.description
        ]),
        theme: 'grid',
        headStyles: { fillColor: [245, 158, 11], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 3 }
      })

      doc.save('Audit_Log_Admin_3ONS_Project.pdf')
      toast.success('PDF Exported', 'Audit log admin berhasil didownload')
    } catch (err) {
      console.error(err)
      toast.error('Error', 'Gagal export PDF audit')
    }
  }

  // Bar chart - category comparison
  const barData = {
    labels: Object.keys(stats.byCategory),
    datasets: [
      {
        label: 'Total',
        data: Object.values(stats.byCategory).map(c => c.total),
        backgroundColor: 'rgba(230, 0, 18, 0.3)',
        borderColor: '#E60012',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Hadir',
        data: Object.values(stats.byCategory).map(c => c.checkedIn),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: '#10B981',
        borderWidth: 1,
        borderRadius: 6,
      }
    ]
  }

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: '#9CA3AF', usePointStyle: true, padding: 16 } },
      tooltip: {
        backgroundColor: 'rgba(22, 22, 31, 0.95)',
        titleColor: '#F0F0F5',
        bodyColor: '#9CA3AF',
        borderColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      }
    },
    scales: {
      x: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6B7280' }
      },
      y: {
        grid: { color: 'rgba(255,255,255,0.04)' },
        ticks: { color: '#6B7280' },
        beginAtZero: true
      }
    }
  }

  // Attendance doughnut
  const attendanceData = {
    labels: ['Hadir', 'Belum'],
    datasets: [{
      data: [stats.checkedIn, stats.notCheckedIn],
      backgroundColor: ['#10B981', 'rgba(107, 114, 128, 0.3)'],
      borderWidth: 0,
      spacing: 3,
      borderRadius: 4,
    }]
  }

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: { color: '#9CA3AF', padding: 16, usePointStyle: true, font: { size: 12 } }
      }
    }
  }

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])

  // ===== MOBILE REPORTS =====
  if (isMobile) {
    return (
      <div className="page-container">
        <div className="m-section-header" style={{ marginBottom: 12 }}>
          <div>
            <h1 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', fontWeight: 800 }}>Laporan</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hari {dayFilter}</p>
          </div>
          <select className="m-filter-select" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
            {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
          </select>
        </div>

        {/* Mobile Stats */}
        <div className="m-hero-card">
          <div className="m-hero-counter">
            <span className="m-hero-num">{stats.checkedIn}</span>
            <span className="m-hero-divider">/</span>
            <span className="m-hero-total">{stats.total}</span>
          </div>
          <div className="m-hero-label">Peserta Hadir ({stats.percentage}%)</div>
          <div className="m-hero-bar">
            <div className="m-hero-bar-fill" style={{ width: `${stats.percentage}%` }}></div>
          </div>
        </div>

        {/* Mobile Category Breakdown */}
        <div className="m-chips-row" style={{ marginBottom: 16 }}>
          {Object.entries(stats.byCategory).map(([cat, data]) => (
            <div key={cat} className={`m-chip m-chip-${cat.toLowerCase()}`}>
              <span className="m-chip-num">{data.checkedIn}/{data.total}</span>
              <span className="m-chip-label">{cat}</span>
            </div>
          ))}
        </div>

        {/* Mobile Export Actions - BIG cards */}
        <div className="m-report-actions">
          <button className="m-report-btn" onClick={exportPDF}>
            <div className="m-report-icon red"><FileText size={22} /></div>
            <div>
              <div>Export PDF</div>
              <div className="m-report-desc">Laporan lengkap untuk presentasi</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={() => { exportToCSV(participants, dayFilter); toast.success('Exported!', 'File Excel berhasil didownload') }}>
            <div className="m-report-icon green"><FileSpreadsheet size={22} /></div>
            <div>
              <div>Export Excel</div>
              <div className="m-report-desc">Data peserta format spreadsheet</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={() => { exportLogsToCSV(logs, dayFilter); toast.success('Exported!', 'Log check-in berhasil didownload') }}>
            <div className="m-report-icon blue"><ClipboardList size={22} /></div>
            <div>
              <div>Export Log Check-in</div>
              <div className="m-report-desc">Riwayat scan dengan timestamp</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={() => { exportAdminLogsToCSV(filteredAdminLogs); toast.success('Exported!', 'Audit log admin berhasil didownload') }}>
            <div className="m-report-icon yellow"><ShieldAlert size={22} /></div>
            <div>
              <div>Export Audit Admin</div>
              <div className="m-report-desc">Riwayat aktivitas admin</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={exportAuditPDF}>
            <div className="m-report-icon red"><FileText size={22} /></div>
            <div>
              <div>Export Audit PDF</div>
              <div className="m-report-desc">Lampiran resmi aktivitas admin</div>
            </div>
          </button>
        </div>

        {/* Mobile Analytics Chart */}
        <div className="m-section">
          <div className="m-section-header">
            <span className="m-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Activity size={16} /> Grafik Kedatangan</span>
          </div>
          <div className="card" style={{ padding: '16px 12px' }}>
            {peakData.length > 0 ? (
              <div style={{ width: '100%', height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={peakData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#E60012" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#E60012" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="time" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'rgba(22, 22, 31, 0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, color: '#fff' }}
                      itemStyle={{ color: '#fff' }}
                    />
                    <Area type="monotone" dataKey="count" name="Peserta Hadir" stroke="#E60012" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: 20 }}>
                <Activity size={24} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                <p style={{ fontSize: '0.8rem' }}>Grafik akan muncul setelah ada check-in</p>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Activity Feed */}
        <div className="m-section">
          <div className="m-section-header">
            <span className="m-section-title">Riwayat Check-in</span>
            <span className="badge badge-green" style={{ fontSize: '0.6rem' }}>{logs.length}</span>
          </div>
          {logs.length === 0 ? (
            <div className="m-empty"><span><ClipboardList size={28} /></span><p>Belum ada check-in</p></div>
          ) : (
            <div className="m-activity-list">
              {logs.slice(0, 20).map(log => (
                <div key={log.id} className="m-activity-card">
                  <div className="m-activity-avatar" style={{ background: 'var(--success)' }}><CheckCircle size={16} /></div>
                  <div className="m-activity-info">
                    <div className="m-activity-name">{log.participant_name}</div>
                    <div className="m-activity-meta">
                      <span className="badge badge-gray">{log.participant_category}</span>
                      <span>{log.participant_ticket}</span>
                    </div>
                  </div>
                  <div className="m-activity-time">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="m-section">
          <div className="m-section-header">
            <span className="m-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldAlert size={16} /> Audit Admin</span>
            <span className="badge badge-yellow" style={{ fontSize: '0.6rem' }}>{filteredAdminLogs.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input className="form-input" type="text" placeholder="Cari aksi, actor, atau deskripsi..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} style={{ paddingLeft: 30 }} />
            </div>
            <select className="m-filter-select" value={auditActorFilter} onChange={e => setAuditActorFilter(e.target.value)}>
              <option value="all">Semua Actor</option>
              {auditActorOptions.map(actor => <option key={actor} value={actor}>{actor}</option>)}
            </select>
            <input className="form-input" type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} />
            <input className="form-input" type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={() => { setAuditActorFilter('all'); setAuditDateFrom(''); setAuditDateTo(''); setAuditSearch('') }}>Reset Filter</button>
          </div>
          {filteredAdminLogs.length === 0 ? (
            <div className="m-empty"><span><ShieldAlert size={28} /></span><p>Belum ada aktivitas admin</p></div>
          ) : (
            <div className="m-activity-list">
              {filteredAdminLogs.slice(0, 20).map(log => (
                <div key={log.id} className="m-activity-card">
                  <div className="m-activity-avatar" style={{ background: 'var(--warning)' }}><ShieldAlert size={14} /></div>
                  <div className="m-activity-info">
                    <div className="m-activity-name">{log.description}</div>
                    <div className="m-activity-meta">
                      <span className={`badge ${severityBadgeClass[log.severity] || 'badge-gray'}`}>{log.severity.toUpperCase()}</span>
                      <span className="badge badge-yellow">{log.action}</span>
                      <span>{log.actor}</span>
                    </div>
                  </div>
                  <div className="m-activity-time">
                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ===== DESKTOP REPORTS =====
  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1>Laporan Kehadiran</h1>
          <p>Analisis data check-in project 3oNs</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="form-select" style={{ width: 'auto' }} value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
            {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
          </select>
          <button className="btn btn-primary" onClick={exportPDF}><FileText size={14} /> Export PDF</button>
          <button className="btn btn-secondary" onClick={() => { exportToCSV(participants, dayFilter); toast.success('Excel Exported', 'Data peserta berhasil didownload (.xlsx)') }}><FileSpreadsheet size={14} /> Export Excel</button>
          <button className="btn btn-secondary" onClick={() => { exportLogsToCSV(logs, dayFilter); toast.success('Log Exported', 'Log check-in berhasil didownload (.xlsx)') }}><ClipboardList size={14} /> Export Log</button>
          <button className="btn btn-secondary" onClick={() => { exportAdminLogsToCSV(filteredAdminLogs); toast.success('Audit Exported', 'Audit log admin berhasil didownload (.xlsx)') }}><ShieldAlert size={14} /> Export Audit</button>
          <button className="btn btn-secondary" onClick={exportAuditPDF}><FileText size={14} /> Export Audit PDF</button>
        </div>
      </div>

      <div className="stats-grid mb-24">
        <div className="stat-card"><div className="stat-card-icon red"><Users size={22} /></div><div className="stat-card-value">{stats.total}</div><div className="stat-card-label">Total Peserta</div></div>
        <div className="stat-card"><div className="stat-card-icon green"><UserCheck size={22} /></div><div className="stat-card-value">{stats.checkedIn}</div><div className="stat-card-label">Hadir</div></div>
        <div className="stat-card"><div className="stat-card-icon yellow"><UserX size={22} /></div><div className="stat-card-value">{stats.notCheckedIn}</div><div className="stat-card-label">Tidak Hadir</div></div>
        <div className="stat-card"><div className="stat-card-icon blue"><TrendingUp size={22} /></div><div className="stat-card-value">{stats.percentage}%</div><div className="stat-card-label">Persentase</div></div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card"><div className="card-header"><h3 className="card-title">Per Kategori</h3></div><div className="chart-container"><Bar data={barData} options={barOptions} /></div></div>
        <div className="card"><div className="card-header"><h3 className="card-title">Tingkat Kehadiran</h3></div><div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Doughnut data={attendanceData} options={doughnutOptions} /></div></div>
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={18} /> Puncak Kedatangan Peserta (Peak Hours)</h3>
        </div>
        <div style={{ height: 300, width: '100%', padding: '10px 20px 20px 0' }}>
          {peakData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={peakData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCountDesktop" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E60012" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#E60012" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#6B7280" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(22, 22, 31, 0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 8, color: '#fff' }}
                  itemStyle={{ color: '#fff' }}
                  labelStyle={{ color: '#9CA3AF' }}
                />
                <Area type="monotone" dataKey="count" name="Jumlah Hadir" stroke="#E60012" strokeWidth={3} fillOpacity={1} fill="url(#colorCountDesktop)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div className="empty-state-icon"><Activity size={40} /></div>
              <h3>Belum ada pergerakan</h3>
              <p>Grafik otomatis diperbarui setelah proses check-in berjalan</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="card-title">Timeline Check-in</h3><span className="badge badge-green">{logs.length} entries</span></div>
        {logs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><ClipboardList size={40} /></div><h3>Belum ada data</h3><p>Data akan muncul setelah peserta melakukan check-in</p></div>
        ) : (
          <div className="activity-feed" style={{ maxHeight: 400, overflow: 'auto' }}>
            {logs.map(log => (
              <div key={log.id} className="activity-item">
                <div className="activity-dot green"></div>
                <div style={{ flex: 1 }}>
                  <div className="activity-text"><strong>{log.participant_name}</strong> check-in <span className="badge badge-gray" style={{ marginLeft: 8 }}>{log.participant_category}</span></div>
                  <div className="activity-time">{new Date(log.timestamp).toLocaleString('id-ID')}</div>
                </div>
                <code style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{log.participant_ticket}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ShieldAlert size={18} /> Audit Log Admin</h3>
          <span className="badge badge-yellow">{filteredAdminLogs.length} entries</span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <div style={{ position: 'relative', minWidth: 240 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input className="form-input" type="text" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Cari aksi, actor, deskripsi" style={{ paddingLeft: 30 }} />
          </div>
          <select className="form-select" style={{ width: 'auto', minWidth: 180 }} value={auditActorFilter} onChange={e => setAuditActorFilter(e.target.value)}>
            <option value="all">Semua Actor</option>
            {auditActorOptions.map(actor => <option key={actor} value={actor}>{actor}</option>)}
          </select>
          <input className="form-input" type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} style={{ width: 'auto' }} />
          <input className="form-input" type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} style={{ width: 'auto' }} />
          <button className="btn btn-ghost btn-sm" onClick={() => { setAuditActorFilter('all'); setAuditDateFrom(''); setAuditDateTo(''); setAuditSearch('') }}>Reset Filter</button>
        </div>
        {filteredAdminLogs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><ShieldAlert size={40} /></div><h3>Belum ada aktivitas admin</h3><p>Aktivitas admin akan tercatat otomatis di sini</p></div>
        ) : (
          <div className="activity-feed" style={{ maxHeight: 320, overflow: 'auto' }}>
            {filteredAdminLogs.map(log => (
              <div key={log.id} className="activity-item">
                <div className="activity-dot" style={{ background: 'var(--warning)' }}></div>
                <div style={{ flex: 1 }}>
                  <div className="activity-text"><strong>{log.description}</strong></div>
                  <div className="activity-time">{new Date(log.timestamp).toLocaleString('id-ID')} · {log.actor}</div>
                </div>
                <span className={`badge ${severityBadgeClass[log.severity] || 'badge-gray'}`}>{log.severity.toUpperCase()}</span>
                <span className="badge badge-yellow">{log.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

