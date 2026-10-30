"""
Penjelasan AI untuk jawaban asesmen - Video ML (PG) dan latihan triase START.
"""

import logging
from typing import Any

from app.deepseek import deepseek_json

log = logging.getLogger(__name__)

_START_PROTOCOL = """
Protokol START Triage (urutan penilaian):
1. AMAN - bisa berjalan sendiri → HIJAU (Minor)
2. NAPAS - respirasi >30/menit → MERAH (Immediate)
3. PERFUSI - nadi tidak teraba ATAU CRT >2 detik → HITAM (Expectant); selain itu lanjut
4. MENTAL - tidak mengikuti perintah → MERAH; mengikuti perintah → KUNING (Delayed)

Kategori: MERAH=Immediate, KUNING=Delayed, HIJAU=Minor, HITAM=Expectant.
"""


def _clip(text: str, limit: int) -> str:
    t = (text or "").strip()
    if len(t) <= limit:
        return t
    return t[: limit - 1] + "…"


async def explain_mcq_answers_batch(
    *,
    video_title: str,
    script: str,
    explanation: str,
    rows: list[dict[str, Any]],
) -> dict[str, dict[str, str]]:
    """Hasil per question_id: rationale, expected_answer_summary, feedback_educatif."""
    if not rows:
        return {}

    lines: list[str] = []
    for r in rows:
        qid = str(r.get("question_id", ""))
        qtext = _clip(str(r.get("question", "")), 400)
        choices = r.get("choices") or []
        ci = r.get("correct_index")
        ai = r.get("answer_choice")
        correct_txt = str(choices[ci]) if isinstance(ci, int) and 0 <= ci < len(choices) else "?"
        user_txt = str(choices[ai]) if isinstance(ai, int) and 0 <= ai < len(choices) else "(tidak dijawab)"
        ok = isinstance(ci, int) and isinstance(ai, int) and ci == ai
        lines.append(
            f"[{qid}] Benar={ok}\n"
            f"Soal: {qtext}\n"
            f"Opsi: A={choices[0] if len(choices)>0 else '?'} | B={choices[1] if len(choices)>1 else '?'} | "
            f"C={choices[2] if len(choices)>2 else '?'} | D={choices[3] if len(choices)>3 else '?'}\n"
            f"Kunci: {correct_txt}\n"
            f"Jawaban peserta: {user_txt}"
        )

    system = (
        "Anda tutor kesiapsiagaan kesehatan untuk staf puskesmas, bahasa Indonesia jelas dan hangat. "
        "Untuk SETIAP soal pilihan ganda, jelaskan MENGAPA jawaban benar itu benar menurut materi video, "
        "bukan hanya 'sesuai kunci'. Jika peserta salah, jelaskan kesalahan konsepnya dan arahkan ke jawaban benar. "
        "Gunakan naskah & catatan admin sebagai rujukan. Hindari kalimat generik seperti 'bandingkan dengan materi'. "
        'Jawab JSON: {"items":[{"question_id":"q1","rationale":"2-4 kalimat kenapa dinilai begitu",'
        '"expected_answer_summary":"1 kalimat inti jawaban benar",'
        '"feedback_educatif":"1-2 kalimat tips belajar konkret"}]}'
    )
    user_msg = (
        f"Video: {video_title or 'materi edukasi'}\n\n"
        f"NASKAH:\n{_clip(script, 3500)}\n\n"
        f"CATATAN ADMIN:\n{_clip(explanation, 1200)}\n\n"
        f"SOAL & JAWABAN:\n" + "\n\n".join(lines)
    )

    try:
        data = await deepseek_json(system, user_msg, temperature=0.35, max_tokens=1200, read_timeout=60.0)
        out: dict[str, dict[str, str]] = {}
        for item in data.get("items") or []:
            if not isinstance(item, dict):
                continue
            qid = str(item.get("question_id", "")).strip()
            if not qid:
                continue
            out[qid] = {
                "rationale": str(item.get("rationale", "")).strip(),
                "expected_answer_summary": str(item.get("expected_answer_summary", "")).strip(),
                "feedback_educatif": str(item.get("feedback_educatif", "")).strip(),
            }
        return out
    except Exception as exc:
        log.warning("explain_mcq_answers_batch gagal: %s", exc)
        return {}


async def explain_triage_answers_batch(rows: list[dict[str, Any]]) -> list[dict[str, str]]:
    """Penjelasan per kasus triase START."""
    if not rows:
        return []

    lines: list[str] = []
    for r in rows:
        cid = r.get("case_id")
        ok = bool(r.get("correct"))
        lines.append(
            f"[kasus_{cid}] Benar={ok}\n"
            f"Skenario:\n{_clip(str(r.get('case_text', '')), 500)}\n"
            f"Jawaban peserta: {str(r.get('your_answer_label', r.get('your_answer', ''))).upper()}\n"
            f"Kategori benar: {str(r.get('correct_answer_label', r.get('correct_answer', ''))).upper()}"
        )

    system = (
        "Anda instruktur triase START untuk staf puskesmas. Bahasa Indonesia, jelas, edukatif. "
        f"{_START_PROTOCOL}\n"
        "Untuk setiap kasus, jelaskan langkah START yang menentukan kategori jawaban benar. "
        "Jika peserta salah, jelaskan di langkah mana penilaiannya menyimpang. "
        'Jawab JSON: {"items":[{"case_id":1,"rationale":"3-5 kalimat alur START",'
        '"protocol_steps":"langkah kunci singkat mis. Napas normal → perfusi → mental",'
        '"feedback_educatif":"1-2 kalimat tips praktis"}]}'
    )
    user_msg = "KASUS:\n\n" + "\n\n".join(lines)

    try:
        data = await deepseek_json(system, user_msg, temperature=0.3, max_tokens=1400, read_timeout=65.0)
        out: list[dict[str, str]] = []
        for item in data.get("items") or []:
            if not isinstance(item, dict):
                continue
            try:
                cid = int(item.get("case_id"))
            except (TypeError, ValueError):
                continue
            out.append(
                {
                    "case_id": str(cid),
                    "rationale": str(item.get("rationale", "")).strip(),
                    "protocol_steps": str(item.get("protocol_steps", "")).strip(),
                    "feedback_educatif": str(item.get("feedback_educatif", "")).strip(),
                }
            )
        return out
    except Exception as exc:
        log.warning("explain_triage_answers_batch gagal: %s", exc)
        return []
