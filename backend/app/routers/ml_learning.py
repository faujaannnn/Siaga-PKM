import logging
import re
from datetime import datetime, timezone

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from typing import Literal, cast

from app.ai_answer_explainer import explain_mcq_answers_batch
from app.db import get_db
from app.deepseek import deepseek_json
from app.deps import get_current_user, require_content_admin
from app.ml_assessment_scoring import (
    LipiLiteResult,
    build_assessment_from_scores,
    fallback_assessment_from_level,
)
from app.ml_bloom_planner import bloom_instruction_for_q1, bloom_instruction_for_step, short_bloom_tag
from siaga_common.assessment_prompts import (
    ML_PROMPT_ACAK_INDEKS_JAWABAN,
    ML_PROMPT_SOAL_PG_SERAGAM,
    ML_PROMPT_SOAL_TANPA_PEMBUKA_NASKAH,
    ML_PROMPT_TANPA_RUJUK_WAKTU,
    shuffle_mcq_row_choices,
    strip_mc_question_script_boilerplate,
)
from app.schemas import (
    MlAnswerIn,
    MlAssessmentSummaryOut,
    MlBelajarExtraSlugsIn,
    MlBelajarTopicItem,
    MlBelajarTopicsAdminOut,
    MlBelajarTopicsOut,
    MlGradingItemOut,
    MlQuestionOut,
    MlQuizCompletionOut,
    MlQuizStepOut,
    MlRemedialItemOut,
    MlSessionLogRow,
    MlSessionStartIn,
    MlSessionStartOut,
    MlVideoCreate,
    MlVideoOut,
    MlVideoPublicOut,
    MlVideoUpdate,
    MlWatchPatchIn,
)
from app.youtube_id import parse_youtube_id

log = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public", tags=["ml-learning"])
admin_router = APIRouter(prefix="/admin", tags=["admin-ml"])

_ML_CATS = frozenset({"asesmen_ai", "belajar_plus"})
# Satu panggilan AI per langkah; total langkah = kuiz interaktif
QUIZ_STEPS = 4
"""Bagian pemutaran minimum (70%) sebelum bisa mulai paket quiz baru dari sesi aktif."""
ML_QUIZ_MIN_WATCH_RATIO = 0.7


def _is_mcq_storage_row(row: dict) -> bool:
    ch = row.get("choices")
    return isinstance(row, dict) and isinstance(ch, list) and len(ch) >= 4 and isinstance(
        row.get("correct_index"),
        int,
    )


def _quiz_row_answered(row: dict) -> bool:
    if not isinstance(row, dict):
        return False
    if _is_mcq_storage_row(row):
        return isinstance(row.get("answer_choice"), int)
    a = row.get("answer")
    return a is not None and bool(str(a).strip())


def _remedial_items_from_qraw(qraw: list) -> list[MlRemedialItemOut]:
    """Bangun daftar soal + jawaban peserta untuk UI remedial."""
    out: list[MlRemedialItemOut] = []
    for q in qraw:
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id", "") or "").strip()
        if not qid:
            continue
        if _is_mcq_storage_row(q):
            choices = list(q.get("choices") or [])
            ix = q.get("answer_choice")
            if isinstance(ix, int) and 0 <= ix < len(choices):
                ua = f"Pilihan {ix + 1}: {choices[ix]}"
            else:
                ua = "-"
        else:
            ua = str(q.get("answer", "") or "")
        out.append(
            MlRemedialItemOut(
                question_id=qid,
                question=str(q.get("question", "") or ""),
                user_answer=ua,
            )
        )
    return out


_SETTINGS_ML_BELAJAR = "ml_belajar_extra_topics"
# Topik bawaan (slug, label) untuk modul Belajar ++ - kosong; topik ditambah lewat Admin bila perlu
_DEFAULT_BELAJAR_TOPICS: list[tuple[str, str]] = []
# Topik lama yang tidak lagi ditampilkan di Video ML
_EXCLUDED_BELAJAR_TOPIC_SLUGS = frozenset({"banjir", "gempa_bumi", "tanah_longsor"})


def _default_belajar_topic_slugs() -> set[str]:
    return {a for a, _ in _DEFAULT_BELAJAR_TOPICS}


def _normalize_belajar_topic_slug(s: str) -> str:
    t = (s or "").strip().lower()
    t = re.sub(r"[^a-z0-9_]+", "_", t)
    t = re.sub(r"_+", "_", t).strip("_")
    return t[:50]


def _all_belajar_topic_items(extra: list[str]) -> list[MlBelajarTopicItem]:
    items: list[MlBelajarTopicItem] = [MlBelajarTopicItem(slug=a, label=b) for a, b in _DEFAULT_BELAJAR_TOPICS]
    for s in extra:
        if s in _EXCLUDED_BELAJAR_TOPIC_SLUGS or s in {x.slug for x in items}:
            continue
        label = s.replace("_", " ").title()
        items.append(MlBelajarTopicItem(slug=s, label=label))
    return items


async def _load_extra_belajar_slugs(db) -> list[str]:
    doc = await db.app_settings.find_one({"_id": _SETTINGS_ML_BELAJAR})
    if not doc:
        return []
    raw = doc.get("extra_slugs") or []
    deff = _default_belajar_topic_slugs()
    out: list[str] = []
    for x in raw:
        ns = _normalize_belajar_topic_slug(str(x))
        if len(ns) < 2 or not re.match(r"^[a-z][a-z0-9_]*$", ns):
            continue
        if ns in deff or ns in _EXCLUDED_BELAJAR_TOPIC_SLUGS or ns in out:
            continue
        out.append(ns)
    return out


async def _save_extra_belajar_slugs(db, slugs: list[str]) -> list[str]:
    deff = _default_belajar_topic_slugs()
    clean: list[str] = []
    for x in slugs:
        ns = _normalize_belajar_topic_slug(x)
        if len(ns) < 2 or not re.match(r"^[a-z][a-z0-9_]*$", ns):
            continue
        if ns in deff or ns in _EXCLUDED_BELAJAR_TOPIC_SLUGS or ns in clean:
            continue
        clean.append(ns)
    await db.app_settings.update_one(
        {"_id": _SETTINGS_ML_BELAJAR},
        {"$set": {"extra_slugs": clean, "updated_at": _iso_utc()}},
        upsert=True,
    )
    return clean
# Memperkecil isi = respons DeepSeek biasanya lebih cepat (kurangi timeout/504)
_MAX_SCRIPT_CHARS = 4200
_MAX_EXPL_CHARS = 1800

# Naskah admin sering memakai penanda [m:ss] - tidak boleh terbawa ke teks soal.
_TIME_MARKER_BRACKET = re.compile(
    r"\[\s*\d{1,2}:\d{2}(?::\d{2})?\s*\]",
    re.IGNORECASE,
)
# Rentang «m:ss–m:ss» dilarang di semua soal; hapus bila model menyelipkannya.
_TIME_RANGE_ANGLE = re.compile(
    r"«\s*\d{1,2}:\d{2}\s*[–-]\s*\d{1,2}:\d{2}\s*»",
    re.IGNORECASE,
)


def _sanitize_question_text_no_video_time(question: str) -> str:
    """Buang rujukan waktu cuplikan dari teks soal (selaras ML_PROMPT_TANPA_RUJUK_WAKTU)."""
    q = strip_mc_question_script_boilerplate((question or "").strip())
    if not q:
        return q
    q = _TIME_MARKER_BRACKET.sub("", q)
    q = _TIME_RANGE_ANGLE.sub("", q)
    q = re.sub(r"  +", " ", q)
    q = re.sub(r"\(\s*\)", "", q)
    return q.strip(" ,;:")


def _clip_for_llm(text: str, max_ch: int) -> str:
    t = (text or "").strip()
    if len(t) <= max_ch:
        return t
    return t[: max_ch - 28] + "\n[…ringkas, dipotong untuk kecepatan…]"


def _ml_qa_history_block(qlist: list) -> str:
    lines: list[str] = []
    for q in qlist:
        if not isinstance(q, dict):
            continue
        if not _quiz_row_answered(q):
            continue
        qid = str(q.get("id", "") or "")
        qt = str(q.get("question", "") or "")
        ans_line = ""
        if _is_mcq_storage_row(q):
            ix = q.get("answer_choice")
            choices = list(q.get("choices") or [])
            if isinstance(ix, int) and 0 <= ix < len(choices):
                ans_line = f"Pilihan {ix + 1}: {choices[ix]}"
        else:
            a = q.get("answer")
            if a is not None:
                ans_line = str(a).strip()
        if ans_line:
            lines.append(f"- [{qid}] {qt}\n  Jawaban peserta: {ans_line}")
    return "\n\n".join(lines) if lines else "(belum ada jawaban)"


def _count_answered(qlist: list) -> int:
    n = 0
    for q in qlist:
        if isinstance(q, dict) and _quiz_row_answered(q):
            n += 1
    return n


def _open_question_row(qlist: list) -> dict | None:
    for q in qlist:
        if isinstance(q, dict) and not _quiz_row_answered(q):
            return q
    return None


def _storage_row_public_out(row: dict) -> MlQuestionOut:
    ch = list(row.get("choices") or [])
    return MlQuestionOut(
        id=str(row.get("id", "") or ""),
        question=str(row.get("question", "") or ""),
        choices=ch[:4],
    )


def _parse_deepseek_mcq_payload(data: object, *, expected_id: str) -> dict | None:
    if not isinstance(data, dict):
        return None
    qt = str(data.get("question", "") or "").strip()
    raw_ch = data.get("choices") if isinstance(data.get("choices"), list) else data.get("options")
    if not isinstance(raw_ch, list) or len(raw_ch) < 4:
        return None
    ch4 = [str(x).strip() for x in raw_ch[:4]]
    if not qt or len(qt) < 8 or any(len(x) < 1 for x in ch4):
        return None
    try:
        ci = int(data.get("correct_index", data.get("correctIndex", 0)))
    except (TypeError, ValueError):
        return None
    if ci not in (0, 1, 2, 3):
        return None
    eid = str(data.get("id", "") or "").strip() or expected_id
    return {"question": qt, "choices": ch4, "correct_index": ci, "id": eid}


async def _ml_gen_first_question_row(
    script: str, expl: str, video_title: str, video_category: str
) -> dict:
    sc = _clip_for_llm(script, _MAX_SCRIPT_CHARS)
    ex = _clip_for_llm(expl, _MAX_EXPL_CHARS)
    bblock = bloom_instruction_for_q1(video_category)
    system = (
        "Pendidik kesehatan & kesiapsiagaan. Satu soal PILIHAN GANDA tepat empat opsi bahasa Indonesia dari naskah. "
        f"{ML_PROMPT_SOAL_TANPA_PEMBUKA_NASKAH} "
        f"{ML_PROMPT_ACAK_INDEKS_JAWABAN} "
        f"{ML_PROMPT_SOAL_PG_SERAGAM} "
        f"WAJIB: {bblock} {ML_PROMPT_TANPA_RUJUK_WAKTU} "
        "Buat tepat satu jawaban benar; distraktor masuk akal. "
        'Hanya JSON: {"id":"q1","question":"stem","choices":["op1","op2","op3","op4"],'
        '"correct_index":N} dengan N ∈ {0,1,2,3}; jangan terus menempatkan jawaban benar pada indeks pertama.'
    )
    user_msg = f"Judul: {video_title}\nNASKAH:\n{sc}\n\nCATATAN:\n{ex}\n"
    tag = short_bloom_tag(video_category, 1, None)
    try:
        data = await deepseek_json(system, user_msg, temperature=0.25, max_tokens=380, read_timeout=48.0)
        parsed = _parse_deepseek_mcq_payload(data, expected_id="q1")
        if not parsed:
            raise ValueError("invalid mcq q1")
        qt = _sanitize_question_text_no_video_time(parsed["question"])
        if len(qt) < 8:
            raise ValueError("q1 sanitasi")
        parsed["question"] = qt
        if str(parsed["id"]) != "q1":
            parsed["id"] = "q1"
        return shuffle_mcq_row_choices(
            {
                "id": "q1",
                "question": parsed["question"],
                "choices": parsed["choices"],
                "correct_index": parsed["correct_index"],
                "answer_choice": None,
                "bloom_target": tag,
            }
        )
    except (HTTPException, ValueError, TypeError, KeyError) as e:
        log.warning("Asesmen: fallback MCQ q1: %s", e)
        return _fallback_mcq_row(video_title=video_title, step_no=1, video_category=video_category)


def _mcq_gate_c4_for_basic(qraw: list) -> bool:
    """Soal lanjutan q4 lebih berat jika peserta menjawab q3 PG dengan benar."""
    for q in qraw:
        if isinstance(q, dict) and str(q.get("id", "")) == "q3" and _is_mcq_storage_row(q):
            return int(q.get("answer_choice")) == int(q.get("correct_index"))
    return False


def _fallback_mcq_row(*, step_no: int, video_category: str, video_title: str, c4_gate_ok: bool | None = None) -> dict:
    t = (video_title or "modul ini").strip()[:140] or "modul ini"
    eid = f"q{step_no}"
    if step_no == 1:
        stem = (
            f'Pilih pernyataan yang paling selaras dengan tujuan edukasi kesehatan masyarakat untuk materi “{t}”.'
        )
    elif step_no == 4 and video_category == "asesmen_ai" and c4_gate_ok:
        stem = (
            f"Pilih pernyataan yang paling tepat menerapkan poin lanjutan materi “{t}” "
            "pada situasi nyata di tingkat rumah atau RT."
        )
    elif step_no == 4:
        stem = (
            f"Pilih tindakan konkret yang paling realistis menerapkan poin utama “{t}” di tingkat rumah atau RT."
        )
    else:
        stem = (
            f"Langkah {step_no} dari {QUIZ_STEPS}: pilih pernyataan yang membantu menghubungkan materi “{t}” ke perilaku nyata."  # noqa: E501
        )
    ch = [
        "Menggunakan info untuk membuat rencana sederhana: jalur komunikasi, titik bertemu, dan cek perlengkapan ringan.",  # noqa: E501
        "Berpegang pada asumsi lama walau lokasi baru berbeda pola risiko.",
        "Menunggu sinyal media sosial saja sebagai dasar utama keputusan evakuasi.",
        "Berperilaku identik seperti hari biasa hingga ada kepanikan publik mendadak.",
    ]
    return shuffle_mcq_row_choices(
        {
            "id": eid,
            "question": stem,
            "choices": ch,
            "correct_index": 0,
            "answer_choice": None,
            "bloom_target": short_bloom_tag(video_category, step_no, c4_gate_ok if step_no == 4 else None),
        }
    )


async def _ml_gen_next_question_row(
    script: str,
    expl: str,
    qlist: list,
    step_no: int,
    *,
    video_category: str,
    video_title: str,
    c4_gate_ok: bool | None = None,
) -> dict:
    if step_no < 2 or step_no > QUIZ_STEPS:
        raise HTTPException(status_code=500, detail="Langkah asesmen tidak valid")
    expected = f"q{step_no}"
    sc = _clip_for_llm(script, _MAX_SCRIPT_CHARS)
    ex = _clip_for_llm(expl, _MAX_EXPL_CHARS)
    hist = _ml_qa_history_block(qlist)
    if len(hist) > 4000:
        hist = hist[:3990] + "…[dipotong]"
    bblock = bloom_instruction_for_step(video_category, step_no, c3_adequate_for_q4=c4_gate_ok)
    system = (
        f'Wajib SATU soal PILIHAN GANDA bahasa Indonesia dengan id tepat "{expected}". '
        f"{ML_PROMPT_SOAL_TANPA_PEMBUKA_NASKAH} "
        f"{ML_PROMPT_ACAK_INDEKS_JAWABAN} "
        f"{ML_PROMPT_SOAL_PG_SERAGAM} "
        f"{bblock} {ML_PROMPT_TANPA_RUJUK_WAKTU} "
        "Empat opsi jawaban; satu jawaban benar. "
        'JSON: {"id":"'
        + expected
        + '","question":"stem","choices":["op1","op2","op3","op4"],"correct_index":N} dengan N ∈ {0,1,2,3}; '
        "variasi acak dari langkah ke langkah - bukan pola jawaban benar selalu pertama. "
        "Sesuaikan narasi dengan pilihan yang sudah dijawab peserta dalam riwayat."
    )
    user_msg = f"NASKAH:\n{sc}\n\nCATATAN:\n{ex}\n\nRIWAYAT TANYA-JAWAB:\n{hist}\n"
    tag = short_bloom_tag(video_category, step_no, c4_gate_ok if step_no == 4 else None)
    try:
        data = await deepseek_json(system, user_msg, temperature=0.28, max_tokens=520, read_timeout=55.0)
        parsed = _parse_deepseek_mcq_payload(data, expected_id=expected)
        if not parsed:
            raise ValueError("bad mcq follow-up")
        qt = _sanitize_question_text_no_video_time(parsed["question"])
        if len(qt) < 8:
            raise ValueError("sanitize")
        return shuffle_mcq_row_choices(
            {
                "id": expected,
                "question": qt,
                "choices": parsed["choices"],
                "correct_index": parsed["correct_index"],
                "answer_choice": None,
                "bloom_target": tag,
            }
        )
    except (HTTPException, ValueError, TypeError, KeyError) as e:
        log.warning("Asesmen: fallback MCQ %s: %s", expected, e)
        return _fallback_mcq_row(
            step_no=step_no,
            video_category=video_category,
            video_title=video_title,
            c4_gate_ok=c4_gate_ok,
        )


def _should_use_mcq_finalize(qraw: list) -> bool:
    """True bila sesi menggunakan format pilihan ganda baru untuk tiap langkah."""
    if len(qraw) != QUIZ_STEPS:
        return False
    for row in qraw:
        if not isinstance(row, dict):
            return False
        if not _is_mcq_storage_row(row):
            return False
    return True


async def _finalize_mcq_assessment_from_rows(
    qraw: list,
    video_category: str,
    belajar_topic: str,
    *,
    title: str,
    seconds_watched: float,
    script: str = "",
    expl: str = "",
) -> tuple[str, str, LipiLiteResult]:
    scored: list[dict[str, object]] = []
    ai_batch: list[dict[str, object]] = []
    n_ok = 0
    n_mcq = 0
    for idx, row in enumerate(qraw):
        if not isinstance(row, dict) or not _is_mcq_storage_row(row):
            continue
        chosen = row.get("answer_choice")
        key = row.get("correct_index")
        if not isinstance(chosen, int) or not isinstance(key, int):
            continue
        n_mcq += 1
        ok = chosen == key
        if ok:
            n_ok += 1
        p = 1.0 if ok else 0.0
        b_step = float(2.0 + min(3.15, idx * 0.75))
        qid = str(row.get("id", "") or f"q{idx + 1}")
        choices_l = list(row.get("choices") or [])
        ktxt = ""
        if 0 <= int(key) < len(choices_l):
            ktxt = str(choices_l[int(key)])
        chosen_txt = str(choices_l[chosen]) if 0 <= chosen < len(choices_l) else "?"
        rationale = (
            f"Jawaban benar: {ktxt}."
            if ok
            else f"Jawaban yang tepat: {ktxt}. Anda memilih: {chosen_txt}."
        )
        scored.append(
            {
                "question_id": qid,
                "p_correct": p,
                "correctness_score": p,
                "bloom_level": b_step,
                "rationale": rationale,
                "feedback_educatif": (
                    "Pertahankan pemahaman konsep ini pada materi serupa."
                    if ok
                    else "Tinjau ulang bagian video yang membahas poin ini sebelum lanjut."
                ),
                "expected_answer_summary": ktxt[:500],
            }
        )
        ai_batch.append(
            {
                "question_id": qid,
                "question": str(row.get("question", "") or ""),
                "choices": choices_l,
                "correct_index": key,
                "answer_choice": chosen,
            }
        )

    if ai_batch and (script.strip() or expl.strip()):
        ai_map = await explain_mcq_answers_batch(
            video_title=title,
            script=script,
            explanation=expl,
            rows=ai_batch,
        )
        for item in scored:
            qid = str(item.get("question_id", ""))
            ai = ai_map.get(qid)
            if not ai:
                continue
            if ai.get("rationale"):
                item["rationale"] = ai["rationale"]
            if ai.get("expected_answer_summary"):
                item["expected_answer_summary"] = ai["expected_answer_summary"]
            if ai.get("feedback_educatif"):
                item["feedback_educatif"] = ai["feedback_educatif"]
    if n_mcq < 1:
        level = "sedang"
        report = "Ringkasan: format soal tidak lengkap untuk penilaian pilihan ganda."
        lipi = fallback_assessment_from_level(level, QUIZ_STEPS, video_category, belajar_topic)
        return level, report, lipi

    pct = (n_ok / float(n_mcq)) * 100.0
    if pct >= 75.0:
        level = "tinggi"
    elif pct >= 45.0:
        level = "sedang"
    else:
        level = "rendah"
    vt = (title or "").strip() or "video"
    report = (
        f"Pilihan ganda selesai: {n_ok} dari {n_mcq} benar ({pct:.0f}%). "
        f"Tingkat pengetahuan perkiraan: {level}. "
        f"Estimasi tonton ±{seconds_watched:.0f} dtk untuk “{vt[:120]}.”"
    )
    lipi = build_assessment_from_scores(
        scored=scored, video_category=video_category, belajar_topic=belajar_topic, knowledge_level=level
    )
    return level, report, lipi


def _grading_items_from_per_item(rows: list[dict]) -> list[MlGradingItemOut]:
    out: list[MlGradingItemOut] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        try:
            bd = row.get("bloom_distribution")
            if bd is not None and not isinstance(bd, dict):
                bd = None
            out.append(
                MlGradingItemOut(
                    question_id=str(row.get("question_id", "") or ""),
                    p_correct=row.get("p_correct"),
                    correctness_score=float(row.get("correctness_score", 0) or 0),
                    confidence_band=str(row.get("confidence_band", "") or ""),
                    bloom_level=float(row.get("bloom_level", 0) or 0),
                    norm_score=float(row.get("norm_score", 0) or 0),
                    rationale=str(row.get("rationale", "") or ""),
                    feedback_educatif=str(row.get("feedback_educatif", "") or ""),
                    expected_answer_summary=str(row.get("expected_answer_summary", "") or ""),
                    bloom_distribution=bd,
                )
            )
        except Exception:
            continue
    return out


def _lipi_result_to_summary_out(res: LipiLiteResult) -> MlAssessmentSummaryOut:
    per_ans = _grading_items_from_per_item(res.per_item)
    note_konteks = (
        "Yang utama untuk peserta adalah tingkat pengetahuan (rendah / sedang / tinggi); "
        "penilaian pilihan ganda menilai kebenaran memilih opsi dibanding materi referensi admin."
    )
    return MlAssessmentSummaryOut(
        indeks_ka_pct=res.indeks_ka_pct,
        iks_bencana_pct=res.iks_bencana_pct,
        iks_margin_95_pct=res.iks_margin_95_pct,
        bloom_avg=res.bloom_avg,
        bloom_label=res.bloom_label,
        readiness_label=res.readiness_label,
        readiness_key=res.readiness_key,
        recommendation=res.recommendation,
        lipi_lite=res.lipi_lite,
        disaster_slug=res.disaster_slug,
        disaster_label=res.disaster_label,
        parameters=[],
        per_answer=per_ans,
        note=note_konteks,
    )


def _lipi_to_stored(res: LipiLiteResult) -> dict:
    return {
        "version": 2,
        "indeks_ka_pct": res.indeks_ka_pct,
        "iks_bencana_pct": res.iks_bencana_pct,
        "iks_margin_95_pct": res.iks_margin_95_pct,
        "bloom_avg": res.bloom_avg,
        "bloom_label": res.bloom_label,
        "bloom_key": res.bloom_key,
        "readiness_label": res.readiness_label,
        "readiness_key": res.readiness_key,
        "recommendation": res.recommendation,
        "lipi_lite": res.lipi_lite,
        "disaster_slug": res.disaster_slug,
        "disaster_label": res.disaster_label,
        "per_item": res.per_item,
        "parameters": [],
        "grader": "llm_proxy",
        "note": (
            "Hanya KA: Indeks = rata(c×b/6); kategori kesiapan = tingkat pemahaman (bukan IKS 0–100). "
            "c dari p_correct bila ada. Margin ± (95%) dari variansi antar soal."
        ),
    }


async def _ml_gen_report(
    title: str,
    seconds_watched: float,
    qlist: list,
    video_category: str,
    belajar_topic: str,
) -> tuple[str, str, LipiLiteResult]:
    lines: list[str] = []
    id_list: list[str] = []
    for q in qlist:
        if not isinstance(q, dict):
            continue
        qid = str(q.get("id", ""))
        if qid:
            id_list.append(qid)
        ans = str(q.get("answer", "")).strip() or "(kosong)"
        lines.append(
            f"- [{qid}] {q.get('question', '')}\n  Jawaban: {ans}"
        )
    n_answered = len(id_list) or _count_answered(qlist)
    qid_csv = ", ".join(id_list) or "semua soal"
    system = (
        "Anda analis pendidikan kesehatan & penilai asesmen, bahasa Indonesia. "
        "Konteks peserta: masyarakat umum; jawaban esai singkat (bukan makalah). "
        "Utamakan KREDIT PARSIAL dan sikap pendidikan: anggap layak bila inti gagasan selaras naskah, "
        "meski tidak menyebut tiap istilah sekunder atau detail kecil. "
        "Jangan menurunkan p_correct hanya karena ada poin tambahan yang belum disebut (mis. satu istilah teknis) "
        "jika landasan jawaban sudah benar - untuk jawaban inti yang tepat, p_correct biasanya ≥0,80. "
        "p_correct rendah (<0,45) hanya untuk jawaban keliru arah, sangat minim isi, atau tidak relevan. "
        "Jawaban sebagian benar atau setengah layak: beri p_correct kira-kira 0,50–0,70; cukup baik tapi tidak mendalam: 0,70–0,85. "
        "Pada soal evaluasi (mis. q4): jawaban singkat yang menyentuh kritik/revisi wajar jangan dipotong drastis "
        "(jangan sembarangan <0,45 kecuali benar-benar off-topic atau hanya frasa kosong). "
        "Umpan balik: bangun dari yang sudah benar; hindari nada ‘harus lengkap seperti teks referensi’. "
        "Beri laporan naratif SINGKAT (2–4 paragraf) DAN, untuk SETIAP jawaban peserta, isi entri per_answer. "
        "Wajibkan: "
        "p_correct ∈ [0,1] = probabilitas/derajat kebenaran & relevansi relatif naskah video (boleh dianggap "
        "estimasi ‘soft’, seperti output klasifikator); "
        "bloom_level ∈ [1,6] = level Bloom yang paling pas (boleh desimal); OPSIONAL bloom_distribution: "
        "objek {\"1\":p1,...,\"6\":p6} probabilitas per level, jika diisi harus b≈ Σ k*pk; "
        "rationale = singkat 1-3 kalimat: bukti/penyebab c dan b; "
        "feedback_educatif = 1-2 kalimat: apa yang dikuatkan + satu perbaikan konkret; "
        "expected_answer_summary = poin kunci yang diharapkan (bukan jawaban kaku). "
        "Prioritas: gunakan c = p_correct untuk penilaian; correctness_score boleh sama p_correct. "
        "Keluaran HANYA JSON valid, tanpa markdown atau teks di luar JSON. Contoh bentuk: "
        '{"knowledge_level":"rendah|sedang|tinggi",'
        '"report":"…",'
        '"per_answer":['
        '{"question_id":"q1","p_correct":0.85,"bloom_level":2.2,'
        '"bloom_distribution":{"1":0.1,"2":0.6,"3":0.2,"4":0.1,"5":0,"6":0},'
        '"rationale":"...","feedback_educatif":"...","expected_answer_summary":"..."}'
        "]} "
        f"Wajib satu per_answer per id: {qid_csv}. "
        "Pertimbangkan lama tonton (dtk) sebagai indikasi keterlibatan, bukan bukti faktual. "
        "Jangan sertakan timestamp video di laporan/feedback agar fokus pada kompetensi, bukan posisi tonton. "
    )
    user_msg = (
        f"Judul: {title}\nKategori video: {video_category}\n"
        f"Perkiraan tonton (dtk): {seconds_watched:.0f}\n\n" + "\n\n".join(lines)
    )
    try:
        data = await deepseek_json(
            system,
            user_msg,
            temperature=0.28,
            max_tokens=4000,
            read_timeout=120.0,
        )
    except (HTTPException, Exception) as e:
        log.warning("Asesmen: laporan+skor AI gagal: %s", e)
        level = "sedang"
        report = f"Ringkasan otomatis: tidak dapat memperoleh skor terperinci. Coba selesaikan ulang bila perlu. ({e})"
        lipi = fallback_assessment_from_level(level, n_answered, video_category, belajar_topic)
        return level, report, lipi

    level = str(data.get("knowledge_level", "sedang") or "sedang").strip()
    report = str(data.get("report", "") or "").strip()
    if not report:
        report = f"Ringkasan: tingkat perkiraan {level}."
    raw_ans = data.get("per_answer") or data.get("items") or []
    scored: list[dict] = []
    if isinstance(raw_ans, list):
        for row in raw_ans:
            if isinstance(row, dict) and (row.get("question_id") or row.get("id")):
                qid2 = str(row.get("question_id", row.get("id", ""))).strip()
                scored.append(
                    {
                        "question_id": qid2,
                        "p_correct": row.get("p_correct"),
                        "correctness_score": row.get("correctness_score", row.get("c")),
                        "bloom_level": row.get("bloom_level", row.get("b")),
                        "bloom_distribution": row.get("bloom_distribution"),
                        "rationale": row.get("rationale", row.get("alasan")),
                        "feedback_educatif": row.get(
                            "feedback_educatif", row.get("feedback_edukatif")
                        ),
                        "expected_answer_summary": row.get(
                            "expected_answer_summary", row.get("expected_answer")
                        ),
                    }
                )
    if len(scored) < max(1, n_answered // 2) or n_answered < 1:
        lipi = fallback_assessment_from_level(level, max(1, n_answered), video_category, belajar_topic)
    else:
        try:
            lipi = build_assessment_from_scores(
                scored=scored,
                video_category=video_category,
                belajar_topic=belajar_topic,
                knowledge_level=level,
            )
        except (TypeError, ValueError) as e:
            log.warning("Asesmen: parse skor gagal: %s", e)
            lipi = fallback_assessment_from_level(
                level, max(1, n_answered), video_category, belajar_topic
            )
    return level, report, lipi


def _ml_category(raw: object) -> str:
    s = str(raw or "asesmen_ai").strip()
    return s if s in _ML_CATS else "asesmen_ai"


def _ml_category_typed(doc: dict) -> Literal["asesmen_ai", "belajar_plus"]:
    c = _ml_category(doc.get("category"))
    return cast(Literal["asesmen_ai", "belajar_plus"], c)


def _oid(s: str) -> ObjectId:
    try:
        return ObjectId(s)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e


def _iso_utc() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _video_out(doc: dict) -> MlVideoOut:
    cat = _ml_category_typed(doc)
    bt = str(doc.get("belajar_topic") or "").strip() if cat == "belajar_plus" else ""
    return MlVideoOut(
        id=str(doc["_id"]),
        title=doc.get("title", ""),
        description=doc.get("description", ""),
        youtube_url=doc.get("youtube_url", ""),
        video_script=doc.get("video_script", ""),
        explanation=doc.get("explanation", ""),
        sort_order=int(doc.get("sort_order", 0)),
        published=bool(doc.get("published", True)),
        category=cat,
        belajar_topic=bt,
    )


def _video_public(doc: dict) -> MlVideoPublicOut:
    yu = str(doc.get("youtube_url", ""))
    yid = doc.get("youtube_id") or parse_youtube_id(yu) or ""
    cat = _ml_category_typed(doc)
    bt = str(doc.get("belajar_topic") or "").strip() if cat == "belajar_plus" else ""
    return MlVideoPublicOut(
        id=str(doc["_id"]),
        title=doc.get("title", ""),
        description=doc.get("description", ""),
        youtube_id=yid,
        sort_order=int(doc.get("sort_order", 0)),
        category=cat,
        belajar_topic=bt,
    )


# --- Public: daftar (ringkas) & sesi alur tonton + asesmen ---


@public_router.get("/ml-belajar-topics", response_model=MlBelajarTopicsOut)
async def list_belajar_topics_public(
    _user: str = Depends(get_current_user),
):
    _ = _user
    db = get_db()
    extra = await _load_extra_belajar_slugs(db)
    return MlBelajarTopicsOut(topics=_all_belajar_topic_items(extra))


@public_router.get("/ml-videos", response_model=list[MlVideoPublicOut])
async def list_ml_videos_public(
    category: str | None = Query(
        None,
        description="Filter: asesmen_ai | belajar_plus (opsional)",
    ),
    topik: str | None = Query(
        None,
        description="Filter topik (slug) untuk kategori belajar_plus, mis. banjir",
    ),
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
    cur = db.ml_videos.find(flt).sort("sort_order", 1)
    docs = await cur.to_list(200)
    out: list[MlVideoPublicOut] = []
    for d in docs:
        row = _video_public(d)
        if row.youtube_id:
            out.append(row)
    return out


@public_router.post("/ml-sessions", response_model=MlSessionStartOut, status_code=status.HTTP_201_CREATED)
async def start_ml_session(body: MlSessionStartIn, username: str = Depends(get_current_user)):
    vid = _oid(body.video_id)
    db = get_db()
    vdoc = await db.ml_videos.find_one({"_id": vid, "published": True})
    if not vdoc:
        raise HTTPException(status_code=404, detail="Video tidak ditemukan atau belum diterbitkan")
    yid = vdoc.get("youtube_id") or parse_youtube_id(str(vdoc.get("youtube_url", "")))
    if not yid:
        raise HTTPException(status_code=400, detail="URL YouTube video tidak valid")
    doc = {
        "video_id": vid,
        "username": username,
        "seconds_watched": 0.0,
        "status": "watching",
        "created_at": _iso_utc(),
        "updated_at": _iso_utc(),
        "questions": None,
        "answers": None,
        "report": "",
        "knowledge_level": "",
    }
    res = await db.ml_learning_sessions.insert_one(doc)
    vdoc2 = {**vdoc, "youtube_id": yid}
    return MlSessionStartOut(
        id=str(res.inserted_id),
        video=_video_public(vdoc2),
    )


@public_router.patch("/ml-sessions/{session_id}/watch", status_code=status.HTTP_200_OK)
async def patch_watch(
    session_id: str, body: MlWatchPatchIn, username: str = Depends(get_current_user)
):
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    prev = float(sdoc.get("seconds_watched") or 0)
    nxt = max(prev, float(body.seconds))
    dur_in = body.duration_seconds
    merged_dur = None
    if dur_in is not None:
        try:
            di = float(dur_in)
        except (TypeError, ValueError):
            di = 0.0
        prev_dur = float(sdoc.get("youtube_duration_seconds") or 0)
        if di >= 30 and di <= 12 * 3600:
            merged_dur = max(prev_dur, di)

    fields: dict = {
        "seconds_watched": nxt,
        "updated_at": _iso_utc(),
    }
    if merged_dur is not None:
        fields["youtube_duration_seconds"] = merged_dur

    await db.ml_learning_sessions.update_one(
        {"_id": sid},
        {"$set": fields},
    )
    return {"ok": True, "seconds_watched": nxt}


def _require_video_watch_before_new_ml_quiz(sdoc: dict) -> None:
    """Tanpa mencantumkan angka rasio untuk peserta: cek posisi pemutaran vs durasi tersimpan."""
    dur = float(sdoc.get("youtube_duration_seconds") or 0)
    if dur <= 5:
        return
    watched = float(sdoc.get("seconds_watched") or 0)
    need = dur * ML_QUIZ_MIN_WATCH_RATIO
    if watched + 0.05 < need:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Silakan nonton video sampai habis agar asesmen dibuka.",
        )


@public_router.get("/ml-sessions/{session_id}/completion", response_model=MlQuizCompletionOut)
async def get_ml_session_completion(
    session_id: str, username: str = Depends(get_current_user)
):
    """Ambil remedial yang tersimpan (soal + jawaban) setelah asesmen selesai - untuk hydrate UI bila respons POST terpotong."""
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    if str(sdoc.get("status") or "") != "done":
        raise HTTPException(
            status_code=404,
            detail="Sesi belum selesai atau tidak ada laporan remedial.",
        )
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
        items = _remedial_items_from_qraw(qraw)
    return MlQuizCompletionOut(remedial_items=items)


def _is_legacy_quiz_batch(qraw: list) -> bool:
    if len(qraw) < 2:
        return False
    for q in qraw:
        if isinstance(q, dict):
            if _is_mcq_storage_row(q):
                return False
            ch = q.get("choices")
            if isinstance(ch, list) and len(ch) >= 4 and isinstance(q.get("correct_index"), int):
                return False
    return not any(isinstance(q, dict) and "answer" in q for q in qraw)


@public_router.post("/ml-sessions/{session_id}/quiz/answer", response_model=MlQuizStepOut)
async def post_quiz_answer(
    session_id: str, body: MlAnswerIn, username: str = Depends(get_current_user)
):
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    qraw: list = list(sdoc.get("questions") or [])
    if _is_legacy_quiz_batch(qraw):
        raise HTTPException(
            status_code=400,
            detail="Format asesmen lama. Klik Lanjut ke asesmen dari awal.",
        )
    o = _open_question_row(qraw)
    if o is None:
        raise HTTPException(status_code=400, detail="Tidak ada pertanyaan yang menunggu jawaban. Mulai asesmen dari awal.")
    qid = str(body.question_id or "").strip()
    if not qid or o.get("id") != qid:
        raise HTTPException(status_code=400, detail="Jawab pertanyaan saat ini saja (urutan satu per satu).")
    if _is_mcq_storage_row(o):
        if body.choice_index is None:
            raise HTTPException(status_code=400, detail="Pilih salah satu opsi jawaban.")
        ci_ans = int(body.choice_index)
        ch_max = len(list(o.get("choices") or []))
        if ch_max < 4 or ci_ans < 0 or ci_ans >= ch_max:
            raise HTTPException(status_code=400, detail="Indeks pilihan tidak valid.")
        for i, row in enumerate(qraw):
            if isinstance(row, dict) and str(row.get("id")) == qid:
                qraw[i] = {**row, "answer_choice": ci_ans, "answer": None}
                break
        else:
            raise HTTPException(status_code=400, detail="Pertanyaan tidak ditemukan.")
    else:
        text_ans = (body.text or "").strip()
        if not text_ans:
            raise HTTPException(status_code=400, detail="Jawaban teks tidak boleh kosong.")
        for i, row in enumerate(qraw):
            if isinstance(row, dict) and str(row.get("id")) == qid:
                qraw[i] = {**row, "answer": text_ans}
                break
        else:
            raise HTTPException(status_code=400, detail="Pertanyaan tidak ditemukan.")

    vdoc = await db.ml_videos.find_one({"_id": sdoc.get("video_id")})
    if not vdoc:
        raise HTTPException(status_code=404, detail="Video asal tidak ditemukan")
    title = vdoc.get("title", "")
    script = (vdoc.get("video_script") or "").strip()
    expl = (vdoc.get("explanation") or "").strip()
    if not script and not expl:
        raise HTTPException(status_code=400, detail="Materi video tidak memiliki naskah untuk asesmen.")

    sec = float(sdoc.get("seconds_watched") or 0)
    n_ans = _count_answered(qraw)
    vcat = _ml_category_typed(vdoc)
    next_no = n_ans + 1
    c4_gate_ok: bool | None = None
    if vcat == "asesmen_ai" and next_no == 4:
        c4_gate_ok = _mcq_gate_c4_for_basic(qraw)

    if n_ans < QUIZ_STEPS:
        nxt = await _ml_gen_next_question_row(
            script,
            expl,
            qraw,
            next_no,
            video_category=vcat,
            video_title=str(title or ""),
            c4_gate_ok=c4_gate_ok,
        )
        qraw.append(dict(nxt))
        set_doc: dict = {
            "questions": qraw,
            "status": "quiz",
            "updated_at": _iso_utc(),
        }
        if vcat == "asesmen_ai" and next_no == 4 and c4_gate_ok is not None:
            set_doc["c3_adequate_for_q4"] = c4_gate_ok
        await db.ml_learning_sessions.update_one(
            {"_id": sid},
            {"$set": set_doc},
        )
        return MlQuizStepOut(
            question=_storage_row_public_out(nxt),
            done=False,
            current_step=n_ans + 1,
            total_steps=QUIZ_STEPS,
            report="",
            knowledge_level="",
            seconds_watched=sec,
            assessment=None,
        )

    raw_bt = str(vdoc.get("belajar_topic") or "").strip()
    belajar_topic = _normalize_belajar_topic_slug(raw_bt) if raw_bt else ""
    if _should_use_mcq_finalize(qraw):
        level, report, lipi = await _finalize_mcq_assessment_from_rows(
            qraw,
            vcat,
            belajar_topic,
            title=str(title or ""),
            seconds_watched=sec,
            script=script,
            expl=expl,
        )
    else:
        level, report, lipi = await _ml_gen_report(
            str(title or ""), sec, qraw, vcat, belajar_topic
        )
    as_out = _lipi_result_to_summary_out(lipi)
    stored = _lipi_to_stored(lipi)
    remedial_items = _remedial_items_from_qraw(qraw)
    ans_for_log: list[dict] = []
    for q in qraw:
        if not isinstance(q, dict):
            continue
        iid = str(q.get("id", "") or "").strip()
        if not iid:
            continue
        if _is_mcq_storage_row(q) and isinstance(q.get("answer_choice"), int):
            ans_for_log.append(
                {"question_id": iid, "choice_index": int(q.get("answer_choice")), "text": ""}
            )
        else:
            ans_for_log.append({"question_id": iid, "text": str(q.get("answer", "") or "").strip()})
    await db.ml_learning_sessions.update_one(
        {"_id": sid},
        {
            "$set": {
                "questions": qraw,
                "answers": ans_for_log,
                "knowledge_level": level,
                "report": report,
                "assessment_summary": stored,
                "remedial_items": [r.model_dump() for r in remedial_items],
                "status": "done",
                "updated_at": _iso_utc(),
            }
        },
    )
    return MlQuizStepOut(
        question=None,
        done=True,
        current_step=QUIZ_STEPS,
        total_steps=QUIZ_STEPS,
        report=report,
        knowledge_level=level,
        seconds_watched=sec,
        assessment=as_out,
        remedial_items=remedial_items,
    )


@public_router.post("/ml-sessions/{session_id}/quiz", response_model=MlQuizStepOut)
async def start_or_resume_quiz(session_id: str, username: str = Depends(get_current_user)):
    sid = _oid(session_id)
    db = get_db()
    sdoc = await db.ml_learning_sessions.find_one({"_id": sid})
    if not sdoc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")
    if sdoc.get("username") != username:
        raise HTTPException(status_code=403, detail="Akses sesi ditolak")
    vdoc = await db.ml_videos.find_one({"_id": sdoc.get("video_id")})
    if not vdoc:
        raise HTTPException(status_code=404, detail="Video asal tidak ditemukan")
    script = (vdoc.get("video_script") or "").strip()
    expl = (vdoc.get("explanation") or "").strip()
    if not script and not expl:
        raise HTTPException(
            status_code=400,
            detail="Admin belum mengisi naskah/penjelasan; asesmen AI tidak dapat dibuat.",
        )
    qraw: list = list(sdoc.get("questions") or [])
    if qraw and not _is_legacy_quiz_batch(qraw):
        o = _open_question_row(qraw)
        if o is not None and (sdoc.get("status") in ("quiz", "watching") or sdoc.get("status") is None):
            cur_step = 0
            for j, r in enumerate(qraw, start=1):
                if isinstance(r, dict) and r.get("id") == o.get("id"):
                    cur_step = j
                    break
            if cur_step == 0:
                cur_step = 1
            return MlQuizStepOut(
                question=_storage_row_public_out(o),
                done=False,
                current_step=cur_step,
                total_steps=QUIZ_STEPS,
                report="",
                knowledge_level="",
                seconds_watched=float(sdoc.get("seconds_watched") or 0),
                assessment=None,
            )

    _require_video_watch_before_new_ml_quiz(sdoc)

    vcat = _ml_category_typed(vdoc)
    first = await _ml_gen_first_question_row(script, expl, str(vdoc.get("title", "") or ""), vcat)
    new_row: list = [dict(first)]
    await db.ml_learning_sessions.update_one(
        {"_id": sid},
        {
            "$set": {
                "questions": new_row,
                "status": "quiz",
                "updated_at": _iso_utc(),
            }
        },
    )
    return MlQuizStepOut(
        question=_storage_row_public_out(first),
        done=False,
        current_step=1,
        total_steps=QUIZ_STEPS,
        report="",
        knowledge_level="",
        seconds_watched=float(sdoc.get("seconds_watched") or 0),
        assessment=None,
    )


# --- Admin CRUD + log ---


@admin_router.get("/ml-belajar-topics", response_model=MlBelajarTopicsAdminOut)
async def admin_get_belajar_topics_config(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    extra = await _load_extra_belajar_slugs(db)
    return MlBelajarTopicsAdminOut(
        topics=_all_belajar_topic_items(extra),
        extra_slugs=list(extra),
    )


@admin_router.put("/ml-belajar-topics", response_model=MlBelajarTopicsAdminOut)
async def admin_put_belajar_topics_config(
    body: MlBelajarExtraSlugsIn, _admin: str = Depends(require_content_admin)
):
    _ = _admin
    db = get_db()
    extra = await _save_extra_belajar_slugs(db, body.extra_slugs)
    return MlBelajarTopicsAdminOut(
        topics=_all_belajar_topic_items(extra),
        extra_slugs=list(extra),
    )


@admin_router.get("/ml-videos", response_model=list[MlVideoOut])
async def admin_list_videos(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    cur = db.ml_videos.find({}).sort("sort_order", 1)
    docs = await cur.to_list(300)
    return [_video_out(d) for d in docs]


@admin_router.post("/ml-videos", response_model=MlVideoOut, status_code=status.HTTP_201_CREATED)
async def admin_create_video(body: MlVideoCreate, _admin: str = Depends(require_content_admin)):
    _ = _admin
    yid = parse_youtube_id(body.youtube_url)
    if not yid:
        raise HTTPException(status_code=400, detail="Bukan URL / ID YouTube yang valid")
    cat = _ml_category(body.category)
    bt = ""
    if cat == "belajar_plus":
        bt = _normalize_belajar_topic_slug(body.belajar_topic)
    doc = {
        "title": body.title.strip(),
        "description": (body.description or "").strip(),
        "youtube_url": body.youtube_url.strip(),
        "youtube_id": yid,
        "video_script": (body.video_script or "").strip(),
        "explanation": (body.explanation or "").strip(),
        "sort_order": int(body.sort_order),
        "published": bool(body.published),
        "category": cat,
        "belajar_topic": bt,
    }
    db = get_db()
    res = await db.ml_videos.insert_one(doc)
    created = await db.ml_videos.find_one({"_id": res.inserted_id})
    assert created is not None
    return _video_out(created)


@admin_router.put("/ml-videos/{video_id}", response_model=MlVideoOut)
async def admin_update_video(
    video_id: str, body: MlVideoUpdate, _admin: str = Depends(require_content_admin)
):
    _ = _admin
    oid = _oid(video_id)
    db = get_db()
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if "youtube_url" in patch and patch["youtube_url"] is not None:
        yu = str(patch["youtube_url"]).strip()
        yid = parse_youtube_id(yu)
        if not yid:
            raise HTTPException(status_code=400, detail="Bukan URL / ID YouTube yang valid")
        patch["youtube_url"] = yu
        patch["youtube_id"] = yid
    if "category" in patch and patch["category"] is not None:
        patch["category"] = _ml_category(patch["category"])
    ex_pre: dict | None = None
    if "belajar_topic" in patch or "category" in patch:
        ex_pre = await db.ml_videos.find_one({"_id": oid})
    if "belajar_topic" in patch:
        raw_bt = patch.get("belajar_topic")
        if patch.get("category") is not None:
            cat_now = _ml_category(patch["category"])
        else:
            cat_now = _ml_category((ex_pre or {}).get("category"))
        if cat_now == "belajar_plus":
            patch["belajar_topic"] = _normalize_belajar_topic_slug(str(raw_bt or ""))
        else:
            patch["belajar_topic"] = ""
    elif patch.get("category") is not None and _ml_category(patch["category"]) != "belajar_plus":
        patch["belajar_topic"] = ""
    for k in ("title", "description", "video_script", "explanation"):
        if k in patch and patch[k] is not None and isinstance(patch[k], str):
            patch[k] = patch[k].strip()
    if not patch:
        ex = await db.ml_videos.find_one({"_id": oid})
        if not ex:
            raise HTTPException(status_code=404, detail="Tidak ditemukan")
        return _video_out(ex)
    r = await db.ml_videos.update_one({"_id": oid}, {"$set": patch})
    if r.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    u = await db.ml_videos.find_one({"_id": oid})
    assert u is not None
    return _video_out(u)


@admin_router.delete("/ml-videos/{video_id}", status_code=status.HTTP_204_NO_CONTENT)
async def admin_delete_video(video_id: str, _admin: str = Depends(require_content_admin)):
    _ = _admin
    oid = _oid(video_id)
    db = get_db()
    r = await db.ml_videos.delete_one({"_id": oid})
    if r.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    await db.ml_learning_sessions.delete_many({"video_id": oid})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@admin_router.get("/ml-sessions", response_model=list[MlSessionLogRow])
async def admin_list_ml_sessions(
    video_id: str | None = Query(None, description="Filter berdasarkan video (ObjectId)"),
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    db = get_db()
    q: dict = {}
    if video_id and str(video_id).strip():
        q["video_id"] = _oid(str(video_id).strip())
    cur = (
        db.ml_learning_sessions.find(q)
        .sort("created_at", -1)
        .limit(300)
    )
    docs = await cur.to_list(300)
    vcache: dict[str, str] = {}
    rows: list[MlSessionLogRow] = []
    for d in docs:
        vid = d.get("video_id")
        vid_s = str(vid) if vid else ""
        vtitle = ""
        if isinstance(vid, ObjectId):
            if vid_s not in vcache:
                vdoc = await db.ml_videos.find_one({"_id": vid})
                vcache[vid_s] = (vdoc or {}).get("title", "(video)") or "(video)"
            vtitle = vcache.get(vid_s, "(video)")
        rows.append(
            MlSessionLogRow(
                id=str(d["_id"]),
                username=str(d.get("username", "")),
                video_id=vid_s,
                video_title=vtitle,
                created_at=str(d.get("created_at", "")),
                seconds_watched=float(d.get("seconds_watched") or 0),
                knowledge_level=str(d.get("knowledge_level", "") or ""),
                report=str(d.get("report", "") or "")[:2000],
                status=str(d.get("status", "")),
            )
        )
    return rows
