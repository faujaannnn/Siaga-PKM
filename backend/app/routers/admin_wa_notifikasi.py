"""
Router: Admin WA Notifikasi - panel test kirim WA, cek keberhasilan notifikasi.

Digunakan oleh admin/content-admin/kepala-puskesmas untuk:
- Cek status konfigurasi WA gateway
- Kirim pesan WA test ke staff tertentu
- Kirim broadcast WA ke semua staff satu puskesmas
- Test satu jenis notifikasi
- Lihat log history pengiriman WA
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.config import settings
from app.db import get_db
from app.deps import get_current_user, require_content_admin, require_kapus
from app.wa_gateway import wa_outbound_configured, wa_send_text, wa_gateway_mode

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/wa-notifikasi", tags=["admin-wa-notifikasi"])


# ─── Schemas ────────────────────────────────────────────────────────────────────

class StaffWAListItem(BaseModel):
    username: str
    display_name: str
    wa_phone: str
    role: str
    has_phone: bool


class WaConfigStatus(BaseModel):
    gateway_mode: str
    is_configured: bool
    fonnte_configured: bool
    evolution_configured: bool
    inbound_wa: str


class WaTestSendIn(BaseModel):
    target_phone: str
    message: str


class WaTestSendResult(BaseModel):
    ok: bool
    detail: str
    target: str
    gateway: str


class WaBroadcastResult(BaseModel):
    total: int
    berhasil: int
    gagal: int
    detail: list[dict]


class WaNotifikasiHistoryItem(BaseModel):
    id: str
    target_phone: str
    target_username: str | None
    message_preview: str
    status: Literal["sukses", "gagal", "pending"]
    error_detail: str | None
    created_at: str
    notif_id: str | None


class WaNotifikasiLogOut(BaseModel):
    total: int
    items: list[WaNotifikasiHistoryItem]


# ─── Helper ─────────────────────────────────────────────────────────────────────

def _normalize_phone(phone: str) -> str:
    """Normalisasi nomor telepon ke format 62xxxx."""
    p = phone.strip().replace(" ", "").replace("-", "")
    if p.startswith("0"):
        return "62" + p[1:]
    if p.startswith("+"):
        return p[1:]
    return p


async def _save_wa_log(
    db,
    *,
    target_phone: str,
    target_username: str | None = None,
    message: str,
    status: Literal["sukses", "gagal", "pending"] = "pending",
    error_detail: str | None = None,
    notif_id: str | None = None,
) -> str:
    """Simpan log pengiriman WA, return log id."""
    import uuid

    log_id = str(uuid.uuid4())[:12]
    doc = {
        "_id": log_id,
        "target_phone": target_phone,
        "target_username": target_username,
        "message_preview": message[:200],
        "status": status,
        "error_detail": error_detail,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "notif_id": notif_id,
    }
    await db.wa_notifikasi_log.insert_one(doc)
    return log_id


async def _update_wa_log_status(db, log_id: str, status: str, error_detail: str | None = None):
    await db.wa_notifikasi_log.update_one(
        {"_id": log_id},
        {"$set": {"status": status, "error_detail": error_detail}},
    )


# ─── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/status", response_model=WaConfigStatus)
async def get_wa_config_status(username: str = Depends(get_current_user)):
    """Cek status konfigurasi WA gateway saat ini."""
    mode = wa_gateway_mode()
    configured = wa_outbound_configured()

    fonnte_ok = bool((settings.fonnte_token or "").strip())
    evol_ok = bool(
        (settings.evolution_api_key or "").strip()
        and (settings.evolution_instance or "").strip()
        and (settings.evolution_api_base or "").strip()
    )

    inbound = ""
    if mode == "evolution":
        inbound = (settings.evolution_inbound_wa or "").strip()
    else:
        inbound = (settings.fonnte_inbound_wa or "").strip()

    return WaConfigStatus(
        gateway_mode=mode,
        is_configured=configured,
        fonnte_configured=fonnte_ok,
        evolution_configured=evol_ok,
        inbound_wa=inbound,
    )


@router.get("/staff-list/{pk_id}", response_model=list[StaffWAListItem])
async def list_staff_with_wa(
    pk_id: str,
    username: str = Depends(get_current_user),
):
    """Daftar staff satu puskesmas dengan status WA."""
    db = get_db()
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        if caller.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Bukan puskesmas Anda")
    elif caller and caller.get("role") not in ("content_admin", "main_admin"):
        raise HTTPException(status_code=403, detail="Hanya admin yang bisa akses")

    staff_docs = await db.users.find(
        {"puskesmas_id": pk_id, "role": "staff"}
    ).to_list(500)

    return [
        StaffWAListItem(
            username=d["username"],
            display_name=d.get("display_name") or d["username"],
            wa_phone=d.get("wa_phone") or "",
            role=d.get("role", "staff"),
            has_phone=bool((d.get("wa_phone") or "").strip()),
        )
        for d in staff_docs
    ]


@router.post("/test-kirim", response_model=WaTestSendResult)
async def test_kirim_wa(
    body: WaTestSendIn,
    username: str = Depends(require_content_admin),
):
    """Kirim pesan WA test ke nomor tertentu."""
    if not wa_outbound_configured():
        raise HTTPException(
            status_code=503,
            detail="WA gateway belum dikonfigurasi di server",
        )

    if not body.target_phone.strip():
        raise HTTPException(status_code=400, detail="Nomor target WA wajib diisi")

    if not body.message.strip():
        raise HTTPException(status_code=400, detail="Pesan tidak boleh kosong")

    if len(body.message) > 4096:
        raise HTTPException(status_code=400, detail="Pesan terlalu panjang (maks 4096 karakter)")

    target = _normalize_phone(body.target_phone)
    if len(target) < 10:
        raise HTTPException(status_code=400, detail="Nomor WA tidak valid")

    db = get_db()
    log_id = await _save_wa_log(
        db,
        target_phone=target,
        target_username=None,
        message=body.message,
        status="pending",
    )

    ok, detail = await wa_send_text(target, body.message)

    if ok:
        await _update_wa_log_status(db, log_id, "sukses")
        return WaTestSendResult(
            ok=True,
            detail="Pesan berhasil dikirim",
            target=target,
            gateway=wa_gateway_mode(),
        )
    else:
        await _update_wa_log_status(db, log_id, "gagal", str(detail))
        return WaTestSendResult(
            ok=False,
            detail=str(detail),
            target=target,
            gateway=wa_gateway_mode(),
        )


@router.post("/broadcast/{pk_id}", response_model=WaBroadcastResult)
async def broadcast_wa_staff(
    pk_id: str,
    message: str = Query(..., min_length=1, max_length=4096),
    username: str = Depends(require_content_admin),
):
    """Kirim pesan WA broadcast ke semua staff satu puskesmas."""
    if not wa_outbound_configured():
        raise HTTPException(
            status_code=503,
            detail="WA gateway belum dikonfigurasi",
        )

    db = get_db()
    staff_docs = await db.users.find(
        {"puskesmas_id": pk_id, "role": "staff", "wa_phone": {"$exists": True, "$ne": ""}}
    ).to_list(500)

    if not staff_docs:
        raise HTTPException(status_code=404, detail="Tidak ada staff dengan WA di puskesmas ini")

    results: list[dict] = []
    berhasil = 0
    gagal = 0

    for s in staff_docs:
        phone = _normalize_phone(s["wa_phone"])
        dn = s.get("display_name") or s["username"]
        msg = f"Halo {dn},\n\n{message}\n\nSiAP-PKM"

        log_id = await _save_wa_log(
            db,
            target_phone=phone,
            target_username=s["username"],
            message=msg,
            status="pending",
            notif_id="admin_broadcast",
        )

        ok, detail = await wa_send_text(phone, msg)
        if ok:
            await _update_wa_log_status(db, log_id, "sukses")
            results.append({"username": s["username"], "phone": phone, "status": "sukses", "detail": "OK"})
            berhasil += 1
        else:
            await _update_wa_log_status(db, log_id, "gagal", str(detail))
            results.append({"username": s["username"], "phone": phone, "status": "gagal", "detail": str(detail)})
            gagal += 1

    return WaBroadcastResult(total=len(staff_docs), berhasil=berhasil, gagal=gagal, detail=results)


@router.post("/test-notifikasi/{pk_id}/{notif_id}", response_model=dict)
async def test_satu_notifikasi(
    pk_id: str,
    notif_id: str,
    username: str = Depends(require_content_admin),
):
    """Test kirim satu jenis notifikasi terjadwal (panggil langsung handler-nya)."""
    from app.routers.notifikasi import (
        DEFAULT_NOTIF_JENIS,
        _proses_notifikasi_puskesmas,
        notify_jadwal_pelatihan_baru,
        notify_materi_baru,
    )

    db = get_db()

    # Cari notifikasi di settings
    doc = await db.notifikasi_settings.find_one({"puskesmas_id": pk_id})
    notif = None
    if doc:
        for n in doc.get("notifikasi", []):
            if n.get("id") == notif_id:
                notif = n
                break

    if not notif:
        for n in DEFAULT_NOTIF_JENIS:
            if n["id"] == notif_id:
                notif = n
                break

    if not notif:
        raise HTTPException(status_code=404, detail="Jenis notifikasi tidak ditemukan")

    # Handle instant notifikasi
    if notif_id == "info_jadwal_pelatihan":
        pel = await db.pelatihan.find({}).sort("created_at", -1).limit(1).to_list(1)
        if pel:
            await notify_jadwal_pelatihan_baru(db, pel[0])
            return {"ok": True, "message": f"Notifikasi '{notif.get('label', notif_id)}' diproses (instant)"}
        else:
            raise HTTPException(status_code=400, detail="Belum ada jadwal pelatihan untuk test")

    if notif_id == "notif_materi_baru":
        materi = await db.education_items.find({}).sort("created_at", -1).limit(1).to_list(1)
        if materi:
            await notify_materi_baru(db, materi[0])
            return {"ok": True, "message": f"Notifikasi '{notif.get('label', notif_id)}' diproses (instant)"}
        else:
            raise HTTPException(status_code=400, detail="Belum ada materi edukasi untuk test")

    # Handle terjadwal
    await _proses_notifikasi_puskesmas(db, pk_id, notif)
    return {"ok": True, "message": f"Notifikasi '{notif.get('label', notif_id)}' diproses"}


@router.get("/log/{pk_id}", response_model=WaNotifikasiLogOut)
async def get_notifikasi_log(
    pk_id: str,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    username: str = Depends(get_current_user),
):
    """Ambil log history pengiriman WA untuk satu puskesmas."""
    db = get_db()
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        if caller.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Bukan puskesmas Anda")
    elif caller and caller.get("role") not in ("content_admin", "main_admin"):
        raise HTTPException(status_code=403, detail="Hanya admin yang bisa akses")

    # Ambil staff usernames di puskesmas ini
    staff_docs = await db.users.find(
        {"puskesmas_id": pk_id, "role": "staff"}
    ).to_list(500)
    usernames = [d["username"] for d in staff_docs]

    query: dict = {"target_username": {"$in": usernames}} if usernames else {}

    total = await db.wa_notifikasi_log.count_documents(query)
    docs = (
        await db.wa_notifikasi_log.find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
        .to_list(limit)
    )

    items = [
        WaNotifikasiHistoryItem(
            id=str(d["_id"]),
            target_phone=d.get("target_phone", ""),
            target_username=d.get("target_username"),
            message_preview=d.get("message_preview", ""),
            status=d.get("status", "pending"),
            error_detail=d.get("error_detail"),
            created_at=d.get("created_at", ""),
            notif_id=d.get("notif_id"),
        )
        for d in docs
    ]

    return WaNotifikasiLogOut(total=total, items=items)


@router.get("/log-stats/{pk_id}")
async def get_notifikasi_stats(
    pk_id: str,
    username: str = Depends(get_current_user),
):
    """Statistik成功率 pengiriman WA untuk satu puskesmas."""
    db = get_db()
    caller = await db.users.find_one({"username": username})
    if caller and caller.get("role") == "kepala_puskesmas":
        if caller.get("puskesmas_id") != pk_id:
            raise HTTPException(status_code=403, detail="Bukan puskesmas Anda")
    elif caller and caller.get("role") not in ("content_admin", "main_admin"):
        raise HTTPException(status_code=403, detail="Hanya admin yang bisa akses")

    # Ambil staff usernames
    staff_docs = await db.users.find(
        {"puskesmas_id": pk_id, "role": "staff"}
    ).to_list(500)
    usernames = [d["username"] for d in staff_docs]
    query: dict = {"target_username": {"$in": usernames}} if usernames else {}

    total = await db.wa_notifikasi_log.count_documents(query)
    sukses = await db.wa_notifikasi_log.count_documents({**query, "status": "sukses"})
    gagal = await db.wa_notifikasi_log.count_documents({**query, "status": "gagal"})

    # Breakdown per notif_id
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$notif_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]
    breakdown = await db.wa_notifikasi_log.aggregate(pipeline).to_list(50)

    return {
        "puskesmas_id": pk_id,
        "total_pengiriman": total,
        "sukses": sukses,
        "gagal": gagal,
        "success_rate": round(sukses / total * 100, 1) if total > 0 else 0.0,
        "per_tipe": [{"notif_id": b["_id"], "jumlah": b["count"]} for b in breakdown],
    }


@router.post("/reset-log/{pk_id}")
async def reset_notifikasi_log(
    pk_id: str,
    username: str = Depends(require_content_admin),
):
    """Hapus semua log WA untuk satu puskesmas (bersihkan history)."""
    db = get_db()

    staff_docs = await db.users.find(
        {"puskesmas_id": pk_id, "role": "staff"}
    ).to_list(500)
    usernames = [d["username"] for d in staff_docs]
    query: dict = {"target_username": {"$in": usernames}} if usernames else {}

    result = await db.wa_notifikasi_log.delete_many(query)
    return {"ok": True, "deleted": result.deleted_count}
