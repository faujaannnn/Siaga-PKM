/**
 * PM2 — nama proses faclinic-backend (nginx /api bisa diarahkan ke 127.0.0.1:8004 untuk deployment ini).
 * Ini terpisah dari `siaga-puskesmas-api` (default port 37841, lihat scripts/pm2-backend.sh).
 *
 *   cd backend
 *   pm2 start ecosystem.faclinic.config.cjs --env production
 *   # atau: bash scripts/pm2-faclinic-backend.sh
 *
 * Hanya satu proses per port: `siaga-puskesmas-api` default :37841; faclinic ini :8004.
 * Jangan dua proses PM2 menempati port yang sama.
 */
const path = require('path')

const backendRoot = __dirname
const logsDir = path.join(backendRoot, 'logs')

module.exports = {
  apps: [
    {
      name: 'faclinic-backend',
      cwd: backendRoot,
      script: path.join(backendRoot, '.venv/bin/python'),
      args: [
        '-m',
        'uvicorn',
        'app.main:app',
        '--host',
        '127.0.0.1',
        '--port',
        '8004',
        '--proxy-headers',
        '--forwarded-allow-ips',
        '127.0.0.1',
      ],
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
      error_file: path.join(logsDir, 'pm2-faclinic-error.log'),
      out_file: path.join(logsDir, 'pm2-faclinic-out.log'),
      env: {
        NODE_ENV: 'development',
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB: 'siaga_puskesmas',
      },
      env_production: {
        NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://127.0.0.1:27017',
        MONGODB_DB: 'siaga_puskesmas',
        JWT_SECRET: 'ganti-dengan-string-acak-panjang-minimal-32-karakter',
        DEFAULT_ADMIN_USERNAME: 'admin',
        DEFAULT_ADMIN_PASSWORD: 'ganti-password-admin-produksi',
      },
    },
  ],
}
