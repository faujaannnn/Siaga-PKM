"""Ekstrak pengirim & teks dari webhook Evolution API (Baileys / messages.upsert)."""

from __future__ import annotations

import json
from typing import Any, Iterator


def _msg_text_inner(message: dict[str, Any]) -> str:
    if not message:
        return ""
    # Urutan umum Baileys / Evolution
    conv = message.get("conversation")
    if isinstance(conv, str) and conv.strip():
        return conv.strip()
    et = message.get("extendedTextMessage") or message.get("extended_text_message")
    if isinstance(et, dict):
        t = et.get("text")
        if isinstance(t, str) and t.strip():
            return t.strip()
    img = message.get("imageMessage") or message.get("image_message")
    if isinstance(img, dict):
        c = img.get("caption")
        if isinstance(c, str) and c.strip():
            return c.strip()
    vid = message.get("videoMessage") or message.get("video_message")
    if isinstance(vid, dict):
        c = vid.get("caption")
        if isinstance(c, str) and c.strip():
            return c.strip()
    doc = message.get("documentMessage") or message.get("document_message")
    if isinstance(doc, dict):
        c = doc.get("caption")
        if isinstance(c, str) and c.strip():
            return c.strip()
    btns = message.get("buttonsResponseMessage") or message.get("buttons_response_message")
    if isinstance(btns, dict):
        sel = btns.get("selectedDisplayText") or btns.get("selected_display_text")
        if isinstance(sel, str) and sel.strip():
            return sel.strip()
    lst = message.get("listResponseMessage") or message.get("list_response_message")
    if isinstance(lst, dict):
        t = lst.get("title") or lst.get("description")
        if isinstance(t, str) and t.strip():
            return t.strip()
    return ""


def extract_evolution_message_text(message: Any) -> str:
    if message is None:
        return ""
    if isinstance(message, str):
        s = message.strip()
        if s.startswith("{") and s.endswith("}"):
            try:
                inner = json.loads(s)
                return extract_evolution_message_text(inner)
            except json.JSONDecodeError:
                pass
        return s
    if not isinstance(message, dict):
        return ""
    direct = _msg_text_inner(message)
    if direct:
        return direct
    # Kadang nested under message.ephemeralMessage / viewOnce / protocolMessage
    for nest_key in (
        "ephemeralMessage",
        "ephemeral_message",
        "viewOnceMessage",
        "view_once_message",
        "documentWithCaptionMessage",
        "editedMessage",
        "edited_message",
        "protocolMessage",
        "protocol_message",
    ):
        nest = message.get(nest_key)
        if isinstance(nest, dict):
            inner = nest.get("message")
            if isinstance(inner, dict):
                t = extract_evolution_message_text(inner)
                if t:
                    return t
            t = extract_evolution_message_text(nest)
            if t:
                return t
    return ""


def _iter_message_nodes(payload: dict[str, Any]) -> Iterator[dict[str, Any]]:
    """
    Evolution mengirim beberapa bentuk: data tunggal, data.messages[], atau body mentah.
    """
    data = payload.get("data")
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                yield item
        return
    if isinstance(data, dict):
        msgs = data.get("messages")
        if isinstance(msgs, list):
            for item in msgs:
                if isinstance(item, dict):
                    yield item
            return
        yield data
        return
    # Tanpa key `data`: kadang pesan lengkap di root
    if isinstance(payload.get("key"), dict) or isinstance(payload.get("message"), dict):
        yield payload


def _is_group_jid(jid: str) -> bool:
    return "@g.us" in (jid or "").lower()


def _is_lid_jid(jid: str) -> bool:
    return "@lid" in (jid or "").lower()


def _phoneish_jid(raw: Any) -> str:
    """JID nomor nyata (bukan LID/grup). WhatsApp LID tidak boleh dipakai verifikasi/kirim."""
    s = str(raw or "").strip()
    if not s or _is_group_jid(s) or _is_lid_jid(s):
        return ""
    local = s.split("@", 1)[0].replace("+", "").replace(" ", "")
    if "@s.whatsapp.net" in s.lower():
        return s
    if local.startswith("62") and local.isdigit() and 10 <= len(local) <= 16:
        return s
    return ""


def _best_sender_jids(key: dict[str, Any], node: dict[str, Any]) -> tuple[str, str]:
    """
    (jid_untuk_cocokkan_nomor, jid_untuk_kirim_balasan).
    Evolution v2 sering mengirim remoteJid=@lid dan nomor di remoteJidAlt.
    """
    remote = str(
        key.get("remoteJid")
        or key.get("remote_jid")
        or node.get("remoteJid")
        or ""
    ).strip()
    phone = (
        _phoneish_jid(key.get("remoteJidAlt"))
        or _phoneish_jid(key.get("remote_jid_alt"))
        or _phoneish_jid(key.get("senderPn"))
        or _phoneish_jid(key.get("sender_pn"))
        or _phoneish_jid(node.get("senderPn"))
        or _phoneish_jid(node.get("sender_pn"))
        or _phoneish_jid(key.get("participantAlt"))
        or _phoneish_jid(key.get("participant_alt"))
        or _phoneish_jid(remote)
    )
    match_jid = phone or remote
    send_jid = remote if _is_lid_jid(remote) else (phone or remote)
    return match_jid, send_jid


def evolution_webhook_to_parts(
    payload: dict[str, Any],
) -> list[tuple[str, str, bool, str]]:
    """
    Mengembalikan senarai (jid_nomor, teks, from_me, jid_kirim).
    Lewati entri tanpa teks / grup (ditangani pemanggil).
    """
    out: list[tuple[str, str, bool, str]] = []

    for node in _iter_message_nodes(payload):
        key = node.get("key") or {}
        if not isinstance(key, dict):
            key = {}
        remote = str(
            key.get("remoteJid") or key.get("remote_jid") or node.get("remoteJid") or ""
        ).strip()
        if _is_group_jid(remote):
            continue
        match_jid, send_jid = _best_sender_jids(key, node)
        from_me = bool(key.get("fromMe") or key.get("from_me"))

        msg_obj = node.get("message")
        if msg_obj is None and isinstance(node.get("messageStubType"), (int, str)):
            continue
        text = extract_evolution_message_text(msg_obj)
        if not text and isinstance(node.get("body"), str):
            text = node["body"].strip()

        if match_jid and text:
            out.append((match_jid, text, from_me, send_jid or match_jid))
    return out
