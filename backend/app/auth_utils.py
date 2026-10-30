from app.config import settings
from siaga_common.passwords import hash_password, verify_password
from siaga_common.tokens import create_access_token as _create_access_token

__all__ = ["create_access_token", "hash_password", "verify_password"]


def create_access_token(subject: str) -> str:
    return _create_access_token(subject, settings)
