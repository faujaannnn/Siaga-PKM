#!/usr/bin/env bash
# Hentikan proses yang masih mendengarkan 1444 (biasanya Vite/terminal lama),
# supaya `npm run dev` konsisten di http://127.0.0.1:1444/
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v fuser >/dev/null 2>&1; then
  fuser -k 1444/tcp 2>/dev/null || true
  sleep 0.2
fi

exec npx vite "$@"
