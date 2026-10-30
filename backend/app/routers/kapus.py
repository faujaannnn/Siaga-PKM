"""Router: kepala puskesmas - dashboard, kelola staff, lihat skor."""
from datetime import datetime, timezone
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth_utils import hash_password
from app.deps import require_kapus, get_current_user
from app.db import get_db
from app.pelatihan_compliance import REMINDER_PELATIHAN_MESSAGE, staff_belum_pelatihan_1tahun
from app.schemas import (
    KapusDashboardOut,
    StaffBelumPelatihanOut,
    StaffCreateByKapusBody,
    StaffOut,
    StaffSkorOut,
    StaffUpdateBody,
)
from app.wa_gateway import wa_send_text

router = APIRouter(prefix="/kapus", tags=["kepala_puskesmas"])


def _oid(raw: str) -> ObjectId:
    try:
        return ObjectId(raw)
    except (InvalidId, Exception):
        raise HTTPException(status_code=400, detail="ID tidak valid")


async def _get_puskesmas_id_for(db, username: str) -> str:
    """Return puskesmas_id milik kepala puskesmas ini. Admin boleh akses semua."""
    doc = await db.users.find_one({"username": username})
    if not doc:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    role = doc.get("role", "staff")
    if role == "admin":
        return ""  # admin bisa akses semua
    pk_id = doc.get("puskesmas_id")
    if not pk_id:
        raise HTTPException(
            status_code=400,
            detail="Akun kepala puskesmas ini belum dikaitkan ke puskesmas manapun",
        )
    return str(pk_id)


# ── Dashboard ──────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=KapusDashboardOut)
async def get_dashboard(username: str = Depends(require_kapus)):
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    puskesmas = await db.puskesmas.find_one({"_id": _oid(pk_id)}) if pk_id else None
    puskesmas_nama = puskesmas.get("nama", "") if puskesmas else "Semua Puskesmas"

    staff_count = await db.users.count_documents({"puskesmas_id": pk_id, "role": "staff"}) if pk_id else 0
    pelatihan_count = await db.pelatihan.count_documents({})

    bulan_ini = datetime.now(timezone.utc).strftime("%Y-%m")
    peserta_hadir = await db.pelatihan_peserta.count_documents({
        "hadir": True,
        "waktu_absen": {"$regex": f"^{bulan_ini}"},
    }) if pk_id else 0

    belum_1tahun = len(await staff_belum_pelatihan_1tahun(db, pk_id)) if pk_id else 0

    return KapusDashboardOut(
        puskesmas_id=pk_id,
        puskesmas_nama=puskesmas_nama,
        staff_count=int(staff_count),
        pelatihan_count=int(pelatihan_count),
        staff_hadir_bulan_ini=int(peserta_hadir),
        notif_pending=int(belum_1tahun),
        staff_belum_pelatihan_1tahun=int(belum_1tahun),
    )


# ── Kelola staff puskesmas ─────────────────────────────────────────────────────

@router.get("/staff", response_model=list[StaffOut])
async def list_staff_puskesmas(username: str = Depends(require_kapus)):
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    query = {"role": "staff"}
    if pk_id:
        query["puskesmas_id"] = pk_id
    docs = await db.users.find(query).sort("username", 1).to_list(500)
    puskesmas_map: dict[str, str] = {}

    async def _nama(pid: str) -> str:
        if pid in puskesmas_map:
            return puskesmas_map[pid]
        p = await db.puskesmas.find_one({"_id": _oid(pid)}) if pid else None
        n = p.get("nama", "") if p else ""
        puskesmas_map[pid] = n
        return n

    out: list[StaffOut] = []
    for d in docs:
        pid = str(d.get("puskesmas_id") or "")
        nama_pk = await _nama(pid) if pid else None
        out.append(StaffOut(
            username=d["username"],
            role=d.get("role", "staff"),
            display_name=d.get("display_name") or None,
            wa_phone=d.get("wa_phone") or None,
            puskesmas_id=pid or None,
            puskesmas_nama=nama_pk,
        ))
    return out


@router.post("/staff", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
async def create_staff_by_kapus(body: StaffCreateByKapusBody, username: str = Depends(require_kapus)):
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    if not pk_id:
        raise HTTPException(status_code=400, detail="Tentukan puskesmas_id untuk membuat staff")
    uname = body.username.strip()
    if not uname:
        raise HTTPException(status_code=400, detail="Username tidak boleh kosong")
    if await db.users.find_one({"username": uname}):
        raise HTTPException(status_code=409, detail="Username sudah dipakai")
    doc = {
        "username": uname,
        "password_hash": hash_password(body.password),
        "role": "staff",
        "puskesmas_id": pk_id,
        "display_name": body.display_name.strip() or None,
        "wa_phone": body.wa_phone.strip() or None,
        "needs_profile_setup": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": username,
    }
    await db.users.insert_one(doc)
    puskesmas = await db.puskesmas.find_one({"_id": _oid(pk_id)})
    pk_nama = puskesmas.get("nama", "") if puskesmas else ""
    return StaffOut(
        username=uname,
        role="staff",
        display_name=doc.get("display_name"),
        wa_phone=doc.get("wa_phone"),
        puskesmas_id=pk_id,
        puskesmas_nama=pk_nama,
    )


@router.patch("/staff/{target_username}", response_model=StaffOut)
async def update_staff_by_kapus(
    target_username: str,
    body: StaffUpdateBody,
    username: str = Depends(require_kapus),
):
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Staff tidak ditemukan")
    if pk_id and target.get("puskesmas_id") != pk_id:
        raise HTTPException(status_code=403, detail="Staff bukan milik puskesmas Anda")
    upd: dict = {}
    if body.display_name is not None:
        upd["display_name"] = body.display_name.strip() or None
    if body.wa_phone is not None:
        upd["wa_phone"] = body.wa_phone.strip() or None
    if body.password is not None:
        upd["password_hash"] = hash_password(body.password)
    if body.puskesmas_id is not None:
        caller_role = (await db.users.find_one({"username": username}) or {}).get("role", "")
        if caller_role == "admin":
            upd["puskesmas_id"] = body.puskesmas_id or None
        # kapus tidak boleh pindah staff ke puskesmas lain
    if upd:
        await db.users.update_one({"username": target_username}, {"$set": upd})
    updated = await db.users.find_one({"username": target_username})
    new_pk_id = str(updated.get("puskesmas_id") or "")
    puskesmas = await db.puskesmas.find_one({"_id": _oid(new_pk_id)}) if new_pk_id else None
    pk_nama = puskesmas.get("nama", "") if puskesmas else None
    return StaffOut(
        username=target_username,
        role=updated.get("role", "staff"),
        display_name=updated.get("display_name"),
        wa_phone=updated.get("wa_phone"),
        puskesmas_id=new_pk_id or None,
        puskesmas_nama=pk_nama,
    )


@router.delete("/staff/{target_username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_staff_by_kapus(target_username: str, username: str = Depends(require_kapus)):
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Staff tidak ditemukan")
    if pk_id and target.get("puskesmas_id") != pk_id:
        raise HTTPException(status_code=403, detail="Staff bukan milik puskesmas Anda")
    if target.get("role") in ("admin", "kepala_puskesmas"):
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun admin/kepala puskesmas")
    await db.users.delete_one({"username": target_username})


# ── Laporan tahunan: staff belum pelatihan 1 tahun ─────────────────────────────

@router.get("/laporan-tahunan/staff-belum-pelatihan", response_model=list[StaffBelumPelatihanOut])
async def laporan_staff_belum_pelatihan(username: str = Depends(require_kapus)):
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    if not pk_id:
        raise HTTPException(status_code=400, detail="Puskesmas tidak ditemukan")
    rows = await staff_belum_pelatihan_1tahun(db, pk_id)
    return [StaffBelumPelatihanOut(**r) for r in rows]


@router.post("/laporan-tahunan/kirim-pengingat/{target_username}")
async def kirim_pengingat_pelatihan(target_username: str, username: str = Depends(require_kapus)):
    """Kirim WA pengingat ke staff yang belum ikut pelatihan 1 tahun."""
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    if not pk_id:
        raise HTTPException(status_code=400, detail="Puskesmas tidak ditemukan")

    target = await db.users.find_one({"username": target_username, "role": "staff", "puskesmas_id": pk_id})
    if not target:
        raise HTTPException(status_code=404, detail="Staff tidak ditemukan di puskesmas Anda")

    belum_list = await staff_belum_pelatihan_1tahun(db, pk_id)
    if not any(r["username"] == target_username for r in belum_list):
        raise HTTPException(status_code=400, detail="Staff ini sudah mengikuti pelatihan dalam 1 tahun terakhir")

    wa = (target.get("wa_phone") or "").strip()
    if not wa:
        raise HTTPException(status_code=400, detail="Staff belum punya nomor WhatsApp")

    nama = target.get("display_name") or target_username
    msg = REMINDER_PELATIHAN_MESSAGE.format(nama=nama)
    ok, detail = await wa_send_text(wa, msg)
    if not ok:
        raise HTTPException(status_code=502, detail=detail or "Gagal kirim WhatsApp")

    return {"ok": True, "message": f"Pengingat terkirim ke {nama}"}


# ── Skor staff ─────────────────────────────────────────────────────────────────

@router.get("/staff-skor", response_model=list[StaffSkorOut])
async def get_staff_skor(username: str = Depends(require_kapus)):
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    query = {"role": "staff"}
    if pk_id:
        query["puskesmas_id"] = pk_id
    docs = await db.users.find(query).sort("username", 1).to_list(500)
    out: list[StaffSkorOut] = []
    for d in docs:
        uname = d["username"]
        lipi = await db.lipi_quiz_sessions.find_one(
            {"username": uname},
            sort=[("submitted_at", -1)],
        )
        ml_video_count = await db.ml_learning_sessions.count_documents({
            "username": uname,
            "status": "done",
        })
        ml_pdf_count = await db.ml_pdf_learning_sessions.count_documents({
            "username": uname,
            "status": "done",
        })
        lipi_skor = None
        lipi_label = None
        lipi_tanggal = None
        indeks_ka = None
        if lipi:
            lipi_skor = lipi.get("pengetahuan_score") or lipi.get("total_score")
            lipi_label = lipi.get("level")
            lipi_tanggal = lipi.get("submitted_at")
        out.append(StaffSkorOut(
            username=uname,
            display_name=d.get("display_name"),
            lipi_skor=float(lipi_skor) if lipi_skor is not None else None,
            lipi_label=lipi_label,
            lipi_tanggal=lipi_tanggal,
            ml_video_count=int(ml_video_count),
            ml_pdf_count=int(ml_pdf_count),
            indeks_ka_pct=float(indeks_ka) if indeks_ka is not None else None,
        ))
    return out


# ── Pelatihan staff ────────────────────────────────────────────────────────────

@router.get("/pelatihan-staff", response_model=list[dict])
async def get_pelatihan_staff(username: str = Depends(require_kapus)):
    """Rekap pelatihan untuk semua staff di puskesmas kapus ini."""
    db = get_db()
    pk_id = await _get_puskesmas_id_for(db, username)
    query = {"role": "staff"}
    if pk_id:
        query["puskesmas_id"] = pk_id
    staff_docs = await db.users.find(query).to_list(500)
    staff_usernames = {d["username"] for d in staff_docs}

    pelatihan_docs = await db.pelatihan.find({}).sort("tanggal", -1).to_list(200)
    out = []
    for pel in pelatihan_docs:
        pel_id = str(pel["_id"])
        peserta = await db.pelatihan_peserta.find({"pelatihan_id": pel_id}).to_list(500)
        staff_hadir = [p for p in peserta if p.get("username") in staff_usernames and p.get("hadir")]
        staff_daftar = [p for p in peserta if p.get("username") in staff_usernames]
        out.append({
            "pelatihan_id": pel_id,
            "judul": pel.get("judul", ""),
            "tanggal": pel.get("tanggal", ""),
            "total_staff_puskesmas": len(staff_usernames),
            "staff_terdaftar": len(staff_daftar),
            "staff_hadir": len(staff_hadir),
        })
    return out
