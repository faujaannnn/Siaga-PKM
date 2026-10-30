import re
from urllib.parse import parse_qs, urlparse

_YT_11 = re.compile(r"^[a-zA-Z0-9_-]{11}$")


def parse_youtube_id(raw: str) -> str | None:
    s = (raw or "").strip()
    if not s:
        return None
    if _YT_11.match(s):
        return s
    if "://" not in s and s.startswith("www."):
        s = "https://" + s
    if "://" not in s and "/" in s and not s.startswith("//"):
        s = "https://" + s
    try:
        u = urlparse(s)
    except Exception:
        return None
    host = (u.netloc or "").lower().removeprefix("www.")
    path = (u.path or "").strip("/")
    if host == "youtu.be" and path:
        return path.split("/")[0][:11] or None
    if "youtube" in host or host == "m.youtube.com":
        if path == "watch" or u.path.startswith("/watch"):
            v = (parse_qs(u.query).get("v") or [None])[0]
            return (v or "")[:11] or None
        parts = path.split("/")
        if len(parts) >= 2 and parts[0] in ("embed", "shorts", "live"):
            return (parts[1] or "")[:11] or None
    return None
