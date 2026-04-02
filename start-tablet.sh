#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

install_if_needed() {
  local target_dir="$1"
  local label="$2"

  if [[ -d "$target_dir/node_modules" ]]; then
    echo "Dependensi $label sudah ada."
    return
  fi

  echo "Dependensi $label belum ada. Menginstal..."
  cd "$target_dir"

  if [[ -f "package-lock.json" ]]; then
    npm ci
  else
    npm install
  fi
}

echo "==================================================="
echo "        MEMULAI 3oNs DIGITAL PLATFORM (Linux)"
echo "==================================================="
echo
echo "Menjalankan frontend dan server bot WhatsApp..."
echo

cd "$ROOT_DIR"

install_if_needed "$ROOT_DIR" "frontend"
install_if_needed "$ROOT_DIR/wa-server" "wa-server"

cd "$ROOT_DIR"

# Jalankan frontend di background.
npm run dev >/tmp/ons-frontend.log 2>&1 &
FRONTEND_PID=$!

cleanup() {
  echo
  echo "Menghentikan frontend..."
  kill "$FRONTEND_PID" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

sleep 3

APP_URL="http://localhost:5174/"
echo "Buka URL ini di browser tablet: $APP_URL"
if [[ -n "${BROWSER:-}" ]]; then
  "$BROWSER" "$APP_URL" >/dev/null 2>&1 || true
fi

echo
echo "Log frontend: /tmp/ons-frontend.log"
echo "Menjalankan WA server (Ctrl+C untuk berhenti)..."
echo

cd "$ROOT_DIR/wa-server"
npm start
