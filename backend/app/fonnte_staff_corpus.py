"""
Korpus teks untuk asisten WA petugas/staff: seluruh materi terbit dari admin
(edukasi publik + masyarakat + developer), naskah video ML, halaman situs, beranda, data modul statis.

Pemotongan panjang dilakukan di sini (bukan oleh model) agar tidak mengarang isi.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app import disaster_data
from app.config import settings
from siaga_common.assessment_prompts import SIAGA_ASESMEN_VIDEO_ML_KORPUS

log = logging.getLogger(__name__)

# Cache proses singkat (satu worker); jika multi-worker, tiap worker punya salinan (fakultatif).
_corpus_cache_time: float = 0.0
_corpus_cache_value: str = ""
_CORPUS_TTL_SEC = 90.0


def _clip(s: str, n: int) -> str:
    t = (s or "").strip()
    if len(t) <= n:
        return t
    return t[: max(0, n - 20)] + "\n[…dipotong…]"


def _format_disaster_static() -> str:
    lines = [
        "=== DATA STATIS MODUL (kode: disaster_data.py) ===",
        f"Judul: {disaster_data.OVERVIEW.get('title', '')}",
        f"Subjudul: {disaster_data.OVERVIEW.get('subtitle', '')}",
        f"Tagline: {disaster_data.OVERVIEW.get('tagline', '')}",
        "Checklist pra/saat/pasca-bencana:",
    ]
    for sec in disaster_data.CHECKLIST:
        lines.append(f"— {sec.get('title', '')}")
        for it in sec.get("items") or []:
            lines.append(f"  • {it}")
    lines.append("Hotline referensi (statis):")
    for h in disaster_data.HOTLINES:
        lines.append(f"  • {h.get('name')}: {h.get('phone')} — {h.get('note')}")
    return "\n".join(lines)


def _share_budget(total: int, *parts: float) -> tuple[int, ...]:
    s = sum(parts) or 1.0
    out: list[int] = []
    for p in parts:
        out.append(int(total * p / s))
    return tuple(out)


async def _section_education(db: AsyncIOMotorDatabase, max_chars: int) -> str:
    cur = db.education_items.find({"published": True}).sort("sort_order", 1)
    items: list[dict[str, Any]] = await cur.to_list(2000)
    if not items:
        return "=== MATERI EDUKASI (admin: koleksi education_items, terbit) ===\n(tidak ada)"
    n = len(items)
    # Alokasi body per item dari anggaran zona
    meta_per = 180
    per_body = max(300, (max_chars - meta_per * n) // max(1, n))
    per_body = min(per_body, 50_000)

    lines: list[str] = [
        "=== MATERI EDUKASI (sumber admin: education_items, SEMUA audience terbit: public | staff | developer) ===",
        "Field: title, audience, kind, category, description, body (isi utama), url, lampiran.",
    ]
    for d in items:
        oid = str(d.get("_id", ""))
        title = str(d.get("title", "") or "").strip() or "(tanpa judul)"
        aud = str(d.get("audience", "public") or "public")
        kind = str(d.get("kind", "") or "")
        cat = str(d.get("category", "") or "umum")
        desc = _clip(str(d.get("description", "") or ""), 1200)
        body = _clip(str(d.get("body", "") or ""), per_body)
        url = str(d.get("url", "") or "").strip()
        atts = d.get("attachments") or []
        att_names = []
        if isinstance(atts, list):
            for a in atts[:20]:
                if isinstance(a, dict) and a.get("name"):
                    att_names.append(str(a.get("name", "")))
        att_s = ", ".join(att_names) if att_names else "—"
        lines.append(
            f"\n--- id={oid}\n"
            f"title: {title}\n"
            f"audience: {aud} | kind: {kind} | category: {cat}\n"
            f"description: {desc}\n"
            f"url: {url or '—'}\n"
            f"attachments: {att_s}\n"
            f"body:\n{body if body else '—'}\n"
        )
    out = "\n".join(lines)
    if len(out) > max_chars:
        return _clip(out, max_chars) + "\n[zona edukasi dipotong — sisa item kurang terbawa]"
    return out


async def _section_ml_videos(db: AsyncIOMotorDatabase, max_chars: int) -> str:
    cur = db.ml_videos.find({"published": True}).sort("sort_order", 1)
    vids: list[dict[str, Any]] = await cur.to_list(500)
    if not vids:
        return "=== VIDEO ML / NASKAH (admin: ml_videos, terbit) ===\n(tidak ada)"
    n = len(vids)
    per = max(400, (max_chars - 120 * n) // max(1, n))
    per = min(per, 60_000)
    lines: list[str] = [
        "=== VIDEO ML — Siaga Bencana (admin: ml_videos) — naskah & penjelasan untuk asesmen AI ===",
        "Field: video_script = naskah; explanation = catatan admin; category = asesmen_ai | belajar_plus.",
    ]
    for d in vids:
        oid = str(d.get("_id", ""))
        title = str(d.get("title", "") or "").strip() or "(video)"
        cat = str(d.get("category", "") or "asesmen_ai")
        desc = _clip(str(d.get("description", "") or ""), 1500)
        vurl = str(d.get("youtube_url", "") or "").strip()
        script = _clip(str(d.get("video_script", "") or ""), per)
        expl = _clip(str(d.get("explanation", "") or ""), per)
        lines.append(
            f"\n--- id={oid}\n"
            f"title: {title}\n"
            f"category: {cat}\n"
            f"youtube_url: {vurl or '—'}\n"
            f"description: {desc}\n"
            f"video_script (naskah):\n{script if script else '—'}\n"
            f"explanation (materi tambahan admin):\n{expl if expl else '—'}\n"
        )
    out = "\n".join(lines)
    if len(out) > max_chars:
        return _clip(out, max_chars) + "\n[zona video ML dipotong]"
    return out


async def _section_ml_pdfs(db: AsyncIOMotorDatabase, max_chars: int, header_title: str) -> str:
    cur = db.ml_pdfs.find({"published": True}).sort("sort_order", 1)
    pdfs: list[dict[str, Any]] = await cur.to_list(300)
    if not pdfs:
        return f"=== PDF ML / NASKAH BAB (admin: ml_pdfs, terbit) — {header_title} ===\n(tidak ada)"
    n = len(pdfs)
    per_doc = max(350, (max_chars - 100 * n) // max(1, n))
    per_doc = min(per_doc, 55_000)
    lines: list[str] = [
        f"=== PDF ML — {header_title} (admin: ml_pdfs) — naskah per bab & penjelasan untuk asesmen AI ===",
        "Struktur: drive_url (Google Drive); chapters[] dengan page_start/page_end, content (naskah bab), explanation.",
    ]
    for d in pdfs:
        oid = str(d.get("_id", ""))
        title = str(d.get("title", "") or "").strip() or "(pdf)"
        cat = str(d.get("category", "") or "asesmen_ai")
        desc = _clip(str(d.get("description", "") or ""), 1200)
        durl = str(d.get("drive_url", "") or "").strip()
        chs = d.get("chapters") or []
        lines.append(f"\n--- id={oid}\ntitle: {title}\ncategory: {cat}\ndrive_url: {durl or '—'}\ndescription: {desc}\n")
        if isinstance(chs, list):
            for j, c in enumerate(chs):
                if not isinstance(c, dict):
                    continue
                ctitle = str(c.get("title", "") or f"Bab {j + 1}")
                ps = int(c.get("page_start", 1))
                pe = int(c.get("page_end", ps))
                body = _clip(str(c.get("content", "") or ""), per_doc // max(1, len(chs)))
                expl = _clip(str(c.get("explanation", "") or ""), per_doc // max(1, len(chs)))
                lines.append(
                    f"  bab {j + 1}: {ctitle} | hal. {ps}–{pe}\n"
                    f"  content:\n{body if body else '—'}\n"
                    f"  explanation:\n{expl if expl else '—'}\n"
                )
    out = "\n".join(lines)
    if len(out) > max_chars:
        return _clip(out, max_chars) + "\n[zona PDF ML dipotong]"
    return out


async def _section_site_pages(db: AsyncIOMotorDatabase, max_chars: int) -> str:
    cur = db.site_pages.find({"published": True}).sort("sort_order", 1)
    pages: list[dict[str, Any]] = await cur.to_list(300)
    if not pages:
        return "=== HALAMAN SITUS (admin: site_pages, terbit) ===\n(tidak ada)"
    n = len(pages)
    per_body = max(300, (max_chars - 100 * n) // max(1, n))
    per_body = min(per_body, 40_000)
    lines = ["=== HALAMAN SITUS (site_pages, terbit) ==="]
    for d in pages:
        slug = str(d.get("slug", "") or "")
        title = str(d.get("title", "") or "")
        nav = str(d.get("nav_label", "") or title)
        body = _clip(str(d.get("body", "") or ""), per_body)
        lines.append(f"\n--- slug={slug} | nav={nav}\ntitle: {title}\nbody:\n{body}\n")
    out = "\n".join(lines)
    if len(out) > max_chars:
        return _clip(out, max_chars) + "\n[zona halaman dipotong]"
    return out


async def _section_homepage(db: AsyncIOMotorDatabase, max_chars: int) -> str:
    doc = await db.site_homepage.find_one({"_id": "main"})
    if not doc:
        return "=== BERANDA (site_homepage main) ===\n(tidak ada)"
    sections = doc.get("sections") or []
    try:
        raw = json.dumps(sections, ensure_ascii=False, indent=0)
    except Exception:
        raw = str(sections)
    if len(raw) > max_chars:
        raw = _clip(raw, max_chars)
    return "=== BERANDA (site_homepage, sections JSON) ===\n" + raw


async def build_system_corpus_fresh(db: AsyncIOMotorDatabase) -> str:
    max_total = max(20_000, int(settings.fonnte_staff_context_max_chars))
    # Alokasi kasar: edukasi & video ML dapat porsi terbesar (naskah)
    b_edu, b_ml, b_page, b_home, b_static = _share_budget(
        max_total - 4000, 0.38, 0.38, 0.12, 0.07, 0.05
    )
    b_vid = max(1800, int(b_ml * 0.55))
    b_pdf = max(1200, b_ml - b_vid)

    edu, ml_v, ml_p, pg, hm = await asyncio.gather(
        _section_education(db, b_edu),
        _section_ml_videos(db, b_vid),
        _section_ml_pdfs(db, b_pdf, "Siaga Bencana"),
        _section_site_pages(db, b_page),
        _section_homepage(db, b_home),
    )
    ml = (ml_v.strip() + "\n\n" + ml_p.strip()).strip()
    static = _format_disaster_static()
    if len(static) > b_static:
        static = _clip(static, b_static)

    base = settings.public_api_base.strip() if (settings.public_api_base or "").strip() else ""
    header = (
        "=== SUMBER TEKS SISTEM (Siaga — Bencana & Puskesmas: edukasi, video ML, halaman) ===\n"
        + (f"URL publik aplikasi (tanpa /api): {base}\n" if base else "")
        + "Rincian di bawah dari database / backend. Untuk hal yang tidak tercantum, boleh jawab singkat \n"
        + "dengan penalaran umum sesuai konteks kesehatan/organisasi; sebut bila sifatnya umum, bukan teks resmi modul.\n"
    )
    asmt = _clip(SIAGA_ASESMEN_VIDEO_ML_KORPUS, 4500)
    parts = [header, asmt, edu, ml, pg, hm, static]
    full = "\n\n".join(p for p in parts if p)
    if len(full) > max_total:
        full = _clip(full, max_total) + "\n\n[DATA TOTAL DIPOTONG — arahkan pengguna ke situs untuk detail penuh]"
    return full


async def get_system_corpus_cached(db: AsyncIOMotorDatabase) -> str:
    global _corpus_cache_time, _corpus_cache_value
    now = time.monotonic()
    if _corpus_cache_value and (now - _corpus_cache_time) < _CORPUS_TTL_SEC:
        return _corpus_cache_value
    try:
        built = await build_system_corpus_fresh(db)
    except Exception:
        log.exception("build_system_corpus_fresh")
        built = "=== ERROR MEMUAT KORPUS ===\n"
    _corpus_cache_time = now
    _corpus_cache_value = built
    return built


async def format_education_compact_list(db: AsyncIOMotorDatabase) -> str:
    """Daftar satu baris per item untuk jawaban cepat WA (tanpa body penuh)."""
    cur = db.education_items.find({"published": True}).sort("sort_order", 1)
    items: list[dict[str, Any]] = await cur.to_list(800)
    if not items:
        return "Belum ada materi edukasi terbit di sistem."
    lines: list[str] = [
        f"Total {len(items)} item terbit (public + staff + developer). Ketik pertanyaan detail untuk ringkasan AI.",
    ]
    for d in items:
        aud = str(d.get("audience", "public") or "public")
        title = str(d.get("title", "") or "").strip() or "(tanpa judul)"
        kind = str(d.get("kind", "") or "")
        lines.append(f"• [{aud}] {title} ({kind})")
    return "\n".join(lines)
