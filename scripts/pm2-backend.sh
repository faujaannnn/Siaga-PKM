#!/usr/bin/env bash
# PM2 untuk backend FastAPI — start pertama atau reload setelah ubah kode / env.
#
# Persiapan sekali di folder backend:
#   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
#
# Variabel opsional:
#   SBP_BACKEND         path folder backend (default: ../backend dari skrip ini)
#   SBP_UVICORN_PORT      port listen uvicorn (default 37841; harus sama dengan `proxy_pass` nginx untuk /api)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-puskesmas-defaults.sh
. "$SCRIPT_DIR/env-puskesmas-defaults.sh"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKEND_DIR="${SBP_BACKEND:-$REPO_ROOT/backend}"

cd "$BACKEND_DIR"

PY="$BACKEND_DIR/.venv/bin/python"
if [[ ! -x "$PY" ]]; then
  echo "ERROR: tidak ada $PY — jalankan dulu:"
  echo "  cd $BACKEND_DIR && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt"
  exit 1
fi

mkdir -p "$BACKEND_DIR/logs"

# PM2 6+ memecah path di field script bila folder backend mengandung spasi (contoh: "dr diah").
# Launcher ke path TANPA spasi: PM2 hanya memanggil file ini, cd + exec aman di dalamnya.
PM2_WRAPPER_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/siaga-puskesmas"
PM2_WRAPPER="$PM2_WRAPPER_DIR/pm2-uvicorn.sh"
BACKEND_DIR_Q=$(printf '%q' "$BACKEND_DIR")
mkdir -p "$PM2_WRAPPER_DIR"
{
  echo '#!/usr/bin/env bash'
  echo "# Dibuat otomatis oleh $(basename "$0") — jangan di-edit manual"
  echo 'set -euo pipefail'
  echo "cd $BACKEND_DIR_Q"
  echo "exec .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port ${SBP_UVICORN_PORT} --proxy-headers --forwarded-allow-ips 127.0.0.1"
} > "$PM2_WRAPPER"
chmod +x "$PM2_WRAPPER"

APP_NAME="siaga-puskesmas-api"
ECO="ecosystem.config.cjs"

# Entri PM2 bisa “hantu”: masih di daftar tetapi reload → Process not found, status/memori kosong.
# Kalau ada PID nyata → restart; kalau tidak → delete + start dari ecosystem (env production).
alive_pid=""
alive_pid="$(pm2 pid "$APP_NAME" 2>/dev/null || true)"
if pm2 describe "$APP_NAME" &>/dev/null; then
  if [[ -n "$alive_pid" && "$alive_pid" != "0" ]]; then
    echo "==> pm2 restart $APP_NAME (production)"
    if ! pm2 restart "$APP_NAME" --update-env; then
      echo "WARN: restart gagal — pm2 delete $APP_NAME lalu start ulang" >&2
      pm2 delete "$APP_NAME" 2>/dev/null || true
      pm2 start "$ECO" --env production
    fi
  else
    echo "WARN: entri \"$APP_NAME\" tanpa PID — pm2 delete lalu start bersih" >&2
    pm2 delete "$APP_NAME" 2>/dev/null || true
    echo "==> pm2 start $APP_NAME (production)"
    pm2 start "$ECO" --env production
  fi
else
  echo "==> pm2 start $APP_NAME (production)"
  pm2 start "$ECO" --env production
fi

verify_health_listen() {
  local i
  echo "==> verifikasi http://127.0.0.1:${SBP_UVICORN_PORT}/api/health (±15 detik)"
  for ((_i = 1; _i <= 15; _i++)); do
    if curl -sf "http://127.0.0.1:${SBP_UVICORN_PORT}/api/health" >/dev/null; then
      echo "    OK (${_i}s)"
      curl -sS "http://127.0.0.1:${SBP_UVICORN_PORT}/api/health"
      echo ""
      return 0
    fi
    sleep 1
  done
  echo "    TIDAK ADA respons di port ${SBP_UVICORN_PORT}." >&2
  echo "    Buka launcher (harus sama port): grep -n port ${PM2_WRAPPER} || cat ${PM2_WRAPPER}" >&2
  echo "    Listener: ss -tlnp 2>/dev/null | grep -E ':(${SBP_UVICORN_PORT}|8004)\\b' || true" >&2
  echo "    Log PM2:   pm2 logs ${APP_NAME} --lines 50" >&2
  echo "    Coba port lama sekali jika ada sisa konfig:" >&2
  echo "             curl -sS http://127.0.0.1:8004/api/health || true" >&2
  return 1
}
verify_health_listen || true

echo "==> pm2 save (daftar proses tersimpan untuk boot ulang)"
pm2 save

echo "==> selesai. Cek: pm2 status && curl -s http://127.0.0.1:${SBP_UVICORN_PORT}/api/health"
pm2 status "$APP_NAME" || true
