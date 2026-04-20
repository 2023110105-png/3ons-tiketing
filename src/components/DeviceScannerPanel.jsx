/**
 * Device Scanner Panel Component
 * Panel untuk scan barcode peserta yang terhubung ke WA Server API
 */

import { useState, useRef, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { 
  Camera, CheckCircle, XCircle, AlertTriangle, RefreshCw, 
  History 
} from 'lucide-react'
import { useToast } from '../contexts/ToastContext'

export default function DeviceScannerPanel({ tenantId, userName, apiFetch }) {
  const toast = useToast()
  
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [isProcessingScan, setIsProcessingScan] = useState(false)
  const [scanHistory, setScanHistory] = useState([])
  const [facingMode, setFacingMode] = useState('environment')
  const lastScanRef = useRef({ data: null, time: 0 })
  const qrRef = useRef(null)
  const scannerRef = useRef(null)
  
  const handleScan = async (qrData) => {
    if (!qrData || isProcessingScan) return
    
    const now = Date.now()
    if (lastScanRef.current.data === qrData && now - lastScanRef.current.time < 3000) {
      return
    }
    lastScanRef.current = { data: qrData, time: now }
    
    setIsProcessingScan(true)
    setScanning(false)
    
    try {
      const res = await apiFetch('/api/device/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': `SCAN-${tenantId}`
        },
        body: JSON.stringify({
          qr_data: qrData,
          device_id: `DEV-${tenantId}`,
          gate: 'front',
          tenant_id: tenantId
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setScanResult({
          type: 'verified',
          data: data.data,
          rawQr: qrData,
          timestamp: new Date().toISOString()
        })
      } else {
        setScanResult({
          type: data.status === 'duplicate' ? 'duplicate' : 'error',
          message: data.error,
          data: data.data,
          rawQr: qrData,
          timestamp: new Date().toISOString()
        })
        
        addToScanHistory({
          ticket_number: data.data?.participant?.ticket_number || qrData.slice(0, 20),
          name: data.data?.participant?.name || '-',
          status: data.status,
          timestamp: new Date().toISOString(),
          message: data.error
        })
      }
    } catch (err) {
      console.error('Scan error:', err)
      setScanResult({
        type: 'error',
        message: 'Gagal terhubung ke server',
        rawQr: qrData,
        timestamp: new Date().toISOString()
      })
    } finally {
      setIsProcessingScan(false)
    }
  }
  
  const handleCheckIn = async (ticketNumber, participantData) => {
    setIsProcessingScan(true)
    
    try {
      const res = await apiFetch('/api/device/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Token': `SCAN-${tenantId}`
        },
        body: JSON.stringify({
          ticket_number: ticketNumber,
          device_id: `DEV-${tenantId}`,
          gate: 'front',
          verified_by: userName || 'Admin'
        })
      })
      
      const data = await res.json()
      
      if (data.success) {
        setScanResult({
          type: 'checked_in',
          message: data.message,
          data: data.data,
          timestamp: new Date().toISOString()
        })
        
        addToScanHistory({
          ticket_number: ticketNumber,
          name: data.data?.participant?.name || participantData?.name || '-',
          status: 'checked_in',
          timestamp: new Date().toISOString(),
          message: data.message
        })
        
        toast.success('Check-in berhasil!')
      } else {
        setScanResult({
          type: 'error',
          message: data.error || 'Gagal check-in',
          timestamp: new Date().toISOString()
        })
        toast.error(data.error || 'Gagal check-in')
      }
    } catch (err) {
      console.error('Check-in error:', err)
      toast.error('Gagal terhubung ke server')
    } finally {
      setIsProcessingScan(false)
    }
  }
  
  const addToScanHistory = (item) => {
    setScanHistory(prev => [item, ...prev.slice(0, 49)])
  }
  
  const clearScanResult = () => {
    setScanResult(null)
    setScanning(true)
  }
  
  const toggleCamera = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment'
    setFacingMode(newMode)
    // Restart scanner if active
    if (scanning && scannerRef.current) {
      stopScanner()
      setTimeout(() => startScanner(newMode), 500)
    }
  }
  
  const startScanner = async (mode = facingMode) => {
    if (!qrRef.current) return
    
    try {
      scannerRef.current = new Html5Qrcode('qr-reader-container')
      
      const cameras = await Html5Qrcode.getCameras()
      let cameraId = null
      
      if (cameras && cameras.length > 0) {
        // Try to find camera matching facing mode
        const backCamera = cameras.find(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('environment') || c.label.toLowerCase().includes('rear'))
        const frontCamera = cameras.find(c => c.label.toLowerCase().includes('front') || c.label.toLowerCase().includes('user') || c.label.toLowerCase().includes('selfie'))
        
        if (mode === 'environment' && backCamera) {
          cameraId = backCamera.id
        } else if (mode === 'user' && frontCamera) {
          cameraId = frontCamera.id
        } else {
          cameraId = cameras[0].id
        }
      }
      
      await scannerRef.current.start(
        cameraId || { facingMode: mode },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScan(decodedText)
        },
        () => {
          // Ignore scan errors (no QR found)
        }
      )
    } catch (err) {
      console.error('Scanner start error:', err)
      toast.error('Gagal memulai kamera')
    }
  }
  
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
        await scannerRef.current.clear()
      } catch (err) {
        console.error('Scanner stop error:', err)
      }
      scannerRef.current = null
    }
  }
  
  useEffect(() => {
    if (scanning) {
      startScanner()
    } else {
      stopScanner()
    }
    return () => {
      stopScanner()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning])

  return (
    <div className="card" style={{ padding: '20px' }}>
      <h2 style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Camera size={24} />
        Scan Barcode Peserta
      </h2>
      <p style={{ color: '#6b7280', marginBottom: '20px' }}>
        Arahkan kamera ke barcode tiket peserta untuk verifikasi dan check-in.
      </p>

      {!scanResult ? (
        <div style={{ maxWidth: '500px', margin: '0 auto' }}>
          <div style={{ 
            position: 'relative', 
            background: 'black', 
            borderRadius: '12px', 
            overflow: 'hidden',
            aspectRatio: '1'
          }}>
            {scanning ? (
              <>
                <div id="qr-reader-container" ref={qrRef} style={{ width: '100%', height: '100%' }} />
                
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    width: '250px',
                    height: '250px',
                    border: '2px solid rgba(255,255,255,0.5)',
                    borderRadius: '12px',
                    position: 'relative'
                  }}>
                    <div style={{ position: 'absolute', top: -2, left: -2, width: 20, height: 20, borderTop: '3px solid #3b82f6', borderLeft: '3px solid #3b82f6' }} />
                    <div style={{ position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderTop: '3px solid #3b82f6', borderRight: '3px solid #3b82f6' }} />
                    <div style={{ position: 'absolute', bottom: -2, left: -2, width: 20, height: 20, borderBottom: '3px solid #3b82f6', borderLeft: '3px solid #3b82f6' }} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderBottom: '3px solid #3b82f6', borderRight: '3px solid #3b82f6' }} />
                  </div>
                </div>
                
                <button
                  onClick={toggleCamera}
                  style={{
                    position: 'absolute',
                    bottom: '16px',
                    right: '16px',
                    padding: '12px',
                    background: 'rgba(255,255,255,0.2)',
                    backdropFilter: 'blur(4px)',
                    border: 'none',
                    borderRadius: '50%',
                    cursor: 'pointer'
                  }}
                >
                  <RefreshCw size={20} color="white" />
                </button>
              </>
            ) : (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%'
              }}>
                <button
                  onClick={() => setScanning(true)}
                  style={{
                    padding: '16px 32px',
                    background: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer'
                  }}
                >
                  <Camera size={20} style={{ marginRight: '8px', display: 'inline' }} />
                  Mulai Scan
                </button>
              </div>
            )}
          </div>
          
          {isProcessingScan && (
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <p>Memproses...</p>
            </div>
          )}
        </div>
      ) : (
        <div style={{ maxWidth: '400px', margin: '0 auto' }}>
          <div style={{
            padding: '24px',
            borderRadius: '12px',
            marginBottom: '16px',
            textAlign: 'center',
            color: 'white',
            background: scanResult.type === 'checked_in' ? '#16a34a' :
                       scanResult.type === 'verified' ? '#3b82f6' :
                       scanResult.type === 'duplicate' ? '#ca8a04' :
                       '#dc2626'
          }}>
            {scanResult.type === 'checked_in' && <CheckCircle size={64} style={{ margin: '0 auto 16px' }} />}
            {scanResult.type === 'verified' && <CheckCircle size={64} style={{ margin: '0 auto 16px' }} />}
            {scanResult.type === 'duplicate' && <AlertTriangle size={64} style={{ margin: '0 auto 16px' }} />}
            {scanResult.type === 'error' && <XCircle size={64} style={{ margin: '0 auto 16px' }} />}
            
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '8px' }}>
              {scanResult.type === 'checked_in' ? 'Check-in Berhasil!' :
               scanResult.type === 'verified' ? 'Tiket Valid' :
               scanResult.type === 'duplicate' ? 'Tiket Sudah Digunakan' :
               'Error'}
            </h3>
            
            {scanResult.message && <p>{scanResult.message}</p>}
            
            {scanResult.data?.participant && (
              <div style={{
                marginTop: '16px',
                padding: '16px',
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '8px'
              }}>
                <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{scanResult.data.participant.name}</p>
                <p style={{ fontSize: '14px', opacity: 0.9 }}>{scanResult.data.participant.ticket_number}</p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px' }}>
                  <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '12px' }}>
                    {scanResult.data.participant.category}
                  </span>
                  <span style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '12px' }}>
                    Day {scanResult.data.participant.day_number}
                  </span>
                </div>
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {scanResult.type === 'verified' && scanResult.data?.can_checkin && (
              <button
                onClick={() => handleCheckIn(
                  scanResult.data.participant.ticket_number,
                  scanResult.data.participant
                )}
                disabled={isProcessingScan}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: '#16a34a',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  opacity: isProcessingScan ? 0.5 : 1
                }}
              >
                {isProcessingScan ? 'Memproses...' : 'Konfirmasi Check-in'}
              </button>
            )}
            
            <button
              onClick={clearScanResult}
              disabled={isProcessingScan}
              style={{
                flex: 1,
                padding: '12px',
                background: '#4b5563',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Scan Lagi
            </button>
          </div>
        </div>
      )}

      {/* Scan History */}
      {scanHistory.length > 0 && (
        <div style={{ marginTop: '32px', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
          <h4 style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History size={18} />
            Riwayat Scan ({scanHistory.length})
          </h4>
          <div style={{ background: '#f9fafb', borderRadius: '8px', overflow: 'hidden' }}>
            {scanHistory.slice(0, 5).map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '12px',
                  borderBottom: idx < 4 ? '1px solid #e5e7eb' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div>
                  <p style={{ fontWeight: '500' }}>{item.name}</p>
                  <p style={{ fontSize: '12px', color: '#6b7280' }}>{item.ticket_number}</p>
                </div>
                <span style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: 'white',
                  background: item.status === 'checked_in' ? '#16a34a' :
                             item.status === 'duplicate' ? '#ca8a04' :
                             '#dc2626'
                }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
