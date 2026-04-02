# 🚀 Deployment Checklist - Vercel + Railway

## Backend (Railway) ✅
- [x] Service `yamaha-scan-tiketing` deployed ke Railway
- [x] Status: **Online**
- [x] Public URL: `https://yamaha-scan-tiketing-production.up.railway.app`
- [x] Storage persisten untuk `auth_data` aktif

## Frontend (Vercel) - Langkah Selanjutnya

### 1. Set Environment Variable di Vercel

**Step-by-step:**
1. Buka project frontend di [Vercel Dashboard](https://vercel.com/dashboard)
2. Klik **Settings** → **Environment Variables**
3. Klik **Add** atau **+ Add New**
4. Isi form:
   - **Name:** `VITE_API_BASE_URL`
   - **Value:** `https://yamaha-scan-tiketing-production.up.railway.app`
   - **Environments:** Pilih **Production** (atau semua jika ingin development juga)
5. Klik **Save**

### 2. Redeploy Frontend

Setelah env variable disimpan, Vercel akan otomatis redeploy. Atau trigger manual:
1. Buka **Deployments**
2. Pilih deployment terbaru
3. Klik **Redeploy** (kalau env belum ter-apply)

Tunggu status berubah menjadi **Ready**.

### 3. Test Koneksi Backend

1. Buka aplikasi frontend Vercel yang sudah redeploy
2. Navigasi ke halaman **Connect Device** (di menu admin)
3. Tunggu loading sekitar 3-5 detik
4. Cek apakah:
   - ✅ **QR Code muncul** = Backend connected! Scan dengan WhatsApp Web
   - ❌ **"Bot Server Terputus"** = Ada masalah, kirim screenshot error

### 4. Uji Fitur Bot (Opsional)

Kalau QR code sudah muncul dan login berhasil:
1. Buka halaman **Peserta**
2. Tambah peserta baru dengan nomor WhatsApp yang valid
3. Centang **"Simpan & Auto-Kirim"**
4. Cek apakah pesan WhatsApp terkirim ke nomor itu

---

## Environment Variable Summary

```bash
VITE_API_BASE_URL=https://yamaha-scan-tiketing-production.up.railway.app
```

Di Vercel, URL ini akan digunakan oleh semua API calls dari:
- `src/pages/admin/ConnectDevice.jsx` (status WA)
- `src/pages/admin/Participants.jsx` (kirim tiket)
- `src/store/mockData.js` (auto-send)

---

## Troubleshooting

**"Bot Server Terputus" tetap muncul?**
- Cek apakah `VITE_API_BASE_URL` sudah disimpan di Vercel env
- Pastikan deployment sudah selesai (status **Ready**)
- Cek apakah Railway service masih **Online**
- Buka browser dev tools → Console untuk melihat error HTTP

**Tidak bisa kirim tiket?**
- Pastikan nomor WhatsApp format benar (dengan 62)
- Cek apakah WhatsApp di Railway sudah login (scan QR)
- Lihat logs di Railway untuk error detailnya

---

**Status:** Siap deploy ke production ✅
