"""Akun masyarakat sampel penelitian (user01–user30) — seed idempoten."""

from __future__ import annotations

from app.auth_utils import hash_password
from app.db import get_db

# 3 digit acak tetap per akun (agar bisa dicatat di tabel admin).
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
    734,
    408,
    871,
    356,
    629,
    184,
    507,
    963,
    241,
    578,
    836,
    412,
    795,
    263,
    918,
)

_RESEARCH_WILAYAH: tuple[tuple[str, str], ...] = (
    *((f"user{i:02d}", "Talise") for i in range(1, 11)),
    *((f"user{i:02d}", "Kab. Donggala") for i in range(11, 21)),
    *((f"user{i:02d}", "Kab. Sigi") for i in range(21, 31)),
)


def research_sample_password(index: int) -> str:
    """Password: kode urut (01–30) di awal setelah prefix 12345, 3 digit acak di akhir."""
    if not 1 <= index <= 30:
        raise ValueError("index harus 1–30")
    return f"12345{index:02d}{_PASSWORD_SUFFIXES[index - 1]}"


async def ensure_research_sample_users() -> None:
    """Seed akun sampel sekali; jangan reset password tiap restart."""
    db = get_db()
    for i, (username, wilayah) in enumerate(_RESEARCH_WILAYAH, start=1):
        plain = research_sample_password(i)
        existing = await db.users.find_one({"username": username})
        if existing:
            await db.users.update_one(
                {"username": username},
                {
                    "$set": {
                        "role": "staff",
                        "research_sample": True,
                        "research_wilayah": wilayah,
                    }
                },
            )
        else:
            await db.users.insert_one(
                {
                    "username": username,
                    "password_hash": hash_password(plain),
                    "role": "staff",
                    "research_sample": True,
                    "research_wilayah": wilayah,
                }
            )
        await db.research_sample_accounts.update_one(
            {"username": username},
            {
                "$set": {
                    "username": username,
                    "password_plain": plain,
                    "wilayah": wilayah,
                    "sort_order": i,
                }
            },
            upsert=True,
        )
