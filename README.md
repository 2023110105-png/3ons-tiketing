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
cd wa-server
docker build -t 3ons-wa-server .
docker run -p 3001:3001 -e PORT=3001 3ons-wa-server
```

Penting:

1. Jangan taruh bot WhatsApp yang prosesnya panjang di Vercel.
2. Simpan session login pada storage yang persisten di server tersebut.
3. Jika backend diganti URL-nya, update `VITE_API_BASE_URL` di frontend.
