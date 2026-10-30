"""Bank kasus latihan triase START — sumber: latihan-triage-start.txt"""

from typing import Any

TRIAGE_CATEGORIES: list[dict[str, str]] = [
    {"id": "hijau", "label": "HIJAU", "subtitle": "Minor", "hint": "Walking wounded"},
    {"id": "kuning", "label": "KUNING", "subtitle": "Delayed", "hint": "Dapat menunggu"},
    {"id": "merah", "label": "MERAH", "subtitle": "Immediate", "hint": "Penanganan segera"},
    {"id": "hitam", "label": "HITAM", "subtitle": "Expectant", "hint": "Prioritas rendah"},
]

_VALID_ANSWERS = frozenset(c["id"] for c in TRIAGE_CATEGORIES)

TRIAGE_CASES: list[dict[str, Any]] = [
    {
        "id": 1,
        "text": (
            "Pada saat melakukan triage di bencana, petugas menemukan seorang pasien "
            "terduduk di tanah. Saat diperiksa:\n"
            "  - Nadi teraba kuat\n"
            "  - Pernapasan kurang dari 30 kali per menit"
        ),
        "answer": "hijau",
    },
    {
        "id": 2,
        "text": (
            "Seorang pasien yang mengalami cedera tampak tergeletak di tanah. Saat diperiksa:\n"
            "  - Nadi pasien teraba\n"
            "  - Respirasi kurang dari 30 kali per menit"
        ),
        "answer": "hijau",
    },
    {
        "id": 3,
        "text": (
            "Seorang pasien masih tidak dapat bernapas meskipun sudah dilakukan tindakan "
            "untuk membuka jalan napas."
        ),
        "answer": "kuning",
    },
    {
        "id": 4,
        "text": (
            "Seorang pasien tergeletak dengan posisi meringkuk. Ketika jalan napas "
            "dibuka, pasien masih tidak bernapas."
        ),
        "answer": "hitam",
    },
    {
        "id": 5,
        "text": (
            "Seorang pasien tergeletak di tanah dengan luka di kaki. Saat diperiksa:\n"
            "  - Respirasi pasien kurang dari 30\n"
            "  - CRT kurang dari 2 detik\n"
            "  - Pasien dapat mengikuti seluruh perintah"
        ),
        "answer": "hitam",
    },
    {
        "id": 6,
        "text": (
            "Pasien tidak dapat mengikuti perintah. Saat diperiksa:\n"
            "  - Respirasi kurang dari 30\n"
            "  - CRT kurang dari 2 detik"
        ),
        "answer": "kuning",
    },
    {
        "id": 7,
        "text": "Seorang pasien berjalan menghampiri petugas dan menangis meraung-raung.",
        "answer": "merah",
    },
    {
        "id": 8,
        "text": (
            "Saat memeriksa pasien, ditemukan bahwa:\n"
            "  - Respirasi pasien kurang dari 30 x/menit\n"
            "  - CRT kurang dari 2 detik\n"
            "  - Pasien dapat mengikuti seluruh perintah\n"
            "  - Meskipun pasien tidak dapat berjalan"
        ),
        "answer": "hijau",
    },
    {
        "id": 9,
        "text": "Seorang pasien dengan respirasi lebih dari 30x/menit.",
        "answer": "merah",
    },
    {
        "id": 10,
        "text": (
            "Seorang pasien berjalan menghampiri petugas. Saat diperiksa:\n"
            "  - Respirasi kurang dari 30x/menit\n"
            "  - Tampak ada perdarahan dari lengan pasien"
        ),
        "answer": "merah",
    },
    {
        "id": 11,
        "text": (
            "Petugas menemukan pasien yang berjalan dengan linglung dekat tempat terjadi "
            "kecelakaan."
        ),
        "answer": "merah",
    },
    {
        "id": 12,
        "text": (
            "Seorang pasien telah kehilangan darah dalam jumlah yang banyak dari trauma "
            "bilateral amputasi organ bawah. Saat diperiksa: tidak ada pernapasan."
        ),
        "answer": "hitam",
    },
    {
        "id": 13,
        "text": "Seseorang berjalan dengan sayatan kecil di dahi.",
        "answer": "hijau",
    },
    {
        "id": 14,
        "text": "Pasien tidak bernapas setelah jalan napas dibuka. Tidak ada nadi.",
        "answer": "hitam",
    },
    {
        "id": 15,
        "text": (
            "Nadi radialis pasien teraba. Pasien terduduk di tanah dengan respirasi "
            "kurang dari 30 kali per menit."
        ),
        "answer": "kuning",
    },
    {
        "id": 16,
        "text": "Pernapasan pasien lebih dari 30 kali per menit.",
        "answer": "merah",
    },
    {
        "id": 17,
        "text": (
            "Pasien tidak dapat mengikuti perintah. Saat diperiksa:\n"
            "  - Respirasi kurang dari 30x/menit\n"
            "  - CRT kurang dari 2 detik"
        ),
        "answer": "merah",
    },
    {
        "id": 18,
        "text": (
            "Anda ditugaskan ke tempat kebakaran yang dilaporkan ada banyak pasien. "
            "Anda adalah petugas yang pertama datang pada tempat kejadian. Anda "
            "memeriksa pasien seorang laki-laki paruh baya yang mengalami luka bakar "
            "derajat dua. Dia tidak bisa bergerak sendiri. Saat diperiksa:\n"
            "  - Pernapasan 34 kali per menit\n"
            "  - Nadi teraba\n"
            "  - Dapat mengikuti perintah sederhana"
        ),
        "answer": "merah",
    },
    {
        "id": 19,
        "text": (
            "Anda ditugaskan pada kecelakaan pesawat dengan banyak pasien. Anda adalah "
            "petugas datang pertama di tempat. Anda memeriksa seorang pasien laki-laki. "
            "Pasien tersebut tidak dapat berjalan. Saat diperiksa:\n"
            "  - Respirasi 24 kali per menit\n"
            "  - Nadi teraba lemah\n"
            "  - Terdapat perdarahan dari amputasi lengan kiri parsial\n"
            "  - Perdarahan sudah terkontrol"
        ),
        "answer": "merah",
    },
    {
        "id": 20,
        "text": (
            "Anda ditugaskan pada kecelakaan bus dengan banyak pasien. Anda adalah "
            "pertugas yang datang pertama di tempat. Anda memeriksa seorang pasien "
            "wanita usia 56 tahun. Pasien tidak dapat berjalan. Saat diperiksa:\n"
            "  - Respirasi 22 x/menit\n"
            "  - Nadi teraba\n"
            "  - Dapat mengikuti perintah sederhana"
        ),
        "answer": "merah",
    },
    {
        "id": 21,
        "text": (
            "Anda ditugaskan pada kecelakaan bus dengan banyak pasien. Anda adalah "
            "pertugas yang datang pertama di tempat. Anda memeriksa seorang pasien "
            "wanita usia 56 tahun. Pasien tidak dapat berjalan. Saat diperiksa:\n"
            "  - Respirasi 22 x/menit\n"
            "  - Nadi teraba\n"
            "  - TIDAK dapat mengikuti perintah sederhana"
        ),
        "answer": "merah",
    },
    {
        "id": 22,
        "text": (
            "Anda ditugaskan pada kejadian rumah meledak. Anda adalah petugas yang "
            "pertama datang ke tempat kejadian. Anda menemukan seorang wanita dewasa "
            "yang tidak dapat berjalan. Saat diperiksa:\n"
            "  - Respirasi 18x/menit\n"
            "  - CRT kurang dari 2 detik\n"
            "  - Dapat mengikuti perintah"
        ),
        "answer": "kuning",
    },
    {
        "id": 23,
        "text": (
            "Anda ditugaskan ke tempat dimana telah terjadi baku tembak dengan "
            "beberapa korban. Anda adalah petugas pertama yang datang pada tempat "
            "kejadian. Anda memeriksa seorang pasien wanita dewasa. Ia tergeletak di "
            "tanah. Saat dilakukan pemeriksaan:\n"
            "  - Pasien tidak bernapas\n"
            "  - Setelah anda membuka jalan napas, pasien masih tidak bernapas"
        ),
        "answer": "kuning",
    },
    {
        "id": 24,
        "text": (
            "Anda ditugaskan ke tempat dimana telah terjadi kebakaran rumah dengan "
            "beberapa korban. Anda adalah petugas pertama yang datang di tempat "
            "kejadian. Anda memeriksa seorang pasien laki-laki remaja. Pasien tidak "
            "dapat berjalan, dan terdapat luka bakar derajat dua di dadanya. Saat "
            "diperiksa:\n"
            "  - Pernapasan pasien 26x/menit\n"
            "  - Nadi teraba\n"
            "  - Tidak dapat mengikuti perintah sederhana"
        ),
        "answer": "merah",
    },
    {
        "id": 25,
        "text": (
            "Anda ditugaskan ke tempat dimana telah terjadi kebakaran rumah dengan "
            "beberapa korban. Anda adalah petugas pertama yang datang di tempat "
            "kejadian. Anda memeriksa seorang pasien laki-laki paruh baya. Ia dapat "
            "berjalan sendiri dan terdapat luka bakar derajat dua pada wajahnya. "
            "Tampak jelaga disekitar mulutnya. Saat diperiksa:\n"
            "  - Respirasi 24x/menit"
        ),
        "answer": "hitam",
    },
]

_CASE_BY_ID = {c["id"]: c for c in TRIAGE_CASES}

TIME_LIMIT_SEC = 60


def normalize_answer(raw: str) -> str:
    return str(raw or "").strip().lower()


def case_public(case: dict[str, Any], index: int) -> dict[str, Any]:
    return {
        "index": index,
        "id": case["id"],
        "text": case["text"],
    }


def score_answer(
    *,
    correct: bool,
    elapsed_ms: int,
    streak_after: int,
) -> dict[str, int]:
    """Hitung poin: benar/salah + bonus kecepatan + streak."""
    if not correct:
        return {"base": 0, "speed": 0, "streak": 0, "total": 0}

    base = 100
    elapsed_sec = max(0, min(TIME_LIMIT_SEC, elapsed_ms / 1000))
    remaining_ratio = (TIME_LIMIT_SEC - elapsed_sec) / TIME_LIMIT_SEC
    speed = int(round(remaining_ratio * 40))

    streak_bonus = 0
    if streak_after >= 2:
        streak_bonus = min(80, (streak_after - 1) * 20)

    total = base + speed + streak_bonus
    return {"base": base, "speed": speed, "streak": streak_bonus, "total": total}
