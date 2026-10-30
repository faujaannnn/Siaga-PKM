from __future__ import annotations

import sys
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.wa_staff_chat_history import (  # noqa: E402
    classify_wa_connection_status,
    count_assistant_chat_turns,
    count_user_chat_turns,
    has_chat_exchange,
    infer_turn_kind,
    is_context_stub,
)


def test_classify_connected_needs_exchange_and_phone():
    assert (
        classify_wa_connection_status(wa_phone="6281234567890", had_exchange=True)
        == "connected"
    )


def test_classify_phone_without_exchange_is_never():
    assert (
        classify_wa_connection_status(wa_phone="6281234567890", had_exchange=False)
        == "never_connected"
    )


def test_classify_previously_connected_after_exchange_without_phone():
    assert classify_wa_connection_status(wa_phone=None, had_exchange=True) == "previously_connected"
    assert classify_wa_connection_status(wa_phone="  ", had_exchange=True) == "previously_connected"


def test_classify_never_without_exchange():
    assert classify_wa_connection_status(wa_phone=None, had_exchange=False) == "never_connected"
    assert classify_wa_connection_status(wa_phone=None) == "never_connected"


def test_exchange_requires_chat_and_reply():
    assert has_chat_exchange(user_count=1, reply_count=1)
    assert not has_chat_exchange(user_count=1, reply_count=0)
    assert not has_chat_exchange(user_count=0, reply_count=1)


def test_count_skips_context_stubs():
    turns = [
        {"role": "user", "content": "halo"},
        {"role": "assistant", "content": "hai"},
        {"role": "user", "content": "[Laporan Kuis LIPI]", "kind": "context"},
        {"role": "assistant", "content": "ringkasan", "kind": "context"},
        {"role": "user", "content": "berapa skor saya?"},
    ]
    assert count_user_chat_turns(turns) == 2
    assert count_assistant_chat_turns(turns) == 1


def test_infer_kind_from_stub_text():
    assert is_context_stub("[Konteks WA]")
    assert not is_context_stub("halo [tes]")
    assert infer_turn_kind("user", "[Laporan Kuis LIPI]") == "context"
    assert infer_turn_kind("user", "halo") == "chat"
