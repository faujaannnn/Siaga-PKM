"""
Skor asesmen LIPI-lite: kebenaran × Bloom, Indeks KA, IKS per bencana, rata-rata Bloom.

Materi dasar (video Kemenkes / asesmen_ai): hanya parameter Pengetahuan & Sikap (KA) yang dinilai;
parameter LIPI lain ditandai belum dinilai hingga ada soal/materi tambahan.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any

MAX_BLOOM = 6.0

def clip_c(c: float) -> float:
    return max(0.0, min(1.0, float(c)))


def clip_b(b: float) -> float:
    return max(1.0, min(6.0, float(b)))


def p_correct_confidence_band(p: float) -> str:
    """
    Pita kepercayaan (sesuai catatan: ≥0,8 yakin; 0,6–0,79 sebagian; <0,6 lemah).
    """
    x = clip_c(p)
    if x >= 0.80:
        return "high"
    if x >= 0.60:
        return "partial"
    return "low"


def band_from_c(c: float) -> str:
    """Jika p_correct tidak tersedia, taksir dari c."""
    return p_correct_confidence_band(c)


def bloom_expected_from_distribution(d: object) -> float | None:
    """
    b = Σ level × P(level) untuk P pada level 1..6. Kunci: int/str 1-6; nilai probabilitas.
    """
    if not isinstance(d, dict) or not d:
        return None
    s = 0.0
    w = 0.0
    for k, v in d.items():
        try:
            level = int(float(str(k).replace('"', "")))
        except (TypeError, ValueError):
            continue
        if level < 1 or level > 6:
            continue
        try:
            pv = float(v)
        except (TypeError, ValueError):
            continue
        s += level * max(0.0, min(1.0, pv))
        w += max(0.0, min(1.0, pv))
    if w <= 1e-6:
        return None
    return s / w


def norm_score(c: float, b: float) -> float:
    return (clip_c(c) * clip_b(b)) / MAX_BLOOM


def indeks_parameter_pct(norm_scores: list[float], weights: list[float] | None = None) -> float:
    """Indeks_parameter (%) dari daftar norm_score dalam [0,1]."""
    if not norm_scores:
        return 0.0
    if weights and len(weights) == len(norm_scores):
        wsum = sum(weights)
        if wsum <= 0:
            return 0.0
        return (sum(w * n for w, n in zip(weights, norm_scores)) / wsum) * 100.0
    return (sum(norm_scores) / len(norm_scores)) * 100.0


def bloom_avg_from_cb(pairs: list[tuple[float, float]]) -> float:
    """bloom_avg = Σ(c_i × b_i) / Σ(c_i); jika Σ c = 0, rata sederhana b_i."""
    if not pairs:
        return 0.0
    sc = sum(c for c, _ in pairs)
    if sc <= 0:
        return sum(b for _, b in pairs) / len(pairs)
    return sum(c * b for c, b in pairs) / sc


def bloom_depth_label(avg: float) -> tuple[str, str]:
    """
    Label tampilan & kunci internal (skala 1–6).
    (teks, key)
    """
    a = float(avg)
    if a < 2.0:
        return "Novice (ingatan)", "novice"
    if a < 3.0:
        return "Learner (pemahaman)", "learner"
    if a < 4.0:
        return "Practitioner (aplikasi)", "practitioner"
    if a < 5.0:
        return "Analyst (analisis)", "analyst"
    if a < 6.0:
        return "Evaluator (evaluasi)", "evaluator"
    return "Creator (kreasi)", "creator"


def readiness_category(iks: float) -> tuple[str, str]:
    """(label_id, kunci) — kategori profil 0–100."""
    x = max(0.0, min(100.0, float(iks)))
    if x >= 80.0:
        return "Sangat Siap", "sangat_siap"
    if x >= 60.0:
        return "Siap", "siap"
    if x >= 40.0:
        return "Hampir Siap", "hampir_siap"
    if x >= 20.0:
        return "Kurang Siap", "kurang_siap"
    return "Belum Siap", "belum_siap"


def one_line_recommendation(key: str) -> str:
    m: dict[str, str] = {
        "sangat_siap": "Pertahankan kompetensi: bagikan poin kunci ke rekan sejawat.",
        "siap": "Lanjutkan praktik lapangan singkat & review prosedur setiap 3 bulan.",
        "hampir_siap": "Fokus pada satu skenario bencana: latih SOP kritis dan tanya jawab tim.",
        "kurang_siap": "Tonton ulang modul terkait, lalu uji diri dengan skenario sederhana.",
        "belum_siap": "Mulai dari materi dasar: pahami tanda bahaya, jalur evakuasi, dan peran layanan kesehatan atau koordinator setempat.",
        "pemahaman_tinggi": "Pertahankan: diskusikan singkat poin kunci dengan rekan, lalu coba simulasi ringan bila tersedia.",
        "pemahaman_sedang": "Lanjutkan: ulang bagian naskah yang belum tuntas, lalu satu tindakan kecil di lingkungan Anda (RT, sekolah, atau fasilitas kesehatan).",
        "pemahaman_rendah": "Tonton kembali modul, catat 3 poin, lalu uji diri menulis 2 kalimat penerapan.",
    }
    return m.get(
        key,
        m.get("pemahaman_sedang", m["kurang_siap"]),
    )


def pemahaman_tier_key(level: str) -> str:
    """Kunci kategori (bukan IKS) dari knowledge_level model."""
    t = (level or "").lower()
    if "tinggi" in t:
        return "pemahaman_tinggi"
    if "rendah" in t:
        return "pemahaman_rendah"
    return "pemahaman_sedang"


def readiness_label_from_knowledge_level(level: str) -> str:
    """Label tampilan: kesiapan = tingkat pemahaman (hanya asesmen KA / LIPI-lite)."""
    t = (level or "").lower()
    if "tinggi" in t:
        return "Kesiapan pemahaman: baik"
    if "rendah" in t:
        return "Kesiapan pemahaman: perlu penguatan"
    return "Kesiapan pemahaman: sedang"


@dataclass
class LipiLiteResult:
    indeks_ka_pct: float
    iks_bencana_pct: float
    iks_margin_95_pct: float
    bloom_avg: float
    bloom_label: str
    bloom_key: str
    readiness_label: str
    readiness_key: str
    recommendation: str
    lipi_lite: bool
    disaster_slug: str
    disaster_label: str
    per_item: list[dict[str, Any]]


def iks_95ci_margin_from_norms(norms: list[float]) -> float:
    """
    Margin sekitar Indeks (%% poin) dari SE rata-rata skor ternormalisasi (aproksimasi 95%%).
    Indeks = mean(norms) × 100; margin ≈ 1.96 × SE(mean of norms) × 100.
    """
    n = len(norms)
    if n < 2:
        return 0.0
    m = sum(norms) / n
    var = sum((x - m) ** 2 for x in norms) / (n - 1)
    se_mean = math.sqrt(var / n)
    return round(1.96 * se_mean * 100, 1)


def default_disaster_label(slug: str) -> str:
    t = (slug or "").strip().lower()
    defaults = {
        "banjir": "Banjir",
        "gempa_bumi": "Gempa bumi",
        "tanah_longsor": "Tanah longsor",
    }
    if t in defaults:
        return defaults[t]
    if not t:
        return ""
    return t.replace("_", " ").title()


def build_assessment_from_scores(
    *,
    scored: list[dict[str, Any]],
    video_category: str,
    belajar_topic: str,
    knowledge_level: str | None = None,
) -> LipiLiteResult:
    """
    scored: minimal question_id; p_correct (utama) atau correctness_score sebagai c; bloom_level
    atau bloom_distribution (P level 1-6) untuk b = Σ k·P(k); tambahan: rationale, feedback_educatif, dll.
    Hanya soal KA (asesmen saat ini) — parameter lain 'belum dinilai' di response terpisah.
    """
    pairs: list[tuple[float, float]] = []
    norms: list[float] = []
    per_item: list[dict[str, Any]] = []
    for row in scored:
        if not isinstance(row, dict):
            continue
        qid = str(row.get("question_id", "") or row.get("id", "") or "").strip()
        raw_p = row.get("p_correct")
        raw_c = row.get("correctness_score", row.get("c"))
        p_val: float | None = None
        if raw_p is not None:
            try:
                c = clip_c(float(raw_p))
                p_val = c
            except (TypeError, ValueError):
                c = 0.5
        elif raw_c is not None:
            try:
                c = clip_c(float(raw_c))
            except (TypeError, ValueError):
                c = 0.5
        else:
            c = 0.5
        b_dist = row.get("bloom_distribution") or row.get("P_bloom")
        b_from_d = bloom_expected_from_distribution(b_dist) if b_dist is not None else None
        raw_b = row.get("bloom_level", row.get("b"))
        if b_from_d is not None:
            b = clip_b(b_from_d)
        elif raw_b is not None:
            try:
                b = clip_b(float(raw_b))
            except (TypeError, ValueError):
                b = 2.0
        else:
            b = 2.0
        band = p_correct_confidence_band(p_val) if p_val is not None else band_from_c(c)
        n = norm_score(c, b)
        norms.append(n)
        pairs.append((c, b))
        item: dict[str, Any] = {
            "question_id": qid,
            "p_correct": round(p_val, 4) if p_val is not None else None,
            "correctness_score": c,
            "confidence_band": band,
            "bloom_level": b,
            "norm_score": round(n, 4),
        }
        if isinstance(b_dist, dict) and b_dist:
            item["bloom_distribution"] = b_dist
        for key in (
            "rationale",
            "feedback_educatif",
            "expected_answer_summary",
        ):
            v = row.get(key)
            if v is not None and str(v).strip():
                item[key] = str(v).strip()[:4000]
        per_item.append(item)

    ka_pct = indeks_parameter_pct(norms) if norms else 0.0
    margin = iks_95ci_margin_from_norms(norms) if norms else 0.0
    # Hanya KA: indeks numerik = IKS tampilan (satu skor, tanpa parameter RD/SP/MS)
    iks = ka_pct
    b_avg = bloom_avg_from_cb(pairs) if pairs else 0.0
    b_label, b_key = bloom_depth_label(b_avg)
    if (knowledge_level or "").strip():
        r_key = pemahaman_tier_key(knowledge_level)
        r_label = readiness_label_from_knowledge_level(knowledge_level)
    else:
        r_label, r_key = readiness_category(iks)
    rec = one_line_recommendation(r_key)
    cat = (video_category or "asesmen_ai").strip()
    # Topik/bencana dari video (slug) — dipakai di semua kategori bila diisi (tidak hanya belajar_plus)
    dslug = (belajar_topic or "").strip()
    dlabel = default_disaster_label(dslug) if dslug else ("Materi standar" if cat == "asesmen_ai" else "")

    return LipiLiteResult(
        indeks_ka_pct=round(ka_pct, 2),
        iks_bencana_pct=round(iks, 2),
        iks_margin_95_pct=margin,
        bloom_avg=round(b_avg, 2),
        bloom_label=b_label,
        bloom_key=b_key,
        readiness_label=r_label,
        readiness_key=r_key,
        recommendation=rec,
        lipi_lite=True,
        disaster_slug=dslug,
        disaster_label=dlabel,
        per_item=per_item,
    )


def fallback_assessment_from_level(
    knowledge_level: str, n: int, video_category: str, belajar_topic: str
) -> LipiLiteResult:
    """Jika skor per jawaban tidak tersedia: perkiraan kasar dari rendah|sedang|tinggi + Bloom tengah."""
    t = (knowledge_level or "").lower()
    if "tinggi" in t:
        c = 0.85
    elif "rendah" in t:
        c = 0.35
    else:
        c = 0.6
    b = 2.5
    n = max(1, int(n or 1))
    fake = [{"question_id": f"q{i}", "correctness_score": c, "bloom_level": b} for i in range(1, n + 1)]
    return build_assessment_from_scores(
        scored=fake,
        video_category=video_category,
        belajar_topic=belajar_topic,
        knowledge_level=knowledge_level,
    )
