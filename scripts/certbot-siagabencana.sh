#!/usr/bin/env bash
# Let's Encrypt + nginx — hilangkan "Not secure" (HTTPS).
#
# Syarat:
#   • DNS A/AAAA siagabencana.famrc.id (dan www jika dipakai) sudah ke IP server ini
#   • Port 80 terbuka dari internet (validasi Let's Encrypt)
#   • Site HTTP sudah jalan (nginx + server_name benar)
#
# Install certbot + plugin nginx:
#   Ubuntu/Debian:  sudo apt update && sudo apt install -y certbot python3-certbot-nginx
#   Fedora/RHEL:    sudo dnf install -y certbot python3-certbot-nginx
#
# Kopas (interaktif — diminta email & setuju ToS):
#   bash ~/app/siaga-bencana-puskesmas-app/scripts/certbot-siagabencana.sh
#
# Non-interaktif (butuh email):
#   export CERTBOT_EMAIL=admin@famrc.id
#   bash ~/app/siaga-bencana-puskesmas-app/scripts/certbot-siagabencana.sh
#
# Hanya domain utama (tanpa www — jika www belum ada di DNS):
#   CERTBOT_SKIP_WWW=1 bash ~/app/siaga-bencana-puskesmas-app/scripts/certbot-siagabencana.sh
#
# PENTING: Setelah sukses, certbot mengubah file di /etc/nginx/sites-available/…
# Jangan menimpa dengan sync-nginx.sh dari repo kecuali Anda menggabungkan manual SSL.

set -euo pipefail

DOMAINS=(siagabencana.famrc.id)
if [[ "${CERTBOT_SKIP_WWW:-0}" != "1" ]]; then
  DOMAINS+=(www.siagabencana.famrc.id)
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
echo "==> tes renew (jangan khawatir, dry-run):"
sudo certbot renew --dry-run || true

echo ""
echo "==> selesai. Buka https://${DOMAINS[0]}/ — timer renew biasanya sudah aktif:"
echo "    systemctl status certbot.timer  ||  systemctl list-timers | grep certbot"
