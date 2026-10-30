"""Router: Pelatihan bencana - admin CRUD, kapus kelola peserta & absensi."""
import secrets
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from app.deps import require_content_admin, require_kapus, get_current_user
from app.db import get_db
from app.schemas import (
    AbsensiOut,
    AbsensiUpsert,
    PelatihanCreate,
    PelatihanOut,
    PelatihanUpdate,
    PesertaToggleIn,
    QRScanIn,
)

router = APIRouter(prefix="/pelatihan", tags=["pelatihan"])


def _oid(raw: str) -> ObjectId:
    try:
        return ObjectId(raw)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="ID tidak valid")


async def _pelatihan_out(db, doc: dict) -> PelatihanOut:
    pid = str(doc["_id"])
    peserta_count = await db.pelatihan_peserta.count_documents({"pelatihan_id": pid})
    return PelatihanOut(
        id=pid,
        judul=doc.get("judul", ""),
        deskripsi=doc.get("deskripsi", ""),
        tanggal=doc.get("tanggal", ""),
        waktu_mulai=doc.get("waktu_mulai", ""),
        waktu_selesai=doc.get("waktu_selesai", ""),
        lokasi=doc.get("lokasi", ""),
        narasumber=doc.get("narasumber", ""),
        kapasitas=int(doc.get("kapasitas", 0)),
        created_at=doc.get("created_at", ""),
        peserta_count=int(peserta_count),
        flyer_url=doc.get("flyer_url", ""),
    )


# ── List & detail pelatihan (semua role authenticated) ────────────────────────

@router.get("", response_model=list[PelatihanOut])
async def list_pelatihan(_: str = Depends(get_current_user)):
    db = get_db()
    docs = await db.pelatihan.find({}).sort("tanggal", -1).to_list(200)
    return [await _pelatihan_out(db, d) for d in docs]


@router.get("/{pel_id}", response_model=PelatihanOut)
async def get_pelatihan(pel_id: str, _: str = Depends(get_current_user)):
    db = get_db()
    doc = await db.pelatihan.find_one({"_id": _oid(pel_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    return await _pelatihan_out(db, doc)


# ── Admin: CRUD pelatihan ──────────────────────────────────────────────────────

@router.post("", response_model=PelatihanOut, status_code=status.HTTP_201_CREATED)
async def create_pelatihan(body: PelatihanCreate, _: str = Depends(require_content_admin)):
    db = get_db()
    doc = {
        "judul": body.judul.strip(),
        "deskripsi": body.deskripsi.strip(),
        "tanggal": body.tanggal.strip(),
        "waktu_mulai": body.waktu_mulai.strip(),
        "waktu_selesai": body.waktu_selesai.strip(),
        "lokasi": body.lokasi.strip(),
        "narasumber": body.narasumber.strip(),
        "kapasitas": body.kapasitas,
        "flyer_url": body.flyer_url.strip() if body.flyer_url else "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "qr_token": secrets.token_urlsafe(16),
    }
    result = await db.pelatihan.insert_one(doc)
    doc["_id"] = result.inserted_id
    try:
        from app.routers.notifikasi import notify_jadwal_pelatihan_baru

        await notify_jadwal_pelatihan_baru(db, doc)
    except Exception:
        pass
    return await _pelatihan_out(db, doc)


@router.patch("/{pel_id}", response_model=PelatihanOut)
async def update_pelatihan(pel_id: str, body: PelatihanUpdate, _: str = Depends(require_content_admin)):
    db = get_db()
    upd: dict = {}
    if body.judul is not None:
        upd["judul"] = body.judul.strip()
    if body.deskripsi is not None:
        upd["deskripsi"] = body.deskripsi.strip()
    if body.tanggal is not None:
        upd["tanggal"] = body.tanggal.strip()
    if body.waktu_mulai is not None:
        upd["waktu_mulai"] = body.waktu_mulai.strip()
    if body.waktu_selesai is not None:
        upd["waktu_selesai"] = body.waktu_selesai.strip()
    if body.lokasi is not None:
        upd["lokasi"] = body.lokasi.strip()
    if body.narasumber is not None:
        upd["narasumber"] = body.narasumber.strip()
    if body.kapasitas is not None:
        upd["kapasitas"] = body.kapasitas
    if body.flyer_url is not None:
        upd["flyer_url"] = body.flyer_url.strip()
    if upd:
        await db.pelatihan.update_one({"_id": _oid(pel_id)}, {"$set": upd})
    doc = await db.pelatihan.find_one({"_id": _oid(pel_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    return await _pelatihan_out(db, doc)


@router.delete("/{pel_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_pelatihan(pel_id: str, _: str = Depends(require_content_admin)):
    db = get_db()
    await db.pelatihan.delete_one({"_id": _oid(pel_id)})
    await db.pelatihan_peserta.delete_many({"pelatihan_id": pel_id})


# ── QR token untuk scan absensi ────────────────────────────────────────────────

@router.get("/{pel_id}/qr-token")
async def get_qr_token(pel_id: str, _: str = Depends(require_kapus)):
    db = get_db()
    doc = await db.pelatihan.find_one({"_id": _oid(pel_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    return {"pelatihan_id": pel_id, "qr_token": doc.get("qr_token", ""), "judul": doc.get("judul", "")}


@router.post("/{pel_id}/regenerate-qr")
async def regenerate_qr(pel_id: str, _: str = Depends(require_kapus)):
    db = get_db()
    new_token = secrets.token_urlsafe(16)
    result = await db.pelatihan.update_one({"_id": _oid(pel_id)}, {"$set": {"qr_token": new_token}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    return {"qr_token": new_token}


# ── QR scan absensi (oleh staff yang scan) ────────────────────────────────────

@router.post("/scan-qr")
async def scan_qr_absen(body: QRScanIn, username: str = Depends(get_current_user)):
    """Staff scan QR → ditandai hadir (kapus tetap bisa override)."""
    db = get_db()
    doc = await db.pelatihan.find_one({"_id": _oid(body.pelatihan_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    if doc.get("qr_token") != body.token:
        raise HTTPException(status_code=400, detail="Token QR tidak valid")
    peserta = await db.pelatihan_peserta.find_one({
        "pelatihan_id": body.pelatihan_id,
        "username": username,
    })
    if not peserta:
        raise HTTPException(status_code=403, detail="Anda tidak terdaftar sebagai peserta pelatihan ini")
    await db.pelatihan_peserta.update_one(
        {"pelatihan_id": body.pelatihan_id, "username": username},
        {"$set": {
            "hadir": True,
            "via_qr": True,
            "waktu_absen": datetime.now(timezone.utc).isoformat(),
        }},
    )
    return {"ok": True, "message": "Absensi berhasil via QR"}


# ── Kapus: kelola peserta & absensi ───────────────────────────────────────────

@router.get("/{pel_id}/peserta", response_model=list[AbsensiOut])
async def list_peserta(pel_id: str, username: str = Depends(require_kapus)):
    db = get_db()
    docs = await db.pelatihan_peserta.find({"pelatihan_id": pel_id}).to_list(500)
    out: list[AbsensiOut] = []
    pelatihan = await db.pelatihan.find_one({"_id": _oid(pel_id)})
    judul = pelatihan.get("judul", "") if pelatihan else ""
    for d in docs:
        user = await db.users.find_one({"username": d.get("username")})
        dn = user.get("display_name") if user else None
        out.append(AbsensiOut(
            id=str(d["_id"]),
            pelatihan_id=pel_id,
            pelatihan_judul=judul,
            username=d.get("username", ""),
            display_name=dn,
            hadir=bool(d.get("hadir", False)),
            waktu_absen=d.get("waktu_absen"),
            via_qr=bool(d.get("via_qr", False)),
        ))
    return out


@router.post("/{pel_id}/peserta/toggle")
async def toggle_peserta(pel_id: str, body: PesertaToggleIn, username: str = Depends(require_kapus)):
    """Kapus daftarkan / hapus peserta dari pelatihan (belum absensi, hanya daftar hadir)."""
    db = get_db()
    # Kalau kapus (bukan admin), cek apakah staff tsb ada di puskesmasnya
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        pk_id = caller.get("puskesmas_id")
        target = await db.users.find_one({"username": body.username})
        if not target or target.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Staff bukan milik puskesmas Anda")
    if body.terdaftar:
        existing = await db.pelatihan_peserta.find_one({
            "pelatihan_id": pel_id,
            "username": body.username,
        })
        if not existing:
            await db.pelatihan_peserta.insert_one({
                "pelatihan_id": pel_id,
                "username": body.username,
                "hadir": False,
                "via_qr": False,
                "waktu_absen": None,
                "didaftarkan_oleh": username,
                "didaftarkan_at": datetime.now(timezone.utc).isoformat(),
            })
    else:
        await db.pelatihan_peserta.delete_one({
            "pelatihan_id": pel_id,
            "username": body.username,
        })
    return {"ok": True}


@router.patch("/{pel_id}/absensi")
async def update_absensi(pel_id: str, body: AbsensiUpsert, username: str = Depends(require_kapus)):
    """Kapus centang / hapus centang hadir seorang peserta."""
    db = get_db()
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        pk_id = caller.get("puskesmas_id")
        target = await db.users.find_one({"username": body.username})
        if not target or target.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Staff bukan milik puskesmas Anda")
    upd: dict = {"hadir": body.hadir}
    if body.hadir:
        upd["waktu_absen"] = datetime.now(timezone.utc).isoformat()
    else:
        upd["waktu_absen"] = None
        upd["via_qr"] = False
    result = await db.pelatihan_peserta.update_one(
        {"pelatihan_id": pel_id, "username": body.username},
        {"$set": upd},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Peserta tidak ditemukan di pelatihan ini")
    return {"ok": True}


# ── Staff melihat pelatihan yang diikutinya ────────────────────────────────────

@router.get("/saya/riwayat", response_model=list[AbsensiOut])
async def riwayat_pelatihan_saya(username: str = Depends(get_current_user)):
    """Staff melihat pelatihan mana saja yang pernah diikuti."""
    db = get_db()
    docs = await db.pelatihan_peserta.find({"username": username}).to_list(200)
    out: list[AbsensiOut] = []
    for d in docs:
        pel = await db.pelatihan.find_one({"_id": _oid(d["pelatihan_id"])}) if d.get("pelatihan_id") else None
        judul = pel.get("judul", "") if pel else ""
        out.append(AbsensiOut(
            id=str(d["_id"]),
            pelatihan_id=d.get("pelatihan_id", ""),
            pelatihan_judul=judul,
            username=username,
            hadir=bool(d.get("hadir", False)),
            waktu_absen=d.get("waktu_absen"),
            via_qr=bool(d.get("via_qr", False)),
        ))
    return out
