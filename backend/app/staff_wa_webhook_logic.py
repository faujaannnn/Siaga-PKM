"""
Logika bersama webhook WA petugas: verifikasi SBP + asisten teks.
Digunakan oleh webhook Fonnte dan Evolution.
"""

from __future__ import annotations

import logging
from typing import Any

from app.config import settings
from app.db import get_db
from app.fonnte_client import canonical_wa_phone
from app.fonnte_staff_assistant import handle_staff_fonnte_message
from app.lipi_wa_followup import try_handle_lipi_wa_detail_reply
from app.wa_gateway import wa_outbound_configured, wa_send_text
from app.wa_staff_login import (
    consume_sbp_code_for_staff_login,
    extract_sbp_code_from_message,
    sbp_challenge_for_code,
    scan_payload_for_sbp_code,
)

logger = logging.getLogger(__name__)


async def process_staff_wa_inbound(
    *,
    sender_raw: str,
    message: str,
    inbox_id: int | None,
    payload_for_scan: dict[str, Any] | None = None,
    send_target: str | None = None,
) -> dict[str, Any]:
    """
    sender_raw: JID atau nomor dari penyedia (untuk deteksi grup / cocokkan nomor).
    message: teks yang sudah diekstrak dari payload penyedia.
    inbox_id: hanya Fonnte; Evolution kirim None.
    send_target: JID kirim balasan (boleh @lid); default sama dengan sender.
    """
    if "g.us" in f"{sender_raw} {send_target or ''}".lower():
        return {"ok": True, "handled": False, "skip": "group"}

    sender = canonical_wa_phone(sender_raw)
    if not sender:
        return {"ok": True, "handled": False}
    st = (send_target or "").strip()
    if st.lower().endswith("@lid") or st.lower().endswith("@s.whatsapp.net"):
        dest = st
    else:
        dest = canonical_wa_phone(st) or sender

    code = extract_sbp_code_from_message(message) if message else None
    if not code:
        code = scan_payload_for_sbp_code(payload_for_scan) if payload_for_scan else None
    if not code and message:
        code = scan_payload_for_sbp_code({"text": message})

    if not code and message and "sbp" in message.lower():
        logger.warning(
            "wa sbp: ada SBP tapi kode tidak terbaca, potongan=%r",
            message[:160],
        )

    if not code:
        msg_in = (message or "").strip()
        if msg_in and wa_outbound_configured():
            db = get_db()
            if await try_handle_lipi_wa_detail_reply(
                db,
                phone=sender,
                message=msg_in,
                inbox_id=inbox_id,
                send_target=dest,
            ):
                return {"ok": True, "handled": True, "mode": "lipi_wa_detail"}
            if settings.fonnte_staff_ai_enabled:
                h, reason = await handle_staff_fonnte_message(
                    db,
                    sender=sender,
                    message=message or "",
                    inbox_id=inbox_id,
                    send_target=dest,
                )
                if h:
                    return {"ok": True, "handled": True, "mode": "staff_wa", "r": reason}
                if reason == "not_bound_staff":
                    logger.debug("wa: nomor %s belum tertaut — tidak membalas", sender[:16])
                    return {"ok": True, "handled": False, "skip": "not_bound"}
        return {"ok": True, "handled": False, "skip": "not_verification"}

    if not wa_outbound_configured():
        logger.warning("wa SBP: outbound tidak dikonfigurasi (Fonnte/Evolution)")
        return {"ok": True, "handled": False, "skip": "no_wa_token"}

    db = get_db()
    if not await sbp_challenge_for_code(db, code):
        logger.debug("sbp: kode bukan milik DB proyek ini — tidak membalas")
        return {"ok": True, "handled": False, "skip": "sbp_foreign"}

    ok, reply = await consume_sbp_code_for_staff_login(db, raw_code=code, phone=sender)
    if (reply or "").strip():
        try:
            sent_ok, detail = await wa_send_text(dest, reply, inboxid=inbox_id)
            logger.info(
                "wa_send_text after sbp ok=%s sent=%s dest=%s detail=%s",
                ok,
                sent_ok,
                dest[:48],
                detail,
            )
            if not sent_ok:
                logger.warning(
                    "wa_send_text failed after sbp ok=%s dest=%s detail=%s",
                    ok,
                    dest[:48],
                    detail,
                )
        except Exception:
            logger.exception("wa_send_text error dest=%s", dest[:48])
    return {"ok": True, "handled": ok, "mode": "sbp_verify"}
