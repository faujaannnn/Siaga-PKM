#!/usr/bin/env bash
# Let's Encrypt untuk siagapuskesmas.diahs.id (HTTPS + redirect HTTP→HTTPS).
#
# Syarat: DNS A/AAAA ke server, port 80 terbuka, site HTTP nginx sudah aktif.
#
# Non-interaktif:
#   export CERTBOT_EMAIL=admin@example.com
#   bash scripts/certbot-siagapuskesmas-diahs.sh
#
# Default: hanya siagapuskesmas.diahs.id (subdomain sering tanpa rekaman DNS www → NXDOMAIN).
# Sertifikat + www (pastikan A/AAAA www sudah mengarah ke server ini):
#   CERTBOT_INCLUDE_WWW=1 bash scripts/certbot-siagapuskesmas-diahs.sh
#
# Setelah sukses certbot mengubah file di /etc/nginx/sites-available/ — hati-hati saat sync dari repo.

set -euo pipefail

DOMAINS=(siagapuskesmas.diahs.id)
if [[ "${CERTBOT_INCLUDE_WWW:-0}" == "1" ]]; then
  DOMAINS+=(www.siagapuskesmas.diahs.id)
fi

if ! command -v certbot &>/dev/null; then
  echo "ERROR: certbot tidak terpasang."
  echo "  Ubuntu/Debian: sudo apt update && sudo apt install -y certbot python3-certbot-nginx"
  echo "  Fedora/RHEL:   sudo dnf install -y certbot python3-certbot-nginx"
  exit 1
fi

ARGS=(--nginx --redirect)
for d in "${DOMAINS[@]}"; do
  ARGS+=(-d "$d")
done

if [[ -n "${CERTBOT_EMAIL:-}" ]]; then
  ARGS+=(--agree-tos --email "$CERTBOT_EMAIL" --non-interactive)
  echo "==> certbot (non-interactive) untuk: ${DOMAINS[*]}"
else
  echo "==> certbot (interaktif) untuk: ${DOMAINS[*]}"
fi

sudo certbot "${ARGS[@]}"

echo ""
echo "==> tes renew (dry-run):"
sudo certbot renew --dry-run || true

echo ""
echo "==> selesai. https://${DOMAINS[0]}/"
