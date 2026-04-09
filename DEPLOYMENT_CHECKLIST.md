# Deployment Checklist - Vercel + Railway (Split Services)

Gunakan checklist ini untuk deployment production dengan 2 service backend:
- `api-server` (port 3002): tenant/user API, owner API, Firebase integration
- `wa-server` (port 3001): connect device, QR, send-ticket, WA delivery

## 1) Railway Services

- [ ] Service `api-server` online dan punya URL sendiri.
- [ ] Service `wa-server` online dan punya URL sendiri.
- [ ] `wa-server`: volume session WA terpasang dan `WA_AUTH_DATA_PATH` mengarah ke mount path (langkah di bagian **2b**).
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
- [ ] `WA_AUTH_DATA_PATH` (opsional) mengarah ke folder persisten jika pakai volume (lihat bagian di bawah).

## 2b) Railway: Volume persisten untuk session WhatsApp (wa-server)

Tanpa volume, folder session WA (`LocalAuth`) ikut hilang saat redeploy/restart container sehingga harus scan QR lagi. Data tenant di Firestore tetap aman; yang hilang hanya session login WA di server.

**Langkah di Railway (service `wa-server` saja):**

1. Buka service **wa-server** → **Settings** → **Volumes** (atau **Add volume** sesuai UI Railway).
2. Buat volume baru, lalu **mount** ke path di dalam container, misalnya:
   - **Mount path:** `/data/wa-auth`
3. Di **Variables** service yang sama, tambahkan:
   - `WA_AUTH_DATA_PATH=/data/wa-auth`
4. **Redeploy** service `wa-server`.
5. Setelah deploy, scan QR sekali per tenant; session akan tersimpan di volume dan **tetap ada setelah redeploy** (selama volume tidak dihapus).

**Cek cepat:** di log startup `wa-server`, cari field `auth_data_path` — harus sama dengan path mount + env di atas.

**Catatan:** Jika tidak pakai volume, jangan set variabel `WA_AUTH_DATA_PATH` (server memakai default folder `auth_data` di working directory; di Railway itu **tidak** persisten antar deploy).

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
