"""
Router Kuesioner Kesiapsiagaan Gempa Bumi - Staf Puskesmas.

Sumber: kuesioner-gempa-puskesmas.txt (penelitian kesiapsiagaan gempa di puskesmas).

Bagian:
  dm  Data Diri         - demografi responden (8 butir, tidak dinilai)
  ed  Efikasi Diri     - Pre-test: Likert 1–4 · Post-test: Likert SS–STS (5 poin)
  pg  Pengetahuan      - PG benar/salah (8 butir) - DINILAI
  sk  Sikap            - Likert SS–STS (15 butir) - HBM-TPB, dinilai persentase
  td  Tindakan         - Pre-test: Likert 1–4 · Post-test: Likert SS–STS (5 poin)

Pre-test (ed/td): 1=sangat setuju … 4=tidak setuju, poin = 5 − jawaban.
Post-test (ed/sk/td): SS=5 … STS=1 (skala Likert 5 seragam).

Pengetahuan: benar = 1, salah = 0 · Baik 76–100%, Cukup 56–75%, Kurang < 56%.
Efikasi diri: jumlah poin 15–60 → skala 10–40 · Tinggi 30–40, Sedang 20–29, Rendah 10–19.
Tindakan: persentase (jumlah poin / 60) × 100% · Baik ≥50%, Buruk <50%.
"""

import json
import logging
from datetime import datetime, timezone
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.audit import ACTION_EXPORT, ACTION_SKRINING_DELETE, ACTION_SKRINING_SUBMIT, log_action
from app.db import get_db
from app.lipi_attempt import (
    ATTEMPT_POST,
    ATTEMPT_PRE,
    attempt_label,
    next_attempt_for_submit,
    resolve_user_attempts,
)
from app.deepseek import deepseek_json
from app.deps import get_current_user, get_user_role, require_content_admin
from app.staff_assessment_profile import _format_lipi_block
from app.lipi_wa_followup import LIPI_WA_FOLLOWUP_PROMPT, register_lipi_wa_detail_offer
from app.wa_staff_chat_history import append_wa_context_turn
from app.wa_gateway import staff_wa_chat_config_error_detail, wa_outbound_configured, wa_send_text

log = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public", tags=["lipi-quiz"])
admin_router = APIRouter(prefix="/admin", tags=["admin-lipi-quiz"])

_SETTINGS_KEY = "lipi_quiz_settings"
_DEFAULT_MIN_VIDEOS = 0
_DEFAULT_MIN_PDFS = 0
_QUESTIONNAIRE_VERSION = "gempa_puskesmas_v2"

_LIKERT_4 = ["1", "2", "3", "4"]
_LIKERT_4_LABELS: dict[str, str] = {
    "1": "Sangat setuju",
    "2": "Setuju",
    "3": "Kurang setuju",
    "4": "Tidak setuju",
}
_LIKERT_5 = ["ss", "s", "ks", "ts", "sts"]


def _likert_4_points(val: str) -> float:
    """Skala 1=sangat setuju (terbaik) … 4=tidak setuju; poin = 5 − jawaban."""
    try:
        n = int(val)
    except (TypeError, ValueError):
        return 0.0
    if n < 1 or n > 4:
        return 0.0
    return float(5 - n)

# ---------------------------------------------------------------------------
# Question Bank
# ---------------------------------------------------------------------------

def _likert_q(section: str, number: int, qid: str, text: str) -> dict[str, Any]:
    return {
        "id": qid,
        "section": section,
        "number": number,
        "text": text,
        "type": "likert_4",
        "options": _LIKERT_4,
    }


def _sikap_q(number: int, qid: str, text: str) -> dict[str, Any]:
    return {
        "id": qid,
        "section": "sk",
        "number": number,
        "text": text,
        "type": "likert_5",
        "options": _LIKERT_5,
    }


def _pg_q(number: int, qid: str, text: str, choices: list[tuple[str, str]], correct: str) -> dict[str, Any]:
    return {
        "id": qid,
        "section": "pg",
        "number": number,
        "text": text,
        "type": "mcq",
        "choices": [{"id": cid, "text": ctext} for cid, ctext in choices],
        "correct": correct,
    }


def _demo_q(number: int, qid: str, text: str, choices: list[tuple[str, str]]) -> dict[str, Any]:
    return {
        "id": qid,
        "section": "dm",
        "number": number,
        "text": text,
        "type": "mcq",
        "choices": [{"id": cid, "text": ctext} for cid, ctext in choices],
    }


def _demo_text_q(
    number: int,
    qid: str,
    text: str,
    *,
    placeholder: str = "",
    input_mode: str = "text",
) -> dict[str, Any]:
    return {
        "id": qid,
        "section": "dm",
        "number": number,
        "text": text,
        "type": "text",
        "placeholder": placeholder,
        "input_mode": input_mode,
    }


DEMO_QUESTIONS: list[dict[str, Any]] = [
    _demo_q(
        1, "dm1", "Jenis kelamin",
        [("laki_laki", "Laki-laki"), ("perempuan", "Perempuan")],
    ),
    _demo_text_q(
        2, "dm2", "Usia (tahun)",
        placeholder="Contoh: 32",
        input_mode="number",
    ),
    _demo_q(
        3, "dm3", "Pendidikan terakhir",
        [
            ("sma", "SMA/SMK"),
            ("d3", "Diploma (D3)"),
            ("s1", "Sarjana (S1/D4)"),
            ("s2", "Magister (S2)"),
            ("s3", "Doktor (S3)"),
        ],
    ),
    _demo_text_q(
        4, "dm4", "Status SDM di Puskesmas",
        placeholder="Contoh: Perawat, Bidan, Dokter, Administrasi",
    ),
    _demo_text_q(
        5, "dm5", "Lama bekerja di Puskesmas",
        placeholder="Contoh: 5 tahun",
    ),
    _demo_q(
        6, "dm6", "Apakah pernah mengikuti pelatihan terkait kebencanaan?",
        [("ya", "Ya, pernah"), ("tidak", "Tidak pernah")],
    ),
    _demo_q(
        7, "dm7", "Apakah tergabung dalam tim kebencanaan di Puskesmas?",
        [("ya", "Ya, tergabung"), ("tidak", "Tidak tergabung")],
    ),
    _demo_q(
        8, "dm8",
        "Apakah pernah merasakan atau mengalami bencana gempa bumi?",
        [("ya", "Ya, pernah"), ("tidak", "Tidak pernah")],
    ),
]


LIPI_QUESTIONS: list[dict[str, Any]] = [
    # ── Efikasi Diri (ed1–ed15) ───────────────────────────────────────────
    _likert_q("ed", 1, "ed1", "Saya yakin mampu tetap tenang saat terjadi gempa di Puskesmas"),
    _likert_q("ed", 2, "ed2", "Saya mampu mengambil keputusan dengan cepat dalam situasi darurat"),
    _likert_q("ed", 3, "ed3", "Saya dapat menemukan solusi saat menghadapi masalah dalam penanganan bencana"),
    _likert_q("ed", 4, "ed4", "Saya yakin dapat menjalankan peran saya dengan baik saat terjadi gempa"),
    _likert_q("ed", 5, "ed5", "Saya mampu beradaptasi dengan situasi yang tidak terduga saat bencana"),
    _likert_q("ed", 6, "ed6", "Saya percaya diri dalam membantu pasien saat kondisi darurat gempa"),
    _likert_q("ed", 7, "ed7", "Saya dapat mengendalikan rasa panik saat menghadapi bencana"),
    _likert_q("ed", 8, "ed8", "Saya mampu bekerja sama secara efektif dengan tim saat terjadi gempa"),
    _likert_q("ed", 9, "ed9", "Saya yakin dapat mengatasi hambatan dalam proses evakuasi pasien"),
    _likert_q("ed", 10, "ed10", "Saya mampu tetap fokus dalam menjalankan tugas saat kondisi darurat"),
    _likert_q("ed", 11, "ed11", "Saya yakin dapat mengikuti prosedur penanganan bencana dengan benar"),
    _likert_q("ed", 12, "ed12", "Saya mampu berkomunikasi dengan baik dalam situasi darurat"),
    _likert_q("ed", 13, "ed13", "Saya percaya dapat membantu mengurangi risiko cedera pada pasien saat gempa"),
    _likert_q("ed", 14, "ed14", "Saya mampu bertindak cepat tanpa menunggu instruksi dalam kondisi darurat"),
    _likert_q("ed", 15, "ed15", "Saya yakin dapat menghadapi situasi bencana meskipun dalam tekanan tinggi"),
    # ── Pengetahuan (pg1–pg8) ─────────────────────────────────────────────
    _pg_q(
        1, "pg1",
        "Resiko utama yang dapat mengancam keselamatan jiwa akibat gempa bumi pada bangunan Puskesmas adalah…",
        [
            ("a", "Cat dinding mengelupas"),
            ("b", "Kerusakan struktur bangunan/roboh"),
            ("c", "Terputusnya aliran listrik di ruang administrasi"),
            ("d", "Kerusakan komputer di loket pendaftaran"),
        ],
        "b",
    ),
    _pg_q(
        2, "pg2",
        "Fungsi utama rambu jalur evakuasi di Puskesmas saat terjadi gempa adalah…",
        [
            ("a", "Menunjukkan arah evakuasi menuju lokasi aman/titik kumpul"),
            ("b", "Menandai lokasi penyimpanan alat kesehatan"),
            ("c", "Mengatur pembagian ruangan pelayanan"),
            ("d", "Menentukan area kerja staf"),
        ],
        "a",
    ),
    _pg_q(
        3, "pg3",
        "Lokasi titik kumpul yang aman di lingkungan puskesmas sebaiknya berada pada area…",
        [
            ("a", "Terbuka, mudah dijangkau dan jauh dari bangunan serta benda yang berpotensi jatuh"),
            ("b", "Dekat pintu utama agar mempermudah keluar masuk staf"),
            ("c", "Di dalam gedung yang memiliki ruangan yang luas"),
            ("d", "Di area parkir yang padat kendaraan"),
        ],
        "a",
    ),
    _pg_q(
        4, "pg4",
        "Saat gempa kuat ketika staf Puskesmas sedang melakukan tindakan pada pasien, tindakan awal yang paling tepat adalah…",
        [
            ("a", "Berlari keluar ruangan untuk meminta bantuan"),
            ("b", "Melindungi diri dan pasien dengan prosedur Drop, Cover, Hold sesuai kondisi aman"),
            ("c", "Segera membawa pasien keluar gedung saat guncangan berlangsung"),
            ("d", "Mematikan seluruh aktivitas dan menunggu instruksi"),
        ],
        "b",
    ),
    _pg_q(
        5, "pg5",
        "Berapa frekuensi minimal pelaksanaan simulasi bencana gempa bumi di Puskesmas setiap tahun sesuai standar akreditasi…",
        [
            ("a", "Satu kali dalam satu tahun"),
            ("b", "Dua kali dalam satu tahun"),
            ("c", "Tiga kali dalam satu tahun"),
            ("d", "Hanya dilakukan jika terjadi bencana"),
        ],
        "a",
    ),
    _pg_q(
        6, "pg6",
        "Tujuan utama pelaksanaan simulasi bencana secara berkala bagi staf Puskesmas adalah…",
        [
            ("a", "Melatih kesiapsiagaan dan memperjelas peran setiap staf saat menghadapi bencana"),
            ("b", "Memenuhi persyaratan administrasi akreditasi"),
            ("c", "Menilai kemampuan fisik staf semata"),
            ("d", "Mengurangi kejenuhan kerja staf"),
        ],
        "a",
    ),
    _pg_q(
        7, "pg7",
        "Isi utama dokumen rencana penanggulangan bencana di Puskesmas meliputi…",
        [
            ("a", "Jadwal pelayanan harian Puskesmas"),
            ("b", "Data kunjungan pasien"),
            ("c", "Alur evakuasi, pembagian tugas, dan prosedur penanganan darurat"),
            ("d", "Laporan keuangan tahunan"),
        ],
        "c",
    ),
    _pg_q(
        8, "pg8",
        "Setelah proses evakuasi dilakukan, tindakan yang perlu dilakukan staf puskesmas adalah…",
        [
            ("a", "Melakukan pendataan keberadaan korban atau staf di titik kumpul sesuai prosedur"),
            ("b", "Kembali ke ruangan kerja untuk mengambil barang pribadi"),
            ("c", "Menunggu instruksi tanpa melakukan tindakan"),
            ("d", "Mengunci semua ruangan pelayanan"),
        ],
        "a",
    ),
    # ── Sikap (sk1–sk15) ──────────────────────────────────────────────────
    _sikap_q(1, "sk1", "Saya memandang penting pemahaman tentang kesiapsiagaan gempa bagi staf"),
    _sikap_q(2, "sk2", "Saya memiliki kemauan untuk mengikuti pelatihan kebencanaan secara berkala"),
    _sikap_q(3, "sk3", "Kesiapsiagaan bencana merupakan tanggung jawab bersama seluruh staf"),
    _sikap_q(4, "sk4", "Simulasi bencana merupakan metode efektif dalam meningkatkan kesiapsiagaan"),
    _sikap_q(5, "sk5", "Saya merasa memiliki tanggung jawab terhadap keselamatan pasien saat terjadi gempa"),
    _sikap_q(6, "sk6", "Saya yakin mampu bertindak secara tenang dalam situasi bencana"),
    _sikap_q(7, "sk7", "Pengetahuan tentang jalur evakuasi harus dimiliki oleh seluruh staf"),
    _sikap_q(8, "sk8", "Mengetahui lokasi titik kumpul merupakan hal yang penting"),
    _sikap_q(9, "sk9", "Koordinasi tim sangat diperlukan dalam proses evakuasi bencana"),
    _sikap_q(10, "sk10", "Saya bersedia membantu rekan kerja dalam situasi darurat"),
    _sikap_q(11, "sk11", "Kepatuhan terhadap SOP merupakan hal yang wajib dalam kondisi bencana"),
    _sikap_q(12, "sk12", "Pelatihan kesiapsiagaan bencana perlu dilakukan secara rutin"),
    _sikap_q(13, "sk13", "Saya merasa percaya diri dalam menghadapi situasi darurat"),
    _sikap_q(14, "sk14", "Edukasi kebencanaan perlu diberikan kepada seluruh staf tanpa terkecuali"),
    _sikap_q(15, "sk15", "Saya mendukung penerapan simulasi bencana secara berkala di Puskesmas"),
    # ── Tindakan (td1–td15) ───────────────────────────────────────────────
    _likert_q("td", 1, "td1", "Saya mengetahui dengan jelas jalur evakuasi di tempat kerja saya"),
    _likert_q("td", 2, "td2", "Saya mengetahui lokasi titik kumpul yang telah ditentukan"),
    _likert_q("td", 3, "td3", "Saya pernah mengikuti pelatihan atau simulasi gempa bumi"),
    _likert_q("td", 4, "td4", "Saya telah membaca dan memahami SOP penanggulangan bencana"),
    _likert_q("td", 5, "td5", "Saya membantu pasien sesuai prioritas kondisi kegawatdaruratan"),
    _likert_q("td", 6, "td6", "Saya pernah terlibat dalam kegiatan evakuasi pasien saat simulasi"),
    _likert_q("td", 7, "td7", "Saya memastikan jalur evakuasi tetap dalam kondisi bebas hambatan"),
    _likert_q("td", 8, "td8", "Saya berperan aktif dalam membantu pasien saat keadaan darurat"),
    _likert_q("td", 9, "td9", "Saya mengikuti instruksi yang diberikan saat simulasi bencana"),
    _likert_q("td", 10, "td10", "Saya melaporkan jika terdapat hambatan pada jalur evakuasi"),
    _likert_q("td", 11, "td11", "Saya mengetahui peran dan tanggung jawab saya dalam situasi bencana"),
    _likert_q("td", 12, "td12", "Saya berpartisipasi dalam kegiatan pelatihan kebencanaan di Puskesmas"),
    _likert_q("td", 13, "td13", "Saya memberikan edukasi kepada pasien terkait prosedur evakuasi"),
    _likert_q("td", 14, "td14", "Saya menggunakan alat pelindung diri saat kondisi darurat jika diperlukan"),
    _likert_q("td", 15, "td15", "Saya menjalankan prosedur sesuai SOP saat terjadi keadaan darurat"),
]

# ---------------------------------------------------------------------------
# Lookup maps
# ---------------------------------------------------------------------------

def _build_question_map() -> dict[str, dict[str, Any]]:
    return {q["id"]: q for q in LIPI_QUESTIONS}


_QUESTION_MAP = _build_question_map()
_PENGETAHUAN_MAX = sum(1 for q in LIPI_QUESTIONS if q["section"] == "pg")
_ED_COUNT = sum(1 for q in LIPI_QUESTIONS if q["section"] == "ed")
_SK_COUNT = sum(1 for q in LIPI_QUESTIONS if q["section"] == "sk")
_TD_COUNT = sum(1 for q in LIPI_QUESTIONS if q["section"] == "td")

# Efikasi diri (GSES): 15 butir Likert 1–4 → jumlah mentah 15–60, dinormalkan ke skala 10–40.
_ED_RAW_MIN = 15
_ED_RAW_MAX = 60
_ED_SCALE_MIN = 10
_ED_SCALE_MAX = 40

# Sikap (HBM-TPB Likert): SS=5 … STS=1, 15 butir → 15–75.
_SIKAP_POINTS: dict[str, int] = {"ss": 5, "s": 4, "ks": 3, "ts": 2, "sts": 1}
_SIKAP_MAX = _SK_COUNT * 5
_SIKAP_MIN = _SK_COUNT * 1

# Tindakan pre-test: Likert 1–4 → 15–60. Post-test: Likert 5 → 15–75.
_TD_RAW_MIN = _TD_COUNT * 1
_TD_RAW_MAX = _TD_COUNT * 4
_TD_RAW_MAX_POST = _TD_COUNT * 5
_TD_BAIK_MIN_PCT = 50.0

# Post-test: efikasi diri mentah 15–75 (15 butir × 1–5 poin).
_ED_RAW_MAX_POST = _ED_COUNT * 5

_VALID_ANSWERS: dict[str, set[str]] = {}
for _q in LIPI_QUESTIONS:
    _VALID_ANSWERS[_q["id"]] = set(_q.get("options") or [c["id"] for c in _q.get("choices", [])])

_DEMO_MCQ_IDS: dict[str, set[str]] = {}
for _q in DEMO_QUESTIONS:
    if _q["type"] == "mcq":
        _DEMO_MCQ_IDS[_q["id"]] = set(c["id"] for c in _q.get("choices", []))


# ---------------------------------------------------------------------------
# Scoring - pengetahuan, efikasi diri (GSES), sikap (HBM-TPB)
# ---------------------------------------------------------------------------

def _pct_baik_cukup_kurang(pct: float) -> tuple[str, str]:
    """Baik ≥76%, Cukup 56–75%, Kurang ≤55%."""
    if pct >= 76:
        return "Baik", "emerald"
    if pct >= 56:
        return "Cukup", "amber"
    return "Kurang", "red"


def _efikasi_diri_level(normalized: float) -> tuple[str, str]:
    """Skala GSES 10–40: Tinggi 30–40, Sedang 20–29, Rendah 10–19."""
    if normalized >= 30:
        return "Tinggi", "emerald"
    if normalized >= 20:
        return "Sedang", "amber"
    return "Rendah", "red"


def _tindakan_baik_buruk(pct: float) -> tuple[str, str]:
    """Tindakan: ≥50% Baik, <50% Buruk."""
    if pct >= _TD_BAIK_MIN_PCT:
        return "Baik", "emerald"
    return "Buruk", "red"


def _normalize_ed_raw(raw: float, raw_max: float = _ED_RAW_MAX) -> float:
    span = raw_max - _ED_RAW_MIN
    if span <= 0:
        return float(_ED_SCALE_MIN)
    norm = _ED_SCALE_MIN + (raw - _ED_RAW_MIN) * (_ED_SCALE_MAX - _ED_SCALE_MIN) / span
    return round(max(_ED_SCALE_MIN, min(_ED_SCALE_MAX, norm)), 1)


def _uses_likert_5(section: str, attempt_type: str) -> bool:
    if section == "sk":
        return True
    return attempt_type == ATTEMPT_POST and section in ("ed", "td")


def _likert_item_points(section: str, val: str, attempt_type: str) -> float:
    if _uses_likert_5(section, attempt_type):
        return float(_SIKAP_POINTS.get(val, 0))
    if section in ("ed", "td"):
        return _likert_4_points(val)
    return 0.0


def _questions_for_attempt(attempt_type: str) -> list[dict[str, Any]]:
    if attempt_type == ATTEMPT_POST:
        out: list[dict[str, Any]] = []
        for q in LIPI_QUESTIONS:
            if q["section"] in ("ed", "td"):
                out.append({
                    **q,
                    "type": "likert_5",
                    "options": list(_LIKERT_5),
                })
            else:
                out.append(q)
        return out
    return LIPI_QUESTIONS


def _valid_answers_for_question(qid: str, attempt_type: str) -> set[str] | None:
    q = _QUESTION_MAP.get(qid)
    if not q:
        return None
    if _uses_likert_5(q["section"], attempt_type):
        return set(_LIKERT_5)
    return _VALID_ANSWERS.get(qid)


def _sum_likert_section(
    answers: dict[str, str],
    section: str,
    attempt_type: str = ATTEMPT_PRE,
) -> float:
    total = 0.0
    for q in LIPI_QUESTIONS:
        if q["section"] != section:
            continue
        val = answers.get(q["id"], "")
        total += _likert_item_points(section, val, attempt_type)
    return total


def calculate_lipi_score(
    answers: dict[str, str],
    attempt_type: str = ATTEMPT_PRE,
) -> dict[str, Any]:
    """Hitung pengetahuan, efikasi diri (GSES), sikap (HBM-TPB), dan tindakan (2 kategori)."""
    wrong_items: list[dict[str, str]] = []
    pg_earned = 0.0

    for q in LIPI_QUESTIONS:
        if q["section"] != "pg":
            continue
        qid = q["id"]
        answer = answers.get(qid, "")
        correct = q["correct"]
        if answer == correct:
            pg_earned += 1.0
        else:
            choice_map = {c["id"]: c["text"] for c in q.get("choices", [])}
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

    pg_pct = round((pg_earned / _PENGETAHUAN_MAX) * 100, 1) if _PENGETAHUAN_MAX > 0 else 0.0
    pg_level, level_color = _pct_baik_cukup_kurang(pg_pct)

    ed_raw_max = _ED_RAW_MAX_POST if attempt_type == ATTEMPT_POST else _ED_RAW_MAX
    td_raw_max = _TD_RAW_MAX_POST if attempt_type == ATTEMPT_POST else _TD_RAW_MAX

    ed_raw = _sum_likert_section(answers, "ed", attempt_type)
    ed_score = _normalize_ed_raw(ed_raw, ed_raw_max)
    ed_level, ed_level_color = _efikasi_diri_level(ed_score)

    sk_raw = _sum_likert_section(answers, "sk", attempt_type)
    sk_pct = round((sk_raw / _SIKAP_MAX) * 100, 1) if _SIKAP_MAX > 0 else 0.0
    sk_level, sk_level_color = _pct_baik_cukup_kurang(sk_pct)

    td_raw = _sum_likert_section(answers, "td", attempt_type)
    td_pct = round((td_raw / td_raw_max) * 100, 1) if td_raw_max > 0 else 0.0
    td_level, td_level_color = _tindakan_baik_buruk(td_pct)

    sections_to_review: list[dict[str, Any]] = []
    if pg_pct < 76:
        sections_to_review.append({
            "category": "pg",
            "label": "Pengetahuan Kesiapsiagaan Gempa",
            "score": pg_pct,
            "score_unit": "pct",
        })
    if sk_pct < 76:
        sections_to_review.append({
            "category": "sk",
            "label": "Sikap Kesiapsiagaan",
            "score": sk_pct,
            "score_unit": "pct",
        })
    if ed_level != "Tinggi":
        sections_to_review.append({
            "category": "ed",
            "label": "Efikasi Diri",
            "score": ed_score,
            "score_unit": "ed_scale",
        })
    if td_level != "Baik":
        sections_to_review.append({
            "category": "td",
            "label": "Tindakan Kesiapsiagaan",
            "score": td_pct,
            "score_unit": "pct",
        })
    sections_to_review.sort(key=lambda x: x.get("score", 0))

    return {
        "pengetahuan_score": pg_pct,
        "pengetahuan_earned": pg_earned,
        "pengetahuan_max": _PENGETAHUAN_MAX,
        "pengetahuan_level": pg_level,
        "efikasi_diri_raw": ed_raw,
        "efikasi_diri_score": ed_score,
        "efikasi_diri_level": ed_level,
        "efikasi_diri_level_color": ed_level_color,
        "efikasi_diri_raw_min": _ED_RAW_MIN,
        "efikasi_diri_raw_max": ed_raw_max,
        "efikasi_diri_scale_min": _ED_SCALE_MIN,
        "efikasi_diri_scale_max": _ED_SCALE_MAX,
        "sikap_score": sk_pct,
        "sikap_raw": sk_raw,
        "sikap_max": _SIKAP_MAX,
        "sikap_level": sk_level,
        "sikap_level_color": sk_level_color,
        "tindakan_score": td_pct,
        "tindakan_raw": td_raw,
        "tindakan_max": td_raw_max,
        "likert_mode": "all_5" if attempt_type == ATTEMPT_POST else "mixed_4_5",
        "tindakan_level": td_level,
        "tindakan_level_color": td_level_color,
        "kap_score": pg_pct,
        "ep_score": None,
        "ws_score": None,
        "rmc_score": None,
        "kap_earned": pg_earned,
        "ep_earned": None,
        "ws_earned": None,
        "rmc_earned": None,
        "kap_max": _PENGETAHUAN_MAX,
        "ep_max": None,
        "ws_max": None,
        "rmc_max": None,
        "total_score": pg_pct,
        "level": pg_level,
        "level_color": level_color,
        "wrong_items": wrong_items,
        "sections_to_review": sections_to_review,
        "ed_scored": True,
        "sk_scored": True,
        "td_scored": True,
    }


async def _generate_ai_recommendation(score_data: dict, wrong_items: list[dict]) -> str:
    wrong_summary = []
    for item in wrong_items[:8]:
        ya = item.get("your_answer_text") or item.get("your_answer", "")
        ca = item.get("correct_answer_text") or item.get("correct_answer", "")
        wrong_summary.append(f"- {item['sub_text']}: jawaban Anda '{ya}', seharusnya '{ca}'")

    wrong_text = "\n".join(wrong_summary) if wrong_summary else "Semua jawaban pengetahuan benar."
    cat_detail = (
        f"Pengetahuan: {score_data['pengetahuan_score']:.0f}% ({score_data['pengetahuan_level']})\n"
        f"Efikasi diri (GSES): {score_data['efikasi_diri_score']:.0f}/40 "
        f"(mentah {score_data['efikasi_diri_raw']:.0f}/{score_data['efikasi_diri_raw_max']}) "
        f"- {score_data['efikasi_diri_level']}\n"
        f"Sikap (HBM-TPB): {score_data['sikap_score']:.0f}% ({score_data['sikap_level']})\n"
        f"Tindakan: {score_data['tindakan_score']:.0f}% ({score_data['tindakan_level']})"
    )

    system = (
        "Kamu adalah asisten AI kesiapsiagaan bencana untuk staf puskesmas. "
        "Berikan rekomendasi singkat (2-3 paragraf, Bahasa Indonesia ramah) berdasarkan "
        "hasil pengetahuan, efikasi diri, sikap, dan tindakan dari kuesioner kesiapsiagaan gempa. "
        "Fokus pada area yang perlu ditingkatkan dan tindakan konkret di lingkungan puskesmas. "
        "Jangan ulangi angka skor. Jawab JSON: "
        '{"recommendation": "...", "priority_areas": ["...", "..."], "action_steps": ["...", "..."]}'
    )
    user_msg = f"Hasil kuesioner:\n{cat_detail}\n\nJawaban pengetahuan keliru:\n{wrong_text}"

    try:
        data = await deepseek_json(system, user_msg, temperature=0.4, max_tokens=600, read_timeout=45.0)
        rec = str(data.get("recommendation", "")).strip()
        if not rec:
            raise ValueError("empty")
        return rec
    except Exception as exc:
        log.warning("Kuesioner AI recommendation failed: %s", exc)
        level = score_data["pengetahuan_level"]
        return (
            f"Berdasarkan hasil kuesioner, pengetahuan '{level}', "
            f"efikasi diri '{score_data['efikasi_diri_level']}', sikap '{score_data['sikap_level']}', "
            f"tindakan '{score_data['tindakan_level']}'. "
            "Pelajari kembali materi evakuasi dan latihan simulasi bencana di puskesmas."
        )


# ---------------------------------------------------------------------------
# Settings & eligibility
# ---------------------------------------------------------------------------

async def _get_settings(db) -> dict[str, Any]:
    doc = await db.app_settings.find_one({"_id": _SETTINGS_KEY})
    if not doc:
        return {"min_videos": _DEFAULT_MIN_VIDEOS, "min_pdfs": _DEFAULT_MIN_PDFS, "enabled": True}
    return {
        "min_videos": int(doc.get("min_videos", _DEFAULT_MIN_VIDEOS)),
        "min_pdfs": int(doc.get("min_pdfs", _DEFAULT_MIN_PDFS)),
        "enabled": bool(doc.get("enabled", True)),
    }


async def _check_eligibility(username: str, db, settings: dict) -> dict[str, Any]:
    enabled = bool(settings.get("enabled", True))
    completed_videos = await db.ml_learning_sessions.count_documents(
        {"username": username, "status": "done"}
    )
    completed_pdfs = await db.ml_pdf_learning_sessions.count_documents(
        {"username": username, "status": "done"}
    )
    user_sessions = await db.lipi_quiz_sessions.find({"username": username}).to_list(20)
    attempt_state = resolve_user_attempts(user_sessions)
    can_submit = bool(enabled and attempt_state["can_submit"])
    return {
        "eligible": can_submit,
        "completed_videos": completed_videos,
        "required_videos": 0,
        "completed_pdfs": completed_pdfs,
        "required_pdfs": 0,
        "quiz_enabled": enabled,
        "can_submit": can_submit,
        "next_attempt_type": attempt_state["next_attempt_type"],
        "has_pre_test": attempt_state["has_pre_test"],
        "has_post_test": attempt_state["has_post_test"],
        "kuis_status": attempt_state["kuis_status"],
    }


def _validate_answers(answers: dict[str, str], attempt_type: str = ATTEMPT_PRE) -> None:
    missing = [q["id"] for q in LIPI_QUESTIONS if q["id"] not in answers]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Jawaban belum lengkap ({len(missing)} butir tersisa).",
        )
    for qid, val in answers.items():
        allowed = _valid_answers_for_question(qid, attempt_type)
        if not allowed:
            raise HTTPException(status_code=400, detail=f"ID pertanyaan tidak dikenal: {qid}")
        if val not in allowed:
            raise HTTPException(status_code=400, detail=f"Jawaban tidak valid untuk {qid}: {val}")


def _normalize_demographics(demographics: dict[str, str]) -> dict[str, str]:
    demo_by_id = {q["id"]: q for q in DEMO_QUESTIONS}
    out: dict[str, str] = {}
    for qid, val in demographics.items():
        q = demo_by_id.get(qid)
        if q and q["type"] == "text":
            out[qid] = str(val or "").strip()
        else:
            out[qid] = val
    return out


def _validate_demographics(demographics: dict[str, str]) -> None:
    missing = [q["id"] for q in DEMO_QUESTIONS if q["id"] not in demographics]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Data demografi belum lengkap ({len(missing)} butir tersisa).",
        )
    demo_by_id = {q["id"]: q for q in DEMO_QUESTIONS}
    for qid, val in demographics.items():
        q = demo_by_id.get(qid)
        if not q:
            raise HTTPException(status_code=400, detail=f"ID demografi tidak dikenal: {qid}")
        if q["type"] == "mcq":
            allowed = _DEMO_MCQ_IDS.get(qid, set())
            if val not in allowed:
                raise HTTPException(status_code=400, detail=f"Jawaban demografi tidak valid untuk {qid}: {val}")
            continue
        text = str(val or "").strip()
        if not text:
            raise HTTPException(status_code=400, detail=f"Isian demografi tidak boleh kosong: {qid}")
        if qid == "dm2":
            try:
                age = int(text)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Usia harus berupa angka tahun.") from exc
            if age < 17 or age > 80:
                raise HTTPException(status_code=400, detail="Usia harus antara 17 dan 80 tahun.")
        elif len(text) > 200:
            raise HTTPException(status_code=400, detail=f"Isian terlalu panjang untuk {qid}.")


def _serialize_questions(questions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for q in questions:
        q_out: dict[str, Any] = {
            "id": q["id"],
            "section": q["section"],
            "number": q["number"],
            "text": q["text"],
            "type": q["type"],
            "options": q.get("options") or [],
            "note": q.get("note", ""),
        }
        if q.get("choices"):
            q_out["choices"] = [{"id": c["id"], "text": c["text"]} for c in q["choices"]]
        if q.get("placeholder"):
            q_out["placeholder"] = q["placeholder"]
        if q.get("input_mode"):
            q_out["input_mode"] = q["input_mode"]
        out.append(q_out)
    return out


def _score_fields_for_storage(score_data: dict[str, Any]) -> dict[str, Any]:
    return {
        "pengetahuan_score": score_data["pengetahuan_score"],
        "pengetahuan_earned": score_data["pengetahuan_earned"],
        "pengetahuan_max": score_data["pengetahuan_max"],
        "pengetahuan_level": score_data["pengetahuan_level"],
        "efikasi_diri_raw": score_data["efikasi_diri_raw"],
        "efikasi_diri_score": score_data["efikasi_diri_score"],
        "efikasi_diri_level": score_data["efikasi_diri_level"],
        "sikap_score": score_data["sikap_score"],
        "sikap_raw": score_data["sikap_raw"],
        "sikap_max": score_data["sikap_max"],
        "sikap_level": score_data["sikap_level"],
        "tindakan_score": score_data["tindakan_score"],
        "tindakan_raw": score_data["tindakan_raw"],
        "tindakan_max": score_data["tindakan_max"],
        "tindakan_level": score_data["tindakan_level"],
        "kap_score": score_data["kap_score"],
        "ep_score": score_data["ep_score"],
        "ws_score": score_data["ws_score"],
        "rmc_score": score_data["rmc_score"],
        "total_score": score_data["total_score"],
        "level": score_data["level"],
        "wrong_items": score_data["wrong_items"],
        "sections_to_review": score_data["sections_to_review"],
        "ed_scored": score_data["ed_scored"],
        "sk_scored": score_data["sk_scored"],
        "td_scored": score_data["td_scored"],
    }


def _score_fields_for_response(score_data: dict[str, Any]) -> dict[str, Any]:
    return {
        **_score_fields_for_storage(score_data),
        "level_color": score_data["level_color"],
        "efikasi_diri_level_color": score_data["efikasi_diri_level_color"],
        "sikap_level_color": score_data["sikap_level_color"],
        "tindakan_level_color": score_data["tindakan_level_color"],
        "kap_max": score_data["kap_max"],
        "ep_max": score_data["ep_max"],
        "ws_max": score_data["ws_max"],
        "rmc_max": score_data["rmc_max"],
    }


# ===========================================================================
# Public Endpoints
# ===========================================================================

class LipiSubmitIn(BaseModel):
    demographics: dict[str, str] = {}
    answers: dict[str, str]


class LipiSendWaIn(BaseModel):
    session_id: str


@public_router.get("/lipi-quiz/questions")
async def get_lipi_questions(
    attempt_type: str = Query(ATTEMPT_PRE, description="pre_test atau post_test"),
):
    """Daftar pertanyaan kuesioner (tanpa kunci jawaban pengetahuan)."""
    if attempt_type not in (ATTEMPT_PRE, ATTEMPT_POST):
        raise HTTPException(status_code=400, detail="attempt_type harus pre_test atau post_test")
    bank = _questions_for_attempt(attempt_type)
    questions_out = _serialize_questions(bank)
    demographics_out = _serialize_questions(DEMO_QUESTIONS)
    likert_mode = "all_5" if attempt_type == ATTEMPT_POST else "mixed_4_5"
    return {
        "demographics": demographics_out,
        "questions": questions_out,
        "demographic_total": len(demographics_out),
        "total": len(questions_out),
        "questionnaire_version": _QUESTIONNAIRE_VERSION,
        "attempt_type": attempt_type,
        "likert_mode": likert_mode,
        "scored_sections": ["pg", "ed", "sk", "td"],
    }


@public_router.get("/lipi-quiz/settings")
async def get_lipi_quiz_settings_public():
    db = get_db()
    return await _get_settings(db)


@public_router.get("/lipi-quiz/eligibility")
async def check_lipi_eligibility(username: str = Depends(get_current_user)):
    db = get_db()
    settings = await _get_settings(db)
    return await _check_eligibility(username, db, settings)


@public_router.post("/lipi-quiz/submit")
async def submit_lipi_quiz(body: LipiSubmitIn, username: str = Depends(get_current_user)):
    db = get_db()
    settings = await _get_settings(db)

    if not settings.get("enabled", True):
        raise HTTPException(status_code=403, detail="Kuesioner saat ini tidak aktif.")

    demographics = _normalize_demographics(body.demographics or {})
    answers = body.answers
    if not demographics:
        raise HTTPException(status_code=400, detail="Data demografi tidak boleh kosong.")
    if not answers:
        raise HTTPException(status_code=400, detail="Jawaban tidak boleh kosong.")

    _validate_demographics(demographics)
    existing_sessions = await db.lipi_quiz_sessions.find({"username": username}).to_list(20)
    attempt_type = next_attempt_for_submit(existing_sessions)
    if not attempt_type:
        raise HTTPException(
            status_code=403,
            detail="Pre-test dan post-test sudah selesai. Tidak ada pengisian tambahan.",
        )

    _validate_answers(answers, attempt_type)

    score_data = calculate_lipi_score(answers, attempt_type)
    ai_rec = await _generate_ai_recommendation(score_data, score_data["wrong_items"])

    doc = {
        "username": username,
        "submitted_at": datetime.now(timezone.utc),
        "questionnaire_version": _QUESTIONNAIRE_VERSION,
        "attempt_type": attempt_type,
        "likert_mode": score_data.get("likert_mode"),
        "demographics": demographics,
        "answers": answers,
        "ai_recommendation": ai_rec,
        **_score_fields_for_storage(score_data),
    }
    result = await db.lipi_quiz_sessions.insert_one(doc)
    session_id = str(result.inserted_id)

    # Audit: skrining submission
    computed_score = score_data.get("index_score") or 0.0
    computed_level = score_data.get("index_level") or ""
    await log_action(ACTION_SKRINING_SUBMIT, username, {
        "session_id": session_id,
        "attempt_type": attempt_type,
        "index_score": computed_score,
        "index_level": computed_level,
    })

    return {
        "session_id": session_id,
        "questionnaire_version": _QUESTIONNAIRE_VERSION,
        "attempt_type": attempt_type,
        "attempt_label": attempt_label(attempt_type),
        "submitted_at": doc["submitted_at"].isoformat(),
        "ai_recommendation": ai_rec,
        **_score_fields_for_response(score_data),
    }


@public_router.get("/lipi-quiz/my-results")
async def get_my_lipi_results(username: str = Depends(get_current_user)):
    db = get_db()
    all_docs = await db.lipi_quiz_sessions.find({"username": username}).sort("submitted_at", 1).to_list(20)
    sorted_desc = list(reversed(all_docs))
    results = []
    for doc in sorted_desc[:5]:
        idx = all_docs.index(doc) if doc in all_docs else 0
        summary = _session_to_result_summary(doc)
        if not doc.get("attempt_type"):
            from app.lipi_attempt import infer_attempt_type
            at = infer_attempt_type(doc, idx)
            summary["attempt_type"] = at
            summary["attempt_label"] = attempt_label(at)
        results.append(summary)
    return {"results": results}


@public_router.post("/lipi-quiz/send-report-wa")
async def send_lipi_report_wa(body: LipiSendWaIn, username: str = Depends(get_current_user)):
    db = get_db()
    user = await db.users.find_one({"username": username})
    wa = str(user.get("wa_phone") or "").strip() if user else ""
    if not wa:
        raise HTTPException(
            status_code=400,
            detail="Nomor WhatsApp belum tertaut. Hubungkan di tab WhatsApp ruang masyarakat.",
        )
    if not wa_outbound_configured():
        raise HTTPException(status_code=503, detail=staff_wa_chat_config_error_detail())

    try:
        oid = ObjectId(body.session_id.strip())
    except Exception as exc:
        raise HTTPException(status_code=400, detail="session_id tidak valid") from exc

    doc = await db.lipi_quiz_sessions.find_one({"_id": oid, "username": username})
    if not doc:
        raise HTTPException(status_code=404, detail="Hasil kuesioner tidak ditemukan")

    message = "📋 Laporan Kuesioner Kesiapsiagaan Gempa\n\n" + _format_lipi_block(doc)
    ok, detail = await wa_send_text(wa, message)
    if not ok:
        raise HTTPException(status_code=502, detail=f"Gagal mengirim ke WhatsApp: {detail}")

    ok2, detail2 = await wa_send_text(wa, LIPI_WA_FOLLOWUP_PROMPT)
    if not ok2:
        log.warning("kuesioner wa followup prompt gagal: %s", detail2)

    try:
        await append_wa_context_turn(
            db,
            phone=wa,
            username=username,
            context_label="Laporan kuesioner gempa dikirim via WhatsApp",
            assistant_text=f"{message}\n\n{LIPI_WA_FOLLOWUP_PROMPT}",
        )
    except Exception as exc:
        log.warning("kuesioner wa report history gagal: %s", exc)

    await register_lipi_wa_detail_offer(
        db,
        phone=wa,
        username=username,
        session_id=str(doc["_id"]),
    )
    return {"ok": True, "detail": "Laporan terkirim ke WhatsApp Anda."}


def _history_session_row(doc: dict[str, Any]) -> dict[str, Any]:
    """Satu baris riwayat dengan skor yang sama dipakai dashboard."""
    pg = doc.get("pengetahuan_score")
    sk = doc.get("sikap_score")
    td = doc.get("tindakan_score")
    components: list[float] = []
    if isinstance(pg, (int, float)):
        components.append(float(pg))
    if isinstance(sk, (int, float)) and sk > 0:
        components.append(float(sk))
    if isinstance(td, (int, float)):
        components.append(float(td))
    index_score = round(sum(components) / len(components), 1) if components else None
    submitted = doc.get("submitted_at")
    return {
        "session_id": str(doc.get("_id") or ""),
        "index_score": index_score,
        "index_level": _index_level(index_score) if index_score is not None else None,
        "pg_score": pg if isinstance(pg, (int, float)) else None,
        "pg_level": doc.get("pengetahuan_level"),
        "sk_score": sk if isinstance(sk, (int, float)) else None,
        "sk_level": doc.get("sikap_level"),
        "td_score": td if isinstance(td, (int, float)) else None,
        "td_level": doc.get("tindakan_level"),
        "attempt_type": doc.get("attempt_type"),
        "submitted_at": submitted.isoformat() if hasattr(submitted, "isoformat") else submitted,
    }


@public_router.get("/lipi-quiz/history/{username}")
async def get_screening_history(
    username: str,
    auth: tuple[str, str] = Depends(get_user_role),
):
    """Semua sesi skrining satu petugas, terbaru dulu."""
    caller, role = auth
    if caller != username and role not in ("admin", "kepala_puskesmas"):
        raise HTTPException(status_code=403, detail="Tidak memiliki akses")
    db = get_db()
    docs = await db.lipi_quiz_sessions.find(
        {"username": username},
        {"answers": 0, "demographics": 0, "wrong_items": 0},
    ).sort("submitted_at", -1).to_list(100)
    sessions = [_history_session_row(doc) for doc in docs]
    return {"sessions": sessions, "total": len(sessions)}


def _answers_dict(doc: dict[str, Any]) -> dict[str, str] | None:
    answers = doc.get("answers")
    if not isinstance(answers, dict) or not answers:
        return None
    return {str(k): str(v) for k, v in answers.items()}


def _tindakan_from_doc(doc: dict[str, Any]) -> tuple[float | None, float | None, str | None, str]:
    """Hitung ulang skor tindakan dari jawaban; fallback ke nilai tersimpan."""
    answer_map = _answers_dict(doc)
    if answer_map:
        attempt = str(doc.get("attempt_type") or ATTEMPT_PRE)
        scored = calculate_lipi_score(answer_map, attempt)
        return (
            float(scored["tindakan_score"]),
            float(scored["tindakan_raw"]),
            str(scored["tindakan_level"]),
            str(scored["tindakan_level_color"]),
        )
    if doc.get("tindakan_score") is not None:
        pct = float(doc.get("tindakan_score") or 0)
        raw = float(doc.get("tindakan_raw") or 0)
        level = str(doc.get("tindakan_level") or "")
        _, color = _tindakan_baik_buruk(pct)
        return pct, raw, level or _tindakan_baik_buruk(pct)[0], color
    return None, None, None, "emerald"


def _efikasi_from_doc(doc: dict[str, Any]) -> tuple[float | None, float | None, str | None, str]:
    """Hitung ulang skor efikasi diri dari jawaban; fallback ke nilai tersimpan."""
    answer_map = _answers_dict(doc)
    if answer_map:
        attempt = str(doc.get("attempt_type") or ATTEMPT_PRE)
        scored = calculate_lipi_score(answer_map, attempt)
        return (
            float(scored["efikasi_diri_score"]),
            float(scored["efikasi_diri_raw"]),
            str(scored["efikasi_diri_level"]),
            str(scored["efikasi_diri_level_color"]),
        )
    ed_score = doc.get("efikasi_diri_score")
    if ed_score is not None:
        score_f = float(ed_score)
        raw = float(doc.get("efikasi_diri_raw") or 0)
        level = str(doc.get("efikasi_diri_level") or "")
        _, color = _efikasi_diri_level(score_f)
        return score_f, raw, level or _efikasi_diri_level(score_f)[0], color
    return None, None, None, "emerald"


def _session_to_result_summary(doc: dict[str, Any]) -> dict[str, Any]:
    pg_pct = float(doc.get("pengetahuan_score") or doc.get("total_score") or 0)
    _, level_color = _pct_baik_cukup_kurang(pg_pct)
    ed_score, ed_raw, ed_level, ed_color = _efikasi_from_doc(doc)
    sk_pct = doc.get("sikap_score")
    sk_level = doc.get("sikap_level")
    _, sk_color = _pct_baik_cukup_kurang(float(sk_pct or 0)) if sk_pct is not None else ("", "emerald")
    td_pct, td_raw, td_level, td_color = _tindakan_from_doc(doc)
    td_scored = td_pct is not None
    attempt_type = str(doc.get("attempt_type") or ATTEMPT_PRE)
    return {
        "session_id": str(doc["_id"]),
        "questionnaire_version": doc.get("questionnaire_version", ""),
        "attempt_type": attempt_type,
        "attempt_label": attempt_label(attempt_type),
        "total_score": doc.get("total_score", 0),
        "level": doc.get("level", doc.get("pengetahuan_level", "-")),
        "level_color": level_color,
        "pengetahuan_score": doc.get("pengetahuan_score", doc.get("kap_score", 0)),
        "pengetahuan_earned": doc.get("pengetahuan_earned"),
        "pengetahuan_max": doc.get("pengetahuan_max", _PENGETAHUAN_MAX),
        "pengetahuan_level": doc.get("pengetahuan_level", doc.get("level")),
        "efikasi_diri_raw": ed_raw if ed_raw is not None else doc.get("efikasi_diri_raw"),
        "efikasi_diri_score": ed_score,
        "efikasi_diri_level": ed_level,
        "efikasi_diri_level_color": ed_color,
        "sikap_score": sk_pct,
        "sikap_raw": doc.get("sikap_raw"),
        "sikap_max": doc.get("sikap_max", _SIKAP_MAX),
        "sikap_level": sk_level,
        "sikap_level_color": sk_color,
        "tindakan_score": td_pct,
        "tindakan_raw": td_raw,
        "tindakan_max": doc.get("tindakan_max", _TD_RAW_MAX),
        "tindakan_level": td_level,
        "tindakan_level_color": td_color,
        "kap_score": doc.get("kap_score", 0),
        "ep_score": doc.get("ep_score"),
        "ws_score": doc.get("ws_score"),
        "rmc_score": doc.get("rmc_score"),
        "kap_max": doc.get("kap_max", _PENGETAHUAN_MAX),
        "ep_max": doc.get("ep_max"),
        "ws_max": doc.get("ws_max"),
        "rmc_max": doc.get("rmc_max"),
        "ed_scored": doc.get("ed_scored", False),
        "sk_scored": doc.get("sk_scored", False),
        "td_scored": td_scored,
        "ai_recommendation": doc.get("ai_recommendation", ""),
        "sections_to_review": doc.get("sections_to_review", []),
        "wrong_items": doc.get("wrong_items", []),
        "submitted_at": doc.get("submitted_at", "").isoformat() if doc.get("submitted_at") else "",
    }


# ===========================================================================
# Admin Endpoints
# ===========================================================================

class LipiSettingsIn(BaseModel):
    min_videos: int = 1
    min_pdfs: int = 0
    enabled: bool = True


@admin_router.get("/lipi-quiz/settings")
async def admin_get_lipi_settings(_: str = Depends(require_content_admin)):
    db = get_db()
    return await _get_settings(db)


@admin_router.put("/lipi-quiz/settings")
async def admin_update_lipi_settings(body: LipiSettingsIn, _: str = Depends(require_content_admin)):
    db = get_db()
    await db.app_settings.update_one(
        {"_id": _SETTINGS_KEY},
        {
            "$set": {
                "min_videos": max(0, body.min_videos),
                "min_pdfs": max(0, body.min_pdfs),
                "enabled": body.enabled,
            }
        },
        upsert=True,
    )
    return await _get_settings(db)


@admin_router.get("/lipi-quiz/all-results")
async def admin_get_all_lipi_results(
    limit: int = 50,
    _: str = Depends(require_content_admin),
):
    db = get_db()
    cursor = db.lipi_quiz_sessions.find(
        {},
        sort=[("submitted_at", -1)],
        limit=min(limit, 200),
    )
    results = []
    async for doc in cursor:
        results.append({
            "session_id": str(doc["_id"]),
            "username": doc.get("username", ""),
            "total_score": doc.get("total_score", 0),
            "level": doc.get("level", "-"),
            "pengetahuan_score": doc.get("pengetahuan_score", doc.get("kap_score", 0)),
            "kap_score": doc.get("kap_score", 0),
            "submitted_at": doc.get("submitted_at", "").isoformat() if doc.get("submitted_at") else "",
        })
    return {"results": results, "total": len(results)}


async def _load_lipi_user_map(db) -> dict[str, dict[str, str]]:
    """Username → display_name & puskesmas_nama untuk ekspor."""
    users = await db.users.find({}).to_list(5000)
    pk_ids = {str(u.get("puskesmas_id") or "") for u in users if u.get("puskesmas_id")}
    pk_map: dict[str, str] = {}
    for pid in pk_ids:
        if not pid:
            continue
        try:
            pk = await db.puskesmas.find_one({"_id": ObjectId(pid)})
        except Exception:
            pk = None
        if pk:
            pk_map[pid] = str(pk.get("nama") or "")
    out: dict[str, dict[str, str]] = {}
    for u in users:
        username = str(u.get("username") or "")
        if not username:
            continue
        pid = str(u.get("puskesmas_id") or "")
        out[username] = {
            "display_name": str(u.get("display_name") or "").strip(),
            "puskesmas_nama": pk_map.get(pid, ""),
        }
    return out


@admin_router.get("/lipi-quiz/export")
async def admin_export_lipi_quiz(
    username: str | None = Query(None, description="Filter username tertentu"),
    from_date: str | None = Query(None, alias="from", description="Tanggal mulai (YYYY-MM-DD)"),
    to_date: str | None = Query(None, alias="to", description="Tanggal akhir (YYYY-MM-DD)"),
    _: str = Depends(require_content_admin),
):
    """Unduh semua jawaban kuesioner gempa dalam format Excel beserta rumus skor."""
    db = get_db()
    query: dict[str, Any] = {}
    if username and username.strip():
        query["username"] = username.strip()

    if from_date or to_date:
        submitted_filter: dict[str, Any] = {}
        if from_date:
            try:
                start = datetime.strptime(from_date.strip(), "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Format 'from' harus YYYY-MM-DD") from exc
            submitted_filter["$gte"] = start
        if to_date:
            try:
                end = datetime.strptime(to_date.strip(), "%Y-%m-%d").replace(
                    hour=23, minute=59, second=59, tzinfo=timezone.utc,
                )
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="Format 'to' harus YYYY-MM-DD") from exc
            submitted_filter["$lte"] = end
        if submitted_filter:
            query["submitted_at"] = submitted_filter

    sessions = await db.lipi_quiz_sessions.find(query).sort("submitted_at", 1).to_list(10000)
    for doc in sessions:
        doc["_id"] = str(doc["_id"])

    from app.lipi_quiz_export import build_lipi_quiz_xlsx

    user_map = await _load_lipi_user_map(db)
    xlsx_bytes = build_lipi_quiz_xlsx(sessions, user_map)

    # Audit: excel export
    await log_action(ACTION_EXPORT, current_user["username"], {
        "export_type": "excel_skrining",
    })

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    filename = f"kuesioner-gempa-{stamp}.xlsx"
    return StreamingResponse(
        iter([xlsx_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ===========================================================================
# Skrining Kesiapsiagaan Endpoints
# ===========================================================================

def _index_level(score: float) -> str:
    if score >= 80:
        return "Tinggi"
    if score >= 60:
        return "Menengah"
    return "Rendah"


def _kesiapsiagaan_index(pg: float | None, sk: float | None, td: float | None, *, include_sikap: bool) -> tuple[float | None, str | None]:
    """Skala halaman skrining: Tinggi >=80, Menengah 60-79, Rendah <60.

    Pre-test memakai PG dan TD. Post-test menambah sikap.
    """
    parts: list[float] = []
    if pg is not None:
        parts.append(float(pg))
    if include_sikap and sk is not None and float(sk) > 0:
        parts.append(float(sk))
    if td is not None:
        parts.append(float(td))
    if pg is None or td is None or not parts:
        return None, None
    score = round(sum(parts) / len(parts), 1)
    return score, _index_level(score)


async def _saved_skrining_ai_report(db, username: str) -> dict[str, Any] | None:
    saved = await db.skrining_ai_reports.find_one({"username": username})
    report = (saved or {}).get("report")
    return report if isinstance(report, dict) else None


def _pdf_attempt_block(scores: dict[str, Any], submitted: str, *, include_sikap: bool) -> dict[str, Any]:
    pg = scores.get("pengetahuan_score")
    sk = scores.get("sikap_score")
    td = scores.get("tindakan_score")
    index_score, index_level = _kesiapsiagaan_index(pg, sk, td, include_sikap=include_sikap)
    sk_out = sk if include_sikap and sk and sk > 0 else None
    return {
        "index_score": index_score,
        "index_level": index_level,
        "pg_score": pg,
        "pg_level": scores.get("pengetahuan_level"),
        "ed_score": scores.get("efikasi_diri_score"),
        "ed_level": scores.get("efikasi_diri_level"),
        "sk_score": sk_out,
        "sk_level": scores.get("sikap_level") if sk_out is not None else None,
        "td_score": td,
        "td_level": scores.get("tindakan_level"),
        "submitted_at": submitted,
        "wrong_items": scores.get("wrong_items") or [],
    }


def _iso_value(value: Any) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


async def _skrining_get_user_info(db, username: str) -> dict[str, str]:
    """Get display_name and puskesmas_nama for a username."""
    user = await db.users.find_one({"username": username})
    if not user:
        return {"display_name": "", "puskesmas_nama": ""}
    pid = str(user.get("puskesmas_id") or "")
    pk_nama = ""
    if pid:
        try:
            pk = await db.puskesmas.find_one({"_id": ObjectId(pid)})
            if pk:
                pk_nama = str(pk.get("nama") or "")
        except Exception:
            pass
    return {
        "display_name": str(user.get("display_name") or "").strip(),
        "puskesmas_nama": pk_nama,
    }


async def _skrining_all_user_info(db) -> dict[str, dict[str, str]]:
    """Load all users' display_name and puskesmas_nama."""
    user_map: dict[str, dict[str, str]] = {}
    users = await db.users.find({}).to_list(5000)
    pk_ids = {str(u.get("puskesmas_id") or "") for u in users if u.get("puskesmas_id")}
    pk_map: dict[str, str] = {}
    for pid in pk_ids:
        if not pid:
            continue
        try:
            pk = await db.puskesmas.find_one({"_id": ObjectId(pid)})
        except Exception:
            pk = None
        if pk:
            pk_map[pid] = str(pk.get("nama") or "")
    for u in users:
        username = str(u.get("username") or "")
        if not username:
            continue
        pid = str(u.get("puskesmas_id") or "")
        user_map[username] = {
            "display_name": str(u.get("display_name") or "").strip(),
            "puskesmas_nama": pk_map.get(pid, ""),
        }
    return user_map


async def _score_from_session(doc: dict[str, Any]) -> dict[str, Any]:
    """Calculate scores from a session document."""
    answers = dict(doc.get("answers") or {})
    attempt = str(doc.get("attempt_type") or ATTEMPT_PRE)
    return calculate_lipi_score(answers, attempt)


@admin_router.get("/lipi-quiz/skrining/summary")
async def admin_skrining_summary(_: str = Depends(require_content_admin)):
    """Aggregate kesiapsiagaan index across all users for the monitoring widget."""
    db = get_db()

    user_map = await _skrining_all_user_info(db)

    sessions_by_user: dict[str, list[dict[str, Any]]] = {}
    async for doc in db.lipi_quiz_sessions.find({}):
        username = str(doc.get("username") or "")
        sessions_by_user.setdefault(username, []).append(doc)

    user_results: list[dict[str, Any]] = []
    high_count = 0
    medium_count = 0
    low_count = 0

    for username, user_docs in sessions_by_user.items():
        user_docs.sort(key=lambda d: str(d.get("submitted_at") or ""), reverse=True)

        best_doc: dict[str, Any] | None = None
        has_post_test = False
        for doc in user_docs:
            at = str(doc.get("attempt_type") or "")
            if at == ATTEMPT_POST:
                best_doc = doc
                has_post_test = True
                break
            if best_doc is None:
                best_doc = doc

        # Skip users without post-test — indeks hanya dihitung dari post-test
        if best_doc is None or not has_post_test:
            continue

        if best_doc is None:
            continue

        scores = await _score_from_session(best_doc)
        pg = scores.get("pengetahuan_score")
        sk = scores.get("sikap_score")
        td = scores.get("tindakan_score")

        components: list[float] = []
        if pg is not None:
            components.append(pg)
        if sk is not None and sk > 0:
            components.append(sk)
        if td is not None:
            components.append(td)

        if not components:
            index_score: float | None = None
            index_level: str | None = None
        else:
            index_score = round(sum(components) / len(components), 1)
            index_level = _index_level(index_score)

        user_info = user_map.get(username, {})
        submitted_at = best_doc.get("submitted_at")
        submitted_str = ""
        if submitted_at:
            if hasattr(submitted_at, "isoformat"):
                submitted_str = submitted_at.isoformat()
            else:
                submitted_str = str(submitted_at)

        user_results.append({
            "username": username,
            "display_name": user_info.get("display_name") or None,
            "puskesmas_nama": user_info.get("puskesmas_nama") or None,
            "index_score": index_score,
            "index_level": index_level,
            "pg_score": pg,
            "sk_score": sk if sk and sk > 0 else None,
            "td_score": td,
            "session_id": str(best_doc.get("_id", "")),
            "submitted_at": submitted_str,
            "attempt_type": str(best_doc.get("attempt_type") or ""),
        })

        if index_score is not None:
            if index_score >= 80:
                high_count += 1
            elif index_score >= 60:
                medium_count += 1
            else:
                low_count += 1

    total_users = len(user_results)
    with_index = sum(1 for r in user_results if r["index_score"] is not None)
    tanpa_index = 0  # semua user di user_results sudah punya post-test → semua terukur

    all_scores = [r["index_score"] for r in user_results if r["index_score"] is not None]
    avg_index = round(sum(all_scores) / len(all_scores), 1) if all_scores else None

    pg_scores = [r["pg_score"] for r in user_results if r["pg_score"] is not None]
    sk_scores = [r["sk_score"] for r in user_results if r["sk_score"] is not None]
    td_scores = [r["td_score"] for r in user_results if r["td_score"] is not None]

    avg_pg = round(sum(pg_scores) / len(pg_scores), 1) if pg_scores else None
    avg_sk = round(sum(sk_scores) / len(sk_scores), 1) if sk_scores else None
    avg_td = round(sum(td_scores) / len(td_scores), 1) if td_scores else None

    return {
        "total_users": total_users,
        "with_index_count": with_index,
        "tanpa_index_count": tanpa_index,
        "avg_index": avg_index,
        "high_count": high_count,
        "medium_count": medium_count,
        "low_count": low_count,
        "avg_pg": avg_pg,
        "avg_sk": avg_sk,
        "avg_td": avg_td,
        "users": user_results,
    }


@admin_router.get("/lipi-quiz/skrining/{username}")
async def admin_skrining_detail(username: str, _: str = Depends(require_content_admin)):
    """Detailed skrining result for one user."""
    db = get_db()

    user_info = await _skrining_get_user_info(db, username)

    sessions: list[dict[str, Any]] = []
    async for doc in db.lipi_quiz_sessions.find({"username": username}):
        sessions.append(doc)

    if not sessions:
        raise HTTPException(status_code=404, detail=f"Tidak ada sesi untuk username '{username}'")

    sessions.sort(key=lambda d: str(d.get("submitted_at") or ""), reverse=True)
    best_doc: dict[str, Any] | None = None
    for doc in sessions:
        at = str(doc.get("attempt_type") or "")
        if at == ATTEMPT_POST:
            best_doc = doc
            break
        if best_doc is None:
            best_doc = doc

    if best_doc is None:
        raise HTTPException(status_code=404, detail=f"Tidak ada sesi valid untuk '{username}'")

    scores = await _score_from_session(best_doc)
    pg = scores.get("pengetahuan_score")
    sk = scores.get("sikap_score")
    td = scores.get("tindakan_score")
    wrong_items = scores.get("wrong_items", [])

    enriched_wrong: list[dict[str, Any]] = []
    for item in wrong_items:
        qid = item.get("sub_id", "")
        q = _QUESTION_MAP.get(qid)
        if q:
            choice_map = {c["id"]: c["text"] for c in q.get("choices", [])}
            item = {
                **item,
                "question": q.get("text", ""),
                "your_answer_text": choice_map.get(item.get("your_answer", ""), item.get("your_answer", "")),
                "correct_answer_text": choice_map.get(item.get("correct_answer", ""), item.get("correct_answer", "")),
            }
        enriched_wrong.append(item)

    components: list[float] = []
    if pg is not None:
        components.append(pg)
    if sk is not None and sk > 0:
        components.append(sk)
    if td is not None:
        components.append(td)

    if not components:
        index_score = 0.0
    else:
        index_score = round(sum(components) / len(components), 1)
    index_level = _index_level(index_score)

    pg_level = _pct_baik_cukup_kurang(pg or 0)[0] if pg is not None else "-"
    sk_level = _pct_baik_cukup_kurang(sk or 0)[0] if sk is not None else "-"
    td_level = _tindakan_baik_buruk(td or 0)[0] if td is not None else "-"

    submitted_at = best_doc.get("submitted_at")
    submitted_str = ""
    if submitted_at:
        if hasattr(submitted_at, "isoformat"):
            submitted_str = submitted_at.isoformat()
        else:
            submitted_str = str(submitted_at)

    return {
        "username": username,
        "display_name": user_info.get("display_name") or None,
        "puskesmas_nama": user_info.get("puskesmas_nama") or None,
        "index_score": index_score,
        "index_level": index_level,
        "pg_score": pg,
        "pg_level": pg_level,
        "sk_score": sk if sk and sk > 0 else None,
        "sk_level": sk_level if sk and sk > 0 else None,
        "td_score": td,
        "td_level": td_level,
        "wrong_items": enriched_wrong,
        "attempt_type": str(best_doc.get("attempt_type") or ""),
        "submitted_at": submitted_str,
        "ai_recommendation": (str(best_doc.get("ai_recommendation") or "").strip() or None),
        "ai_report": await _saved_skrining_ai_report(db, username),
    }


_SKRINING_AI_SYSTEM = (
    "Kamu adalah analis penelitian kesiapsiagaan bencana untuk staf puskesmas. "
    "Analisis hasil kuesioner pengetahuan (pg), sikap (sk), dan tindakan (td) berikut. "
    "Berikan analisis penelitian dalam Bahasa Indonesia. "
    "Jawab JSON: {\"overall_analysis\": \"...\", \"key_findings\": [\"...\", \"...\"], "
    "\"commonly_wrong_questions\": [\"Pertanyaan: ... | Jawaban benar: ...\", ...], "
    "\"research_implications\": [\"...\", \"...\"], \"recommendations\": [\"...\", \"...\"]}"
)


@admin_router.get("/lipi-quiz/skrining/{username}/ai-report")
async def admin_skrining_ai_report(username: str, _: str = Depends(require_content_admin)):
    """Generate AI-powered research analysis for a user's skrining result."""
    db = get_db()

    sessions: list[dict[str, Any]] = []
    async for doc in db.lipi_quiz_sessions.find({"username": username}):
        sessions.append(doc)

    if not sessions:
        raise HTTPException(status_code=404, detail=f"Tidak ada sesi untuk username '{username}'")

    sessions.sort(key=lambda d: str(d.get("submitted_at") or ""), reverse=True)
    best_doc: dict[str, Any] | None = None
    for doc in sessions:
        at = str(doc.get("attempt_type") or "")
        if at == ATTEMPT_POST:
            best_doc = doc
            break
        if best_doc is None:
            best_doc = doc

    if best_doc is None:
        raise HTTPException(status_code=404, detail="Tidak ada sesi valid.")

    scores = await _score_from_session(best_doc)
    pg = scores.get("pengetahuan_score") or 0
    sk = scores.get("sikap_score") or 0
    td = scores.get("tindakan_score") or 0
    wrong_items = scores.get("wrong_items", [])

    wrong_lines = []
    for item in wrong_items[:8]:
        qid = item.get("sub_id", "")
        q = _QUESTION_MAP.get(qid)
        q_text = q.get("text", item.get("question", "")) if q else item.get("question", "")
        ca = item.get("correct_answer_text") or item.get("correct_answer", "")
        wrong_lines.append(f"Pertanyaan: {q_text} | Jawaban benar: {ca}")

    wrong_block = "\n".join(wrong_lines) if wrong_lines else "Tidak ada jawaban salah."

    user_prompt = (
        f"Username: {username}\n"
        f"Skor Pengetahuan (PG): {pg:.1f}%\n"
        f"Skor Sikap (SK): {sk:.1f}%\n"
        f"Skor Tindakan (TD): {td:.1f}%\n"
        f"Jawaban salah (pengetahuan):\n{wrong_block}"
    )

    result = await deepseek_json(
        system=_SKRINING_AI_SYSTEM,
        user=user_prompt,
        temperature=0.3,
        max_tokens=2048,
        read_timeout=120.0,
    )
    report = result if isinstance(result, dict) else {"overall_analysis": str(result)}
    await db.skrining_ai_reports.update_one(
        {"username": username},
        {"$set": {
            "username": username,
            "report": report,
            "updated_at": datetime.now(timezone.utc),
        }},
        upsert=True,
    )
    return report


def _enrich_wrong_items(wrong_items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    enriched: list[dict[str, Any]] = []
    for item in wrong_items:
        qid = item.get("sub_id", "")
        q = _QUESTION_MAP.get(qid)
        if q:
            choice_map = {c["id"]: c["text"] for c in q.get("choices", [])}
            item = {
                **item,
                "question": q.get("text", ""),
                "your_answer_text": choice_map.get(item.get("your_answer", ""), item.get("your_answer", "")),
                "correct_answer_text": choice_map.get(item.get("correct_answer", ""), item.get("correct_answer", "")),
            }
        enriched.append(item)
    return enriched


async def _activity_rows_for_pdf(db, username: str) -> dict[str, list[dict[str, Any]]]:
    video_titles: dict[str, str] = {}
    async for video in db.ml_videos.find({}):
        video_titles[str(video.get("_id"))] = str(video.get("title") or "Video")
    videos: list[dict[str, Any]] = []
    async for session in db.ml_learning_sessions.find({"username": username}):
        vid = str(session.get("video_id") or "")
        videos.append({
            "title": video_titles.get(vid, "Video"),
            "status": str(session.get("status") or ""),
            "knowledge_level": str(session.get("knowledge_level") or ""),
        })

    triages: list[dict[str, Any]] = []
    async for session in db.triage_game_sessions.find({"username": username}):
        order = session.get("case_order")
        triages.append({
            "status": str(session.get("status") or ""),
            "score": session.get("score"),
            "correct_count": session.get("correct_count"),
            "total_cases": len(order) if isinstance(order, list) else 0,
        })

    pelatihan_titles: dict[str, str] = {}
    async for row in db.pelatihan.find({}):
        pelatihan_titles[str(row.get("_id"))] = str(row.get("judul") or "Pelatihan")
    pelatihan: list[dict[str, Any]] = []
    async for row in db.pelatihan_peserta.find({"username": username}):
        pid = str(row.get("pelatihan_id") or "")
        pelatihan.append({
            "judul": pelatihan_titles.get(pid, "Pelatihan"),
            "hadir": bool(row.get("hadir")),
        })
    return {"videos": videos, "triages": triages, "pelatihan": pelatihan}


def _laporan_filename(username: str) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
    safe = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in username).strip("-") or "petugas"
    return f"laporan-skrining-{safe}-{stamp}.pdf"


async def _build_skrining_pdf_bytes(db, username: str, *, require_saved_ai: bool) -> bytes:
    """Susun PDF laporan dari sesi kuis petugas.

    Admin tetap wajib punya analisis AI tersimpan. Petugas memakai analisis
    pada sesi kuis bila laporan AI admin belum dibuat.
    """
    ai_report = await _saved_skrining_ai_report(db, username)
    if require_saved_ai and not ai_report:
        raise HTTPException(
            status_code=409,
            detail="Hasilkan analisis AI dulu. PDF menggabungkan analisis itu dengan data pre-test, post-test, video, dan triase.",
        )

    sessions: list[dict[str, Any]] = []
    async for doc in db.lipi_quiz_sessions.find({"username": username}):
        sessions.append(doc)
    if not sessions:
        raise HTTPException(status_code=404, detail="Belum ada hasil kuesioner untuk diunduh.")

    state = resolve_user_attempts(sessions)
    pre_doc = state.get("pre_session")
    post_doc = state.get("post_session")
    focus = post_doc or pre_doc
    if focus is None:
        raise HTTPException(status_code=404, detail="Tidak ada sesi valid.")

    async def _block(doc: dict[str, Any] | None, *, include_sikap: bool) -> dict[str, Any] | None:
        if not doc:
            return None
        scores = await _score_from_session(doc)
        return _pdf_attempt_block(scores, _iso_value(doc.get("submitted_at")), include_sikap=include_sikap)

    pre_block = await _block(pre_doc, include_sikap=False)
    post_block = await _block(post_doc, include_sikap=True)
    focus_block = post_block or pre_block or {}
    focus_scores = await _score_from_session(focus)
    wrong_items = _enrich_wrong_items(
        list((post_block or pre_block or {}).get("wrong_items") or focus_scores.get("wrong_items") or [])
    )
    activity = await _activity_rows_for_pdf(db, username)
    user_info = await _skrining_get_user_info(db, username)
    if ai_report:
        ai_text = json.dumps(ai_report, ensure_ascii=False)
    else:
        source = post_doc or pre_doc or {}
        ai_text = str(source.get("ai_recommendation") or "").strip()

    pdf_data: dict[str, Any] = {
        "username": username,
        "display_name": user_info.get("display_name") or None,
        "puskesmas_nama": user_info.get("puskesmas_nama") or None,
        "index_score": focus_block.get("index_score") or 0,
        "index_level": focus_block.get("index_level") or "Rendah",
        "pg_score": focus_block.get("pg_score"),
        "pg_level": focus_block.get("pg_level"),
        "sk_score": focus_block.get("sk_score"),
        "sk_level": focus_block.get("sk_level"),
        "td_score": focus_block.get("td_score"),
        "td_level": focus_block.get("td_level"),
        "wrong_items": wrong_items,
        "attempt_type": "pre_test dan post_test" if pre_doc and post_doc else str(focus.get("attempt_type") or ""),
        "submitted_at": focus_block.get("submitted_at") or "",
        "ai_recommendation": ai_text,
        "pre": pre_block,
        "post": post_block,
        **activity,
    }

    from app.lipi_quiz_skrining_pdf import build_skrining_pdf

    try:
        return build_skrining_pdf(pdf_data)
    except Exception as exc:
        log.exception("gagal menyusun PDF laporan skrining untuk %s", username)
        raise HTTPException(status_code=500, detail="Gagal menyusun PDF laporan.") from exc


def _pdf_attachment(pdf_bytes: bytes, filename: str) -> StreamingResponse:
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@public_router.get("/lipi-quiz/laporan")
async def my_skrining_laporan(username: str = Depends(get_current_user)):
    """PDF laporan hasil kuis milik petugas yang sedang login."""
    db = get_db()
    pdf_bytes = await _build_skrining_pdf_bytes(db, username, require_saved_ai=False)
    await log_action("skrining_download_pdf", username, {"target_username": username, "scope": "self"})
    return _pdf_attachment(pdf_bytes, _laporan_filename(username))


@admin_router.get("/lipi-quiz/skrining/{username}/download-pdf")
async def admin_skrining_download_pdf(username: str, admin_name: str = Depends(require_content_admin)):
    """PDF lengkap. Hanya setelah analisis AI untuk petugas ini sudah disimpan."""
    db = get_db()
    pdf_bytes = await _build_skrining_pdf_bytes(db, username, require_saved_ai=True)
    await log_action("skrining_download_pdf", admin_name, {"target_username": username})
    return _pdf_attachment(pdf_bytes, _laporan_filename(username))


# ===========================================================================
# Privacy & Audit Endpoints
# ===========================================================================


@admin_router.delete("/lipi-quiz/session/{session_id}")
async def delete_screening_session(
    session_id: str,
    current_user = Depends(require_content_admin),
):
    """Hapus satu sesi skrining. Audit trail dicatat."""
    db = await get_db()
    try:
        oid = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID sesi tidak valid")

    doc = await db["lipi_quiz_sessions"].find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Sesi tidak ditemukan")

    await db["lipi_quiz_sessions"].delete_one({"_id": oid})
    await log_action(ACTION_SKRINING_DELETE, current_user["username"], {
        "deleted_session_id": session_id,
        "deleted_username": doc.get("username"),
    })
    return {"ok": True, "message": "Sesi skrining berhasil dihapus"}


@admin_router.get("/audit-log")
async def list_audit_log(
    limit: int = Query(50, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user = Depends(require_content_admin),
):
    """Ambil log audit (admin only)."""
    from app.audit import _COLLECTION

    db = await get_db()
    total = await db[_COLLECTION].count_documents({})
    logs = (
        await db[_COLLECTION]
        .find()
        .sort("timestamp", -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )
    for log in logs:
        log.pop("_id", None)
        if log.get("timestamp"):
            log["timestamp"] = log["timestamp"].isoformat()
    return {"logs": logs, "total": total, "skip": skip, "limit": limit}
