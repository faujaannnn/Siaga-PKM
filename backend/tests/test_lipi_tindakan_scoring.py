"""Interpretasi bagian tindakan kuesioner: skala 1=sangat setuju … 4=tidak setuju."""

from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.lipi_attempt import ATTEMPT_POST  # noqa: E402
from app.routers.lipi_quiz import (  # noqa: E402
    LIPI_QUESTIONS,
    _TD_RAW_MAX,
    _TD_RAW_MAX_POST,
    _likert_4_points,
    calculate_lipi_score,
)


def _base_answers() -> dict[str, str]:
    answers: dict[str, str] = {}
    for q in LIPI_QUESTIONS:
        if q["section"] == "pg":
            answers[q["id"]] = q["correct"]
        elif q["type"] == "likert_4":
            answers[q["id"]] = "3"
        else:
            answers[q["id"]] = "s"
    return answers


def test_likert_4_points_reversed() -> None:
    assert _likert_4_points("1") == 4.0
    assert _likert_4_points("2") == 3.0
    assert _likert_4_points("3") == 2.0
    assert _likert_4_points("4") == 1.0


def test_tindakan_exactly_50_percent_is_baik() -> None:
    answers = _base_answers()
    # 15 butir × 2 poin (jawaban "3" = kurang setuju) = 30 / 60 = 50%
    for q in LIPI_QUESTIONS:
        if q["section"] == "td":
            answers[q["id"]] = "3"
    scored = calculate_lipi_score(answers)
    assert scored["td_scored"] is True
    assert scored["tindakan_raw"] == 30
    assert scored["tindakan_max"] == _TD_RAW_MAX == 60
    assert scored["tindakan_score"] == 50.0
    assert scored["tindakan_level"] == "Baik"


def test_tindakan_below_50_percent_is_buruk() -> None:
    answers = _base_answers()
    # Semua "4" (tidak setuju) → 15×1 = 15 / 60 = 25%
    for q in LIPI_QUESTIONS:
        if q["section"] == "td":
            answers[q["id"]] = "4"
    scored = calculate_lipi_score(answers)
    assert scored["tindakan_score"] < 50
    assert scored["tindakan_level"] == "Buruk"
    cats = [s["category"] for s in scored["sections_to_review"]]
    assert "td" in cats


def test_tindakan_max_is_baik() -> None:
    answers = _base_answers()
    # Semua "1" (sangat setuju) → 15×4 = 60 / 60 = 100%
    for q in LIPI_QUESTIONS:
        if q["section"] == "td":
            answers[q["id"]] = "1"
    scored = calculate_lipi_score(answers)
    assert scored["tindakan_score"] == 100.0
    assert scored["tindakan_level"] == "Baik"
    cats = [s["category"] for s in scored["sections_to_review"]]
    assert "td" not in cats


def test_efikasi_sangat_setuju_is_tinggi() -> None:
    answers = _base_answers()
    for q in LIPI_QUESTIONS:
        if q["section"] == "ed":
            answers[q["id"]] = "1"
    scored = calculate_lipi_score(answers)
    assert scored["efikasi_diri_raw"] == 60
    assert scored["efikasi_diri_score"] == 40.0
    assert scored["efikasi_diri_level"] == "Tinggi"


def test_post_test_tindakan_uses_likert_5() -> None:
    answers = _base_answers()
    for q in LIPI_QUESTIONS:
        if q["section"] == "td":
            answers[q["id"]] = "ks"
    scored = calculate_lipi_score(answers, ATTEMPT_POST)
    assert scored["tindakan_max"] == _TD_RAW_MAX_POST == 75
    assert scored["tindakan_raw"] == 45
    assert scored["tindakan_score"] == 60.0
    assert scored["likert_mode"] == "all_5"


def test_post_test_efikasi_ss_is_tinggi() -> None:
    answers = _base_answers()
    for q in LIPI_QUESTIONS:
        if q["section"] == "ed":
            answers[q["id"]] = "ss"
    scored = calculate_lipi_score(answers, ATTEMPT_POST)
    assert scored["efikasi_diri_raw"] == 75
    assert scored["efikasi_diri_score"] == 40.0
    assert scored["efikasi_diri_level"] == "Tinggi"


def test_efikasi_tidak_setuju_is_rendah() -> None:
    answers = _base_answers()
    for q in LIPI_QUESTIONS:
        if q["section"] == "ed":
            answers[q["id"]] = "4"
    scored = calculate_lipi_score(answers)
    assert scored["efikasi_diri_raw"] == 15
    assert scored["efikasi_diri_score"] == 10.0
    assert scored["efikasi_diri_level"] == "Rendah"


if __name__ == "__main__":
    test_likert_4_points_reversed()
    test_tindakan_exactly_50_percent_is_baik()
    test_tindakan_below_50_percent_is_buruk()
    test_tindakan_max_is_baik()
    test_efikasi_sangat_setuju_is_tinggi()
    test_efikasi_tidak_setuju_is_rendah()
    print("ok")
