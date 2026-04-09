import { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { 
  FileText, History, DollarSign, Printer,
  Search, CheckCircle, Clock, Plus, Filter 
} from 'lucide-react'
import { getTenants, addTenantInvoice, updateInvoiceStatus, bootstrapStoreFromFirebase } from '../../../store/mockData'
import { useToast } from '../../../contexts/ToastContext'
import { useAuth } from '../../../contexts/useAuth'

function getTenantDisplayName(tenant) {
  return String(tenant?.branding?.appName || tenant?.brandName || '-').trim() || '-'
}

function formatCurrency(value) {
  return `Rp ${Number(value || 0).toLocaleString('id-ID')}`
}

function formatDate(value) {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

async function getBrandLogoDataUrl() {
  try {
    const response = await fetch('/brand-logo.svg')
    if (!response.ok) return null
    const svgText = await response.text()
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' })
    const blobUrl = URL.createObjectURL(svgBlob)
    const image = new Image()
    image.crossOrigin = 'anonymous'

    const loaded = await new Promise((resolve, reject) => {
      image.onload = () => resolve(true)
      image.onerror = reject
      image.src = blobUrl
    })

    if (!loaded) return null
    const canvas = document.createElement('canvas')
    const size = 256
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(image, 0, 0, size, size)
    URL.revokeObjectURL(blobUrl)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

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

  const initialHydrationDoneRef = useRef(false)

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

  // Only hydrate once on initial mount, not on every render
  useEffect(() => {
    if (initialHydrationDoneRef.current) return
    initialHydrationDoneRef.current = true
    const timerId = window.setTimeout(() => {
      void refreshTenants(true)
    }, 0)
    return () => window.clearTimeout(timerId)
  }, [refreshTenants])

  const allInvoices = useMemo(() => {
    return tenants.flatMap(t => (t.invoices || []).map(i => ({ ...i, tenantId: t.id, tenantName: getTenantDisplayName(t) })))
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

  const handlePrintInvoice = async (invoice) => {
    const tenant = tenants.find((t) => t.id === invoice.tenantId)
    const tenantName = tenant ? getTenantDisplayName(tenant) : invoice.tenantName
    const issueDate = new Date(invoice.issued_at)
    const dueDate = tenant?.contract?.end_at ? new Date(tenant.contract.end_at) : null
    const statusLabel = invoice.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'
    const amount = Number(invoice.amount || 0)
    const tax = Math.round(amount * 0.11)
    const subtotal = Math.max(0, amount - tax)
    const notes = String(invoice.notes || '').trim()

    try {
      const [{ jsPDF }, { default: autoTable }] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable')
      ])

      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pageW = doc.internal.pageSize.getWidth()
      const pageH = doc.internal.pageSize.getHeight()
      const margin = 14
      const logoDataUrl = await getBrandLogoDataUrl()

      // Background layer
      doc.setFillColor(255, 253, 214)
      doc.rect(0, 0, pageW, pageH, 'F')

      // Top banner using logo-inspired palette.
      doc.setFillColor(77, 166, 232)
      doc.rect(0, 0, pageW, 44, 'F')
      doc.setFillColor(46, 171, 110)
      doc.rect(0, 44, pageW, 5, 'F')

      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin, 8, 18, 18)
      }

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.text('INVOICE TAGIHAN RESMI', margin + 24, 17)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9.5)
      doc.text('Studio Digital Event Platform', margin + 24, 23)
      doc.text('Solusi tiket digital profesional untuk event Anda', margin + 24, 28)

      doc.setFillColor(invoice.status === 'paid' ? 46 : 232, invoice.status === 'paid' ? 171 : 64, invoice.status === 'paid' ? 110 : 64)
      doc.roundedRect(pageW - 58, 10, 44, 10, 3, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9)
      doc.setTextColor(255, 255, 255)
      doc.text(statusLabel, pageW - 36, 16.6, { align: 'center' })

      // Invoice identity panel
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, 57, pageW - (margin * 2), 40, 4, 4, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, 57, pageW - (margin * 2), 40, 4, 4, 'S')

      doc.setTextColor(30, 41, 59)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.text(`Invoice #${invoice.id}`, margin + 4, 67)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.text(`Periode: ${invoice.period || '-'}`, margin + 4, 74)
      doc.text(`Ditagihkan kepada: ${tenantName}`, margin + 4, 81)
      doc.text(`Tenant ID: ${invoice.tenantId}`, margin + 4, 88)

      doc.setFont('helvetica', 'bold')
      doc.text('Tanggal terbit', pageW - 76, 67)
      doc.text('Jatuh tempo', pageW - 76, 77)
      doc.text('Mata uang', pageW - 76, 87)
      doc.setFont('helvetica', 'normal')
      doc.text(formatDate(issueDate), pageW - 44, 67)
      doc.text(formatDate(dueDate), pageW - 44, 77)
      doc.text('IDR (Rupiah)', pageW - 44, 87)

      autoTable(doc, {
        startY: 106,
        head: [['Deskripsi Layanan', 'Subtotal', 'PPN 11%', 'Total']],
        body: [[
          `Berlangganan platform event digital • Periode ${invoice.period || '-'}`,
          formatCurrency(subtotal),
          formatCurrency(tax),
          formatCurrency(amount)
        ]],
        styles: { fontSize: 9.5, cellPadding: 4, textColor: [30, 41, 59] },
        headStyles: { fillColor: [232, 67, 147], textColor: [255, 255, 255], fontStyle: 'bold' },
        columnStyles: {
          0: { cellWidth: 88 },
          1: { halign: 'right' },
          2: { halign: 'right' },
          3: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [255, 255, 255] },
        tableLineColor: [226, 232, 240],
        tableLineWidth: 0.1
      })

      const afterTableY = (doc.lastAutoTable?.finalY || 150) + 6
      doc.setFillColor(255, 255, 255)
      doc.roundedRect(margin, afterTableY, pageW - (margin * 2), 36, 4, 4, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.roundedRect(margin, afterTableY, pageW - (margin * 2), 36, 4, 4, 'S')

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(30, 41, 59)
      doc.setFontSize(11)
      doc.text('Ringkasan Pembayaran', margin + 4, afterTableY + 8)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text('Subtotal', margin + 4, afterTableY + 17)
      doc.text(formatCurrency(subtotal), pageW - margin - 4, afterTableY + 17, { align: 'right' })
      doc.text('PPN 11%', margin + 4, afterTableY + 24)
      doc.text(formatCurrency(tax), pageW - margin - 4, afterTableY + 24, { align: 'right' })
      doc.setDrawColor(226, 232, 240)
      doc.line(margin + 4, afterTableY + 28, pageW - margin - 4, afterTableY + 28)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(232, 67, 147)
      doc.text('TOTAL TAGIHAN', margin + 4, afterTableY + 34)
      doc.text(formatCurrency(amount), pageW - margin - 4, afterTableY + 34, { align: 'right' })

      if (notes) {
        const notesY = afterTableY + 48
        doc.setFillColor(255, 255, 255)
        doc.roundedRect(margin, notesY, pageW - (margin * 2), 30, 4, 4, 'F')
        doc.setDrawColor(226, 232, 240)
        doc.roundedRect(margin, notesY, pageW - (margin * 2), 30, 4, 4, 'S')
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(30, 41, 59)
        doc.text('Catatan Tambahan', margin + 4, notesY + 8)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        const noteLines = doc.splitTextToSize(notes, pageW - 28)
        doc.text(noteLines, margin + 4, notesY + 15)
      }

      const footerY = pageH - 20
      doc.setDrawColor(203, 213, 225)
      doc.line(margin, footerY - 6, pageW - margin, footerY - 6)
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.text('Terima kasih atas kepercayaan Anda bersama Studio Digital.', margin, footerY)
      doc.text(`Dokumen otomatis • ${new Date().toLocaleString('id-ID')}`, pageW - margin, footerY, { align: 'right' })

      doc.save(`Invoice_${invoice.id}.pdf`)
      toast.success('Berhasil', `Invoice #${invoice.id} berhasil diunduh (PDF).`)
    } catch (err) {
      toast.error('Gagal', `Tidak bisa membuat PDF invoice. ${err?.message || ''}`.trim())
    }
  }

  return (
    <div className="billing-invoice-container owner-fade-in-up">
      <div className="owner-tab-intro">
        <span className="page-kicker">Keuangan</span>
        <h2>Tagihan &amp; invoice</h2>
        <p>Catat periode tagihan, nominal, dan status lunas per tenant. Filter membantu meninjau satu akun brand sekaligus sebelum menambah tagihan baru.</p>
      </div>
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
              <option key={t.id} value={t.id}>{getTenantDisplayName(t)}</option>
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
          <div className="owner-card-title">Daftar tagihan</div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{filteredInvoices.length} tagihan</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="owner-data-table">
            <thead>
              <tr>
                <th>ID tagihan</th>
                <th>Akun</th>
                <th>Periode</th>
                <th>Tgl terbit</th>
                <th>Total</th>
                <th>Status</th>
                <th className="text-right">Cetak</th>
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
                      <button
                        className="btn btn-ghost btn-sm"
                        title="Cetak invoice"
                        onClick={() => handlePrintInvoice(invoice)}
                      >
                        <Printer size={14} />
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
                      <option key={t.id} value={t.id}>{getTenantDisplayName(t)}</option>
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
