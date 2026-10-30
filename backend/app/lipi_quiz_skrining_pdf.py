"""Generator PDF Laporan Skrining Tingkat Kesiapsiagaan Gempa."""

from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from typing import Any

from fpdf import FPDF

from app.routers.lipi_quiz import (
    LIPI_QUESTIONS,
    _QUESTION_MAP,
)

# ─── Warna ────────────────────────────────────────────────────────────────────
_C_DARK_BLUE = (31, 78, 121)    # #1F4E79 – header
_C_LIGHT_BLUE = (214, 228, 240) # #D6E4F0 – subheader bg
_C_EMERALD    = (39, 174, 96)   # #27AE60 – tinggi
_C_AMBER      = (243, 156, 18)  # #F39C12 – menengah
_C_RED        = (231, 76, 60)   # #E74C3C – rendah
_C_SILVER     = (189, 195, 199) # #BDC1C7 – border
_C_WHITE      = (255, 255, 255)
_C_BLACK      = (30, 30, 30)
_C_GREY_TEXT  = (80, 80, 80)


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip('#')
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _level_rgb(level: str) -> tuple[int, int, int]:
    if level == "Tinggi":   return _C_EMERALD
    if level == "Menengah": return _C_AMBER
    return _C_RED


def _level_color_name(level: str) -> str:
    if level == "Tinggi":   return "Hijau (Tinggi)"
    if level == "Menengah": return "Kuning (Menengah)"
    return "Merah (Rendah)"


# ─── Skor kategori tiap dimensi ────────────────────────────────────────────────
def _pg_level(pct: float) -> str:
    if pct >= 76: return "Baik"
    if pct >= 56: return "Cukup"
    return "Kurang"

def _td_level(pct: float) -> str:
    return "Baik" if pct >= 50 else "Buruk"


# ─── Helper PDF ───────────────────────────────────────────────────────────────
def _fmt(val: Any) -> str:
    if val is None: return "—"
    if isinstance(val, float): return f"{val:.1f}"
    return str(val)

def _fmt_dt(iso: str) -> str:
    if not iso: return "—"
    try:
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%d %b %Y, %H:%M WIB")
    except Exception:
        return str(iso)


class SkriningPDF(FPDF):
    def __init__(self, *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
        bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
        self.add_font("DejaVu", "", regular)
        self.add_font("DejaVu", "B", bold)
        self.add_font("DejaVu", "I", regular)

    def header(self) -> None:
        # Tidak pakai default header
        pass

    def footer(self) -> None:
        self.set_y(-15)
        self.set_font("DejaVu", "I", 8)
        self.set_text_color(*_C_SILVER)
        self.cell(0, 10, f"Skrining Kesiapsiagaan Gempa — SiAP-PKM  |  Halaman {self.page_no()}", align="C")


# ─── Main builder ─────────────────────────────────────────────────────────────
def build_skrining_pdf(data: dict[str, Any]) -> bytes:
    """
    Parameters (data dict):
        username, display_name, puskesmas_nama, index_score, index_level,
        pg_score, pg_level, sk_score, sk_level, td_score, td_level,
        wrong_items[], attempt_type, submitted_at, generated_at
    """
    pdf = SkriningPDF(orientation="P", unit="mm", format="A4")
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # ── KOP SURAT / HEADER ──────────────────────────────────────────────────
    pdf.set_fill_color(*_C_DARK_BLUE)
    pdf.rect(0, 0, 210, 45, "F")

    pdf.set_font("DejaVu", "B", 16)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(10, 8)
    pdf.cell(190, 8, "LAPORAN SKRINING TINGKAT KESIAPSIAGAAN", align="C", ln=True)

    pdf.set_font("DejaVu", "", 10)
    pdf.set_xy(10, 18)
    pdf.cell(190, 6, "Gempa Bumi di Lingkungan Puskesmas", align="C", ln=True)

    pdf.set_font("DejaVu", "I", 9)
    pdf.set_xy(10, 25)
    pdf.cell(190, 5, "Kuesioner Kesiapsiagaan Gempa Bumi — SiAP-PKM", align="C", ln=True)

    pdf.set_font("DejaVu", "", 8)
    pdf.set_xy(10, 32)
    tanggal = _fmt_dt(data.get("generated_at") or datetime.now(timezone.utc).isoformat())
    pdf.cell(190, 5, f"Dicetak: {tanggal}", align="C", ln=True)

    # ── INFO PETUGAS ─────────────────────────────────────────────────────────
    y = 50
    pdf.set_xy(10, y)
    pdf.set_fill_color(*_C_LIGHT_BLUE)
    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(*_C_DARK_BLUE)
    pdf.cell(190, 7, "  IDENTITAS PETUGAS", fill=True, ln=True)

    y += 8
    rows_info = [
        ("Username",       data.get("username", "—")),
        ("Nama Lengkap",   data.get("display_name") or "—"),
        ("Puskesmas",      data.get("puskesmas_nama") or "—"),
        ("Tipe Pengisian",  data.get("attempt_type", "—").replace("_", " ").title()),
        ("Waktu Submit",   _fmt_dt(data.get("submitted_at", ""))),
    ]
    for label, value in rows_info:
        pdf.set_font("DejaVu", "B", 9)
        pdf.set_text_color(*_C_DARK_BLUE)
        pdf.set_xy(12, y)
        pdf.cell(50, 6, f"{label}:", ln=False)
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(*_C_BLACK)
        pdf.cell(128, 6, str(value), ln=True)
        y += 6

    y += 4

    # ── RINGKASAN INDEKS ─────────────────────────────────────────────────────
    idx = data.get("index_score") or 0
    level = data.get("index_level", "Rendah")
    r, g, b = _level_rgb(level)

    pdf.set_xy(10, y)
    pdf.set_fill_color(*_C_LIGHT_BLUE)
    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(*_C_DARK_BLUE)
    pdf.cell(190, 7, "  1. RINGKASAN INDEKS KESIAPSIAGAAN", fill=True, ln=True)
    y += 9

    # Box besar skor indeks
    box_h = 30
    pdf.set_fill_color(r, g, b)
    pdf.set_draw_color(r, g, b)
    pdf.rect(10, y, 190, box_h, "FD")

    pdf.set_font("DejaVu", "B", 22)
    pdf.set_text_color(255, 255, 255)
    pdf.set_xy(10, y + 2)
    pdf.cell(190, 14, f"  {idx:.0f}", align="L", ln=True)

    pdf.set_font("DejaVu", "B", 11)
    pdf.set_xy(10, y + 16)
    pdf.cell(190, 8, f"  Tingkat Kesiapsiagaan: {level.upper()}  |  Klasifikasi: {_level_color_name(level)}", align="L", ln=True)
    y += box_h + 6

    # Keterangan klasifikasi
    pdf.set_font("DejaVu", "", 8)
    pdf.set_text_color(*_C_GREY_TEXT)
    pdf.set_xy(10, y)
    if level == "Tinggi":
        pdf.multi_cell(190, 4.5,
            "Indeks berada pada rentang 80–100. Petugas menunjukkan kesiapsiagaan tinggi dalam "
            "pengetahuan, sikap, dan tindakan kesiapsiagaan gempa.", align="L")
    elif level == "Menengah":
        pdf.multi_cell(190, 4.5,
            "Indeks berada pada rentang 60–79. Petugas menunjukkan kesiapsiagaan menengah. "
            "Perlu penguatan pada dimensi tertentu yang skornya di bawah 80.", align="L")
    else:
        pdf.multi_cell(190, 4.5,
            "Indeks di bawah 60. Petugas membutuhkan penguatan signifikan pada dimensi "
            "pengetahuan, sikap, dan/atau tindakan kesiapsiagaan.", align="L")
    y = pdf.get_y() + 4

    # ── DETAIL SKOR PER DIMENSI ─────────────────────────────────────────────
    pdf.set_xy(10, y)
    pdf.set_fill_color(*_C_LIGHT_BLUE)
    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(*_C_DARK_BLUE)
    pdf.cell(190, 7, "  2. DETAIL SKOR PER DIMENSI", fill=True, ln=True)
    y += 8

    # Tabel header
    col_w = [60, 35, 35, 60]
    headers = ["Dimensi", "Skor (%)", "Skala", "Kategori"]
    pdf.set_fill_color(*_C_DARK_BLUE)
    pdf.set_font("DejaVu", "B", 9)
    pdf.set_text_color(255, 255, 255)
    for i, (h, w) in enumerate(zip(headers, col_w)):
        pdf.set_xy(10 + sum(col_w[:i]), y)
        pdf.cell(w, 7, f" {h}", fill=True, ln=(i == len(headers) - 1))
    y += 7

    # Baris data
    dimensis = [
        ("Pengetahuan (PG)",   data.get("pg_score"),   f"0–100%",  _pg_level(data.get("pg_score") or 0)),
        ("Sikap (SK)",         data.get("sk_score"),   f"0–100%",  data.get("sk_level") or ("—" if data.get("sk_score") is None else _pg_level(data.get("sk_score") or 0))),
        ("Tindakan (TD)",      data.get("td_score"),   f"0–100%",  _td_level(data.get("td_score") or 0)),
    ]

    for i, (dim, score, skala, kat) in enumerate(dimensis):
        fill = (i % 2 == 0)
        pdf.set_fill_color(*_C_LIGHT_BLUE if fill else (245, 245, 245))
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(*_C_BLACK)
        vals = [_fmt(score), skala, kat]
        for j, (v, w) in enumerate(zip(vals, col_w[1:])):
            pdf.set_xy(10 + col_w[0] + sum(col_w[1:j]), y)
            pdf.cell(w, 6.5, f" {v}", fill=fill, ln=(j == 2))
        pdf.set_xy(10, y)
        pdf.cell(col_w[0], 6.5, f" {dim}", fill=fill, ln=True)
        y += 6.5

    # Catatan sikap null
    if data.get("sk_score") is None:
        pdf.set_font("DejaVu", "I", 8)
        pdf.set_text_color(*_C_AMBER)
        pdf.set_xy(10, y)
        pdf.cell(190, 5, "  * Dimensi Sikap (SK) hanya tersedia pada post-test. Pre-test belum mengukur sikap.", ln=True)
        y += 5

    y += 4

    # ── RUMUS PERHITUNGAN ────────────────────────────────────────────────────
    pdf.set_xy(10, y)
    pdf.set_fill_color(*_C_LIGHT_BLUE)
    pdf.set_font("DejaVu", "B", 10)
    pdf.set_text_color(*_C_DARK_BLUE)
    pdf.cell(190, 7, "  3. RUMUS PERHITUNGAN INDEKS", fill=True, ln=True)
    y += 8

    # Box rumus
    pdf.set_fill_color(245, 248, 252)
    pdf.set_draw_color(*_C_SILVER)
    pdf.set_font("DejaVu", "", 9)
    pdf.set_text_color(*_C_BLACK)

    rumus_lines = [
        "Indeks Kesiapsiagaan = Rata-rata skor dimensi yang tersedia",
        "",
        "  Pre-test (2 dimensi):   Indeks = (Skor PG + Skor TD) / 2",
        "  Post-test (3 dimensi):  Indeks = (Skor PG + Skor SK + Skor TD) / 3",
        "",
        "  Klasifikasi:",
        "    • Tinggi   (80–100): Kesiapsiagaan tinggi",
        "    • Menengah (60-79):  Kesiapsiagaan menengah, perlu penguatan",
        "    • Rendah  (<60):    Kesiapsiagaan rendah — butuh intervensi segera",
        "",
        "  Pengetahuan (PG): (jumlah benar / 8) x 100%  |  Kategori: Baik ≥76%, Cukup 56–75%, Kurang <56%",
        "  Sikap (SK):        (jumlah poin Likert / 75) x 100%  |  Post-test only",
        "  Tindakan (TD):     (jumlah poin / maks raw) x 100%  |  Kategori: Baik ≥50%, Buruk <50%",
    ]
    for line in rumus_lines:
        pdf.set_xy(12, y)
        pdf.cell(188, 5, line, ln=True)
        y += 5
    y += 2

    # ── ANALISIS SOAL SALAH ──────────────────────────────────────────────────
    wrong_items: list[dict] = data.get("wrong_items", [])
    if wrong_items:
        pdf.set_xy(10, y)
        pdf.set_fill_color(*_C_LIGHT_BLUE)
        pdf.set_font("DejaVu", "B", 10)
        pdf.set_text_color(*_C_DARK_BLUE)
        pdf.cell(190, 7, f"  4. ANALISIS SOAL PENGETAHUAN YANG SALAH ({len(wrong_items)} butir)", fill=True, ln=True)
        y += 8

        for i, item in enumerate(wrong_items, start=1):
            qid = item.get("sub_id", "?")
            q_text = item.get("question", item.get("sub_text", "—"))
            your_ans = item.get("your_answer_text") or item.get("your_answer", "—")
            correct_ans = item.get("correct_answer_text") or item.get("correct_answer", "—")

            # Pertanyaan
            pdf.set_fill_color(252, 252, 252)
            pdf.set_draw_color(*_C_SILVER)
            pdf.set_font("DejaVu", "B", 8.5)
            pdf.set_text_color(*_C_RED)
            pdf.set_xy(10, y)
            pdf.cell(190, 5.5, f"  {i}. [{qid}] {q_text[:120]}{'...' if len(q_text) > 120 else ''}", fill=True, ln=True)
            y += 5.5

            # Jawaban
            pdf.set_font("DejaVu", "", 8.5)
            pdf.set_text_color(*_C_GREY_TEXT)
            pdf.set_xy(14, y)
            pdf.cell(80, 5, f"Jawaban Anda: {your_ans}", ln=False)
            pdf.set_xy(104, y)
            pdf.set_text_color(39, 174, 96)
            pdf.cell(96, 5, f"  Jawaban Benar: {correct_ans}", ln=True)
            y += 5

            if y > 265:
                pdf.add_page()
                y = 15
        y += 2

    # ── REKOMENDASI ─────────────────────────────────────────────────────────
    rec = data.get("ai_recommendation") or data.get("recommendation") or ""
    if rec:
        if y > 240:
            pdf.add_page()
            y = 15
        pdf.set_xy(10, y)
        pdf.set_fill_color(*_C_LIGHT_BLUE)
        pdf.set_font("DejaVu", "B", 10)
        pdf.set_text_color(*_C_DARK_BLUE)
        pdf.cell(190, 7, "  5. REKOMENDASI & ANALISIS", fill=True, ln=True)
        y += 8

        # Parse JSON recommendation if present
        import json
        rec_data = None
        if rec.startswith("{"):
            try:
                rec_data = json.loads(rec)
            except Exception:
                pass

        if rec_data:
            overview = rec_data.get("overall_analysis") or rec_data.get("recommendation", "")
            if overview:
                pdf.set_font("DejaVu", "B", 9)
                pdf.set_text_color(*_C_DARK_BLUE)
                pdf.set_xy(12, y)
                pdf.cell(188, 5, "Analisis Keseluruhan:", ln=True)
                y += 5
                pdf.set_font("DejaVu", "", 8.5)
                pdf.set_text_color(*_C_BLACK)
                pdf.set_xy(14, y)
                pdf.multi_cell(184, 4.5, overview, align="L")
                y = pdf.get_y() + 3

            for section_key, label in [
                ("key_findings", "Temuan Kunci"),
                ("research_implications", "Implikasi Penelitian"),
                ("recommendations", "Rekomendasi"),
                ("action_steps", "Langkah Tindakan"),
            ]:
                items = rec_data.get(section_key, [])
                if items:
                    pdf.set_font("DejaVu", "B", 9)
                    pdf.set_text_color(*_C_DARK_BLUE)
                    pdf.set_xy(12, y)
                    pdf.cell(188, 5, f"{label}:", ln=True)
                    y += 5
                    for item in (items if isinstance(items, list) else []):
                        pdf.set_font("DejaVu", "", 8.5)
                        pdf.set_text_color(*_C_BLACK)
                        pdf.set_xy(14, y)
                        pdf.multi_cell(184, 4.5, f"• {item}", align="L")
                        y = pdf.get_y() + 1
                        if y > 265:
                            pdf.add_page()
                            y = 15
                    y += 2
        else:
            # Plain text recommendation
            pdf.set_font("DejaVu", "", 8.5)
            pdf.set_text_color(*_C_BLACK)
            pdf.set_xy(12, y)
            pdf.multi_cell(186, 4.5, rec[:2000], align="L")
            y = pdf.get_y()

    def _heading(title: str) -> None:
        nonlocal y
        if y > 250:
            pdf.add_page()
            y = 15
        pdf.set_xy(10, y)
        pdf.set_fill_color(*_C_LIGHT_BLUE)
        pdf.set_font("DejaVu", "B", 10)
        pdf.set_text_color(*_C_DARK_BLUE)
        pdf.cell(190, 7, f"  {title}", fill=True, ln=True)
        y = pdf.get_y() + 2

    def _lines(rows: list[str]) -> None:
        nonlocal y
        pdf.set_font("DejaVu", "", 9)
        pdf.set_text_color(*_C_BLACK)
        for row in rows:
            if y > 272:
                pdf.add_page()
                y = 15
            pdf.set_xy(12, y)
            pdf.multi_cell(186, 4.6, row)
            y = pdf.get_y()

    def _attempt_rows(label: str, block: dict[str, Any] | None) -> list[str]:
        if not block:
            return [f"{label}: belum ada."]
        idx = block.get("index_score")
        level = block.get("index_level") or "-"
        head = f"{label}: belum dihitung." if idx is None else f"{label}: indeks {idx} ({level}). Tinggi >=80, Menengah 60-79, Rendah <60."
        sk = block.get("sk_score")
        return [
            head,
            f"  Pengetahuan { _fmt(block.get('pg_score')) }% ({block.get('pg_level') or '-'})",
            f"  Efikasi diri { _fmt(block.get('ed_score')) }/40 ({block.get('ed_level') or '-'})",
            f"  Sikap { _fmt(sk) }% ({block.get('sk_level') or '-'})",
            f"  Tindakan { _fmt(block.get('td_score')) }% ({block.get('td_level') or '-'})",
            f"  Waktu { _fmt_dt(str(block.get('submitted_at') or '')) }",
        ]

    _heading("6. PRE-TEST DAN POST-TEST")
    _lines(_attempt_rows("Pre-test", data.get("pre")) + [""] + _attempt_rows("Post-test", data.get("post")))

    videos = list(data.get("videos") or [])
    _heading("7. VIDEO PEMBELAJARAN")
    if not videos:
        _lines(["Belum ada sesi video."])
    else:
        _lines([
            f"- {v.get('title') or 'Video'} | status {v.get('status') or '-'} | level {v.get('knowledge_level') or '-'}"
            for v in videos[:40]
        ])

    triages = list(data.get("triages") or [])
    _heading("8. LATIHAN TRIASE")
    if not triages:
        _lines(["Belum ada sesi triase."])
    else:
        _lines([
            f"- status {t.get('status') or '-'} | skor {t.get('score') if t.get('score') is not None else '-'} | benar {t.get('correct_count') if t.get('correct_count') is not None else '-'}/{t.get('total_cases') or '-'}"
            for t in triages[:40]
        ])

    pelatihan = list(data.get("pelatihan") or [])
    _heading("9. PELATIHAN")
    if not pelatihan:
        _lines(["Belum ada data kehadiran pelatihan."])
    else:
        _lines([
            f"- {p.get('judul') or 'Pelatihan'} | {'hadir' if p.get('hadir') else 'belum hadir'}"
            for p in pelatihan[:40]
        ])

    buf = BytesIO()
    pdf.output(buf)
    return buf.getvalue()
