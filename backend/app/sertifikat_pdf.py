"""Tempel nama peserta ke template sertifikat Puskesmas Pantoloan dan Talise.

Template asli berupa gambar (tanpa lapisan teks). Posisi nama diukur dari
halaman depan landscape A4 (842 x 595 pt):

- bingkai emas dalam: x 69–772, pusat horizontal 420.5
- tinta "Diberikan kepada :" berakhir di y ≈ 193
- tinta "atas partisipasi …" mulai di y ≈ 266
- nama diletakkan di tengah celah itu (pusat visual y = 229)
"""

from __future__ import annotations

import re
from pathlib import Path

import fitz

_ASSETS = Path(__file__).resolve().parent / "assets" / "sertifikat"
_FONT = Path("/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf")

# Pusat horizontal bingkai emas, dan pusat vertikal celah nama.
_CENTER_X = 420.5
_CENTER_Y = 229.0
_MAX_TEXT_WIDTH = 620.0
_FONT_MAX = 22.0
_FONT_MIN = 13.0
# Biru judul "SERTIFIKAT" pada template (diambil dari piksel tinta).
_NAME_COLOR = (20 / 255, 60 / 255, 110 / 255)

TEMPLATES: dict[str, tuple[str, str]] = {
    "pantoloan": ("pantoloan.pdf", "Puskesmas Pantoloan"),
    "talise": ("talise.pdf", "Puskesmas Talise"),
}


def certificate_puskesmas_key(*labels: str | None) -> str | None:
    """Kenali Pantoloan atau Talise dari nama puskesmas / username."""
    blob = " ".join(str(part or "") for part in labels).lower()
    if "pantoloan" in blob:
        return "pantoloan"
    if "talise" in blob:
        return "talise"
    return None


def clean_certificate_name(raw: str) -> str:
    name = " ".join(str(raw or "").split())
    if len(name) < 2 or len(name) > 80:
        raise ValueError("Nama sertifikat harus 2–80 karakter.")
    if re.search(r"[\x00-\x1f]", name):
        raise ValueError("Nama sertifikat berisi karakter yang tidak valid.")
    return name


def _fit_fontsize(font: fitz.Font, name: str) -> float:
    size = _FONT_MAX
    while size > _FONT_MIN and font.text_length(name, fontsize=size) > _MAX_TEXT_WIDTH:
        size -= 0.5
    return size


def stamp_certificate_name(template_key: str, name: str) -> bytes:
    """Kembalikan PDF sertifikat dengan nama sudah tertempel di halaman depan."""
    if template_key not in TEMPLATES:
        raise ValueError("Template sertifikat tidak dikenal.")
    cleaned = clean_certificate_name(name)
    filename, _label = TEMPLATES[template_key]
    template_path = _ASSETS / filename
    if not template_path.is_file():
        raise FileNotFoundError(f"Template sertifikat tidak ditemukan: {filename}")
    if not _FONT.is_file():
        raise FileNotFoundError("Font sertifikat tidak tersedia di server.")

    doc = fitz.open(template_path)
    try:
        page = doc[0]
        font = fitz.Font(fontfile=str(_FONT))
        size = _fit_fontsize(font, cleaned)
        width = font.text_length(cleaned, fontsize=size)
        ascender = font.ascender * size
        descender = font.descender * size  # negatif
        baseline = _CENTER_Y + (ascender + descender) / 2
        x = _CENTER_X - width / 2
        page.insert_text(
            fitz.Point(x, baseline),
            cleaned,
            fontname="sertif-name",
            fontfile=str(_FONT),
            fontsize=size,
            color=_NAME_COLOR,
        )
        return doc.tobytes(deflate=True, garbage=3)
    finally:
        doc.close()


def name_text_bbox(pdf_bytes: bytes) -> fitz.Rect | None:
    """Kotak teks nama yang baru ditambahkan (satu-satunya teks di template gambar)."""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        words = doc[0].get_text("words")
        if not words:
            return None
        x0 = min(w[0] for w in words)
        y0 = min(w[1] for w in words)
        x1 = max(w[2] for w in words)
        y1 = max(w[3] for w in words)
        return fitz.Rect(x0, y0, x1, y1)
    finally:
        doc.close()
