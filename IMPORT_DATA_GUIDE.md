# 📋 Panduan Import Data Peserta dari CSV

## ✅ Status Konfigurasi

### 🔥 Firebase Status
- **Firebase sudah DIMATIKAN** ❌
- **Supabase ONLY mode** ✅
- `VITE_USE_FIREBASE=false` sudah diatur
- `VITE_DATA_BACKEND=supabase` sudah diatur

### 📊 Data CSV yang Tersedia

#### **Hari 1** (day_1.csv)
- **Total:** 62 peserta
- **Kategori:**
  - Shining Fiddler A: 15 peserta
  - Shining Fiddler B: 12 peserta
  - Bright Fiddler: 16 peserta
  - Great Fiddler: 14 peserta
  - Super Fiddler: 1 peserta

#### **Hari 2** (day2.csv)
- **Total:** 154 peserta
- **Kategori:**
  - Selected Repertoire: ~69 peserta
  - Free Choice Classic: ~75 peserta
  - Pop Category: ~20 peserta

**Total Semua:** 216 peserta

---

## 🚀 Cara Import Data

### **Opsi 1: Jalankan Script Otomatis (Recommended)**

1. **Buka Command Prompt/Terminal**
2. **Navigate ke folder scripts:**
   ```bash
   cd c:\Users\iqbal\yamaha-scan-tiketing\scripts
   ```

3. **Jalankan script:**
   ```bash
   node importParticipantsFromCSV.js
   ```

   Atau double-click file:
   ```
   seedDatabaseWithCSV.bat
   ```

### **Opsi 2: Import Manual via Supabase Dashboard**

1. Login ke [Supabase Dashboard](https://app.supabase.com)
2. Pilih project `jmttblccfmqnqwoyzazc`
3. Buka **Table Editor** → **workspace_state**
4. Edit row dengan `id = 'default'`
5. Update field `store` dengan data peserta baru

---

## 🎯 Hasil yang Diharapkan

Setelah import berhasil:

1. **✅ Semua data peserta lama dihapus**
2. **✅ 216 peserta baru masuk ke database:**
   - 62 peserta Hari 1 dengan kategori masing-masing
   - 154 peserta Hari 2 dengan kategori masing-masing
3. **✅ Setiap peserta memiliki:**
   - Ticket ID unik
   - QR Code data untuk scan
   - Kategori yang sesuai
   - Hari (day_number) yang benar

---

## 🔍 Verifikasi Setelah Import

1. **Buka aplikasi:** `npm run dev`
2. **Login:** `admin_eventplatform` / `admin123`
3. **Cek menu Participants:**
   - Filter Hari 1 → 62 peserta
   - Filter Hari 2 → 154 peserta
4. **Cek menu QR Generate:**
   - Semua peserta bisa generate QR
5. **Cek menu FrontGate/BackGate:**
   - Scan QR berfungsi dengan data peserta

---

## 🛠️ Troubleshooting

### **Script tidak jalan**
```bash
# Install dependencies dulu
npm install

# Pastikan Node.js versi 20+
node --version
```

### **Data tidak muncul di aplikasi**
1. Refresh browser (F5)
2. Logout dan login lagi
3. Cek console browser untuk error

### **Import gagal**
1. Cek koneksi internet
2. Verifikasi Supabase URL dan key
3. Pastikan table `workspace_state` ada

---

## 📞 Butuh Bantuan?

Jika ada masalah, cek:
1. File `scripts/importParticipantsFromCSV.js`
2. Supabase dashboard untuk status database
3. Browser console untuk error messages
