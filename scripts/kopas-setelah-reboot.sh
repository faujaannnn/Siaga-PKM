#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  SETELAH RESTART VPS — tanpa npm build (file di /var/www sudah ada)
#
#    bash ~/app/siaga-bencana-puskesmas-app/scripts/kopas-setelah-reboot.sh
#
#  PM2: coba resurrect dari dump; kalau gagal, start lewat ecosystem.
#  Lalu reload nginx (aman jika sudah jalan).
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-puskesmas-defaults.sh
. "$SCRIPT_DIR/env-puskesmas-defaults.sh"

if ! command -v pm2 &>/dev/null; then
  echo "ERROR: pm2 tidak ada di PATH"
  exit 1
fi

echo "==> PM2"
if pm2 resurrect 2>/dev/null; then
  echo "    pm2 resurrect OK"
else
  echo "    resurrect kosong/gagal → start dari ecosystem"
  "$SCRIPT_DIR/pm2-backend.sh"
fi

echo "==> nginx reload"
sudo systemctl reload nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null || true

echo "==> cek lokal"
curl -sS "http://127.0.0.1:${SBP_UVICORN_PORT}/api/health" && echo "" || echo "(API belum menjawab — cek MongoDB & pm2 logs)"
