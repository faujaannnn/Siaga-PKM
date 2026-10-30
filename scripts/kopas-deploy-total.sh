#!/usr/bin/env bash
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  KOPAS SATU BARIS (ulang kapan saja: update kode / lupa build / deploy ulang)
#
#    bash ~/app/siaga-bencana-puskesmas-app/scripts/kopas-deploy-total.sh
#
#  Isi: npm install (jika perlu) → npm run build → rsync → chmod docroot
#       → reload nginx → PM2 API start/reload → pm2 save
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-puskesmas-defaults.sh
. "$SCRIPT_DIR/env-puskesmas-defaults.sh"

echo ""
echo ">>>>>>>>>> FRONTEND (build + nginx) >>>>>>>>>>"
"$SCRIPT_DIR/deploy-frontend-nginx.sh"

echo ""
echo ">>>>>>>>>> BACKEND (PM2) >>>>>>>>>>"
"$SCRIPT_DIR/pm2-backend.sh"

echo ""
echo ">>>>>>>>>> SELESAI — tes lokal: curl -s http://127.0.0.1:${SBP_UVICORN_PORT}/api/health"
echo "    publik (sesuaikan domain): https://siagabencana.famrc.id atau https://siagapuskesmas.diahs.id"
