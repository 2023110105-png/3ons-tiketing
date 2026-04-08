# Launch Go/No-Go Checklist

Tanggal: __________  
PIC: __________

## 1) Deploy Status

- [ ] `main` terbaru sudah ter-deploy ke `wa-server` (Railway).
- [ ] `main` terbaru sudah ter-deploy ke `api-server` (Railway).
- [ ] Frontend (Vercel) sudah mengarah ke domain backend yang benar.
- [ ] Tidak ada deployment error di Railway/Vercel logs.

## 2) Environment Variables (Critical)

- [ ] `wa-server` punya `WA_ADMIN_SECRET` (tidak kosong).
- [ ] `wa-server` punya `CORS_ALLOWED_ORIGINS` valid.
- [ ] `api-server` punya `PLATFORM_ADMIN_SECRET` (tidak kosong).
- [ ] `api-server` punya `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`.
- [ ] Frontend punya `VITE_API_BASE_URL` dan `VITE_WA_BASE_URL` yang benar.

## 3) Health Check

- [ ] `GET /health` di `wa-server` return sukses.
- [ ] `GET /health` di `api-server` return `success: true`.
- [ ] Response `api-server /health` berisi `uptime_seconds` dan `request_id`.

## 4) WhatsApp Operational Check

- [ ] Status WA `ready` (device sudah connect).
- [ ] `test-send` berhasil ke 1 nomor internal.
- [ ] `send-ticket` berhasil kirim tiket gambar (bukan QR hitam polos).
- [ ] `WA Delivery` menampilkan status sukses/gagal dengan benar.

## 5) Scan Gate Critical Flow

- [ ] Scan kamera tiket valid => status diterima.
- [ ] Scan tiket yang sama dalam <5 detik => tidak double check-in.
- [ ] Manual check-in dari menu search => berhasil.
- [ ] Kasus hapus peserta -> tambah lagi -> scan kamera => berhasil.
- [ ] Kasus hapus peserta -> tambah lagi -> manual check-in => berhasil.
- [ ] Scan tiket hari berbeda => ditolak dengan alasan yang benar.

## 6) Scale and Reliability Check

- [ ] Jalankan endpoint stress test:
- [ ] `GET /api/wa/stress-qr-check?total=1000&render_sample=200&tenant_id=tenant-default&event_id=event-main`
- [ ] Hasil `serverVerify.fail = 0`.
- [ ] Jika render decode aktif, pastikan `renderDecode.fail = 0`.

## 7) Go/No-Go Decision

- [ ] Semua item critical (1-5) PASS => **GO LIVE**.
- [ ] Jika ada fail di item 4/5 => **NO-GO**, rollback plan aktif.

Keputusan akhir: **GO / NO-GO**  
Waktu keputusan: __________  
Approver: __________

## 8) Rollback Plan (Jika Diperlukan)

- [ ] Freeze broadcast WA sementara.
- [ ] Aktifkan manual check-in via search.
- [ ] Gunakan commit stabil terakhir di `main`.
- [ ] Informasikan tim ops + helpdesk (template pesan siap).

