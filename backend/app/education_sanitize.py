"""Normalisasi payload edukasi dari upload otomatis (Momo / agent)."""

from __future__ import annotations

import re

from siaga_common.google_drive_id import parse_google_drive_file_id

_PLACEHOLDER_BODY = "FILE_DOKUMEN_PDF_ATTACHED"
_PAGE_SUFFIX = re.compile(r"\.\s*\d+\s*halaman\.?\s*$", re.I)
_FILENAME_TITLE = re.compile(r"^[A-Z0-9][A-Za-z0-9_.-]{8,}$")


def _drive_id(url: str) -> str | None:
    return parse_google_drive_file_id((url or "").strip())


def _looks_like_filename_title(title: str) -> bool:
    t = (title or "").strip()
    if not t:
        return False
    if "_" in t and " " not in t:
        return True
    if _FILENAME_TITLE.match(t.replace(" ", "_")):
        return True
    return False


def _title_from_description(description: str) -> str:
    d = (description or "").strip()
    if not d:
        return ""
    return _PAGE_SUFFIX.sub("", d).strip().rstrip(".")


def sanitize_education_fields(doc: dict) -> dict:
    """
    Bersihkan duplikasi Momo: lampiran = URL utama, body placeholder, judul = nama berkas.
    Mengembalikan patch $set (kosong jika tidak ada perubahan).
    """
    patch: dict = {}

    body = str(doc.get("body") or "").strip()
    if body == _PLACEHOLDER_BODY:
        patch["body"] = ""

    url = str(doc.get("url") or "").strip()
    main_id = _drive_id(url)
    raw_attachments = doc.get("attachments") or []
    if isinstance(raw_attachments, list) and raw_attachments:
        kept: list[dict] = []
        for item in raw_attachments:
            if not isinstance(item, dict):
                continue
            att_url = str(item.get("url") or "").strip()
            if not att_url:
                continue
            att_id = _drive_id(att_url)
            if main_id and att_id == main_id:
                continue
            kept.append({"url": att_url, "name": str(item.get("name") or "").strip()})
        if len(kept) != len(raw_attachments):
            patch["attachments"] = kept

    title = str(doc.get("title") or "").strip()
    description = str(doc.get("description") or "").strip()
    if description and (_looks_like_filename_title(title) or not title):
        human = _title_from_description(description)
        if human:
            patch["title"] = human
            patch["description"] = ""
    elif description and title and description.lower().startswith(title.lower()[:40]):
        patch["description"] = ""

    return patch
