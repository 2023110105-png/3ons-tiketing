# Go / No-Go 10 Menit Sebelum Launch

Gunakan checklist ini tepat sebelum buka akses user production.

## 1) Environment & Secrets
- [ ] `api-server` production env terisi lengkap: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`, `PLATFORM_ADMIN_SECRET`.
- [ ] `wa-server` production env terisi lengkap: `WA_ADMIN_SECRET`, `TICKET_SIGNING_SECRET`, `CORS_ALLOWED_ORIGINS`.
- [ ] Tidak ada secret default lokal (`local-platform-admin-secret`, `local-dev-secret`) di production.
- [ ] Firebase service-account key yang pernah terekspos sudah di-rotate.

## 2) Service Health
- [ ] `api-server` `GET /health` -> `200`.
- [ ] `api-server` `GET /health/deep` -> `200`.
- [ ] `wa-server` `GET /health` -> `ok: true`.
- [ ] Tidak ada restart loop / crash berulang di logs 5-10 menit terakhir.

## 3) Multi-Tenant Readiness
- [ ] Tenant aktif launch sudah benar (bukan tenant test/default).
- [ ] Tenant launch pada `Connect Device` status `ready`.
- [ ] Endpoint session menunjukkan tenant launch `isReady: true`.
- [ ] Tenant baru bisa dipilih tanpa error CORS/Unauthorized.

## 4) Critical User Flows (Smoke Test)
- [ ] Owner: buat user tenant baru -> sukses.
- [ ] Owner: reset password user tenant -> sukses.
- [ ] Admin: tambah 1 peserta baru -> sukses tersimpan.
- [ ] Admin: kirim 1 tiket WA -> sukses.
- [ ] WA Delivery: entri pengiriman muncul dengan status yang sesuai.

## 5) Broadcast Safety
- [ ] Broadcast 1-3 peserta uji -> mayoritas sukses.
- [ ] Jika ada gagal, reason tampil jelas (bukan error generik).
- [ ] Tidak ada mismatch tenant antara halaman Peserta, Connect Device, dan WA Delivery.
- [ ] Nomor invalid terdeteksi/dilewati dengan notifikasi yang jelas.

## 6) Observability & Recovery
- [ ] Logs memuat request status, path, dan error code (structured logs aktif).
- [ ] Ada satu orang standby monitor logs 30 menit pertama setelah launch.
- [ ] Rollback plan siap (commit/image sebelumnya sudah diketahui).
- [ ] Komando restart service diketahui tim operasional.

## 7) Keputusan Launch
- [ ] **GO** jika semua poin blok 1-4 terpenuhi, dan block 5 tidak ada blocker.
- [ ] **NO-GO** jika ada kegagalan di health, auth, tenant readiness, atau kirim tiket dasar.

## Catatan Eksekusi Cepat
- Jika `CORS blocked`: cek `CORS_ALLOWED_ORIGINS` terhadap domain frontend production.
- Jika `Unauthorized`: cek `VITE_PLATFORM_ADMIN_SECRET` frontend dan `PLATFORM_ADMIN_SECRET` backend.
- Jika WA `qr` terus: reset session tenant dan scan ulang QR terbaru, pastikan tenant yang benar.

## SOP Operator: Connect Device Massal (1 Server, Multi Tenant)

Tujuan: memastikan 5 tenant bisa connect paralel tanpa bentrok session/QR dalam satu proses `wa-server`.

### A) Persiapan (2 menit)
- [ ] Pastikan `wa-server` hidup stabil (tidak restart loop) minimal 3-5 menit terakhir.
- [ ] Pastikan `GET /health` `ok: true`.
- [ ] Siapkan daftar tenant yang akan connect (maks 5 tenant per batch awal).
- [ ] Pastikan setiap operator tahu tenant mana yang dia pegang (hindari salah scan QR tenant).

### B) Eksekusi Batch Connect (3-4 menit)
- [ ] Trigger status/check untuk semua tenant target secara berurutan cepat (tenant-1 s/d tenant-5).
- [ ] Tunggu status tiap tenant berubah ke `qr`.
- [ ] Scan QR per tenant sesuai label tenant yang benar.
- [ ] Setelah scan, pastikan status tenant berubah dari `qr/checking` ke `ready`.

### C) Validasi Anti-Bentrok (1-2 menit)
- [ ] Konfirmasi tiap tenant menampilkan QR berbeda (tidak reuse QR tenant lain).
- [ ] Konfirmasi tiap tenant punya status session sendiri (tidak saling overwrite).
- [ ] Lakukan 1 kirim pesan uji dari 2 tenant berbeda, keduanya harus sukses.

### D) Batas Aman Operasional
- [ ] Rekomendasi launch: 3-5 tenant connect bersamaan per gelombang.
- [ ] Jika tenant > 5, lakukan gelombang berikutnya setelah gelombang pertama `ready`.
- [ ] Hindari spam refresh status terlalu rapat; beri jeda polling 1-2 detik per tenant.

### E) Recovery Cepat Jika Stuck
- [ ] Jika tenant stuck `checking` > 60 detik: refresh status tenant tersebut sekali.
- [ ] Jika tenant stuck `qr` > 3 menit: reset session tenant lalu scan QR terbaru.
- [ ] Jika banyak timeout endpoint batch: pecah menjadi batch kecil (2-3 tenant dulu).
- [ ] Jika `ready` lalu drop `offline`: cek koneksi internet server dan login WhatsApp device.

### F) Keputusan Operasional
- [ ] **Lanjut GO** jika semua tenant target sudah `ready` dan uji kirim minimal 1 pesan sukses per tenant sampel.
- [ ] **Tunda** jika ada tenant kritikal yang tidak bisa keluar dari `checking/qr` setelah recovery 2 siklus.
