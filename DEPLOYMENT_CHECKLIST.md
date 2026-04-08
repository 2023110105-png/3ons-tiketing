# Deployment Checklist - Vercel + Railway (Split Services)

Gunakan checklist ini untuk deployment production dengan 2 service backend:
- `api-server` (port 3002): tenant/user API, owner API, Firebase integration
- `wa-server` (port 3001): connect device, QR, send-ticket, WA delivery

## 1) Railway Services

- [ ] Service `api-server` online dan punya URL sendiri.
- [ ] Service `wa-server` online dan punya URL sendiri.
- [ ] `wa-server` memakai storage persisten untuk folder `auth_data`.
- [ ] Kedua service tidak restart loop.

## 2) Railway Environment Variables

### api-server
- [ ] `PORT=3002`
- [ ] `CORS_ALLOWED_ORIGINS` berisi domain frontend production.
- [ ] `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` terisi.
- [ ] `PLATFORM_ADMIN_SECRET` terisi (bukan nilai default).
- [ ] `API_DEV_BYPASS_AUTH=false`

### wa-server
- [ ] `PORT=3001`
- [ ] `CORS_ALLOWED_ORIGINS` berisi domain frontend production.
- [ ] `WA_ADMIN_SECRET` terisi (bukan nilai default).
- [ ] `TICKET_SIGNING_SECRET` terisi.

## 3) Vercel Environment Variables

Set di project frontend (Production):

- [ ] `VITE_API_BASE_URL=https://<api-server>.up.railway.app`
- [ ] `VITE_PLATFORM_API_BASE_URL=https://<api-server>.up.railway.app`
- [ ] `VITE_WA_BASE_URL=https://<wa-server>.up.railway.app`
- [ ] `VITE_PLATFORM_ADMIN_SECRET=<sama dengan PLATFORM_ADMIN_SECRET di api-server>`
- [ ] `VITE_WA_ADMIN_SECRET=<sama dengan WA_ADMIN_SECRET di wa-server>`

Setelah update env, lakukan redeploy Vercel.

## 4) Health Check Production

### api-server URL
- [ ] `GET /health` -> 200
- [ ] `GET /health/deep` -> 200

### wa-server URL
- [ ] `GET /health` -> 200 dan `ok: true`
- [ ] `GET /api/wa/status?tenant_id=tenant-default` -> response valid

## 5) Smoke Test Aplikasi

- [ ] Login owner/admin berhasil.
- [ ] Halaman `Connect Device` menampilkan status WA.
- [ ] Bootstrap session on login berjalan (QR muncul saat diperlukan).
- [ ] Kirim 1 tiket uji dari `Participants` berhasil.
- [ ] Entri delivery muncul di `WA Delivery`.

## 6) Troubleshooting Cepat

**Connect Device gagal / WA offline**
- Pastikan `VITE_WA_BASE_URL` mengarah ke service `wa-server`, bukan `api-server`.
- Pastikan `VITE_WA_ADMIN_SECRET` sama dengan `WA_ADMIN_SECRET`.
- Cek `wa-server` logs untuk status `qr`, `ready`, `disconnected`.

**Owner API Unauthorized**
- Pastikan `VITE_PLATFORM_ADMIN_SECRET` sama dengan `PLATFORM_ADMIN_SECRET`.
- Pastikan `VITE_PLATFORM_API_BASE_URL` mengarah ke `api-server`.

**CORS blocked**
- Tambahkan domain Vercel production ke `CORS_ALLOWED_ORIGINS` di kedua service.

## 7) Go / No-Go

- **GO** jika health check + smoke test lolos semua.
- **NO-GO** jika ada endpoint health gagal, secret mismatch, atau flow kirim tiket gagal.
