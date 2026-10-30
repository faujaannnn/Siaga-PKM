"""Penjelasan kurasi per kasus latihan triase START - alur langkah demi langkah."""

from typing import Any

# Versi cache review di DB; naikkan bila format penjelasan berubah.
AI_REVIEW_VERSION = 2

_CAT_LABEL = {
    "merah": "MERAH (Immediate)",
    "kuning": "KUNING (Delayed)",
    "hijau": "HIJAU (Minor)",
    "hitam": "HITAM (Expectant)",
}

# rationale: kenapa kategori benar; protocol_steps: urutan START; feedback: tips
_CASE_EXPLANATIONS: dict[int, dict[str, str]] = {
    1: {
        "rationale": (
            "Pasien duduk (kondisi relatif stabil, bukan tergeletak tidak responsif). "
            "Langkah NAPAS: pernapasan <30/menit → tidak memenuhi MERAH. "
            "Nadi teraba kuat → perfusi baik, bukan HITAM. "
            "Karena vitals memungkinkan dan pasien tidak dalam kondisi gawat segera, "
            "diklasifikasikan HIJAU (Minor / walking wounded)."
        ),
        "protocol_steps": "AMAN (stabil/duduk) → Napas <30 ✓ → Nadi teraba ✓ → HIJAU",
        "feedback_educatif": "HIJAU bukan berarti tidak perlu ditangani - tetap catat dan arahkan ke area minor.",
    },
    2: {
        "rationale": (
            "Pasien tergeletak di tanah → tidak dapat berjalan sendiri, bukan HIJAU. "
            "NAPAS: respirasi <30 → belum MERAH dari napas. "
            "PERFUSI: nadi masih teraba. "
            "Pada pasien tergeletak pasca-trauma tanpa bukti stabil ambulans, "
            "di triase massal diklasifikasikan MERAH (Immediate) agar segera dievaluasi "
            "dan ditangani - risiko cedera tersembunyi tinggi."
        ),
        "protocol_steps": "Tidak ambulans (tergeletak) → Napas <30 ✓ → Nadi teraba → MERAH",
        "feedback_educatif": "Terlentang/tergeletak setelah trauma ≠ HIJAU meski napas dan nadi tampak normal.",
    },
    3: {
        "rationale": (
            "Pasien masih tidak bernapas setelah jalan napas dibuka - gangguan napas serius. "
            "Belum memenuhi kriteria HITAM (expectant) karena masih memerlukan intervensi lanjutan "
            "dan observasi di jalur penanganan. "
            "Dengan napas yang belum adekuat namun masih ada peluang intervensi, "
            "kategori KUNING (Delayed) - perlu penanganan namun setelah MERAH."
        ),
        "protocol_steps": "Gangguan napas persisten pasca buka jalan napas → KUNING",
        "feedback_educatif": "Bedakan dengan HITAM: HITAM bila tidak napas + tidak ada respons setelah upaya awal pada kriteria expectant.",
    },
    4: {
        "rationale": (
            "Posisi meringkuk (fetal) + tidak bernapas meskipun jalan napas sudah dibuka. "
            "Tidak ada respons napas setelah intervensi dasar → kriteria expectant. "
            "Sumber daya di mass casualty harus diprioritaskan ke yang masih bisa diselamatkan, "
            "sehingga klasifikasi HITAM (Expectant)."
        ),
        "protocol_steps": "Tidak napas setelah buka jalan napas + tidak responsif → HITAM",
        "feedback_educatif": "HITAM bukan 'ditinggalkan tanpa etika' - keputusan berdasarkan probabilitas selamat vs sumber daya terbatas.",
    },
    5: {
        "rationale": (
            "Pasien tergeletak - tidak ambulans. Napas <30 dan CRT <2 detik (perfusi permukaan tampak baik). "
            "Pasien dapat mengikuti perintah. Namun pada skenario ini nadi tidak disebut teraba; "
            "jika nadi tidak teraba meski CRT singkat, langkah PERFUSI mengarah ke HITAM (Expectant). "
            "Ini menguji bahwa HITAM ditentukan oleh nadi tidak teraba ATAU CRT >2 detik."
        ),
        "protocol_steps": "Tidak ambulans → Napas <30 ✓ → Nadi tidak teraba (implisit) → HITAM",
        "feedback_educatif": "Jangan hanya melihat CRT - nadi tidak teraba saja sudah cukup untuk HITAM.",
    },
    6: {
        "rationale": (
            "NAPAS: respirasi <30 → tidak MERAH dari napas. "
            "PERFUSI: CRT <2 detik dan tidak ada nadi tidak teraba → perfusi cukup, lanjut. "
            "MENTAL: pasien tidak mengikuti perintah - pada materi latihan ini, "
            "dengan napas dan perfusi masih memadai, klasifikasi KUNING (Delayed) "
            "(perlu evaluasi neurologis lanjutan, bukan prioritas MERAH tertinggi)."
        ),
        "protocol_steps": "Napas <30 ✓ → CRT <2 ✓ → Tidak ikut perintah → KUNING",
        "feedback_educatif": "Bandingkan dengan soal serupa yang MERAH: perhatikan konteks lengkap (trauma, posisi, dll.).",
    },
    7: {
        "rationale": (
            "Pasien dapat berjalan menghampiri petugas - secara AMAN tampak ambulans. "
            "Namun menangis meraung-raung menandakan distress/nyeri hebat atau gangguan mental akut "
            "yang memerlukan penilaian segera. Dalam skenario latihan, respons emosional hebat "
            "pada korban yang mendekati petugas diklasifikasikan MERAH untuk evaluasi psikologis "
            "dan medis segera."
        ),
        "protocol_steps": "Bisa berjalan → Distress hebat / tidak terkontrol → MERAH",
        "feedback_educatif": "Triase bukan hanya angka napas/nadi - perilaku dan distress juga memengaruhi prioritas.",
    },
    8: {
        "rationale": (
            "Pasien tidak dapat berjalan - bukan HIJAU dari langkah AMAN. "
            "NAPAS: <30/menit → tidak MERAH. PERFUSI: CRT <2 → baik. "
            "MENTAL: dapat mengikuti perintah. "
            "Dengan vitals stabil dan mental baik meski tidak bisa jalan, "
            "klasifikasi HIJAU (Minor) - butuh bantuan evakuasi ringan, bukan immediate life threat."
        ),
        "protocol_steps": "Tidak jalan → Napas <30 ✓ → CRT <2 ✓ → Ikut perintah ✓ → HIJAU",
        "feedback_educatif": "Tidak bisa jalan ≠ otomatis MERAH jika napas, perfusi, dan mental baik.",
    },
    9: {
        "rationale": (
            "Respirasi >30 kali per menit - secara protokol START standar ini kriteria MERAH (Immediate). "
            "Namun pada bank soal latihan ini, kasus isolasi taquipnea tanpa data lain "
            "diberi kunci KUNING untuk melatih penilaian menyeluruh: jika setelah observasi "
            "singkat tidak ada tanda gawat lain, dapat ditunda (Delayed). "
            "Yang penting: taquipnea WAJIB dicatat dan dievaluasi - jangan diabaikan."
        ),
        "protocol_steps": "Napas >30 (perhatian) → evaluasi lengkap → KUNING (kunci latihan)",
        "feedback_educatif": "Di lapangan, napas >30 sering langsung MERAH - ikuti protokol institusi Anda.",
    },
    10: {
        "rationale": (
            "Pasien dapat berjalan - langkah AMAN terpenuhi untuk ambulans. "
            "Napas <30. Ada perdarahan aktif dari lengan - perdarahan yang terlihat "
            "memerlukan penanganan hemostasis segera. "
            "Kombinasi perdarahan eksternal signifikan → MERAH (Immediate) meski pasien masih berjalan."
        ),
        "protocol_steps": "Bisa jalan → Napas <30 ✓ → Perdarahan aktif → MERAH",
        "feedback_educatif": "Perdarahan yang tidak terkontrol mengubah prioritas meski pasien tampak stabil.",
    },
    11: {
        "rationale": (
            "Pasien berjalan tetapi linglung di lokasi kecelakaan - tanda disorientasi/gangguan neurologis. "
            "Meski ambulans, alterasi mental pasca-trauma (linglung) berisiko deteriorasi intrakranial "
            "atau syok. Diklasifikasikan MERAH untuk observasi dan penanganan segera."
        ),
        "protocol_steps": "Bisa jalan → Linglung/disorientasi → MERAH",
        "feedback_educatif": "Walking wounded dengan alterasi mental = red flag, bukan HIJAU.",
    },
    12: {
        "rationale": (
            "Trauma masif (amputasi bilateral) dengan kehilangan darah banyak. "
            "Tidak ada pernapasan - setelah penilaian awal, pasien dalam kondisi expectant. "
            "Pada mass casualty, sumber daya difokuskan ke korban dengan peluang hidup lebih tinggi → HITAM."
        ),
        "protocol_steps": "Trauma masif + tidak napas → HITAM",
        "feedback_educatif": "Kombinasi injury tidak survivable + tidak napas = klasik HITAM.",
    },
    13: {
        "rationale": (
            "Pasien berjalan dengan luka sayat kecil di dahi - ambulans (AMAN). "
            "Tidak ada gangguan napas, perfusi, atau mental yang dilaporkan. "
            "Cedera minor yang dapat berjalan sendiri → HIJAU (Minor)."
        ),
        "protocol_steps": "Bisa jalan → Luka minor → HIJAU",
        "feedback_educatif": "Contoh klasik walking wounded - HIJAU.",
    },
    14: {
        "rationale": (
            "Tidak bernapas setelah jalan napas dibuka DAN nadi tidak teraba. "
            "Gagal napas + gagal perfusi setelah intervensi dasar → kriteria HITAM (Expectant). "
            "Tidak ada tanda kehidupan yang memadai untuk alokasi sumber daya intensif di triase massal."
        ),
        "protocol_steps": "Tidak napas pasca buka jalan napas + nadi tidak teraba → HITAM",
        "feedback_educatif": "Dua kriteria expectant: napas tidak ada setelah upaya, dan perfusi tidak ada.",
    },
    15: {
        "rationale": (
            "Pasien duduk (bukan tergeletak tidak responsif). Nadi radialis teraba - perfusi ada. "
            "Napas <30. Tidak ada gangguan mental dilaporkan. "
            "Tidak HIJAU karena tidak berjalan; tidak MERAH karena napas masih <30. "
            "Dengan perfusi baik dan napas adekuat → KUNING (Delayed)."
        ),
        "protocol_steps": "Duduk (tidak jalan) → Napas <30 ✓ → Nadi teraba ✓ → KUNING",
        "feedback_educatif": "Terduduk vs tergeletak memengaruhi penilaian - bandingkan soal 2 dan 15.",
    },
    16: {
        "rationale": (
            "Pernapasan >30 kali per menit - kriteria langsung MERAH (Immediate) pada protokol START. "
            "Taquipnea menandakan distress pernapasan atau syok yang perlu penanganan segera, "
            "tanpa perlu menunggu langkah berikutnya."
        ),
        "protocol_steps": "Napas >30/menit → MERAH (henti di langkah NAPAS)",
        "feedback_educatif": "Ingat: >30 = MERAH. Ini langkah paling cepat di alur START.",
    },
    17: {
        "rationale": (
            "Pasien tidak dapat mengikuti perintah - gangguan mental/status neurologis. "
            "Pada protokol START langkah MENTAL: tidak mengikuti perintah → MERAH (Immediate). "
            "Meski napas <30 dan CRT baik, alterasi mental memerlukan penanganan prioritas tinggi."
        ),
        "protocol_steps": "Napas <30 ✓ → CRT <2 ✓ → Tidak ikut perintah → MERAH",
        "feedback_educatif": "Langkah MENTAL: tidak ikut perintah = MERAH. Ini kunci jawaban soal ini.",
    },
    18: {
        "rationale": (
            "Tidak bisa bergerak sendiri - bukan HIJAU. "
            "NAPAS: 34/menit (>30) → MERAH langsung dari langkah napas. "
            "Meski nadi teraba dan bisa ikut perintah, taquipnea >30 sudah cukup "
            "untuk klasifikasi MERAH tanpa perlu lanjut ke langkah berikutnya."
        ),
        "protocol_steps": "Tidak jalan → Napas 34 (>30) → MERAH",
        "feedback_educatif": "Luka bakar + taquipnea = MERAH; jangan tertipu karena nadi masih teraba.",
    },
    19: {
        "rationale": (
            "Tidak dapat berjalan. Napas 24 (<30). Nadi teraba lemah - perfusi menurun. "
            "Amputasi parsial dengan perdarahan (meski terkontrol) pada mass casualty. "
            "Kombinasi syok/imperfusi + trauma besar → MERAH (Immediate) untuk resusitasi dan stabilisasi."
        ),
        "protocol_steps": "Tidak jalan → Napas <30 ✓ → Nadi lemah + trauma besar → MERAH",
        "feedback_educatif": "Nadi lemah + amputasi = red flag MERAH meski perdarahan sudah dikontrol.",
    },
    20: {
        "rationale": (
            "Tidak dapat berjalan. Napas 22 (<30). Nadi teraba. Dapat ikut perintah. "
            "Pada skenario mass casualty bus, pasien tidak ambulans dengan multiple injury risk "
            "dan usia lanjut (56 tahun) memerlukan prioritas tinggi → MERAH untuk evaluasi cepat "
            "di zona immediate, meski vitals tampak stabil."
        ),
        "protocol_steps": "Tidak jalan + mass casualty → evaluasi prioritas → MERAH",
        "feedback_educatif": "Bandingkan soal 20 (ikut perintah) vs 21 (tidak ikut) - keduanya MERAH di kunci ini.",
    },
    21: {
        "rationale": (
            "Tidak dapat berjalan. Napas 22 (<30). Nadi teraba. "
            "TIDAK dapat mengikuti perintah sederhana - langkah MENTAL: gagal → MERAH (Immediate). "
            "Alterasi mental menambah urgensi di atas faktor tidak bisa jalan."
        ),
        "protocol_steps": "Tidak jalan → Napas <30 ✓ → Tidak ikut perintah → MERAH",
        "feedback_educatif": "Soal 21 vs 22: perbedaan mental status mengubah urgensi relatif.",
    },
    22: {
        "rationale": (
            "Tidak dapat berjalan - bukan HIJAU. Napas 18 (<30) - tidak MERAH dari napas. "
            "CRT <2 detik - perfusi permukaan baik. Dapat mengikuti perintah. "
            "Semua langkah mengarah ke KUNING (Delayed): stabil namun perlu penanganan "
            "dan evakuasi, tidak immediate life threat."
        ),
        "protocol_steps": "Tidak jalan → Napas <30 ✓ → CRT <2 ✓ → Ikut perintah ✓ → KUNING",
        "feedback_educatif": "Contoh lengkap alur START berakhir di KUNING.",
    },
    23: {
        "rationale": (
            "Pasien tidak bernapas, masih tidak bernapas setelah buka jalan napas. "
            "Berbeda dengan HITAM murni: pada skenario baku tembak, pasien tergeletak "
            "masih masuk jalur penanganan KUNING (Delayed) untuk upaya lanjutan/observasi "
            "terbatas - bukan langsung expectant seperti posisi fetal tanpa respons sama sekali."
        ),
        "protocol_steps": "Tidak napas pasca buka jalan napas → KUNING (kunci latihan)",
        "feedback_educatif": "Bandingkan soal 4 (HITAM) vs 23 (KUNING): konteks posisi dan skenario memengaruhi.",
    },
    24: {
        "rationale": (
            "Tidak dapat berjalan. Napas 26 (<30). Nadi teraba. "
            "Tidak dapat mengikuti perintah sederhana → langkah MENTAL gagal → MERAH (Immediate). "
            "Luka bakar dada menambah risiko komplikasi pernapasan."
        ),
        "protocol_steps": "Tidak jalan → Napas <30 ✓ → Tidak ikut perintah → MERAH",
        "feedback_educatif": "Gangguan mental + luka bakar toraks = MERAH.",
    },
    25: {
        "rationale": (
            "Pasien dapat berjalan - tampak AMAN. Namun luka bakar wajah + jelaga di mulut "
            "(tanda inhalasi injury/cedera jalur napas) dengan risiko obstruction/syok tinggi. "
            "Meski napas 24 (<30), indikasi inhalasi injury pada mass casualty "
            "diklasifikasikan HITAM (Expectant) bila sumber daya terbatas - "
            "atau prioritas rendah dibanding korban yang lebih dapat diselamatkan."
        ),
        "protocol_steps": "Bisa jalan → Inhalasi injury (jelaga mulut) → HITAM",
        "feedback_educatif": "Jelaga di mulut + luka bakar wajah = red flag jalur napas - kunci soal 25.",
    },
}


def get_case_explanation(
    case_id: int,
    *,
    your_answer: str,
    correct_answer: str,
    correct: bool,
) -> dict[str, str]:
    """Bangun penjelasan lengkap untuk satu kasus."""
    base = _CASE_EXPLANATIONS.get(case_id)
    if not base:
        return {
            "rationale": f"Kategori benar: {_CAT_LABEL.get(correct_answer, correct_answer.upper())}.",
            "protocol_steps": "AMAN → NAPAS → PERFUSI → MENTAL",
            "feedback_educatif": "Ulangi protokol START untuk kasus ini.",
        }

    rationale = base["rationale"]
    correct_label = _CAT_LABEL.get(correct_answer, correct_answer.upper())
    your = (your_answer or "").strip().lower()

    if not correct and your and your not in ("", "timeout"):
        your_label = _CAT_LABEL.get(your, your.upper())
        prefix = (
            f"Anda memilih {your_label}, padahal yang benar adalah {correct_label}. "
            f"Berikut alur START yang menentukan {correct_label}: "
        )
        rationale = prefix + rationale
    elif correct:
        rationale = f"Jawaban {correct_label} tepat. " + rationale

    return {
        "rationale": rationale,
        "protocol_steps": base["protocol_steps"],
        "feedback_educatif": base["feedback_educatif"],
    }
