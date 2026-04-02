# Template Operasional Launch

Dokumen ini berisi 3 template siap pakai untuk minggu pertama setelah go-live.

## 1) SOP Gangguan 15 Menit

Tujuan: memulihkan layanan inti secepat mungkin saat terjadi gangguan.

### Trigger SOP
- Tiket WhatsApp tidak terkirim.
- QR tidak muncul di halaman sambungan.
- Proses check-in melambat atau gagal berulang.

### Menit 0-3: Konfirmasi Masalah
- Catat waktu kejadian.
- Catat gejala singkat dari pelapor.
- Uji ulang satu aksi utama (contoh: kirim 1 tiket uji).

### Menit 3-7: Isolasi Cepat
- Cek status sambungan WhatsApp pada halaman admin.
- Cek koneksi internet perangkat operasional.
- Coba refresh halaman dan ulang aksi uji.

### Menit 7-12: Mitigasi
- Jika kirim otomatis gagal, aktifkan fallback kirim manual (template WA).
- Jika check-in online terganggu, lanjutkan check-in dengan antrean lokal lalu sinkronkan saat koneksi normal.
- Informasikan status sementara ke tim lapangan.

### Menit 12-15: Keputusan
- Jika layanan pulih: tutup insiden sementara, lanjutkan monitoring 30 menit.
- Jika belum pulih: eskalasi ke penanggung jawab teknis.

### Catatan Insiden
- Waktu mulai:
- Waktu pulih:
- Dampak:
- Akar masalah sementara:
- Tindakan lanjutan:

---

## 2) Checklist Operasional Harian

Gunakan format centang ini setiap hari.

Tanggal: __________
Shift: __________
PIC: __________

### A. Pra-Operasional
- [ ] Login admin berhasil.
- [ ] Sambungan WhatsApp status siap.
- [ ] Kirim 1 tiket uji berhasil.
- [ ] Halaman peserta dan scan dapat dibuka normal.
- [ ] Jam perangkat sudah benar.

### B. Selama Operasional
- [ ] Pantau jumlah tiket terkirim per 2 jam.
- [ ] Pantau tiket gagal dan lakukan retry/manual jika perlu.
- [ ] Pantau check-in sukses/gagal.
- [ ] Catat kendala user dan waktu penyelesaiannya.

### C. Pasca-Operasional
- [ ] Rekap total tiket terkirim.
- [ ] Rekap total tiket gagal.
- [ ] Rekap total check-in.
- [ ] Simpan backup harian.
- [ ] Catat insiden dan tindak lanjut besok.

Ringkasan harian:
- Tiket terkirim: ______
- Tiket gagal: ______
- Check-in sukses: ______
- Insiden utama: ______________________

---

## 3) Template Pesan Support Admin

### A. Balasan Awal (Acknowledgement)
Halo, terima kasih laporannya. Tim kami sedang cek sekarang.
Mohon kirim:
1. Waktu kejadian
2. Nama fitur yang bermasalah
3. Screenshot pesan error (jika ada)

### B. Update Sedang Ditangani
Update: kendala sedang kami tangani.
Untuk sementara, layanan tetap bisa dipakai dengan alur alternatif/manual.
Kami kirim kabar lagi maksimal dalam 15 menit.

### C. Selesai Diperbaiki
Update: kendala sudah kami perbaiki.
Silakan coba ulang prosesnya sekarang.
Kalau masih muncul kendala, balas pesan ini dengan screenshot terbaru.

### D. Eskalasi ke Tim Teknis
Kendala membutuhkan pengecekan teknis lanjutan.
Kasus sudah kami eskalasi ke tim teknis dengan prioritas tinggi.
Estimasi update berikutnya: ___ menit.

### E. Penutupan Insiden
Terima kasih sudah menunggu.
Insiden dinyatakan selesai pada pukul __:__.
Kami tetap monitor untuk memastikan layanan stabil.

---

## Rekomendasi Penggunaan
- Simpan dokumen ini di grup internal operasional.
- Tunjuk 1 PIC per shift untuk menjalankan checklist.
- Review insiden harian 10 menit sebelum tutup operasional.
