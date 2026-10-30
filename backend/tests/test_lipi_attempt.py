"""Unit test pre-test / post-test state."""

from app.lipi_attempt import ATTEMPT_POST, ATTEMPT_PRE, resolve_user_attempts


def test_resolve_belum():
    state = resolve_user_attempts([])
    assert state["kuis_status"] == "belum"
    assert state["next_attempt_type"] == ATTEMPT_PRE
    assert state["can_submit"] is True


def test_resolve_post_menunggu():
    state = resolve_user_attempts([{"attempt_type": ATTEMPT_PRE, "submitted_at": "2026-01-01"}])
    assert state["kuis_status"] == "post_menunggu"
    assert state["next_attempt_type"] == ATTEMPT_POST


def test_resolve_lengkap():
    state = resolve_user_attempts([
        {"attempt_type": ATTEMPT_PRE, "submitted_at": "2026-01-01"},
        {"attempt_type": ATTEMPT_POST, "submitted_at": "2026-02-01"},
    ])
    assert state["kuis_status"] == "lengkap"
    assert state["can_submit"] is False


def test_legacy_double_submit_not_lengkap():
    """Pengisian ulang sebelum sistem pre/post tidak boleh dianggap post-test."""
    state = resolve_user_attempts([
        {"submitted_at": "2026-01-01"},
        {"submitted_at": "2026-02-01"},
        {"submitted_at": "2026-03-01"},
    ])
    assert state["kuis_status"] == "post_menunggu"
    assert state["has_pre_test"] is True
    assert state["has_post_test"] is False
    assert state["next_attempt_type"] == ATTEMPT_POST
