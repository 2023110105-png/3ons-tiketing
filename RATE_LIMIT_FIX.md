# Fix Rate Limit - Max 14 Messages Issue

## Problem
Hanya bisa kirim ~14 pesan, sisanya gagal.

## Penyebab
1. **WhatsApp Rate Limit** - Setelah ~15 pesan cepat, WhatsApp block sementara
2. **Session Timeout** - Web session tidak stabil untuk batch besar
3. **Parallel sending** - Promise.all kirim semua sekaligus

## Solusi Implemented

### 1. Sequential Send (Bukan Parallel)
Dari:
```js
const sendTasks = phoneList.map(...)
results.wa = await Promise.all(sendTasks) // Parallel - RATE LIMIT!
```

Jadi:
```js
for (let i = 0; i < phoneList.length; i++) {
    // Send satu per satu dengan delay
    await sendMessage(...)
    await delay(3000) // Tunggu 3 detik
}
```

### 2. Health Check Setiap 10 Pesan
```js
if (i % 10 === 0) {
    checkSessionHealth() // Cek masih connected?
    await delay(10000)   // Extra cooldown 10 detik
}
```

### 3. Configurable Delay
Tambahkan ke `.env`:
```env
WA_SEND_DELAY_MS=3000  // Delay antar pesan (3 detik)
```

## Estimasi Waktu

| Jumlah | Delay | Estimasi |
|--------|-------|----------|
| 50 peserta | 3 detik/pesan | ~2.5 menit + cooldown |
| 100 peserta | 3 detik/pesan | ~5 menit + cooldown |

## Logging
Server akan log:
```
[WA SEND] [1/50] Mulai kirim ke 628xxx...
[WA SEND] Sukses [1/50] ke 628xxx time=567ms
[WA SEND] [2/50] Mulai kirim ke 628xxx...
...
[WA SEND] Health check setelah 10 pesan...
[WA SEND] Cooldown 10 detik setelah 10 pesan...
```

## Tips Kirim Massal

1. **Batch kecil**: Kirim per 20-30 peserta saja
2. **Cooldown**: Tunggu 1-2 menit antar batch
3. **Monitor**: Lihat log server, kalau ada "rate limit", tunggu lebih lama
4. **Retry**: Gunakan fitur "Retry Gagal" untuk yang belum terkirim

## Restart Server
```bash
cd wa-server
npm start
```
