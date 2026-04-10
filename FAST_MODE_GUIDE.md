# WA Server Fast Mode Guide

## Problem: Response Time Tinggi (1740ms+)

Response time tinggi untuk endpoint `/api/send-ticket` disebabkan oleh:

1. **isRegisteredUser check** (~500-1000ms) - Validasi nomor ke WhatsApp server
2. **QR Image generation** (~300-500ms) - Generate gambar tiket
3. **Timeout panjang** (45 detik) - Tunggu terlalu lama

## Solusi: Fast Mode

### 1. Update .env WA Server

Tambahkan ke `wa-server/.env`:

```env
# FAST MODE: Skip nomor validation untuk kecepatan
WA_FAST_MODE=true
WA_MESSAGE_TIMEOUT_MS=15000
```

### 2. Restart WA Server

```bash
cd wa-server
npm start
```

### 3. Verifikasi Fast Mode Aktif

Di console WA server akan muncul:
```
[CONFIG] WA FAST MODE enabled - skipping number validation, reduced timeouts
```

## Perbandingan Performa

| Mode | isRegisteredUser | Timeout | Est. Response Time |
|------|-----------------|---------|-------------------|
| Normal | Yes (500-1000ms) | 45s | 1500-2500ms |
| **Fast** | **No (0ms)** | **15s** | **500-1000ms** |

## Trade-off

**Keuntungan Fast Mode:**
- ✅ 2-3x lebih cepat
- ✅ Lebih banyak pesan terkirim per menit
- ✅ Lebih sedikit timeout

**Risiko Fast Mode:**
- ⚠️ Tidak ada validasi nomor WA (bisa kirim ke nomor invalid)
- ⚠️ Retry lebih sedikit (1x vs 3x)
- ⚠️ Timeout lebih pendek (15s vs 45s)

## Rekomendasi

- **Gunakan Fast Mode** untuk kirim massal ke peserta yang nomornya sudah tervalidasi
- **Gunakan Normal Mode** untuk kirim pertama kali atau nomor yang belum diverifikasi

## Logging

Fast mode akan log:
```
[WA SEND] Mulai kirim ke 628xxx (ticket_id: T001) fast=true
[WA SEND IMAGE] ... gen_time=245ms
[WA SEND] Sukses kirim ke 628xxx time=567ms
```
