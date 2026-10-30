"""
Simulasi jalur evakuasi (materi masyarakat): banyak titik kumpul per wilayah (tidak terbatas) + routing OSRM.
"""

import logging
import uuid
from typing import Any, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.config import settings
from app.db import get_db
from app.deps import require_content_admin

log = logging.getLogger(__name__)

public_router = APIRouter(prefix="/public", tags=["evacuation-sim"])
admin_router = APIRouter(prefix="/admin", tags=["admin-evacuation-sim"])

_SETTINGS_KEY = "evacuation_sim"

REGION_ORDER: tuple[Literal["all", "talise", "wani", "jonooge"], ...] = ("all", "talise", "wani", "jonooge")

REGION_LABEL_UI: dict[str, str] = {
    "all": "Seluruh wilayah (acuan umum)",
    "talise": "Kelurahan Talise, Kota Palu",
    "wani": "Desa Wani, Kabupaten Donggala",
    "jonooge": "Desa Jono Oge, Kabupaten Sigi",
}

_ALLOWED_REGION_IDS = frozenset(REGION_ORDER)


class EvacPointIn(BaseModel):
    """Satu titik evakuasi; koordinat wajib jika dikirim (untuk penyimpanan hanya yang lengkap yang disimpan)."""

    id: str = ""
    region_id: Literal["all", "talise", "wani", "jonooge"]
    title: str = ""
    lat: float | None = None
    lng: float | None = None

    @model_validator(mode="after")
    def lat_lng_pair(self):
        if self.lat is None and self.lng is None:
            return self
        if self.lat is None or self.lng is None:
            raise ValueError("Latitude dan longitude harus keduanya diisi atau keduanya kosong.")
        return self


class EvacuationSimSettingsIn(BaseModel):
    enabled: bool = False
    destinations: list[EvacPointIn]


class EvacDestinationPublic(BaseModel):
    id: str
    region_id: str
    region_label: str
    title: str
    lat: float
    lng: float


class EvacuationSimPublicPayload(BaseModel):
    enabled: bool
    destinations: list[EvacDestinationPublic]


class OsrmRouteIn(BaseModel):
    from_lat: float = Field(..., ge=-90, le=90)
    from_lng: float = Field(..., ge=-180, le=180)
    to_lat: float = Field(..., ge=-90, le=90)
    to_lng: float = Field(..., ge=-180, le=180)
    profile: Literal["foot", "car"] = "foot"


class OsrmRouteOut(BaseModel):
    coordinates_lat_lng: list[list[float]]
    distance_m: float
    duration_s: float


def _default_doc() -> dict:
    return {"_id": _SETTINGS_KEY, "enabled": False, "destinations": []}


def _row_to_numbers(lat: Any, lng: Any) -> tuple[float, float] | None:
    try:
        la = float(lat)  # type: ignore[arg-type]
        ln = float(lng)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if not (-90 <= la <= 90 and -180 <= ln <= 180):
        return None
    return la, ln


def _sanitize_stored_destinations(raw: Any) -> list[dict]:
    """Normalisasi + pastikan tiap titik punya id unik (migrasi data lama).

    Mendukung banyak titik kumpul per wilayah - tidak ada batasan jumlah titik.
    Urutan dipertahankan sesuai REGION_ORDER lalu urutan masukan.
    """
    by_region: dict[str, list[dict[str, Any]]] = {r: [] for r in REGION_ORDER}
    seen_ids: set[str] = set()
    for row in raw or []:
        if not isinstance(row, dict):
            continue
        rid = str(row.get("region_id") or "").strip()
        if rid not in _ALLOWED_REGION_IDS:
            continue
        pair = _row_to_numbers(row.get("lat"), row.get("lng"))
        if pair is None:
            continue
        pid = str(row.get("id") or "").strip()
        if not pid or pid in seen_ids:
            pid = str(uuid.uuid4())
        seen_ids.add(pid)
        tit = str(row.get("title") or "").strip() or REGION_LABEL_UI.get(rid, rid)
        la, ln = pair
        by_region[rid].append({"id": pid, "region_id": rid, "title": tit, "lat": la, "lng": ln})

    out: list[dict] = []
    for r in REGION_ORDER:
        out.extend(by_region[r])
    return out


def _normalize_for_save(body: EvacuationSimSettingsIn) -> list[dict]:
    """Normalisasi daftar titik kumpul; banyak titik per wilayah diizinkan tanpa batas."""
    by_region: dict[str, list[dict[str, Any]]] = {r: [] for r in REGION_ORDER}
    seen_ids: set[str] = set()
    for pt in body.destinations:
        if pt.lat is None or pt.lng is None:
            continue
        rid = pt.region_id
        if rid not in _ALLOWED_REGION_IDS:
            continue
        la, ln = pt.lat, pt.lng
        if not (-90 <= la <= 90 and -180 <= ln <= 180):
            continue
        pid = (pt.id or "").strip()
        if not pid or pid in seen_ids:
            pid = str(uuid.uuid4())
        seen_ids.add(pid)
        tit = (pt.title or "").strip() or REGION_LABEL_UI.get(rid, rid)
        by_region[rid].append({"id": pid, "region_id": rid, "title": tit, "lat": la, "lng": ln})
    out: list[dict] = []
    for r in REGION_ORDER:
        out.extend(by_region[r])
    return out


async def _get_doc(db):
    doc = await db.app_settings.find_one({"_id": _SETTINGS_KEY})
    if doc and isinstance(doc.get("destinations"), list):
        return doc
    return _default_doc()


def _to_public(doc: dict) -> EvacuationSimPublicPayload:
    if not doc.get("enabled", False):
        return EvacuationSimPublicPayload(enabled=False, destinations=[])
    sanitized = _sanitize_stored_destinations(doc.get("destinations"))
    pubs: list[EvacDestinationPublic] = []
    for row in sanitized:
        rid = row["region_id"]
        label = REGION_LABEL_UI.get(rid, rid)
        pubs.append(
            EvacDestinationPublic(
                id=row["id"],
                region_id=rid,
                region_label=label,
                title=str(row.get("title") or "").strip() or label,
                lat=float(row["lat"]),
                lng=float(row["lng"]),
            )
        )
    return EvacuationSimPublicPayload(enabled=True, destinations=pubs)


async def _call_osrm(body: OsrmRouteIn) -> OsrmRouteOut:
    base = (settings.osrm_router_base_url or "").strip().rstrip("/")
    if not base:
        raise HTTPException(status_code=503, detail="Layanan rute tidak dikonfigurasi.")
    coords = (
        f"{body.from_lng:.6f},{body.from_lat:.6f};{body.to_lng:.6f},{body.to_lat:.6f}"
    )
    prof = body.profile.strip().lower()
    url = (
        f"{base}/route/v1/{prof}/{coords}"
        "?overview=full&geometries=geojson&alternatives=false&steps=false"
    )
    try:
        async with httpx.AsyncClient(timeout=18.0) as client:
            r = await client.get(url)
    except httpx.RequestError as e:
        log.warning("OSRM request error: %s", e)
        raise HTTPException(status_code=502, detail="Gagal menghubungi layanan rute.") from e
    if r.status_code != 200:
        raise HTTPException(status_code=502, detail="Layanan rute tidak tersedia (HTTP %s)." % r.status_code)
    data = r.json()
    if data.get("code") != "Ok":
        detail = (
            data.get("message")
            if isinstance(data.get("message"), str)
            else "Tidak ditemukan jalur antara kedua titik."
        )
        raise HTTPException(status_code=422, detail=detail)
    routes = data.get("routes")
    if not routes:
        raise HTTPException(status_code=422, detail="Tidak ditemukan jalur antara kedua titik.")
    r0 = routes[0]
    geom = (((r0 or {}).get("geometry")) or {})
    coords_ll = geom.get("coordinates")
    if not isinstance(coords_ll, list) or len(coords_ll) < 2:
        raise HTTPException(status_code=422, detail="Geometri rute tidak valid.")
    latlng: list[list[float]] = []
    for pt in coords_ll:
        if not isinstance(pt, (list, tuple)) or len(pt) < 2:
            continue
        try:
            ln = float(pt[0])
            la = float(pt[1])
        except (TypeError, ValueError):
            continue
        latlng.append([la, ln])
    if len(latlng) < 2:
        raise HTTPException(status_code=422, detail="Geometri rute tidak dapat dibaca.")
    dist = float(r0.get("distance", 0) or 0)
    dur = float(r0.get("duration", 0) or 0)
    return OsrmRouteOut(coordinates_lat_lng=latlng, distance_m=dist, duration_s=dur)


@public_router.get("/evacuation-sim", response_model=EvacuationSimPublicPayload)
async def get_evacuation_sim_public():
    db = get_db()
    doc = await _get_doc(db)
    return _to_public(doc)


@public_router.post("/evacuation-sim/route", response_model=OsrmRouteOut)
async def post_evacuation_route(body: OsrmRouteIn):
    return await _call_osrm(body)


@admin_router.get("/evacuation-sim", response_model=dict)
async def admin_get_evacuation_sim(_admin: str = Depends(require_content_admin)):
    db = get_db()
    doc = await _get_doc(db)
    enabled = bool(doc.get("enabled", False))
    raw = doc.get("destinations") or []
    sanitized = _sanitize_stored_destinations(raw)
    return {"enabled": enabled, "destinations": sanitized}


@admin_router.put("/evacuation-sim", response_model=dict)
async def admin_put_evacuation_sim(
    body: EvacuationSimSettingsIn,
    _admin: str = Depends(require_content_admin),
):
    db = get_db()
    normalized = _normalize_for_save(body)
    await db.app_settings.update_one(
        {"_id": _SETTINGS_KEY},
        {
            "$set": {
                "enabled": bool(body.enabled),
                "destinations": normalized,
            }
        },
        upsert=True,
    )
    doc = await db.app_settings.find_one({"_id": _SETTINGS_KEY})
    sanitized = _sanitize_stored_destinations(doc.get("destinations") if doc else normalized)
    return {
        "enabled": bool(doc.get("enabled")) if doc else body.enabled,
        "destinations": sanitized,
    }
