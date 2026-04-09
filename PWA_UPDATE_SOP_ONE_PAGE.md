# PWA Update SOP (Hari H)

Tujuan: memastikan user Android/iOS selalu pakai versi aplikasi terbaru setelah deploy, dengan downtime minimal.

## 1) Sebelum Deploy (2-3 menit)

- Pastikan build terakhir sukses.
- Pastikan URL produksi sudah benar dan bisa dibuka normal di browser biasa.
- Catat waktu deploy (jam:menit) untuk patokan verifikasi.

## 2) Setelah Deploy (Verifikasi cepat 5 menit)

### Android (Chrome)

1. Buka aplikasi dari icon homescreen.
2. Tunggu 10-20 detik (service worker cek update).
3. Tutup aplikasi dari recent apps.
4. Buka lagi dari icon homescreen.
5. Cek fitur kritikal:
   - Login
   - Daftar peserta muncul
   - Scan barcode berhasil

### iOS (Safari + Add to Home Screen)

1. Buka app dari icon homescreen.
2. Tunggu 10-20 detik.
3. Swipe up dan tutup app.
4. Buka ulang dari icon homescreen.
5. Cek fitur kritikal yang sama.

## 3) Tanda Update Berhasil

- Tampilan terbaru muncul (jika ada perubahan UI).
- Data peserta/scan berjalan normal.
- Tidak muncul error "Loading chunk" atau "Failed to import module".

## 4) Jika User Masih Dapat Versi Lama

Lakukan berurutan (stop jika sudah normal):

1. Minta user tutup app full, lalu buka lagi.
2. Minta user refresh 1x dari browser utama:
   - Android: Chrome -> buka URL -> refresh
   - iOS: Safari -> buka URL -> refresh
3. Buka lagi dari icon homescreen.
4. Jika masih lama, reinstall shortcut homescreen:
   - Hapus icon app dari homescreen (tidak menghapus server data).
   - Buka URL dari browser.
   - Add to Home Screen lagi.

## 5) Jika Muncul Error Chunk/Module

Gejala umum:
- "Loading chunk failed"
- "Failed to fetch dynamically imported module"

Tindakan:

1. Buka URL app di browser utama.
2. Hard refresh:
   - Windows: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`
3. Tutup browser tab, buka ulang URL.
4. Masuk lagi via icon homescreen.

## 6) Checklist Operasional per Shift

- [ ] 1 device Android terverifikasi update
- [ ] 1 device iOS terverifikasi update
- [ ] Login admin normal
- [ ] Import peserta normal
- [ ] Scan gate normal
- [ ] WA delivery page normal

## 7) Eskalasi (Jika > 10 menit belum normal)

- Kumpulkan:
  - Screenshot error
  - Device + OS version
  - Browser (Chrome/Safari) + versi
  - Jam kejadian
- Kirim ke tim teknis untuk analisa lanjutan.

