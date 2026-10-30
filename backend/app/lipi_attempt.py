"""Pre-test / post-test state untuk Kuesioner Kesiapsiagaan Gempa."""

from __future__ import annotations

from typing import Any, Literal

AttemptType = Literal["pre_test", "post_test"]

ATTEMPT_PRE: AttemptType = "pre_test"
ATTEMPT_POST: AttemptType = "post_test"

ATTEMPT_LABELS = {
    ATTEMPT_PRE: "Pre-test",
    ATTEMPT_POST: "Post-test",
}


def attempt_label(attempt_type: str | None) -> str:
    if attempt_type == ATTEMPT_POST:
        return ATTEMPT_LABELS[ATTEMPT_POST]
    return ATTEMPT_LABELS[ATTEMPT_PRE]


def infer_attempt_type(doc: dict[str, Any], index_in_sorted: int = 0) -> AttemptType:
    """Tipe attempt dari field tersimpan.

    Data lama tanpa ``attempt_type`` selalu dianggap pre-test saja. Post-test
    hanya dihitung jika field ``attempt_type`` = ``post_test`` (setelah fitur
    pre/post diluncurkan), agar pengisian ulang lama tidak dianggap lengkap.
    """
    stored = doc.get("attempt_type")
    if stored in (ATTEMPT_PRE, ATTEMPT_POST):
        return stored
    return ATTEMPT_PRE


def resolve_user_attempts(sessions: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Normalisasi sesi per user.

    Returns:
        pre_session, post_session, has_pre_test, has_post_test,
        next_attempt_type, can_submit, kuis_status
    """
    sorted_sessions = sorted(
        sessions,
        key=lambda s: str(s.get("submitted_at") or ""),
    )
    pre_session: dict[str, Any] | None = None
    post_session: dict[str, Any] | None = None

    for idx, s in enumerate(sorted_sessions):
        atype = infer_attempt_type(s, idx)
        if atype == ATTEMPT_PRE and pre_session is None:
            pre_session = s
        elif atype == ATTEMPT_POST and post_session is None:
            post_session = s

    has_pre = pre_session is not None
    has_post = post_session is not None

    if has_pre and has_post:
        kuis_status = "lengkap"
        next_attempt: AttemptType | None = None
        can_submit = False
    elif has_pre:
        kuis_status = "post_menunggu"
        next_attempt = ATTEMPT_POST
        can_submit = True
    else:
        kuis_status = "belum"
        next_attempt = ATTEMPT_PRE
        can_submit = True

    return {
        "pre_session": pre_session,
        "post_session": post_session,
        "has_pre_test": has_pre,
        "has_post_test": has_post,
        "next_attempt_type": next_attempt,
        "can_submit": can_submit,
        "kuis_status": kuis_status,
    }


def next_attempt_for_submit(sessions: list[dict[str, Any]]) -> AttemptType | None:
    return resolve_user_attempts(sessions)["next_attempt_type"]
