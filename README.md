# 3oNs Project Platform

## Deployment Model

Frontend React/Vite dapat di-deploy ke Vercel. Bot WhatsApp tidak disarankan berjalan di Vercel karena prosesnya panjang, butuh Chromium/Puppeteer, dan harus menjaga session login tetap hidup.

Pola yang disarankan:

1. Frontend di Vercel.
2. `api-server` (Express) di Railway sebagai API utama (data, auth, laporan).
3. `wa-server` di Railway sebagai service khusus WhatsApp (connect device, send, retry).
4. Frontend membaca URL backend dari environment variable.
5. Lindungi endpoint backend menggunakan secret dan Firebase Auth.

Contoh:

```bash
VITE_API_BASE_URL=https://api.domain-anda.com
VITE_WA_BASE_URL=https://wa.domain-anda.com
VITE_WA_ADMIN_SECRET=isi-sama-dengan-secret-backend
```

## Local Development

Untuk development lokal, gunakan proxy Vite ke backend di port `3001`.

Run:

```bash
npm run start:tablet
```

## Backend

Server WA mendukung `PORT` dari environment supaya mudah dipindah ke hosting lain.

## Deployment Yang Disarankan

### Frontend di Vercel

Set environment variable berikut di project Vercel:

```bash
VITE_API_BASE_URL=https://api.domain-anda.com
VITE_WA_BASE_URL=https://wa.domain-anda.com
VITE_WA_ADMIN_SECRET=isi-sama-dengan-secret-backend
```

### API Server (Express) di Railway

Buat service baru `api-server` dari repo ini (folder `api-server`).

Environment variables yang wajib di Railway (api-server):

```bash
PORT=3002

# CORS: domain frontend yang diizinkan (pisah koma)
CORS_ALLOWED_ORIGINS=https://your-vercel.app,https://your-domain.com

# Firebase Admin (service account)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

Catatan:
- `FIREBASE_PRIVATE_KEY` biasanya harus memakai `\n` (escaped newline).
- Endpoint uji cepat:
  - `GET /health`
  - `GET /me` (butuh Authorization Bearer token)
  - `GET /api/tenants` (role owner)

### Bot WA di server selalu hidup

Bangun image dari folder `wa-server` lalu jalankan pada VPS/Render/Railway/Fly.io.

Contoh build lokal:

```bash
docker build -f wa-server/Dockerfile -t 3ons-wa-server .
docker run -p 3001:3001 -e PORT=3001 3ons-wa-server
```

### Deploy cepat ke Render

Gunakan file [render.yaml](render.yaml) untuk membuat service backend dari repo ini. Setelah service aktif, set `VITE_API_BASE_URL` di Vercel ke URL Render yang diberikan.

Untuk login WhatsApp yang stabil, pastikan storage `auth_data` dipasang sebagai disk persisten di path `/app/wa-server/auth_data` pada service Render.

### Deploy cepat ke Railway

Gunakan [railway.json](railway.json) agar Railway memakai Dockerfile di folder `wa-server`.

Langkah umum:

1. Jika service Railway sudah ada, pastikan yang dipakai adalah service backend `wa-server`.
2. Tambahkan volume atau storage persisten untuk folder `/app/wa-server/auth_data`.
3. Set `PORT=3001` bila Railway meminta port eksplisit.
4. Set `WA_ADMIN_SECRET` pada service backend Railway.
5. Set `CORS_ALLOWED_ORIGINS` berisi domain frontend yang diizinkan (pisah koma jika lebih dari satu).
6. Ambil public URL service Railway, misalnya:
   - `https://api-service.up.railway.app` (api-server)
   - `https://wa-service.up.railway.app` (wa-server)
7. Isi `VITE_API_BASE_URL`, `VITE_WA_BASE_URL`, dan `VITE_WA_ADMIN_SECRET` di frontend Vercel.
8. Redeploy frontend Vercel setelah env diubah.

Contoh:

```bash
VITE_API_BASE_URL=https://api-service.up.railway.app
VITE_WA_BASE_URL=https://wa-service.up.railway.app
VITE_WA_ADMIN_SECRET=isi-sama-dengan-secret-backend
```

Penting:

1. Jangan taruh bot WhatsApp yang prosesnya panjang di Vercel.
2. Simpan session login pada storage yang persisten di server tersebut.
3. Jika backend diganti URL-nya, update `VITE_API_BASE_URL` di frontend.
4. `WA_ADMIN_SECRET` (backend) dan `VITE_WA_ADMIN_SECRET` (frontend) harus sama.

## Checklist Final

1. Deploy `wa-server` ke Render atau Railway.
2. Pastikan storage persisten untuk `auth_data` aktif.
3. Catat URL backend yang diberikan hosting.
4. Set `VITE_API_BASE_URL` (api-server) dan `VITE_WA_BASE_URL` (wa-server) di Vercel.
5. Deploy frontend ke Vercel.
6. Buka halaman Connect Device dan scan QR sekali.
7. Uji kirim tiket dari halaman peserta.
