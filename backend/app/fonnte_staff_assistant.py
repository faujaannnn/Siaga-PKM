"""
Asisten LLM petugas (staff) lewat Fonnte: multi-turn chat + korpus sistem + progres pribadi.
"""

from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone

from fastapi import HTTPException
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.fonnte_staff_corpus import get_system_corpus_cached
from app.staff_assessment_profile import build_staff_assessment_context_text
from app.fonnte_client import canonical_wa_phone
from siaga_common.wa_staff_link import challenge_ok_for_backfill
from app.wa_gateway import wa_send_text
from app.llm_client import llm_chat_messages
from app.wa_text_format import format_text_for_whatsapp, split_whatsapp_message
from app.wa_staff_chat_history import (
    append_chat_turn,
    clear_chat_session,
    history_for_llm,
    is_chat_reset_command,
    load_chat_session,
    should_inject_context_block,
)

log = logging.getLogger(__name__)

_RATE: dict[str, float] = {}


def _now_mono() -> float:
    import time

    return time.monotonic()


def _rate_limited(phone: str) -> bool:
    gap = float(settings.fonnte_staff_rate_min_seconds)
    if gap <= 0:
        return False
    gap = max(0.15, min(4.0, gap))
    t = _now_mono()
    last = _RATE.get(phone, 0.0)
    if t - last < gap:
        return True
    _RATE[phone] = t
    return False


async def resolve_staff_user_for_wa_phone(
    db: AsyncIOMotorDatabase, phone: str
) -> dict | None:
    """
    Akun petugas/staff terikat lewat users.wa_phone, atau pulihkan dari wa_staff_login_challenges terakhir
    (jika update wa_phone sempet gagal / belum terbaca).
    """
    p = canonical_wa_phone(phone)
    if not p:
        return None
    variants = [p]
    if p.startswith("62") and len(p) > 2:
        variants.append("0" + p[2:])
    u = await db.users.find_one({"wa_phone": {"$in": variants}, "role": "staff"})
    if u:
        return u

    now = datetime.now(timezone.utc)
    docs: list[dict] = (
        await db.wa_staff_login_challenges.find({"consumed_at": {"$ne": None}})
        .sort("consumed_at", -1)
        .limit(100)
        .to_list(100)
    )
    for doc in docs:
        if not challenge_ok_for_backfill(doc, {}):
            continue
        exp = doc.get("expected_phone")
        if exp is None:
            continue
        if canonical_wa_phone(str(exp)) != p:
            continue
        uname = str(doc.get("username") or "").strip()
        if not uname:
            continue
        user = await db.users.find_one({"username": uname, "role": "staff"})
        if not user:
            continue
        if not challenge_ok_for_backfill(doc, user):
            continue
        try:
            await db.users.update_one(
                {"_id": user["_id"]},
                {"$set": {"wa_phone": p, "wa_phone_updated_at": now}},
            )
            log.info("fonnte: wa_phone dipulihkan dari challenge untuk %s", uname)
        except Exception as e:
            log.warning("fonnte: backfill wa_phone gagal: %s", e)
        return await db.users.find_one({"_id": user["_id"]})
    return None


async def _build_llm_context_block(db: AsyncIOMotorDatabase, username: str) -> str:
    user = await db.users.find_one({"username": username})
    display = ""
    if user:
        dn = str(user.get("display_name") or "").strip()
        wilayah = str(user.get("research_wilayah") or "").strip()
        if dn:
            display = f"Nama pengguna (panggilan): {dn}\n"
        if wilayah:
            display += f"Wilayah sampel penelitian: {wilayah}\n"
        if display:
            display = f"---- IDENTITAS PENGGUNA ----\n{display}Username login (tetap): {username}\n"
    corpus, profile = await asyncio.gather(
        get_system_corpus_cached(db),
        build_staff_assessment_context_text(db, username),
    )
    return (
        "Konteks (utamakan untuk aplikasi Siaga Bencana, materi, progres pribadi):\n\n"
        f"{corpus}\n\n{display}"
        f"---- PROFIL ASESMEN PRIBADI (akun: {username}) ----\n{profile}\n---- akhir konteks ----\n"
        "Bila pertanyaan seputar nilai, IKS, Indeks KA, hasil per soal, video/PDF ML, atau Kuis LIPI, "
        "utamakan subbagian PROFIL ASESMEN PRIBADI di atas. "
        "Saat menyapa atau merujuk pengguna, gunakan Nama pengguna bila tersedia (bukan username login). "
        "Bila tidak ada rincian, jawab bermanfaat tanpa mengarang jadwal/nomor/kebijakan/URL yang tidak ada di konteks."
    )


def _system_instructions() -> str:
    return (
        "Anda asisten Siaga Bencana lewat WhatsApp (bukan bot menu). Bahasa Indonesia natural, singkat bila cukup.\n"
        "PENTING:\n"
        "1. Baca RIWAYAT CHAT sebelum menjawab. Jika pengguna menyebut «itu», «yang tadi», «nomor X», «lanjutkan», "
        "rujuk pesan sebelumnya - jangan minta ulang informasi yang sudah dibahas.\n"
        "2. Utamakan blok KONTEKS DATA untuk fakta materi, skor asesmen, dan Kuis LIPI.\n"
        "3. Video/PDF ML = LIPI-lite (proksi KA); Kuis LIPI = pilar KAP/EP/WS/RMC lengkap - JANGAN campur keduanya.\n"
        "4. Jika RIWAYAT CHAT baru saja membahas *Kuis LIPI* (laporan, evaluasi, skor LIPI), jawab hanya tentang LIPI "
        "kecuali pengguna secara eksplisit menanyakan video/PDF ML.\n"
        "5. Jangan mengarang angka skor, nomor telepon, URL, jadwal, atau kebijakan yang tidak ada di konteks/riwayat.\n"
        "6. Jika ragu, katakan apa yang Anda ketahui dari konteks dan tanyakan bagian mana yang perlu diperjelas.\n"
        "7. Penekanan teks: gunakan SATU asterisk (*teks*), bukan **markdown**. Jangan sisakan * atau ** yatim di akhir kalimat.\n"
        "8. Pengguna bisa ketik *reset* untuk memulai percakapan baru."
    )


async def _reply_llm_with_history(
    *,
    user_question: str,
    data_block: str,
    history: list[dict[str, str]],
    inject_context: bool,
) -> str:
    messages: list[dict[str, str]] = [{"role": "system", "content": _system_instructions()}]

    if inject_context:
        messages.append(
            {
                "role": "user",
                "content": (
                    "[KONTEKS DATA - acuan fakta internal, jangan salin utuh ke pengguna]\n"
                    f"{data_block}"
                ),
            }
        )
        messages.append(
            {
                "role": "assistant",
                "content": "Baik, saya catat konteks materi dan profil asesmen Anda sebagai acuan.",
            }
        )

    messages.extend(history)
    messages.append({"role": "user", "content": user_question.strip()})

    to = min(120.0, max(15.0, float(settings.fonnte_staff_llm_read_timeout)))
    mx = int(settings.fonnte_staff_llm_max_tokens)
    ttemp = min(0.35, max(0.0, float(settings.fonnte_staff_llm_temperature)))
    return await llm_chat_messages(
        messages,
        temperature=ttemp,
        max_tokens=mx,
        read_timeout=to,
    )


def split_fonnte_message(s: str, limit: int = 3600) -> list[str]:
    """Alias - pecah pesan WA dengan normalisasi *tebal*."""
    return split_whatsapp_message(s, limit=limit)


async def handle_staff_fonnte_message(
    db: AsyncIOMotorDatabase,
    *,
    sender: str,
    message: str,
    inbox_id: int | None,
    send_target: str | None = None,
) -> tuple[bool, str]:
    if not settings.fonnte_staff_ai_enabled:
        return False, "disabled"
    p = canonical_wa_phone(sender)
    if not p:
        return False, "no_phone"
    if not (message or "").strip():
        return False, "empty"
    st = (send_target or "").strip()
    if st.lower().endswith("@lid") or st.lower().endswith("@s.whatsapp.net"):
        dest = st
    else:
        dest = canonical_wa_phone(st) or p

    if _rate_limited(p) and float(settings.fonnte_staff_rate_min_seconds) > 0:
        await wa_send_text(
            dest,
            "Sesaat dulu - pesan sebelumnya masih diproses.",
            inboxid=inbox_id,
        )
        return True, "rate_limited"

    user_doc = await resolve_staff_user_for_wa_phone(db, p)
    if not user_doc:
        log.warning(
            "fonnte LLM: nomor tidak terikat ke akun petugas (perlu verifikasi SBP / akun staff)"
        )
        return False, "not_bound_staff"

    username = str(user_doc.get("username", "") or "").strip()
    if not username:
        return False, "no_user"

    raw = (message or "").strip()[:20000]

    if is_chat_reset_command(raw):
        await clear_chat_session(db, p)
        reply = "Riwayat chat direset. Silakan tanyakan lagi - saya siap membantu."
        await wa_send_text(dest, reply, inboxid=inbox_id)
        return True, "reset"

    session = await load_chat_session(db, p)
    history = history_for_llm(session)
    inject_ctx = should_inject_context_block(session)

    data_block = await _build_llm_context_block(db, username)
    try:
        reply = await _reply_llm_with_history(
            user_question=raw,
            data_block=data_block,
            history=history,
            inject_context=inject_ctx,
        )
    except HTTPException as e:
        d = e.detail
        d_str = d if isinstance(d, str) else (str(d[0]) if isinstance(d, list) and d else "error")
        reply = f"Layanan AI sementara tidak tersedia: {d_str}"
    except Exception as e:
        log.exception("fonnte_staff LLM: %s", e)
        reply = "Gagal memproses permintaan. Coba lagi sebentar atau buka ruang masyarakat di situs."

    reply = format_text_for_whatsapp(reply)
    if not reply:
        reply = "Saya tidak menghasilkan teks. Ulangi pertanyaan dengan kalimat lengkap."

    await append_chat_turn(
        db,
        phone=p,
        username=username,
        user_text=raw,
        assistant_text=reply,
        context_refreshed=inject_ctx,
    )

    parts = split_fonnte_message(reply)
    for i, part in enumerate(parts):
        ok, det = await wa_send_text(dest, part, inboxid=inbox_id if i == 0 else None)
        if not ok:
            log.warning("fonnte staff send part %s: %s", i, det)
    return True, "llm"
