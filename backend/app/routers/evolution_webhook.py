import json
import logging
from typing import Any

from fastapi import APIRouter, Request

from app.evolution_parse import evolution_webhook_to_parts
from app.staff_wa_webhook_logic import process_staff_wa_inbound

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _coerce_dict(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if isinstance(raw, list) and raw and isinstance(raw[0], dict):
        return raw[0]
    return {}


@router.get("/evolution")
@router.head("/evolution")
async def evolution_webhook_probe():
    return {
        "ok": True,
        "service": "siaga-puskesmas-evolution-webhook",
        "path": "/api/webhooks/evolution",
    }


@router.post("/evolution")
async def evolution_webhook(request: Request):
    """
    Webhook Evolution API (HTTPS). Pasang di Manager → Webhook instance/global:
      {PUBLIC_API_BASE}/api/webhooks/evolution
    """
    try:
        raw_body = await request.body()
        if not raw_body:
            return {"ok": True, "handled": False, "skip": "empty"}
        try:
            raw = json.loads(raw_body.decode("utf-8", errors="replace"))
        except json.JSONDecodeError:
            logger.warning("evolution webhook: JSON tidak valid")
            return {"ok": True, "handled": False, "skip": "bad_json"}

        payload = _coerce_dict(raw)
        parts = evolution_webhook_to_parts(payload)
        if not parts:
            event_type = payload.get("event") or payload.get("eventType") or "?"
            logger.info(
                "evolution webhook skip=no_text event=%s payload_keys=%s",
                event_type,
                str(list(payload.keys())[:12]),
            )
            return {"ok": True, "handled": False, "skip": "no_text"}

        last: dict[str, Any] = {"ok": True, "handled": False}
        n_from_me = 0
        for jid, text, from_me, send_jid in parts:
            if from_me:
                n_from_me += 1
                continue
            logger.info(
                "evolution inbound jid=%s send=%s len=%s",
                (jid or "")[:64],
                (send_jid or "")[:64],
                len(text or ""),
            )
            last = await process_staff_wa_inbound(
                sender_raw=jid,
                message=text,
                inbox_id=None,
                payload_for_scan=payload,
                send_target=send_jid,
            )
        if n_from_me == len(parts) and not last.get("handled"):
            logger.info("evolution webhook skip=from_me n=%s", n_from_me)
            last = {**last, "skip": "from_me"}
        return last
    except Exception:
        logger.exception("evolution webhook error")
        return {"ok": True, "handled": False, "error": "internal"}
