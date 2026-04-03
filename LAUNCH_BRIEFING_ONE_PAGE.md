# Briefing Launch 1 Halaman

Dokumen ini dipakai untuk keputusan Go/No-Go sebelum acara dimulai (durasi briefing: 5-10 menit).

## 1. Status Saat Ini (Update Terbaru)
- Backend WA server hidup (`/health` merespons OK).
- Endpoint status WA merespons normal (`/api/wa/status`).
- Semua test otomatis lulus (`24/24`).
- UI Admin sudah bersih dari output teknis IT.
- Alat verifikasi teknis dipindah ke Owner > Alat IT.
- Alur data utama sudah diarahkan ke mode Firebase strict (tanpa fallback localStorage saat strict aktif).

## 2. Keputusan Launch
- Rekomendasi: `GO BERSYARAT`.
- Syarat wajib sebelum Go final:
	- [ ] Variabel runtime Firebase produksi sudah terisi valid.
	- [ ] Login strict Firebase diuji minimal 2 akun (berhasil dan gagal).
	- [ ] Uji kirim tiket WA end-to-end 1 peserta berhasil.
	- [ ] Uji scan QR valid dan invalid di gate berhasil.

## 3. Cek Cepat Pra-Shift (Wajib)
- [ ] Admin bisa login.
- [ ] Halaman Peserta, Scan, dan Laporan bisa dibuka.
- [ ] WhatsApp status minimal `qr`/`ready`.
- [ ] Broadcast percobaan ke 1 nomor internal berhasil.
- [ ] Internet perangkat operator stabil.

## 4. SOP Gangguan 15 Menit
- Menit 0-3: Konfirmasi gejala + ulangi 1 aksi utama.
- Menit 3-7: Cek WA session + koneksi internet + refresh halaman.
- Menit 7-12: Aktifkan jalur manual (WA manual / antrean offline scan).
- Menit 12-15: Jika belum pulih, eskalasi ke tim teknis.

## 5. Jalur Operasional Aman
- Pengiriman tiket: bot WA otomatis, fallback WA manual jika layanan kirim gagal.
- Check-in gate: tetap lanjut dengan antrean offline, sinkron saat koneksi pulih.
- Validasi teknis: hanya tim owner/IT yang menjalankan Owner > Alat IT.

## 6. Template Komunikasi Singkat
- Respon awal: "Terima kasih, laporan diterima. Tim sedang cek sekarang."
- Update: "Proses perbaikan berjalan. Update berikutnya maksimal 15 menit."
- Penutupan: "Kendala sudah selesai. Silakan dicoba kembali."

## 7. Penutupan Shift
- [ ] Rekap tiket terkirim dan gagal.
- [ ] Rekap check-in sukses dan anomali.
- [ ] Pastikan antrean offline kosong atau tercatat.
- [ ] Catatan insiden diserahkan ke shift berikutnya.

PIC Shift: __________
Tanggal: __________
Jam Briefing: __________
