"""
Klien LLM terpadu: pool HTTP (keep-alive) + orjson, mendukung DeepSeek (jaringan) atau Ollama (lokal, cepat dev).

Atur lewat .env: LLM_PROVIDER=deepseek|ollama
"""
import asyncio
import json
import logging
import re
from typing import Any

import httpx
import orjson
from fastapi import HTTPException, status

from app.config import settings

log = logging.getLogger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]*?)\s*```", re.IGNORECASE)

_lock = asyncio.Lock()
_http: httpx.AsyncClient | None = None


async def get_http() -> httpx.AsyncClient:
    global _http
    async with _lock:
        if _http is None or _http.is_closed:
            _http = httpx.AsyncClient(
                http2=False,
                limits=httpx.Limits(
                    max_keepalive_connections=12,
                    max_connections=20,
                ),
                timeout=httpx.Timeout(
                    connect=12.0,
                    read=300.0,
                    write=30.0,
                    pool=10.0,
                ),
            )
            log.info("LLM: httpx AsyncClient (keep-alive) siap")
    return _http


async def aclose_http() -> None:
    global _http
    async with _lock:
        if _http and not _http.is_closed:
            await _http.aclose()
        _http = None
        log.info("LLM: koneksi HTTP ditutup")


def _parse_json_flexible(text: str) -> dict[str, Any]:
    t = (text or "").strip()
    m = _JSON_FENCE.search(t)
    if m:
        t = m.group(1).strip()
    if not t.startswith("{"):
        l = t.find("{")
        r = t.rfind("}")
        if l != -1 and r != -1 and r > l:
            t = t[l : r + 1]
    try:
        return orjson.loads(t)
    except orjson.JSONDecodeError:
        return json.loads(t)


def _req_timeout(read_s: float) -> httpx.Timeout:
    return httpx.Timeout(connect=12.0, read=read_s, write=20.0, pool=8.0)


async def _call_deepseek_messages(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int | None,
    read_timeout: float,
) -> str:
    if not (settings.deepseek_api_key or "").strip():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Layanan ujian belum siap. Mohon coba beberapa saat lagi.",
        )
    base = settings.deepseek_base_url.rstrip("/")
    url = f"{base}/v1/chat/completions"
    payload: dict = {
        "model": settings.deepseek_model,
        "messages": messages,
        "temperature": temperature,
    }
    if max_tokens is not None:
        payload["max_tokens"] = max_tokens
    client = await get_http()
    try:
        r = await client.post(
            url,
            headers={
                "Authorization": f"Bearer {settings.deepseek_api_key.strip()}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=_req_timeout(read_timeout),
        )
        r.raise_for_status()
        data = r.json()
        return str(data["choices"][0]["message"]["content"] or "")
    except httpx.ReadTimeout as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Pertanyaan membutuhkan waktu lebih lama dari biasanya. Mohon coba lagi.",
        ) from e
    except httpx.HTTPStatusError as e:
        code = e.response.status_code
        if code == 401:
            detail = "Layanan ujian mengalami masalah teknis. Mohon coba lagi nanti."
        elif code == 429:
            detail = "Servis sedang sibuk. Mohon tunggu sebentar dan coba lagi."
        else:
            detail = "Maaf, ujian tidak bisa diproses saat ini. Mohon coba lagi."
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail) from e
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Tidak dapat menghubungi layanan AI. Periksa jaringan, firewall, dan kunci API.",
        ) from e


async def _call_deepseek(
    system: str,
    user: str,
    *,
    temperature: float,
    max_tokens: int | None,
    read_timeout: float,
) -> str:
    return await _call_deepseek_messages(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        read_timeout=read_timeout,
    )


async def _call_ollama_messages(
    messages: list[dict[str, str]],
    *,
    temperature: float,
    max_tokens: int | None,
    read_timeout: float,
    for_json: bool = False,
) -> str:
    base = settings.ollama_base_url.rstrip("/")
    url = f"{base}/api/chat"
    n_predict = 512 if max_tokens is None else min(max_tokens, 2048)
    body: dict = {
        "model": settings.ollama_model,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": n_predict,
        },
        "messages": messages,
    }
    if for_json:
        body["format"] = "json"
    client = await get_http()
    try:
        r = await client.post(url, json=body, timeout=_req_timeout(read_timeout))
        r.raise_for_status()
        data = r.json()
        return str((data.get("message") or {}).get("content") or "")
    except httpx.ReadTimeout as e:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Pertanyaan membutuhkan waktu lebih lama dari biasanya. Mohon coba lagi.",
        ) from e
    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Maaf, ujian tidak bisa diproses saat ini. Mohon coba lagi.",
        ) from e
    except httpx.RequestError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Layanan ujian tidak bisa dijangkau saat ini. Mohon coba lagi nanti.",
        ) from e


async def _call_ollama(
    system: str,
    user: str,
    *,
    temperature: float,
    max_tokens: int | None,
    read_timeout: float,
    for_json: bool = False,
) -> str:
    return await _call_ollama_messages(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        read_timeout=read_timeout,
        for_json=for_json,
    )


def _is_ollama() -> bool:
    p = (getattr(settings, "llm_provider", "deepseek") or "deepseek").strip().lower()
    return p in ("ollama", "local")


async def llm_chat(
    system: str,
    user: str,
    *,
    temperature: float = 0.4,
    max_tokens: int | None = None,
    read_timeout: float = 90.0,
    for_json: bool = False,
) -> str:
    return await llm_chat_messages(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        read_timeout=read_timeout,
        for_json=for_json,
    )


async def llm_chat_messages(
    messages: list[dict[str, str]],
    *,
    temperature: float = 0.4,
    max_tokens: int | None = None,
    read_timeout: float = 90.0,
    for_json: bool = False,
) -> str:
    if not messages:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Pesan LLM kosong.",
        )
    if _is_ollama():
        return await _call_ollama_messages(
            messages,
            temperature=temperature,
            max_tokens=max_tokens,
            read_timeout=read_timeout,
            for_json=for_json,
        )
    return await _call_deepseek_messages(
        messages,
        temperature=temperature,
        max_tokens=max_tokens,
        read_timeout=read_timeout,
    )


async def llm_json(
    system: str,
    user: str,
    *,
    temperature: float = 0.3,
    max_tokens: int | None = None,
    read_timeout: float = 90.0,
) -> dict[str, Any]:
    text = await llm_chat(
        system,
        user,
        temperature=temperature,
        max_tokens=max_tokens,
        read_timeout=read_timeout,
        for_json=True,
    )
    try:
        return _parse_json_flexible(text)
    except (orjson.JSONDecodeError, json.JSONDecodeError, TypeError) as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Maaf, jawaban dari sistem tidak bisa diproses. Mohon coba lagi.",
        ) from e


# Nama lama (router masih impor "deepseek_json")
async def deepseek_json(
    system: str,
    user: str,
    *,
    temperature: float = 0.3,
    max_tokens: int | None = None,
    read_timeout: float = 90.0,
) -> dict[str, Any]:
    return await llm_json(
        system,
        user,
        temperature=temperature,
        max_tokens=max_tokens,
        read_timeout=read_timeout,
    )


async def deepseek_chat(
    system: str,
    user: str,
    *,
    temperature: float = 0.4,
    max_tokens: int | None = None,
    read_timeout: float = 90.0,
) -> str:
    return await llm_chat(
        system,
        user,
        temperature=temperature,
        max_tokens=max_tokens,
        read_timeout=read_timeout,
    )
