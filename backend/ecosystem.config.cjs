/**
 * PM2 — API FastAPI + Uvicorn (nginx `proxy_pass` /api → 127.0.0.1:37841, atau `SBP_UVICORN_PORT`)
 *
 * Persiapan sekali:
 *   cd backend
 *   python3 -m venv .venv
 *   .venv/bin/pip install -r requirements.txt
 *
 * Jalankan / perbarui proses:
 *   pm2 start ecosystem.config.cjs --env production
 *   # atau dari root repo:  bash scripts/pm2-backend.sh
 *
 * Setelah boot server (agar PM2 hidup lagi):
 *   pm2 save
 *   pm2 startup     # ikuti perintah yang dicetak (sudo ...)
 *
 * JWT_SECRET & kredensial (DEFAULT_ADMIN_*, dsb.): isi `backend/.env` — dipakai
 * Pydantic saat boot. Jangan isi DEFAULT_* di bawah bila mau .env-lah yang dipakai;
 * variabel PM2 **menimpa** isi .env. Salin kredensial ke env_production hanya
 * bila tanpa .env, atau: pm2 start ... --update-env.
 *
 * Path folder backend dengan spasi membuat PM2 memecah argumen (lihat scripts/pm2-backend.sh
 * yang menulis launcher ke ~/.config/siaga-puskesmas/pm2-uvicorn.sh).
 */
const path = require('path')
const os = require('os')

const backendRoot = __dirname
const logsDir = path.join(backendRoot, 'logs')
const pm2Wrapper = path.join(
  os.homedir(),
  '.config',
  'siaga-puskesmas',
  'pm2-uvicorn.sh'
)

module.exports = {
  apps: [
    {
      name: 'siaga-puskesmas-api',
      cwd: backendRoot,
      script: pm2Wrapper,
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      min_uptime: '5s',
      max_restarts: 15,
      restart_delay: 2000,
      merge_logs: true,
      time: true,
      error_file: path.join(logsDir, 'pm2-error.log'),
      out_file: path.join(logsDir, 'pm2-out.log'),
      env: {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB: 'siaga_puskesmas',
      },
      env_production: {
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB: 'siaga_puskesmas',
        // JANGAN taruh JWT_SECRET / DEFAULT_* di sini — PM2 menimpa .env.
        // Isi rahasia hanya di backend/.env lalu: pm2 restart ... --update-env
      },
    },
  ],
}
