// Script tes otomatis endpoint /api/ticket/verify dengan payload QR v3-secure
// Jalankan: node test_ticket_verify.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const payload = {
  qr_data: '{"tid":"EVEN-D1-002","n":"nata","d":1,"t":"tenant-default","e":"efd7d7b6-f52a-4a78-8c67-f89f6b00b82c","r":"nzcirkyWA78Z7A","sig":"dGVuYW50LWRlZmF1bHR8ZWZkN2Q3YjYtZjUyYS00YTc4LThjNjctZjg5ZjZiMDBiODJjfEVWRU4tRDEtMDAyfDF8a1FYT1pwSUlveFk1RTljS2NCZEVpamRrfG56Y2lya3lXQTc4WjdBfGV2ZW50LXNlY3VyZS12Mw==","v":3}',
  tenant_id: 'tenant-default',
  secure_code: 'kQXOZpIIoxY5E9cKcBdEijdk',
  secure_ref: 'nzcirkyWA78Z7A'
};

fetch('http://localhost:3001/api/ticket/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(json => {
    console.log('Hasil verifikasi:', json);
  })
  .catch(err => {
    console.error('Error:', err);
  });
