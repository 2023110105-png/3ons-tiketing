# 3oNs Project Platform

## Deployment Model

Frontend React/Vite dapat di-deploy ke Vercel. Bot WhatsApp tidak disarankan berjalan di Vercel karena prosesnya panjang, butuh Chromium/Puppeteer, dan harus menjaga session login tetap hidup.

Pola yang disarankan:

1. Frontend di Vercel.
2. `wa-server` di VPS, Render, Railway, Fly.io, atau server selalu aktif.
3. Frontend membaca URL backend dari environment variable `VITE_API_BASE_URL`.

Contoh:

```bash
VITE_API_BASE_URL=https://bot-api.domain-anda.com
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
VITE_API_BASE_URL=https://bot-api.domain-anda.com
```

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
4. Ambil public URL service Railway, misalnya `https://nama-service.up.railway.app`.
5. Isi `VITE_API_BASE_URL` di frontend Vercel dengan URL tersebut.
6. Redeploy frontend Vercel setelah env diubah.

Contoh:

```bash
VITE_API_BASE_URL=https://nama-service.up.railway.app
```

Penting:

1. Jangan taruh bot WhatsApp yang prosesnya panjang di Vercel.
2. Simpan session login pada storage yang persisten di server tersebut.
3. Jika backend diganti URL-nya, update `VITE_API_BASE_URL` di frontend.

## Checklist Final

1. Deploy `wa-server` ke Render atau Railway.
2. Pastikan storage persisten untuk `auth_data` aktif.
3. Catat URL backend yang diberikan hosting.
4. Set `VITE_API_BASE_URL` di Vercel ke URL backend itu.
5. Deploy frontend ke Vercel.
6. Buka halaman Connect Device dan scan QR sekali.
7. Uji kirim tiket dari halaman peserta.
