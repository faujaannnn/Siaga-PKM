#!/usr/bin/env bash
# Perbaiki 403 Forbidden pada GET / — nginx (www-data) harus:
#   1) bisa melewati /var/www (execute pada setiap induk path)
#   2) bisa baca docroot + index.html
#
#   SBP_WEB_ROOT   default /var/www/siagabencana
#   SBP_WEB_USER   default www-data (RHEL/Alma: nginx)
#
# Diagnosa manual:  namei -l /var/www/siagabencana/index.html
# Log nginx:        sudo tail -30 /var/log/nginx/error.log

set -euo pipefail
WEB_ROOT="${SBP_WEB_ROOT:-/var/www/siagabencana}"
WEB_USER="${SBP_WEB_USER:-www-data}"

if [[ ! -d "$WEB_ROOT" ]]; then
  echo "ERROR: $WEB_ROOT tidak ada"
  exit 1
fi

# Induk path harus punya bit execute untuk "others" (atau owner = www-data).
# Tanpa ini, GET / sering 403 meski isi folder sudah 755.
if [[ -d /var/www ]]; then
  echo "==> pastikan /var/www bisa dilintasi (755)"
  sudo chmod 755 /var/www
fi

if id "$WEB_USER" &>/dev/null; then
  sudo chown -R "$WEB_USER:$WEB_USER" "$WEB_ROOT"
  sudo find "$WEB_ROOT" -type d -exec chmod 755 {} \;
  sudo find "$WEB_ROOT" -type f -exec chmod 644 {} \;
  echo "OK: $WEB_ROOT → user $WEB_USER, dir 755, file 644"
  echo "==> cek sebagai $WEB_USER:"
  if [[ -f "$WEB_ROOT/index.html" ]]; then
    sudo -u "$WEB_USER" test -r "$WEB_ROOT/index.html" && echo "    index.html: readable OK" || echo "    index.html: masih tidak terbaca"
  else
    echo "    index.html: BELUM ADA — jalankan npm run build + deploy ke $WEB_ROOT"
  fi
else
  sudo chmod -R a+rX "$WEB_ROOT"
  echo "OK: $WEB_ROOT → a+rX (user $WEB_USER tidak ada)"
fi

# SELinux (RHEL/CentOS/Alma): konteks httpd
if command -v getenforce &>/dev/null && [[ "$(getenforce 2>/dev/null)" == Enforcing ]]; then
  if command -v chcon &>/dev/null; then
    echo "==> SELinux: set konteks httpd_sys_content_t pada docroot"
    sudo chcon -Rt httpd_sys_content_t "$WEB_ROOT" 2>/dev/null || true
  fi
  if command -v restorecon &>/dev/null; then
    sudo restorecon -RF "$WEB_ROOT" 2>/dev/null || true
  fi
fi
