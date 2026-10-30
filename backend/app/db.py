from app.config import settings
from siaga_common.mongo import close_db as _close
from siaga_common.mongo import connect_db as _connect
from siaga_common.mongo import get_client, get_db

__all__ = ["close_db", "connect_db", "get_client", "get_db"]


async def connect_db() -> None:
    await _connect(settings.mongodb_uri, settings.mongodb_db)


async def close_db() -> None:
    await _close()
