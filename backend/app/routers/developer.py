from fastapi import APIRouter, Depends

from app.deps import require_developer_or_admin
from app.db import get_db

router = APIRouter(prefix="/developer", tags=["developer"])

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
async def education_for_developer(_user: str = Depends(require_developer_or_admin)):
    _ = _user
    db = get_db()
    cursor = db.education_items.find({"published": True, "audience": "developer"}).sort("sort_order", 1)
    items = await cursor.to_list(100)
    return [_edu_public_row(d) for d in items]
