# 3oNs Ticketing Platform

> **Multi-Tenant Event Management SaaS** — Frontend React/Vite, Data Layer Supabase (PostgreSQL + Realtime), WhatsApp Gateway Service Express.

## 📋 Ringkasan Eksekutif

3oNs Ticketing adalah platform manajemen acara berbasis multi-tenant yang memungkinkan admin sistem, admin tenant, dan gate user untuk mengelola event, pendaftaran peserta, pembuatan tiket, check-in berbasis QR, serta notifikasi otomatis melalui WhatsApp. Arsitektur dirancang cloud-native dengan pemisahan frontend (serverless) dan WA gateway (persistent service) untuk keandalan dan skalabilitas.

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────┐
│  CLIENT LAYER                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ System Admin │  │ Tenant Admin │  │  Gate User   │      │
│  │  (Browser)   │  │  (Browser)   │  │  (Tablet)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         └─────────────────┴─────────────────┘              │
│                           │                                │
└───────────────────────────┼────────────────────────────────┘
                            │
┌───────────────────────────┼────────────────────────────────┐
│  FRONTEND LAYER           │                                │
│  React 19 · Vite 7 ·      │                                │
│  Tailwind CSS 4           │                                │
│                           │                                │
└───────────────────────────┼────────────────────────────────┘
                            │  Supabase REST / Realtime WS
┌───────────────────────────┼────────────────────────────────┐
│  DATA & AUTH LAYER        │                                │
│  Supabase (PostgreSQL)    │                                │
│  · Row Level Security     │                                │
│  · Realtime subscriptions │                                │
│  · JWT Auth               │                                │
└───────────────────────────┼────────────────────────────────┘
                            │  HTTP (REST)
┌───────────────────────────┼────────────────────────────────┐
│  WA GATEWAY SERVICE       │                                │
│  Express · whatsapp-web.js│                                │
│  · QR pairing             │                                │
│  · Kirim tiket / reminder │                                │
│  · Retry & queue          │                                │
└───────────────────────────┴────────────────────────────────┘
```

## 🛠️ Teknologi Stack

| Lapisan | Teknologi | Versi |
|---------|-----------|-------|
| Frontend Framework | React | ^19.2.4 |
| Build Tool | Vite | ^7.0.0 |
| Styling | Tailwind CSS | ^4.2.2 |
| Database & Auth | Supabase (PostgreSQL + Realtime) | ^2.103.0 |
| QR Processing | html5-qrcode, jimp, jsqr | — |
| PDF / Excel | jspdf, jspdf-autotable, xlsx | — |
| Charting | recharts, chart.js | — |
| WA Gateway | whatsapp-web.js | ^1.23.0 |
| WA Runtime | Express, Puppeteer (Chromium) | ^4.18.2 |
| Test Runner | Vitest (jsdom) | ^4.1.2 |

## 📁 Struktur Repositori

```
.
├── src/                        # Aplikasi frontend (React)
│   ├── components/             # Komponen UI reusable
│   ├── contexts/               # React Context (Auth, dsb.)
│   ├── hooks/                  # Custom hooks
│   ├── pages/                  # Halaman berbasis route
│   ├── services/               # Service layer (auth, tenant)
│   ├── api/                    # Client Supabase
│   └── lib/                    # Utilities & dataSync
├── wa-server/                  # WhatsApp Gateway Service
│   ├── index.js                # Entry point Express
│   ├── whatsapp-service.js     # Inisialisasi WhatsApp client
│   ├── ticket-image-jimp.js    # Generator gambar tiket
│   ├── Dockerfile              # Container image WA service
│   └── routes/                 # Router API WA service
├── supabase/                   # Migration & schema SQL
├── scripts/                    # Script bantu operasional
├── render.yaml                 # Konfigurasi deploy Render
├── railway.json                # Konfigurasi deploy Railway
└── docker-compose.yml          # Compose lokal (opsional)
```

## ⚙️ Prasyarat

- Node.js ≥ 18.x
- npm ≥ 9.x
- Akun [Supabase](https://supabase.com) dengan project aktif
- Akun [Vercel](https://vercel.com) (untuk frontend)
- Hosting persistent untuk `wa-server` (Render, Railway, VPS, atau Fly.io)
- Docker (opsional, untuk build WA service secara lokal)

## 🖥️ Pengembangan Lokal

### 1. Instalasi Dependensi

```bash
npm install
```

### 2. Konfigurasi Environment

Salin file contoh dan sesuaikan nilainya:

```bash
cp .env.example .env
```

Variabel minimal untuk development:

| Variabel | Nilai Contoh | Keterangan |
|----------|--------------|------------|
| `VITE_SUPABASE_URL` | `https://<project>.supabase.co` | URL project Supabase |
| `VITE_SUPABASE_ANON_KEY` | `<anon-public-key>` | Anon key Supabase |
| `VITE_WA_BASE_URL` | `http://localhost:3001` | Base URL WA gateway lokal |
| `VITE_WA_ADMIN_SECRET` | `dev-secret-123` | Secret antara frontend ↔ WA service |

### 3. Menjalankan WA Gateway (Terminal #1)

```bash
cd wa-server
npm install
npm start
```

Service akan berjalan di `http://localhost:3001`. Pastikan folder `auth_data/` tersedia untuk penyimpanan session.

### 4. Menjalankan Frontend (Terminal #2)

```bash
# Mode proxy ke WA service lokal
npm run start:tablet
```

Frontend akan dilayani oleh Vite Dev Server dengan proxy otomatis ke `localhost:3001`.

## 🔐 Variabel Lingkungan Produksi

### Frontend (Vercel)

| Variabel | Contoh | Deskripsi |
|----------|--------|-----------|
| `VITE_API_BASE_URL` | `https://<project>.supabase.co` | Base URL Supabase (REST) |
| `VITE_WA_BASE_URL` | `https://wa.yourdomain.com` | Public URL WA gateway |
| `VITE_WA_ADMIN_SECRET` | `super-secret-key` | Secret admin untuk komunikasi frontend ↔ WA service |

### WA Service (Render / Railway / VPS)

| Variabel | Wajib | Contoh | Deskripsi |
|----------|-------|--------|-----------|
| `PORT` | Ya | `3001` | Port HTTP yang didengar service |
| `WA_ADMIN_SECRET` | Ya | `super-secret-key` | Harus identik dengan `VITE_WA_ADMIN_SECRET` |
| `CORS_ALLOWED_ORIGINS` | Ya | `https://app.yourdomain.com,https://admin.yourdomain.com` | Origin frontend yang diizinkan, dipisahkan koma |
| `SUPABASE_URL` | Ya | `https://<project>.supabase.co` | URL project Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Ya | `<service-role-key>` | Service role key untuk akses database dari server |

> **Peringatan Keamanan:** Jangan men-deploy `wa-server` ke platform serverless (Vercel, Netlify Functions, AWS Lambda) karena service membutuhkan proses panjang, instance Chromium via Puppeteer, dan persistensi session WhatsApp.

## 🚀 Panduan Deployment

### A. Frontend di Vercel

1. Import repositori ke Vercel.
2. Atur **Framework Preset** ke `Vite`.
3. Tambahkan environment variables di bagian **Project Settings → Environment Variables**.
4. Deploy.

### B. WA Gateway di Render

1. Tambahkan service **Web** baru dengan environment `Docker`.
2. Pilih repositori ini dan arahkan Dockerfile ke `wa-server/Dockerfile`.
3. Pasang **Disk** persisten:
   - **Mount Path:** `/app/wa-server/auth_data`
   - **Size:** 1 GB (cukup untuk session storage)
4. Set environment variables sesuai tabel di atas.
5. Deploy service.

> Render menyediakan file `render.yaml` di root repo untuk **Blueprints** deploy otomatis.

### C. WA Gateway di Railway

1. Import project ke Railway.
2. Pastikan Railway membaca `railway.json` agar build menggunakan Dockerfile pada folder `wa-server`.
3. Tambahkan **Volume** persisten untuk mount path `/app/wa-server/auth_data`.
4. Set `PORT=3001` dan variabel lainnya.
5. Catat public domain service (misal: `https://wa-service.up.railway.app`).
6. Update `VITE_WA_BASE_URL` di Vercel dengan domain tersebut, lalu redeploy frontend.

### D. Build Docker Lokal

```bash
docker build -f wa-server/Dockerfile -t 3ons-wa-server:latest .
docker run -d \
  -p 3001:3001 \
  -e PORT=3001 \
  -e WA_ADMIN_SECRET=<secret> \
  -e CORS_ALLOWED_ORIGINS=https://app.yourdomain.com \
  -v wa-auth-data:/app/wa-server/auth_data \
  --name 3ons-wa \
  3ons-wa-server:latest
```

## 📡 Referensi Endpoint WA Server

| Method | Endpoint | Auth | Deskripsi |
|--------|----------|------|-----------|
| `GET` | `/health` | — | Health check service |
| `GET` | `/qr` | Secret | Mendapatkan status & QR code pairing |
| `POST` | `/send-message` | Secret | Mengirim pesan WhatsApp ke nomor tertentu |
| `POST` | `/send-ticket` | Secret | Mengirim gambar tiket ke peserta |
| `POST` | `/broadcast` | Secret | Broadcast pesan ke multiple nomor |

Header autentikasi untuk endpoint terproteksi:

```http
x-admin-secret: <WA_ADMIN_SECRET>
```

## 🔒 Rekomendasi Keamanan & Operasional

1. **Isolasi Tenant:** Platform mendukung multi-tenant melalui skema Row Level Security (RLS) di Supabase. Pastikan setiap tabel produksi memiliki policy RLS aktif.
2. **Secret Rotation:** Rotasi `WA_ADMIN_SECRET` secara berkala. Pastikan nilai identik antara environment backend dan frontend.
3. **Persistensi Session:** Jangan hapus folder `auth_data` di production kecuali melakukan re-pairing. Kehilangan data session mengharuskan scan QR ulang.
4. **CORS Restriction:** Selalu batasi `CORS_ALLOWED_ORIGINS` ke domain frontend produksi; hindari wildcard (`*`) di environment produksi.
5. **Resource Limits:** `wa-server` membutuhkan RAM ≥ 512 MB karena overhead Chromium. Pilih tier hosting yang mendukung proses persistent.

## ✅ Checklist Go-Live

- [ ] Database Supabase telah di-migrate dengan schema lengkap.
- [ ] RLS policies aktif untuk semua tabel tenant.
- [ ] `wa-server` di-deploy ke hosting persistent dengan disk volume terpasang.
- [ ] Environment variables frontend (Vercel) telah diisi dan divalidasi.
- [ ] `VITE_WA_BASE_URL` mengarah ke public URL WA gateway.
- [ ] `VITE_WA_ADMIN_SECRET` dan `WA_ADMIN_SECRET` memiliki nilai identik.
- [ ] QR code berhasil di-scan melalui halaman **Connect Device**.
- [ ] Uji end-to-end: kirim tiket dari halaman peserta → diterima di WhatsApp.
- [ ] Uji check-in: scan QR tiket → status hadir tersimpan.

## 📄 Lisensi

Proyek ini bersifat privat internal. Distribusi dan penggunaan kode di luar lingkup organisasi memerlukan izin tertulis dari pemilik repositori.
