# 🧪 TESTING CHECKLIST - 3ONS Ticketing System

## ✅ Pre-Testing Setup
- [ ] Server running: `npm run dev`
- [ ] Database clean: Hanya 3 user (gate_depan, admin_tenant, system_admin)
- [ ] Browser console terbuka (F12)
- [ ] LocalStorage dibersihkan: `localStorage.clear()`

---

## 🔐 1. LOGIN TESTING

### Test 1.1: Gate User Login
**User:** `gate_depan`  
**Password:** `gate123`

- [ ] Buka http://localhost:5178
- [ ] Masukkan username: `gate_depan`
- [ ] Masukkan password: `gate123`
- [ ] Klik "Masuk ke Sistem"
- [ ] **Expected:** Berhasil login, redirect ke Gate Scanner
- [ ] **Console Check:** Tidak ada error merah

### Test 1.2: Tenant Admin Login
**User:** `admin_tenant`  
**Password:** `admin123`

- [ ] Logout dari gate user (jika sudah login)
- [ ] Masukkan username: `admin_tenant`
- [ ] Masukkan password: `admin123`
- [ ] **Expected:** Berhasil login, redirect ke Dashboard Tenant
- [ ] **Verify:** Menu sidebar lengkap (Dashboard, Participants, Reports, dll)

### Test 1.3: System Admin Login
**User:** `system_admin`  
**Password:** `admin123`

- [ ] Logout dari tenant admin
- [ ] Masukkan username: `system_admin`
- [ ] Masukkan password: `admin123`
- [ ] **Expected:** Berhasil login, redirect ke Admin Panel
- [ ] **Verify:** Ada menu "Supabase Integration" di sidebar

### Test 1.4: Login Gagal
**User:** `user_salah`  
**Password:** `password_salah`

- [ ] Masukkan username & password salah
- [ ] **Expected:** Muncul pesan error "Nama pengguna atau kata sandi tidak sesuai"
- [ ] **Verify:** Tidak redirect ke halaman lain

---

## 🚪 2. GATE FUNCTIONALITY TESTING

### Test 2.1: Gate Scanner Page
**Prerequisite:** Login sebagai `gate_depan`

- [ ] Buka `/gate/scan` atau klik menu Gate Depan
- [ ] **Verify:** Halaman scanner tampil
- [ ] **Verify:** Dropdown "Hari" ada (Day 1, Day 2, dll)
- [ ] **Verify:** Statistik peserta tampil (Total, Sudah Hadir, Belum Hadir)

### Test 2.2: Manual Check-in
- [ ] Pilih Day 1 dari dropdown
- [ ] Klik mode "Manual"
- [ ] Masukkan Ticket ID (coba: `TICKET001` atau dummy)
- [ ] Klik "Check In"
- [ ] **Expected:** Muncul hasil scan (success/error)
- [ ] **Verify:** Statistik berubah jika sukses

### Test 2.3: Tenant Verification
- [ ] Buka browser console (F12)
- [ ] Jalankan: `window.currentUser?.tenant_id`
- [ ] **Expected:** Tenant ID muncul (UUID format)
- [ ] Jalankan: `_workspaceSnapshot?.store?.tenants`
- [ ] **Expected:** Hanya ada 1 tenant (tenant yang login)
- [ ] **Verify:** Data peserta sesuai tenant user yang login

### Test 2.4: Real-time Data
- [ ] Di halaman Gate, lihat console
- [ ] **Expected:** Ada log `[FrontGate] Realtime update received` (jika ada perubahan data)
- [ ] **Verify:** Tidak ada error `cannot add postgres_changes callbacks`

---

## 🎯 3. DATA VERIFICATION

### Test 3.1: Database Check via Supabase
```sql
-- Cek di Supabase SQL Editor:

-- 1. Gate Users (hanya 1)
SELECT username, name, tenant_id FROM gate_users;
-- Expected: 1 row (gate_depan)

-- 2. Tenant Admins (hanya 1)
SELECT username, name, tenant_id FROM tenant_admins;
-- Expected: 1 row (admin_tenant)

-- 3. System Admins (hanya 1)
SELECT username, name FROM system_admins;
-- Expected: 1 row (system_admin)

-- 4. Tenants (hanya 1)
SELECT name, slug FROM tenants;
-- Expected: 1 row (Primavera Production)

-- 5. Cek duplikat
SELECT tenant_id, username, COUNT(*) 
FROM gate_users 
GROUP BY tenant_id, username 
HAVING COUNT(*) > 1;
-- Expected: 0 rows (no duplicates)
```

### Test 3.2: Workspace State Check
```sql
-- Cek workspace_state
SELECT id, 
       jsonb_pretty(tenant_registry) as registry,
       jsonb_pretty(store) as store_data
FROM workspace_state 
WHERE id = 'default';
```

### Test 3.3: Browser Console Check
- [ ] Buka http://localhost:5178
- [ ] Login sebagai tenant_admin
- [ ] Buka Dashboard
- [ ] **Console Check:**
  - [ ] Tidak ada error `getStats is not defined`
  - [ ] Tidak ada error `byCategory is undefined`
  - [ ] Tidak ada error `tenantUtils`
  - [ ] Tidak ada error `bootstrapStoreFromServer`

---

## 🎨 4. UI/UX VERIFICATION

### Test 4.1: Navigation
- [ ] Sidebar menu tampil dengan benar
- [ ] Icon menu terlihat (Lucide icons)
- [ ] Active menu ter-highlight
- [ ] Mobile: Hamburger menu berfungsi

### Test 4.2: Responsive Design
- [ ] Buka di browser dengan width < 768px (mobile)
- [ ] **Verify:** Layout responsif, tidak ada scroll horizontal
- [ ] **Verify:** Text readable, button tidak terlalu kecil

### Test 4.3: Loading States
- [ ] Klik menu Participants
- [ ] **Verify:** Ada loading spinner saat data fetch
- [ ] **Verify:** Tidak ada "flash of empty content"

---

## 🔧 5. ERROR HANDLING

### Test 5.1: Offline Mode (Gate)
- [ ] Buka Gate Scanner
- [ ] Matikan WiFi/Internet
- [ ] Coba check-in manual
- [ ] **Expected:** Queue tersimpan di pending, tidak error
- [ ] Nyalakan WiFi
- [ ] **Expected:** Auto-sync ketika online

### Test 5.2: Invalid QR Code
- [ ] Di Gate Scanner, mode Manual
- [ ] Masukkan QR code tidak valid: `INVALID123`
- [ ] **Expected:** Muncul pesan error, tidak crash

---

## 📝 6. BROWSER CONSOLE COMMANDS

### Cek User Login:
```javascript
// Cek user yang login
window.currentUser

// Cek tenant_id
window.currentUser?.tenant_id

// Cek role
window.currentUser?.role
```

### Cek Workspace:
```javascript
// Cek data tenant (via tenantUtils)
getActiveTenantId()

// Cek participants
getParticipants(1)

// Cek stats
getStats(1)
```

### Clear Cache:
```javascript
// Hapus localStorage
localStorage.clear()

// Refresh halaman
location.reload()
```

---

## 🎉 PASS CRITERIA

✅ **Testing Berhasil Jika:**
- Semua login test pass (3 role)
- Gate scanner berfungsi normal
- Tidak ada duplikat data di database
- Console tidak ada error merah
- UI responsive & tidak ada glitch

❌ **Testing Gagal Jika:**
- Ada error di console
- Data duplikat masih ada
- Login tidak berfungsi
- Gate tidak membaca QR dengan benar

---

## 🐛 Bug Report Template

Jika ada bug, tulis dengan format:
```
**Bug:** [Deskripsi singkat]
**Step Reproduce:** [Langkah untuk reproduce]
**Expected:** [Harusnya apa yang terjadi]
**Actual:** [Apa yang terjadi]
**Console Error:** [Paste error dari console]
**Screenshot:** [Jika perlu]
```

---

**Status:** ⏳ Testing in Progress...
