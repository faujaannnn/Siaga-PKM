#!/usr/bin/env bash
# Satu ritual: build frontend sekali → rsync ke *dua* docroot
#   (siagabencana.famrc.id + siagapuskesmas.diahs.id) → PM2 API → reload nginx.
#
#   bash scripts/ritual-update-semua-situs.sh
#
# Dari path lain:
#   bash /path/ke/siaga-puskesmas/scripts/ritual-update-semua-situs.sh
#
# Variabel opsional (sama gaya skrip deploy lain):
#   SBP_FRONTEND        path folder frontend (default: ../frontend)
#   SBP_FAMRC_ROOT      docroot famrc (default: /var/www/siagabencana)
#   SBP_DIAHS_ROOT      docroot diahs (default: /var/www/siagapuskesmas)
#   SBP_WEB_USER        default www-data
#   SBP_SKIP_NPM=1      jangan menjalankan npm install otomatis
#   SBP_SKIP_CHOWN=1    lewati chown docroot
#   SBP_SKIP_PM2=1      lewati pm2-backend
#   SBP_SKIP_NGINX=1    lewati nginx -t + reload
#   SBP_UVICORN_PORT    port uvicorn utama (default 37841; harus konsisten dengan proxy_pass nginx)
#
# Catatan: skrip ini tidak menimpa konfigurasi nginx di /etc/ — hanya aset hasil
#   `vite build`. Untuk sync site .conf, pakai sync-nginx.sh / skrip certbot masing.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-puskesmas-defaults.sh
. "$SCRIPT_DIR/env-puskesmas-defaults.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

FRONTEND_DIR="${SBP_FRONTEND:-$REPO_ROOT/frontend}"
FAMRC_ROOT="${SBP_FAMRC_ROOT:-/var/www/siagabencana}"
DIAHS_ROOT="${SBP_DIAHS_ROOT:-/var/www/siagapuskesmas}"
WEB_USER="${SBP_WEB_USER:-www-data}"

chown_docroot() {
  local web_root=$1
  if [[ ! -d "$web_root" ]]; then
    echo "WARN: belum ada folder $web_root — lewati chown"
    return 0
  fi
  if id "$WEB_USER" &>/dev/null; then
    sudo chown -R "$WEB_USER:$WEB_USER" "$web_root"
    sudo find "$web_root" -type d -exec chmod 755 {} \;
    sudo find "$web_root" -type f -exec chmod 644 {} \;
  else
    echo "WARN: user '$WEB_USER' tidak ada — set SBP_WEB_USER=nginx, atau chmod manual."
    sudo chmod -R a+rX "$web_root"
  fi
}

cd "$FRONTEND_DIR"

if [[ "${SBP_SKIP_NPM:-0}" != "1" ]]; then
  if [[ ! -x node_modules/.bin/tsc ]] || [[ ! -x node_modules/.bin/vite ]]; then
    echo "==> npm install ($FRONTEND_DIR)"
    npm install
  fi
else
  if [[ ! -x node_modules/.bin/tsc ]] || [[ ! -x node_modules/.bin/vite ]]; then
    echo "ERROR: SBP_SKIP_NPM=1 tapi tsc/vite tidak ada — npm install dulu"
    exit 1
  fi
fi

echo "==> npm run build (sekali, dipakai kedua situs) — $FRONTEND_DIR"
npm run build

echo "==> rsync dist/ → $FAMRC_ROOT/ (siagabencana.famrc.id)"
sudo mkdir -p "$FAMRC_ROOT"
sudo rsync -av --delete dist/ "$FAMRC_ROOT/"

echo "==> rsync dist/ → $DIAHS_ROOT/ (siagapuskesmas.diahs.id)"
sudo mkdir -p "$DIAHS_ROOT"
sudo rsync -av --delete dist/ "$DIAHS_ROOT/"

if [[ "${SBP_SKIP_CHOWN:-0}" != "1" ]]; then
  echo "==> permission docroot (user: $WEB_USER)"
  if [[ -d /var/www ]]; then
    sudo chmod 755 /var/www
  fi
  chown_docroot "$FAMRC_ROOT"
  chown_docroot "$DIAHS_ROOT"
fi

if [[ "${SBP_SKIP_PM2:-0}" != "1" ]]; then
  echo "==> PM2 — backend 127.0.0.1:${SBP_UVICORN_PORT}"
  "$SCRIPT_DIR/pm2-backend.sh"
else
  echo "==> lewati PM2 (SBP_SKIP_PM2=1)"
fi

if [[ "${SBP_SKIP_NGINX:-0}" != "1" ]]; then
  echo "==> nginx -t && systemctl reload nginx"
  sudo nginx -t
  sudo systemctl reload nginx
else
  echo "==> lewati reload nginx (SBP_SKIP_NGINX=1)"
fi

echo ""
echo ">>>>>>>>>> SELESAI — ritual semua situs"
echo "    Lokal API:  curl -s http://127.0.0.1:${SBP_UVICORN_PORT}/api/health"
echo "    (opsional)  https://siagabencana.famrc.id"
echo "    (opsional)  https://siagapuskesmas.diahs.id"
