import { useCallback, useEffect, useMemo, useState } from 'react'
import { 
  FileText, History, DollarSign, Download, 
  Search, CheckCircle, Clock, Plus, Filter 
} from 'lucide-react'
import { getTenants, addTenantInvoice, updateInvoiceStatus, bootstrapStoreFromFirebase } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/useAuth'
import jsPDF from 'jspdf'
import 'jspdf-autotable'

export default function BillingInvoice() {
  const toast = useToast()
  const { user: currentUser } = useAuth()
  
  const [tenants, setTenants] = useState(getTenants())
  const [selectedTenantId, setSelectedTenantId] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newInvoice, setNewInvoice] = useState({ 
    period: '', 
    amount: 0, 
    status: 'unpaid', 
    notes: '' 
  })

  const runFirebaseHydrate = useCallback(async () => {
    if (typeof bootstrapStoreFromFirebase !== 'function') return
    try {
      await bootstrapStoreFromFirebase(true)
    } catch {
      // Keep owner UI responsive when Firebase hydrate is unavailable.
    }
  }, [])

  const refreshTenants = useCallback(async (forceFirebase = true) => {
    if (forceFirebase) {
      await runFirebaseHydrate()
    }
    setTenants(getTenants())
  }, [runFirebaseHydrate])

  useEffect(() => {
    void refreshTenants(true)
  }, [refreshTenants])

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshTenants(true)
    }, 8000)
    return () => window.clearInterval(id)
  }, [refreshTenants])

  const allInvoices = useMemo(() => {
    return tenants.flatMap(t => (t.invoices || []).map(i => ({ ...i, tenantId: t.id, tenantName: t.brandName })))
      .sort((a, b) => new Date(b.issued_at) - new Date(a.issued_at))
  }, [tenants])

  const filteredInvoices = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return allInvoices.filter(i => 
      (!selectedTenantId || i.tenantId === selectedTenantId) &&
      (!q || i.tenantName.toLowerCase().includes(q) || i.id.toLowerCase().includes(q))
    )
  }, [allInvoices, selectedTenantId, searchQuery])

  const handleAddInvoice = async (e) => {
    e.preventDefault()
    if (!selectedTenantId) {
      toast.error('Gagal', 'Pilih akun terlebih dahulu')
      return
    }
    
    const result = addTenantInvoice(selectedTenantId, newInvoice, currentUser)
    if (result.success) {
      toast.success('Sukses', `Tagihan ${result.invoice.id} berhasil dibuat`)
      await refreshTenants(true)
      setShowAddModal(false)
      setNewInvoice({ period: '', amount: 0, status: 'unpaid', notes: '' })
    }
  }

  const handleToggleStatus = async (tenantId, invoiceId, currentStatus) => {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid'
    const result = updateInvoiceStatus(tenantId, invoiceId, nextStatus, currentUser)
    if (result.success) {
      await refreshTenants(true)
      toast.success('Update', 'Status tagihan diperbarui')
    }
  }

  const handleExportPDF = (invoice) => {
    const doc = new jsPDF()
    
    // Header
    doc.setFontSize(22)
    doc.setTextColor(14, 165, 233) // Primary color
    doc.text('Tagihan Pemilik Platform', 105, 20, null, 'center')
    
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text('Sistem Pengelolaan Tagihan', 105, 28, null, 'center')
    
    doc.setDrawColor(200)
    doc.line(20, 35, 190, 35)

    // Invoice Info
    doc.setFontSize(16)
    doc.setTextColor(0)
    doc.text(`TAGIHAN: #${invoice.id}`, 20, 50)
    
    doc.setFontSize(10)
    doc.text(`Tanggal Terbit: ${new Date(invoice.issued_at).toLocaleDateString()}`, 20, 60)
    doc.text(`Status: ${invoice.status.toUpperCase()}`, 20, 66)

    // Tenant Info
    doc.setFontSize(12)
    doc.text('DITAGIHKAN KEPADA:', 140, 50)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(invoice.tenantName, 140, 60)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.text('ID Akun Brand:', 140, 66)
    doc.text(invoice.tenantId, 140, 72)

    doc.autoTable({
      startY: 85,
      head: [['Keterangan', 'Periode', 'Total']],
      body: [[`Sewa Platform - ${invoice.tenantName}`, invoice.period, `Rp ${invoice.amount.toLocaleString()}`]],
      theme: 'striped',
      headStyles: { fillColor: [14, 165, 233] }
    })

    const finalY = doc.lastAutoTable.finalY + 20
    doc.text('Catatan:', 20, finalY)
    doc.text(invoice.notes || 'Terima kasih atas kerja samanya.', 20, finalY + 8)

    doc.text('Hormat kami,', 150, finalY + 40)
    doc.text('Tim Platform', 150, finalY + 60)

    doc.save(`invoice_${invoice.id}_${invoice.tenantName}.pdf`)
  }

  return (
    <div className="billing-invoice-container owner-fade-in-up">
      <div className="owner-toolbar">
        <div className="owner-toolbar-left">
          <div className="owner-search-input" style={{ flex: 1, maxWidth: '300px' }}>
            <Search size={16} />
            <input 
              className="owner-form-input" 
              placeholder="Cari tagihan atau akun..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            className="owner-form-select" 
            style={{ minWidth: '180px' }}
            value={selectedTenantId}
            onChange={e => setSelectedTenantId(e.target.value)}
          >
            <option value="">Semua Akun</option>
            {tenants.map(t => (
              <option key={t.id} value={t.id}>{t.brandName}</option>
            ))}
          </select>
        </div>
        <div className="owner-toolbar-right">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={18} /> Tagihan Baru
          </button>
        </div>
      </div>

      <div className="owner-card-container" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="owner-card-header" style={{ borderRadius: 0 }}>
          <div className="owner-card-title">💰 Manajemen Tagihan</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredInvoices.length} tagihan</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="owner-data-table">
            <thead>
              <tr>
                <th>📋 ID Tagihan</th>
                <th>👥 Akun</th>
                <th>📅 Periode</th>
                <th>📤 Tgl Terbit</th>
                <th>💵 Total</th>
                <th>✓ Status</th>
                <th style={{ textAlign: 'right' }}>⚙️ Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center p-32 text-muted">Belum ada data tagihan.</td>
                </tr>
              ) : (
                filteredInvoices.map(invoice => (
                  <tr key={invoice.id}>
                    <td className="font-bold">#{invoice.id}</td>
                    <td>{invoice.tenantName}</td>
                    <td>{invoice.period}</td>
                    <td className="text-xs">{new Date(invoice.issued_at).toLocaleDateString()}</td>
                    <td className="font-bold">Rp {invoice.amount.toLocaleString()}</td>
                    <td>
                      <button 
                        className={`badge ${invoice.status === 'paid' ? 'badge-green' : 'badge-yellow'} border-0 cursor-pointer`}
                        onClick={() => handleToggleStatus(invoice.tenantId, invoice.id, invoice.status)}
                      >
                        {invoice.status === 'paid' ? <CheckCircle size={12} className="inline mr-4" /> : <Clock size={12} className="inline mr-4" />}
                        {invoice.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'}
                      </button>
                    </td>
                    <td className="text-right">
                      <button className="btn btn-ghost btn-sm" onClick={() => handleExportPDF(invoice)}>
                        <Download size={14} /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content card" style={{ maxWidth: '450px' }}>
            <div className="card-pad">
              <h3 className="card-title mb-16">Buat Tagihan Baru</h3>
              <form onSubmit={handleAddInvoice}>
                <div className="form-group">
                  <label className="form-label">Pilih Akun</label>
                  <select 
                    className="form-select"
                    required
                    value={selectedTenantId}
                    onChange={e => setSelectedTenantId(e.target.value)}
                  >
                    <option value="">-- Pilih Akun --</option>
                    {tenants.map(t => (
                      <option key={t.id} value={t.id}>{t.brandName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Periode Tagihan</label>
                  <input 
                    className="form-input" 
                    required 
                    value={newInvoice.period}
                    onChange={e => setNewInvoice({...newInvoice, period: e.target.value})}
                    placeholder="Contoh: April 2026" 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Jumlah Tagihan (Rp)</label>
                  <input 
                    type="number"
                    className="form-input"
                    required 
                    value={newInvoice.amount}
                    onChange={e => setNewInvoice({...newInvoice, amount: parseInt(e.target.value) || 0})}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Catatan</label>
                  <textarea 
                    className="form-input"
                    rows="2"
                    value={newInvoice.notes}
                    onChange={e => setNewInvoice({...newInvoice, notes: e.target.value})}
                  />
                </div>
                <div className="actions-right mt-24">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary">Simpan & Terbitkan</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
