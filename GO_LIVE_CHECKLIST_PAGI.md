# Go-Live Checklist Pagi (Tenant Default Mode)

Checklist ini dipakai untuk validasi terakhir sebelum aplikasi diberikan ke user.
Fokus: stabil, real-time, dan data konsisten.

## 1) Pre-Deploy (Wajib)

- [ ] Pastikan branch `main` terbaru sudah ter-pull di environment deploy.
- [ ] Deploy backend Railway terbaru.
- [ ] Deploy frontend Vercel terbaru.
- [ ] Buka aplikasi via mode incognito (hindari cache lama).
- [ ] Jika PWA sudah terpasang, uninstall dulu lalu install ulang.

## 2) Login & Scope Check

- [ ] Login sebagai owner: pastikan mode owner menampilkan menu aman (mode rilis pagi).
- [ ] Login sebagai admin tenant default: pastikan dashboard dan peserta terbuka normal.
- [ ] Login sebagai gate1 dan gate2: pastikan halaman gate terbuka tanpa error.

## 3) Data Integrity: Delete Permanen Peserta

- [ ] Di admin, tambah 1 peserta dummy: `TEST-HAPUS-1`.
- [ ] Hapus peserta dummy dengan alasan valid.
- [ ] Refresh halaman admin -> data tidak muncul lagi.
- [ ] Buka gate1/gate2 -> data tidak muncul.
- [ ] Logout/login ulang -> data tetap tidak muncul.

Kriteria lulus:
- Peserta yang dihapus tidak kembali setelah refresh/hydrate/relogin.

## 4) QR Consistency: Buat -> Kirim WA -> Scan

- [ ] Tambah 1 peserta baru dengan nomor WA valid.
- [ ] Catat `ticket_id`.
- [ ] Kirim tiket via WA mode **message_with_barcode**.
- [ ] Pastikan di menu QR status peserta jadi **Terkirim**.
- [ ] Coba edit nama/hari peserta tersebut.

Kriteria lulus:
- Edit nama/hari ditolak untuk tiket yang sudah terkirim barcode.
- QR tetap immutable (tidak berubah dari yang terkirim ke WA).

## 5) Scan Gate (Validasi Kritis)

- [ ] Scan QR peserta di gate1 -> status sukses.
- [ ] Scan QR yang sama lagi di gate1 -> status duplikat.
- [ ] Lihat gate2 monitor -> log check-in muncul hampir real-time.
- [ ] Lihat admin peserta -> status check-in ikut ter-update.

Kriteria lulus:
- Hasil scan konsisten di admin, gate1, gate2 tanpa refresh manual panjang.

## 6) Manual Check-In Integration

- [ ] Cari peserta yang belum check-in via mode search/manual di gate.
- [ ] Lakukan manual check-in.
- [ ] Verifikasi di gate2 + admin bahwa status sama-sama berubah.

Kriteria lulus:
- Manual dan scan kamera masuk ke sumber data yang sama.

## 7) Offline Queue Safety

- [ ] Matikan internet sementara di gate1.
- [ ] Scan 1 tiket (masuk antrean offline).
- [ ] Nyalakan internet kembali.
- [ ] Jalankan sinkronisasi antrean.

Kriteria lulus:
- Item antrean berhasil tersinkron atau ada alasan gagal yang jelas.
- Tidak terjadi data ganda.

## 8) WhatsApp Delivery Sanity

- [ ] Uji kirim single ticket (1 peserta) -> sukses.
- [ ] Uji broadcast kecil (3-5 peserta) -> mayoritas sukses.
- [ ] Verifikasi template pesan sesuai dan menyertakan barcode pada mode barcode.
- [ ] Uji mode `message_only` pada 1 peserta dummy.

Kriteria lulus:
- Pengiriman tidak error massal.
- Pesan sesuai mode (`message_with_barcode` / `message_only`).
- Mode `message_only` tidak mengunci QR (peserta masih bisa diedit nama/hari sebelum kirim barcode).

## 9) Owner Critical Ops

- [ ] Owner buka Kelola Pengguna.
- [ ] Hapus 1 user uji (bukan user utama).
- [ ] Pastikan tidak error CORS/404 untuk operasi utama.
- [ ] Cek response sukses create/update/delete user mengandung `request_id`.

Kriteria lulus:
- Operasi owner kritikal berjalan normal di environment deploy.
- Jika gagal, log error memuat `request_id` untuk memudahkan tracing backend.

## 9b) Platform Routing Health (Production)

- [ ] Jalankan health check dari Owner tools.
- [ ] Pastikan endpoint runtime WA (`/api/wa/runtime`) lolos.
- [ ] Uji satu aksi owner user (mis. update nama user) untuk memastikan path `/api/platform/...` berjalan.

Kriteria lulus:
- Tidak ada fallback ke SPA page HTML saat health check.
- Jalur API production konsisten via rewrite Vercel.

## 10) Invoice PDF

- [ ] Buka menu tagihan owner.
- [ ] Cetak 1 invoice.
- [ ] Verifikasi file PDF terunduh dan terbuka normal.

Kriteria lulus:
- Tidak muncul `about:blank`.
- PDF format profesional dan dapat dibuka.

## 11) Final Sign-Off (Go/No-Go)

Tandai GO hanya jika semua di bawah terpenuhi:

- [ ] Delete permanen peserta lulus.
- [ ] QR immutable setelah terkirim barcode lulus.
- [ ] Realtime admin-gate1-gate2 lulus.
- [ ] Scan + manual check-in terintegrasi lulus.
- [ ] WA delivery sanity lulus.
- [ ] Owner critical ops lulus.
- [ ] Invoice PDF lulus.

Jika salah satu gagal -> **NO-GO**, perbaiki dulu lalu ulang test bagian terkait.

## Catatan Operasional Saat Handover

- Gunakan hanya tenant default (sesuai konfigurasi saat ini).
- Hindari perubahan struktur/fitur besar menjelang live pagi.
- Simpan bukti test (screenshot singkat) untuk setiap poin kritis.
