# Runbook Gate 1 Halaman (Siap Print)

Durasi briefing: 5-10 menit.

Gunakan runbook ini khusus untuk tim gate scanner saat hari H.

## 1) Start Shift (T-10 Menit)

- [ ] Jalankan backend aman: `npm run wa:start:safe`
- [ ] Jalankan frontend: `npm run dev`
- [ ] Buka halaman scanner gate di perangkat operasional.
- [ ] Pastikan kamera scanner aktif.
- [ ] Pastikan internet stabil.

## 2) Validasi Keamanan (Admin)

- [ ] Di halaman Generate QR, klik `Upgrade QR Aman (Hari X)`.
- [ ] Klik `Test Server Verify`.
- [ ] Pastikan hasil semua skenario `OK`.

Jika ada `FAIL`, jangan mulai check-in massal sebelum diperbaiki.

## 3) Aturan Saat Scan

- Scan valid: izinkan masuk.
- Status `SUDAH CHECK-IN`: tolak duplikat, arahkan ke helpdesk.
- Status `SALAH HARI`: tolak, arahkan ke loket informasi.
- Status `VERIFIKASI SERVER GAGAL`: anggap tiket tidak valid, arahkan ke helpdesk.

## 4) Cek Keamanan di Layar Gate

Setiap hasil scan menampilkan:

- `Security: v3-secure` atau `legacy-v2`
- `Ref` token internal dalam bentuk mask, contoh `***A1B2C3`

Catatan:
- Nilai token penuh tidak ditampilkan ke peserta.
- Jika masih `legacy-v2`, minta admin jalankan upgrade QR aman.

## 5) Prosedur Jika Internet Putus

- Tetap lakukan scan (masuk antrean offline).
- Jangan restart aplikasi berulang.
- Saat internet kembali, lakukan sinkronisasi antrean.
- Pastikan antrean kembali `0` sebelum shift berakhir.

## 6) Incident Playbook (Maks 15 Menit)

Menit 0-3:
- Catat jam kejadian dan gejala.
- Uji 1 tiket valid.

Menit 3-7:
- Cek status server dan koneksi perangkat.
- Refresh scanner 1 kali.

Menit 7-12:
- Aktifkan alur manual/helpdesk jika perlu.

Menit 12-15:
- Jika pulih, lanjutkan operasi.
- Jika belum pulih, eskalasi ke PIC teknis.

## 7) Handover Akhir Shift

- [ ] Total scan sukses: ______
- [ ] Total ditolak duplikat: ______
- [ ] Total invalid signature/server verify fail: ______
- [ ] Pending offline tersisa: ______
- [ ] Catatan insiden diserahkan ke shift berikutnya.

PIC Gate: __________
Tanggal: __________
Jam Shift: __________
