"""
Simulasi & verifikasi integrasi:
- norm = c × b / 6, Indeks KA = mean(norm) × 100, IKS = Indeks KA (LIPI-lite)
- bloom_avg = Σ(c×b)/Σ(c); margin 95% dari variansi norm
- distribusi Bloom → b = Σ k·P(k)
- kategori tampilan dari tingkat pemahaman bila diberi knowledge_level; else fallback IKS
- perencana Bloom: tag & instruksi per langkah
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

# root: .../backend
_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.ml_assessment_scoring import (  # noqa: E402
    MAX_BLOOM,
    bloom_avg_from_cb,
    bloom_expected_from_distribution,
    build_assessment_from_scores,
    fallback_assessment_from_level,
    indeks_parameter_pct,
    iks_95ci_margin_from_norms,
    norm_score,
    readiness_category,
)
from app.ml_bloom_planner import (  # noqa: E402
    C3_ADEQUATE_P_MIN,
    bloom_instruction_for_q1,
    bloom_instruction_for_step,
    short_bloom_tag,
)


def _assert_close(a: float, b: float, eps: float = 0.02, msg: str = "") -> None:
    if abs(a - b) > eps:
        raise AssertionError(f"{msg}: {a} vs {b}")


def test_norm_and_indeks_manual() -> None:
    # Spec: raw = c*b, norm = raw/6 = c*b/6
    c, b = 1.0, 2.0
    n = norm_score(c, b)
    _assert_close(n, (1.0 * 2.0) / MAX_BLOOM, msg="norm")
    # Empat soal identik -> indeks = norm*100
    norms = [n, n, n, n]
    idx = indeks_parameter_pct(norms)
    _assert_close(idx, n * 100.0, msg="indeks vs mean norm*100")


def test_user_example_five_items_35pct() -> None:
    """Contoh dokumen: N=5 → Indeks_KA = 35%."""
    scored = [
        {"question_id": "q1", "p_correct": 1.0, "bloom_level": 2},
        {"question_id": "q2", "p_correct": 1.0, "bloom_level": 3},
        {"question_id": "q3", "p_correct": 0.5, "bloom_level": 3},
        {"question_id": "q4", "p_correct": 1.0, "bloom_level": 4},
        {"question_id": "q5", "p_correct": 0.0, "bloom_level": 1},
    ]
    r = build_assessment_from_scores(
        scored=scored,
        video_category="belajar_plus",
        belajar_topic="kebakaran",
        knowledge_level="sedang",
    )
    _assert_close(r.indeks_ka_pct, 35.0, eps=0.05, msg="Indeks KA")
    _assert_close(r.iks_bencana_pct, r.indeks_ka_pct, eps=0.001, msg="IKS = KA")
    # Bloom weighted: (2+3+1.5+4+0)/(1+1+0.5+1+0) = 10.5/3.5 = 3.0
    _assert_close(r.bloom_avg, 3.0, eps=0.01, msg="bloom_avg")
    assert r.readiness_key == "pemahaman_sedang"
    assert r.disaster_label == "Kebakaran"


def test_four_items_app_quiz_steps() -> None:
    """Empat soal seperti QUIZ_STEPS=4."""
    scored = [
        {"question_id": "q1", "p_correct": 0.9, "bloom_level": 2},
        {"question_id": "q2", "p_correct": 0.8, "bloom_level": 2},
        {"question_id": "q3", "p_correct": 0.7, "bloom_level": 3},
        {"question_id": "q4", "p_correct": 0.85, "bloom_level": 4},
    ]
    r = build_assessment_from_scores(
        scored=scored,
        video_category="asesmen_ai",
        belajar_topic="",
        knowledge_level="tinggi",
    )
    assert r.iks_bencana_pct == r.indeks_ka_pct
    assert r.iks_margin_95_pct >= 0.0
    # Manual bloom_avg
    pairs = [(0.9, 2), (0.8, 2), (0.7, 3), (0.85, 4)]
    manual_b = sum(c * b for c, b in pairs) / sum(c for c, _ in pairs)
    _assert_close(r.bloom_avg, manual_b, eps=0.01, msg="bloom")


def test_bloom_distribution_expected() -> None:
    d = {"1": 0.0, "2": 0.5, "3": 0.5, "4": 0.0, "5": 0.0, "6": 0.0}
    b = bloom_expected_from_distribution(d)
    _assert_close(b, 2.5, eps=0.001, msg="distribution b")
    r = build_assessment_from_scores(
        scored=[
            {
                "question_id": "q1",
                "p_correct": 1.0,
                "bloom_distribution": d,
            }
        ],
        video_category="asesmen_ai",
        belajar_topic="",
    )
    _assert_close(r.per_item[0]["bloom_level"], 2.5, eps=0.02, msg="stored b")


def test_readiness_buckets() -> None:
    assert readiness_category(100.0)[1] == "sangat_siap"
    assert readiness_category(79.9)[1] == "siap"
    assert readiness_category(40.0)[1] == "hampir_siap"
    assert readiness_category(19.9)[1] == "belum_siap"


def test_fallback_chain() -> None:
    r = fallback_assessment_from_level("sedang", 4, "asesmen_ai", "")
    assert len(r.per_item) == 4
    assert r.indeks_ka_pct > 0
    assert r.readiness_key == "pemahaman_sedang"


def test_bloom_planner_tags() -> None:
    assert short_bloom_tag("asesmen_ai", 1, None) == "C1-2"
    assert short_bloom_tag("asesmen_ai", 4, True) == "C3-4"
    assert short_bloom_tag("asesmen_ai", 4, False) == "C1-3-rem"
    assert short_bloom_tag("belajar_plus", 4, None) == "C3-4"
    for cat in ("asesmen_ai", "belajar_plus"):
        assert len(bloom_instruction_for_q1(cat)) > 20
    assert "C3" in bloom_instruction_for_step("asesmen_ai", 3)
    assert "C3" in bloom_instruction_for_step("belajar_plus", 4)


def test_margin_formula_matches_manual() -> None:
    norms = [0.2, 0.3, 0.4, 0.25]
    m = sum(norms) / len(norms)
    var = sum((x - m) ** 2 for x in norms) / (len(norms) - 1)
    se = math.sqrt(var / len(norms))
    manual_margin = round(1.96 * se * 100, 1)
    _assert_close(iks_95ci_margin_from_norms(norms), manual_margin, eps=0.001, msg="margin")


def test_c3_threshold_constant() -> None:
    assert C3_ADEQUATE_P_MIN == 0.60


def test_prompt_waktu_asesmen_anti_menyontek() -> None:
    """Semua soal: larangan waktu + format PG seragam (tanpa rentang evaluasi)."""
    from siaga_common.assessment_prompts import (
        ML_PROMPT_SOAL_PG_SERAGAM,
        ML_PROMPT_TANPA_RUJUK_WAKTU,
    )

    assert "DILARANG" in ML_PROMPT_TANPA_RUJUK_WAKTU
    assert "0:50" in ML_PROMPT_TANPA_RUJUK_WAKTU
    assert "pilihan ganda" in ML_PROMPT_SOAL_PG_SERAGAM.lower()
    assert "analisis" in ML_PROMPT_SOAL_PG_SERAGAM.lower()


def run_all() -> None:
    test_norm_and_indeks_manual()
    test_user_example_five_items_35pct()
    test_four_items_app_quiz_steps()
    test_bloom_distribution_expected()
    test_readiness_buckets()
    test_fallback_chain()
    test_bloom_planner_tags()
    test_margin_formula_matches_manual()
    test_c3_threshold_constant()
    test_prompt_waktu_asesmen_anti_menyontek()
    print("OK: semua simulasi rumus & Bloom passed.")


if __name__ == "__main__":
    run_all()
