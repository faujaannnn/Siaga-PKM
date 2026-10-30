from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt

from app.config import settings, user_mgmt_usernames
from app.db import get_db

security = HTTPBearer(auto_error=False)


async def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> str:
    if creds is None or creds.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autentikasi diperlukan",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            creds.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        sub = payload.get("sub")
        if not isinstance(sub, str) or not sub:
            raise HTTPException(status_code=401, detail="Token tidak valid")
        return sub
    except JWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid") from None


async def require_main_admin(username: str = Depends(get_current_user)) -> str:
    if username not in user_mgmt_usernames():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya admin utama yang dapat mengelola akun petugas (staff)",
        )
    return username


async def require_content_admin(username: str = Depends(get_current_user)) -> str:
    """Hanya akun ber-role admin yang boleh mengubah beranda, edukasi, dan unggah file."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    role = str(doc.get("role", "staff")) if doc else "staff"
    if role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya admin yang dapat mengelola konten situs",
        )
    return username


async def require_staff_or_admin(username: str = Depends(get_current_user)) -> str:
    """Materi internal petugas/staff: hanya staff atau admin."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    role = str(doc.get("role", "staff")) if doc else "staff"
    if role not in ("staff", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya petugas (akun staff) atau admin yang dapat mengakses materi ini",
        )
    return username


async def require_developer_or_admin(username: str = Depends(get_current_user)) -> str:
    """Dokumentasi developer: akun developer atau admin."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    role = str(doc.get("role", "staff")) if doc else "staff"
    if role not in ("developer", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya akun developer atau admin yang dapat mengakses dokumentasi ini",
        )
    return username


async def require_kapus(username: str = Depends(get_current_user)) -> str:
    """Hanya akun kepala_puskesmas yang boleh mengakses fitur kapus."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    role = str(doc.get("role", "staff")) if doc else "staff"
    if role not in ("kepala_puskesmas", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya kepala puskesmas atau admin yang dapat mengakses fitur ini",
        )
    return username


async def require_kapus_only(username: str = Depends(get_current_user)) -> str:
    """Hanya akun kepala_puskesmas (tidak termasuk admin) — untuk operasi yang puskesmas-spesifik."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    role = str(doc.get("role", "staff")) if doc else "staff"
    if role != "kepala_puskesmas":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hanya kepala puskesmas yang dapat mengakses fitur ini",
        )
    return username


async def require_any_authenticated(username: str = Depends(get_current_user)) -> str:
    """Semua user yang sudah login."""
    return username


async def get_user_role(username: str = Depends(get_current_user)) -> tuple[str, str]:
    """Return (username, role)."""
    db = get_db()
    doc = await db.users.find_one({"username": username})
    role = str(doc.get("role", "staff")) if doc else "staff"
    return username, role
