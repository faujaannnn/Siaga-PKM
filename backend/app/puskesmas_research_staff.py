"""Akun petugas penelitian per puskesmas — seed idempoten."""

from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId

from app.auth_utils import hash_password
from app.db import get_db

_PUSKESMAS_BATCHES: tuple[tuple[str, str, str, str], ...] = (
    ("Puskesmas Pantoloan", "PKM-PANTOLOAN", "pantoloan", "pan"),
    ("Puskesmas Talise", "PKM-TALISE", "talise", "tal"),
)

_PASSWORD_SUFFIXES: tuple[int, ...] = (
    847,
    293,
    561,
    104,
    739,
    482,
    615,
    328,
    901,
    456,
    273,
    840,
    519,
    662,
    195,
)


def puskesmas_staff_password(prefix: str, index: int) -> str:
    """Password: 12345 + prefix (pan/tal) + nomor 2 digit + 3 digit acak."""
    if not 1 <= index <= 15:
        raise ValueError("index harus 1–15")
    return f"12345{prefix}{index:02d}{_PASSWORD_SUFFIXES[index - 1]}"


async def _ensure_puskesmas(db, nama: str, kode: str) -> str:
    doc = await db.puskesmas.find_one({"nama": nama})
    if doc:
        return str(doc["_id"])
    now = datetime.now(timezone.utc)
    result = await db.puskesmas.insert_one(
        {
            "nama": nama,
            "alamat": "",
            "kode": kode,
            "created_at": now,
            "updated_at": now,
        }
    )
    return str(result.inserted_id)


async def ensure_puskesmas_research_staff() -> None:
    """15 akun petugas per Puskesmas Pantoloan dan Talise."""
    db = get_db()
    sort_base = 100

    for batch_idx, (pk_nama, pk_kode, username_stem, pass_prefix) in enumerate(_PUSKESMAS_BATCHES):
        pk_id = await _ensure_puskesmas(db, pk_nama, pk_kode)
        sort_base += batch_idx * 20

        for i in range(1, 16):
            username = f"{username_stem}{i:02d}"
            plain = puskesmas_staff_password(pass_prefix, i)
            sort_order = sort_base + i

            existing = await db.users.find_one({"username": username})
            if existing:
                await db.users.update_one(
                    {"username": username},
                    {
                        "$set": {
                            "role": "staff",
                            "puskesmas_id": pk_id,
                            "research_sample": True,
                            "research_wilayah": pk_nama,
                        }
                    },
                )
            else:
                await db.users.insert_one(
                    {
                        "username": username,
                        "password_hash": hash_password(plain),
                        "role": "staff",
                        "puskesmas_id": pk_id,
                        "research_sample": True,
                        "research_wilayah": pk_nama,
                        "needs_profile_setup": True,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }
                )

            await db.research_sample_accounts.update_one(
                {"username": username},
                {
                    "$set": {
                        "username": username,
                        "password_plain": plain,
                        "wilayah": pk_nama,
                        "sort_order": sort_order,
                        "puskesmas_id": pk_id,
                    }
                },
                upsert=True,
            )
