#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WA_DIR="$ROOT_DIR/wa-server"
PORT="${PORT:-3001}"
HEALTH_URL="http://127.0.0.1:${PORT}/health"

cd "$WA_DIR"

if [[ ! -d node_modules ]]; then
  echo "[wa-safe] Dependensi wa-server belum ada. Menginstal..."
  if [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
fi

# Jika backend sudah hidup sehat, jangan start instance baru.
if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  echo "[wa-safe] WA server sudah berjalan sehat di port ${PORT}."
  echo "[wa-safe] Tidak menjalankan instance baru untuk mencegah bentrok port."
  exit 0
fi

# Bersihkan proses yang masih menahan port tapi tidak sehat.
pids="$(lsof -i :"$PORT" -t 2>/dev/null | sort -u || true)"
if [[ -n "$pids" ]]; then
  echo "[wa-safe] Menutup proses lama di port ${PORT}: $pids"
  kill $pids >/dev/null 2>&1 || true
  sleep 1

  remaining="$(lsof -i :"$PORT" -t 2>/dev/null | sort -u || true)"
  if [[ -n "$remaining" ]]; then
    echo "[wa-safe] Proses masih aktif, paksa stop: $remaining"
    kill -9 $remaining >/dev/null 2>&1 || true
    sleep 1
  fi
fi

echo "[wa-safe] Menjalankan WA server di port ${PORT}..."
exec npm start
