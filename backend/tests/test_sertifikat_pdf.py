"""Nama sertifikat harus jatuh di celah 'Diberikan kepada' dan 'atas partisipasi'."""

import pytest

from app.sertifikat_pdf import (
    certificate_puskesmas_key,
    clean_certificate_name,
    name_text_bbox,
    stamp_certificate_name,
)

# Diukur dari template 72 dpi: tinta "Diberikan kepada" berakhir ~193,
# tinta "atas partisipasi" mulai ~266. Pusat bingkai emas x = 420.5.
_GAP_TOP = 198.0
_GAP_BOTTOM = 260.0
_CENTER_X = 420.5


@pytest.mark.parametrize(
    ("key", "nama"),
    [
        ("pantoloan", "Siti Aminah"),
        ("pantoloan", "I Made Muliyanto, S.KM."),
        ("pantoloan", "Dr. dr. M. Ardi Munir, M.Kes., Sp.OT., FICS."),
        ("talise", "Rahmat Massi, S.KM., M.AP."),
        ("talise", "Yoga Pratama"),
    ],
)
def test_nama_di_celah_diberikan_kepada(key: str, nama: str):
    pdf = stamp_certificate_name(key, nama)
    box = name_text_bbox(pdf)
    assert box is not None
    center_x = (box.x0 + box.x1) / 2
    center_y = (box.y0 + box.y1) / 2
    assert abs(center_x - _CENTER_X) < 2
    assert _GAP_TOP <= box.y0
    assert box.y1 <= _GAP_BOTTOM
    assert 210 <= center_y <= 248
    assert box.x0 > 80
    assert box.x1 < 760

    import fitz

    doc = fitz.open(stream=pdf, filetype="pdf")
    try:
        text = " ".join(w[4] for w in doc[0].get_text("words"))
    finally:
        doc.close()
    assert text == nama


def test_nama_terlalu_pendek_ditolak():
    with pytest.raises(ValueError):
        clean_certificate_name("  A ")


def test_kunci_puskesmas():
    assert certificate_puskesmas_key("Puskesmas Pantoloan") == "pantoloan"
    assert certificate_puskesmas_key(None, "Puskesmas Talise") == "talise"
    assert certificate_puskesmas_key("pantoloan07") == "pantoloan"
    assert certificate_puskesmas_key("Puskesmas Lain") is None
