"""Audit trail for siaga-puskesmas.

Logs: who, what, when for all significant system actions.
Collection: lipi_audit_log
"""

from datetime import datetime, timezone
from typing import Any

from app.db import get_db

_COLLECTION = "lipi_audit_log"


async def log_action(
    action: str,
    username: str,
    detail: dict[str, Any] | None = None,
) -> None:
    db = get_db()
    doc = {
        "action": action,
        "username": username,
        "timestamp": datetime.now(timezone.utc),
        "detail": detail or {},
    }
    await db[_COLLECTION].insert_one(doc)


# Action constants
ACTION_SKRINING_SUBMIT = "skrining_submit"
ACTION_SKRINING_DELETE = "skrining_delete"
ACTION_SKRINING_VIEW = "skrining_view"
ACTION_LOGIN = "login"
ACTION_LOGOUT = "logout"
ACTION_PROFILE_UPDATE = "profile_update"
ACTION_EXPORT = "export"
