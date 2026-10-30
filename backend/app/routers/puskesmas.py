"""Router: manajemen puskesmas (CRUD) - diakses admin & kepala puskesmas."""
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import require_content_admin, require_kapus, get_current_user
from app.db import get_db
from app.schemas import (
    PuskesmasCreate,
    PuskesmasOut,
    PuskesmasUpdate,
)

router = APIRouter(prefix="/puskesmas", tags=["puskesmas"])


def _oid(raw: str) -> ObjectId:
    try:
        return ObjectId(raw)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="ID tidak valid")


async def _puskesmas_out(db, doc: dict) -> PuskesmasOut:
    pk_id = str(doc["_id"])
    kapus = await db.users.find_one({"puskesmas_id": pk_id, "role": "kepala_puskesmas"})
    staff_count = await db.users.count_documents({"puskesmas_id": pk_id, "role": "staff"})
    return PuskesmasOut(
        id=pk_id,
        nama=doc.get("nama", ""),
        alamat=doc.get("alamat", ""),
        kode=doc.get("kode", ""),
        has_kapus=kapus is not None,
        kapus_username=kapus["username"] if kapus else None,
        staff_count=int(staff_count),
    )


# ── Public / kapus: lihat daftar puskesmas ────────────────────────────────────

@router.get("", response_model=list[PuskesmasOut])
async def list_puskesmas(_: str = Depends(require_kapus)):
    db = get_db()
    docs = await db.puskesmas.find({}).sort("nama", 1).to_list(500)
    return [await _puskesmas_out(db, d) for d in docs]


@router.get("/all-public", response_model=list[PuskesmasOut])
async def list_puskesmas_public():
    """Daftar puskesmas untuk keperluan public (login, dll)."""
    db = get_db()
    docs = await db.puskesmas.find({}).sort("nama", 1).to_list(500)
    return [await _puskesmas_out(db, d) for d in docs]


@router.get("/{pk_id}", response_model=PuskesmasOut)
async def get_puskesmas(pk_id: str, _: str = Depends(require_kapus)):
    db = get_db()
    doc = await db.puskesmas.find_one({"_id": _oid(pk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Puskesmas tidak ditemukan")
    return await _puskesmas_out(db, doc)


# ── Admin only: CRUD ───────────────────────────────────────────────────────────

@router.post("", response_model=PuskesmasOut, status_code=status.HTTP_201_CREATED)
async def create_puskesmas(body: PuskesmasCreate, _: str = Depends(require_content_admin)):
    db = get_db()
    doc = {
        "nama": body.nama.strip(),
        "alamat": body.alamat.strip(),
        "kode": body.kode.strip(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    result = await db.puskesmas.insert_one(doc)
    doc["_id"] = result.inserted_id
    return await _puskesmas_out(db, doc)


@router.patch("/{pk_id}", response_model=PuskesmasOut)
async def update_puskesmas(pk_id: str, body: PuskesmasUpdate, _: str = Depends(require_content_admin)):
    db = get_db()
    upd: dict = {}
    if body.nama is not None:
        upd["nama"] = body.nama.strip()
    if body.alamat is not None:
        upd["alamat"] = body.alamat.strip()
    if body.kode is not None:
        upd["kode"] = body.kode.strip()
    if upd:
        await db.puskesmas.update_one({"_id": _oid(pk_id)}, {"$set": upd})
    doc = await db.puskesmas.find_one({"_id": _oid(pk_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Puskesmas tidak ditemukan")
    return await _puskesmas_out(db, doc)


@router.delete("/{pk_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_puskesmas(pk_id: str, _: str = Depends(require_content_admin)):
    db = get_db()
    kapus = await db.users.find_one({"puskesmas_id": pk_id, "role": "kepala_puskesmas"})
    if kapus:
        raise HTTPException(
            status_code=400,
            detail="Hapus akun kepala puskesmas terlebih dahulu sebelum menghapus puskesmas ini",
        )
    await db.puskesmas.delete_one({"_id": _oid(pk_id)})
    await db.users.update_many({"puskesmas_id": pk_id}, {"$unset": {"puskesmas_id": ""}})
