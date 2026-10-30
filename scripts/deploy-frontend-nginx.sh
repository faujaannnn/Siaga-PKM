#!/usr/bin/env bash
# Deploy build Vite ke docroot nginx lalu nginx -t + reload.
#
# Default: frontend di repo ini → /var/www/siagabencana (sesuai siagabencana.famrc.id)
#
# Untuk siagapuskesmas.diahs.id:
#   SBP_WEB_ROOT=/var/www/siagapuskesmas bash scripts/deploy-frontend-nginx.sh
#
# Untuk *kedua* docroot sekaligus (build sekali):
#   bash scripts/ritual-update-semua-situs.sh
#
# Variabel opsional:
#   SBP_FRONTEND      path folder frontend
#   SBP_WEB_ROOT      docroot nginx
#   SBP_WEB_USER      pemilik file untuk nginx (default: www-data; di Alma/RHEL sering: nginx)
#   SBP_SKIP_CHOWN=1  jangan ubah owner/permission setelah rsync
#   SBP_SKIP_NGINX=1  hanya build + rsync, tanpa nginx -t/reload

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FRONTEND_DIR="${SBP_FRONTEND:-$REPO_ROOT/frontend}"
WEB_ROOT="${SBP_WEB_ROOT:-/var/www/siagabencana}"
WEB_USER="${SBP_WEB_USER:-www-data}"

cd "$FRONTEND_DIR"

if [[ ! -x node_modules/.bin/tsc ]] || [[ ! -x node_modules/.bin/vite ]]; then
  echo "==> npm install ($FRONTEND_DIR) — diperlukan agar tsc/vite tersedia"
  npm install
fi

echo "==> npm run build ($FRONTEND_DIR)"
npm run build

echo "==> rsync → $WEB_ROOT/"
sudo rsync -av --delete dist/ "$WEB_ROOT/"

if [[ "${SBP_SKIP_CHOWN:-0}" != "1" ]]; then
  echo "==> permission docroot untuk nginx (user: $WEB_USER) — hindari 403 Forbidden"
  if [[ -d /var/www ]]; then
    sudo chmod 755 /var/www
  fi
  if id "$WEB_USER" &>/dev/null; then
    sudo chown -R "$WEB_USER:$WEB_USER" "$WEB_ROOT"
    sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \;
    sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \;
  else
    echo "WARN: user '$WEB_USER' tidak ada — set SBP_WEB_USER=nginx atau buat user, lalu chmod manual."
    sudo chmod -R a+rX "$WEB_ROOT"
  fi
fi

if [[ "${SBP_SKIP_NGINX:-0}" != "1" ]]; then
  echo "==> nginx -t && systemctl reload nginx"
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "==> selesai."
