import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import close_db, connect_db, get_db
from app.llm_client import aclose_http
from app.routers import (
    admin, admin_wa_notifikasi, auth, developer, evacuation_sim, evolution_webhook, fonnte_webhook,
    lipi_quiz, ml_learning, ml_pdf_learning, public, staff,
    puskesmas, pelatihan, kapus, notifikasi, sertifikat, triage_game,
)
from app.routers.notifikasi import start_notifikasi_scheduler
from app.seed import ensure_seed


@asynccontextmanager
async def lifespan(_app: FastAPI):
    await connect_db()
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    await ensure_seed()
    try:
        db = get_db()
        await db.wa_inbound_dedup.create_index("id", unique=True)
        await db.wa_inbound_dedup.create_index("expires_at", expireAfterSeconds=0)
    except Exception:
        pass
    await start_notifikasi_scheduler()
    yield
    await close_db()
    await aclose_http()


_is_prod = (
    os.environ.get("NODE_ENV", "").lower() == "production"
    or bool((settings.public_api_base or "").strip())
)

app = FastAPI(
    title="SiAP-PKM API",
    description="Sistem Aplikasi Kesiapsiagaan Puskesmas (SiAP-PKM) - API portal petugas & kepala puskesmas.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url=None if _is_prod else "/docs",
    redoc_url=None if _is_prod else "/redoc",
    openapi_url=None if _is_prod else "/openapi.json",
)

_cors_origins = list(
    dict.fromkeys(
        o
        for o in [
            "https://siagapuskesmas.diahs.id",
            "https://www.siagapuskesmas.diahs.id",
            (settings.public_api_base or "").rstrip("/") or None,
        ]
        if o
    )
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins or ["https://siagapuskesmas.diahs.id"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(public.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(staff.router, prefix="/api")
app.include_router(developer.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(ml_learning.public_router, prefix="/api")
app.include_router(ml_learning.admin_router, prefix="/api")
app.include_router(ml_pdf_learning.public_router, prefix="/api")
app.include_router(ml_pdf_learning.admin_router, prefix="/api")
app.include_router(fonnte_webhook.router, prefix="/api")
app.include_router(fonnte_webhook.whatsapp_router, prefix="/api")
app.include_router(evolution_webhook.router, prefix="/api")
app.include_router(lipi_quiz.public_router, prefix="/api")
app.include_router(lipi_quiz.admin_router, prefix="/api")
app.include_router(triage_game.public_router, prefix="/api")
app.include_router(evacuation_sim.public_router, prefix="/api")
app.include_router(evacuation_sim.admin_router, prefix="/api")
# SiAP-PKM: fitur baru
app.include_router(puskesmas.router, prefix="/api")
app.include_router(pelatihan.router, prefix="/api")
app.include_router(kapus.router, prefix="/api")
app.include_router(notifikasi.router, prefix="/api")
app.include_router(sertifikat.router, prefix="/api")
app.include_router(admin_wa_notifikasi.router, prefix="/api")

settings.uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount(
    "/api/uploads",
    StaticFiles(directory=str(settings.uploads_dir)),
    name="uploads",
)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "siap-pkm"}
