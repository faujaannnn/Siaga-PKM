#!/usr/bin/env bash
# Satu alur deploy untuk siagapuskesmas.diahs.id:
#   nginx (site + docroot) → build frontend ke /var/www/siagapuskesmas → PM2 backend (uvicorn, default :37841)
#
# Tidak perlu menjalankan dev server Vite dan uvicorn terpisah di mesin produksi:
#   browser hanya berbicara ke nginx; /api di-proxy ke satu uvicorn lokal.
#
#   bash scripts/kopas-deploy-siagapuskesmas-diahs.sh
#
# Setelah skrip ini, HTTPS (opsional):
#   bash scripts/certbot-siagapuskesmas-diahs.sh
#
# Jika site nginx sudah punya SSL dari certbot, jalankan sync dengan hati-hati (backup otomatis ada).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-puskesmas-defaults.sh
. "$SCRIPT_DIR/env-puskesmas-defaults.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export SBP_REPO_ROOT="$REPO_ROOT"
export SBP_NGINX_SRC="$REPO_ROOT/deploy/nginx-siagapuskesmas.diahs.id.conf.example"
export SBP_NGINX_SITE="${SBP_NGINX_SITE:-siagapuskesmas.diahs.id}"
export SBP_WEB_ROOT="${SBP_WEB_ROOT:-/var/www/siagapuskesmas}"

echo ""
echo ">>>>>>>>>> NGINX (sync site) >>>>>>>>>>"
"$SCRIPT_DIR/sync-nginx.sh"

echo ""
echo ">>>>>>>>>> FRONTEND (build + rsync) >>>>>>>>>>"
"$SCRIPT_DIR/deploy-frontend-nginx.sh"

echo ""
echo ">>>>>>>>>> BACKEND (PM2, 127.0.0.1:${SBP_UVICORN_PORT}) >>>>>>>>>>"
"$SCRIPT_DIR/pm2-backend.sh"

echo ""
echo ">>>>>>>>>> SELESAI"
echo "    Lokal:  curl -s http://127.0.0.1:${SBP_UVICORN_PORT}/api/health"
echo "    Publik: curl -s https://siagapuskesmas.diahs.id/api/health   (setelah DNS + HTTPS)"
