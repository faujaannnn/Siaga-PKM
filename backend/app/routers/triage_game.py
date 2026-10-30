"""Latihan triase START - game kasus acak dengan skor kecepatan & streak."""

import logging
import random
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.db import get_db
from app.deps import get_current_user
from app.triage_explanations import AI_REVIEW_VERSION, get_case_explanation
from app.triage_cases import (
    TRIAGE_CASES,
    TRIAGE_CATEGORIES,
    TIME_LIMIT_SEC,
    _CASE_BY_ID,
    case_public,
    normalize_answer,
    score_answer,
)

log = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public", tags=["triage-game"])

_PROTOCOL_STEPS = [
    "AMAN (bisa berjalan) → HIJAU jika ya",
    "NAPAS (>30/menit) → MERAH jika ya",
    "PERFUSI (nadi tidak teraba / CRT >2 dtk) → HITAM; selain itu lanjut",
    "MENTAL (tidak ikut perintah) → MERAH; ikut perintah → KUNING",
]


class TriageAnswerIn(BaseModel):
    session_id: str
    answer: str
    elapsed_ms: int = Field(ge=0, le=120_000)


def _case_order(shuffle: bool = True) -> list[int]:
    ids = [c["id"] for c in TRIAGE_CASES]
    if shuffle:
        random.shuffle(ids)
    return ids


def _session_case_at(doc: dict[str, Any], index: int) -> dict[str, Any] | None:
    order = doc.get("case_order") or []
    if index < 0 or index >= len(order):
        return None
    cid = order[index]
    case = _CASE_BY_ID.get(cid)
    if not case:
        return None
    return case_public(case, index)


@public_router.get("/triage-game/config")
async def get_triage_config():
    return {
        "time_limit_sec": TIME_LIMIT_SEC,
        "total_cases": len(TRIAGE_CASES),
        "categories": TRIAGE_CATEGORIES,
        "protocol_steps": _PROTOCOL_STEPS,
    }


@public_router.post("/triage-game/sessions")
async def start_triage_session(username: str = Depends(get_current_user)):
    db = get_db()
    order = _case_order(shuffle=True)
    doc = {
        "username": username,
        "started_at": datetime.now(timezone.utc),
        "case_order": order,
        "current_index": 0,
        "score": 0,
        "streak": 0,
        "best_streak": 0,
        "correct_count": 0,
        "answers": [],
        "status": "active",
    }
    result = await db.triage_game_sessions.insert_one(doc)
    session_id = str(result.inserted_id)
    first = _session_case_at(doc, 0)
    return {
        "session_id": session_id,
        "time_limit_sec": TIME_LIMIT_SEC,
        "total_cases": len(order),
        "categories": TRIAGE_CATEGORIES,
        "case": first,
    }


@public_router.post("/triage-game/answer")
async def submit_triage_answer(body: TriageAnswerIn, username: str = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(body.session_id.strip())
    except Exception as exc:
        raise HTTPException(status_code=400, detail="session_id tidak valid") from exc

    doc = await db.triage_game_sessions.find_one({"_id": oid, "username": username})
    if not doc:
        raise HTTPException(status_code=404, detail="Sesi latihan tidak ditemukan")
    if doc.get("status") != "active":
        raise HTTPException(status_code=400, detail="Sesi sudah selesai")

    idx = int(doc.get("current_index", 0))
    case = _session_case_at(doc, idx)
    if not case:
        raise HTTPException(status_code=400, detail="Tidak ada kasus aktif")

    answer = normalize_answer(body.answer)
    timed_out = answer == "timeout"
    valid = {c["id"] for c in TRIAGE_CATEGORIES}
    if timed_out:
        answer = ""
    elif answer not in valid:
        raise HTTPException(status_code=400, detail="Kategori tidak valid")

    case_data = _CASE_BY_ID[case["id"]]
    correct_answer = case_data["answer"]
    is_correct = (not timed_out) and answer == correct_answer

    streak = int(doc.get("streak", 0))
    if is_correct:
        streak += 1
    else:
        streak = 0

    best_streak = max(int(doc.get("best_streak", 0)), streak)
    breakdown = score_answer(
        correct=is_correct,
        elapsed_ms=body.elapsed_ms,
        streak_after=streak,
    )
    new_score = int(doc.get("score", 0)) + breakdown["total"]
    correct_count = int(doc.get("correct_count", 0)) + (1 if is_correct else 0)

    answer_row = {
        "case_id": case["id"],
        "index": idx,
        "your_answer": answer or ("timeout" if timed_out else ""),
        "correct_answer": correct_answer,
        "correct": is_correct,
        "elapsed_ms": body.elapsed_ms,
        "points": breakdown["total"],
        "breakdown": breakdown,
    }
    answers = list(doc.get("answers") or [])
    answers.append(answer_row)

    next_index = idx + 1
    total = len(doc.get("case_order") or [])
    finished = next_index >= total

    update: dict[str, Any] = {
        "current_index": next_index,
        "score": new_score,
        "streak": streak,
        "best_streak": best_streak,
        "correct_count": correct_count,
        "answers": answers,
    }
    if finished:
        update["status"] = "completed"
        update["completed_at"] = datetime.now(timezone.utc)

    await db.triage_game_sessions.update_one({"_id": oid}, {"$set": update})

    cat_map = {c["id"]: c for c in TRIAGE_CATEGORIES}
    next_case = None if finished else _session_case_at({**doc, "current_index": next_index}, next_index)

    return {
        "correct": is_correct,
        "correct_answer": correct_answer,
        "correct_label": cat_map.get(correct_answer, {}).get("label", correct_answer.upper()),
        "your_answer": answer or ("timeout" if timed_out else ""),
        "points_earned": breakdown["total"],
        "breakdown": breakdown,
        "streak": streak,
        "best_streak": best_streak,
        "total_score": new_score,
        "correct_count": correct_count,
        "answered": next_index,
        "total_cases": total,
        "finished": finished,
        "next_case": next_case,
    }


def _label_for_answer(cat_map: dict[str, dict], answer_id: str) -> str:
    if not answer_id or answer_id == "timeout":
        return "Waktu habis"
    return str(cat_map.get(answer_id, {}).get("label", answer_id.upper()))


def _build_triage_review_items(doc: dict[str, Any]) -> list[dict[str, Any]]:
    cat_map = {c["id"]: c for c in TRIAGE_CATEGORIES}
    items: list[dict[str, Any]] = []
    for row in doc.get("answers") or []:
        if not isinstance(row, dict):
            continue
        cid = row.get("case_id")
        case = _CASE_BY_ID.get(cid)
        if not case:
            continue
        your = str(row.get("your_answer", "") or "")
        correct = str(row.get("correct_answer", "") or "")
        items.append(
            {
                "case_id": int(cid),
                "case_text": str(case.get("text", "") or ""),
                "your_answer": your,
                "your_answer_label": _label_for_answer(cat_map, your),
                "correct_answer": correct,
                "correct_answer_label": _label_for_answer(cat_map, correct),
                "correct": bool(row.get("correct")),
                "rationale": "",
                "protocol_steps": "",
                "feedback_educatif": "",
            }
        )
    return items


@public_router.post("/triage-game/sessions/{session_id}/review")
async def generate_triage_review(session_id: str, username: str = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(session_id.strip())
    except Exception as exc:
        raise HTTPException(status_code=400, detail="session_id tidak valid") from exc

    doc = await db.triage_game_sessions.find_one({"_id": oid, "username": username})
    if not doc:
        raise HTTPException(status_code=404, detail="Sesi latihan tidak ditemukan")
    if doc.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Sesi belum selesai")

    cached = doc.get("ai_review")
    cached_ver = int(doc.get("ai_review_version") or 0)
    if isinstance(cached, list) and cached and cached_ver >= AI_REVIEW_VERSION:
        return {
            "items": cached,
            "recommendation": str(doc.get("ai_review_recommendation", "") or ""),
            "cached": True,
        }

    items = _build_triage_review_items(doc)
    if not items:
        raise HTTPException(status_code=400, detail="Tidak ada jawaban untuk ditinjau")

    for it in items:
        exp = get_case_explanation(
            it["case_id"],
            your_answer=it["your_answer"],
            correct_answer=it["correct_answer"],
            correct=it["correct"],
        )
        it["rationale"] = exp["rationale"]
        it["protocol_steps"] = exp["protocol_steps"]
        it["feedback_educatif"] = exp["feedback_educatif"]

    wrong = sum(1 for it in items if not it["correct"])
    if wrong == 0:
        recommendation = (
            "Semua kasus tepat - pertahankan kebiasaan menilai AMAN → NAPAS → PERFUSI → MENTAL "
            "sebelum memutuskan kategori."
        )
    elif wrong <= 3:
        recommendation = (
            f"{wrong} kasus perlu diulang. Baca penjelasan AI di bawah, fokus pada langkah START "
            "yang menentukan kategori jawaban benar."
        )
    else:
        recommendation = (
            f"Banyak kasus ({wrong}) belum tepat. Pelajari tiap penjelasan, lalu main lagi dengan "
            "protokol START di depan mata."
        )

    await db.triage_game_sessions.update_one(
        {"_id": oid},
        {
            "$set": {
                "ai_review": items,
                "ai_review_recommendation": recommendation,
                "ai_review_version": AI_REVIEW_VERSION,
            }
        },
    )
    return {"items": items, "recommendation": recommendation, "cached": False}


@public_router.get("/triage-game/my-best")
async def get_my_best_triage(username: str = Depends(get_current_user)):
    db = get_db()
    doc = await db.triage_game_sessions.find_one(
        {"username": username, "status": "completed"},
        sort=[("score", -1)],
    )
    if not doc:
        return {"best": None}
    total = len(doc.get("case_order") or [])
    return {
        "best": {
            "session_id": str(doc["_id"]),
            "score": doc.get("score", 0),
            "correct_count": doc.get("correct_count", 0),
            "total_cases": total,
            "best_streak": doc.get("best_streak", 0),
            "completed_at": doc.get("completed_at", "").isoformat()
            if doc.get("completed_at")
            else "",
        }
    }
