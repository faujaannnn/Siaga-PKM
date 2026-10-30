"""
Profil asesmen petugas/staff untuk asisten AI: video ML, PDF ML, Kuis LIPI.
Digunakan WA Fonnte dan endpoint /staff/ml-understanding.
"""

from __future__ import annotations

import re
from typing import Any, cast

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.schemas import (
    MlAssessmentSummaryOut,
    MlGradingItemOut,
    MlLipiParameterOut,
    MlRemedialItemOut,
    MlStaffUnderstandingOut,
    MlVideoCategory,
)
from app.youtube_id import parse_youtube_id

_ML_CATS = frozenset({"asesmen_ai", "belajar_plus"})


def _clip(s: str, n: int) -> str:
    t = re.sub(r"\s+", " ", (s or "").strip())
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


def _ml_video_category(raw: object) -> MlVideoCategory:
    s = str(raw or "asesmen_ai").strip()
    c = s if s in _ML_CATS else "asesmen_ai"
    return cast(MlVideoCategory, c)


def assessment_from_stored(doc: object) -> MlAssessmentSummaryOut | None:
    if not isinstance(doc, dict) or not doc:
        return None
    try:
        params_raw = doc.get("parameters") or []
        params = [MlLipiParameterOut(**p) for p in params_raw if isinstance(p, dict)]
        per_ans: list[MlGradingItemOut] = []
        for p in doc.get("per_item") or []:
            if not isinstance(p, dict):
                continue
            bd = p.get("bloom_distribution")
            if bd is not None and not isinstance(bd, dict):
                bd = None
            try:
                per_ans.append(
                    MlGradingItemOut(
                        question_id=str(p.get("question_id", "") or ""),
                        p_correct=p.get("p_correct"),
                        correctness_score=float(p.get("correctness_score", 0) or 0),
                        confidence_band=str(p.get("confidence_band", "") or ""),
                        bloom_level=float(p.get("bloom_level", 0) or 0),
                        norm_score=float(p.get("norm_score", 0) or 0),
                        rationale=str(p.get("rationale", "") or ""),
                        feedback_educatif=str(p.get("feedback_educatif", "") or ""),
                        expected_answer_summary=str(p.get("expected_answer_summary", "") or ""),
                        bloom_distribution=bd,
                    )
                )
            except Exception:
                continue
        return MlAssessmentSummaryOut(
            indeks_ka_pct=float(doc.get("indeks_ka_pct", 0) or 0),
            iks_bencana_pct=float(doc.get("iks_bencana_pct", 0) or 0),
            iks_margin_95_pct=float(doc.get("iks_margin_95_pct", 0) or 0),
            bloom_avg=float(doc.get("bloom_avg", 0) or 0),
            bloom_label=str(doc.get("bloom_label", "") or ""),
            readiness_label=str(doc.get("readiness_label", "") or ""),
            readiness_key=str(doc.get("readiness_key", "") or ""),
            recommendation=str(doc.get("recommendation", "") or ""),
            lipi_lite=bool(doc.get("lipi_lite", True)),
            disaster_slug=str(doc.get("disaster_slug", "") or ""),
            disaster_label=str(doc.get("disaster_label", "") or ""),
            parameters=params,
            per_answer=per_ans,
            note=str(
                doc.get("note", "")
                or "Indeks KA saja; kategori dari tingkat pemahaman (rendah/sedang/tinggi)."
            ),
        )
    except Exception:
        return None


def remedial_items_from_session(raw: object) -> list[MlRemedialItemOut]:
    if not isinstance(raw, list):
        return []
    out: list[MlRemedialItemOut] = []
    for r in raw:
        if not isinstance(r, dict):
            continue
        try:
            out.append(
                MlRemedialItemOut(
                    question_id=str(r.get("question_id", "") or ""),
                    question=str(r.get("question", "") or ""),
                    user_answer=str(r.get("user_answer", "") or ""),
                )
            )
        except Exception:
            continue
    return out


def _format_assessment_metrics(asum: MlAssessmentSummaryOut | None) -> str:
    if not asum:
        return "Metrik LIPI-lite: belum tersimpan."
    parts = [
        f"Indeks KA {asum.indeks_ka_pct:.0f}%",
        f"IKS bencana {asum.iks_bencana_pct:.0f}% (±{asum.iks_margin_95_pct:.0f} poin)",
        f"Bloom rata {asum.bloom_avg:.1f} ({asum.bloom_label or '-'})",
        f"Kesiapan: {asum.readiness_label or '-'}",
    ]
    if asum.disaster_label:
        parts.append(f"Topik: {asum.disaster_label}")
    if asum.recommendation.strip():
        parts.append(f"Saran: {_clip(asum.recommendation, 280)}")
    return " · ".join(parts)


def _format_per_answer_lines(asum: MlAssessmentSummaryOut | None, remedial: list[MlRemedialItemOut]) -> list[str]:
    lines: list[str] = []
    remedial_by_id = {r.question_id: r for r in remedial if r.question_id}
    if asum and asum.per_answer:
        for g in asum.per_answer[:8]:
            qid = g.question_id or "?"
            pct = (
                f"{int(round(float(g.p_correct) * 100))}% benar"
                if g.p_correct is not None
                else f"skor {g.correctness_score:.0%}"
            )
            fb = _clip(g.feedback_educatif or g.rationale, 120)
            rem = remedial_by_id.get(qid)
            qtext = _clip(rem.question, 80) if rem and rem.question else ""
            line = f"  - {qid}: {pct}, Bloom {g.bloom_level:.1f}"
            if qtext:
                line += f" · «{qtext}»"
            if fb:
                line += f" · {fb}"
            lines.append(line)
    elif remedial:
        for r in remedial[:6]:
            lines.append(f"  - {r.question_id}: {_clip(r.question, 70)} → {_clip(r.user_answer, 90)}")
    return lines


def _format_session_block(
    *,
    source: str,
    title: str,
    category: str,
    knowledge_level: str,
    report: str,
    completed_at: str,
    engagement_label: str,
    engagement_sec: float,
    asum: MlAssessmentSummaryOut | None,
    remedial: list[MlRemedialItemOut],
) -> str:
    head = f"[{source.upper()}] {title} ({category}) · tingkat {knowledge_level or '-'}"
    meta = f"Selesai: {completed_at[:19] if completed_at else '-'} · {engagement_label}: ~{int(engagement_sec // 60)}m"
    body = [
        head,
        meta,
        _format_assessment_metrics(asum),
    ]
    if report.strip():
        body.append(f"Laporan naratif: {_clip(report, 420)}")
    pa = _format_per_answer_lines(asum, remedial)
    if pa:
        body.append("Detail per soal:")
        body.extend(pa)
    return "\n".join(body)


def _format_lipi_block(doc: dict[str, Any]) -> str:
    sub = doc.get("submitted_at")
    sub_s = sub.isoformat()[:19] if hasattr(sub, "isoformat") else str(sub or "")[:19]
    pg_score = doc.get("pengetahuan_score", doc.get("kap_score", 0))
    pg_earned = doc.get("pengetahuan_earned")
    pg_max = doc.get("pengetahuan_max", 8)
    earned_s = (
        f" ({pg_earned}/{pg_max} benar)"
        if pg_earned is not None
        else ""
    )
    lines = [
        f"[KUESIONER GEMPA] Pengetahuan {pg_score}% · {doc.get('pengetahuan_level', doc.get('level', '-'))}{earned_s} · {sub_s}",
    ]
    if doc.get("ed_scored"):
        lines.append(
            f"Efikasi diri: {doc.get('efikasi_diri_score', '-')}/40 "
            f"({doc.get('efikasi_diri_level', '-')})"
        )
    if doc.get("sk_scored"):
        lines.append(
            f"Sikap: {doc.get('sikap_score', '-')}% ({doc.get('sikap_level', '-')})"
        )
    if doc.get("td_scored") or doc.get("tindakan_score") is not None:
        lines.append(
            f"Tindakan: {doc.get('tindakan_score', '-')}% ({doc.get('tindakan_level', '-')})"
        )
    rec = str(doc.get("ai_recommendation") or "").strip()
    if rec:
        lines.append(f"Rekomendasi AI: {_clip(rec, 320)}")
    weak = doc.get("sections_to_review") or []
    if isinstance(weak, list) and weak:
        bits = []
        for w in weak[:4]:
            if isinstance(w, dict):
                unit = w.get("score_unit", "pct")
                sc = w.get("score", "?")
                if unit == "ed_scale":
                    bits.append(f"{w.get('label', w.get('category', '?'))} ({sc}/40)")
                else:
                    bits.append(f"{w.get('label', w.get('category', '?'))} ({sc}%)")
        if bits:
            lines.append("Bagian perlu diulang: " + "; ".join(bits))
    wrong = doc.get("wrong_items") or []
    if isinstance(wrong, list) and wrong:
        wlines = []
        for w in wrong[:8]:
            if isinstance(w, dict):
                sub = _clip(str(w.get("sub_text") or w.get("question") or w.get("id") or ""), 60)
                ya = w.get("your_answer", "")
                ca = w.get("correct_answer", "")
                if sub:
                    wlines.append(f"{sub} (Anda: {ya}, kunci: {ca})")
        if wlines:
            lines.append("Jawaban pengetahuan belum tepat: " + " | ".join(wlines))
    return "\n".join(lines)


async def load_staff_understanding_rows(
    db: AsyncIOMotorDatabase,
    username: str,
    *,
    limit: int = 80,
) -> list[MlStaffUnderstandingOut]:
    """Muat baris asesmen video + PDF (sama data dengan tab Profil)."""
    cur = (
        db.ml_learning_sessions.find({"username": username, "status": "done"})
        .sort("updated_at", -1)
        .limit(limit)
    )
    docs = await cur.to_list(limit)
    oids: list[ObjectId] = []
    for d in docs:
        vid = d.get("video_id")
        if isinstance(vid, ObjectId):
            oids.append(vid)
    vmap: dict[str, dict] = {}
    if oids:
        for v in await db.ml_videos.find({"_id": {"$in": oids}}).to_list(300):
            vmap[str(v["_id"])] = v
    out: list[MlStaffUnderstandingOut] = []
    for d in docs:
        sid = str(d.get("_id", ""))
        vid = d.get("video_id")
        vid_s = str(vid) if isinstance(vid, ObjectId) else ""
        vdoc = vmap.get(vid_s) if vid_s else None
        title = str((vdoc or {}).get("title", "")) or "(Video)"
        cat = _ml_video_category((vdoc or {}).get("category"))
        klev = str(d.get("knowledge_level", "") or "").strip() or "-"
        rep = str(d.get("report", "") or "").strip()
        done_at = str(d.get("updated_at") or d.get("created_at", "") or "")
        asum = assessment_from_stored(d.get("assessment_summary"))
        remedial = remedial_items_from_session(d.get("remedial_items"))
        yt_url = str((vdoc or {}).get("youtube_url", "") or "")
        yt_id = parse_youtube_id(yt_url) or ""
        out.append(
            MlStaffUnderstandingOut(
                session_id=sid,
                video_id=vid_s,
                video_title=title,
                category=cat,
                knowledge_level=klev,
                report=rep,
                completed_at=done_at,
                seconds_watched=float(d.get("seconds_watched") or 0),
                assessment=asum,
                remedial_items=remedial,
                youtube_id=yt_id,
                source="video",
                drive_url="",
            )
        )

    cur_p = (
        db.ml_pdf_learning_sessions.find({"username": username, "status": "done"})
        .sort("updated_at", -1)
        .limit(limit)
    )
    p_docs = await cur_p.to_list(limit)
    poids: list[ObjectId] = []
    for d in p_docs:
        pid = d.get("pdf_id")
        if isinstance(pid, ObjectId):
            poids.append(pid)
    pmap: dict[str, dict] = {}
    if poids:
        for p in await db.ml_pdfs.find({"_id": {"$in": poids}}).to_list(200):
            pmap[str(p["_id"])] = p
    for d in p_docs:
        sid = str(d.get("_id", ""))
        pid = d.get("pdf_id")
        pid_s = str(pid) if isinstance(pid, ObjectId) else ""
        pdoc = pmap.get(pid_s) if pid_s else None
        title = str((pdoc or {}).get("title", "")) or "(PDF)"
        cat = _ml_video_category((pdoc or {}).get("category"))
        klev = str(d.get("knowledge_level", "") or "").strip() or "-"
        rep = str(d.get("report", "") or "").strip()
        done_at = str(d.get("updated_at") or d.get("created_at", "") or "")
        asum = assessment_from_stored(d.get("assessment_summary"))
        remedial = remedial_items_from_session(d.get("remedial_items"))
        out.append(
            MlStaffUnderstandingOut(
                session_id=sid,
                video_id=pid_s,
                video_title=title,
                category=cat,
                knowledge_level=klev,
                report=rep,
                completed_at=done_at,
                seconds_watched=float(d.get("seconds_pdf") or 0),
                assessment=asum,
                remedial_items=remedial,
                youtube_id="",
                source="pdf",
                drive_url=str((pdoc or {}).get("drive_url", "") or ""),
            )
        )

    out.sort(key=lambda r: r.completed_at, reverse=True)
    return out[:limit]


async def build_staff_assessment_context_text(
    db: AsyncIOMotorDatabase,
    username: str,
    *,
    limit: int = 12,
    lipi_limit: int = 3,
) -> str:
    """
    Teks profil asesmen pribadi untuk LLM: nilai IKS/KA, per-soal, LIPI, agregat singkat.
    """
    rows = await load_staff_understanding_rows(db, username, limit=limit)
    lipi_docs = (
        await db.lipi_quiz_sessions.find({"username": username})
        .sort("submitted_at", -1)
        .limit(lipi_limit)
        .to_list(lipi_limit)
    )

    if not rows and not lipi_docs:
        return (
            f"Pengguna «{username}» belum menyelesaikan asesmen video ML, PDF ML, atau Kuis LIPI. "
            "Jika ditanya nilai/progres, jelaskan bahwa data belum ada dan arahkan ke materi di situs."
        )

    iks_vals: list[float] = []
    ka_vals: list[float] = []
    mcq_ok = 0
    mcq_tot = 0
    for r in rows:
        a = r.assessment
        if not a:
            continue
        iks_vals.append(a.iks_bencana_pct)
        ka_vals.append(a.indeks_ka_pct)
        for g in a.per_answer:
            mcq_tot += 1
            p = g.p_correct
            if p is not None and float(p) >= 0.99:
                mcq_ok += 1
            elif p is None and float(g.correctness_score or 0) >= 0.99:
                mcq_ok += 1

    summary_lines = [f"Profil asesmen akun «{username}»:"]
    if rows:
        n_vid = sum(1 for r in rows if r.source == "video")
        n_pdf = sum(1 for r in rows if r.source == "pdf")
        summary_lines.append(f"- Selesai: {n_vid} video ML, {n_pdf} buku PDF ML.")
    if iks_vals:
        avg_iks = sum(iks_vals) / len(iks_vals)
        avg_ka = sum(ka_vals) / len(ka_vals) if ka_vals else 0
        summary_lines.append(
            f"- Rata-rata IKS bencana (LIPI-lite) dari asesmen ML: {avg_iks:.0f}% · Indeks KA rata {avg_ka:.0f}%."
        )
    if mcq_tot:
        summary_lines.append(
            f"- Proporsi jawaban benar (semua soal PG tercatat): {mcq_ok}/{mcq_tot} "
            f"({int(round(100 * mcq_ok / mcq_tot))}%)."
        )
    if lipi_docs:
        latest = lipi_docs[0]
        summary_lines.append(
            f"- Kuis LIPI terbaru: skor {latest.get('total_score', 0)} "
            f"({latest.get('level', '-')})."
        )

    blocks: list[str] = ["\n".join(summary_lines), "---- RINCIAN PER ASESMEN ----"]
    for r in rows[:limit]:
        eng = "tonton" if r.source == "video" else "baca"
        blocks.append(
            _format_session_block(
                source=r.source,
                title=r.video_title,
                category=r.category,
                knowledge_level=r.knowledge_level,
                report=r.report,
                completed_at=r.completed_at,
                engagement_label=eng,
                engagement_sec=r.seconds_watched,
                asum=r.assessment,
                remedial=r.remedial_items,
            )
        )
        blocks.append("")

    if lipi_docs:
        blocks.append("---- KUIZ LIPI (Indeks Kesiapsiagaan lengkap) ----")
        for doc in lipi_docs:
            blocks.append(_format_lipi_block(doc))
            blocks.append("")

    text = "\n".join(blocks).strip()
    max_chars = max(8000, int(settings.fonnte_staff_context_max_chars // 3))
    if len(text) > max_chars:
        text = text[: max_chars - 40] + "\n…[profil asesmen dipotong - prioritaskan entri teratas]"
    return text
