#!/usr/bin/env bash
# Sumber ringkas untuk skrip lain (pastikan SCRIPT_DIR ada sebelum `. "$SCRIPT_DIR/env-puskesmas-defaults.sh"`).
#
# MongoDB pakai URI default localhost:27017 + MONGODB_DB (backend/.env) — TIDAK menggunakan port uvicorn ini.
# Override port API: export SBP_UVICORN_PORT=...

: "${SBP_UVICORN_PORT:=37841}"
