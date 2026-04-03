# Firebase Validation Checklist (Final)

Gunakan checklist ini untuk memastikan sistem benar-benar berjalan dengan backend Firebase.

## 1) Konfigurasi Environment

- [ ] `VITE_USE_FIREBASE=true`
- [ ] `VITE_FIREBASE_AUTH_MODE=strict`
- [ ] `VITE_FIREBASE_DATA_MODE=strict`
- [ ] Semua variabel Firebase Web App terisi valid
- [ ] Tidak ada kredensial dummy di runtime deployment

## 2) Validasi Login

- [ ] Login user valid berhasil lewat Firebase Auth
- [ ] Login password salah ditolak dengan pesan error yang benar
- [ ] Akun tanpa email login ditolak di mode strict
- [ ] Logout menghapus sesi aktif

## 3) Validasi Data Admin (Participants)

- [ ] Tambah peserta muncul kembali setelah reload halaman
- [ ] Hapus peserta benar-benar hilang setelah reload
- [ ] Import peserta tersimpan dan terbaca ulang
- [ ] Filter hari/kategori/status konsisten dengan data terbaru

## 4) Validasi Gate Check-in

- [ ] Scan QR valid menghasilkan check-in sukses
- [ ] Scan QR duplikat ditolak sesuai aturan
- [ ] Status dashboard/check-in log update setelah scan
- [ ] Saat online kembali, pending queue tersinkron

## 5) Validasi Owner

- [ ] Perubahan tenant/user/kontrak tampil ulang setelah refresh
- [ ] Tab Alat IT hanya muncul untuk role owner
- [ ] Uji verifikasi server hanya dapat diakses dari Owner > Alat IT

## 6) Validasi Integrasi WA Server

- [ ] `GET /api/wa/status` merespons normal
- [ ] `POST /api/send-ticket` bekerja pada mode kirim yang dipilih
- [ ] Kegagalan WA tidak mengubah konsistensi data tiket/check-in

## 7) Kriteria Lulus

- [ ] Semua skenario di atas lulus tanpa fallback localStorage
- [ ] Tidak ada error bootstrap Firebase di console
- [ ] Tidak ada perbedaan data setelah reload browser
