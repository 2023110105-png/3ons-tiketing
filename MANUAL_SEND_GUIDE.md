# Panduan Pengiriman Barcode Manual

## Ringkasan Fitur

Sistem ini menyediakan cara mudah untuk mengirim barcode tiket secara manual dengan design yang **sama persis** dengan pengiriman otomatis WA Bot.

## Cara Menggunakan

### 1. Akses Menu QR Generate
1. Buka menu **Tiket > QR Generate**
2. Pilih peserta dari daftar
3. Klik tombol **Kirim Manual** (ikon pesawat kertas)

### 2. Kirim Tiket Manual
1. Modal akan muncul dengan preview tiket
2. Masukkan nomor WhatsApp tujuan (format: 08123456789)
3. Klik tombol **Kirim Tiket**
4. Sistem akan mengirim dengan retry otomatis (max 4x retry)

### 3. Hasil Pengiriman
- **Sukses**: Badge hijup muncul, data tersimpan
- **Gagal**: Error message ditampilkan, bisa retry

## Design Tiket (Sama dengan WA Bot)

Tiket yang dikirim manual menggunakan design yang identik dengan WA Bot otomatis:

| Element | Implementasi |
|---------|--------------|
| Header | "E-Attendance" + Nama Event |
| Category Badge | Warna sesuai kategori (VIP=merah, Dealer=biru, Media=kuning, Regular=hijau) |
| QR Panel | Border berwarna kategori + perforation line |
| Info Grid | ID TICKET, DAY, CATEGORY |
| Footer | Instruksi scan + tanggal/event |

**Backend Renderer**: `wa-server/ticket-image-jimp.js`  
**Frontend Renderer**: `src/pages/admin/QRGenerate.jsx` (Canvas)

## Sinkronisasi Data Manual vs Otomatis

### Sumber Data Utama: Supabase
```
┌─────────────────┐
│   Supabase DB   │
│  (participants) │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌───────┐ ┌─────────┐
│Manual │ │Auto Bot │
│ Send  │ │ (WA)    │
└───────┘ └─────────┘
```

### Alur Sinkronisasi

#### 1. QR Data Generation
```javascript
// Fungsi: ensureParticipantQRData()
// Lokasi: QRGenerate.jsx & ManualSendModal.jsx

if (participant.qr_data exists and valid) {
    → Gunakan QR data yang ada
} else {
    → Generate QR data baru dengan generateQRData()
    → Simpan ke Supabase (participants.qr_data)
    → Return participant dengan QR data
}
```

#### 2. Pengiriman Manual
```javascript
// ManualSendModal.jsx → apiFetch('/api/send-ticket')

Request Body:
{
  ...participant,           // Data dari Supabase
  tenant_id: 'tenant-default',
  phone: normalizedPhone, // Format: 628123456789
  send_wa: true,
  wa_message: generatedMessage,
  wa_send_mode: 'message_with_barcode'
}
```

#### 3. Retry Mechanism (Manual & Otomatis Sama)
```javascript
RETRY_DELAYS = [1000, 2000, 4000, 8000]  // Exponential backoff
MAX_RETRIES = 4

for (attempt = 0 to MAX_RETRIES) {
    → Kirim request
    if (success) return { success: true }
    if (nonRetryableError) return { success: false }
    → Delay sebelum retry
}
```

### Status Sinkronisasi

| Field | Deskripsi | Update Oleh |
|-------|-----------|-------------|
| `qr_data` | QR code encrypted string | `ensureParticipantQRData()` - generate & simpan ke Supabase |
| `qr_locked` | Boolean: QR sudah dikirim? | ManualSend / Auto Bot - set true setelah kirim |
| `updated_at` | Timestamp last update | Auto update by Supabase |

### Konsistensi Data

#### Scenario 1: Kirim Manual → Status di WaDelivery
1. User kirim manual via QRGenerate
2. API mencatat log ke `wa_send_log` table
3. WaDelivery.jsx membaca log yang sama
4. Status tampil konsisten di kedua halaman

#### Scenario 2: Kirim Otomatis → Lihat di QRGenerate
1. Bot kirim otomatis ke peserta
2. `participants.qr_locked` = true
3. QRGenerate.jsx load data dari Supabase
4. Badge "Terkirim" muncul di daftar peserta

#### Scenario 3: Edit Nomor → Kirim Ulang
1. Edit nomor WA di database (Settings/Participant)
2. QRGenerate.jsx auto-refresh dari Supabase
3. Nomor baru tersedia untuk kirim manual
4. WaDelivery.jsx juga melihat nomor baru

## API Endpoint untuk Manual Send

```
POST /api/send-ticket
```

**Request Body**:
```json
{
  "id": "participant-uuid",
  "ticket_id": "TICKET-001",
  "name": "John Doe",
  "phone": "628123456789",
  "qr_data": "encrypted-qr-string",
  "category": "VIP",
  "day_number": 1,
  "tenant_id": "tenant-default",
  "send_wa": true,
  "wa_message": "Halo John Doe...",
  "wa_send_mode": "message_with_barcode"
}
```

**Response**:
```json
{
  "success": true,
  "message": "WhatsApp message sent",
  "data": {
    "ticket_id": "TICKET-001",
    "status": "sent",
    "timestamp": "2026-04-10T12:00:00Z"
  }
}
```

## Keunggulan Sistem

1. **Design Konsisten** - Manual & otomatis menggunakan renderer yang sama
2. **Retry Otomatis** - Smart retry dengan exponential backoff
3. **Validasi Real-time** - Phone number validation sebelum kirim
4. **Preview Before Send** - Lihat tiket sebelum dikirim
5. **Status Tracking** - Semua pengiriman tercatat di WaDelivery

## Troubleshooting

| Problem | Solusi |
|---------|--------|
| QR tidak generate | Pastikan `id` peserta valid di Supabase |
| Kirim gagal terus | Cek koneksi WA di WaDelivery > Connect |
| Nomor salah | Edit di database, lalu retry |
| Preview tidak muncul | Refresh halaman, generate QR dulu |

## File-file Terkait

| File | Fungsi |
|------|--------|
| `src/components/ManualSendModal.jsx` | Modal UI untuk kirim manual |
| `src/pages/admin/QRGenerate.jsx` | Halaman generate QR dengan tombol manual send |
| `wa-server/ticket-image-jimp.js` | Backend image renderer |
| `api-server/src/services/whatsappService.js` | Service layer WA dengan queue & retry |
