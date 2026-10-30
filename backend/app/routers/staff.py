from fastapi import APIRouter, Depends, Query

from app.db import get_db
from app.deps import require_staff_or_admin
from app.schemas import MlStaffUnderstandingOut
from app.staff_assessment_profile import load_staff_understanding_rows

router = APIRouter(prefix="/staff", tags=["staff"])

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


def _edu_public_row(d: dict) -> dict:
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


@router.get("/education")
async def education_for_staff(_user: str = Depends(require_staff_or_admin)):
    """Materi edukasi ruang masyarakat: audiens staff + legacy public (bukan developer)."""
    db = get_db()
    cursor = (
        db.education_items.find(
            {
                "published": True,
                "audience": {"$in": ["staff", "public"]},
            }
        )
        .sort("sort_order", 1)
    )
    items = await cursor.to_list(500)
    return [_edu_public_row(d) for d in items]


@router.get("/ml-understanding", response_model=list[MlStaffUnderstandingOut])
async def ml_understanding_for_staff(
    limit: int = Query(80, ge=1, le=200),
    username: str = Depends(require_staff_or_admin),
):
    """Laporan asesmen video ML & PDF ML (selesai): untuk tab Profil masyarakat."""
    return await load_staff_understanding_rows(get_db(), username, limit=limit)
