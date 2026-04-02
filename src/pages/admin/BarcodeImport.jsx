import { useState } from 'react';
import { apiFetch } from '../../utils/api';
import { getParticipants } from '../../store/mockData';
import './BarcodeImport.css';

export default function BarcodeImport() {
  const [sourceType, setSourceType] = useState('camera'); // camera, upload, manual_paste
  const [imageBase64, setImageBase64] = useState('');
  const [qrString, setQrString] = useState('');
  const [step, setStep] = useState(1); // 1: input, 2: preview, 3: verify, 4: result
  const [importData, setImportData] = useState(null);
  const [verifyResult, setVerifyResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ===== STEP 1: Capture/Upload Image =====
  const handleCameraCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result?.split(',')[1]; // remove data url prefix
      setImageBase64(base64);
      setStep(2);
    };
    reader.readAsDataURL(file);
  };

  // ===== STEP 2: Extract QR =====
  const handleExtractQR = async () => {
    setLoading(true);
    setError('');

    try {
      const payload = {
        tenant_id: 'tenant-default',
        source_type: sourceType,
        image_base64: imageBase64,
        ...(sourceType === 'manual_paste' && { qr_string: qrString })
      };

      const result = await apiFetch('/api/import/barcode', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (result.success) {
        setImportData(result.import_data);
        setStep(3); // Go to verify
        setError('');
      } else {
        setError(result.error || 'Ekstraksi QR gagal');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ===== STEP 3: Verify Signature =====
  const handleVerifyAndRegister = async () => {
    if (!importData) return;

    setLoading(true);
    setError('');

    try {
      // Get participant to get secure_code
      const allParticipants = getParticipants();
      const participant = allParticipants?.find(p => p.ticket_id === importData.ticket_id);

      if (!participant) {
        setError('Peserta tidak ditemukan di data event');
        setLoading(false);
        return;
      }

      if (!participant.secure_code || !participant.secure_ref) {
        setError('Peserta belum memiliki token keamanan. Jalankan Upgrade QR Aman terlebih dahulu.');
        setLoading(false);
        return;
      }

      const result = await apiFetch('/api/import/verify-and-register', {
        method: 'POST',
        body: JSON.stringify({
          ...importData,
          secure_code: participant.secure_code,
          verified_by: 'admin-import'
        })
      });

      setVerifyResult(result);
      setStep(4);
    } catch (err) {
      setError('Verifikasi gagal: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setImageBase64('');
    setQrString('');
    setImportData(null);
    setVerifyResult(null);
    setError('');
  };

  return (
    <div className="barcode-import-container">
      <div className="barcode-import">
        <h2>📱 Import Barcode Aman</h2>
        <p className="description">
          Verifikasi barcode dengan ekstraksi QR dan server-side signature check
        </p>

        {/* ===== STEP 1: Pilih Source ===== */}
        {step === 1 && (
          <div className="step-1">
            <h3>Langkah 1: Pilih Sumber Input</h3>
            <div className="source-buttons">
              <button
                className={`source-btn ${sourceType === 'camera' ? 'active' : ''}`}
                onClick={() => setSourceType('camera')}
              >
                📷 Ambil Foto
              </button>
              <button
                className={`source-btn ${sourceType === 'upload' ? 'active' : ''}`}
                onClick={() => setSourceType('upload')}
              >
                📤 Upload File
              </button>
              <button
                className={`source-btn ${sourceType === 'manual_paste' ? 'active' : ''}`}
                onClick={() => setSourceType('manual_paste')}
              >
                📝 Paste QR
              </button>
            </div>

            <div className="input-section">
              {sourceType === 'manual_paste' ? (
                <>
                  <label>Paste QR string di sini:</label>
                  <textarea
                    placeholder='Contoh: {"tid":"YMH-D1-001","t":"tenant-default","e":"event-1","d":1,"r":"A1B2C3","sig":"...","v":3}'
                    value={qrString}
                    onChange={(e) => setQrString(e.target.value)}
                    rows="6"
                    className="qr-textarea"
                  />
                </>
              ) : (
                <>
                  <label>
                    {sourceType === 'camera' ? 'Ambil foto QR Code' : 'Upload file gambar QR'}:
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCameraCapture}
                    className="file-input"
                  />
                  {!imageBase64 && (
                    <p className="hint">
                      Format: JPG, PNG (maksimal 5MB)
                    </p>
                  )}
                </>
              )}
            </div>

            {error && <div className="error-box">{error}</div>}

            <button
              onClick={handleExtractQR}
              disabled={loading || (!imageBase64 && sourceType !== 'manual_paste') || (!qrString && sourceType === 'manual_paste')}
              className="btn-primary btn-large"
            >
              {loading ? 'Extracting...' : 'Extract & Validasi QR'}
            </button>
          </div>
        )}

        {/* ===== STEP 2: Preview ===== */}
        {step === 2 && imageBase64 && (
          <div className="step-2">
            <h3>Langkah 2: Preview Gambar</h3>
            <div className="preview-container">
              <img
                src={`data:image/png;base64,${imageBase64}`}
                alt="preview"
                className="preview-image"
              />
            </div>
            <div className="button-group">
              <button onClick={() => setStep(1)} className="btn-secondary">
                ← Kembali
              </button>
              <button onClick={handleExtractQR} disabled={loading} className="btn-primary">
                {loading ? 'Extracting...' : 'Lanjutkan Extract'}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 3: Verify ===== */}
        {step === 3 && importData && (
          <div className="step-3">
            <h3>Langkah 3: Verifikasi Signature</h3>
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

            {error && <div className="error-box">{error}</div>}

            <div className="button-group">
              <button onClick={() => setStep(1)} className="btn-secondary">
                ← Mulai Ulang
              </button>
              <button
                onClick={handleVerifyAndRegister}
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Verifying...' : '✅ Verify & Register'}
              </button>
            </div>
          </div>
        )}

        {/* ===== STEP 4: Result ===== */}
        {step === 4 && verifyResult && (
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
                  <strong>Alasan:</strong> {verifyResult.reason}
                </p>
                <p className="message">{verifyResult.message}</p>
                {verifyResult.mode && (
                  <p className="mode">Mode: {verifyResult.mode}</p>
                )}
              </div>
            )}

            <div className="button-group">
              <button onClick={handleReset} className="btn-primary btn-large">
                📱 Import Barcode Lagi
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
