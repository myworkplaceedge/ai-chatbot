#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$ROOT_DIR/server"

echo "==> Building frontend"
cd "$ROOT_DIR"
npm run build

echo "==> Building server"
cd "$SERVER_DIR"
npm run build

echo "==> Starting backend (port 3000) and frontend (port 5173)"
cd "$SERVER_DIR"
npm run dev &
SERVER_PID=$!

cd "$ROOT_DIR"
npm run dev &
FRONTEND_PID=$!

cleanup() {
  echo
  echo "==> Stopping dev servers"
  kill "$SERVER_PID" "$FRONTEND_PID" 2>/dev/null || true
  wait "$SERVER_PID" "$FRONTEND_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

while kill -0 "$SERVER_PID" 2>/dev/null && kill -0 "$FRONTEND_PID" 2>/dev/null; do
  sleep 1
done
