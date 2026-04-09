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

  const handlePrintInvoice = (invoice) => {
    const tenant = tenants.find((t) => t.id === invoice.tenantId)
    const tenantName = tenant ? getTenantDisplayName(tenant) : invoice.tenantName
    const issueDate = new Date(invoice.issued_at)
    const dueDate = tenant?.contract?.end_at ? new Date(tenant.contract.end_at) : null
    const statusLabel = invoice.status === 'paid' ? 'LUNAS' : 'BELUM LUNAS'
    const amount = Number(invoice.amount || 0)
    const tax = Math.round(amount * 0.11)
    const subtotal = Math.max(0, amount - tax)
    const notes = String(invoice.notes || '').trim()

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=980,height=700')
    if (!printWindow) {
      toast.error('Gagal', 'Popup diblokir browser. Izinkan popup untuk mencetak invoice.')
      return
    }

    const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Invoice #${invoice.id}</title>
  <style>
    :root { --primary:#0f172a; --accent:#e11d48; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; }
    * { box-sizing:border-box; }
    body { margin:0; font-family: Inter, "Segoe UI", Arial, sans-serif; background:var(--bg); color:#0b1220; }
    .page { max-width:920px; margin:24px auto; background:#fff; border:1px solid var(--line); border-radius:18px; overflow:hidden; box-shadow:0 10px 30px rgba(15,23,42,.08); }
    .hero { padding:26px 30px; background:linear-gradient(130deg, #0f172a, #1e293b 58%, #334155); color:#fff; display:flex; justify-content:space-between; gap:20px; }
    .brand-title { margin:0; font-size:24px; letter-spacing:.2px; }
    .brand-sub { margin-top:6px; color:#cbd5e1; font-size:13px; }
    .badge { padding:6px 12px; border-radius:999px; font-size:12px; font-weight:700; letter-spacing:.4px; }
    .badge.paid { background:#dcfce7; color:#166534; }
    .badge.unpaid { background:#fef3c7; color:#92400e; }
    .content { padding:28px 30px 30px; }
    .meta-grid { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:12px; margin-bottom:22px; }
    .meta-card { border:1px solid var(--line); border-radius:12px; padding:12px; background:#fff; }
    .meta-label { font-size:11px; letter-spacing:.4px; text-transform:uppercase; color:var(--muted); margin-bottom:4px; }
    .meta-value { font-size:14px; font-weight:700; }
    .tenant-box { margin:14px 0 16px; padding:14px; border:1px solid var(--line); border-radius:12px; background:#f8fafc; }
    table { width:100%; border-collapse:collapse; margin-top:14px; }
    th, td { padding:12px 10px; border-bottom:1px solid var(--line); text-align:left; font-size:14px; }
    th { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.4px; }
    .right { text-align:right; }
    .totals { margin-top:18px; margin-left:auto; width:320px; border:1px solid var(--line); border-radius:12px; overflow:hidden; }
    .totals-row { display:flex; justify-content:space-between; padding:10px 12px; border-bottom:1px solid var(--line); font-size:14px; }
    .totals-row:last-child { border-bottom:none; font-weight:800; font-size:16px; background:#f8fafc; }
    .notes { margin-top:18px; border:1px dashed #cbd5e1; border-radius:12px; padding:12px; color:#334155; font-size:13px; white-space:pre-wrap; }
    .foot { margin-top:20px; color:var(--muted); font-size:12px; display:flex; justify-content:space-between; gap:12px; }
    @media print {
      body { background:#fff; }
      .page { margin:0; border:none; border-radius:0; box-shadow:none; max-width:none; }
      .hero { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <main class="page">
    <section class="hero">
      <div>
        <h1 class="brand-title">INVOICE</h1>
        <div class="brand-sub">Event Platform • Dokumen tagihan resmi</div>
      </div>
      <div>
        <div class="badge ${invoice.status === 'paid' ? 'paid' : 'unpaid'}">${statusLabel}</div>
      </div>
    </section>
    <section class="content">
      <div class="meta-grid">
        <div class="meta-card"><div class="meta-label">Invoice ID</div><div class="meta-value">#${invoice.id}</div></div>
        <div class="meta-card"><div class="meta-label">Periode</div><div class="meta-value">${invoice.period || '-'}</div></div>
        <div class="meta-card"><div class="meta-label">Tanggal Terbit</div><div class="meta-value">${issueDate.toLocaleDateString('id-ID')}</div></div>
        <div class="meta-card"><div class="meta-label">Jatuh Tempo</div><div class="meta-value">${dueDate ? dueDate.toLocaleDateString('id-ID') : '-'}</div></div>
      </div>

      <div class="tenant-box">
        <div class="meta-label">Ditagihkan kepada</div>
        <div class="meta-value">${tenantName}</div>
        <div style="color:#64748b;font-size:12px;margin-top:4px;">Tenant ID: ${invoice.tenantId}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Deskripsi</th>
            <th class="right">Subtotal</th>
            <th class="right">PPN 11%</th>
            <th class="right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Biaya layanan platform • Periode ${invoice.period || '-'}</td>
            <td class="right">Rp ${subtotal.toLocaleString('id-ID')}</td>
            <td class="right">Rp ${tax.toLocaleString('id-ID')}</td>
            <td class="right">Rp ${amount.toLocaleString('id-ID')}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row"><span>Subtotal</span><span>Rp ${subtotal.toLocaleString('id-ID')}</span></div>
        <div class="totals-row"><span>PPN 11%</span><span>Rp ${tax.toLocaleString('id-ID')}</span></div>
        <div class="totals-row"><span>Total Tagihan</span><span>Rp ${amount.toLocaleString('id-ID')}</span></div>
      </div>

      ${notes ? `<div class="notes"><strong>Catatan:</strong>\n${notes}</div>` : ''}

      <div class="foot">
        <div>Dokumen dibuat otomatis oleh sistem.</div>
        <div>Dicetak pada ${new Date().toLocaleString('id-ID')}</div>
      </div>
    </section>
  </main>
</body>
</html>`

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.onload = () => {
      printWindow.print()
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
