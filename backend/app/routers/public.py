import math
import re
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, HTTPException, Query, Response

from app.config import settings
from app.db import get_db
from app.schemas import PelatihanOut, PublicSubmissionIn, SitePagePublic
from siaga_common.google_drive_download import fetch_google_drive_image_bytes
from siaga_common.google_drive_id import parse_google_drive_file_id

router = APIRouter(prefix="/public", tags=["public"])


def _parse_coord_pair(block: object) -> tuple[float, float] | None:
    if not isinstance(block, dict):
        return None
    try:
        lat = float(str(block.get("lat", "")).strip().replace(",", "."))
        lng = float(str(block.get("lng", "")).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None
    if not math.isfinite(lat) or not math.isfinite(lng):
        return None
    if abs(lat) > 90 or abs(lng) > 180:
        return None
    return lat, lng


def _validate_and_clone_kk_data(raw: object) -> dict:
    """Validasi struktur form kesiapsiagaan keluarga; mengembalikan salinan untuk disimpan MongoDB."""
    if not isinstance(raw, dict):
        raise HTTPException(status_code=400, detail="Data formulir tidak valid")

    tanggal = str(raw.get("tanggal_form") or "").strip()
    if not tanggal:
        raise HTTPException(status_code=400, detail="Tanggal pengisian formulir wajib diisi")
    alamat = str(raw.get("alamat_rumah") or "").strip()
    if not alamat:
        raise HTTPException(status_code=400, detail="Alamat rumah wajib diisi")

    apin = raw.get("alamat_rumah_pin")
    if not isinstance(apin, dict):
        raise HTTPException(status_code=400, detail="Titik lokasi rumah di peta tidak valid")
    ap_nama = str(apin.get("nama_lokasi") or "").strip()
    ap_coords = _parse_coord_pair(apin)
    if not ap_nama or ap_coords is None:
        raise HTTPException(
            status_code=400,
            detail="Alamat rumah: tandai titik di peta dan isi nama lokasi (mis. Rumah).",
        )

    for qkey, label in (
        ("q2", "Tempat berkumpul darurat terdekat (Q2)"),
        ("q3", "Tempat berkumpul di luar lingkungan perumahan/desa (Q3)"),
    ):
        blk = raw.get(qkey)
        if not isinstance(blk, dict):
            raise HTTPException(status_code=400, detail=f"{label}: data lokasi tidak valid")
        nama = str(blk.get("nama_lokasi") or "").strip()
        coords = _parse_coord_pair(blk)
        if not nama or coords is None:
            raise HTTPException(
                status_code=400,
                detail=f"{label}: pilih titik di peta dan isi nama lokasi",
            )

    q6 = raw.get("q6_sekolah")
    if not isinstance(q6, list):
        raise HTTPException(status_code=400, detail="Tabel sekolah/penitipan (Q6) tidak valid")
    for i, row in enumerate(q6):
        if not isinstance(row, dict):
            continue
        inst = str(row.get("nama_institusi") or "").strip()
        if not inst:
            continue
        ev = row.get("evakuasi")
        ev_nama = ""
        coords_ev: tuple[float, float] | None = None
        if isinstance(ev, dict):
            ev_nama = str(ev.get("nama_lokasi") or "").strip()
            coords_ev = _parse_coord_pair(ev)
        if not ev_nama or coords_ev is None:
            raise HTTPException(
                status_code=400,
                detail=f"Baris Q6 #{i + 1} ({inst}): tandai tempat evakuasi di peta dan isi nama lokasinya",
            )

    clone: dict = {
        "tanggal_form": tanggal,
        "alamat_rumah": alamat[:2000],
        "alamat_rumah_pin": {
            "nama_lokasi": ap_nama[:500],
            "lat": str(apin.get("lat", "")).strip()[:32],
            "lng": str(apin.get("lng", "")).strip()[:32],
        },
        "anggota_kontak": raw.get("anggota_kontak") if isinstance(raw.get("anggota_kontak"), list) else [],
        "q1": str(raw.get("q1") or "")[:8000],
        "q2": raw.get("q2") if isinstance(raw.get("q2"), dict) else {},
        "q3": raw.get("q3") if isinstance(raw.get("q3"), dict) else {},
        "q4": str(raw.get("q4") or "")[:8000],
        "q5_kontak": raw.get("q5_kontak") if isinstance(raw.get("q5_kontak"), list) else [],
        "q6_sekolah": q6,
        "q7_rentan": raw.get("q7_rentan") if isinstance(raw.get("q7_rentan"), list) else [],
    }
    return clone

_EDU_CATEGORIES = frozenset(
    {
        "video",
        "buku",
        "ppt",
        "peraturan",
        "sop",
        "artikel",
        "poster",
    }
)

_EDU_KINDS = frozenset({"pdf", "video", "banner", "artikel", "gambar"})


def _edu_kind(raw: object) -> str | None:
    s = str(raw or "").strip().lower()
    return s if s in _EDU_KINDS else None


def _edu_category(raw: object) -> str:
    s = str(raw or "peraturan").strip()
    return s if s in _EDU_CATEGORIES else "peraturan"


def _edu_row(d: dict) -> dict:
    atts = d.get("attachments") or []
    attachments = [
        {"url": str(a.get("url", "")), "name": str(a.get("name", ""))}
        for a in atts
        if isinstance(a, dict) and a.get("url")
    ]
    return {
        "id": str(d["_id"]),
        "kind": d["kind"],
        "title": d["title"],
        "description": d.get("description", ""),
        "url": d.get("url") or "",
        "thumbnailUrl": d.get("thumbnail_url", ""),
        "coverUrl": d.get("cover_url", ""),
        "body": d.get("body", ""),
        "attachments": attachments,
        "category": _edu_category(d.get("category")),
        "subcategory": str(d.get("subcategory") or "").strip()[:80],
        "sortOrder": int(d.get("sort_order", 0)),
    }


async def _pelatihan_public_row(db, doc: dict) -> PelatihanOut:
    pid = str(doc["_id"])
    peserta_count = await db.pelatihan_peserta.count_documents({"pelatihan_id": pid})
    return PelatihanOut(
        id=pid,
        judul=doc.get("judul", ""),
        deskripsi=doc.get("deskripsi", ""),
        tanggal=doc.get("tanggal", ""),
        waktu_mulai=doc.get("waktu_mulai", ""),
        waktu_selesai=doc.get("waktu_selesai", ""),
        lokasi=doc.get("lokasi", ""),
        narasumber=doc.get("narasumber", ""),
        kapasitas=int(doc.get("kapasitas", 0)),
        created_at=doc.get("created_at", ""),
        peserta_count=int(peserta_count),
        flyer_url=doc.get("flyer_url", ""),
    )


@router.get("/pelatihan", response_model=list[PelatihanOut])
async def pelatihan_public():
    """Jadwal pelatihan untuk halaman publik (tanpa login)."""
    db = get_db()
    docs = await db.pelatihan.find({}).sort("tanggal", 1).to_list(200)
    return [await _pelatihan_public_row(db, d) for d in docs]


@router.get("/homepage")
async def homepage():
    db = get_db()
    doc = await db.site_homepage.find_one({"_id": "main"})
    if not doc:
        return {"sections": []}
    return {"sections": doc.get("sections", [])}


@router.get("/profile")
async def profile_public():
    db = get_db()
    doc = await db.site_profile.find_one({"_id": "main"})
    if not doc:
        return {"youtube_url": "", "members": [], "photos": []}
    members_raw = doc.get("members") or []
    members: list[dict] = []
    if isinstance(members_raw, list):
        for m in members_raw:
            if isinstance(m, dict):
                pu = str(m.get("photo_url", "")).strip()
                na = str(m.get("name", "")).strip()
                if not pu and not na:
                    continue
                members.append(
                    {
                        "photo_url": pu,
                        "name": na,
                        "subtitle": str(m.get("subtitle", "")).strip(),
                    }
                )
    photos_raw = doc.get("photos") or []
    photos: list[dict] = []
    if isinstance(photos_raw, list):
        for p in photos_raw:
            if isinstance(p, dict):
                u = str(p.get("url", "")).strip()
                if not u:
                    continue
                photos.append({"url": u, "caption": str(p.get("caption", "")).strip()})
    return {
        "youtube_url": str(doc.get("youtube_url", "") or "").strip(),
        "members": members,
        "photos": photos,
    }


@router.get("/contact")
async def contact_public():
    db = get_db()
    doc = await db.site_contact.find_one({"_id": "main"})
    if not doc:
        return {
            "intro": "",
            "address": "",
            "phone": "",
            "email": "",
            "maps_url": "",
            "photos": [],
            "team_location": None,
        }
    photos_raw = doc.get("photos") or []
    photos: list[dict] = []
    if isinstance(photos_raw, list):
        for p in photos_raw:
            if isinstance(p, dict):
                u = str(p.get("url", "")).strip()
                if not u:
                    continue
                photos.append({"url": u, "caption": str(p.get("caption", "")).strip()})

    team_loc = doc.get("team_location")
    team_location = None
    if isinstance(team_loc, dict):
        lat = team_loc.get("lat")
        lng = team_loc.get("lng")
        label = str(team_loc.get("label", "") or "").strip()
        if lat is not None and lng is not None and label:
            team_location = {"lat": float(lat), "lng": float(lng), "label": label}

    return {
        "intro": str(doc.get("intro", "") or "").strip(),
        "address": str(doc.get("address", "") or "").strip(),
        "phone": str(doc.get("phone", "") or "").strip(),
        "email": str(doc.get("email", "") or "").strip(),
        "maps_url": str(doc.get("maps_url", "") or "").strip(),
        "photos": photos,
        "team_location": team_location,
    }


def _public_education_filter(extra: dict | None = None) -> dict:
    """Hanya konten untuk umum: eksplisit menolak staff & developer (bukan sekadar audience=public)."""
    q: dict = {
        "published": True,
        "$nor": [{"audience": "staff"}, {"audience": "developer"}],
    }
    if extra:
        q = {"$and": [q, extra]}
    return q


@router.get("/drive-image")
async def proxy_drive_image(
    id: str = Query(..., description="ID berkas Google Drive (atau URL berbagi)"),
    sz: str = Query("w1200", description="Ukuran thumbnail Drive, mis. w800 atau w1200"),
):
    """
    Proxy gambar Drive same-origin untuk sampul bacaan tambahan.
    Safari memblokir cookie pihak ketiga saat img langsung ke drive.google.com.
    """
    fid = parse_google_drive_file_id(id) or (
        id.strip() if re.match(r"^[a-zA-Z0-9_-]+$", id.strip()) else None
    )
    if not fid:
        raise HTTPException(status_code=400, detail="ID berkas Drive tidak valid")
    try:
        data, media_type = await fetch_google_drive_image_bytes(
            fid,
            sz=sz,
            api_key=(settings.google_drive_api_key or "").strip() or None,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e)) from e
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail="Gagal mengunduh gambar dari Google Drive") from e
    return Response(
        content=data,
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/education-meta")
async def education_meta_public():
    db = get_db()
    doc = await db.site_education_meta.find_one({"_id": "main"})
    raw = doc.get("subcategories") if doc else None
    subs: dict[str, list[str]] = {}
    if isinstance(raw, dict):
        for key, vals in raw.items():
            cat = _edu_category(key)
            if cat not in _EDU_CATEGORIES or not isinstance(vals, list):
                continue
            cleaned = []
            seen: set[str] = set()
            for v in vals:
                s = str(v or "").strip()[:80]
                if s and s not in seen:
                    seen.add(s)
                    cleaned.append(s)
            subs[cat] = cleaned
    return {"subcategories": subs}


@router.get("/education")
async def education_public(
    category: str | None = Query(None, description="Filter kategori konten"),
    subcategory: str | None = Query(None, description="Filter subkategori (dalam kategori utama)"),
    kind: str | None = Query(
        None,
        description="Filter jenis konten: pdf, video, banner, artikel, gambar",
    ),
):
    db = get_db()
    kind_f = _edu_kind(kind)
    sub_f = str(subcategory or "").strip()[:80]

    def _with_sub(extra: dict | None = None) -> dict:
        q = dict(extra or {})
        if sub_f:
            q["subcategory"] = sub_f
        return q

    if kind_f:
        cursor = db.education_items.find(_public_education_filter(_with_sub({"kind": kind_f}))).sort("sort_order", 1)
    elif not category or not category.strip():
        cursor = db.education_items.find(_public_education_filter(_with_sub())).sort("sort_order", 1)
    else:
        cat = _edu_category(category.strip())
        if cat == "umum":
            cursor = (
                db.education_items.find(
                    _public_education_filter(
                        _with_sub({"$or": [{"category": "umum"}, {"category": {"$exists": False}}]}),
                    )
                )
                .sort("sort_order", 1)
            )
        else:
            cursor = db.education_items.find(_public_education_filter(_with_sub({"category": cat}))).sort(
                "sort_order", 1
            )

    items = await cursor.to_list(500)
    out = []
    for d in items:
        aud = str(d.get("audience") or "").strip().lower()
        if aud in ("staff", "developer"):
            continue
        out.append(_edu_row(d))
    return out


@router.get("/pages", response_model=list[SitePagePublic])
async def list_pages():
    db = get_db()
    cursor = db.site_pages.find({"published": True}).sort("sort_order", 1)
    docs = await cursor.to_list(200)
    return [
        SitePagePublic(
            slug=d["slug"],
            title=d["title"],
            body=d.get("body", ""),
            nav_label=d.get("nav_label") or d["title"],
        )
        for d in docs
    ]


@router.get("/pages/{slug}", response_model=SitePagePublic)
async def get_page(slug: str):
    db = get_db()
    doc = await db.site_pages.find_one({"slug": slug.strip(), "published": True})
    if not doc:
        raise HTTPException(status_code=404, detail="Halaman tidak ditemukan")
    return SitePagePublic(
        slug=doc["slug"],
        title=doc["title"],
        body=doc.get("body", ""),
        nav_label=doc.get("nav_label") or doc["title"],
    )


@router.post("/submissions", status_code=201)
async def create_submission(body: PublicSubmissionIn):
    if body.form_type == "lapor_bencana":
        if not body.jenis_bencana.strip():
            raise HTTPException(status_code=400, detail="Jenis bencana wajib diisi")
    elif body.form_type == "saran_aduan":
        if body.jenis_masukkan not in ("saran", "aduan"):
            raise HTTPException(status_code=400, detail="Pilih jenis: saran atau aduan")
        if not body.pesan.strip():
            raise HTTPException(status_code=400, detail="Isi saran atau aduan")
        if not body.nama.strip():
            raise HTTPException(status_code=400, detail="Nama wajib diisi")

    db = get_db()
    now = datetime.now(timezone.utc)
    if body.form_type == "kesiapsiagaan_keluarga":
        if not body.wilayah_daerah.strip():
            raise HTTPException(status_code=400, detail="Pilih wilayah lokasi keluarga")
        if not body.nama.strip():
            raise HTTPException(status_code=400, detail="Nama kepala keluarga wajib diisi")
        kk_clean = _validate_and_clone_kk_data(body.kk_data)
        alamat = str(kk_clean.get("alamat_rumah") or "")
        doc = {
            "form_type": body.form_type,
            "nama": body.nama.strip(),
            "telepon": body.telepon.strip(),
            "email": body.email.strip(),
            "pesan": "",
            "jenis_bencana": "",
            "tanggal_kejadian": str(kk_clean.get("tanggal_form") or "").strip(),
            "waktu_kejadian": "",
            "lokasi": alamat[:2000],
            "wilayah_daerah": body.wilayah_daerah.strip(),
            "lat": "",
            "lng": "",
            "jenis_masukkan": "",
            "kk_data": kk_clean,
            "created_at": now,
            "read": False,
        }
    else:
        doc = {
            "form_type": body.form_type,
            "nama": body.nama.strip(),
            "telepon": body.telepon.strip(),
            "email": body.email.strip(),
            "pesan": body.pesan.strip(),
            "jenis_bencana": body.jenis_bencana.strip(),
            "tanggal_kejadian": body.tanggal_kejadian.strip(),
            "waktu_kejadian": body.waktu_kejadian.strip(),
            "lokasi": body.lokasi.strip(),
            "wilayah_daerah": body.wilayah_daerah.strip(),
            "lat": body.lat.strip(),
            "lng": body.lng.strip(),
            "jenis_masukkan": body.jenis_masukkan.strip(),
            "kk_data": {},
            "created_at": now,
            "read": False,
            "foto_url": body.foto_url.strip() if body.form_type == "lapor_bencana" else "",
        }
    await db.public_submissions.insert_one(doc)

    # Trigger notifikasi ke semua kepala puskesmas saat ada laporan bencana
    if body.form_type == "lapor_bencana":
        try:
            from app.routers.notifikasi import notify_lapor_bencana_all
            await notify_lapor_bencana_all(doc)
        except Exception:
            pass

    return {"ok": True}


# --- Statistik kunjungan sederhana (model per-event, mirip pintasan self-hosted analytics) ---
_VSTATS_ID = "main"


@router.post("/analytics/visit")
async def analytics_record_visit():
    """Satu hit per interval di sisi klien; tidak menyimpan PII."""
    db = get_db()
    now = datetime.now(timezone.utc)
    day = now.strftime("%Y-%m-%d")
    month = now.strftime("%Y-%m")
    await db.site_visit_stats.update_one(
        {"_id": _VSTATS_ID},
        {
            "$inc": {"total": 1, f"days.{day}": 1, f"months.{month}": 1},
            "$set": {"updated_at": now},
        },
        upsert=True,
    )
    return Response(status_code=204)


@router.get("/analytics/summary")
async def analytics_summary():
    db = get_db()
    doc = await db.site_visit_stats.find_one({"_id": _VSTATS_ID})
    now = datetime.now(timezone.utc)
    today_k = now.strftime("%Y-%m-%d")
    month_k = now.strftime("%Y-%m")
    days: dict[str, int] = {}
    months: dict[str, int] = {}
    total = 0
    if doc:
        total = int(doc.get("total") or 0)
        raw_d = doc.get("days")
        if isinstance(raw_d, dict):
            for k, v in raw_d.items():
                try:
                    days[str(k)] = int(v)
                except (TypeError, ValueError):
                    pass
        raw_m = doc.get("months")
        if isinstance(raw_m, dict):
            for k, v in raw_m.items():
                try:
                    months[str(k)] = int(v)
                except (TypeError, ValueError):
                    pass
    today = days.get(today_k, 0)
    this_month = months.get(month_k, 0)
    daily_last_7: list[dict[str, object]] = []
    for i in range(6, -1, -1):
        dt = now - timedelta(days=i)
        dk = dt.strftime("%Y-%m-%d")
        daily_last_7.append({"date": dk, "count": days.get(dk, 0)})
    last_30 = sum(days.get((now - timedelta(days=i)).strftime("%Y-%m-%d"), 0) for i in range(30))
    return {
        "total": total,
        "today": today,
        "this_month": this_month,
        "last_30_days": last_30,
        "daily_last_7": daily_last_7,
    }
