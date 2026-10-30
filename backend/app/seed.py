import re

from app import developer_handbook, disaster_data
from app.auth_utils import hash_password
from app.config import settings
from app.db import get_db
from app.puskesmas_research_staff import ensure_puskesmas_research_staff

_TEST_STAFF_USERNAME = "dokterdiah"
_TEST_STAFF_PASSWORD = "user123"
_RESEARCH_STAFF_PATTERN = r"^(?:pantoloan|talise)\d{2}$"


async def _ensure_user(username: str, password: str, *, role: str) -> None:
    """Buat user default hanya jika belum ada — jangan overwrite password di setiap boot."""
    db = get_db()
    existing = await db.users.find_one({"username": username})
    if existing:
        # Pastikan role default tetap konsisten; password tidak diubah.
        if existing.get("role") != role:
            await db.users.update_one({"username": username}, {"$set": {"role": role}})
        return
    await db.users.insert_one(
        {
            "username": username,
            "password_hash": hash_password(password),
            "role": role,
        }
    )


async def _ensure_test_staff() -> None:
    """Akun uji tunggal untuk login manual (di luar 30 staff penelitian)."""
    await _ensure_user(_TEST_STAFF_USERNAME, _TEST_STAFF_PASSWORD, role="staff")
    db = get_db()
    await db.users.update_one(
        {"username": _TEST_STAFF_USERNAME},
        {"$set": {"needs_profile_setup": False, "display_name": "Dr. Diah (test)"}},
    )


async def _purge_nonessential_users() -> None:
    """Hanya admin drdiah, akun uji dokterdiah, dan 30 staff pantoloan/talise."""
    db = get_db()
    admin_username = settings.default_admin_username
    keep_staff_re = re.compile(_RESEARCH_STAFF_PATTERN)
    to_delete: list[str] = []
    for doc in await db.users.find({}, {"username": 1, "role": 1}).to_list(500):
        username = str(doc.get("username") or "")
        role = str(doc.get("role") or "")
        if role == "admin":
            if username == admin_username:
                continue
            to_delete.append(username)
            continue
        if role == "staff" and (
            username == _TEST_STAFF_USERNAME or keep_staff_re.fullmatch(username)
        ):
            continue
        to_delete.append(username)
    if not to_delete:
        return
    await db.users.delete_many({"username": {"$in": to_delete}})
    await db.research_sample_accounts.delete_many({"username": {"$in": to_delete}})


_PLACEHOLDER_PROFIL = (
    "Konten ini menggantikan halaman serupa di situs lama (CodeIgniter). "
    "Teks asli biasanya tersimpan di tabel profil / halaman statis database MySQL lama. "
    "Salin isi resmi ke sini lewat panel Admin → Halaman situs, atau ubah langsung di MongoDB "
    "koleksi `site_pages`."
)


async def ensure_seed() -> None:
    db = get_db()

    await db.education_items.update_many(
        {"audience": {"$exists": False}},
        {"$set": {"audience": "public"}},
    )
    await db.education_items.update_many(
        {"category": {"$exists": False}},
        {"$set": {"category": "peraturan"}},
    )

    # Bahan bacaan: kategori Video | Buku | PPT | Peraturan | Poster.
    _NEW_EDU_CATS = {"video", "buku", "ppt", "peraturan", "sop", "artikel", "poster"}
    _PPT_FROM = {"info_pelatihan", "agenda", "ppt"}
    _BUKU_FROM = {
        "materi",
        "tips_bencana",
        "panduan",
        "umum",
        "berita",
        "pengumuman",
        "buku",
    }
    _POSTER_FROM = {"gambar", "poster"}
    async for doc in db.education_items.find({}):
        kind = str(doc.get("kind") or "").strip()
        cat = str(doc.get("category") or "").strip()
        # Handbook developer (teks) tetap kind=artikel, kategori buku.
        if doc.get("seed_key") == "developer_handbook" or (
            kind == "artikel" and doc.get("audience") == "developer"
        ):
            patch = {}
            if cat != "buku":
                patch["category"] = "buku"
            if patch:
                await db.education_items.update_one({"_id": doc["_id"]}, {"$set": patch})
            continue
        if kind == "artikel" and doc.get("audience") != "developer":
            new_cat = "artikel"
            new_kind = "pdf"
        elif kind == "artikel":
            continue
        elif kind == "video":
            new_cat = "video"
            new_kind = "video"
        elif kind in ("banner", "gambar"):
            new_cat = "poster"
            new_kind = kind
        elif cat in _NEW_EDU_CATS:
            new_cat = cat
            if cat == "video":
                new_kind = "video"
            elif cat == "poster":
                new_kind = kind if kind in ("banner", "gambar") else "banner"
            elif cat == "artikel":
                new_kind = "pdf"
            else:
                new_kind = "pdf"
        elif cat == "peraturan":
            new_cat = "peraturan"
            new_kind = "pdf"
        elif cat in _PPT_FROM:
            new_cat = "ppt"
            new_kind = "pdf"
        elif cat in _POSTER_FROM:
            new_cat = "poster"
            new_kind = kind if kind in ("banner", "gambar") else "banner"
        elif cat in _BUKU_FROM:
            new_cat = "buku"
            new_kind = "pdf"
        elif cat == "video":
            new_cat = "video"
            new_kind = "video"
        else:
            new_cat = "buku"
            new_kind = "pdf"
        if kind in ("banner", "gambar"):
            new_cat = "poster"
            new_kind = kind
        patch = {}
        if cat != new_cat:
            patch["category"] = new_cat
        if kind != new_kind:
            patch["kind"] = new_kind
        if patch:
            await db.education_items.update_one({"_id": doc["_id"]}, {"$set": patch})

    # Artikel penelitian: format PDF Drive + urutan 1–15 (insertion order).
    _ARTIKEL_PLACEHOLDER = "FILE_DOKUMEN_PDF_ATTACHED"
    artikel_cursor = db.education_items.find(
        {"category": "artikel", "audience": {"$ne": "developer"}}
    ).sort("_id", 1)
    artikel_docs = await artikel_cursor.to_list(100)
    for idx, doc in enumerate(artikel_docs, start=1):
        patch_artikel: dict = {}
        if doc.get("kind") != "pdf":
            patch_artikel["kind"] = "pdf"
        body = str(doc.get("body") or "").strip()
        if body == _ARTIKEL_PLACEHOLDER:
            patch_artikel["body"] = ""
        if int(doc.get("sort_order") or 0) == 0:
            patch_artikel["sort_order"] = idx
        if patch_artikel:
            await db.education_items.update_one({"_id": doc["_id"]}, {"$set": patch_artikel})

    # Bersihkan upload Momo (lampiran duplikat, judul berkas, body placeholder).
    from app.education_sanitize import sanitize_education_fields

    async for doc in db.education_items.find({}):
        momo_patch = sanitize_education_fields(doc)
        if momo_patch:
            await db.education_items.update_one({"_id": doc["_id"]}, {"$set": momo_patch})

    # Bersihkan meta subkategori yang memakai kategori lama.
    meta = await db.site_education_meta.find_one({"_id": "main"})
    if meta and isinstance(meta.get("subcategories"), dict):
        remapped: dict[str, list[str]] = {}
        _cat_remap = {
            "panduan": "buku",
            "artikel": "artikel",
            "info_pelatihan": "ppt",
            "agenda": "ppt",
            "gambar": "poster",
        }
        for key, vals in meta["subcategories"].items():
            if not isinstance(vals, list):
                continue
            cat = key if key in _NEW_EDU_CATS else _cat_remap.get(key, "buku")
            if cat not in _NEW_EDU_CATS:
                continue
            remapped.setdefault(cat, [])
            for v in vals:
                s = str(v or "").strip()[:80]
                if s and s not in remapped[cat]:
                    remapped[cat].append(s)
        if remapped != meta.get("subcategories"):
            await db.site_education_meta.update_one(
                {"_id": "main"},
                {"$set": {"subcategories": remapped}},
            )
    await db.ml_videos.update_many(
        {"category": {"$exists": False}},
        {"$set": {"category": "asesmen_ai"}},
    )
    try:
        await db.wa_staff_login_challenges.create_index("session_id", unique=True)
    except Exception:
        pass
    try:
        await db.wa_staff_login_challenges.create_index("expires_at")
    except Exception:
        pass
    try:
        await db.users.create_index("wa_phone", sparse=True)
    except Exception:
        pass
    try:
        await db.wa_staff_chat_sessions.create_index("phone", unique=True)
    except Exception:
        pass

    if settings.reset_users_on_start:
        await db.users.delete_many({})
        user_docs: list[dict] = [
            {
                "username": settings.default_admin_username,
                "password_hash": hash_password(settings.default_admin_password),
                "role": "admin",
            },
        ]
        await db.users.insert_many(user_docs)
    else:
        await _ensure_user(
            settings.default_admin_username,
            settings.default_admin_password,
            role="admin",
        )

    await _ensure_test_staff()
    await ensure_puskesmas_research_staff()
    await _purge_nonessential_users()

    await db.education_items.update_one(
        {"seed_key": "developer_handbook"},
        {
            "$set": {
                "kind": "artikel",
                "title": developer_handbook.DEVELOPER_ARTICLE_TITLE,
                "description": developer_handbook.DEVELOPER_ARTICLE_DESCRIPTION,
                "url": "",
                "thumbnail_url": "",
                "cover_url": "",
                "body": developer_handbook.DEVELOPER_ARTICLE_BODY,
                "attachments": [],
                "audience": "developer",
                "category": "buku",
                "sort_order": 0,
                "published": True,
                "seed_key": "developer_handbook",
            }
        },
        upsert=True,
    )

    # Only update sections if they don't exist yet — preserve existing images
    existing = await db.site_homepage.find_one({"_id": "main"})
    if not existing:
        await db.site_homepage.insert_one(
            {
                "_id": "main",
                "sections": [
                    {
                        "type": "hero",
                        "id": "hero-1",
                        "title": "Selamat datang",
                        "subtitle": "Screening, Management, Assessment, and Risk Triage for Family Disaster Preparedness (SMART FAM) merupakan portal untuk informasi dan pelaporan kejadian bencana di lingkungan masyarakat.",
                        "badge": "Kesiapsiagaan bencana alam & layanan kesehatan",
                        "highlight": "Siap sebelum bencana, tanggap saat kejadian, pulih setelahnya.",
                    },
                ],
            }
        )
    elif not any(s.get("title") == "Selamat datang" for s in existing.get("sections", [])):
        # Update title/subtitle/badge/highlight but keep images from existing hero
        await db.site_homepage.update_one(
            {"_id": "main", "sections.id": "hero-1"},
            {
                "$set": {
                    "sections.$.title": "Selamat datang",
                    "sections.$.subtitle": "Screening, Management, Assessment, and Risk Triage for Family Disaster Preparedness (SMART FAM) merupakan portal untuk informasi dan pelaporan kejadian bencana di lingkungan masyarakat.",
                    "sections.$.badge": "Kesiapsiagaan bencana alam & layanan kesehatan",
                    "sections.$.highlight": "Siap sebelum bencana, tanggap saat kejadian, pulih setelahnya.",
                }
            },
        )

    _SMART_FAM_SUBTITLE = (
        "Screening, Management, Assessment, and Risk Triage for Family Disaster Preparedness (SMART FAM) "
        "merupakan portal untuk informasi dan pelaporan kejadian bencana di lingkungan masyarakat."
    )
    await db.site_homepage.update_one(
        {
            "_id": "main",
            "sections": {
                "$elemMatch": {
                    "id": "hero-1",
                    "subtitle": {"$regex": "Merah putih kami tumpukkan", "$options": "i"},
                }
            },
        },
        {"$set": {"sections.$.subtitle": _SMART_FAM_SUBTITLE}},
    )

    await db.site_homepage.update_one(
        {"_id": "main"},
        {"$pull": {"sections": {"id": {"$in": ["text-1", "cards-1"]}}}},
    )

    # Hero: jangan gabungkan `images` lama + `heroImages` — kosongkan legacy jika heroImages ada
    home = await db.site_homepage.find_one({"_id": "main"})
    if home and isinstance(home.get("sections"), list):
        sections = home["sections"]
        changed = False
        for sec in sections:
            if not isinstance(sec, dict) or sec.get("type") != "hero":
                continue
            hi = sec.get("heroImages")
            if isinstance(hi, list) and hi and sec.get("images"):
                sec["images"] = []
                changed = True
        if changed:
            await db.site_homepage.update_one({"_id": "main"}, {"$set": {"sections": sections}})

    if await db.site_pages.count_documents({}) == 0:
        await db.site_pages.insert_many(
            [
                {
                    "slug": "visi-misi",
                    "title": "Visi & Misi",
                    "nav_label": "Visi & Misi",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 10,
                    "published": True,
                },
                {
                    "slug": "struktur-organisasi",
                    "title": "Struktur organisasi",
                    "nav_label": "Struktur",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 20,
                    "published": True,
                },
                {
                    "slug": "sejarah",
                    "title": "Sejarah",
                    "nav_label": "Sejarah",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 30,
                    "published": True,
                },
                {
                    "slug": "tupoksi",
                    "title": "Tupoksi",
                    "nav_label": "Tupoksi",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 40,
                    "published": True,
                },
                {
                    "slug": "profil-pimpinan",
                    "title": "Profil pimpinan",
                    "nav_label": "Pimpinan",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 50,
                    "published": True,
                },
                {
                    "slug": "komposisi-pegawai",
                    "title": "Komposisi pegawai",
                    "nav_label": "Komposisi pegawai",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 60,
                    "published": True,
                },
                {
                    "slug": "tujuan",
                    "title": "Tujuan",
                    "nav_label": "Tujuan",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 70,
                    "published": True,
                },
                {
                    "slug": "strategi",
                    "title": "Strategi",
                    "nav_label": "Strategi",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 80,
                    "published": True,
                },
                {
                    "slug": "agenda",
                    "title": "Agenda",
                    "nav_label": "Agenda",
                    "body": _PLACEHOLDER_PROFIL,
                    "sort_order": 90,
                    "published": True,
                },
            ]
        )

    if await db.education_items.count_documents({}) == 0:
        await db.education_items.insert_many(
            [
                {
                    "kind": "pdf",
                    "title": "Contoh peraturan (PDF)",
                    "description": "Ganti dengan PDF peraturan resmi dari panel Admin.",
                    "url": "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf",
                    "thumbnail_url": "",
                    "cover_url": "",
                    "body": "",
                    "attachments": [],
                    "audience": "public",
                    "category": "peraturan",
                    "sort_order": 0,
                    "published": True,
                },
                {
                    "kind": "pdf",
                    "title": "Contoh buku (PDF)",
                    "description": "Ganti dengan unggahan PDF resmi dari panel Admin.",
                    "url": "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf",
                    "thumbnail_url": "",
                    "cover_url": "",
                    "body": "",
                    "attachments": [],
                    "audience": "public",
                    "category": "buku",
                    "sort_order": 1,
                    "published": True,
                },
                {
                    "kind": "video",
                    "title": "Video edukasi kesehatan (YouTube)",
                    "description": "Thumbnail bisa dari unggahan gambar; pemutaran memakai embed YouTube.",
                    "url": "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
                    "thumbnail_url": "",
                    "cover_url": "",
                    "body": "",
                    "attachments": [],
                    "audience": "public",
                    "category": "video",
                    "sort_order": 2,
                    "published": True,
                },
                {
                    "kind": "pdf",
                    "title": "Contoh PPT (PDF)",
                    "description": "Materi presentasi dalam format PDF atau Drive.",
                    "url": "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf",
                    "thumbnail_url": "",
                    "cover_url": "",
                    "body": "",
                    "attachments": [],
                    "audience": "public",
                    "category": "ppt",
                    "sort_order": 3,
                    "published": True,
                },
                {
                    "kind": "pdf",
                    "title": "SOP internal masyarakat (contoh)",
                    "description": "Materi ini hanya tampil di Ruang petugas setelah login.",
                    "url": "https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf",
                    "thumbnail_url": "",
                    "cover_url": "",
                    "body": "",
                    "attachments": [],
                    "audience": "staff",
                    "category": "buku",
                    "sort_order": 0,
                    "published": True,
                },
            ]
        )
