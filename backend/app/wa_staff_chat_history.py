"""Riwayat percakapan asisten WA per nomor — agar LLM mengingat chat sebelumnya."""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import settings
from app.fonnte_client import canonical_wa_phone

_COLLECTION = "wa_staff_chat_sessions"

# Maks. pasang user+assistant yang dikirim ke LLM
_MAX_TURNS = 8
_USER_CLIP = 2500
_ASSISTANT_CLIP = 1800
_CONTEXT_REFRESH_TURNS = 4
_IDLE_HOURS = 24

_RESET_RE = re.compile(
    r"^(reset|mulai baru|chat baru|hapus riwayat|clear|bersihkan)\b",
    re.I,
)


def is_chat_reset_command(message: str) -> bool:
    return bool(_RESET_RE.match((message or "").strip()))


def _clip(s: str, n: int) -> str:
    t = (s or "").strip()
    if len(t) <= n:
        return t
    return t[: n - 1] + "…"


async def clear_chat_session(db: AsyncIOMotorDatabase, phone: str) -> None:
    p = canonical_wa_phone(phone)
    if p:
        await db[_COLLECTION].delete_one({"phone": p})


async def load_chat_session(db: AsyncIOMotorDatabase, phone: str) -> dict[str, Any] | None:
    return await _load_session(db, phone)


async def _load_session(db: AsyncIOMotorDatabase, phone: str) -> dict[str, Any] | None:
    p = canonical_wa_phone(phone)
    if not p:
        return None
    return await db[_COLLECTION].find_one({"phone": p})


def _session_stale(doc: dict[str, Any] | None) -> bool:
    if not doc:
        return True
    updated = doc.get("updated_at")
    if not isinstance(updated, datetime):
        return True
    if updated.tzinfo is None:
        updated = updated.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) - updated > timedelta(hours=_IDLE_HOURS)


def _needs_context_refresh(doc: dict[str, Any] | None) -> bool:
    if _session_stale(doc):
        return True
    turns = doc.get("turns") or []
    if not turns:
        return True
    user_count = sum(1 for t in turns if t.get("role") == "user")
    last_ctx = doc.get("context_at")
    if not last_ctx:
        return True
    if user_count > 0 and user_count % _CONTEXT_REFRESH_TURNS == 0:
        return True
    return False


def history_for_llm(doc: dict[str, Any] | None) -> list[dict[str, str]]:
    if not doc or _session_stale(doc):
        return []
    turns = doc.get("turns") or []
    out: list[dict[str, str]] = []
    for t in turns[-(_MAX_TURNS * 2) :]:
        role = str(t.get("role") or "")
        content = str(t.get("content") or "").strip()
        if role not in ("user", "assistant") or not content:
            continue
        out.append({"role": role, "content": content})
    return out


async def append_chat_turn(
    db: AsyncIOMotorDatabase,
    *,
    phone: str,
    username: str,
    user_text: str,
    assistant_text: str,
    context_refreshed: bool = False,
) -> None:
    p = canonical_wa_phone(phone)
    if not p:
        return
    now = datetime.now(timezone.utc)
    user_part = {"role": "user", "content": _clip(user_text, _USER_CLIP), "at": now}
    asst_part = {"role": "assistant", "content": _clip(assistant_text, _ASSISTANT_CLIP), "at": now}

    doc = await _load_session(db, p)
    if _session_stale(doc):
        turns: list[dict[str, Any]] = []
    else:
        turns = list(doc.get("turns") or [])

    turns.extend([user_part, asst_part])
    max_stored = _MAX_TURNS * 2 + 4
    if len(turns) > max_stored:
        turns = turns[-max_stored:]

    update: dict[str, Any] = {
        "phone": p,
        "username": username,
        "turns": turns,
        "updated_at": now,
    }
    if context_refreshed:
        update["context_at"] = now

    await db[_COLLECTION].update_one({"phone": p}, {"$set": update}, upsert=True)


def should_inject_context_block(doc: dict[str, Any] | None) -> bool:
    return _needs_context_refresh(doc)


async def append_wa_context_turn(
    db: AsyncIOMotorDatabase,
    *,
    phone: str,
    username: str,
    context_label: str,
    assistant_text: str,
) -> None:
    """Catat pesan keluar (laporan LIPI, evaluasi, dll.) agar LLM lanjutan paham topik."""
    p = canonical_wa_phone(phone)
    if not p or not (assistant_text or "").strip():
        return
    label = (context_label or "Konteks WA").strip()
    user_stub = f"[{label}]"
    await append_chat_turn(
        db,
        phone=p,
        username=username,
        user_text=user_stub,
        assistant_text=assistant_text,
        context_refreshed=False,
    )


# ── Monitor: status koneksi & riwayat chat ───────────────────────────────────

WA_STATUS_CONNECTED = "connected"
WA_STATUS_PREVIOUSLY = "previously_connected"
WA_STATUS_NEVER = "never_connected"


def is_context_stub(content: str | None) -> bool:
    t = (content or "").strip()
    return bool(t) and t.startswith("[") and t.endswith("]")


def infer_turn_kind(role: str, content: str, kind: str | None = None) -> str:
    if kind in ("chat", "context"):
        return kind
    if role == "user" and is_context_stub(content):
        return "context"
    return "chat"


def classify_wa_connection_status(
    *,
    wa_phone: str | None,
    had_exchange: bool = False,
) -> str:
    """Terhubung/pernah terhubung hanya jika sudah ada minimal 1 chat user dan 1 balasan asisten."""
    if not had_exchange:
        return WA_STATUS_NEVER
    if (wa_phone or "").strip():
        return WA_STATUS_CONNECTED
    return WA_STATUS_PREVIOUSLY


def _is_counted_chat_turn(turn: dict[str, Any], role: str) -> bool:
    if str(turn.get("role") or "") != role:
        return False
    content = str(turn.get("content") or "")
    kind = infer_turn_kind(role, content, str(turn.get("kind") or "") or None)
    return kind != "context" and bool(content.strip())


def count_user_chat_turns(turns: list[dict[str, Any]] | None) -> int:
    return sum(1 for t in turns or [] if _is_counted_chat_turn(t, "user"))


def count_assistant_chat_turns(turns: list[dict[str, Any]] | None) -> int:
    return sum(1 for t in turns or [] if _is_counted_chat_turn(t, "assistant"))


def has_chat_exchange(*, user_count: int, reply_count: int) -> bool:
    return int(user_count) >= 1 and int(reply_count) >= 1


def _iso_dt(value: object | None) -> str:
    if value is None:
        return ""
    if hasattr(value, "isoformat"):
        return value.isoformat()  # type: ignore[union-attr]
    return str(value)


def _merge_chat_stat(
    stats: dict[str, dict[str, Any]],
    uname: str,
    user_count: int,
    reply_count: int,
    last_at: object | None,
) -> None:
    if not uname:
        return
    cur = stats.get(uname) or {
        "chat_count": 0,
        "reply_count": 0,
        "last_chat_at": None,
        "has_exchange": False,
    }
    cur["chat_count"] = max(int(cur["chat_count"]), int(user_count))
    cur["reply_count"] = max(int(cur["reply_count"]), int(reply_count))
    if last_at is not None:
        prev = cur.get("last_chat_at")
        if prev is None or last_at > prev:
            cur["last_chat_at"] = last_at
    cur["has_exchange"] = has_chat_exchange(
        user_count=int(cur["chat_count"]),
        reply_count=int(cur["reply_count"]),
    )
    stats[uname] = cur


async def load_wa_chat_stats_by_username(
    db: AsyncIOMotorDatabase,
) -> dict[str, dict[str, Any]]:
    """Jumlah chat user, balasan asisten, dan apakah sudah ada 1 chat + 1 balasan."""
    stats: dict[str, dict[str, Any]] = {}
    async for session in db[_COLLECTION].find({}):
        uname = str(session.get("username") or "")
        turns = list(session.get("turns") or [])
        last_at = session.get("updated_at")
        for t in turns:
            at = t.get("at") if isinstance(t, dict) else None
            if at is not None and (last_at is None or at > last_at):
                last_at = at
        _merge_chat_stat(
            stats,
            uname,
            count_user_chat_turns(turns),
            count_assistant_chat_turns(turns),
            last_at,
        )
    return stats


async def list_wa_chats_for_username(
    db: AsyncIOMotorDatabase,
    username: str,
    *,
    limit: int = 2000,
) -> list[dict[str, Any]]:
    uname = (username or "").strip()
    if not uname:
        return []
    sessions = await db[_COLLECTION].find({"username": uname}).to_list(50)
    merged: list[dict[str, Any]] = []
    for session in sessions:
        phone = str(session.get("phone") or "") or None
        for t in session.get("turns") or []:
            if not isinstance(t, dict):
                continue
            role = str(t.get("role") or "")
            content = str(t.get("content") or "")
            if role not in ("user", "assistant") or not content.strip():
                continue
            merged.append(
                {
                    "role": role,
                    "content": content,
                    "kind": infer_turn_kind(role, content, str(t.get("kind") or "") or None),
                    "at": _iso_dt(t.get("at") or session.get("updated_at")),
                    "phone": phone,
                }
            )
    merged.sort(key=lambda row: (str(row.get("at") or ""), 0 if row.get("role") == "user" else 1))
    return merged[: max(1, min(limit, 5000))]
