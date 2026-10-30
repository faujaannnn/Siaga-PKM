#!/usr/bin/env bash
# PM2 — proses faclinic-backend (terpisah dari pm2-backend.sh / siaga-puskesmas-api).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="${SBP_BACKEND:-$REPO_ROOT/backend}"

cd "$BACKEND_DIR"

PY="$BACKEND_DIR/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "ERROR: tidak ada $PY — jalankan dulu:"
  echo "  cd $BACKEND_DIR && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

mkdir -p "$BACKEND_DIR/logs"

APP_NAME="faclinic-backend"
if pm2 describe "$APP_NAME" &>/dev/null; then
  echo "==> pm2 reload $APP_NAME (production)"
  pm2 reload ecosystem.faclinic.config.cjs --env production --update-env
else
  echo "==> pm2 start $APP_NAME (production)"
  pm2 start ecosystem.faclinic.config.cjs --env production
fi

echo "==> pm2 save"
pm2 save

echo "==> selesai. Cek: pm2 status && curl -s http://127.0.0.1:8004/api/health"
pm2 status "$APP_NAME" || true
