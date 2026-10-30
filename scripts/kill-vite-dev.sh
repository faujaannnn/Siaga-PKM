#!/usr/bin/env bash
# Hentikan dev Vite (Node) di port sempit — default hanya 5173–5176 (beberapa
# percobaan ulang bila "port in use"), bukan puluhan port.
#
#   bash scripts/kill-vite-dev.sh        # hentikan
#   bash scripts/kill-vite-dev.sh list   # tampilkan listener dev (5xxx) saja
#
# Port tambahan (pisah koma), mis. preview di 4173:
#   EXTRA_PORTS=4173 bash scripts/kill-vite-dev.sh
#
# Perlu rentang lebar (legacy):
#   VITE_PORT_LO=5173 VITE_PORT_HI=5180 bash scripts/kill-vite-dev.sh
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=env-puskesmas-defaults.sh
. "$SCRIPT_DIR/env-puskesmas-defaults.sh"

VITE_PORT_LO="${VITE_PORT_LO:-5173}"
VITE_PORT_HI="${VITE_PORT_HI:-5176}"

list_only() {
  echo "==> Listener sempit (Vite 5173–5180, API Siaga Puskesmas ${SBP_UVICORN_PORT}) — bukan semua port sistem:"
  if command -v ss >/dev/null 2>&1; then
    ss -tlnp 2>/dev/null | grep -E ":(${SBP_UVICORN_PORT}|517[3-9]|5180)( |$)" || echo "    (kosong di rentang dev ini)"
  else
    netstat -tlnp 2>/dev/null | grep -E ":(${SBP_UVICORN_PORT}|517[3-9]|5180) " || echo "    (ss/netstat tidak tersedia)"
  fi
  echo
  echo "Hentikan 5173–5176 saja: bash $0"
  echo "Sertakan preview build:  EXTRA_PORTS=4173 bash $0"
}

if [[ "${1:-}" == "list" || "${1:-}" == "ls" ]]; then
  list_only
  exit 0
fi

kill_port_tcp() {
  local port=$1
  local label=$2
  if command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null && echo "    ${label}port $port: dihentikan" && return 0
  fi
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids=$(lsof -t -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)
    if [[ -n "${pids:-}" ]]; then
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null && echo "    ${label}port $port: dihentikan" && return 0
    fi
  fi
  return 0
}

echo "==> Menghentikan proses di port Vite (hanya $VITE_PORT_LO–$VITE_PORT_HI)..."
for ((port = VITE_PORT_LO; port <= VITE_PORT_HI; port++)); do
  kill_port_tcp "$port" ""
done

if [[ -n "${EXTRA_PORTS:-}" ]]; then
  echo "==> port tambahan (EXTRA_PORTS)..."
  IFS=',' read -r -a extras <<< "$EXTRA_PORTS"
  for port in "${extras[@]}"; do
    port="${port//[[:space:]]/}"
    [[ -n "$port" ]] || continue
    kill_port_tcp "$port" "extra "
  done
fi

echo "==> pkill proses node yang menjalankan vite (jika masih tersisa)..."
pkill -f '[n]ode.*vite' 2>/dev/null || true
pkill -f '/vite' 2>/dev/null || true

echo "==> selesai. Cek singkat: bash $0 list"
echo "    Cache Vite: rm -rf frontend/node_modules/.vite"
