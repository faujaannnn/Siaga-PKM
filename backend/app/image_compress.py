"""Kompresi gambar unggahan agar lebih ringan di slider/galeri profil."""

from __future__ import annotations

from io import BytesIO

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    Image = None  # type: ignore[misc, assignment]
    ImageOps = None  # type: ignore[misc, assignment]

_IMAGE_SUFFIXES = frozenset({".jpg", ".jpeg", ".png", ".webp", ".gif"})
_MAX_EDGE = 1280
_JPEG_QUALITY = 82
_WEBP_QUALITY = 82


def compress_image_upload(data: bytes, suffix: str) -> tuple[bytes, str]:
    """
    Perkecil dimensi & ukuran berkas gambar profil/galeri.
    Mengembalikan (bytes, suffix_baru) — suffix bisa berubah (.png → .webp / .jpg).
    """
    ext = suffix.lower()
    if ext not in _IMAGE_SUFFIXES:
        return data, suffix
    if Image is None or ImageOps is None:
        return data, suffix
    if ext == ".gif":
        return data, suffix

    try:
        im = Image.open(BytesIO(data))
        im.load()
    except Exception:
        return data, suffix

    if getattr(im, "is_animated", False):
        return data, suffix

    try:
        im = ImageOps.exif_transpose(im)
    except Exception:
        pass

    w, h = im.size
    if max(w, h) > _MAX_EDGE:
        im.thumbnail((_MAX_EDGE, _MAX_EDGE), Image.Resampling.LANCZOS)

    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)

    out = BytesIO()
    if has_alpha:
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        im.save(out, format="WEBP", quality=_WEBP_QUALITY, method=4)
        return out.getvalue(), ".webp"

    rgb = im.convert("RGB") if im.mode != "RGB" else im
    rgb.save(out, format="JPEG", quality=_JPEG_QUALITY, optimize=True, progressive=True)
    return out.getvalue(), ".jpg"
