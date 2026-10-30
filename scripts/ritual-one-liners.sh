#!/usr/bin/env bash
# Tampilkan perintah siap tempel:  bash scripts/ritual-one-liners.sh

cat <<'EOF'
=== ★ KOPAS UTAMA — build frontend + deploy nginx + PM2 (ulang tiap update / lupa build) ===
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/kopas-deploy-total.sh && bash ~/app/siaga-bencana-puskesmas-app/scripts/kopas-deploy-total.sh

=== ★ KOPAS DUA SITUS — famrc + diahs: build sekali → rsync ke /var/www/siagabencana DAN /var/www/siagapuskesmas → PM2 → nginx ===
# Ganti path repo jika folder Anda bukan ~/app/siaga-bencana-puskesmas-app
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/ritual-update-semua-situs.sh && bash ~/app/siaga-bencana-puskesmas-app/scripts/ritual-update-semua-situs.sh

=== ★ SETELAH RESTART VPS — tanpa npm build (hidupkan PM2 + reload nginx) ===
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/kopas-setelah-reboot.sh && bash ~/app/siaga-bencana-puskesmas-app/scripts/kopas-setelah-reboot.sh

=== ★ HTTPS (Certbot) — hilangkan Not secure (setelah HTTP & DNS sudah benar) ===
# Pasang certbot + plugin nginx (Ubuntu/Debian):
#   sudo apt update && sudo apt install -y certbot python3-certbot-nginx
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/certbot-siagabencana.sh && bash ~/app/siaga-bencana-puskesmas-app/scripts/certbot-siagabencana.sh
# Non-interaktif:  export CERTBOT_EMAIL=admin@famrc.id  lalu jalankan skrip lagi
# Tanpa www (DNS www belum ada):  CERTBOT_SKIP_WWW=1 bash .../certbot-siagabencana.sh

=== siagabencana.famrc.id — install + build + deploy + reload (satu baris; atasi “tsc: not found”) ===
cd ~/app/siaga-bencana-puskesmas-app/frontend && npm install && npm run build && sudo rsync -av --delete dist/ /var/www/siagabencana/ && sudo nginx -t && sudo systemctl reload nginx

=== Tanpa npm install (hanya jika node_modules sudah lengkap) ===
cd ~/app/siaga-bencana-puskesmas-app/frontend && npm run build && sudo rsync -av --delete dist/ /var/www/siagabencana/ && sudo nginx -t && sudo systemctl reload nginx

=== Gaya cp (asset lama bisa tertinggal) ===
cd ~/app/siaga-bencana-puskesmas-app/frontend && npm install && npm run build && sudo cp -r dist/* /var/www/siagabencana/ && sudo nginx -t && sudo systemctl reload nginx

=== Skrip deploy ===
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/deploy-frontend-nginx.sh && ~/app/siaga-bencana-puskesmas-app/scripts/deploy-frontend-nginx.sh

=== Atasi 403 di situs (permission docroot untuk nginx) ===
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/fix-docroot-permissions.sh && ~/app/siaga-bencana-puskesmas-app/scripts/fix-docroot-permissions.sh

=== Sinkron nginx dari repo (backup otomatis jika site sudah ada) ===
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/sync-nginx.sh && ~/app/siaga-bencana-puskesmas-app/scripts/sync-nginx.sh

=== Pasang nginx manual (setara skrip di atas) ===
sudo cp ~/app/siaga-bencana-puskesmas-app/deploy/nginx-siagabencana.famrc.id.conf.example /etc/nginx/sites-available/siagabencana.famrc.id && sudo ln -sf /etc/nginx/sites-available/siagabencana.famrc.id /etc/nginx/sites-enabled/ && sudo mkdir -p /var/www/siagabencana && sudo nginx -t && sudo systemctl reload nginx

=== Backend — venv + deps (sekali / setelah clone) ===
cd ~/app/siaga-bencana-puskesmas-app/backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt

=== Backend PM2 — skrip (start atau reload otomatis) ===
chmod +x ~/app/siaga-bencana-puskesmas-app/scripts/pm2-backend.sh && ~/app/siaga-bencana-puskesmas-app/scripts/pm2-backend.sh

=== Backend PM2 — start pertama manual ===
cd ~/app/siaga-bencana-puskesmas-app/backend && pm2 start ecosystem.config.cjs --env production && pm2 save

=== Backend PM2 — reload setelah ubah kode ===
cd ~/app/siaga-bencana-puskesmas-app/backend && pm2 reload ecosystem.config.cjs --env production --update-env && pm2 save

=== PM2 — log & cek API lokal ===
pm2 logs siaga-puskesmas-api --lines 100
curl -s http://127.0.0.1:37841/api/health

=== PM2 — hidupkan lagi setelah reboot server (jalankan sekali, ikuti sudo yang dicetak) ===
pm2 save && pm2 startup
EOF
