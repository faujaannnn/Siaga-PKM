"""
Migrasi: Perbaiki skor pg5 setelah koreksi jawaban kunci.
pg5: jawaban benar berubah dari "b" → "a" (1x setahun).
Peserta yang menjawab "a" sebelumnya salah → sekarang benar (+1 skor).
Peserta yang menjawab "b" sebelumnya benar → sekarang salah (-1 skor).
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db import close_db, connect_db, get_db
from app.routers.lipi_quiz import calculate_lipi_score, _QUESTION_MAP, _pct_baik_cukup_kurang

_PG5_QID = "pg5"
_PG5_CHOICES = {
    "a": "Satu kali dalam satu tahun",
    "b": "Dua kali dalam satu tahun",
    "c": "Tiga kali dalam satu tahun",
    "d": "Hanya dilakukan jika terjadi bencana",
}
_PG5_OLD_CORRECT = "b"
_PG5_NEW_CORRECT = "a"


def _build_wrong_item(qid: str, answer: str, correct: str) -> dict:
    q = _QUESTION_MAP.get(qid, {})
    choice_map = {c["id"]: c["text"] for c in q.get("choices", [])}
    return {
        "sub_id": qid,
        "question": q.get("text", ""),
        "sub_text": q.get("text", ""),
        "section": "pg",
        "your_answer": answer,
        "correct_answer": correct,
        "your_answer_text": choice_map.get(answer, answer),
        "correct_answer_text": choice_map.get(correct, correct),
    }


def _recalc_pg_fields(answers: dict, attempt_type: str) -> tuple[float, float, str, list]:
    """Return (pg_earned, pg_pct, pg_level, wrong_items)."""
    pg_earned = 0.0
    wrong_items = []
    from app.routers.lipi_quiz import LIPI_QUESTIONS
    for q in LIPI_QUESTIONS:
        if q["section"] != "pg":
            continue
        qid = q["id"]
        answer = answers.get(qid, "")
        correct = q["correct"]
        choice_map = {c["id"]: c["text"] for c in q.get("choices", [])}
        if answer == correct:
            pg_earned += 1.0
        else:
            wrong_items.append({
                "sub_id": qid,
                "question": q["text"],
                "sub_text": q["text"],
                "section": "pg",
                "your_answer": answer,
                "correct_answer": correct,
                "your_answer_text": choice_map.get(answer, answer),
                "correct_answer_text": choice_map.get(correct, correct),
            })
    from app.routers.lipi_quiz import _PENGETAHUAN_MAX
    pg_pct = round((pg_earned / _PENGETAHUAN_MAX) * 100, 1) if _PENGETAHUAN_MAX > 0 else 0.0
    pg_level, _ = _pct_baik_cukup_kurang(pg_pct)
    return pg_earned, pg_pct, pg_level, wrong_items


def _sections_to_review(pg_pct: float, pg_level: str) -> list:
    """Minimal sections_to_review recalc untuk pg saja."""
    sections = []
    if pg_pct < 76:
        sections.append({
            "category": "pg",
            "label": "Pengetahuan Kesiapsiagaan Gempa",
            "score": pg_pct,
            "score_unit": "pct",
        })
    return sections


async def run():
    await connect_db()
    db = get_db()
    cursor = db.lipi_quiz_sessions.find({})
    updated_count = 0
    upgraded_count = 0   # answered "a" → now correct
    downgraded_count = 0  # answered "b" → now wrong

    async for doc in cursor:
        answers = doc.get("answers", {})
        if _PG5_QID not in answers:
            continue

        pg5_answer = answers[_PG5_QID]
        old_wrong_ids = [w.get("sub_id") for w in doc.get("wrong_items", [])]
        currently_wrong = _PG5_QID in old_wrong_ids

        needs_update = False
        if pg5_answer == _PG5_NEW_CORRECT and currently_wrong:
            # Was wrong (pg5 in wrong_items because "b" was correct); now correct
            needs_update = True
            upgraded_count += 1
        elif pg5_answer == _PG5_OLD_CORRECT and not currently_wrong:
            # Was correct (pg5 NOT in wrong_items because "b" was correct); now wrong
            needs_update = True
            downgraded_count += 1

        if not needs_update:
            continue

        # Recalculate
        attempt_type = str(doc.get("attempt_type", "pre"))
        pg_earned, pg_pct, pg_level, wrong_items = _recalc_pg_fields(answers, attempt_type)
        sections = _sections_to_review(pg_pct, pg_level)

        update = {
            "$set": {
                "pengetahuan_score": pg_pct,
                "pengetahuan_earned": pg_earned,
                "pengetahuan_level": pg_level,
                "total_score": pg_pct,
                "level": pg_level,
                "wrong_items": wrong_items,
                "sections_to_review": sections,
            }
        }

        result = await db.lipi_quiz_sessions.update_one(
            {"_id": doc["_id"]},
            update
        )
        updated_count += 1
        print(f"  [{doc.get('username', '?')}] pg5={pg5_answer} | old_score={doc.get('pengetahuan_score')} → {pg_pct} | {pg_level}")

    print(f"\nMigrasi selesai:")
    print(f"  Peserta upgraded (jawaban 'a' sekarang benar): {upgraded_count}")
    print(f"  Peserta downgraded (jawaban 'b' sekarang salah): {downgraded_count}")
    print(f"  Total dokumen di-update: {updated_count}")


if __name__ == "__main__":
    import asyncio
    asyncio.run(run())
