"""Perhitungan jadwal notifikasi — waktu lokal WIB (Asia/Jakarta)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

WIB = ZoneInfo("Asia/Jakarta")


def now_wib() -> datetime:
    return datetime.now(WIB)


def parse_jam(jam: str) -> tuple[int, int]:
    try:
        parts = (jam or "08:00").strip().split(":")
        return int(parts[0]), int(parts[1])
    except Exception:
        return 8, 0


def local_to_utc_iso(dt_wib: datetime) -> str:
    return dt_wib.astimezone(timezone.utc).isoformat()


def parse_tanggal(tanggal: str) -> tuple[int, int, int] | None:
    try:
        y, m, d = (int(x) for x in tanggal.strip().split("-"))
        return y, m, d
    except Exception:
        return None


def hitung_next_kirim(notif: dict, *, after: datetime | None = None) -> str | None:
    """Hitung waktu kirim berikutnya (ISO UTC). `after` dalam WIB."""
    if not notif.get("aktif", False):
        return None

    tipe = notif.get("jadwal_tipe", "sekali")
    if tipe == "instant":
        return None

    hour, minute = parse_jam(notif.get("jam", "08:00"))
    now = after or now_wib()

    if tipe == "sekali":
        parsed = parse_tanggal(notif.get("tanggal") or "")
        if not parsed:
            return None
        y, m, d = parsed
        target = datetime(y, m, d, hour, minute, tzinfo=WIB)
        if target <= now:
            return None
        return local_to_utc_iso(target)

    if tipe == "harian":
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        return local_to_utc_iso(target)

    if tipe == "mingguan":
        parsed = parse_tanggal(notif.get("tanggal") or "")
        weekday = parsed and datetime(parsed[0], parsed[1], parsed[2], tzinfo=WIB).weekday() or now.weekday()
        days_ahead = (weekday - now.weekday()) % 7
        target = now.replace(hour=hour, minute=minute, second=0, microsecond=0) + timedelta(days=days_ahead)
        if target <= now:
            target += timedelta(weeks=1)
        return local_to_utc_iso(target)

    if tipe == "tahunan":
        parsed = parse_tanggal(notif.get("tanggal") or "")
        if not parsed:
            return None
        _, m, d = parsed
        target = datetime(now.year, m, d, hour, minute, tzinfo=WIB)
        if target <= now:
            target = datetime(now.year + 1, m, d, hour, minute, tzinfo=WIB)
        return local_to_utc_iso(target)

    return None


def countdown_text(next_kirim_iso: str | None) -> str | None:
    """Konversi next_kirim → teks «X jam Y menit» (WIB)."""
    if not next_kirim_iso:
        return None
    try:
        next_dt = datetime.fromisoformat(next_kirim_iso)
        if next_dt.tzinfo is None:
            next_dt = next_dt.replace(tzinfo=timezone.utc)
        delta = next_dt - datetime.now(timezone.utc)
        total_sec = int(delta.total_seconds())
        if total_sec <= 0:
            return "Segera terkirim"
        days, rem = divmod(total_sec, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, _ = divmod(rem, 60)
        parts: list[str] = []
        if days:
            parts.append(f"{days} hari")
        if hours:
            parts.append(f"{hours} jam")
        if minutes or not parts:
            parts.append(f"{minutes} menit")
        return " ".join(parts)
    except Exception:
        return None
