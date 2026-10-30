#!/usr/bin/env python3
"""
Cek sambungan LLM (DeepSeek atau Ollama) dari .env di folder backend.

Jalankan dari folder backend (saat venv aktif):
  .venv/bin/python scripts/llm_smoke_test.py
"""
from __future__ import annotations

import asyncio
import sys
import time
from pathlib import Path

# agar "from app.…" jalan: root = folder induk dari scripts/
_ROOT = Path(__file__).resolve().parent.parent
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


async def main() -> int:
    from app.config import settings
    from app.llm_client import aclose_http, get_http, llm_json

    prov = (settings.llm_provider or "deepseek").strip().lower()
    print("LLM provider:", prov)
    if prov in ("ollama", "local"):
        print("Ollama URL:", settings.ollama_base_url, "model:", settings.ollama_model)
    else:
        print("DeepSeek URL:", settings.deepseek_base_url, "model:", settings.deepseek_model)
        if not (settings.deepseek_api_key or "").strip():
            print("PERINGATAN: DEEPSEEK_API_KEY kosong — panggilan akan gagal (atau set LLM_PROVIDER=ollama).")
    t0 = time.perf_counter()
    try:
        out = await llm_json(
            'Balas HANYA JSON valid, contoh: {"pong": true}',
            "Pong. Satu objek JSON saja; tanpa markdown.",
            max_tokens=80,
            read_timeout=35.0,
        )
    except Exception as e:
        print("GAGAL:", e)
        await aclose_http()
        return 1
    t1 = time.perf_counter()
    ms = (t1 - t0) * 1000
    print("OK dalam %.0f ms" % ms)
    print("Respons (parse):", out)
    _ = await get_http()
    await aclose_http()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
