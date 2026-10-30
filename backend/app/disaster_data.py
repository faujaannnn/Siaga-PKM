"""Data statis modul Siaga Bencana Puskesmas (dapat diganti sumber DB nanti)."""

OVERVIEW = {
    "title": "Siaga Bencana Puskesmas",
    "subtitle": "Kesiapsiagaan kesehatan masyarakat dan Puskesmas menghadapi bencana.",
    "tagline": "Siap sebelum bencana, tanggap saat kejadian, pulih setelahnya.",
}
CHECKLIST = [
    {
        "id": "pra-bencana",
        "title": "Pra-bencana",
        "items": [
            "Pemetaan risiko wilayah kerja Puskesmas",
            "Daftar posko kesehatan dan jalur evakuasi",
            "Stok obat-PMI dan logistik kesehatan minimal",
            "Simulasi tanggap darurat tahunan",
            "Koordinasi dengan BPBD, PMI, dan rumah sakit rujukan",
        ],
    },
    {
        "id": "saat-bencana",
        "title": "Saat bencana",
        "items": [
            "Aktivasi posko kesehatan dan triase",
            "Surveilans cepat penyakit potensial wabah",
            "Layanan kesehatan reproduksi dan gizi darurat",
            "Komunikasi risiko ke masyarakat",
            "Pelaporan situasi ke dinas kesehatan",
        ],
    },
    {
        "id": "pasca-bencana",
        "title": "Pasca-bencana",
        "items": [
            "Pemulihan layanan kesehatan primer",
            "Pendampingan kesehatan jiwa",
            "Sanitasi air bersih dan kebersihan lingkungan",
            "Evaluasi dan pembelajaran bersama",
        ],
    },
]

HOTLINES = [
    {"name": "Ambulans / Gawat Darurat", "phone": "119", "note": "Nomor darurat medis nasional"},
    {"name": "BMKG", "phone": "(021) 4246321", "note": "Informasi cuaca & bencana alam"},
    {"name": "BPBD Provinsi/Kabupaten", "phone": "-", "note": "Sesuaikan nomor wilayah Anda"},
    {"name": "Puskesmas setempat", "phone": "-", "note": "Isi kontak Puskesmas Anda"},
]
