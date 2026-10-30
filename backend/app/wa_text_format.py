"""Normalisasi teks outbound WhatsApp: markdown LLM → format *tebal* WA, tanpa ** yatim."""

from __future__ import annotations

import re

_CODE_FENCE = re.compile(r"```[\s\S]*?```", re.MULTILINE)
_MD_BOLD = re.compile(r"\*\*([^*\n]+?)\*\*")
_MD_BOLD_US = re.compile(r"__([^_\n]+?)__")


def format_text_for_whatsapp(text: str) -> str:
    """Ubah **tebal** markdown ke *tebal* WA; buang ** / * yatim di ujung baris atau pesan."""
    s = (text or "").strip()
    if not s:
        return s

    s = _CODE_FENCE.sub("", s)
    s = _MD_BOLD.sub(r"*\1*", s)
    s = _MD_BOLD_US.sub(r"*\1*", s)

    # Sisa ** (LLM tidak menutup, atau terpotong saat split) → hapus
    s = s.replace("**", "")

    # Baris hanya asterisk
    s = re.sub(r"^\*+\s*$", "", s, flags=re.MULTILINE)

    # Satu * tidak berpasang di akhir seluruh pesan
    s = _strip_unbalanced_trailing_asterisks(s)
    s = _fix_unbalanced_asterisks(s)

    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def _fix_unbalanced_asterisks(s: str) -> str:
    """Hapus * tunggal yang tidak punya pasangan (mis. *penyakit setelah ** dibersihkan)."""
    out = s
    while out.count("*") % 2 == 1:
        if out.endswith("*"):
            out = out[:-1].rstrip()
        elif out.startswith("*"):
            out = out[1:].lstrip()
        else:
            pos = out.rfind("*")
            if pos == -1:
                break
            out = out[:pos] + out[pos + 1 :]
    return out


def _strip_unbalanced_trailing_asterisks(s: str) -> str:
    """Hapus * penutup yang tidak punya pasangan (sering muncul setelah konversi markdown)."""
    out = s
    while out.endswith("*"):
        if out.count("*") % 2 == 0:
            break
        out = out[:-1].rstrip()
    return out


def split_whatsapp_message(text: str, limit: int = 3600) -> list[str]:
    """Pecah pesan panjang; tiap bagian dinormalisasi agar tidak ada ** yatim di ujung."""
    u = format_text_for_whatsapp(text)
    if not u:
        return []
    out: list[str] = []
    while u:
        chunk = u[:limit]
        if len(u) > limit:
            # Usahakan potong di batas baris/kalimat agar tidak membelah *tebal*
            cut = chunk.rfind("\n")
            if cut < limit // 2:
                cut = chunk.rfind(". ")
            if cut < limit // 2:
                cut = chunk.rfind(" ")
            if cut > limit // 2:
                chunk = u[: cut + 1].rstrip()
        chunk = format_text_for_whatsapp(chunk)
        if chunk:
            out.append(chunk)
        u = u[len(chunk) :].lstrip()
    return out or [""]
