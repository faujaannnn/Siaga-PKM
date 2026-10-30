from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Sifatkan path .env relatif ke folder backend, bukan CWD (uvicorn/pm2 kadang CWD-nya bukan sini).
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    mongodb_uri: str = "mongodb://127.0.0.1:27017"
    mongodb_db: str = "siaga_puskesmas"
    jwt_secret: str = "ganti-secret-di-produksi-minimal-32-karakter"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7
    default_admin_username: str = "drdiah"
    default_admin_password: str = "admin123"
    default_petugas_username: str = "petugas"
    default_petugas_password: str = "petugas123"
    default_developer_username: str = "sutra"
    default_developer_password: str = "sutra"
    # Satu kali: hapus semua user lalu buat ulang drdiah + akun petugas (staff) dari config (.env).
    reset_users_on_start: bool = False
    # Direktori penyimpanan unggahan (PDF, gambar). Dilayani statis di /api/uploads.
    uploads_dir: Path = _BACKEND_ROOT / "uploads"
    # Batas ukuran satu berkas (byte). Atur di .env: UPLOAD_MAX_BYTES=104857600
    upload_max_bytes: int = 100 * 1024 * 1024
    # DeepSeek (OpenAI-compatible) untuk asesmen video ML — jangan commit nilai asli, gunakan .env
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"
    deepseek_model: str = "deepseek-chat"
    # Opsional: kunci API Google (Drive v3) untuk proxy PDF ML bila unduhan uc?export= dari server gagal.
    # Di GCP aktifkan "Google Drive API"; berkas tetap harus "siapa pun dengan tautan" dapat mengakses.
    google_drive_api_key: str = ""
    # OSRM untuk simulasi jalur evakuasi (GET /route/v1/…); demo publik OK untuk pengembangan.
    osrm_router_base_url: str = "https://router.project-osrm.org"
    # deepseek = API cloud; ollama = lokal (cepat, tanpa kunci) — cukup: ollama serve && ollama pull qwen2.5:1.5b
    llm_provider: str = "deepseek"
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_model: str = "qwen2.5:1.5b"
    # Jika diisi, seed akan memastikan user admin "fauzan" ada (password di .env, bukan di kode sumber)
    fauzan_admin_password: str = ""
    # Koma: username yang boleh mengelola akun petugas (staff) (default: hanya default_admin_username)
    user_mgmt_admin_usernames: str = ""
    # URL publik API (HTTPS, tanpa /api) — untuk dokumentasi & teks bantu di login WA
    public_api_base: str = ""
    # WhatsApp Fonnte: magic link masyarakat / staff (sama pola fmanage, lihat INTEGRASI_WA_*.txt di app)
    fonnte_token: str = ""
    fonnte_api_base: str = "https://api.fonnte.com"
    # Nomor perangkat/bisnis di panel (62…, tanpa +) — wajib untuk link wa.me
    fonnte_inbound_wa: str = ""
    # Opsional: override nomor tujuan chat di wa.me
    fonnte_wa_me_chat_wa: str = ""
    wa_magic_link_ttl_minutes: int = 30
    # Asisten teks petugas/staff lewat Fonnte (gabung data materi + progres ML + LLM, jarak tanya cepat)
    fonnte_staff_ai_enabled: bool = True
    # Batas karakter korpus (edukasi + video ML + halaman + beranda + statis) — naikkan jika server kuat
    fonnte_staff_context_max_chars: int = 100_000
    fonnte_staff_llm_read_timeout: float = 36.0
    fonnte_staff_llm_max_tokens: int = 600
    fonnte_staff_llm_temperature: float = 0.22
    # 0 = tanpa jeda antar pesan (asisten LLM); naikkan jika Fonnte mengirim duplikat webhook
    fonnte_staff_rate_min_seconds: float = 0.0
    # WhatsApp: evolution (produksi) | fonnte (cadangan)
    wa_gateway: str = "evolution"
    evolution_api_base: str = ""
    evolution_api_key: str = ""
    evolution_instance: str = ""
    evolution_inbound_wa: str = ""


settings = Settings()


def user_mgmt_usernames() -> set[str]:
    """Username yang boleh menambah/menghapus akun petugas (staff) (selaras dengan require_main_admin)."""
    raw = (settings.user_mgmt_admin_usernames or "").strip()
    if not raw:
        return {settings.default_admin_username}
    return {x.strip() for x in raw.split(",") if x.strip()}
