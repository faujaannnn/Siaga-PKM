"""Pilih jalur kirim WA: Fonnte atau Evolution (magic link + balasan SBP + asisten petugas)."""

from __future__ import annotations

from app.config import settings
from app.evolution_client import evolution_send_text
from app.fonnte_client import fonnte_send_text, normalize_id_wa


def wa_gateway_mode() -> str:
    return (settings.wa_gateway or "fonnte").strip().lower()


def wa_outbound_configured() -> bool:
    if wa_gateway_mode() == "evolution":
        return bool(
            (settings.evolution_api_key or "").strip()
            and (settings.evolution_instance or "").strip()
            and (settings.evolution_api_base or "").strip()
        )
    return bool((settings.fonnte_token or "").strip())


def resolve_staff_wa_me_phone() -> str:
    """Nomor 62… untuk prakonfigurasi teks wa.me (chat ke akun bisnis Evolution / Fonnte)."""
    if wa_gateway_mode() == "evolution":
        for raw in (
            (settings.evolution_inbound_wa or "").strip(),
            _digits_from_instance(settings.evolution_instance),
        ):
            n = normalize_id_wa(raw)
            if n:
                return n
        return ""
    # Fonnte default
    from app.fonnte_client import resolve_wa_me_chat_phone

    return resolve_wa_me_chat_phone()


def _digits_from_instance(inst: str) -> str:
    s = (inst or "").strip().split("@", 1)[0].replace("+", "").replace(" ", "")
    return s if s.isdigit() and len(s) >= 10 else ""


async def wa_send_text(
    target: str,
    message: str,
    *,
    inboxid: int | None = None,
) -> tuple[bool, str]:
    if wa_gateway_mode() == "evolution":
        return await evolution_send_text(target, message)
    return await fonnte_send_text(target, message, inboxid=inboxid)


def staff_wa_chat_config_error_detail() -> str:
    if wa_gateway_mode() == "evolution":
        return (
            "Server belum mengatur EVOLUTION_API_BASE, EVOLUTION_API_KEY, "
            "EVOLUTION_INSTANCE, dan EVOLUTION_INBOUND_WA. Hubungi administrator."
        )
    return (
        "Server belum mengatur FONNTE_INBOUND_WA (dan token Fonnte). Hubungi administrator."
    )


def staff_webhook_hint_url(public_base: str) -> str:
    pub = public_base.strip().rstrip("/")
    path = (
        "/api/webhooks/evolution"
        if wa_gateway_mode() == "evolution"
        else "/api/whatsapp/webhook"
    )
    return f"{pub}{path}" if pub else path
