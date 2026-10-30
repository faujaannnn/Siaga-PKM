#!/usr/bin/env python3
"""
Salin foto, PDF, link video, dan konten beranda dari DB Siaga Bencana ke Siaga Puskesmas:
  • site_homepage (hero beranda)
  • site_profile (foto anggota, YouTube profil)
  • site_contact (galeri foto kontak)
  • education_items (pdf, video, gambar, artikel, banner)
  • ml_videos (link YouTube + naskah ML)
  • ml_pdfs (PDF ML via Google Drive)
  • app_settings ml_belajar_extra_topics
  • app_settings evacuation_sim (titik kumpul simulasi evakuasi)
  • berkas /api/uploads/ terkait

Jalankan dari folder backend Siaga Puskesmas (venv aktif):
  .venv/bin/python scripts/copy_media_from_bencana.py

Lingkungan opsional:
  MONGODB_URI              — default dari .env / app.config
  COPY_SOURCE_DB           — default: siaga_bencana
  COPY_TARGET_DB           — default: siaga_puskesmas (alias settings.mongodb_db)
  COPY_SOURCE_UPLOADS_DIR  — folder uploads bencana (default: ../../siaga-bencana/backend/uploads)
  COPY_SKIP_HOMEPAGE=1     — jangan salin site_homepage
  COPY_SKIP_PROFILE=1      — jangan salin site_profile
  COPY_SKIP_CONTACT=1      — jangan salin site_contact
  COPY_SKIP_EDUCATION=1    — jangan salin education_items
  COPY_SKIP_ML_VIDEOS=1    — jangan salin ml_videos
  COPY_SKIP_ML_PDFS=1      — jangan salin ml_pdfs
  COPY_SKIP_EVAC_SIM=1     — jangan salin titik kumpul simulasi evakuasi
  COPY_SKIP_FILES=1        — hanya DB; tidak menyalin berkas uploads
  COPY_EDUCATION_REPLACE=1 — hapus semua education_items di target, lalu salin dari sumber (default: 1)
  COPY_ML_VIDEOS_REPLACE=1 — hapus ml_videos target lalu salin (default: 1)
  COPY_ML_PDFS_REPLACE=1   — hapus ml_pdfs target lalu salin (default: 1)
"""
from __future__ import annotations

import asyncio
import os
import shutil
import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

_REPO_ROOT = _ROOT.parent.parent  # .../dr diah
_DEFAULT_SOURCE_UPLOADS = _REPO_ROOT / "siaga-bencana" / "backend" / "uploads"
_SETTINGS_ML_BELAJAR = "ml_belajar_extra_topics"
_SETTINGS_EVAC_SIM = "evacuation_sim"


def _truthy(s: str | None, default: bool = False) -> bool:
    if s is None:
        return default
    if not s.strip():
        return default
    return s.strip().lower() in ("1", "true", "yes", "y", "on")


def _upload_basename(url: str) -> str | None:
    u = (url or "").strip()
    if not u:
        return None
    marker = "/api/uploads/"
    if marker not in u:
        return None
    tail = u.split(marker, 1)[1].split("?")[0].strip("/")
    if not tail or ".." in tail or tail.startswith("/"):
        return None
    return tail


def _normalize_upload_url(url: str) -> str:
    b = _upload_basename(url)
    if b:
        return f"/api/uploads/{b}"
    return (url or "").strip()


def _collect_upload_basenames(obj) -> set[str]:
    out: set[str] = set()
    if isinstance(obj, str):
        b = _upload_basename(obj)
        if b:
            out.add(b)
    elif isinstance(obj, dict):
        for v in obj.values():
            out |= _collect_upload_basenames(v)
    elif isinstance(obj, list):
        for v in obj:
            out |= _collect_upload_basenames(v)
    return out


def _normalize_profile_doc(doc: dict) -> dict:
    members_raw = doc.get("members") or []
    members: list[dict] = []
    if isinstance(members_raw, list):
        for m in members_raw:
            if not isinstance(m, dict):
                continue
            members.append(
                {
                    "photo_url": _normalize_upload_url(str(m.get("photo_url", ""))),
                    "name": str(m.get("name", "")).strip(),
                    "subtitle": str(m.get("subtitle", "")).strip(),
                }
            )
    photos = []
    for p in doc.get("photos") or []:
        if not isinstance(p, dict):
            continue
        photos.append(
            {
                "url": _normalize_upload_url(str(p.get("url", ""))),
                "caption": str(p.get("caption", "") or "").strip(),
            }
        )
    return {
        "_id": "main",
        "youtube_url": str(doc.get("youtube_url", "") or "").strip(),
        "members": members,
        "photos": photos,
    }


def _normalize_contact_doc(doc: dict) -> dict:
    photos = []
    for p in doc.get("photos") or []:
        if not isinstance(p, dict):
            continue
        photos.append(
            {
                "url": _normalize_upload_url(str(p.get("url", ""))),
                "caption": str(p.get("caption", "") or "").strip(),
            }
        )
    team_loc = doc.get("team_location")
    team_location = None
    if isinstance(team_loc, dict):
        lat = team_loc.get("lat")
        lng = team_loc.get("lng")
        label = str(team_loc.get("label", "") or "").strip()
        if lat is not None and lng is not None and label:
            team_location = {"lat": float(lat), "lng": float(lng), "label": label}

    out: dict = {
        "_id": "main",
        "intro": str(doc.get("intro", "") or "").strip(),
        "photos": photos,
        "maps_url": str(doc.get("maps_url", "") or "").strip(),
        "address": str(doc.get("address", "") or "").strip(),
        "phone": str(doc.get("phone", "") or "").strip(),
        "email": str(doc.get("email", "") or "").strip(),
    }
    if team_location:
        out["team_location"] = team_location
    return out


def _normalize_edu_doc(doc: dict) -> dict:
    d = {**doc}
    d["body"] = str(d.get("body") or "").strip()
    for key in ("url", "thumbnail_url", "cover_url"):
        d[key] = _normalize_upload_url(str(d.get(key) or "").strip())
    atts = []
    for a in d.get("attachments") or []:
        if not isinstance(a, dict):
            continue
        atts.append(
            {
                "url": _normalize_upload_url(str(a.get("url", ""))),
                "name": str(a.get("name", "") or "").strip(),
            }
        )
    d["attachments"] = atts
    return d


def _normalize_homepage_doc(doc: dict) -> dict:
    sections = []
    for sec in doc.get("sections") or []:
        if not isinstance(sec, dict):
            continue
        row = {**sec}
        hero = []
        for h in row.get("heroImages") or []:
            if not isinstance(h, dict):
                continue
            hero.append(
                {
                    "url": _normalize_upload_url(str(h.get("url", ""))),
                    "caption": str(h.get("caption", "") or "").strip(),
                }
            )
        row["heroImages"] = hero
        imgs = []
        for u in row.get("images") or []:
            imgs.append(_normalize_upload_url(str(u)))
        row["images"] = imgs
        sections.append(row)
    return {"_id": "main", "sections": sections}


def _copy_upload_files(names: set[str], src_dir: Path, dst_dir: Path) -> tuple[int, int]:
    dst_dir.mkdir(parents=True, exist_ok=True)
    ok, missing = 0, 0
    for name in sorted(names):
        s = src_dir / name
        d = dst_dir / name
        if not s.is_file():
            print("  PERINGATAN: berkas sumber tidak ada:", s)
            missing += 1
            continue
        shutil.copy2(s, d)
        ok += 1
    return ok, missing


async def main() -> int:
    from motor.motor_asyncio import AsyncIOMotorClient

    from app.config import settings

    uri = (os.environ.get("MONGODB_URI") or "").strip() or settings.mongodb_uri
    source_db = (os.environ.get("COPY_SOURCE_DB") or "siaga_bencana").strip()
    target_db = (os.environ.get("COPY_TARGET_DB") or "").strip() or settings.mongodb_db
    src_uploads = Path(
        (os.environ.get("COPY_SOURCE_UPLOADS_DIR") or "").strip() or _DEFAULT_SOURCE_UPLOADS
    ).resolve()
    dst_uploads = Path(settings.uploads_dir).resolve()

    skip_homepage = _truthy(os.environ.get("COPY_SKIP_HOMEPAGE"))
    skip_profile = _truthy(os.environ.get("COPY_SKIP_PROFILE"))
    skip_contact = _truthy(os.environ.get("COPY_SKIP_CONTACT"))
    skip_education = _truthy(os.environ.get("COPY_SKIP_EDUCATION"))
    skip_ml_videos = _truthy(os.environ.get("COPY_SKIP_ML_VIDEOS"))
    skip_ml_pdfs = _truthy(os.environ.get("COPY_SKIP_ML_PDFS"))
    skip_evac_sim = _truthy(os.environ.get("COPY_SKIP_EVAC_SIM"))
    skip_files = _truthy(os.environ.get("COPY_SKIP_FILES"))
    edu_replace = _truthy(os.environ.get("COPY_EDUCATION_REPLACE"), default=True)
    ml_videos_replace = _truthy(os.environ.get("COPY_ML_VIDEOS_REPLACE"), default=True)
    ml_pdfs_replace = _truthy(os.environ.get("COPY_ML_PDFS_REPLACE"), default=True)

    print("MongoDB URI         :", uri.split("@")[-1] if "@" in uri else uri)
    print("Sumber DB           :", source_db, "→ target DB:", target_db)
    print("Uploads sumber      :", src_uploads)
    print("Uploads target      :", dst_uploads)
    print("Salin beranda       :", not skip_homepage)
    print("Salin profil        :", not skip_profile)
    print("Salin kontak        :", not skip_contact)
    print("Salin edukasi       :", not skip_education)
    print("Salin video ML      :", not skip_ml_videos)
    print("Salin PDF ML        :", not skip_ml_pdfs)
    print("Salin titik kumpul  :", not skip_evac_sim)
    print("Salin berkas upload :", not skip_files)
    print("Edukasi replace     :", edu_replace)
    print("ml_videos replace   :", ml_videos_replace)
    print("ml_pdfs replace     :", ml_pdfs_replace)

    client = AsyncIOMotorClient(uri)
    try:
        src = client[source_db]
        dst = client[target_db]

        upload_names: set[str] = set()

        if not skip_homepage:
            home = await src.site_homepage.find_one({"_id": "main"})
            if home:
                upload_names |= _collect_upload_basenames(home)

        if not skip_profile:
            prof = await src.site_profile.find_one({"_id": "main"})
            if prof:
                upload_names |= _collect_upload_basenames(prof)

        if not skip_contact:
            contact = await src.site_contact.find_one({"_id": "main"})
            if contact:
                upload_names |= _collect_upload_basenames(contact)

        edu_docs: list[dict] = []
        if not skip_education:
            async for doc in src.education_items.find({}):
                edu_docs.append(doc)
                upload_names |= _collect_upload_basenames(doc)
            print("Edukasi di sumber   :", len(edu_docs), "dokumen")

        print("Berkas /api/uploads :", len(upload_names), "unik (dari URL DB)")

        if not skip_files:
            # Salin semua berkas uploads bencana agar tidak ada yang terlewat
            if src_uploads.is_dir():
                for f in src_uploads.iterdir():
                    if f.is_file():
                        upload_names.add(f.name)
            n_ok, n_miss = _copy_upload_files(upload_names, src_uploads, dst_uploads)
            print("Berkas disalin      :", n_ok, "| tidak ditemukan di sumber:", n_miss)
        elif upload_names:
            print("Berkas tidak disalin (COPY_SKIP_FILES=1).")

        if not skip_homepage:
            home = await src.site_homepage.find_one({"_id": "main"})
            if home:
                to_store = _normalize_homepage_doc(home)
                await dst.site_homepage.replace_one({"_id": "main"}, to_store, upsert=True)
                n_hero = sum(len(s.get("heroImages") or []) for s in to_store["sections"])
                print("site_homepage: disalin (", len(to_store["sections"]), "section,", n_hero, "hero images).")
            else:
                print("site_homepage: kosong di sumber — dilewati.")

        if not skip_profile:
            prof = await src.site_profile.find_one({"_id": "main"})
            if prof:
                to_store = _normalize_profile_doc(prof)
                await dst.site_profile.replace_one({"_id": "main"}, to_store, upsert=True)
                print(
                    "site_profile: disalin (youtube +",
                    len(to_store["members"]),
                    "anggota +",
                    len(to_store.get("photos") or []),
                    "foto galeri).",
                )
            else:
                print("site_profile: kosong di sumber — dilewati.")

        if not skip_contact:
            contact = await src.site_contact.find_one({"_id": "main"})
            if contact:
                to_store = _normalize_contact_doc(contact)
                await dst.site_contact.replace_one({"_id": "main"}, to_store, upsert=True)
                print("site_contact: disalin (", len(to_store["photos"]), "foto).")
            else:
                print("site_contact: kosong di sumber — dilewati.")

        if not skip_education:
            if edu_replace:
                r = await dst.education_items.delete_many({})
                print("education_items target: dihapus", r.deleted_count, "dokumen (mode replace).")
            copied = 0
            for raw in edu_docs:
                doc = dict(raw)
                oid = doc.pop("_id", None)
                if oid is None:
                    continue
                doc = _normalize_edu_doc(doc)
                await dst.education_items.replace_one({"_id": oid}, {**doc, "_id": oid}, upsert=True)
                copied += 1
            print("education_items: di-upsert", copied, "dokumen.")

        if not skip_ml_videos:
            n_src = await src.ml_videos.count_documents({})
            if n_src == 0:
                print("ml_videos: sumber kosong — tidak ada yang disalin.")
            else:
                if ml_videos_replace:
                    r = await dst.ml_videos.delete_many({})
                    print("ml_videos target: dihapus", r.deleted_count, "dokumen (mode replace).")
                copied = 0
                async for doc in src.ml_videos.find({}):
                    oid = doc.get("_id")
                    if oid is None:
                        continue
                    await dst.ml_videos.replace_one({"_id": oid}, doc, upsert=True)
                    copied += 1
                print("ml_videos: di-upsert", copied, "dokumen (sumber:", n_src, ").")

                src_set = await src.app_settings.find_one({"_id": _SETTINGS_ML_BELAJAR})
                if src_set:
                    payload = {k: v for k, v in src_set.items() if k != "_id"}
                    await dst.app_settings.replace_one(
                        {"_id": _SETTINGS_ML_BELAJAR},
                        {"_id": _SETTINGS_ML_BELAJAR, **payload},
                        upsert=True,
                    )
                    print("app_settings:", _SETTINGS_ML_BELAJAR, "disalin.")

        if not skip_ml_pdfs:
            n_src = await src.ml_pdfs.count_documents({})
            if n_src == 0:
                print("ml_pdfs: sumber kosong — tidak ada yang disalin.")
            else:
                if ml_pdfs_replace:
                    r = await dst.ml_pdfs.delete_many({})
                    print("ml_pdfs target: dihapus", r.deleted_count, "dokumen (mode replace).")
                copied = 0
                async for doc in src.ml_pdfs.find({}):
                    oid = doc.get("_id")
                    if oid is None:
                        continue
                    await dst.ml_pdfs.replace_one({"_id": oid}, doc, upsert=True)
                    copied += 1
                print("ml_pdfs: di-upsert", copied, "dokumen (sumber:", n_src, ").")

        if not skip_evac_sim:
            src_evac = await src.app_settings.find_one({"_id": _SETTINGS_EVAC_SIM})
            if not src_evac:
                print("evacuation_sim: kosong di sumber — dilewati.")
            else:
                payload = {k: v for k, v in src_evac.items() if k != "_id"}
                await dst.app_settings.replace_one(
                    {"_id": _SETTINGS_EVAC_SIM},
                    {"_id": _SETTINGS_EVAC_SIM, **payload},
                    upsert=True,
                )
                n_pts = len(src_evac.get("destinations") or [])
                print(
                    "evacuation_sim: disalin (enabled=",
                    bool(src_evac.get("enabled")),
                    ",",
                    n_pts,
                    "titik kumpul).",
                )

        print("Selesai.")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
