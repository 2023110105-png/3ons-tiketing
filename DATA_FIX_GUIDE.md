# Panduan Fix Data Peserta & Kirim Tiket

## Masalah: "QR data tidak valid" / "data tidak terdaftar"

## Solusi: Auto-Generate QR di Server

Server sekarang bisa **auto-generate QR** kalau data peserta lengkap tapi QR kosong!

### Cara Kerja Baru

**Sebelumnya:**
- QR harus sudah ada di database
- Kalau kosong → Error 400

**Sekarang:**
- Server cek QR data
- Kalau kosong tapi ada `ticket_id` + `name` → **Auto-generate QR!**
- Kirim tetap berhasil 🎉

---

## Langkah Penggunaan

### 1. Restart WA Server
```bash
cd wa-server
npm start
```

### 2. Coba Kirim Lagi
1. Buka halaman **WA Delivery**
2. Klik **"Kirim ke Semua"**
3. Server akan auto-generate QR untuk peserta yang belum punya

### 3. Kalau Masih Ada yang Gagal

Gunakan **Validate & Fix** endpoint:

```javascript
// Di browser console atau Postman
fetch('http://localhost:3001/api/validate-participants', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-wa-admin-secret': 'local-dev-secret-3ons'
  },
  body: JSON.stringify({
    participants: [
      { ticket_id: 'T001', name: 'John', phone: '628xxx' },
      { ticket_id: 'T002', name: 'Jane', phone: '628xxx' }
    ]
  })
})
```

Response:
```json
{
  "success": true,
  "summary": {
    "total": 50,
    "valid": 45,
    "invalid": 2,
    "fixed": 3,
    "errors": []
  },
  "participants": [...] // dengan QR data
}
```

---

## Endpoint Baru

| Endpoint | Fungsi |
|----------|--------|
| `POST /api/validate-participants` | Validasi & auto-generate QR untuk banyak peserta |
| `POST /api/send-ticket` | Sekarang auto-generate QR kalau kosong |

---

## Catatan Penting

✅ **Data yang perlu ada untuk auto-generate:**
- `ticket_id` (wajib)
- `name` atau `nama` (wajib)
- `day_number` atau `day` atau `hari` (optional, default 1)

❌ **Kalau data tidak lengkap:**
- Tetap error 400
- Perlu diperbaiki manual di database

---

## Debug

Lihat log server:
```
[SEND-TICKET] Auto-generating QR for ticket=T120260015
[SEND-TICKET] QR auto-generated successfully for ticket=T120260015
```

Kalau ada error, akan muncul:
```
[SEND-TICKET-400] Empty QR data for ticket=T120260015
```

---

## Tips

1. **Selalu refresh browser** (F5) setelah update server
2. **Cek log server** untuk melihat proses auto-generate
3. **Batch kecil** (20-30) lebih aman dari rate limit
4. **Retry yang gagal** setelah cooldown 1-2 menit
