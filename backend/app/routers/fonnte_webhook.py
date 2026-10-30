import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, BackgroundTasks, Request
from pymongo.errors import DuplicateKeyError

from app.db import get_db
from app.fonnte_client import (
    expand_fonnte_payload,
    extract_fonnte_incoming_text,
    extract_fonnte_sender_raw,
    parse_fonnte_inbox_id,
)
from app.staff_wa_webhook_logic import process_staff_wa_inbound

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
whatsapp_router = APIRouter(prefix="/whatsapp", tags=["webhooks"])


def _coerce_fonnte_dict(raw_obj: Any) -> dict[str, Any]:
    if isinstance(raw_obj, dict):
        return raw_obj
    if isinstance(raw_obj, list) and raw_obj and isinstance(raw_obj[0], dict):
        return raw_obj[0]
    return {}


async def _parse_incoming(request: Request) -> dict[str, Any]:
    ctype = (request.headers.get("content-type") or "").lower()
    if "application/json" in ctype:
        try:
            return _coerce_fonnte_dict(await request.json())
        except Exception:
            return {}
    try:
        form = await request.form()
        out: dict[str, Any] = {}
        for k in form.keys():
            v = form.get(k)
            if hasattr(v, "read"):
                try:
                    out[k] = (await v.read()).decode("utf-8", errors="replace")
                except Exception:
                    out[k] = str(v)
            else:
                out[k] = v
        for blob_key in ("json", "payload", "data", "body"):
            if blob_key in out and isinstance(out[blob_key], str):
                s = out[blob_key].strip()
                if s.startswith("{"):
                    try:
                        nested = json.loads(s)
                        if isinstance(nested, dict):
                            return {
                                **nested,
                                **{kk: vv for kk, vv in out.items() if kk != blob_key},
                            }
                    except json.JSONDecodeError:
                        pass
        return out
    except Exception:
        raw = await request.body()
        if not raw:
            return {}
        try:
            return _coerce_fonnte_dict(json.loads(raw.decode("utf-8", errors="replace")))
        except json.JSONDecodeError:
            return {}


_INBOUND_DEDUP_TTL = timedelta(hours=36)


async def _claim_fonnte_inbox_once(inbox_id: Optional[int], *, sender: str) -> bool:
    if inbox_id is None or inbox_id <= 0:
        return True
    db = get_db()
    now_dt = datetime.now(timezone.utc)
    try:
        await db.wa_inbound_dedup.insert_one(
            {
                "id": f"fonnte:{inbox_id}",
                "sender": sender,
                "created_at": now_dt,
                "expires_at": now_dt + _INBOUND_DEDUP_TTL,
            }
        )
        return True
    except DuplicateKeyError:
        logger.info("dedup skip fonnte inbox_id=%s sender=%s", inbox_id, sender)
        return False


async def _process_fonnte_inbound(
    sender_raw: str,
    message: str,
    inbox_id: int | None,
    payload: dict[str, Any],
) -> None:
    if not await _claim_fonnte_inbox_once(inbox_id, sender=sender_raw):
        return
    try:
        result = await process_staff_wa_inbound(
            sender_raw=sender_raw,
            message=message,
            inbox_id=inbox_id,
            payload_for_scan=payload,
        )
        logger.info("fonnte inbound done sender=%s result=%s", sender_raw[:24], result)
    except Exception:
        logger.exception("fonnte inbound failed sender=%s", sender_raw[:24])


async def fonnte_incoming(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook Fonnte: ACK cepat lalu proses di background (LLM bisa 30–90 dtk).
    Fonnte timeout webhook kalau kita nunggu jawaban AI — pesan lanjutan jadi hilang.
    """
    try:
        data = expand_fonnte_payload(await _parse_incoming(request))
        message = extract_fonnte_incoming_text(data)
        sender_raw_str = extract_fonnte_sender_raw(data)
        inbox_id = parse_fonnte_inbox_id(data)
        if not data:
            logger.warning("fonnte webhook: body kosong atau tidak terbaca")
            return {"ok": True, "handled": False, "skip": "empty"}
        if message or sender_raw_str:
            logger.info(
                "fonnte webhook masuk: sender=%s msg_len=%s",
                sender_raw_str[:24] if sender_raw_str else "?",
                len(message or ""),
            )
        background_tasks.add_task(
            _process_fonnte_inbound,
            sender_raw_str,
            message or "",
            inbox_id,
            data,
        )
        return {"ok": True, "queued": True}

    except Exception:
        logger.exception("fonnte_sbp handler error")
        return {"ok": True, "handled": False, "error": "internal"}


@router.get("/fonnte")
@router.head("/fonnte")
async def fonnte_webhook_probe():
    return {"ok": True, "service": "siaga-puskesmas-fonnte-webhook", "path": "/api/webhooks/fonnte"}


@router.post("/fonnte")
async def fonnte_webhook(request: Request, background_tasks: BackgroundTasks):
    return await fonnte_incoming(request, background_tasks)


@whatsapp_router.get("/webhook")
@whatsapp_router.head("/webhook")
async def whatsapp_webhook_probe():
    return {"ok": True, "service": "siaga-puskesmas-fonnte-webhook", "path": "/api/whatsapp/webhook"}


@whatsapp_router.post("/webhook")
async def whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    return await fonnte_incoming(request, background_tasks)
