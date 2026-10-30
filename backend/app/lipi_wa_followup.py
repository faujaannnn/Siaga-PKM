"""Tawaran & balasan WA: evaluasi lengkap per soal setelah laporan Kuis LIPI."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.fonnte_client import canonical_wa_phone
from app.fonnte_staff_assistant import resolve_staff_user_for_wa_phone, split_fonnte_message
from app.wa_gateway import wa_send_text
from app.wa_staff_chat_history import append_wa_context_turn

log = logging.getLogger(__name__)

_COLLECTION = "lipi_wa_detail_pending"
_LIPI_SESSION_LOOKBACK_HOURS = 168  # 7 hari

LIPI_WA_FOLLOWUP_PROMPT = (
    "Apakah Anda mau mengetahui soal lengkap dan evaluasi tiap soal?\n"
    "Balas *ya* jika ingin penjelasan rinci, atau *tidak* jika cukup dengan ringkasan di atas."
)

_SECTION_LABELS = {
    "ed": "Efikasi Diri",
    "pg": "Pengetahuan",
    "sk": "Sikap",
    "td": "Tindakan",
    "kap": "Pengetahuan (KAP)",
    "ep": "Rencana Keluarga (EP)",
    "ws": "Peringatan Bencana (WS)",
    "rmc": "Mobilisasi Sumber Daya (RMC)",
}

_ANSWER_LABELS = {
    "ya": "Ya",
    "tidak": "Tidak",
    "tidak_tahu": "Tidak Tahu",
    "ss": "SS (Sangat Setuju)",
    "s": "S (Setuju)",
    "ks": "KS (Kurang Setuju)",
    "ts": "TS (Tidak Setuju)",
    "sts": "STS (Sangat Tidak Setuju)",
    "a": "A",
    "b": "B",
    "c": "C",
    "d": "D",
    "1": "1",
    "2": "2",
    "3": "3",
    "4": "4",
}

_AFFIRM_RE = re.compile(
    r"^(ya|iya|iyaa|yes|y|ok|oke|okay|siap|betul|benar|mau|ingin|boleh|"
    r"silakan|please|bisa|tolong|lanjut|tunjukkan|jelaskan|jelasin|mohon|setuju)\b",
    re.I,
)
_NEGATIVE_RE = re.compile(
    r"^(tidak|ngga|nggak|gak|ga|no|n|skip|cukup|udah|sudah|nanti|belum|"
    r"engga|enggak|ga perlu|gak perlu|tidak perlu)\b",
    re.I,
)

_AFFIRM_PHRASES = (
    "mau tau",
    "mau tahu",
    "soal lengkap",
    "evaluasi tiap",
    "penjelasan rinci",
    "jelaskan semua",
    "boleh jelaskan",
)

_NEGATIVE_PHRASES = (
    "tidak perlu",
    "ga perlu",
    "gak perlu",
    "cukup saja",
    "sudah cukup",
)

_LIPI_DETAIL_PHRASES = (
    "soal yang salah",
    "soal mana yang salah",
    "soal mana saja yang salah",
    "soal mana saja",
    "jawaban yang salah",
    "jawaban salah",
    "yang salah di mana",
    "yang salah dimana",
    "soal keliru",
    "soal nomor",
    "item salah",
    "evaluasi soal",
    "penjelasan soal",
    "soal lengkap",
    "rincian soal",
    "detail soal",
    "kuis lipi",
    "tes lipi",
    "hasil lipi",
)


def _norm_reply(msg: str) -> str:
    t = (msg or "").strip().lower()
    t = re.sub(r"[^\w\s]", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def is_lipi_detail_request(message: str) -> bool:
    """Pertanyaan lanjutan tentang soal/jawaban Kuis LIPI (bukan asesmen video ML)."""
    t = _norm_reply(message)
    if not t:
        return False
    if _NEGATIVE_RE.match(t):
        return False
    return any(p in t for p in _LIPI_DETAIL_PHRASES)


def is_affirmative_reply(message: str) -> bool:
    t = _norm_reply(message)
    if not t:
        return False
    if _NEGATIVE_RE.match(t):
        return False
    if any(p in t for p in _NEGATIVE_PHRASES):
        return False
    if is_lipi_detail_request(message):
        return True
    if _AFFIRM_RE.match(t):
        return True
    if any(p in t for p in _AFFIRM_PHRASES):
        return True
    if len(t) <= 40 and t.startswith(("ya ", "iya ")):
        return True
    return False


def is_negative_reply(message: str) -> bool:
    t = _norm_reply(message)
    if not t:
        return False
    if is_lipi_detail_request(message):
        return False
    if _AFFIRM_RE.match(t) or any(p in t for p in _AFFIRM_PHRASES):
        return False
    if _NEGATIVE_RE.match(t):
        return True
    return any(p in t for p in _NEGATIVE_PHRASES)


async def register_lipi_wa_detail_offer(
    db: AsyncIOMotorDatabase,
    *,
    phone: str,
    username: str,
    session_id: str,
) -> None:
    p = canonical_wa_phone(phone)
    if not p:
        return
    await db[_COLLECTION].update_one(
        {"phone": p},
        {
            "$set": {
                "phone": p,
                "username": username,
                "session_id": session_id,
                "created_at": datetime.now(timezone.utc),
            }
        },
        upsert=True,
    )


async def clear_lipi_wa_detail_offer(db: AsyncIOMotorDatabase, phone: str) -> None:
    p = canonical_wa_phone(phone)
    if p:
        await db[_COLLECTION].delete_one({"phone": p})


def _sub_id_to_question_number() -> dict[str, int]:
    from app.routers.lipi_quiz import LIPI_QUESTIONS

    out: dict[str, int] = {}
    for q in LIPI_QUESTIONS:
        num = int(q.get("number") or 0)
        qid = str(q.get("id") or "")
        if qid:
            out[qid] = num
        for si in q.get("sub_items") or []:
            sid = str(si.get("id") or "")
            if sid:
                out[sid] = num
    return out


def build_lipi_wrong_summary(session_doc: dict[str, Any]) -> str:
    """Ringkasan singkat soal LIPI yang belum sesuai - untuk pertanyaan «soal yang salah»."""
    from app.routers.lipi_quiz import LIPI_QUESTIONS

    sub_map = _sub_id_to_question_number()
    answers = session_doc.get("answers") or {}
    if not isinstance(answers, dict):
        answers = {}

    wrong_lines: list[str] = []
    seen_q: set[int] = set()

    for item in session_doc.get("wrong_items") or []:
        if not isinstance(item, dict):
            continue
        sub_id = str(item.get("sub_id") or "")
        qnum = sub_map.get(sub_id, 0)
        if qnum and qnum not in seen_q:
            seen_q.add(qnum)
        sub_text = str(item.get("sub_text") or "").strip()
        ya = item.get("your_answer_text") or _ANSWER_LABELS.get(
            str(item.get("your_answer") or ""), item.get("your_answer", "")
        )
        ca = item.get("correct_answer_text") or _ANSWER_LABELS.get(
            str(item.get("correct_answer") or ""), item.get("correct_answer", "")
        )
        sec = _SECTION_LABELS.get(str(item.get("section") or ""), "")
        prefix = f"Soal {qnum}" if qnum else "Item"
        if sec:
            prefix += f" [{sec}]"
        wrong_lines.append(f"• {prefix}: {sub_text}\n  Jawaban Anda: {ya} · seharusnya: {ca}")

    lines = [
        "📋 Kuesioner Gempa - jawaban pengetahuan yang perlu diperbaiki:",
        (
            f"Pengetahuan: {session_doc.get('pengetahuan_score', session_doc.get('total_score', 0))}% "
            f"· Kategori: {session_doc.get('level', '-')}"
        ),
        "",
    ]
    if wrong_lines:
        lines.extend(wrong_lines)
        lines.append("")
        lines.append(
            "Balas *ya* jika ingin evaluasi lengkap tiap soal, atau tanyakan soal nomor tertentu."
        )
    else:
        lines.append("Semua jawaban pengetahuan benar.")
        lines.append("Balas *ya* untuk evaluasi lengkap semua soal.")

    return "\n".join(lines).strip()


def build_lipi_detailed_evaluation(session_doc: dict[str, Any]) -> list[str]:
    from app.lipi_attempt import ATTEMPT_PRE
    from app.routers.lipi_quiz import LIPI_QUESTIONS, _uses_likert_5

    attempt_type = str(session_doc.get("attempt_type") or ATTEMPT_PRE)
    answers = session_doc.get("answers") or {}
    if not isinstance(answers, dict):
        answers = {}

    pg_score = session_doc.get("pengetahuan_score", session_doc.get("total_score", 0))
    lines: list[str] = [
        "📖 Evaluasi Lengkap Kuesioner Gempa",
        f"Pengetahuan: {pg_score}% · Kategori: {session_doc.get('level', '-')}",
        "",
    ]

    for q in LIPI_QUESTIONS:
        sec = _SECTION_LABELS.get(q["section"], q["section"].upper())
        qid = str(q.get("id") or "")
        qtype = q.get("type", "")
        lines.append(f"── Soal {q['number']} [{sec}] ──")
        lines.append(str(q.get("text") or ""))
        note = str(q.get("note") or "").strip()
        if note:
            lines.append(f"ℹ️ {note}")

        ans = str(answers.get(qid) or "-")
        ans_label = _ANSWER_LABELS.get(ans, ans if ans != "-" else "Belum dijawab")
        lines.append(f"  Jawaban Anda: {ans_label}")

        if qtype == "mcq":
            correct = q.get("correct")
            choice_map = {c["id"]: c["text"] for c in q.get("choices", [])}
            if correct:
                key_label = choice_map.get(str(correct), str(correct))
                if ans == correct:
                    lines.append(f"  ✓ Benar - kunci: {key_label}")
                else:
                    your = choice_map.get(ans, ans)
                    lines.append(f"  ✗ Belum sesuai - Anda: {your} · kunci: {key_label}")
        elif qtype in ("likert_4", "likert_5") or _uses_likert_5(q["section"], attempt_type):
            if q["section"] == "ed" and session_doc.get("ed_scored"):
                lines.append(
                    f"  Skor bagian (GSES): {session_doc.get('efikasi_diri_score', '-')}/40 "
                    f"- {session_doc.get('efikasi_diri_level', '-')}"
                )
            elif q["section"] == "sk" and session_doc.get("sk_scored"):
                lines.append(
                    f"  Skor bagian (sikap): {session_doc.get('sikap_score', '-')}% "
                    f"- {session_doc.get('sikap_level', '-')}"
                )
            elif q["section"] == "td":
                if session_doc.get("td_scored") or session_doc.get("tindakan_score") is not None:
                    lines.append(
                        f"  Skor bagian (tindakan): {session_doc.get('tindakan_score', '-')}% "
                        f"- {session_doc.get('tindakan_level', '-')}"
                    )
                else:
                    lines.append("  (Bagian tindakan - skor belum tersimpan)")

        lines.append("")

    rec = str(session_doc.get("ai_recommendation") or "").strip()
    if rec:
        lines.append("── Rekomendasi ──")
        lines.append(rec[:900])

    return split_fonnte_message("\n".join(lines).strip(), limit=3400)


async def _load_lipi_session(
    db: AsyncIOMotorDatabase,
    *,
    session_id: str,
    username: str,
) -> dict[str, Any] | None:
    try:
        return await db.lipi_quiz_sessions.find_one(
            {"_id": ObjectId(session_id), "username": username}
        )
    except Exception:
        return None


async def _latest_lipi_session_for_phone(
    db: AsyncIOMotorDatabase,
    phone: str,
) -> tuple[str, dict[str, Any]] | None:
    p = canonical_wa_phone(phone)
    if not p:
        return None
    user = await resolve_staff_user_for_wa_phone(db, p)
    if not user:
        return None
    username = str(user.get("username") or "").strip()
    if not username:
        return None
    since = datetime.now(timezone.utc) - timedelta(hours=_LIPI_SESSION_LOOKBACK_HOURS)
    doc = await db.lipi_quiz_sessions.find_one(
        {"username": username, "submitted_at": {"$gte": since}},
        sort=[("submitted_at", -1)],
    )
    if not doc:
        doc = await db.lipi_quiz_sessions.find_one(
            {"username": username},
            sort=[("submitted_at", -1)],
        )
    if not doc:
        return None
    return username, doc


async def _send_lipi_wa_parts(
    db: AsyncIOMotorDatabase,
    *,
    phone: str,
    username: str,
    parts: list[str],
    inbox_id: int | None,
    history_label: str,
    send_target: str | None = None,
) -> None:
    full = "\n\n".join(parts)
    dest = send_target if send_target else phone
    for i, part in enumerate(parts):
        ok, det = await wa_send_text(dest, part, inboxid=inbox_id if i == 0 else None)
        if not ok:
            log.warning("lipi wa send part %s gagal: %s", i, det)
    try:
        await append_wa_context_turn(
            db,
            phone=phone,
            username=username,
            context_label=history_label,
            assistant_text=full[:1700],
        )
    except Exception as exc:
        log.warning("lipi wa history append gagal: %s", exc)


async def send_lipi_evaluation_wa(
    db: AsyncIOMotorDatabase,
    *,
    phone: str,
    username: str,
    session_doc: dict[str, Any],
    inbox_id: int | None,
    summary_only: bool = False,
    send_target: str | None = None,
) -> None:
    dest = send_target if send_target else phone
    if summary_only:
        text = build_lipi_wrong_summary(session_doc)
        parts = split_fonnte_message(text, limit=3400)
        label = "Pertanyaan lanjutan Kuis LIPI"
    else:
        parts = build_lipi_detailed_evaluation(session_doc)
        label = "Evaluasi lengkap Kuis LIPI"
    await _send_lipi_wa_parts(
        db,
        phone=phone,
        username=username,
        parts=parts,
        inbox_id=inbox_id,
        history_label=label,
        send_target=dest,
    )


async def try_handle_lipi_wa_detail_reply(
    db: AsyncIOMotorDatabase,
    *,
    phone: str,
    message: str,
    inbox_id: int | None,
    send_target: str | None = None,
) -> bool:
    """Tangani balasan ya/tidak atau pertanyaan lanjutan Kuis LIPI. True = sudah ditangani."""
    p = canonical_wa_phone(phone)
    if not p:
        return False
    dest = send_target if send_target else p

    msg = (message or "").strip()
    if not msg:
        return False

    offer = await db[_COLLECTION].find_one({"phone": p})
    detail_q = is_lipi_detail_request(msg)

    if offer:
        if is_affirmative_reply(msg):
            session_id = str(offer.get("session_id") or "")
            username = str(offer.get("username") or "")
            doc = await _load_lipi_session(db, session_id=session_id, username=username)
            await clear_lipi_wa_detail_offer(db, p)

            if not doc:
                await wa_send_text(
                    dest,
                    "Maaf, data hasil kuis tidak ditemukan lagi. Silakan kirim ulang laporan dari halaman Kuis LIPI.",
                    inboxid=inbox_id,
                )
                return True

            if detail_q and not _AFFIRM_RE.match(_norm_reply(msg)):
                await send_lipi_evaluation_wa(
                    db,
                    phone=p,
                    username=username,
                    session_doc=doc,
                    inbox_id=inbox_id,
                    summary_only=True,
                    send_target=dest,
                )
            else:
                await send_lipi_evaluation_wa(
                    db,
                    phone=p,
                    username=username,
                    session_doc=doc,
                    inbox_id=inbox_id,
                    summary_only=False,
                    send_target=dest,
                )
            return True

        if is_negative_reply(msg):
            await clear_lipi_wa_detail_offer(db, p)
            await wa_send_text(
                dest,
                "Baik, ringkasan di atas sudah cukup. Jika ada pertanyaan lain tentang kesiapsiagaan, silakan chat di sini.",
                inboxid=inbox_id,
            )
            return True

        if detail_q:
            session_id = str(offer.get("session_id") or "")
            username = str(offer.get("username") or "")
            doc = await _load_lipi_session(db, session_id=session_id, username=username)
            if doc:
                await send_lipi_evaluation_wa(
                    db,
                    phone=p,
                    username=username,
                    session_doc=doc,
                    inbox_id=inbox_id,
                    summary_only=True,
                    send_target=dest,
                )
                return True

        await wa_send_text(
            dest,
            "Balas *ya* jika ingin penjelasan lengkap per soal, atau *tidak* jika cukup dengan ringkasan.",
            inboxid=inbox_id,
        )
        return True

    if detail_q:
        resolved = await _latest_lipi_session_for_phone(db, p)
        if resolved:
            username, doc = resolved
            await send_lipi_evaluation_wa(
                db,
                phone=p,
                username=username,
                session_doc=doc,
                inbox_id=inbox_id,
                summary_only=True,
                send_target=dest,
            )
            return True

    return False
