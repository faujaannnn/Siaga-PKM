"""Kirim pesan lewat API Fonnte (https://api.fonnte.com/send). Disederhanakan untuk siaga (tanpa guard echo)."""

import json
from typing import Any

import httpx

from app.config import settings


def expand_fonnte_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """
    Beberapa varian webhook mengirim isi di `data` sebagai string JSON atau dict nested —
    merge ke root sebelum baca sender/message.
    """
    raw = payload.get("data")
    if isinstance(raw, str):
        s = raw.strip()
        if s.startswith("{"):
            try:
                inner = json.loads(s)
                if isinstance(inner, dict):
                    return {**inner, **{k: v for k, v in payload.items() if k != "data"}}
            except json.JSONDecodeError:
                pass
    if isinstance(raw, dict):
        return {**raw, **{k: v for k, v in payload.items() if k != "data"}}
    return payload


def normalize_id_wa(raw: str) -> str:
    """0858… / 858… / +62… → 62… (digit saja)."""
    s = (raw or "").strip().replace(" ", "").replace("-", "")
    if not s:
        return ""
    s = s.split("@", 1)[0]
    if s.startswith("+"):
        s = s[1:]
    if s.startswith("0") and len(s) >= 10:
        return "62" + s[1:]
    if s.startswith("8") and not s.startswith("62"):
        return "62" + s
    return s


def canonical_wa_phone(raw: str | None) -> str:
    if raw is None:
        return ""
    if not isinstance(raw, str):
        raw = str(raw)
    s = raw.strip().split("@", 1)[0].replace("+", "").replace(" ", "")
    return normalize_id_wa(s)


def parse_fonnte_inbox_id(payload: dict[str, Any]) -> int | None:
    lower_map = {str(k).lower(): k for k in payload}
    for want in ("inboxid", "inbox_id"):
        if want in lower_map:
            raw = payload.get(lower_map[want])
            if raw is None or raw == "":
                continue
            try:
                n = int(str(raw).strip())
            except (TypeError, ValueError):
                continue
            if n > 0:
                return n
    nested = payload.get("data")
    if isinstance(nested, dict):
        return parse_fonnte_inbox_id(nested)
    return None


def _str_field(payload: dict[str, Any], *keys: str) -> str:
    lower_map = {str(k).lower(): k for k in payload}
    for want in keys:
        lk = want.lower()
        if lk in lower_map:
            v = payload.get(lower_map[lk])
            if v is None or v == "":
                continue
            return str(v).strip()
    nested = payload.get("data")
    if isinstance(nested, dict):
        return _str_field(nested, *keys)
    return ""


def extract_fonnte_incoming_text(payload: dict[str, Any]) -> str:
    # Urutan: field teks utama (Fonnte varian: message, text, body, content, …)
    msg = _str_field(
        payload,
        "message",
        "text",
        "msg",
        "body",
        "content",
        "chat",
        "query",
        "messageText",
        "textMessage",
        "conversation",
        "pesan",
    )
    cap = _str_field(payload, "caption", "description", "desc")
    btn = _str_field(payload, "button", "button_text", "interactive", "selectedButtonId")
    parts = [p for p in (msg, cap, btn) if p]
    if not parts:
        return ""
    out: list[str] = []
    seen: set[str] = set()
    for p in parts:
        if p not in seen:
            seen.add(p)
            out.append(p)
    return "\n".join(out) if len(out) > 1 else (out[0] if out else "")


def extract_fonnte_sender_raw(payload: dict[str, Any]) -> str:
    return _str_field(payload, "sender", "from", "phone", "participant", "member")


def extract_fonnte_device_raw(payload: dict[str, Any]) -> str:
    return _str_field(payload, "device", "device_number", "nomordevice", "deviceNumber")


def resolve_wa_me_chat_phone() -> str:
    for raw in (
        (settings.fonnte_inbound_wa or "").strip(),
        (settings.fonnte_wa_me_chat_wa or "").strip(),
    ):
        n = normalize_id_wa(raw)
        if n:
            return n
    return ""


def _fonnte_response_success(data: dict[str, Any]) -> bool:
    st = data.get("status")
    if st is None:
        st = data.get("Status")
    if st is True or str(st).lower() == "true":
        return True
    return False


async def fonnte_send_text(
    target: str,
    message: str,
    *,
    inboxid: int | None = None,
) -> tuple[bool, str]:
    token = (settings.fonnte_token or "").strip()
    if not token:
        return False, "FONNTE_TOKEN kosong"
    t = canonical_wa_phone(target)
    if not t:
        return False, "nomor tujuan kosong"
    url = settings.fonnte_api_base.rstrip("/") + "/send"
    form: dict[str, Any] = {
        "target": t,
        "message": message,
        "connectOnly": "false",
    }
    if inboxid is not None and inboxid > 0:
        form["inboxid"] = str(inboxid)

    async def _post(form_data: dict[str, Any]) -> tuple[bool, str]:
        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                r = await client.post(
                    url,
                    headers={"Authorization": token},
                    data=form_data,
                )
        except httpx.RequestError as e:
            return False, f"koneksi: {e!s}"
        body = (r.text or "")[:500]
        if r.status_code >= 400:
            return False, f"HTTP {r.status_code}: {body}"
        try:
            data: dict[str, Any] = r.json()
        except Exception:
            return True, "terkirim"
        if _fonnte_response_success(data):
            return True, "terkirim"
        err = (
            data.get("detail")
            or data.get("message")
            or data.get("reason")
            or data.get("Reason")
            or body
        )
        return False, str(err)[:200]

    ok, detail = await _post(form)
    if not ok and "connectOnly" in form:
        form_no_co = {k: v for k, v in form.items() if k != "connectOnly"}
        ok, detail = await _post(form_no_co)
        form = form_no_co
    if not ok and inboxid is not None and inboxid > 0 and "inboxid" in form:
        form_fallback = {k: v for k, v in form.items() if k != "inboxid"}
        ok2, detail2 = await _post(form_fallback)
        if ok2:
            ok, detail = True, f"terkirim (tanpa inboxid; percobaan pertama: {detail})"
        else:
            ok, detail = ok2, detail2
    return ok, detail
