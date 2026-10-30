"""Materi PDF (Google Drive) + ujian pilihan ganda per bab (DeepSeek)."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Literal, cast

import httpx
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status

from app.config import settings
from app.db import get_db
from app.deepseek import deepseek_json
from app.deps import get_current_user, require_content_admin
from app.ml_assessment_scoring import build_assessment_from_scores, fallback_assessment_from_level
from siaga_common.assessment_prompts import (
    ML_PROMPT_ACAK_INDEKS_JAWABAN,
    ML_PROMPT_SOAL_TANPA_PEMBUKA_NASKAH,
    shuffle_mcq_row_choices,
    strip_mc_question_script_boilerplate,
)
from app.schemas import (
    MlAssessmentSummaryOut,
    MlMcqAnswerIn,
    MlMcqQuestionPublic,
    MlPdfChapterAdmin,
    MlPdfChapterPublic,
    MlPdfCreate,
    MlPdfEngagementPatchIn,
    MlPdfOut,
    MlPdfPublicOut,
    MlPdfQuizChapterStartIn,
    MlPdfQuizStepOut,
    MlPdfSessionLogRow,
    MlPdfSessionStartIn,
    MlPdfSessionStartOut,
    MlPdfUpdate,
    MlQuizCompletionOut,
    MlRemedialItemOut,
)
from app.routers.ml_learning import _lipi_result_to_summary_out, _lipi_to_stored
from siaga_common.google_drive_download import fetch_google_drive_pdf_bytes
from siaga_common.google_drive_id import parse_google_drive_file_id

log = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public", tags=["ml-pdf-learning"])
admin_router = APIRouter(prefix="/admin", tags=["admin-ml-pdf"])

_ML_CATS = frozenset({"asesmen_ai", "belajar_plus"})
PDF_MCQ_PER_CHAPTER = 4
_MAX_CH_CONTENT = 6000
_MAX_CH_EXPL = 2000


def _oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e


def _iso_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _ml_category(raw: object) -> str:
    s = str(raw or "asesmen_ai").strip()
    return s if s in _ML_CATS else "asesmen_ai"


def _ml_category_typed(doc: dict) -> Literal["asesmen_ai", "belajar_plus"]:
    c = _ml_category(doc.get("category"))
    return cast(Literal["asesmen_ai", "belajar_plus"], c)


def _normalize_belajar_topic_slug(s: str) -> str:
    t = (s or "").strip().lower()
    t = re.sub(r"[^a-z0-9_]+", "_", t)
    t = re.sub(r"_+", "_", t).strip("_")
    return t[:50]


def _clip_for_llm(text: str, max_ch: int) -> str:
    t = (text or "").strip()
    if len(t) <= max_ch:
        return t
    return t[: max_ch - 28] + "\n[…dipotong…]"


def _chapters_public(doc: dict) -> list[MlPdfChapterPublic]:
    out: list[MlPdfChapterPublic] = []
    for c in doc.get("chapters") or []:
        if not isinstance(c, dict):
            continue
        out.append(
            MlPdfChapterPublic(
                title=str(c.get("title", "") or "Bab"),
                page_start=int(c.get("page_start", 1)),
                page_end=int(c.get("page_end", 1)),
            )
        )
    return out


def _chapters_admin_out(doc: dict) -> list[MlPdfChapterAdmin]:
    out: list[MlPdfChapterAdmin] = []
    for c in doc.get("chapters") or []:
        if not isinstance(c, dict):
            continue
        out.append(
            MlPdfChapterAdmin(
                title=str(c.get("title", "") or ""),
                page_start=int(c.get("page_start", 1)),
                page_end=int(c.get("page_end", 1)),
                content=str(c.get("content", "") or ""),
                explanation=str(c.get("explanation", "") or ""),
            )
        )
    return out


def _pdf_public(doc: dict) -> MlPdfPublicOut:
    cat = _ml_category_typed(doc)
    bt = str(doc.get("belajar_topic") or "").strip() if cat == "belajar_plus" else ""
    return MlPdfPublicOut(
        id=str(doc["_id"]),
        title=doc.get("title", ""),
        description=doc.get("description", ""),
        drive_url=doc.get("drive_url", ""),
        sort_order=int(doc.get("sort_order", 0)),
        category=cat,
        belajar_topic=bt,
        chapters=_chapters_public(doc),
    )


def _pdf_out(doc: dict) -> MlPdfOut:
    cat = _ml_category_typed(doc)
    bt = str(doc.get("belajar_topic") or "").strip() if cat == "belajar_plus" else ""
    return MlPdfOut(
        id=str(doc["_id"]),
        title=doc.get("title", ""),
        description=doc.get("description", ""),
        drive_url=doc.get("drive_url", ""),
        sort_order=int(doc.get("sort_order", 0)),
        published=bool(doc.get("published", True)),
        category=cat,
        belajar_topic=bt,
        chapters=_chapters_admin_out(doc),
    )


def _validate_drive_file_url(raw: str) -> str:
    u = (raw or "").strip()
    fid = parse_google_drive_file_id(u)
    if not fid:
        raise HTTPException(
            status_code=400,
            detail="URL Google Drive tidak valid (wajib tautan berkas, bukan folder).",
        )
    return u


def _mcq_public_row(row: dict) -> MlMcqQuestionPublic:
    return MlMcqQuestionPublic(
        id=str(row.get("id", "")),
        question=str(row.get("question", "") or ""),
        choices=list(row.get("choices") or []),
        chapter_index=int(row.get("chapter_index", 0)),
    )


def _next_open_question(qraw: list) -> dict | None:
    for q in qraw:
        if not isinstance(q, dict):
            continue
        if q.get("answer_index") is None:
            return q
    return None


def _next_open_question_for_chapter(qraw: list, chapter_index: int) -> dict | None:
    for q in qraw:
        if not isinstance(q, dict):
            continue
        if int(q.get("chapter_index", -999)) != chapter_index:
            continue
        if q.get("answer_index") is None:
            return q
    return None


def _find_question_row(qraw: list, qid: str) -> tuple[int, dict] | None:
    for i, row in enumerate(qraw):
        if isinstance(row, dict) and str(row.get("id", "")) == qid:
            return i, row
    return None


def _prior_chapters_complete(qraw: list, chapter_index: int) -> bool:
    for pi in range(chapter_index):
        if not _chapter_fully_answered(qraw, pi):
            return False
    return True


def _fallback_pdf_mcq_row(
    *,
    ch_idx: int,
    q_idx: int,
    pdf_title: str,
    chapter_title: str,
    cat: str,
) -> dict:
    mod = (pdf_title or "modul buku").strip()[:120] or "modul buku"
    bab = (chapter_title or f"Bab {ch_idx + 1}").strip()[:120] or f"Bab {ch_idx + 1}"
    eid = f"c{ch_idx}q{q_idx}"
    if q_idx == 0:
        stem = f"Pilih pernyataan yang paling selaras dengan tujuan edukasi kesiapsiagaan pada «{bab}» ({mod})."
    elif q_idx == PDF_MCQ_PER_CHAPTER - 1:
        stem = (
            f"Pilih tindakan konkret yang paling realistis menerapkan poin utama «{bab}» "
            f"di tingkat rumah atau RT/RW."
        )
    else:
        stem = (
            f"Soal {q_idx + 1} dari {PDF_MCQ_PER_CHAPTER}: pilih pernyataan yang menghubungkan "
            f"materi «{bab}» ke perilaku nyata."
        )
    if cat == "belajar_plus":
        ch = [
            "Menyusun langkah sederhana: titik kumpul, jalur evakuasi, dan cek perlengkapan darurat.",
            "Menunda persiapan sampai ada pengumuman resmi tanpa cek kondisi lokal.",
            "Mengandalkan rumor media sosial sebagai satu-satunya sumber keputusan.",
            "Berperilaku seperti hari biasa tanpa rencana darurat keluarga.",
        ]
    else:
        ch = [
            "Menggunakan info modul untuk membuat rencana sederhana: jalur komunikasi, titik bertemu, dan cek perlengkapan ringan.",
            "Berpegang pada asumsi lama walau lokasi baru berbeda pola risiko.",
            "Menunggu sinyal media sosial saja sebagai dasar utama keputusan evakuasi.",
            "Berperilaku identik seperti hari biasa hingga ada kepanikan publik mendadak.",
        ]
    return shuffle_mcq_row_choices(
        {
            "id": eid,
            "chapter_index": ch_idx,
            "question": stem,
            "choices": ch,
            "correct_index": 0,
            "answer_index": None,
        }
    )


def _chapter_fully_answered(qraw: list, chapter_index: int) -> bool:
    rows = [q for q in qraw if isinstance(q, dict) and int(q.get("chapter_index", -1)) == chapter_index]
    if not rows:
        return False
    return all(q.get("answer_index") is not None for q in rows)


def _expected_total_mcq(pdoc: dict) -> int:
    n = len(pdoc.get("chapters") or [])
    return PDF_MCQ_PER_CHAPTER * max(1, n)


def _count_answered(qraw: list) -> int:
    n = 0
    for q in qraw:
        if not isinstance(q, dict):
            continue
        if q.get("answer_index") is not None:
            n += 1
    return n


def _mcq_remedial_items(qraw: list) -> list[MlRemedialItemOut]:
    letters = "ABCDEFGH"
    out: list[MlRemedialItemOut] = []
    for q in qraw:
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id", "") or "").strip()
        if not qid:
            continue
        qtext = str(q.get("question", "") or "")
        choices = q.get("choices") or []
        ai = q.get("answer_index")
        ci = q.get("correct_index")
        u = "(belum dijawab)"
        if isinstance(ai, int) and 0 <= ai < len(choices):
            ch = letters[ai] if ai < len(letters) else str(ai)
            u = f"Pilihan {ch}: {choices[ai]}"
        ok = isinstance(ci, int) and isinstance(ai, int) and ci == ai
        ex = ""
        if isinstance(ci, int) and 0 <= ci < len(choices):
            ch2 = letters[ci] if ci < len(letters) else str(ci)
            ex = f"Kunci {ch2}: {choices[ci]}"
        extra = " ✓" if ok else " ✗"
        out.append(
            MlRemedialItemOut(
                question_id=qid,
                question=qtext,
                user_answer=f"{u} · {ex}{extra}".strip(),
            )
        )
    return out


def _grading_items_for_mcq(qraw: list) -> list[dict]:
    out: list[dict] = []
    for q in qraw:
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id", "") or "")
        if not qid:
            continue
        ci = q.get("correct_index")
        ai = q.get("answer_index")
        ok = isinstance(ci, int) and isinstance(ai, int) and 0 <= ci <= 3 and 0 <= ai <= 3 and ci == ai
        p = 1.0 if ok else 0.0
        out.append(
            {
                "question_id": qid,
                "p_correct": p,
                "correctness_score": p,
                "bloom_level": 2.2,
                "rationale": "Penilaian otomatis pilihan ganda.",
                "feedback_educatif": "Jawaban benar." if ok else "Jawaban belum tepat; tinjau ulang bab terkait.",
                "expected_answer_summary": "",
            }
        )
    return out


async def _ml_pdf_ai_report_mcq(
    pdf_title: str,
    category: str,
    belajar_topic: str,
    qraw: list,
    pct_correct: float,
) -> tuple[str, str]:
    lines: list[str] = []
    for q in qraw:
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id", ""))
        qt = str(q.get("question", "") or "")
        choices = q.get("choices") or []
        ci = q.get("correct_index")
        ai = q.get("answer_index")
        ca = str(choices[ci]) if isinstance(ci, int) and 0 <= ci < len(choices) else "?"
        ua = str(choices[ai]) if isinstance(ai, int) and 0 <= ai < len(choices) else "?"
        ok = isinstance(ci, int) and isinstance(ai, int) and ci == ai
        lines.append(f"- [{qid}] {qt}\n  Dipilih: {ua}\n  Kunci: {ca} ({'benar' if ok else 'salah'})")
    system = (
        "Anda analis pendidikan kesehatan. Peserta baru menyelesaikan kuis pilihan ganda dari materi PDF. "
        "Bahasa Indonesia. Keluaran HANYA JSON: "
        '{"knowledge_level":"rendah|sedang|tinggi","report":"2–3 paragraf: apreasiasi, kelemahan, satu saran konkret"}'
    )
    user_msg = (
        f"Judul modul: {pdf_title}\nKategori: {category}\nTopik (opsional): {belajar_topic or '-'}\n"
        f"Perkiraan persen benar: {pct_correct:.0f}%\n\n" + "\n\n".join(lines)
    )
    try:
        data = await deepseek_json(
            system,
            user_msg,
            temperature=0.25,
            max_tokens=1400,
            read_timeout=95.0,
        )
        level = str(data.get("knowledge_level", "sedang") or "sedang").strip()
        report = str(data.get("report", "") or "").strip()
        if not report:
            report = f"Ringkasan: sekitar {pct_correct:.0f}% jawaban benar ({level})."
        return level, report
    except Exception as e:
        log.warning("PDF ML laporan AI gagal: %s", e)
        level = "sedang"
        if pct_correct >= 80:
            level = "tinggi"
        elif pct_correct < 50:
            level = "rendah"
        report = f"Hasil kuis pilihan ganda: {pct_correct:.0f}% benar. Tingkat perkiraan: {level}."
        return level, report


def _chapter_source_text(
    pdf_title: str,
    chapter: dict,
) -> tuple[str, str, str, int, int]:
    title = str(chapter.get("title", "") or f"Bab")
    content = _clip_for_llm(str(chapter.get("content", "")), _MAX_CH_CONTENT)
    expl = _clip_for_llm(str(chapter.get("explanation", "")), _MAX_CH_EXPL)
    ps = int(chapter.get("page_start", 1))
    pe = int(chapter.get("page_end", ps))
    if not content.strip() and not expl.strip():
        content = (
            f"Bab «{title}» dari modul «{pdf_title}» (halaman {ps}–{pe}). "
            "Ringkasan isi belum diisi admin; gunakan kerangka umum kesiapsiagaan masyarakat."
        )
    return title, content, expl, ps, pe


async def _gen_mcq_for_chapter(
    pdf_title: str,
    chapter: dict,
    cat: str,
    ch_idx: int,
    n: int,
) -> list[dict]:
    title, content, expl, ps, pe = _chapter_source_text(pdf_title, chapter)
    system = (
        f"Buat tepat {n} soal pilihan ganda (pendidikan kesehatan / kesiapsiagaan), bahasa Indonesia. "
        f"{ML_PROMPT_SOAL_TANPA_PEMBUKA_NASKAH} "
        f"{ML_PROMPT_ACAK_INDEKS_JAWABAN} "
        "Setiap soal: tepat 4 pilihan, satu jawaban benar, distraktor masuk akal. "
        "Fokus ingatan & pemahaman dari naskah. "
        'Hanya JSON: {"items":[{"question":"stem","choices":["op1","op2","op3","op4"],"correct_index":N}, …]} '
        "Per item N ∈ {0,1,2,3}; jangan pola semua jawaban benar sebagai elemen pertama. "
        "Tanpa markdown."
    )
    user_msg = (
        f"Judul dokumen: {pdf_title}\nBab: {title} (halaman {ps}–{pe})\nKategori modul: {cat}\n\n"
        f"NASKAH / RINGKASAN:\n{content or '-'}\n\nCATATAN:\n{expl or '-'}\n"
    )
    items: list | None = None
    try:
        data = await deepseek_json(system, user_msg, temperature=0.28, max_tokens=2600, read_timeout=90.0)
        raw_items = data.get("items") if isinstance(data.get("items"), list) else data.get("questions")
        if isinstance(raw_items, list):
            items = raw_items
    except Exception as e:
        log.warning("Gagal membuat soal PG bab %s: %s", ch_idx, e)

    rows: list[dict] = []
    for i in range(n):
        raw = items[i] if isinstance(items, list) and i < len(items) else None
        parsed: dict | None = None
        if isinstance(raw, dict):
            qt = strip_mc_question_script_boilerplate(str(raw.get("question", "") or "").strip())
            choices = raw.get("choices") if isinstance(raw.get("choices"), list) else raw.get("options")
            if qt and isinstance(choices, list) and len(choices) >= 4:
                ch4 = [str(x).strip() for x in choices[:4]]
                if not any(len(x) < 1 for x in ch4):
                    try:
                        ci = int(raw.get("correct_index", raw.get("answer", 0)))
                    except (TypeError, ValueError):
                        ci = 0
                    ci = max(0, min(3, ci))
                    parsed = shuffle_mcq_row_choices(
                        {
                            "id": f"c{ch_idx}q{i}",
                            "chapter_index": ch_idx,
                            "question": qt,
                            "choices": ch4,
                            "correct_index": ci,
                            "answer_index": None,
                        }
                    )
        if parsed is None:
            log.info("PDF ML: fallback MCQ c%s q%s", ch_idx, i)
            parsed = _fallback_pdf_mcq_row(
                ch_idx=ch_idx,
                q_idx=i,
                pdf_title=pdf_title,
                chapter_title=title,
                cat=cat,
            )
        rows.append(parsed)
    return rows


async def _finalize_pdf_session(db, sid: ObjectId, sdoc: dict, pdoc: dict) -> MlPdfQuizStepOut:
    qraw = list(sdoc.get("questions") or [])
    scored_raw = _grading_items_for_mcq(qraw)
    n_ok = sum(1 for row in scored_raw if float(row.get("p_correct") or 0) >= 0.99)
    n_tot = max(len(scored_raw), 1)
    pct = 100.0 * n_ok / n_tot
    title = str(pdoc.get("title", "") or "")
    vcat = _ml_category_typed(pdoc)
    raw_bt = str(pdoc.get("belajar_topic") or "").strip()
    belajar_topic = _normalize_belajar_topic_slug(raw_bt) if raw_bt else ""
    level, report = await _ml_pdf_ai_report_mcq(title, vcat, belajar_topic, qraw, pct)
    try:
        lipi = build_assessment_from_scores(
            scored=scored_raw,
            video_category=vcat,
            belajar_topic=belajar_topic,
            knowledge_level=level,
        )
    except (TypeError, ValueError) as e:
        log.warning("build_assessment PDF MCQ: %s", e)
        lipi = fallback_assessment_from_level(level, n_tot, vcat, belajar_topic)
    as_out = _lipi_result_to_summary_out(lipi)
    stored = _lipi_to_stored(lipi)
    remedial_items = _mcq_remedial_items(qraw)
    sec = float(sdoc.get("seconds_pdf") or 0)
    await db.ml_pdf_learning_sessions.update_one(
        {"_id": sid},
        {
            "$set": {
                "questions": qraw,
                "knowledge_level": level,
                "report": report,
                "assessment_summary": stored,
                "remedial_items": [r.model_dump() for r in remedial_items],
                "status": "done",
                "updated_at": _iso_utc(),
            }
        },
    )
    total = _expected_total_mcq(pdoc)
    return MlPdfQuizStepOut(
        question=None,
        done=True,
        current_step=total,
        total_steps=total,
        chapter_quiz_done=False,
        next_chapter_index=None,
        report=report,
        knowledge_level=level,
        seconds_pdf=sec,
        assessment=as_out,
        remedial_items=remedial_items,
    )


# --- Public ---


@public_router.get("/ml-pdfs", response_model=list[MlPdfPublicOut])
async def list_ml_pdfs_public(
    category: str | None = Query(None, description="asesmen_ai | belajar_plus"),
    topik: str | None = Query(None, description="Slug topik untuk belajar_plus"),
    _user: str = Depends(get_current_user),
):
    _ = _user
    db = get_db()
    flt: dict = {"published": True}
    if topik and (t := _normalize_belajar_topic_slug(str(topik))):
        flt["category"] = "belajar_plus"
        flt["belajar_topic"] = t
    elif category and (c := str(category).strip()) and c in _ML_CATS:
        flt["category"] = c
    cur = db.ml_pdfs.find(flt).sort("sort_order", 1)
    docs = await cur.to_list(200)
    out: list[MlPdfPublicOut] = []
    for d in docs:
        if not d.get("chapters"):
            continue
        fid = parse_google_drive_file_id(str(d.get("drive_url", "")))
        if not fid:
            continue
        out.append(_pdf_public(d))
    return out


@public_router.get("/ml-pdfs/{pdf_id}/raw.pdf")
async def download_ml_pdf_raw(pdf_id: str, _user: str = Depends(get_current_user)):
    """Proxy PDF untuk pembaca in-app (PDF.js); hanya PDF diterbitkan. Memerlukan berkas Drive dapat diunduh publik."""
    _ = _user
    oid = _oid(pdf_id)
    db = get_db()
    pdoc = await db.ml_pdfs.find_one({"_id": oid, "published": True})
    if not pdoc or not pdoc.get("chapters"):
        raise HTTPException(status_code=404, detail="PDF tidak ditemukan")
    stored_fid = str(pdoc.get("drive_file_id") or "").strip()
    fid = (
        stored_fid
        if stored_fid and re.match(r"^[a-zA-Z0-9_-]+$", stored_fid)
        else parse_google_drive_file_id(str(pdoc.get("drive_url", "")))
    )
    if not fid:
        raise HTTPException(status_code=400, detail="URL Drive tidak valid")
    try:
        data = await fetch_google_drive_pdf_bytes(
            fid, api_key=(settings.google_drive_api_key or "").strip() or None
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except httpx.HTTPError as e:
        log.warning("Drive PDF fetch failed: %s", e)
        raise HTTPException(status_code=502, detail="Gagal mengunduh PDF dari Google Drive") from e
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Cache-Control": "private, max-age=120"},
    )


@public_router.post("/ml-pdf-sessions", response_model=MlPdfSessionStartOut, status_code=status.HTTP_201_CREATED)
async def start_ml_pdf_session(body: MlPdfSessionStartIn, username: str = Depends(get_current_user)):
    pid = _oid(body.pdf_id)
    db = get_db()
    pdoc = await db.ml_pdfs.find_one({"_id": pid, "published": True})
    if not pdoc or not pdoc.get("chapters"):
        raise HTTPException(status_code=404, detail="PDF tidak ditemukan atau belum diterbitkan")
    if not parse_google_drive_file_id(str(pdoc.get("drive_url", ""))):
        raise HTTPException(status_code=400, detail="URL Drive tidak valid")
    doc = {
        "pdf_id": pid,
        "username": username,
        "seconds_pdf": 0.0,
        "status": "reading",
        "created_at": _iso_utc(),
        "updated_at": _iso_utc(),
        "questions": [],
        "report": "",
        "knowledge_level": "",
    }
    res = await db.ml_pdf_learning_sessions.insert_one(doc)
    return MlPdfSessionStartOut(id=str(res.inserted_id), pdf=_pdf_public(pdoc))


@public_router.patch("/ml-pdf-sessions/{session_id}/engagement", status_code=status.HTTP_200_OK)
async def patch_pdf_engagement(
    session_id: str, body: MlPdfEngagementPatchIn, username: str = Depends(get_current_user)
):
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_pdf_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    prev = float(sdoc.get("seconds_pdf") or 0)
    nxt = max(prev, float(body.seconds))
    await db.ml_pdf_learning_sessions.update_one(
        {"_id": sid},
        {"$set": {"seconds_pdf": nxt, "updated_at": _iso_utc()}},
    )
    return {"ok": True, "seconds_pdf": nxt}


@public_router.get("/ml-pdf-sessions/{session_id}/completion", response_model=MlQuizCompletionOut)
async def get_ml_pdf_session_completion(
    session_id: str, username: str = Depends(get_current_user)
):
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_pdf_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    if str(sdoc.get("status") or "") != "done":
        raise HTTPException(status_code=404, detail="Sesi belum selesai atau tidak ada laporan.")
    items: list[MlRemedialItemOut] = []
    raw = sdoc.get("remedial_items")
    if isinstance(raw, list) and raw:
        for r in raw:
            if not isinstance(r, dict):
                continue
            items.append(
                MlRemedialItemOut(
                    question_id=str(r.get("question_id", "") or ""),
                    question=str(r.get("question", "") or ""),
                    user_answer=str(r.get("user_answer", "") or ""),
                )
            )
    if not items:
        qraw = list(sdoc.get("questions") or [])
        items = _mcq_remedial_items(qraw)
    return MlQuizCompletionOut(remedial_items=items)


@public_router.post("/ml-pdf-sessions/{session_id}/quiz/chapter", response_model=MlPdfQuizStepOut)
async def start_chapter_quiz(
    session_id: str,
    body: MlPdfQuizChapterStartIn,
    username: str = Depends(get_current_user),
):
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_pdf_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    if str(sdoc.get("status")) == "done":
        raise HTTPException(status_code=400, detail="Sesi telah selesai")
    pdoc = await db.ml_pdfs.find_one({"_id": sdoc.get("pdf_id")})
    if not pdoc:
        raise HTTPException(status_code=404, detail="Materi PDF tidak ditemukan")
    chapters = [c for c in (pdoc.get("chapters") or []) if isinstance(c, dict)]
    ch_idx = int(body.chapter_index)
    if ch_idx < 0 or ch_idx >= len(chapters):
        raise HTTPException(status_code=400, detail="Nomor bab tidak valid")
    qraw: list = list(sdoc.get("questions") or [])
    existing = [q for q in qraw if isinstance(q, dict) and int(q.get("chapter_index", -999)) == ch_idx]
    cat = _ml_category_typed(pdoc)
    pdf_title = str(pdoc.get("title", "") or "")

    if not _prior_chapters_complete(qraw, ch_idx):
        raise HTTPException(
            status_code=400,
            detail=f"Selesaikan ujian bab {ch_idx} terlebih dahulu sebelum bab {ch_idx + 1}.",
        )

    if existing:
        if all(q.get("answer_index") is not None for q in existing):
            raise HTTPException(status_code=400, detail="Ujian untuk bab ini sudah selesai.")
        o = _next_open_question_for_chapter(qraw, ch_idx)
        if not o:
            raise HTTPException(status_code=400, detail="Tidak ada soal terbuka untuk bab ini.")
    else:
        new_rows = await _gen_mcq_for_chapter(pdf_title, chapters[ch_idx], cat, ch_idx, PDF_MCQ_PER_CHAPTER)
        qraw.extend(new_rows)
        await db.ml_pdf_learning_sessions.update_one(
            {"_id": sid},
            {"$set": {"questions": qraw, "status": "quiz", "updated_at": _iso_utc()}},
        )
        o = _next_open_question_for_chapter(qraw, ch_idx)

    if not o:
        raise HTTPException(status_code=500, detail="Gagal menyiapkan soal.")
    total = _expected_total_mcq(pdoc)
    answered = _count_answered(qraw)
    cur_step = answered + 1
    return MlPdfQuizStepOut(
        question=_mcq_public_row(o),
        done=False,
        current_step=cur_step,
        total_steps=total,
    )


@public_router.post("/ml-pdf-sessions/{session_id}/quiz/answer", response_model=MlPdfQuizStepOut)
async def post_pdf_mcq_answer(
    session_id: str, body: MlMcqAnswerIn, username: str = Depends(get_current_user),
):
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_pdf_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    if str(sdoc.get("status")) == "done":
        raise HTTPException(status_code=400, detail="Sesi telah selesai")
    pdoc = await db.ml_pdfs.find_one({"_id": sdoc.get("pdf_id")})
    if not pdoc:
        raise HTTPException(status_code=404, detail="Materi PDF tidak ditemukan")

    qraw: list = list(sdoc.get("questions") or [])
    qid = str(body.question_id or "").strip()
    if not qid:
        raise HTTPException(status_code=400, detail="ID soal wajib.")
    found = _find_question_row(qraw, qid)
    if not found:
        raise HTTPException(status_code=400, detail="Soal tidak ditemukan.")
    _idx, o = found
    if o.get("answer_index") is not None:
        raise HTTPException(status_code=400, detail="Soal ini sudah dijawab.")
    ch = len(o.get("choices") or [])
    if ch < 2:
        raise HTTPException(status_code=400, detail="Soal rusak (pilihan).")
    max_i = min(3, ch - 1)
    ci_ans = int(body.choice_index)
    if ci_ans < 0 or ci_ans > max_i:
        raise HTTPException(status_code=400, detail="Indeks pilihan tidak valid.")

    qraw[_idx] = {**o, "answer_index": ci_ans}

    total = _expected_total_mcq(pdoc)
    chapters_n = len([c for c in (pdoc.get("chapters") or []) if isinstance(c, dict)])
    ch_done_idx = int(o.get("chapter_index", 0))

    if _chapter_fully_answered(qraw, ch_done_idx) and ch_done_idx < chapters_n - 1:
        await db.ml_pdf_learning_sessions.update_one(
            {"_id": sid},
            {"$set": {"questions": qraw, "status": "reading", "updated_at": _iso_utc()}},
        )
        answered = _count_answered(qraw)
        return MlPdfQuizStepOut(
            question=None,
            done=False,
            current_step=answered,
            total_steps=total,
            chapter_quiz_done=True,
            next_chapter_index=ch_done_idx + 1,
            seconds_pdf=float(sdoc.get("seconds_pdf") or 0),
        )

    nxt = _next_open_question_for_chapter(qraw, ch_done_idx)
    if nxt is None and ch_done_idx >= chapters_n - 1:
        return await _finalize_pdf_session(db, sid, {**sdoc, "questions": qraw}, pdoc)
    if nxt is None:
        nxt = _next_open_question(qraw)
    if nxt is None:
        return await _finalize_pdf_session(db, sid, {**sdoc, "questions": qraw}, pdoc)

    await db.ml_pdf_learning_sessions.update_one(
        {"_id": sid},
        {"$set": {"questions": qraw, "status": "quiz", "updated_at": _iso_utc()}},
    )
    answered = _count_answered(qraw)
    return MlPdfQuizStepOut(
        question=_mcq_public_row(nxt),
        done=False,
        current_step=answered + 1,
        total_steps=total,
        seconds_pdf=float(sdoc.get("seconds_pdf") or 0),
    )


# --- Admin ---


def _pdf_doc_from_create(body: MlPdfCreate) -> dict:
    y = _validate_drive_file_url(body.drive_url)
    cat = _ml_category(body.category)
    bt = ""
    if cat == "belajar_plus":
        bt = _normalize_belajar_topic_slug(body.belajar_topic)
    chs = []
    for c in body.chapters:
        chs.append(
            {
                "title": c.title.strip(),
                "page_start": int(c.page_start),
                "page_end": int(c.page_end),
                "content": (c.content or "").strip(),
                "explanation": (c.explanation or "").strip(),
            }
        )
    return {
        "title": body.title.strip(),
        "description": (body.description or "").strip(),
        "drive_url": y,
        "drive_file_id": parse_google_drive_file_id(y),
        "chapters": chs,
        "sort_order": int(body.sort_order),
        "published": bool(body.published),
        "category": cat,
        "belajar_topic": bt,
    }


@admin_router.get("/ml-pdfs", response_model=list[MlPdfOut])
async def admin_list_pdfs(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    cur = db.ml_pdfs.find({}).sort("sort_order", 1)
    docs = await cur.to_list(300)
    return [_pdf_out(d) for d in docs]


@admin_router.post("/ml-pdfs", response_model=MlPdfOut, status_code=status.HTTP_201_CREATED)
async def admin_create_pdf(body: MlPdfCreate, _admin: str = Depends(require_content_admin)):
    _ = _admin
    doc = _pdf_doc_from_create(body)
    db = get_db()
    doc["created_at"] = _iso_utc()
    doc["updated_at"] = _iso_utc()
    res = await db.ml_pdfs.insert_one(doc)
    created = await db.ml_pdfs.find_one({"_id": res.inserted_id})
    assert created is not None
    return _pdf_out(created)


@admin_router.put("/ml-pdfs/{pdf_id}", response_model=MlPdfOut)
async def admin_update_pdf(pdf_id: str, body: MlPdfUpdate, _admin: str = Depends(require_content_admin)):
    _ = _admin
    oid = _oid(pdf_id)
    db = get_db()
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if "drive_url" in patch and patch["drive_url"] is not None:
        patch["drive_url"] = _validate_drive_file_url(str(patch["drive_url"]))
        patch["drive_file_id"] = parse_google_drive_file_id(patch["drive_url"])
    if "category" in patch and patch["category"] is not None:
        patch["category"] = _ml_category(patch["category"])
    ex_pre = await db.ml_pdfs.find_one({"_id": oid})
    if not ex_pre:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    if "belajar_topic" in patch or "category" in patch:
        cat_now = _ml_category(patch.get("category", ex_pre.get("category")))
        if cat_now == "belajar_plus":
            patch["belajar_topic"] = _normalize_belajar_topic_slug(str(patch.get("belajar_topic") or ""))
        else:
            patch["belajar_topic"] = ""
    elif patch.get("category") is not None and _ml_category(patch["category"]) != "belajar_plus":
        patch["belajar_topic"] = ""
    if "chapters" in patch and patch["chapters"] is not None:
        chs = []
        for c in patch["chapters"]:
            row = MlPdfChapterAdmin.model_validate(c) if isinstance(c, dict) else c
            if not isinstance(row, MlPdfChapterAdmin):
                continue
            chs.append(
                {
                    "title": row.title.strip(),
                    "page_start": int(row.page_start),
                    "page_end": int(row.page_end),
                    "content": (row.content or "").strip(),
                    "explanation": (row.explanation or "").strip(),
                }
            )
        if not chs:
            raise HTTPException(status_code=400, detail="Minimal satu bab.")
        patch["chapters"] = chs
    for k in ("title", "description"):
        if k in patch and patch[k] is not None and isinstance(patch[k], str):
            patch[k] = patch[k].strip()
    if not patch:
        return _pdf_out(ex_pre)
    patch["updated_at"] = _iso_utc()
    r = await db.ml_pdfs.update_one({"_id": oid}, {"$set": patch})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    u = await db.ml_pdfs.find_one({"_id": oid})
    assert u is not None
    return _pdf_out(u)


@admin_router.delete("/ml-pdfs/{pdf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_pdf(pdf_id: str, _admin: str = Depends(require_content_admin)):
    _ = _admin
    oid = _oid(pdf_id)
    db = get_db()
    r = await db.ml_pdfs.delete_one({"_id": oid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    await db.ml_pdf_learning_sessions.delete_many({"pdf_id": oid})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.get("/ml-pdf-sessions", response_model=list[MlPdfSessionLogRow])
async def admin_list_pdf_sessions(
    pdf_id: str | None = Query(None),
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    db = get_db()
    q: dict = {}
    if pdf_id and str(pdf_id).strip():
        q["pdf_id"] = _oid(str(pdf_id).strip())
    cur = db.ml_pdf_learning_sessions.find(q).sort("created_at", -1).limit(300)
    docs = await cur.to_list(300)
    pcache: dict[str, str] = {}
    rows: list[MlPdfSessionLogRow] = []
    for d in docs:
        pid = d.get("pdf_id")
        pid_s = str(pid) if isinstance(pid, ObjectId) else ""
        if isinstance(pid, ObjectId):
            if pid_s not in pcache:
                pdoc = await db.ml_pdfs.find_one({"_id": pid})
                pcache[pid_s] = (pdoc or {}).get("title", "(PDF)") or "(PDF)"
        rows.append(
            MlPdfSessionLogRow(
                id=str(d["_id"]),
                username=str(d.get("username", "")),
                pdf_id=pid_s,
                pdf_title=pcache.get(pid_s, "(PDF)"),
                created_at=str(d.get("created_at", "")),
                seconds_pdf=float(d.get("seconds_pdf") or 0),
                knowledge_level=str(d.get("knowledge_level", "") or ""),
                report=str(d.get("report", "") or ""),
                status=str(d.get("status", "") or ""),
            )
        )
    return rows
