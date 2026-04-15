// Supabase Integration Test - System Admin Only
// Moved from Settings.jsx to admin-panel for better organization

import { useState } from 'react'
import { useToast } from '../../../contexts/ToastContext'
import { humanizeUserMessage } from '../../../utils/userFriendlyMessage'
import { Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '../../../lib/supabase'

const isSupabaseEnabled = true;

export default function SupabaseIntegration() {
  const toast = useToast()
  const [supabaseCheckRunning, setSupabaseCheckRunning] = useState(false)

  const runSupabaseIntegrationCheck = async () => {
    if (supabaseCheckRunning) return
    setSupabaseCheckRunning(true)
    try {
      if (!isSupabaseEnabled || !supabase) {
        toast.error('Supabase belum aktif', 'Periksa VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY di environment.')
        return
      }

      const { data, error } = await supabase
        .from('workspace_state')
        .select('id, tenant_registry, store, updated_at')
        .eq('id', 'default')
        .maybeSingle()

      if (error) throw error
      if (!data) {
        toast.error('Workspace tidak ditemukan', 'Row id=default belum ada di tabel workspace_state.')
        return
      }

      const probeAt = new Date().toISOString()
      const nextTenantRegistry = {
        ...(data.tenant_registry || {}),
        integration_probe_at: probeAt
      }

      const { error: writeError } = await supabase
        .from('workspace_state')
        .upsert({
          id: 'default',
          tenant_registry: nextTenantRegistry,
          store: data.store || { tenants: {} },
          updated_at: probeAt
        })

      if (writeError) throw writeError

      toast.success(
        'Supabase terhubung',
        `Read/Write berhasil. Probe tersimpan pada ${new Date(probeAt).toLocaleString('id-ID')}.`
      )
    } catch (err) {
      toast.error('Supabase check gagal', humanizeUserMessage(err?.message || 'Gagal konek ke Supabase.', { fallback: 'Cek RLS policy dan environment variable.' }))
    } finally {
      setSupabaseCheckRunning(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="page-title-group">
          <span className="page-kicker">System Admin</span>
          <h1><Database size={24} style={{ display: 'inline', marginRight: 8 }} /> Integrasi Supabase</h1>
          <p>Tes koneksi read/write ke database Supabase. Pastikan environment variables VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY sudah dikonfigurasi dengan benar.</p>
        </div>
      </div>

      <div className="card card-pad mb-24">
        <h3 className="card-title mb-16">Tes Integrasi Supabase</h3>
        <p className="text-note mb-16">
          Jalankan pengecekan satu klik untuk memastikan koneksi <strong>read + write</strong> ke tabel <code>workspace_state</code> berjalan normal.
        </p>
        
        <div className="info-box mb-16">
          <div className="info-icon">
            <CheckCircle size={20} />
          </div>
          <div className="info-content">
            <div className="info-title">Yang diperiksa:</div>
            <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
              <li>Koneksi ke Supabase</li>
              <li>Read access ke tabel workspace_state</li>
              <li>Write access (upsert test)</li>
              <li>RLS (Row Level Security) policies</li>
            </ul>
          </div>
        </div>

        <div className="actions-left">
          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={runSupabaseIntegrationCheck} 
            disabled={supabaseCheckRunning}
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            {supabaseCheckRunning ? (
              <>
                <Loader2 size={18} className="spinner" /> Mengecek Supabase...
              </>
            ) : (
              <>
                <Database size={18} /> Tes Koneksi Supabase
              </>
            )}
          </button>
        </div>
      </div>

      <div className="card card-pad">
        <h3 className="card-title mb-16 card-title-inline">
          <AlertCircle size={18} /> Environment Variables
        </h3>
        <p className="text-note mb-16">
          Pastikan variabel berikut sudah di-set di file <code>.env</code>:
        </p>
        <pre style={{ 
          background: '#f3f4f6', 
          padding: '16px', 
          borderRadius: '8px',
          fontSize: '14px',
          overflow: 'auto'
        }}>
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
        </pre>
      </div>
    </div>
  )
}
