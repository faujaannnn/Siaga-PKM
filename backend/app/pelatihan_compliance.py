"""Staff yang belum mengikuti pelatihan ≥ 1 tahun — dipakai notifikasi & laporan Kapus."""
from __future__ import annotations

from datetime import timedelta
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.notifikasi_schedule import now_wib

REMINDER_PELATIHAN_MESSAGE = (
    "Halo {nama},\n"
    "Anda belum mengikuti pelatihan kesiapsiagaan bencana dalam 1 tahun terakhir. "
    "Mohon segera ikuti pelatihan berikutnya untuk meningkatkan kesiapsiagaan Anda.\n"
    "SiAP-PKM"
)


async def staff_belum_pelatihan_1tahun(
    db: AsyncIOMotorDatabase,
    pk_id: str,
) -> list[dict[str, Any]]:
    """Daftar staff puskesmas tanpa kehadiran pelatihan dalam 365 hari terakhir."""
    if not pk_id:
        return []

    now = now_wib()
    cutoff = (now - timedelta(days=365)).isoformat()
    staff_docs = await db.users.find({"puskesmas_id": pk_id, "role": "staff"}).sort("username", 1).to_list(500)
    out: list[dict[str, Any]] = []

    for s in staff_docs:
        uname = s["username"]
        last = await db.pelatihan_peserta.find_one(
            {"username": uname, "hadir": True},
            sort=[("waktu_absen", -1)],
        )
        if last and last.get("waktu_absen") and str(last["waktu_absen"]) > cutoff:
            continue

        terakhir = last.get("waktu_absen") if last else None
        out.append({
            "username": uname,
            "display_name": s.get("display_name"),
            "wa_phone": s.get("wa_phone"),
            "terakhir_hadir": terakhir,
            "pernah_hadir": bool(last),
        })

    return out
