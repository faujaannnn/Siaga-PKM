import re
import uuid
import os
import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, cast

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from pydantic import BaseModel

from app.auth_utils import hash_password
from app.config import settings
from app.deps import get_current_user, require_content_admin, require_main_admin
from app.image_compress import compress_image_upload
from app.education_sanitize import sanitize_education_fields
from app.db import get_db
from app.wa_staff_chat_history import (
    classify_wa_connection_status,
    list_wa_chats_for_username,
    load_wa_chat_stats_by_username,
)
from app.lipi_attempt import ATTEMPT_POST, ATTEMPT_PRE, attempt_label, resolve_user_attempts
from app.routers.lipi_quiz import calculate_lipi_score
from app.schemas import (
    Attachment,
    ContactPayload,
    EducationCategory,
    EducationItemCreate,
    EducationItemOut,
    EducationItemUpdate,
    EducationMetaPayload,
    HomepagePayload,
    ProfilePayload,
    KesiapsiagaanMapPointOut,
    PublicSubmissionOut,
    ResearchSampleAccountOut,
    SitePageAdmin,
    SitePageCreate,
    SitePageUpdate,
    StaffCreateBody,
    StaffCreateByAdminBody,
    KapusCreateBody,
    StaffOut,
    StaffUpdateBody,
    SubmissionReadPatch,
    UploadResponse,
    UserOut,
)

router = APIRouter(prefix="/admin", tags=["admin"])

_UPLOAD_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".doc", ".docx"}
_SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")
_SLUG = re.compile(r"[^a-z0-9-]+")
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


def _edu_category(raw: object) -> str:
    s = str(raw or "peraturan").strip()
    return s if s in _EDU_CATEGORIES else "peraturan"


def _edu_kind_for_category(cat: str) -> str:
    if cat == "video":
        return "video"
    if cat == "poster":
        return "banner"
    return "pdf"


def _normalize_slug(s: str) -> str:
    t = s.strip().lower().replace("_", "-")
    t = _SLUG.sub("-", t)
    return t.strip("-")[:120] or "halaman"


def _user_out(doc: dict) -> UserOut:
    return UserOut(username=doc["username"], role=str(doc.get("role", "staff")))


def _attachments_from_doc(doc: dict) -> list[Attachment]:
    raw = doc.get("attachments") or []
    out: list[Attachment] = []
    for a in raw:
        if not isinstance(a, dict):
            continue
        u = str(a.get("url", "")).strip()
        if not u:
            continue
        out.append(Attachment(url=u, name=str(a.get("name", ""))))
    return out


def _edu_subcategory(raw: object) -> str:
    return str(raw or "").strip()[:80]


def _normalize_subcategories_map(raw: object) -> dict[str, list[str]]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, list[str]] = {}
    for key, vals in raw.items():
        cat = _edu_category(key)
        if cat not in _EDU_CATEGORIES:
            continue
        if not isinstance(vals, list):
            continue
        cleaned: list[str] = []
        seen: set[str] = set()
        for v in vals:
            s = str(v or "").strip()[:80]
            if not s or s in seen:
                continue
            seen.add(s)
            cleaned.append(s)
        out[cat] = cleaned
    return out


def _edu_out(doc: dict) -> EducationItemOut:
    aud = doc.get("audience", "public")
    if aud not in ("public", "staff", "developer"):
        aud = "public"
    cat = _edu_category(doc.get("category"))
    return EducationItemOut(
        id=str(doc["_id"]),
        kind=doc["kind"],
        title=doc["title"],
        description=doc.get("description", ""),
        url=doc.get("url") or "",
        thumbnail_url=doc.get("thumbnail_url", ""),
        cover_url=doc.get("cover_url", ""),
        body=doc.get("body", ""),
        attachments=_attachments_from_doc(doc),
        audience=aud,
        category=cast(EducationCategory, cat),
        subcategory=_edu_subcategory(doc.get("subcategory")),
        sort_order=int(doc.get("sort_order", 0)),
        published=bool(doc.get("published", True)),
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(_main: str = Depends(require_main_admin)):
    _ = _main
    db = get_db()
    cursor = db.users.find({}).sort("username", 1)
    docs = await cursor.to_list(500)
    return [_user_out(d) for d in docs]


@router.get("/research-sample-accounts", response_model=list[ResearchSampleAccountOut])
async def list_research_sample_accounts(_main: str = Depends(require_main_admin)):
    """Daftar akun sampel penelitian beserta password awal (hanya admin utama)."""
    _ = _main
    db = get_db()
    cursor = db.research_sample_accounts.find({}).sort("sort_order", 1)
    rows = await cursor.to_list(50)
    out: list[ResearchSampleAccountOut] = []
    for r in rows:
        uname = str(r.get("username") or "").strip()
        user = await db.users.find_one({"username": uname}) if uname else None
        dn = None
        if user and user.get("display_name"):
            dn = str(user["display_name"]).strip() or None
        elif r.get("display_name"):
            dn = str(r["display_name"]).strip() or None
        out.append(
            ResearchSampleAccountOut(
                username=uname,
                password_plain=str(r.get("password_plain") or ""),
                wilayah=str(r.get("wilayah") or ""),
                display_name=dn,
                sort_order=int(r.get("sort_order", 0)),
            )
        )
    return out


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_staff(body: StaffCreateBody, main_user: str = Depends(require_main_admin)):
    _ = main_user
    username = body.username.strip()
    password = body.password.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username tidak boleh kosong")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password minimal 6 karakter")
    db = get_db()
    exists = await db.users.find_one({"username": username})
    if exists:
        raise HTTPException(status_code=409, detail="Username sudah dipakai")
    doc = {
        "username": username,
        "password_hash": hash_password(password),
        "role": "staff",
    }
    await db.users.insert_one(doc)
    return _user_out(doc)


@router.delete("/users/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(username: str, main_user: str = Depends(require_main_admin)):
    uname = username.strip()
    if uname == settings.default_admin_username:
        raise HTTPException(status_code=400, detail="Akun admin utama tidak boleh dihapus")
    if uname == main_user:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun yang sedang dipakai")
    db = get_db()
    result = await db.users.delete_one({"username": uname})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Admin: akun staff dengan puskesmas (baru) ─────────────────────────────────

def _staff_out_from_doc(doc: dict, pk_nama: str | None = None) -> StaffOut:
    return StaffOut(
        username=doc["username"],
        role=str(doc.get("role", "staff")),
        display_name=doc.get("display_name") or None,
        wa_phone=doc.get("wa_phone") or None,
        puskesmas_id=str(doc.get("puskesmas_id") or "") or None,
        puskesmas_nama=pk_nama,
    )


@router.get("/staff-list", response_model=list[StaffOut])
async def list_all_staff(_: str = Depends(require_main_admin)):
    """Daftar semua akun staff beserta info puskesmasnya."""
    from datetime import datetime, timezone
    db = get_db()
    docs = await db.users.find({"role": "staff"}).sort("username", 1).to_list(1000)
    pk_cache: dict[str, str] = {}

    async def _nama(pid: str) -> str | None:
        if not pid:
            return None
        if pid in pk_cache:
            return pk_cache[pid]
        from bson import ObjectId
        from bson.errors import InvalidId
        try:
            p = await db.puskesmas.find_one({"_id": ObjectId(pid)})
        except (InvalidId, Exception):
            p = None
        n = p.get("nama", "") if p else ""
        pk_cache[pid] = n
        return n or None

    out = []
    for d in docs:
        pid = str(d.get("puskesmas_id") or "")
        out.append(_staff_out_from_doc(d, await _nama(pid)))
    return out


@router.post("/staff-puskesmas", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
async def create_staff_with_puskesmas(body: StaffCreateByAdminBody, _: str = Depends(require_main_admin)):
    """Admin buat akun staff dan taruh di puskesmas mana saja."""
    from datetime import datetime, timezone
    from bson import ObjectId
    from bson.errors import InvalidId
    db = get_db()
    uname = body.username.strip()
    if not uname:
        raise HTTPException(status_code=400, detail="Username tidak boleh kosong")
    if await db.users.find_one({"username": uname}):
        raise HTTPException(status_code=409, detail="Username sudah dipakai")
    pk_id = body.puskesmas_id.strip()
    try:
        puskesmas = await db.puskesmas.find_one({"_id": ObjectId(pk_id)}) if pk_id else None
    except (InvalidId, Exception):
        puskesmas = None
    if pk_id and not puskesmas:
        raise HTTPException(status_code=400, detail="Puskesmas tidak ditemukan")
    doc = {
        "username": uname,
        "password_hash": hash_password(body.password),
        "role": "staff",
        "puskesmas_id": pk_id or None,
        "display_name": body.display_name.strip() or None,
        "wa_phone": body.wa_phone.strip() or None,
        "needs_profile_setup": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    pk_nama = puskesmas.get("nama", "") if puskesmas else None
    return _staff_out_from_doc(doc, pk_nama)


@router.patch("/staff-puskesmas/{target_username}", response_model=StaffOut)
async def update_staff_admin(target_username: str, body: StaffUpdateBody, _: str = Depends(require_main_admin)):
    """Admin edit staff (pindah puskesmas, ganti password, dll)."""
    from bson import ObjectId
    from bson.errors import InvalidId
    db = get_db()
    target = await db.users.find_one({"username": target_username})
    if not target:
        raise HTTPException(status_code=404, detail="Staff tidak ditemukan")
    upd: dict = {}
    if body.display_name is not None:
        upd["display_name"] = body.display_name.strip() or None
    if body.wa_phone is not None:
        upd["wa_phone"] = body.wa_phone.strip() or None
    if body.password is not None:
        upd["password_hash"] = hash_password(body.password)
    if body.puskesmas_id is not None:
        upd["puskesmas_id"] = body.puskesmas_id.strip() or None
    if upd:
        await db.users.update_one({"username": target_username}, {"$set": upd})
    updated = await db.users.find_one({"username": target_username}) or target
    new_pk_id = str(updated.get("puskesmas_id") or "")
    puskesmas = None
    if new_pk_id:
        try:
            puskesmas = await db.puskesmas.find_one({"_id": ObjectId(new_pk_id)})
        except Exception:
            pass
    pk_nama = puskesmas.get("nama", "") if puskesmas else None
    return _staff_out_from_doc(updated, pk_nama)


# ── Admin: akun kepala puskesmas ──────────────────────────────────────────────

@router.get("/kapus-list", response_model=list[StaffOut])
async def list_all_kapus(_: str = Depends(require_main_admin)):
    """Daftar semua akun kepala puskesmas."""
    from bson import ObjectId
    from bson.errors import InvalidId
    db = get_db()
    docs = await db.users.find({"role": "kepala_puskesmas"}).sort("username", 1).to_list(200)
    out = []
    for d in docs:
        pid = str(d.get("puskesmas_id") or "")
        puskesmas = None
        if pid:
            try:
                puskesmas = await db.puskesmas.find_one({"_id": ObjectId(pid)})
            except Exception:
                pass
        pk_nama = puskesmas.get("nama", "") if puskesmas else None
        out.append(_staff_out_from_doc(d, pk_nama))
    return out


@router.post("/kapus", response_model=StaffOut, status_code=status.HTTP_201_CREATED)
async def create_kapus(body: KapusCreateBody, _: str = Depends(require_main_admin)):
    """Admin buat akun kepala puskesmas dan kaitkan ke puskesmas."""
    from datetime import datetime, timezone
    from bson import ObjectId
    from bson.errors import InvalidId
    db = get_db()
    uname = body.username.strip()
    if not uname:
        raise HTTPException(status_code=400, detail="Username tidak boleh kosong")
    if await db.users.find_one({"username": uname}):
        raise HTTPException(status_code=409, detail="Username sudah dipakai")
    pk_id = body.puskesmas_id.strip()
    try:
        puskesmas = await db.puskesmas.find_one({"_id": ObjectId(pk_id)}) if pk_id else None
    except (InvalidId, Exception):
        puskesmas = None
    if not puskesmas:
        raise HTTPException(status_code=400, detail="Puskesmas tidak ditemukan")
    # Cek apakah sudah ada kapus di puskesmas ini
    existing_kapus = await db.users.find_one({"puskesmas_id": pk_id, "role": "kepala_puskesmas"})
    if existing_kapus:
        raise HTTPException(
            status_code=409,
            detail=f"Puskesmas ini sudah memiliki kepala puskesmas: {existing_kapus['username']}",
        )
    doc = {
        "username": uname,
        "password_hash": hash_password(body.password),
        "role": "kepala_puskesmas",
        "puskesmas_id": pk_id,
        "display_name": body.display_name.strip() or None,
        "needs_profile_setup": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    pk_nama = puskesmas.get("nama", "") if puskesmas else None
    return _staff_out_from_doc(doc, pk_nama)


@router.delete("/kapus/{username}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kapus(username: str, main_user: str = Depends(require_main_admin)):
    uname = username.strip()
    if uname == main_user:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun yang sedang dipakai")
    db = get_db()
    target = await db.users.find_one({"username": uname})
    if not target:
        raise HTTPException(status_code=404, detail="User tidak ditemukan")
    if target.get("role") != "kepala_puskesmas":
        raise HTTPException(status_code=400, detail="Bukan akun kepala puskesmas")
    await db.users.delete_one({"username": uname})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/upload", response_model=UploadResponse)
async def upload_media(
    file: UploadFile = File(...),
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    raw_name = (file.filename or "file").strip() or "file"
    suffix = Path(raw_name).suffix.lower()
    if suffix not in _UPLOAD_EXT:
        raise HTTPException(
            status_code=400,
            detail=f"Ekstensi tidak diizinkan. Gunakan: {', '.join(sorted(_UPLOAD_EXT))}",
        )
    data = await file.read()
    if len(data) > settings.upload_max_bytes:
        max_mb = settings.upload_max_bytes / (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"Berkas terlalu besar (maks. {max_mb:.0f} MiB). Perkecil PDF atau naikkan UPLOAD_MAX_BYTES di .env backend.",
        )
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
        data, suffix = compress_image_upload(data, suffix)
    safe_stem = _SAFE_NAME.sub("-", Path(raw_name).stem)[:80] or "file"
    stored = f"{uuid.uuid4().hex}-{safe_stem}{suffix}"
    dest = settings.uploads_dir / stored
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    url = f"/api/uploads/{stored}"
    return UploadResponse(url=url, name=raw_name)

@router.post("/upload-flyer", response_model=dict)
async def upload_flyer(
    file: UploadFile = File(...),
    _admin: str = Depends(require_content_admin),
):
    """Upload a pelatihan flyer image (jpg/png/webp). Returns {url: string}."""
    _ = _admin
    ext = os.path.splitext(file.filename or "")[1].lower()
    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    if ext not in allowed:
        raise HTTPException(400, f"Tipe file tidak diizinkan. Gunakan: {', '.join(allowed)}")
    data = await file.read()
    if len(data) > settings.upload_max_bytes:
        raise HTTPException(400, f"Ukuran maks {settings.upload_max_bytes // 1024 // 1024} MB")
    token = hashlib.sha256(data).hexdigest()[:16]
    dest = settings.uploads_dir / f"flyer_{token}{ext}"
    settings.uploads_dir.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return {"url": f"/api/uploads/{dest.name}"}


@router.get("/homepage")
async def get_homepage_admin(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    doc = await db.site_homepage.find_one({"_id": "main"})
    if not doc:
        return {"sections": []}
    return {"sections": doc.get("sections", [])}


@router.put("/homepage")
async def put_homepage(payload: HomepagePayload, _admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    sections: list[dict] = []
    for sec in payload.sections:
        if not isinstance(sec, dict):
            continue
        row = dict(sec)
        if row.get("type") == "hero":
            hi = row.get("heroImages")
            if isinstance(hi, list) and hi:
                row["images"] = []
        sections.append(row)
    await db.site_homepage.update_one(
        {"_id": "main"},
        {"$set": {"sections": sections}},
        upsert=True,
    )
    return {"ok": True}


@router.get("/profile")
async def get_profile_admin(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    doc = await db.site_profile.find_one({"_id": "main"})
    if not doc:
        return {"youtube_url": "", "members": [], "photos": []}
    members_raw = doc.get("members") or []
    members: list[dict] = []
    if isinstance(members_raw, list):
        for m in members_raw:
            if isinstance(m, dict):
                members.append(
                    {
                        "photo_url": str(m.get("photo_url", "")).strip(),
                        "name": str(m.get("name", "")).strip(),
                        "subtitle": str(m.get("subtitle", "")).strip(),
                    }
                )
    photos_raw = doc.get("photos") or []
    photos: list[dict] = []
    if isinstance(photos_raw, list):
        for p in photos_raw:
            if isinstance(p, dict):
                photos.append(
                    {
                        "url": str(p.get("url", "")).strip(),
                        "caption": str(p.get("caption", "")).strip(),
                    }
                )
    return {
        "youtube_url": str(doc.get("youtube_url", "") or "").strip(),
        "members": members,
        "photos": photos,
    }


@router.put("/profile")
async def put_profile(payload: ProfilePayload, _admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    members_store = [{"photo_url": m.photo_url.strip(), "name": m.name.strip(), "subtitle": m.subtitle.strip()} for m in payload.members]
    if len(members_store) > 80:
        raise HTTPException(status_code=400, detail="Maksimal 80 anggota di slider profil.")
    photos_store = [{"url": p.url.strip(), "caption": p.caption.strip()} for p in payload.photos]
    if len(photos_store) > 48:
        raise HTTPException(status_code=400, detail="Maksimal 48 foto galeri profil.")
    await db.site_profile.update_one(
        {"_id": "main"},
        {
            "$set": {
                "youtube_url": payload.youtube_url.strip(),
                "members": members_store,
                "photos": photos_store,
            }
        },
        upsert=True,
    )
    return {"ok": True}


@router.get("/contact")
async def get_contact_admin(_admin: str = Depends(require_content_admin)):
    _ = _admin
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
        }
    photos_raw = doc.get("photos") or []
    photos: list[dict] = []
    if isinstance(photos_raw, list):
        for p in photos_raw:
            if isinstance(p, dict):
                photos.append(
                    {
                        "url": str(p.get("url", "")).strip(),
                        "caption": str(p.get("caption", "")).strip(),
                    }
                )
    return {
        "intro": str(doc.get("intro", "") or "").strip(),
        "address": str(doc.get("address", "") or "").strip(),
        "phone": str(doc.get("phone", "") or "").strip(),
        "email": str(doc.get("email", "") or "").strip(),
        "maps_url": str(doc.get("maps_url", "") or "").strip(),
        "photos": photos,
    }


@router.put("/contact")
async def put_contact(payload: ContactPayload, _admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    photos_store = [{"url": p.url.strip(), "caption": p.caption.strip()} for p in payload.photos]
    if len(photos_store) > 24:
        raise HTTPException(status_code=400, detail="Maksimal 24 foto di halaman kontak.")
    update_set: dict = {
        "intro": payload.intro.strip(),
        "address": payload.address.strip(),
        "phone": payload.phone.strip(),
        "email": payload.email.strip(),
        "maps_url": payload.maps_url.strip(),
        "photos": photos_store,
    }
    if payload.team_location is not None:
        update_set["team_location"] = {
            "lat": payload.team_location.lat,
            "lng": payload.team_location.lng,
            "label": payload.team_location.label.strip(),
        }
    else:
        update_set["team_location"] = None
    await db.site_contact.update_one(
        {"_id": "main"},
        {"$set": update_set},
        upsert=True,
    )
    return {"ok": True}


@router.get("/education", response_model=list[EducationItemOut])
async def list_education_admin(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    cursor = db.education_items.find({}).sort("sort_order", 1)
    items = await cursor.to_list(500)
    return [_edu_out(d) for d in items]


@router.post("/education", response_model=EducationItemOut, status_code=status.HTTP_201_CREATED)
async def create_education(body: EducationItemCreate, _admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    doc = body.model_dump()
    for k in ("thumbnail_url", "cover_url", "body", "url"):
        doc[k] = doc.get(k) or ""
    if doc.get("audience") not in ("public", "staff", "developer"):
        doc["audience"] = "public"
    doc["category"] = _edu_category(doc.get("category"))
    doc["kind"] = _edu_kind_for_category(doc["category"])
    doc["subcategory"] = _edu_subcategory(doc.get("subcategory"))
    doc.update(sanitize_education_fields(doc))
    res = await db.education_items.insert_one(doc)
    created = await db.education_items.find_one({"_id": res.inserted_id})
    assert created is not None

    # Trigger notifikasi ke staff saat ada materi baru
    try:
        from app.routers.notifikasi import notify_materi_baru as _notify_materi
        await _notify_materi(db, created)
    except Exception:
        pass

    return _edu_out(created)


@router.put("/education/{item_id}", response_model=EducationItemOut)
async def update_education(
    item_id: str,
    body: EducationItemUpdate,
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    try:
        oid = ObjectId(item_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e
    db = get_db()
    patch = {k: v for k, v in body.model_dump(exclude_unset=True, mode="python").items()}
    if "attachments" in patch and patch["attachments"] is not None:
        patch["attachments"] = [
            a if isinstance(a, dict) else {"url": getattr(a, "url", ""), "name": getattr(a, "name", "")}
            for a in patch["attachments"]
        ]
    if "category" in patch and patch["category"] is not None:
        patch["category"] = _edu_category(patch["category"])
        patch["kind"] = _edu_kind_for_category(patch["category"])
    elif "kind" in patch and patch["kind"] is not None:
        # Format mengikuti kategori yang tersimpan / dikirim.
        existing = await db.education_items.find_one({"_id": oid})
        cat = _edu_category((patch.get("category") if "category" in patch else None) or (existing or {}).get("category"))
        patch["kind"] = _edu_kind_for_category(cat)
    if "subcategory" in patch and patch["subcategory"] is not None:
        patch["subcategory"] = _edu_subcategory(patch["subcategory"])
    if patch:
        existing_full = await db.education_items.find_one({"_id": oid})
        merged = {**(existing_full or {}), **patch}
        patch.update(sanitize_education_fields(merged))
    if not patch:
        existing = await db.education_items.find_one({"_id": oid})
        if not existing:
            raise HTTPException(status_code=404, detail="Tidak ditemukan")
        return _edu_out(existing)
    result = await db.education_items.update_one({"_id": oid}, {"$set": patch})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    updated = await db.education_items.find_one({"_id": oid})
    assert updated is not None
    return _edu_out(updated)


@router.delete("/education/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_education(item_id: str, _admin: str = Depends(require_content_admin)):
    _ = _admin
    try:
        oid = ObjectId(item_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e
    db = get_db()
    result = await db.education_items.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/education-meta", response_model=EducationMetaPayload)
async def get_education_meta(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    doc = await db.site_education_meta.find_one({"_id": "main"})
    subs = _normalize_subcategories_map(doc.get("subcategories") if doc else None)
    return EducationMetaPayload(subcategories=subs)


@router.put("/education-meta", response_model=EducationMetaPayload)
async def put_education_meta(body: EducationMetaPayload, _admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    subs = _normalize_subcategories_map(body.subcategories)
    await db.site_education_meta.update_one(
        {"_id": "main"},
        {"$set": {"subcategories": subs}},
        upsert=True,
    )
    return EducationMetaPayload(subcategories=subs)


def _page_admin(doc: dict) -> SitePageAdmin:
    return SitePageAdmin(
        id=str(doc["_id"]),
        slug=doc["slug"],
        title=doc["title"],
        body=doc.get("body", ""),
        nav_label=doc.get("nav_label") or doc["title"],
        sort_order=int(doc.get("sort_order", 0)),
        published=bool(doc.get("published", True)),
    )


@router.get("/pages", response_model=list[SitePageAdmin])
async def list_pages_admin(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    cursor = db.site_pages.find({}).sort("sort_order", 1)
    docs = await cursor.to_list(300)
    return [_page_admin(d) for d in docs]


@router.post("/pages", response_model=SitePageAdmin, status_code=status.HTTP_201_CREATED)
async def create_page(body: SitePageCreate, _admin: str = Depends(require_content_admin)):
    _ = _admin
    slug = _normalize_slug(body.slug)
    db = get_db()
    if await db.site_pages.find_one({"slug": slug}):
        raise HTTPException(status_code=409, detail="Slug sudah dipakai")
    doc = {
        "slug": slug,
        "title": body.title.strip(),
        "body": body.body or "",
        "nav_label": (body.nav_label or body.title).strip(),
        "sort_order": int(body.sort_order),
        "published": bool(body.published),
    }
    res = await db.site_pages.insert_one(doc)
    created = await db.site_pages.find_one({"_id": res.inserted_id})
    assert created is not None
    return _page_admin(created)


@router.put("/pages/{page_id}", response_model=SitePageAdmin)
async def update_page(
    page_id: str,
    body: SitePageUpdate,
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    try:
        oid = ObjectId(page_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e
    db = get_db()
    existing = await db.site_pages.find_one({"_id": oid})
    if not existing:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items()}
    if "slug" in patch and patch["slug"] is not None:
        new_slug = _normalize_slug(patch["slug"])
        other = await db.site_pages.find_one({"slug": new_slug, "_id": {"$ne": oid}})
        if other:
            raise HTTPException(status_code=409, detail="Slug sudah dipakai")
        patch["slug"] = new_slug
    if "title" in patch and patch["title"] is not None:
        patch["title"] = patch["title"].strip()
    if not patch:
        return _page_admin(existing)
    await db.site_pages.update_one({"_id": oid}, {"$set": patch})
    updated = await db.site_pages.find_one({"_id": oid})
    assert updated is not None
    return _page_admin(updated)


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_page(page_id: str, _admin: str = Depends(require_content_admin)):
    _ = _admin
    try:
        oid = ObjectId(page_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e
    db = get_db()
    result = await db.site_pages.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _submission_preview(d: dict) -> str:
    ft = str(d.get("form_type") or "")
    if ft == "kesiapsiagaan_keluarga":
        parts = [
            d.get("nama") or "",
            d.get("wilayah_daerah") or "",
            d.get("lokasi") or "",
        ]
        return " · ".join(p for p in parts if p)[:240] or "Kesiapsiagaan keluarga (BNPB)"
    parts = [
        d.get("pesan") or "",
        d.get("lokasi") or "",
        d.get("jenis_bencana") or "",
        d.get("nama") or "",
    ]
    return " · ".join(p for p in parts if p)[:240] or "(tanpa ringkasan)"


KK_ALAMAT_LABEL = "Titik lokasi rumah (alamat)"
KK_Q2_LABEL = "Titik kumpul darurat sekitar rumah (Q2)"
KK_Q3_LABEL = "Titik kumpul luar desa/perumahan (Q3)"
KK_Q6_LABEL = "Titik kumpul sekolah/penitipan anak (Q6)"


def _coord_from_kk_block(block: object) -> tuple[float, float] | None:
    if not isinstance(block, dict):
        return None
    try:
        lat = float(str(block.get("lat", "")).strip().replace(",", "."))
        lng = float(str(block.get("lng", "")).strip().replace(",", "."))
    except (TypeError, ValueError):
        return None
    return lat, lng


def _kk_map_points_flatten(docs: list[dict]) -> list[KesiapsiagaanMapPointOut]:
    rows: list[KesiapsiagaanMapPointOut] = []
    for d in docs:
        sub_id = str(d.get("_id", ""))
        head = str(d.get("nama") or "").strip()
        wilayah = str(d.get("wilayah_daerah") or "").strip()
        kk = d.get("kk_data")
        ca = d.get("created_at")
        created_at = ca.isoformat() if hasattr(ca, "isoformat") else str(ca or "")

        if not isinstance(kk, dict):
            continue

        apin = kk.get("alamat_rumah_pin")
        if isinstance(apin, dict):
            c = _coord_from_kk_block(apin)
            if c:
                nm = str(apin.get("nama_lokasi") or "").strip()
                rows.append(
                    KesiapsiagaanMapPointOut(
                        submission_id=sub_id,
                        wilayah_daerah=wilayah,
                        head_name=head,
                        location_label=nm or "-",
                        question_key="alamat_rumah",
                        question_label=KK_ALAMAT_LABEL,
                        row_index=None,
                        institution_name=None,
                        lat=c[0],
                        lng=c[1],
                        created_at=created_at,
                    )
                )

        q2 = kk.get("q2")
        if isinstance(q2, dict):
            c = _coord_from_kk_block(q2)
            if c:
                nm = str(q2.get("nama_lokasi") or "").strip()
                rows.append(
                    KesiapsiagaanMapPointOut(
                        submission_id=sub_id,
                        wilayah_daerah=wilayah,
                        head_name=head,
                        location_label=nm or "-",
                        question_key="q2",
                        question_label=KK_Q2_LABEL,
                        row_index=None,
                        institution_name=None,
                        lat=c[0],
                        lng=c[1],
                        created_at=created_at,
                    )
                )
        q3 = kk.get("q3")
        if isinstance(q3, dict):
            c = _coord_from_kk_block(q3)
            if c:
                nm = str(q3.get("nama_lokasi") or "").strip()
                rows.append(
                    KesiapsiagaanMapPointOut(
                        submission_id=sub_id,
                        wilayah_daerah=wilayah,
                        head_name=head,
                        location_label=nm or "-",
                        question_key="q3",
                        question_label=KK_Q3_LABEL,
                        row_index=None,
                        institution_name=None,
                        lat=c[0],
                        lng=c[1],
                        created_at=created_at,
                    )
                )
        q6 = kk.get("q6_sekolah")
        if isinstance(q6, list):
            for i, item in enumerate(q6):
                if not isinstance(item, dict):
                    continue
                ev = item.get("evakuasi")
                if not isinstance(ev, dict):
                    continue
                c = _coord_from_kk_block(ev)
                if not c:
                    continue
                inst = str(item.get("nama_institusi") or "").strip()
                nm = str(ev.get("nama_lokasi") or "").strip()
                rows.append(
                    KesiapsiagaanMapPointOut(
                        submission_id=sub_id,
                        wilayah_daerah=wilayah,
                        head_name=head,
                        location_label=nm or "-",
                        question_key="q6",
                        question_label=KK_Q6_LABEL,
                        row_index=i,
                        institution_name=inst or None,
                        lat=c[0],
                        lng=c[1],
                        created_at=created_at,
                    )
                )

    rows.sort(key=lambda r: r.created_at, reverse=True)
    return rows


@router.get("/submissions", response_model=list[PublicSubmissionOut])
async def list_submissions(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    cursor = db.public_submissions.find({}).sort("created_at", -1).limit(300)
    docs = await cursor.to_list(300)
    out: list[PublicSubmissionOut] = []
    for d in docs:
        ca = d.get("created_at")
        if hasattr(ca, "isoformat"):
            created = ca.isoformat()
        else:
            created = str(ca or "")
        out.append(
            PublicSubmissionOut(
                id=str(d["_id"]),
                form_type=str(d.get("form_type", "")),
                created_at=created,
                read=bool(d.get("read")),
                preview=_submission_preview(d),
            )
        )
    return out


@router.get(
    "/submissions/kesiapsiagaan-keluarga/map-points",
    response_model=list[KesiapsiagaanMapPointOut],
)
async def list_kesiapsiagaan_map_points(_admin: str = Depends(require_content_admin)):
    _ = _admin
    db = get_db()
    cursor = (
        db.public_submissions.find({"form_type": "kesiapsiagaan_keluarga"})
        .sort("created_at", -1)
        .limit(400)
    )
    docs = await cursor.to_list(400)
    return _kk_map_points_flatten(docs)


@router.get("/submissions/{sub_id}")
async def get_submission(sub_id: str, _admin: str = Depends(require_content_admin)):
    _ = _admin
    try:
        oid = ObjectId(sub_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e
    db = get_db()
    doc = await db.public_submissions.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    doc["_id"] = str(doc["_id"])
    ca = doc.get("created_at")
    if hasattr(ca, "isoformat"):
        doc["created_at"] = ca.isoformat()
    return doc


@router.patch("/submissions/{sub_id}", response_model=PublicSubmissionOut)
async def patch_submission(
    sub_id: str,
    body: SubmissionReadPatch,
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    try:
        oid = ObjectId(sub_id)
    except InvalidId as e:
        raise HTTPException(status_code=400, detail="ID tidak valid") from e
    db = get_db()
    result = await db.public_submissions.update_one({"_id": oid}, {"$set": {"read": body.read}})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Tidak ditemukan")
    doc = await db.public_submissions.find_one({"_id": oid})
    assert doc is not None
    ca = doc.get("created_at")
    created = ca.isoformat() if hasattr(ca, "isoformat") else str(ca or "")
    return PublicSubmissionOut(
        id=str(doc["_id"]),
        form_type=str(doc.get("form_type", "")),
        created_at=created,
        read=bool(doc.get("read")),
        preview=_submission_preview(doc),
    )


# ── Monitor Page: Aggregate petugas progress ────────────────────────────────

_MONITOR_REQUIRED_VIDEOS = 2


class UserProgressOut(BaseModel):
    username: str
    role: str
    display_name: str | None = None
    puskesmas_id: str | None = None
    puskesmas_nama: str | None = None
    published_video_total: int = 0
    video_completed: int = 0
    video_progress_pct: float = 0.0
    video_avg_score: float | None = None
    video_sessions: list[dict] = []
    lipi_total: int = 0
    kuis_status: str = "belum"
    kuis_pengetahuan_score: int | None = None
    kuis_pengetahuan_level: str | None = None
    kuis_efikasi_score: int | None = None
    kuis_efikasi_level: str | None = None
    kuis_sikap_score: int | None = None
    kuis_sikap_level: str | None = None
    kuis_tindakan_score: int | None = None
    kuis_tindakan_level: str | None = None
    kuis_submitted_at: str | None = None
    kuis_pre_pengetahuan_score: int | None = None
    kuis_pre_pengetahuan_level: str | None = None
    kuis_pre_efikasi_score: int | None = None
    kuis_pre_efikasi_level: str | None = None
    kuis_pre_sikap_score: int | None = None
    kuis_pre_sikap_level: str | None = None
    kuis_pre_tindakan_score: int | None = None
    kuis_pre_tindakan_level: str | None = None
    kuis_pre_submitted_at: str | None = None
    kuis_post_pengetahuan_score: int | None = None
    kuis_post_pengetahuan_level: str | None = None
    kuis_post_efikasi_score: int | None = None
    kuis_post_efikasi_level: str | None = None
    kuis_post_sikap_score: int | None = None
    kuis_post_sikap_level: str | None = None
    kuis_post_tindakan_score: int | None = None
    kuis_post_tindakan_level: str | None = None
    kuis_post_submitted_at: str | None = None
    lipi_results: list[dict] = []
    triage_completed: bool = False
    triage_session_count: int = 0
    triage_best_score: int | None = None
    triage_first_score: int | None = None
    triage_first_correct: int | None = None
    triage_first_total: int | None = None
    triage_last_score: int | None = None
    triage_last_correct: int | None = None
    triage_last_total: int | None = None
    triage_sessions: list[dict] = []
    pelatihan_hadir_count: int = 0
    pelatihan_last_hadir_at: str | None = None
    pelatihan_rows: list[dict] = []
    last_activity_at: str | None = None
    is_working: bool = False
    wa_status: str = "never_connected"
    wa_phone: str | None = None
    wa_chat_count: int = 0
    wa_last_chat_at: str | None = None


class MonitorSummaryOut(BaseModel):
    total_staff: int = 0
    working_count: int = 0
    not_working_count: int = 0
    published_video_total: int = 0
    total_lipi_submissions: int = 0
    kuis_pre_test_count: int = 0
    kuis_post_test_count: int = 0
    kuis_post_pending_count: int = 0
    triage_completed_count: int = 0
    triage_total_sessions: int = 0
    triage_first_score: int | None = None
    triage_last_score: int | None = None
    pelatihan_hadir_staff_count: int = 0
    wa_connected_count: int = 0
    wa_previously_connected_count: int = 0
    wa_never_connected_count: int = 0
    wa_total_chats: int = 0
    updated_at: str = ""


class MonitorDashboardOut(BaseModel):
    summary: MonitorSummaryOut
    users: list[UserProgressOut]


class WaChatTurnOut(BaseModel):
    role: str
    content: str
    kind: str = "chat"
    at: str = ""
    phone: str | None = None


class WaChatHistoryOut(BaseModel):
    username: str
    display_name: str | None = None
    wa_status: str
    wa_phone: str | None = None
    chat_count: int = 0
    turns: list[WaChatTurnOut] = []


def _knowledge_level_score(level: str) -> float | None:
    if not level:
        return None
    m = re.search(r"(\d+)", level)
    if m:
        return float(m.group(1))
    l = level.lower()
    if "sangat tinggi" in l or "expert" in l:
        return 90.0
    if "tinggi" in l or "high" in l or "baik" in l:
        return 75.0
    if "sedang" in l or "medium" in l:
        return 55.0
    if "sangat rendah" in l:
        return 15.0
    if "rendah" in l or "low" in l:
        return 35.0
    return None


def _iso_dt(value: object | None) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()  # type: ignore[union-attr]
    return str(value)


def _parse_dt(value: object | None) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    if isinstance(value, str) and value.strip():
        raw = value.strip().replace("Z", "+00:00")
        try:
            dt = datetime.fromisoformat(raw)
        except ValueError:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    return None


def _count_distinct_done(sessions: list[dict], id_key: str) -> int:
    done_ids: set[str] = set()
    for s in sessions:
        if str(s.get("status") or "").lower() not in ("done", "completed"):
            continue
        raw = s.get(id_key)
        if isinstance(raw, ObjectId):
            done_ids.add(str(raw))
        elif raw:
            done_ids.add(str(raw))
    return len(done_ids)


def _lipi_score_level(lp: dict) -> tuple[int | None, str | None]:
    score = lp.get("pengetahuan_score", lp.get("total_score"))
    if score is None:
        return None, None
    try:
        score_i = int(round(float(score)))
    except (TypeError, ValueError):
        return None, None
    level = str(lp.get("pengetahuan_level") or lp.get("level") or "")
    return score_i, level or None


def _avg_knowledge_score(sessions: list[dict]) -> float | None:
    scores: list[float] = []
    for s in sessions:
        if str(s.get("status") or "").lower() not in ("done", "completed"):
            continue
        parsed = _knowledge_level_score(str(s.get("knowledge_level") or ""))
        if parsed is not None:
            scores.append(parsed)
    if not scores:
        return None
    return round(sum(scores) / len(scores), 1)


def _latest_activity(*groups: list[dict]) -> str | None:
    latest: datetime | None = None
    for group in groups:
        for item in group:
            for key in ("updated_at", "submitted_at", "completed_at", "started_at", "waktu_absen", "created_at"):
                dt = _parse_dt(item.get(key))
                if dt is None:
                    continue
                if latest is None or dt > latest:
                    latest = dt
    return latest.isoformat() if latest else None


def _int_or_none(value: object) -> int | None:
    if value is None:
        return None
    try:
        return int(round(float(value)))
    except (TypeError, ValueError):
        return None


def _lipi_scored_from_session(s: dict) -> dict[str, Any] | None:
    answers = s.get("answers")
    if not isinstance(answers, dict) or not answers:
        return None
    attempt = str(s.get("attempt_type") or ATTEMPT_PRE)
    return calculate_lipi_score({str(k): str(v) for k, v in answers.items()}, attempt)


def _tindakan_from_session(s: dict) -> tuple[int | None, str | None]:
    scored = _lipi_scored_from_session(s)
    if scored and scored.get("td_scored"):
        pct = _int_or_none(scored.get("tindakan_score"))
        level = str(scored.get("tindakan_level") or "") or None
        return pct, level
    if s.get("tindakan_score") is not None:
        pct = _int_or_none(s.get("tindakan_score"))
        level = str(s.get("tindakan_level") or "") or None
        if pct is not None and not level:
            level = "Baik" if pct >= 50 else "Buruk"
        return pct, level
    return None, None


def _efikasi_from_session(s: dict) -> tuple[int | None, str | None]:
    scored = _lipi_scored_from_session(s)
    if scored and scored.get("ed_scored"):
        score = _int_or_none(scored.get("efikasi_diri_score"))
        level = str(scored.get("efikasi_diri_level") or "") or None
        return score, level
    score = _int_or_none(s.get("efikasi_diri_score"))
    level = str(s.get("efikasi_diri_level") or "").strip() or None
    return score, level


def _kuis_latest_from_lipi(lp: dict) -> dict[str, Any]:
    """Ringkasan kuesioner terakhir - empat bagian yang dinilai."""
    pg_score, pg_level = _lipi_score_level(lp)
    if not pg_level:
        pg_level = str(lp.get("pengetahuan_level") or lp.get("level") or "") or None
    ed_score, ed_level = _efikasi_from_session(lp)
    sk_score = _int_or_none(lp.get("sikap_score"))
    sk_level = str(lp.get("sikap_level") or "").strip() or None
    td_score, td_level = _tindakan_from_session(lp)
    return {
        "pengetahuan_score": pg_score,
        "pengetahuan_level": pg_level,
        "efikasi_diri_score": ed_score,
        "efikasi_diri_level": ed_level,
        "sikap_score": sk_score,
        "sikap_level": sk_level,
        "tindakan_score": td_score,
        "tindakan_level": td_level,
        "submitted_at": _iso_dt(lp.get("submitted_at")) or None,
    }


@router.get("/user-progress", response_model=MonitorDashboardOut)
async def get_user_progress(
    response: Response,
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    db = get_db()

    staff_docs = await db.users.find({"role": "staff"}).sort("username", 1).to_list(1000)
    published_video_total = await db.ml_videos.count_documents({"published": True})

    video_sessions = await db.ml_learning_sessions.find({}).to_list(5000)
    lipi_sessions = await db.lipi_quiz_sessions.find({}).to_list(5000)
    triage_sessions = await db.triage_game_sessions.find({}).to_list(5000)
    pelatihan_rows = await db.pelatihan_peserta.find({}).to_list(5000)
    wa_chat_stats = await load_wa_chat_stats_by_username(db)

    video_map: dict[str, str] = {}
    for v in await db.ml_videos.find({}).to_list(500):
        video_map[str(v["_id"])] = str(v.get("title") or "(Video)")

    pelatihan_map: dict[str, str] = {}
    for p in await db.pelatihan.find({}).to_list(500):
        pelatihan_map[str(p["_id"])] = str(p.get("judul") or "(Pelatihan)")

    puskesmas_map: dict[str, str] = {}
    for pk in await db.puskesmas.find({}).to_list(500):
        puskesmas_map[str(pk["_id"])] = str(pk.get("nama") or "")

    sessions_by_user: dict[str, list[dict]] = {}
    lipi_by_user: dict[str, list[dict]] = {}
    triage_by_user: dict[str, list[dict]] = {}
    pel_by_user: dict[str, list[dict]] = {}

    for s in video_sessions:
        sessions_by_user.setdefault(str(s.get("username") or ""), []).append(s)
    for s in lipi_sessions:
        lipi_by_user.setdefault(str(s.get("username") or ""), []).append(s)
    for s in triage_sessions:
        triage_by_user.setdefault(str(s.get("username") or ""), []).append(s)
    for s in pelatihan_rows:
        pel_by_user.setdefault(str(s.get("username") or ""), []).append(s)

    result: list[UserProgressOut] = []

    for u in staff_docs:
        username = str(u.get("username") or "")
        user_videos = sessions_by_user.get(username, [])
        user_lipis = lipi_by_user.get(username, [])
        user_triage = triage_by_user.get(username, [])
        user_pel = pel_by_user.get(username, [])

        video_completed = _count_distinct_done(user_videos, "video_id")
        video_progress_pct = round(
            min(100.0, (video_completed / _MONITOR_REQUIRED_VIDEOS) * 100.0),
            1,
        )

        sorted_lipi = sorted(user_lipis, key=lambda x: _iso_dt(x.get("submitted_at")))
        attempt_state = resolve_user_attempts(user_lipis)
        pre_summary = (
            _kuis_latest_from_lipi(attempt_state["pre_session"])
            if attempt_state["pre_session"]
            else {}
        )
        post_summary = (
            _kuis_latest_from_lipi(attempt_state["post_session"])
            if attempt_state["post_session"]
            else {}
        )
        kuis_latest = post_summary or pre_summary

        completed_triage = [
            t for t in user_triage if str(t.get("status") or "").lower() == "completed"
        ]
        triage_best_score = None
        for t in completed_triage:
            sc = _int_or_none(t.get("score"))
            if sc is None:
                continue
            if triage_best_score is None or sc > triage_best_score:
                triage_best_score = sc
        last_triage = None
        if completed_triage:
            last_triage = max(
                completed_triage,
                key=lambda x: _iso_dt(x.get("completed_at") or x.get("started_at")),
            )
        case_order = (last_triage or {}).get("case_order") if last_triage else None
        last_total = len(case_order) if isinstance(case_order, list) else None

        # Skor pertama (sesi selesai paling awal)
        first_triage = None
        if completed_triage:
            first_triage = min(
                completed_triage,
                key=lambda x: _iso_dt(x.get("completed_at") or x.get("started_at")),
            )
        first_triage_score = _int_or_none((first_triage or {}).get("score")) if first_triage else None
        first_triage_correct = _int_or_none((first_triage or {}).get("correct_count")) if first_triage else None
        first_case_order = (first_triage or {}).get("case_order") if first_triage else None
        first_triage_total = len(first_case_order) if isinstance(first_case_order, list) else None

        hadir_rows = [r for r in user_pel if bool(r.get("hadir"))]
        last_hadir_at = None
        last_hadir_dt: datetime | None = None
        for r in hadir_rows:
            dt = _parse_dt(r.get("waktu_absen"))
            if dt is None:
                continue
            if last_hadir_dt is None or dt > last_hadir_dt:
                last_hadir_dt = dt
                last_hadir_at = dt.isoformat()

        is_working = (
            video_completed >= _MONITOR_REQUIRED_VIDEOS
            and attempt_state["has_pre_test"]
            and attempt_state["has_post_test"]
            and len(completed_triage) > 0
        )

        wa_phone_raw = str(u.get("wa_phone") or "").strip() or None
        wa_stat = wa_chat_stats.get(username) or {}
        wa_chat_count = int(wa_stat.get("chat_count") or 0)
        wa_last = wa_stat.get("last_chat_at")
        wa_status = classify_wa_connection_status(
            wa_phone=wa_phone_raw,
            had_exchange=bool(wa_stat.get("has_exchange")),
        )

        pk_id = str(u.get("puskesmas_id") or "") or None
        pk_nama = puskesmas_map.get(pk_id or "") or None

        video_session_list = []
        for s in sorted(
            user_videos,
            key=lambda x: _iso_dt(x.get("updated_at") or x.get("created_at")),
            reverse=True,
        ):
            vid = s.get("video_id")
            vid_s = str(vid) if isinstance(vid, ObjectId) else str(vid or "")
            video_session_list.append(
                {
                    "id": str(s.get("_id", "")),
                    "video_id": vid_s,
                    "video_title": video_map.get(vid_s, "(Video)"),
                    "status": str(s.get("status") or ""),
                    "knowledge_level": str(s.get("knowledge_level") or ""),
                    "seconds_watched": float(s.get("seconds_watched") or 0),
                    "updated_at": _iso_dt(s.get("updated_at") or s.get("created_at")),
                }
            )

        lipi_result_list = []
        for idx, s in enumerate(sorted_lipi):
            score_i, level_s = _lipi_score_level(s)
            td_score, td_level = _tindakan_from_session(s)
            ed_score, ed_level = _efikasi_from_session(s)
            atype = str(s.get("attempt_type") or (ATTEMPT_PRE if idx == 0 else ATTEMPT_POST))
            lipi_result_list.append(
                {
                    "session_id": str(s.get("_id", "")),
                    "attempt_type": atype,
                    "attempt_label": attempt_label(atype),
                    "total_score": score_i or 0,
                    "level": level_s or str(s.get("level") or ""),
                    "level_color": str(s.get("level_color") or ""),
                    "pengetahuan_score": _int_or_none(s.get("pengetahuan_score")) or score_i or 0,
                    "pengetahuan_level": str(s.get("pengetahuan_level") or level_s or "") or None,
                    "sikap_score": _int_or_none(s.get("sikap_score")),
                    "sikap_level": str(s.get("sikap_level") or "") or None,
                    "efikasi_diri_score": ed_score,
                    "efikasi_diri_level": ed_level,
                    "tindakan_score": td_score,
                    "tindakan_level": td_level,
                    "td_scored": td_score is not None,
                    "submitted_at": _iso_dt(s.get("submitted_at")),
                    "ai_recommendation": str(s.get("ai_recommendation") or "")[:500],
                }
            )

        triage_session_list = []
        for s in sorted(
            user_triage,
            key=lambda x: _iso_dt(x.get("completed_at") or x.get("started_at")),
            reverse=True,
        ):
            order = s.get("case_order")
            total_cases = len(order) if isinstance(order, list) else int(s.get("current_index") or 0)
            triage_session_list.append(
                {
                    "id": str(s.get("_id", "")),
                    "status": str(s.get("status") or ""),
                    "score": _int_or_none(s.get("score")) or 0,
                    "correct_count": _int_or_none(s.get("correct_count")) or 0,
                    "total_cases": total_cases,
                    "best_streak": _int_or_none(s.get("best_streak")) or 0,
                    "completed_at": _iso_dt(s.get("completed_at") or s.get("started_at")),
                }
            )

        pel_list = []
        for r in sorted(user_pel, key=lambda x: _iso_dt(x.get("waktu_absen")), reverse=True):
            pel_id = str(r.get("pelatihan_id") or "")
            pel_list.append(
                {
                    "id": str(r.get("_id", "")),
                    "pelatihan_id": pel_id,
                    "judul": pelatihan_map.get(pel_id, "(Pelatihan)"),
                    "hadir": bool(r.get("hadir")),
                    "waktu_absen": _iso_dt(r.get("waktu_absen")),
                }
            )

        result.append(
            UserProgressOut(
                username=username,
                role=str(u.get("role") or "staff"),
                display_name=u.get("display_name"),
                puskesmas_id=pk_id,
                puskesmas_nama=pk_nama,
                published_video_total=published_video_total,
                video_completed=video_completed,
                video_progress_pct=video_progress_pct,
                video_avg_score=_avg_knowledge_score(user_videos),
                video_sessions=video_session_list,
                lipi_total=len(user_lipis),
                kuis_status=str(attempt_state["kuis_status"]),
                kuis_pengetahuan_score=kuis_latest.get("pengetahuan_score"),
                kuis_pengetahuan_level=kuis_latest.get("pengetahuan_level"),
                kuis_efikasi_score=kuis_latest.get("efikasi_diri_score"),
                kuis_efikasi_level=kuis_latest.get("efikasi_diri_level"),
                kuis_sikap_score=kuis_latest.get("sikap_score"),
                kuis_sikap_level=kuis_latest.get("sikap_level"),
                kuis_tindakan_score=kuis_latest.get("tindakan_score"),
                kuis_tindakan_level=kuis_latest.get("tindakan_level"),
                kuis_submitted_at=kuis_latest.get("submitted_at"),
                kuis_pre_pengetahuan_score=pre_summary.get("pengetahuan_score"),
                kuis_pre_pengetahuan_level=pre_summary.get("pengetahuan_level"),
                kuis_pre_efikasi_score=pre_summary.get("efikasi_diri_score"),
                kuis_pre_efikasi_level=pre_summary.get("efikasi_diri_level"),
                kuis_pre_sikap_score=pre_summary.get("sikap_score"),
                kuis_pre_sikap_level=pre_summary.get("sikap_level"),
                kuis_pre_tindakan_score=pre_summary.get("tindakan_score"),
                kuis_pre_tindakan_level=pre_summary.get("tindakan_level"),
                kuis_pre_submitted_at=pre_summary.get("submitted_at"),
                kuis_post_pengetahuan_score=post_summary.get("pengetahuan_score"),
                kuis_post_pengetahuan_level=post_summary.get("pengetahuan_level"),
                kuis_post_efikasi_score=post_summary.get("efikasi_diri_score"),
                kuis_post_efikasi_level=post_summary.get("efikasi_diri_level"),
                kuis_post_sikap_score=post_summary.get("sikap_score"),
                kuis_post_sikap_level=post_summary.get("sikap_level"),
                kuis_post_tindakan_score=post_summary.get("tindakan_score"),
                kuis_post_tindakan_level=post_summary.get("tindakan_level"),
                kuis_post_submitted_at=post_summary.get("submitted_at"),
                lipi_results=list(reversed(lipi_result_list)),
                triage_completed=len(completed_triage) > 0,
                triage_session_count=len(completed_triage),
                triage_best_score=triage_best_score,
                triage_first_score=first_triage_score,
                triage_first_correct=first_triage_correct,
                triage_first_total=first_triage_total,
                triage_last_score=_int_or_none((last_triage or {}).get("score")) if last_triage else None,
                triage_last_correct=_int_or_none((last_triage or {}).get("correct_count")) if last_triage else None,
                triage_last_total=last_total,
                triage_sessions=triage_session_list,
                pelatihan_hadir_count=len(hadir_rows),
                pelatihan_last_hadir_at=last_hadir_at,
                pelatihan_rows=pel_list,
                last_activity_at=_latest_activity(
                    user_videos,
                    user_lipis,
                    user_triage,
                    hadir_rows,
                ),
                is_working=is_working,
                wa_status=wa_status,
                wa_phone=wa_phone_raw,
                wa_chat_count=wa_chat_count,
                wa_last_chat_at=_iso_dt(wa_last) or None,
            )
        )

    result.sort(
        key=lambda x: (
            not x.is_working,
            not x.triage_completed,
            x.video_completed < _MONITOR_REQUIRED_VIDEOS,
            -(x.kuis_pengetahuan_score or 0),
            x.username,
        )
    )

    working_count = sum(1 for r in result if r.is_working)
    # Aggregate triage stats across all sessions
    triage_total_sessions = len(triage_sessions)
    triage_completed_all = [
        t for t in triage_sessions
        if str(t.get("status") or "").lower() == "completed"
    ]
    triage_first_score: int | None = None
    triage_last_score: int | None = None
    if triage_completed_all:
        first_s = min(
            triage_completed_all,
            key=lambda x: _iso_dt(x.get("completed_at") or x.get("started_at")),
        )
        triage_first_score = _int_or_none(first_s.get("score"))
        last_s = max(
            triage_completed_all,
            key=lambda x: _iso_dt(x.get("completed_at") or x.get("started_at")),
        )
        triage_last_score = _int_or_none(last_s.get("score"))
    summary = MonitorSummaryOut(
        total_staff=len(result),
        working_count=working_count,
        not_working_count=len(result) - working_count,
        published_video_total=published_video_total,
        total_lipi_submissions=len(lipi_sessions),
        kuis_pre_test_count=sum(1 for r in result if r.kuis_pre_submitted_at),
        kuis_post_test_count=sum(1 for r in result if r.kuis_post_submitted_at),
        kuis_post_pending_count=sum(1 for r in result if r.kuis_status == "post_menunggu"),
        triage_completed_count=sum(1 for r in result if r.triage_completed),
        triage_total_sessions=triage_total_sessions,
        triage_first_score=triage_first_score,
        triage_last_score=triage_last_score,
        pelatihan_hadir_staff_count=sum(1 for r in result if r.pelatihan_hadir_count > 0),
        wa_connected_count=sum(1 for r in result if r.wa_status == "connected"),
        wa_previously_connected_count=sum(1 for r in result if r.wa_status == "previously_connected"),
        wa_never_connected_count=sum(1 for r in result if r.wa_status == "never_connected"),
        wa_total_chats=sum(r.wa_chat_count for r in result),
        updated_at=datetime.now(timezone.utc).isoformat(),
    )
    return MonitorDashboardOut(summary=summary, users=result)


@router.get("/users/{username}/wa-chats", response_model=WaChatHistoryOut)
async def get_user_wa_chats(
    username: str,
    _admin: str = Depends(require_content_admin),
):
    _ = _admin
    db = get_db()
    uname = (username or "").strip()
    user = await db.users.find_one({"username": uname, "role": "staff"})
    if not user:
        raise HTTPException(status_code=404, detail="Akun petugas tidak ditemukan.")

    turns_raw = await list_wa_chats_for_username(db, uname)
    chat_count = sum(1 for t in turns_raw if t.get("role") == "user" and t.get("kind") != "context")
    reply_count = sum(1 for t in turns_raw if t.get("role") == "assistant" and t.get("kind") != "context")
    wa_phone_raw = str(user.get("wa_phone") or "").strip() or None
    wa_status = classify_wa_connection_status(
        wa_phone=wa_phone_raw,
        had_exchange=chat_count >= 1 and reply_count >= 1,
    )
    return WaChatHistoryOut(
        username=uname,
        display_name=str(user.get("display_name") or "").strip() or None,
        wa_status=wa_status,
        wa_phone=wa_phone_raw,
        chat_count=chat_count,
        turns=[WaChatTurnOut(**t) for t in turns_raw],
    )
