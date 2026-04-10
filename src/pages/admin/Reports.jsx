// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getCheckInLogs() { return []; }
// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getStats() { return {}; }
// ===== DUMMY FUNGSI AGAR ERROR HILANG =====
function getCurrentDay() { return 1; }
import { useState, useEffect } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js'
import { Bar, Doughnut } from 'react-chartjs-2'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts'
import { useToast } from '../../contexts/ToastContext'
import { exportToCSV, exportLogsToCSV, exportAdminLogsToCSV } from '../../utils/csvExport'
import { FileText, FileSpreadsheet, ClipboardList, Users, UserCheck, UserX, TrendingUp, CheckCircle, Activity, ShieldAlert, Search } from 'lucide-react'
import { useIsMobileLayout } from '../../hooks/useIsMobileLayout'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

const RECHARTS_TOOLTIP_CONTENT_STYLE = {
  backgroundColor: 'rgba(22, 22, 31, 0.95)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 8,
  color: '#fff'
}

const RECHARTS_TOOLTIP_ITEM_STYLE = { color: '#fff' }
const RECHARTS_TOOLTIP_LABEL_STYLE = { color: '#9CA3AF' }

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
      
      // Judul dokumen
      doc.setFontSize(20)
      doc.setFont(undefined, 'bold')
      doc.text('Laporan Kehadiran', 105, 20, { align: 'center' })
      doc.setFontSize(14)
      doc.text(`Hari ${dayFilter}`, 105, 30, { align: 'center' })
      doc.setFontSize(10)
      doc.setFont(undefined, 'normal')
      doc.text(`Digenerate: ${new Date().toLocaleString('id-ID')}`, 105, 38, { align: 'center' })

      // Ringkasan statistik
      doc.setFontSize(12)
      doc.setFont(undefined, 'bold')
      doc.text('Ringkasan', 14, 52)
      doc.setFont(undefined, 'normal')
      doc.setFontSize(10)
      doc.text(`Total Peserta: ${stats.total}`, 14, 60)
      doc.text(`Sudah Check-in: ${stats.checkedIn} (${stats.percentage}%)`, 14, 67)
      doc.text(`Belum Hadir: ${stats.notCheckedIn}`, 14, 74)

      // Rincian per kategori
      doc.setFont(undefined, 'bold')
      doc.text('Per Kategori:', 14, 84)
      doc.setFont(undefined, 'normal')
      let y = 91
      Object.entries(stats.byCategory).forEach(([cat, data]) => {
        doc.text(`${cat}: ${data.checkedIn}/${data.total} hadir`, 20, y)
        y += 7
      })

      // Tabel peserta
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

      doc.save(`Laporan_Kehadiran_Hari_${dayFilter}.pdf`)
      toast.success('Unduhan Berhasil', 'Laporan kehadiran berhasil diunduh')
    } catch (err) {
      console.error(err)
      toast.error('Terjadi Kendala', 'Gagal mengunduh PDF laporan')
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

      const actorLabel = auditActorFilter === 'all' ? 'Semua Pengguna' : auditActorFilter
      const rangeLabel = `${auditDateFrom || '-'} s/d ${auditDateTo || '-'}`
      doc.text(`Filter Pengguna: ${actorLabel}`, 14, 36)
      doc.text(`Filter Tanggal: ${rangeLabel}`, 14, 43)
      doc.text(`Total Data: ${filteredAdminLogs.length}`, 14, 50)

      autoTable(doc, {
        startY: 56,
        head: [['No', 'Waktu', 'Pengguna', 'Tingkat Risiko', 'Aksi', 'Deskripsi']],
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

      doc.save('Audit_Log_Admin.pdf')
      toast.success('Unduhan Berhasil', 'Audit admin berhasil diunduh')
    } catch (err) {
      console.error(err)
      toast.error('Terjadi Kendala', 'Gagal mengunduh PDF audit')
    }
  }

  const handleExcelParticipants = () => {
    const ok = exportToCSV(participants, dayFilter)
    if (ok) {
      toast.success('Unduhan Berhasil', 'Data peserta berhasil diunduh')
      return
    }
    toast.error('Terjadi Kendala', 'Gagal mengunduh file Excel peserta')
  }

  const handleExcelLogs = () => {
    const ok = exportLogsToCSV(logs, dayFilter)
    if (ok) {
      toast.success('Unduhan Berhasil', 'Riwayat kehadiran berhasil diunduh')
      return
    }
    toast.error('Terjadi Kendala', 'Gagal mengunduh riwayat kehadiran')
  }

  const handleExcelAudit = () => {
    const ok = exportAdminLogsToCSV(filteredAdminLogs)
    if (ok) {
      toast.success('Unduhan Berhasil', 'Riwayat aktivitas admin berhasil diunduh')
      return
    }
    toast.error('Terjadi Kendala', 'Gagal mengunduh audit admin')
  }

  // Grafik batang - perbandingan kategori
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

  // Diagram donat kehadiran
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

  const isMobile = useIsMobileLayout()

  useEffect(() => {
    // Setelah navigasi/route mount, beberapa chart butuh "layout pass" tambahan.
    const raf = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'))
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isMobile])

  // ===== LAPORAN MOBILE =====
  if (isMobile) {
    return (
      <div className="page-container">
        <div className="m-section-header mb-16">
          <div>
            <span className="m-mobile-kicker">Analitik</span>
            <h1 className="m-mobile-title">Laporan</h1>
            <p className="m-mobile-subtitle">Hari {dayFilter} · ringkasan, unduhan, dan audit</p>
          </div>
          <select className="m-filter-select" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
            {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
          </select>
        </div>

        {/* Statistik Mobile */}
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

        {/* Rincian Kategori Mobile */}
        <div className="m-chips-row mb-16">
          {Object.entries(stats.byCategory).map(([cat, data]) => (
            <div key={cat} className={`m-chip m-chip-${cat.toLowerCase()}`}>
              <span className="m-chip-num">{data.checkedIn}/{data.total}</span>
              <span className="m-chip-label">{cat}</span>
            </div>
          ))}
        </div>

        {/* Grafik Analitik Mobile */}
        <div className="m-section">
          <div className="m-section-header">
            <span className="m-section-title inline-title-icon"><Activity size={16} /> Grafik Kedatangan</span>
          </div>
          {peakData.length > 0 ? (
            <div className="m-chart-shell">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={peakData} margin={{ top: 8, right: 10, left: -10, bottom: 10 }}>
                  <defs>
                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#E60012" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#E60012" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="time" stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#6B7280" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                    itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                  />
                  <Area type="monotone" dataKey="count" name="Peserta Hadir" stroke="#E60012" strokeWidth={3} fillOpacity={1} fill="url(#colorCount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="m-empty m-empty-compact">
              <Activity size={24} className="m-muted-icon" />
              <p className="m-empty-text">Grafik akan muncul setelah ada check-in</p>
            </div>
          )}
        </div>

        {/* Aksi Unduh Mobile - kartu besar */}
        <div className="m-report-actions">
          <button className="m-report-btn" onClick={exportPDF}>
            <div className="m-report-icon red"><FileText size={22} /></div>
            <div className="m-report-content">
              <div className="m-report-title">Unduh PDF</div>
              <div className="m-report-desc">Laporan lengkap untuk presentasi</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={handleExcelParticipants}>
            <div className="m-report-icon green"><FileSpreadsheet size={22} /></div>
            <div className="m-report-content">
              <div className="m-report-title">Unduh Excel</div>
              <div className="m-report-desc">Data peserta format spreadsheet</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={handleExcelLogs}>
            <div className="m-report-icon blue"><ClipboardList size={22} /></div>
            <div className="m-report-content">
              <div className="m-report-title">Unduh Riwayat Kehadiran</div>
              <div className="m-report-desc">Riwayat scan dengan timestamp</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={handleExcelAudit}>
            <div className="m-report-icon yellow"><ShieldAlert size={22} /></div>
            <div className="m-report-content">
              <div className="m-report-title">Unduh Audit Admin</div>
              <div className="m-report-desc">Riwayat aktivitas admin</div>
            </div>
          </button>
          <button className="m-report-btn" onClick={exportAuditPDF}>
            <div className="m-report-icon red"><FileText size={22} /></div>
            <div className="m-report-content">
              <div className="m-report-title">Unduh Audit PDF</div>
              <div className="m-report-desc">Lampiran resmi aktivitas admin</div>
            </div>
          </button>
        </div>

        {/* Umpan Aktivitas Mobile */}
        <div className="m-section">
          <div className="m-section-header">
            <span className="m-section-title">Riwayat Kehadiran</span>
            <span className="badge badge-green badge-xs">{logs.length}</span>
          </div>
          {logs.length === 0 ? (
            <div className="m-empty"><span><ClipboardList size={28} /></span><p>Belum ada data kehadiran</p></div>
          ) : (
            <div className="m-activity-list">
              {logs.slice(0, 20).map(log => (
                <div key={log.id} className="m-activity-card">
                  <div className="m-activity-avatar m-activity-avatar-success"><CheckCircle size={16} /></div>
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
            <span className="m-section-title inline-title-icon"><ShieldAlert size={16} /> Audit Admin</span>
            <span className="badge badge-yellow badge-xs">{filteredAdminLogs.length}</span>
          </div>
          <div className="m-audit-filter-grid">
            <div className="m-audit-search-wrap">
              <Search size={14} className="m-audit-search-icon" />
              <input className="form-input" type="text" placeholder="Cari aksi, pengguna, atau deskripsi..." value={auditSearch} onChange={e => setAuditSearch(e.target.value)} />
            </div>
            <select className="m-filter-select" value={auditActorFilter} onChange={e => setAuditActorFilter(e.target.value)}>
              <option value="all">Semua Pengguna</option>
              {auditActorOptions.map(actor => <option key={actor} value={actor}>{actor}</option>)}
            </select>
            <input className="form-input" type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} />
            <input className="form-input" type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} />
            <button className="btn btn-secondary btn-sm" onClick={() => { setAuditActorFilter('all'); setAuditDateFrom(''); setAuditDateTo(''); setAuditSearch('') }}>Atur Ulang Filter</button>
          </div>
          {filteredAdminLogs.length === 0 ? (
            <div className="m-empty"><span><ShieldAlert size={28} /></span><p>Belum ada aktivitas admin</p></div>
          ) : (
            <div className="m-activity-list">
              {filteredAdminLogs.slice(0, 20).map(log => (
                <div key={log.id} className="m-activity-card">
                  <div className="m-activity-avatar m-activity-avatar-warning"><ShieldAlert size={14} /></div>
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

  // ===== LAPORAN DESKTOP =====
  return (
    <div className="page-container">
      <div className="page-header admin-toolbar">
        <div>
          <span className="page-kicker">Analitik & ekspor</span>
          <h1>Laporan kehadiran</h1>
          <p>Grafik, daftar scan, dan log audit untuk arsip. Pilih hari acara, lalu unduh PDF atau spreadsheet sesuai kebutuhan.</p>
        </div>
        <div className="admin-actions-wrap">
          <select className="form-select admin-select-auto" value={dayFilter} onChange={e => setDayFilter(Number(e.target.value))}>
            {availableDays.map(day => <option key={day} value={day}>Hari {day}</option>)}
          </select>
          <button className="btn btn-primary" onClick={exportPDF}><FileText size={14} /> Unduh PDF</button>
          <button className="btn btn-secondary" onClick={handleExcelParticipants}><FileSpreadsheet size={14} /> Unduh Excel</button>
          <button className="btn btn-secondary" onClick={handleExcelLogs}><ClipboardList size={14} /> Unduh Riwayat</button>
          <button className="btn btn-secondary" onClick={handleExcelAudit}><ShieldAlert size={14} /> Unduh Audit</button>
          <button className="btn btn-secondary" onClick={exportAuditPDF}><FileText size={14} /> Unduh Audit PDF</button>
        </div>
      </div>

      <div className="stats-grid mb-24">
        <div className="stat-card"><div className="stat-card-icon red"><Users size={22} /></div><div className="stat-card-value">{stats.total}</div><div className="stat-card-label">Total Peserta</div></div>
        <div className="stat-card"><div className="stat-card-icon green"><UserCheck size={22} /></div><div className="stat-card-value">{stats.checkedIn}</div><div className="stat-card-label">Hadir</div></div>
        <div className="stat-card"><div className="stat-card-icon yellow"><UserX size={22} /></div><div className="stat-card-value">{stats.notCheckedIn}</div><div className="stat-card-label">Tidak Hadir</div></div>
        <div className="stat-card"><div className="stat-card-icon blue"><TrendingUp size={22} /></div><div className="stat-card-value">{stats.percentage}%</div><div className="stat-card-label">Persentase</div></div>
      </div>

      <div className="grid-2 mb-24">
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Per kategori</h3>
              <p className="card-subtitle-hint">Batang: total tiket vs jumlah sudah hadir per kategori.</p>
            </div>
          </div>
          <div className="chart-container"><Bar data={barData} options={barOptions} /></div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Tingkat kehadiran</h3>
              <p className="card-subtitle-hint">Rasio hadir vs belum untuk hari yang dipilih.</p>
            </div>
          </div>
          <div className="chart-container chart-center"><Doughnut data={attendanceData} options={doughnutOptions} /></div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header">
          <div>
            <h3 className="card-title inline-title-icon"><Activity size={18} /> Puncak kedatangan</h3>
            <p className="card-subtitle-hint">Kapan peserta paling banyak melakukan check-in dalam satu hari.</p>
          </div>
        </div>
        <div className="peak-chart-wrap">
          {peakData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
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
                  contentStyle={RECHARTS_TOOLTIP_CONTENT_STYLE}
                  itemStyle={RECHARTS_TOOLTIP_ITEM_STYLE}
                  labelStyle={RECHARTS_TOOLTIP_LABEL_STYLE}
                />
                <Area type="monotone" dataKey="count" name="Jumlah Hadir" stroke="#E60012" strokeWidth={3} fillOpacity={1} fill="url(#colorCountDesktop)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state empty-state-fill">
              <div className="empty-state-icon"><Activity size={40} /></div>
              <h3>Belum ada pergerakan</h3>
              <p>Grafik otomatis diperbarui setelah proses check-in berjalan</p>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">Riwayat kehadiran</h3>
            <p className="card-subtitle-hint">Setiap baris mencerminkan satu scan valid di pintu masuk.</p>
          </div>
          <span className="badge badge-green">{logs.length} data</span>
        </div>
        {logs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><ClipboardList size={40} /></div><h3>Belum ada data</h3><p>Data akan muncul setelah peserta melakukan check-in</p></div>
        ) : (
          <div className="activity-feed activity-feed-md">
            {logs.map(log => (
              <div key={log.id} className="activity-item">
                <div className="activity-dot green"></div>
                <div className="flex-1">
                  <div className="activity-text"><strong>{log.participant_name}</strong> hadir <span className="badge badge-gray ml-8">{log.participant_category}</span></div>
                  <div className="activity-time">{new Date(log.timestamp).toLocaleString('id-ID')}</div>
                </div>
                <code className="code-muted-sm">{log.participant_ticket}</code>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mt-16">
        <div className="card-header admin-toolbar">
          <div>
            <h3 className="card-title inline-title-icon"><ShieldAlert size={18} /> Log audit admin</h3>
            <p className="card-subtitle-hint">Aksi sensitif (hapus data, reset, ubah hari) tercatat dengan pengguna dan waktu.</p>
          </div>
          <span className="badge badge-yellow">{filteredAdminLogs.length} data</span>
        </div>
        <div className="admin-filters">
          <div className="admin-search-wrap">
            <Search size={14} className="admin-search-icon" />
            <input className="form-input" type="text" value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="Cari aksi, pengguna, deskripsi" />
          </div>
          <select className="form-select admin-select-auto" value={auditActorFilter} onChange={e => setAuditActorFilter(e.target.value)}>
            <option value="all">Semua Pengguna</option>
            {auditActorOptions.map(actor => <option key={actor} value={actor}>{actor}</option>)}
          </select>
          <input className="form-input admin-date-input" type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} />
          <input className="form-input admin-date-input" type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} />
          <button className="btn btn-ghost btn-sm" onClick={() => { setAuditActorFilter('all'); setAuditDateFrom(''); setAuditDateTo(''); setAuditSearch('') }}>Atur Ulang Filter</button>
        </div>
        {filteredAdminLogs.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon"><ShieldAlert size={40} /></div><h3>Belum ada aktivitas admin</h3><p>Aktivitas admin akan tercatat otomatis di sini</p></div>
        ) : (
          <div className="activity-feed activity-feed-sm">
            {filteredAdminLogs.map(log => (
              <div key={log.id} className="activity-item">
                <div className="activity-dot warning"></div>
                <div className="flex-1">
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

