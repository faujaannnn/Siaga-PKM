"""
Magic link login petugas (staff) lewat WA (Fonnte).
Teks verifikasi: SBP <40 hex> - prefix singkat "Siaga Bencana Puskesmas" (SBP).
"""

import hashlib
import logging
import re
import secrets
import uuid
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.auth_utils import create_access_token
from app.fonnte_client import canonical_wa_phone
from siaga_common.wa_staff_link import bind_wa_staff_phone_exclusive

log = logging.getLogger(__name__)

# Sama panjangnya dengan token fmanage: 20 byte hex
TOKEN_BYTES = 10
PREFIX = "SBP"
_MSG_RE = re.compile(
    rf"(?i){PREFIX}[\s:,-]*([A-Fa-f0-9]{{{2 * TOKEN_BYTES}}}])",
    re.DOTALL,
)
_INVISIBLE_RE = re.compile(r"[\u200b-\u200d\ufeff\u2060\u00a0]+")


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def new_raw_token() -> str:
    return secrets.token_hex(TOKEN_BYTES)


def _clean_magic_text(text: str) -> str:
    t = unicodedata.normalize("NFKC", text)
    return _INVISIBLE_RE.sub("", t)


def extract_sbp_code_from_message(text: str) -> str | None:
    if not text or not isinstance(text, str):
        return None
    cleaned = _clean_magic_text(text.strip())
    m = _MSG_RE.search(cleaned)
    if m:
        return m.group(1).lower()
    m2 = re.search(r"(?i)SBP", cleaned)
    if not m2:
        return None
    tail = cleaned[m2.end() :]
    hexonly = re.sub(r"[^a-fA-F0-9]", "", tail)
    if len(hexonly) >= 2 * TOKEN_BYTES:
        return hexonly[: 2 * TOKEN_BYTES].lower()
    return None


def scan_payload_for_sbp_code(obj: Any, depth: int = 0) -> str | None:
    if depth > 8:
        return None
    if isinstance(obj, str):
        return extract_sbp_code_from_message(obj)
    if isinstance(obj, dict):
        for v in obj.values():
            c = scan_payload_for_sbp_code(v, depth + 1)
            if c:
                return c
    if isinstance(obj, list):
        for v in obj:
            c = scan_payload_for_sbp_code(v, depth + 1)
            if c:
                return c
    return None


async def start_staff_wa_login(
    db: AsyncIOMotorDatabase,
    *,
    username: str,
    expected_phone: str,
    ttl_minutes: int,
) -> tuple[str, str, str, datetime]:
    """
    Returns session_id, raw token (tampil ke user), message_text, expires_at.
    """
    session_id = str(uuid.uuid4())
    raw = new_raw_token()
    h = hash_token(raw)
    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=max(5, min(ttl_minutes, 24 * 60)))
    message_text = f"{PREFIX} {raw}"
    await db.wa_staff_login_challenges.insert_one(
        {
            "session_id": session_id,
            "token_hash": h,
            "username": username,
            "expected_phone": expected_phone,
            "created_at": now,
            "expires_at": exp,
            "consumed_at": None,
            "access_token": None,
        }
    )
    return session_id, raw, message_text, exp


async def sbp_challenge_for_code(
    db: AsyncIOMotorDatabase, raw_code: str
) -> dict | None:
    """Challenge SBP di DB proyek ini (pending atau sudah consumed), atau None."""
    h = hash_token(raw_code)
    return await db.wa_staff_login_challenges.find_one({"token_hash": h})


async def consume_sbp_code_for_staff_login(
    db: AsyncIOMotorDatabase,
    *,
    raw_code: str,
    phone: str,
) -> tuple[bool, str]:
    """
    Setelah kode valid: simpan JWT untuk polling; balikan (ok, pesan ke balasan WA).
    """
    h = hash_token(raw_code)
    now = datetime.now(timezone.utc)
    canon_phone = canonical_wa_phone(phone)
    if not canon_phone:
        return False, "Kode tidak valid."

    done = await db.wa_staff_login_challenges.find_one(
        {"token_hash": h, "consumed_at": {"$ne": None}}
    )
    if done:
        exp_phone = done.get("expected_phone")
        if exp_phone and canonical_wa_phone(str(exp_phone)) == canon_phone:
            log.debug(
                "sbp: kode sudah diverifikasi (idempotent) user=%s",
                done.get("username"),
            )
            return True, ""
        return False, ""

    doc = await db.wa_staff_login_challenges.find_one(
        {
            "token_hash": h,
            "consumed_at": None,
            "expires_at": {"$gt": now},
        }
    )
    if not doc:
        return False, "Kode tidak valid atau sudah kedaluwarsa. Buat kode baru dari halaman login."

    uname = str(doc.get("username") or "").strip()
    if not uname:
        return False, "Kode tidak valid."

    exp_phone = doc.get("expected_phone")
    if exp_phone and canonical_wa_phone(str(exp_phone)) != canon_phone:
        return (
            False,
            "Nomor pengirim tidak sama dengan yang Anda masukkan di web. "
            "Pastikan mengirim dari nomor tersebut, atau buat kode baru.",
        )

    user = await db.users.find_one({"username": uname})
    if not user or str(user.get("role", "")) != "staff":
        return False, "Akun masyarakat tidak ditemukan atau login WA hanya untuk peran staff."

    issue_jwt = create_access_token(uname)
    await db.wa_staff_login_challenges.update_one(
        {"_id": doc["_id"]},
        {
            "$set": {
                "consumed_at": now,
                "access_token": issue_jwt,
            }
        },
    )
    await bind_wa_staff_phone_exclusive(
        db,
        username=uname,
        phone=canon_phone,
        now=now,
    )
    # Simpan nomor WA petugas/staff agar asisten Fonnte bisa mengenali pengirim (tanpa login web lagi)
    try:
        res = await db.users.update_one(
            {"username": uname},
            {"$set": {"wa_phone": canon_phone, "wa_phone_updated_at": now}},
        )
        if res.matched_count == 0:
            log.error("wa_phone: user %s tidak ditemukan saat update", uname)
        elif res.modified_count == 0 and res.matched_count:
            log.debug("wa_phone: %s sudah sama", uname)
    except Exception as e:
        log.exception("wa_phone: gagal simpan untuk %s: %s", uname, e)
    return (
        True,
        "✅ Verifikasi berhasil. Buka lagi browser bila sedang login - halaman akan lanjut otomatis.\n"
        "💬 Di chat ini Anda bisa langsung bertanya tentang materi SiAP-PKM; "
        "jawaban memakai data sistem (bisa beberapa detik).",
    )


async def poll_staff_wa_session(
    db: AsyncIOMotorDatabase, *, session_id: str
) -> tuple[str | None, str | None]:
    """
    Ambil access_token sekali (lalu dihapus dari dokumen).
    Returns (access_token, error_detail).
    """
    sid = (session_id or "").strip()
    if not sid:
        return None, "session_id wajib diisi"
    doc = await db.wa_staff_login_challenges.find_one({"session_id": sid})
    if not doc:
        return None, "Sesi tidak ditemukan. Mulai dari halaman login."
    if not doc.get("consumed_at"):
        return None, None  # still pending
    token = doc.get("access_token")
    if not token or not isinstance(token, str):
        return None, "Sesi sudah selesai atau token sudah diambil. Mulai ulang bila perlu."
    await db.wa_staff_login_challenges.update_one(
        {"_id": doc["_id"]},
        {"$unset": {"access_token": ""}},
    )
    return token, None
