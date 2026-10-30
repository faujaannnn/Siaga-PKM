"""
Migrasi: recalculate skor latihan triase setelah fix jawaban soal ID 2 dan 9.

Sebelum fix:
  soal 2 → jawaban "merah" (salah, seharusnya "hijau")
  soal 9 → jawaban "kuning" (salah, seharusnya "merah")

Sesudah fix:
  soal 2 → jawaban "hijau"
  soal 9 → jawaban "merah"

Strategi: re-simulate seluruh urutan jawaban tiap sesi, hitung ulang
skor dari awal dengan kunci jawaban yang BENAR. Ini menghasilkan skor
yang adil karena streak dihitung ulang secara utuh.
"""

import asyncio
import sys
sys.path.insert(0, ".")

from app.db import connect_db, get_db
from app.triage_cases import _CASE_BY_ID, TIME_LIMIT_SEC
from app.triage_cases import score_answer


def recalc_session(answers_ordered: list[dict], case_order: list[int]) -> dict:
    """
    Re-simulate scoring dari awal untuk satu sesi.
    Returns dict dengan keys: score, correct_count, best_streak.
    """
    score = 0
    streak = 0
    best_streak = 0
    correct_count = 0

    for idx, answer_row in enumerate(answers_ordered):
        case_id = answer_row.get("case_id")
        your = str(answer_row.get("your_answer") or "")

        # case_id harus ada di case_order di posisi idx
        if idx >= len(case_order) or case_order[idx] != case_id:
            # ordering tidak cocok, skip (tidak mungkin dalam data normal)
            continue

        case = _CASE_BY_ID.get(case_id)
        if not case:
            continue

        correct_answer = case["answer"]
        is_correct = (your == correct_answer) and your != ""

        if is_correct:
            streak += 1
            correct_count += 1
        else:
            streak = 0

        best_streak = max(best_streak, streak)

        # elapsed_ms dari row asli, atau default 30 detik
        elapsed_ms = answer_row.get("elapsed_ms") or 30_000
        breakdown = score_answer(
            correct=is_correct,
            elapsed_ms=elapsed_ms,
            streak_after=streak,
        )
        score += breakdown["total"]

    return {
        "score": score,
        "correct_count": correct_count,
        "best_streak": best_streak,
    }


async def main():
    await connect_db()
    db = get_db()

    sessions = await db.triage_game_sessions.find(
        {"status": "completed"}
    ).to_list(10_000)

    print(f"Sesi selesai ditemukan: {len(sessions)}")

    updated = 0
    skipped = 0
    total_delta_score = 0

    for doc in sessions:
        answers = doc.get("answers", [])
        case_order = doc.get("case_order", [])

        if not answers or not case_order:
            skipped += 1
            continue

        # Urutkan answers berdasarkan index (field 'index' di tiap row)
        answers_sorted = sorted(answers, key=lambda x: x.get("index", 0))

        recalc = recalc_session(answers_sorted, case_order)
        old_score = doc.get("score", 0)
        new_score = recalc["score"]
        delta = new_score - old_score
        total_delta_score += delta

        if delta != 0:
            await db.triage_game_sessions.update_one(
                {"_id": doc["_id"]},
                {"$set": {
                    "score": new_score,
                    "correct_count": recalc["correct_count"],
                    "best_streak": recalc["best_streak"],
                    "_migrated_triase_score": True,
                }}
            )
            updated += 1
            print(
                f"  UPDATED {doc['username']} | old={old_score} → new={new_score} "
                f"(Δ={delta:+d}) | correct={recalc['correct_count']}/25"
            )

    print(f"\nSelesai.")
    print(f"  Sesi diproses : {len(sessions)}")
    print(f"  Di-skip       : {skipped}")
    print(f"  Diperbarui    : {updated}")
    print(f"  Total delta skor: {total_delta_score:+d}")


if __name__ == "__main__":
    asyncio.run(main())
