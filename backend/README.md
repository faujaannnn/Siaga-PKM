# Backend Siaga Puskesmas (FastAPI + MongoDB)

Proyek ini **bukan** backend Siaga Bencana. Database default: `siaga_puskesmas` (lihat `app/config.py`) di **MongoDB** — biasanya `mongodb://127.0.0.1:27017` (port **27017**, terpisah dari port API).

API `siaga-puskesmas-api` (uvicorn) memakai port **37841** secara default agar jarang bentrok dengan layanan lain. Port **2111** dipakai stack Siaga Bencana. Ganti port lewat `export SBP_UVICORN_PORT=...` sebelum `bash scripts/pm2-backend.sh`, lalu samakan `proxy_pass` di nginx.

## Prasyarat

- **MongoDB** jalan di `127.0.0.1:27017` (atau sesuai `MONGODB_URI` di `.env`)
- Python **3.10+**, venv di folder ini

## Sekali pasang

```bash
cd /path/ke/siaga-puskesmas/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

## Jalankan API (lokal, tanpa PM2)

```bash
cd /path/ke/siaga-puskesmas/backend
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 37841
```

Cek:

```bash
curl -s http://127.0.0.1:37841/api/health
curl -s http://127.0.0.1:37841/api/public/homepage
```

## Frontend dev (Vite)

Proxy `/api` di `vite.config.ts` mengarah ke **http://127.0.0.1:37841** secara default.

Jika perlu lain, set di `.env.development`:

```bash
VITE_API_PROXY_TARGET=http://127.0.0.1:37841
```

## Produksi (PM2, disarankan)

Dari root repo `siaga-puskesmas`:

```bash
bash scripts/pm2-backend.sh
```

Lalu: `curl -s http://127.0.0.1:37841/api/health` (atau `SBP_UVICORN_PORT` yang Anda set).

## PM2: "Process not found", status kosong, curl ke port gagal

Biasanya entri PM2 tidak sinkron dengan daemon (reload gagal padahal nama masih di `pm2 status`). Skrip `pm2-backend.sh` akan mencoba reload hanya app ini, lalu **`pm2 delete`** + start bersih bila reload gagal.

Jika masih macet, lakukan manual dari **root** repo `siaga-puskesmas`:

```bash
pm2 delete siaga-puskesmas-api
bash scripts/pm2-backend.sh
curl -sS "http://127.0.0.1:37841/api/health"
```

Jika proses **online** tapi langsung crash berulang (`↺` besar), cek log: `pm2 logs siaga-puskesmas-api --lines 80` (MongoDB down, `.env`, atau port sudah dipakai proses lain).

## Penting

- Menjalankan **hanya** API Siaga Bencana (:2111) **tidak** menghidupkan situs Siaga Puskesmas — jalankan backend folder ini di port yang sama dengan nginx `proxy_pass` (default **37841**).
- Deployment alternatif **faclinic-backend** tetap bisa memakai port **8004** (hanya satu proses per port). Lihat `ecosystem.faclinic.config.cjs`.
- Jika halaman gagal muat beranda / statistik: pastikan MongoDB hidup **dan** `curl` health di atas sukses.
