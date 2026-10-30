#!/usr/bin/env bash
# Sinkronkan konfigurasi nginx dari repo → sites-available, enable, nginx -t, reload.
#
# Sumber default: deploy/nginx-siagabencana.famrc.id.conf.example
# Tujuan default: /etc/nginx/sites-available/siagabencana.famrc.id
#
# Domain siagapuskesmas.diahs.id (docroot /var/www/siagapuskesmas):
#   SBP_NGINX_SRC="$REPO_ROOT/deploy/nginx-siagapuskesmas.diahs.id.conf.example" \
#   SBP_NGINX_SITE=siagapuskesmas.diahs.id \
#   SBP_WEB_ROOT=/var/www/siagapuskesmas \
#   bash scripts/sync-nginx.sh
# Atau: bash scripts/kopas-deploy-siagapuskesmas-diahs.sh
#
# Variabel opsional:
#   SBP_REPO_ROOT     root repo (default: induk folder scripts/)
#   SBP_NGINX_SRC     file konfigurasi sumber (.conf / .example)
#   SBP_NGINX_SITE    nama file di sites-available (tanpa path)
#   SBP_WEB_ROOT      docroot (default: /var/www/siagabencana) — hanya dibuat jika belum ada
#   SBP_SKIP_RELOAD=1 hanya salin + nginx -t, tanpa reload

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SBP_REPO_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"

SRC="${SBP_NGINX_SRC:-$REPO_ROOT/deploy/nginx-siagabencana.famrc.id.conf.example}"
SITE_NAME="${SBP_NGINX_SITE:-siagabencana.famrc.id}"
AVAILABLE="/etc/nginx/sites-available/$SITE_NAME"
ENABLED="/etc/nginx/sites-enabled/$SITE_NAME"
WEB_ROOT="${SBP_WEB_ROOT:-/var/www/siagabencana}"

if [[ ! -f "$SRC" ]]; then
  echo "ERROR: berkas sumber tidak ada: $SRC"
  exit 1
fi

echo "==> sumber: $SRC"
echo "==> tujuan: $AVAILABLE"
HAS_SSL=0
if [[ -f "$AVAILABLE" ]] && grep -qE 'ssl_certificate|listen[[:space:]]+443' "$AVAILABLE" 2>/dev/null; then
  HAS_SSL=1
  echo "WARN: $AVAILABLE sudah punya SSL — tidak menimpa dari repo (hindari hapus blok HTTPS)."
  if [[ "${SBP_FORCE_NGINX_SYNC:-0}" == "1" ]]; then
    echo "==> SBP_FORCE_NGINX_SYNC=1: tetap menimpa (backup dibuat)."
  else
    echo "==> Lewati salin config; perbarui snippet saja. Paksa: SBP_FORCE_NGINX_SYNC=1"
  fi
fi

if [[ "$HAS_SSL" == "0" || "${SBP_FORCE_NGINX_SYNC:-0}" == "1" ]]; then
  if [[ -f "$AVAILABLE" ]]; then
    BAK="${AVAILABLE}.bak.$(date +%Y%m%d%H%M%S)"
    echo "==> backup: sudo cp $AVAILABLE → $BAK"
    sudo cp "$AVAILABLE" "$BAK"
  fi
fi

SNIPPET_SRC="$REPO_ROOT/deploy/snippets/security-headers-siaga.conf"
SNIPPET_DST="/etc/nginx/snippets/security-headers-siaga.conf"
if [[ -f "$SNIPPET_SRC" ]]; then
  echo "==> snippet: $SNIPPET_SRC → $SNIPPET_DST"
  sudo mkdir -p /etc/nginx/snippets
  sudo cp "$SNIPPET_SRC" "$SNIPPET_DST"
fi

if [[ "$HAS_SSL" == "0" || "${SBP_FORCE_NGINX_SYNC:-0}" == "1" ]]; then
  sudo cp "$SRC" "$AVAILABLE"
  sudo ln -sf "$AVAILABLE" "$ENABLED"
fi

sudo mkdir -p "$WEB_ROOT"
# Docroot harus bisa di-traverse nginx (x) dan file harus terbaca (r)
if id www-data &>/dev/null; then
  sudo chown www-data:www-data "$WEB_ROOT" 2>/dev/null || true
fi
sudo chmod 755 "$WEB_ROOT" 2>/dev/null || true

echo "==> nginx -t"
sudo nginx -t

if [[ "${SBP_SKIP_RELOAD:-0}" != "1" ]]; then
  echo "==> systemctl reload nginx"
  sudo systemctl reload nginx
fi

echo "==> selesai. Site: $SITE_NAME | root: $WEB_ROOT"
