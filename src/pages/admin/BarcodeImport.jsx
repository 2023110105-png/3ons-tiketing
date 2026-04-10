
import { fetchFirebaseWorkspaceSnapshot } from '../../lib/dataSync';
import { useState, useEffect } from 'react';
// import { apiFetch } from '../../utils/api';
// import { useAuth } from '../../contexts/useAuth';
import './BarcodeImport.css';

// Semua fungsi utilitas yang tidak dipakai dihapus agar kode bersih

export default function BarcodeImport() {
  const [participants, setParticipants] = useState([]);

  useEffect(() => {
    const load = async () => {
      const snapshot = await fetchFirebaseWorkspaceSnapshot();
      const tenantId = 'tenant-default';
      const eventId = 'event-default';
      const data = snapshot?.store?.tenants?.[tenantId]?.events?.[eventId]?.participants || [];
      setParticipants(data);
    };
    load();
  }, []);

  return (
    <div className="barcode-import-container">
      <h2>Daftar Barcode Peserta</h2>
      <div className="barcode-list">
        {participants.length === 0 && <div>Tidak ada data peserta.</div>}
        {participants.map((p) => (
          <div key={p.ticket_id} className="barcode-item">
            <div><strong>{p.name}</strong> ({p.ticket_id})</div>
            <div>Hari: {p.day_number}</div>
            <div>Kategori: {p.category}</div>
            <div>
              {p.qr_data && (
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(p.qr_data)}`} alt="QR" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
