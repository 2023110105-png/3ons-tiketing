import { useState } from 'react';
import { apiFetch } from '../../utils/api';
import { getParticipants } from '../../store/mockData';
import './BarcodeImport.css';

function mapImportError(message = '', reason = '') {
  const raw = String(message || reason || '').toLowerCase();
  if (raw.includes('extract') || raw.includes('gambar') || raw.includes('parse image')) {
    return 'QR belum terbaca. Coba foto ulang dengan jarak lebih dekat dan cahaya cukup.';
  }
  if (raw.includes('tenant') || raw.includes('brand')) {
    return 'Tiket ini bukan untuk event/brand ini. Arahkan ke meja bantuan.';
  }
  if (raw.includes('tidak valid') || raw.includes('format')) {
    return 'Format QR tidak sesuai. Coba scan ulang atau gunakan tiket yang benar.';
  }
  if (raw.includes('secure') || raw.includes('token keamanan')) {
    return 'Data keamanan tiket belum siap. Jalankan Upgrade QR Aman lebih dulu.';
  }
  if (raw.includes('not found') || raw.includes('tidak ditemukan')) {
    return 'Data peserta tidak ditemukan. Periksa tiket atau arahkan ke helpdesk.';
  }
  if (raw.includes('signature') || raw.includes('dimanipulasi')) {
    return 'QR tidak cocok dengan data server. Tiket ditolak, arahkan ke helpdesk.';
  }
  return 'Proses verifikasi belum berhasil. Coba ulang sekali lagi.';
}

export default function BarcodeImport() {
  const [sourceType, setSourceType] = useState('camera');
  const [imageBase64, setImageBase64] = useState('');
  const [qrString, setQrString] = useState('');
  const [processingStep, setProcessingStep] = useState('idle'); // idle | extracting | verifying | done
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [importData, setImportData] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [error, setError] = useState('');

  const loading = processingStep === 'extracting' || processingStep === 'verifying';

  const resetState = () => {
    setImageBase64('');
    setQrString('');
    setImportData(null);
    setVerifyResult(null);
    setError('');
    setProcessingStep('idle');
  };

  const verifyImportData = async (nextImportData) => {
    setProcessingStep('verifying');
    const allParticipants = getParticipants();
    const participant = allParticipants?.find(p => p.ticket_id === nextImportData.ticket_id);

    if (!participant) {
      setError(mapImportError('peserta tidak ditemukan'));
      setProcessingStep('done');
      return;
    }

    if (!participant.secure_code || !participant.secure_ref) {
      setError(mapImportError('token keamanan tidak ada'));
      setProcessingStep('done');
      return;
    }

    const verifyResponse = await apiFetch('/api/import/verify-and-register', {
      method: 'POST',
      body: JSON.stringify({
        ...nextImportData,
        secure_code: participant.secure_code,
        verified_by: 'admin-import'
      })
    });

    setVerifyResult(verifyResponse);
    if (!verifyResponse?.valid) {
      setError(mapImportError(verifyResponse?.message, verifyResponse?.reason));
    } else {
      setError('');
    }
    setProcessingStep('done');
  };

  // Auto-process after image selected: extract then verify in one flow
  const processImport = async ({ nextSourceType, base64, manualQr }) => {
    setVerifyResult(null);
    setError('');
    setProcessingStep('extracting');

    try {
      const payload = {
        tenant_id: 'tenant-default',
        source_type: nextSourceType,
        image_base64: base64,
        ...(nextSourceType === 'manual_paste' && { qr_string: manualQr })
      };

      const extractResponse = await apiFetch('/api/import/barcode', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (!extractResponse?.success || !extractResponse?.import_data) {
        setImportData(null);
        setError(mapImportError(extractResponse?.error));
        setProcessingStep('done');
        return;
      }

      setImportData(extractResponse.import_data);
      await verifyImportData(extractResponse.import_data);
    } catch (err) {
      setError(mapImportError(err?.message));
      setProcessingStep('done');
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = String(reader.result || '').split(',')[1] || '';
      setImageBase64(base64);
      await processImport({ nextSourceType: sourceType, base64, manualQr: '' });
    };
    reader.readAsDataURL(file);
  };

  const handleManualProcess = async () => {
    if (!qrString.trim()) return;
    await processImport({ nextSourceType: 'manual_paste', base64: '', manualQr: qrString.trim() });
  };

  return (
    <div className="barcode-import-container">
      <div className="barcode-import">
        <h2>📱 Import Barcode Aman</h2>
        <p className="description">
          Verifikasi barcode dengan ekstraksi QR dan server-side signature check
        </p>

        <div className="step-1">
          <h3>Scan cepat: pilih sumber lalu sistem verifikasi otomatis</h3>
          <div className="source-buttons">
            <button
              className={`source-btn ${sourceType === 'camera' ? 'active' : ''}`}
              onClick={() => setSourceType('camera')}
              disabled={loading}
            >
              📷 Ambil Foto
            </button>
            <button
              className={`source-btn ${sourceType === 'upload' ? 'active' : ''}`}
              onClick={() => setSourceType('upload')}
              disabled={loading}
            >
              📤 Upload File
            </button>
          </div>

          <div className="input-section">
            <label>
              {sourceType === 'camera' ? 'Ambil foto QR Code' : 'Upload file gambar QR'}:
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="file-input"
              disabled={loading}
            />
            <p className="hint">Setelah file dipilih, sistem langsung proses otomatis.</p>
          </div>

          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced(v => !v)}
            type="button"
          >
            {showAdvanced ? 'Sembunyikan Mode Advanced' : 'Tampilkan Mode Advanced (Manual Paste)'}
          </button>

          {showAdvanced && (
            <div className="advanced-box">
              <label>Mode advanced: paste QR string (khusus admin)</label>
              <textarea
                placeholder='Contoh: {"tid":"YMH-D1-001","t":"tenant-default","e":"event-1","d":1,"r":"A1B2C3","sig":"...","v":3}'
                value={qrString}
                onChange={(e) => setQrString(e.target.value)}
                rows="5"
                className="qr-textarea"
              />
              <button
                onClick={handleManualProcess}
                disabled={loading || !qrString.trim()}
                className="btn-primary btn-large"
              >
                {loading ? 'Memproses...' : 'Proses Manual'}
              </button>
            </div>
          )}

          {loading && (
            <div className="status-box status-info">
              {processingStep === 'extracting' ? 'Memproses QR dari gambar...' : 'Memverifikasi tiket ke server...'}
            </div>
          )}

          {error && <div className="error-box">{error}</div>}

          {!loading && processingStep === 'done' && !verifyResult?.valid && (
            <div className="button-group">
              <button onClick={resetState} className="btn-secondary">Coba Lagi</button>
            </div>
          )}

          {imageBase64 && (
            <div className="preview-container">
              <img src={`data:image/png;base64,${imageBase64}`} alt="preview" className="preview-image" />
            </div>
          )}
        </div>

        {!loading && importData && (
          <div className="step-3">
            <h3>Ringkasan tiket yang diproses</h3>
            <div className="import-data-preview">
              <div className="data-row">
                <span className="label">Ticket ID:</span>
                <span className="value">{importData.ticket_id}</span>
              </div>
              <div className="data-row">
                <span className="label">Event:</span>
                <span className="value">{importData.event_id}</span>
              </div>
              <div className="data-row">
                <span className="label">Hari:</span>
                <span className="value">Hari {importData.day_number}</span>
              </div>
              <div className="data-row">
                <span className="label">Security Mode:</span>
                <span className="value">
                  <code>v{importData.version}</code>
                  {importData.version >= 3 && ' (Aman)'}
                </span>
              </div>
              <div className="data-row">
                <span className="label">Ref (Masked):</span>
                <span className="value">***{importData.secure_ref?.slice(-6)}</span>
              </div>
            </div>
          </div>
        )}

        {processingStep === 'done' && verifyResult && (
          <div className={`step-4 result-${verifyResult.valid ? 'success' : 'fail'}`}>
            <div className="result-icon">
              {verifyResult.valid ? '✅' : '❌'}
            </div>
            <h3 className="result-title">
              {verifyResult.valid ? 'IMPORT BERHASIL' : 'IMPORT GAGAL'}
            </h3>

            {verifyResult.valid && (
              <div className="success-details">
                <div className="ticket-display">
                  <p className="ticket-id">{verifyResult.secure_display.ticket_id}</p>
                  <p className="security-mode">
                    🔒 Security: {verifyResult.secure_display.security_mode}
                  </p>
                  <p className="ref-masked">
                    Ref {verifyResult.secure_display.ref_masked}
                  </p>
                </div>
                <p className="timestamp">
                  ✓ Terverifikasi: {new Date().toLocaleString('id-ID')}
                </p>
              </div>
            )}

            {!verifyResult.valid && (
              <div className="error-details">
                <p className="reason">
                  <strong>Status:</strong> Verifikasi gagal
                </p>
                <p className="message">{error || mapImportError(verifyResult.message, verifyResult.reason)}</p>
                {verifyResult.mode && (
                  <p className="mode">Mode: {verifyResult.mode}</p>
                )}
              </div>
            )}

            <div className="button-group">
              <button onClick={resetState} className="btn-primary btn-large">
                📱 Import Barcode Lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
