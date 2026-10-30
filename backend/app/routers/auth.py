from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status

from app.routers.sertifikat import puskesmas_nama_for_user

from app.auth_utils import create_access_token, verify_password
from app.config import settings, user_mgmt_usernames
from app.deps import get_current_user
from app.db import get_db
from app.fonnte_client import normalize_id_wa
from siaga_common.wa_staff_link import unlink_wa_staff_phone
from app.wa_gateway import (
    resolve_staff_wa_me_phone,
    staff_wa_chat_config_error_detail,
    staff_webhook_hint_url,
)
from app.schemas import (
    LoginBody,
    MeResponse,
    ProfileSetupBody,
    ProfileSetupOut,
    TokenResponse,
    WaStaffLoginPollOut,
    WaStaffLoginStartIn,
    WaStaffLoginStartOut,
    WaStaffUnlinkOut,
)
from app.wa_staff_login import poll_staff_wa_session, start_staff_wa_login

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginBody):
    db = get_db()
    username = body.username.strip()
    password = body.password.strip()
    user = await db.users.find_one({"username": username})
    if user is None or not verify_password(password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username atau password salah",
        )
    token = create_access_token(username)
    return TokenResponse(access_token=token)


@router.post("/wa-staff/start", response_model=WaStaffLoginStartOut)
async def wa_staff_start(body: WaStaffLoginStartIn):
    """
    Magic link: hanya untuk akun peran masyarakat / *staff* (bukan admin/developer di WA).
    Pengguna memasukkan nomor WA, lalu mengirim teks `SBP <kode>` ke chat bisnis (Fonnte).
    """
    username = body.username.strip()
    phone = normalize_id_wa(body.phone.strip())
    if not phone or len(phone) < 10 or not phone.isdigit():
        raise HTTPException(
            status_code=400,
            detail="Nomor WhatsApp tidak valid. Contoh: 6281234567890 atau 081234567890",
        )
    db = get_db()
    user = await db.users.find_one({"username": username})
    if not user or str(user.get("role", "")) != "staff":
        raise HTTPException(
            status_code=400,
            detail="Hanya akun petugas (staff) yang dapat login lewat WhatsApp. Admin/developer: gunakan password.",
        )
    num = resolve_staff_wa_me_phone()
    if not num:
        raise HTTPException(
            status_code=503,
            detail=staff_wa_chat_config_error_detail(),
        )
    session_id, _raw, message_text, exp = await start_staff_wa_login(
        db,
        username=username,
        expected_phone=phone,
        ttl_minutes=settings.wa_magic_link_ttl_minutes,
    )
    wa_me_ready = True
    wa_me_url = f"https://wa.me/{num}?text={quote(message_text)}"
    public = (settings.public_api_base or "").strip().rstrip("/")
    webhook_url = staff_webhook_hint_url(public)
    return WaStaffLoginStartOut(
        session_id=session_id,
        message_text=message_text,
        wa_me_url=wa_me_url,
        wa_me_ready=wa_me_ready,
        expires_at=exp.isoformat(),
        webhook_url=webhook_url,
        expected_phone=phone,
    )


@router.get("/wa-staff/poll", response_model=WaStaffLoginPollOut)
async def wa_staff_poll(session_id: str):
    """Setelah verifikasi WA, polling sampai `status=ready` lalu `access_token` tersedia sekali."""
    db = get_db()
    token, err = await poll_staff_wa_session(db, session_id=session_id)
    if token:
        return WaStaffLoginPollOut(status="ready", access_token=token)
    if err:
        return WaStaffLoginPollOut(status="error", detail=err)
    return WaStaffLoginPollOut(status="pending")


def _me_from_user_doc(username: str, doc: dict | None) -> MeResponse:
    role = str(doc.get("role", "staff")) if doc else "staff"
    wa_raw = doc.get("wa_phone") if doc else None
    wa_phone = str(wa_raw).strip() if wa_raw else None
    if not wa_phone:
        wa_phone = None
    linked = doc.get("wa_phone_updated_at") if doc else None
    linked_s: str | None = None
    if linked is not None:
        linked_s = linked.isoformat() if hasattr(linked, "isoformat") else str(linked)
    display_raw = doc.get("display_name") if doc else None
    display_name = str(display_raw).strip() if display_raw else None
    if not display_name:
        display_name = None
    needs_profile_setup = role == "staff" and not display_name
    wilayah_raw = doc.get("research_wilayah") if doc else None
    research_wilayah = str(wilayah_raw).strip() if wilayah_raw else None
    if not research_wilayah:
        research_wilayah = None
    puskesmas_id = str(doc.get("puskesmas_id") or "") if doc else ""
    return MeResponse(
        username=username,
        role=role,
        can_manage_users=username in user_mgmt_usernames(),
        wa_phone=wa_phone,
        wa_phone_linked_at=linked_s,
        display_name=display_name,
        needs_profile_setup=needs_profile_setup,
        research_wilayah=research_wilayah,
        puskesmas_id=puskesmas_id or None,
    )


@router.get("/me", response_model=MeResponse)
async def me(username: str = Depends(get_current_user)):
    db = get_db()
    doc = await db.users.find_one({"username": username})
    resp = _me_from_user_doc(username, doc)
    pk_nama = await puskesmas_nama_for_user(db, doc)
    if pk_nama:
        return resp.model_copy(update={"puskesmas_nama": pk_nama})
    return resp


@router.post("/profile-setup", response_model=ProfileSetupOut)
async def profile_setup(body: ProfileSetupBody, username: str = Depends(get_current_user)):
    """Login pertama masyarakat: isi nama tampilan sekali; username tidak berubah."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    if not doc or str(doc.get("role", "")) != "staff":
        raise HTTPException(
            status_code=403,
            detail="Hanya akun petugas yang dapat mengatur nama profil.",
        )
    existing = str(doc.get("display_name") or "").strip()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Nama sudah diatur. Username tidak dapat diubah lewat langkah ini.",
        )
    name = body.display_name.strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Nama minimal 2 karakter.")
    await db.users.update_one({"username": username}, {"$set": {"display_name": name}})
    if doc.get("research_sample"):
        await db.research_sample_accounts.update_one(
            {"username": username},
            {"$set": {"display_name": name}},
        )
    return ProfileSetupOut(display_name=name, needs_profile_setup=False)


@router.post("/wa-staff/unlink", response_model=WaStaffUnlinkOut)
async def wa_staff_unlink(username: str = Depends(get_current_user)):
    """Lepaskan nomor WhatsApp dari akun petugas (staff)."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    if not doc or str(doc.get("role", "")) != "staff":
        raise HTTPException(
            status_code=403,
            detail="Hanya akun petugas yang dapat mengelola tautan WhatsApp.",
        )
    await unlink_wa_staff_phone(db, username=username)
    return WaStaffUnlinkOut(ok=True, wa_phone=None)
