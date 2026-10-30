"""Unduh sertifikat pelatihan dengan nama peserta tertempel di template."""

from __future__ import annotations

import re

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.db import get_db
from app.deps import get_current_user
from app.lipi_attempt import resolve_user_attempts
from app.sertifikat_pdf import (
    TEMPLATES,
    certificate_puskesmas_key,
    clean_certificate_name,
    stamp_certificate_name,
)

router = APIRouter(prefix="/sertifikat", tags=["sertifikat"])


class SertifikatUnduhIn(BaseModel):
    nama: str = Field(min_length=2, max_length=80)


async def puskesmas_nama_for_user(db, doc: dict | None) -> str | None:
    if not doc:
        return None
    raw_id = str(doc.get("puskesmas_id") or "").strip()
    if raw_id and ObjectId.is_valid(raw_id):
        pk = await db.puskesmas.find_one({"_id": ObjectId(raw_id)}, {"nama": 1})
        nama = str((pk or {}).get("nama") or "").strip()
        if nama:
            return nama
    wilayah = str(doc.get("research_wilayah") or "").strip()
    return wilayah or None


def _filename(template_key: str, nama: str) -> str:
    label = "Pantoloan" if template_key == "pantoloan" else "Talise"
    slug = re.sub(r"[^A-Za-z0-9]+", "-", nama).strip("-") or "peserta"
    return f"Sertifikat-{label}-{slug[:60]}.pdf"


@router.post("/unduh")
async def unduh_sertifikat(
    body: SertifikatUnduhIn,
    username: str = Depends(get_current_user),
):
    """Tempel nama ke sertifikat Pantoloan atau Talise setelah hasil post-test tampil."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    if not doc:
        raise HTTPException(status_code=404, detail="Akun tidak ditemukan.")

    pk_nama = await puskesmas_nama_for_user(db, doc)
    template_key = certificate_puskesmas_key(pk_nama, doc.get("research_wilayah"), username)
    if template_key not in TEMPLATES:
        raise HTTPException(
            status_code=403,
            detail="Sertifikat pelatihan hanya tersedia untuk petugas Puskesmas Pantoloan dan Talise.",
        )

    sessions = await db.lipi_quiz_sessions.find({"username": username}).to_list(20)
    if resolve_user_attempts(sessions)["kuis_status"] != "lengkap":
        raise HTTPException(
            status_code=403,
            detail="Sertifikat bisa diunduh setelah post-test selesai dan hasil tampil.",
        )

    try:
        nama = clean_certificate_name(body.nama)
        pdf = stamp_certificate_name(template_key, nama)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except FileNotFoundError as exc:
        raise HTTPException(status_code=500, detail="Template sertifikat belum tersedia.") from exc

    filename = _filename(template_key, nama)
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
