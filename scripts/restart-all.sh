#!/usr/bin/env bash
# Restart / deploy: frontend build + nginx + backend PM2.
#
# Jalankan dari mana pun (path repo boleh berisi spasi):
#   bash "/path/ke/siaga-puskesmas/scripts/restart-all.sh"
#
# Mode:
#   all | full     — build frontend, rsync docroot, reload nginx, pm2 reload API (default)
#   backend | api  — hanya PM2 backend
#   web | frontend — hanya build + deploy nginx (lihat deploy-frontend-nginx.sh)
#   after-reboot   — pm2 resurrect / start + nginx reload (tanpa npm build)
#
# Contoh docroot siagapuskesmas.diahs.id:
#   SBP_WEB_ROOT=/var/www/siagapuskesmas bash scripts/restart-all.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "${1:-all}" in
  all | full)
    "$SCRIPT_DIR/kopas-deploy-total.sh"
    ;;
  backend | api)
    "$SCRIPT_DIR/pm2-backend.sh"
    ;;
  web | frontend)
    "$SCRIPT_DIR/deploy-frontend-nginx.sh"
    ;;
  after-reboot)
    "$SCRIPT_DIR/kopas-setelah-reboot.sh"
    ;;
  *)
    echo "Usage: bash $0 [all|backend|web|after-reboot]"
    exit 1
    ;;
esac
