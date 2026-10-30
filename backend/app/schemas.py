from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginBody(BaseModel):
    username: str
    password: str


class WaStaffLoginStartIn(BaseModel):
    username: str
    phone: str


class WaStaffLoginStartOut(BaseModel):
    session_id: str
    message_text: str
    wa_me_url: str
    wa_me_ready: bool
    expires_at: str
    webhook_url: str
    expected_phone: str


class WaStaffLoginPollOut(BaseModel):
    status: Literal["pending", "ready", "error"]
    access_token: str | None = None
    detail: str | None = None


class MeResponse(BaseModel):
    username: str
    role: str
    can_manage_users: bool
    wa_phone: str | None = None
    wa_phone_linked_at: str | None = None
    display_name: str | None = None
    needs_profile_setup: bool = False
    research_wilayah: str | None = None
    puskesmas_id: str | None = None
    puskesmas_nama: str | None = None


class ProfileSetupBody(BaseModel):
    display_name: str = Field(min_length=2, max_length=120)


class ProfileSetupOut(BaseModel):
    display_name: str
    needs_profile_setup: bool = False


class ResearchSampleAccountOut(BaseModel):
    username: str
    password_plain: str
    wilayah: str
    display_name: str | None = None
    sort_order: int = 0


class WaStaffUnlinkOut(BaseModel):
    ok: bool = True
    wa_phone: str | None = None


class UserOut(BaseModel):
    username: str
    role: str


class StaffCreateBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)


class HomepageHeroSection(BaseModel):
    type: Literal["hero"] = "hero"
    id: str
    title: str
    subtitle: str = ""
    badge: str = ""
    highlight: str = ""
    images: list[str] = Field(default_factory=list)


class HomepageTextSection(BaseModel):
    type: Literal["text"] = "text"
    id: str
    title: str = ""
    body: str = ""


class HomepageCardItem(BaseModel):
    title: str
    description: str = ""
    href: str = ""


class HomepageCardsSection(BaseModel):
    type: Literal["cards"] = "cards"
    id: str
    title: str = ""
    items: list[HomepageCardItem] = Field(default_factory=list)


HomepageSection = HomepageHeroSection | HomepageTextSection | HomepageCardsSection


class HomepagePayload(BaseModel):
    sections: list[dict] = Field(default_factory=list)


class ProfileMemberEntry(BaseModel):
    photo_url: str = ""
    name: str = ""
    subtitle: str = ""


class ContactPhotoEntry(BaseModel):
    url: str = ""
    caption: str = ""


class ProfilePayload(BaseModel):
    youtube_url: str = ""
    members: list[ProfileMemberEntry] = Field(default_factory=list)
    photos: list[ContactPhotoEntry] = Field(default_factory=list)


class ContactTeamLocation(BaseModel):
    lat: float
    lng: float
    label: str = ""


class ContactPayload(BaseModel):
    intro: str = ""
    address: str = ""
    phone: str = ""
    email: str = ""
    maps_url: str = ""
    photos: list[ContactPhotoEntry] = Field(default_factory=list)
    team_location: ContactTeamLocation | None = None


EducationKind = Literal["pdf", "video", "banner", "artikel", "gambar"]
EducationAudience = Literal["public", "staff", "developer"]
EducationCategory = Literal[
    "video",
    "buku",
    "ppt",
    "peraturan",
    "sop",
    "artikel",
    "poster",
]


class Attachment(BaseModel):
    url: str
    name: str = ""


class EducationItemBase(BaseModel):
    kind: EducationKind
    title: str
    description: str = ""
    url: str = ""
    thumbnail_url: str = ""
    cover_url: str = ""
    body: str = ""
    attachments: list[Attachment] = Field(default_factory=list)
    audience: EducationAudience = "public"
    category: EducationCategory = "peraturan"
    subcategory: str = ""
    sort_order: int = 0
    published: bool = True


class EducationMetaPayload(BaseModel):
    """Subkategori per kategori utama (bacaan tambahan)."""

    subcategories: dict[str, list[str]] = Field(default_factory=dict)


def _kind_for_education_category(category: str) -> EducationKind:
    if category == "video":
        return "video"
    if category == "poster":
        return "banner"
    # Artikel penelitian: format PDF Drive (sama buku/peraturan).
    return "pdf"


class EducationItemCreate(EducationItemBase):
    @model_validator(mode="after")
    def validate_by_kind(self):
        # Kategori menentukan format: Video → YouTube; lainnya → buku PDF.
        expected = _kind_for_education_category(self.category)
        self.kind = expected
        if self.kind not in ("gambar", "artikel") and not (self.url or "").strip():
            raise ValueError("URL atau berkas wajib untuk jenis konten ini")
        if self.kind == "artikel" and not (self.body or "").strip():
            raise ValueError("Artikel teks wajib memiliki isi (body)")
        return self


class EducationItemUpdate(BaseModel):
    kind: EducationKind | None = None
    title: str | None = None
    description: str | None = None
    url: str | None = None
    thumbnail_url: str | None = None
    cover_url: str | None = None
    body: str | None = None
    attachments: list[Attachment] | None = None
    audience: EducationAudience | None = None
    category: EducationCategory | None = None
    subcategory: str | None = None
    sort_order: int | None = None
    published: bool | None = None


class EducationItemOut(BaseModel):
    id: str
    kind: EducationKind
    title: str
    description: str = ""
    url: str = ""
    thumbnail_url: str = ""
    cover_url: str = ""
    body: str = ""
    attachments: list[Attachment] = Field(default_factory=list)
    audience: EducationAudience = "public"
    category: EducationCategory = "peraturan"
    subcategory: str = ""
    sort_order: int = 0
    published: bool = True


class SitePagePublic(BaseModel):
    slug: str
    title: str
    body: str
    nav_label: str = ""


class SitePageAdmin(BaseModel):
    id: str
    slug: str
    title: str
    body: str
    nav_label: str = ""
    sort_order: int = 0
    published: bool = True


class SitePageCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    nav_label: str = ""
    sort_order: int = 0
    published: bool = True


class SitePageUpdate(BaseModel):
    slug: str | None = None
    title: str | None = None
    body: str | None = None
    nav_label: str | None = None
    sort_order: int | None = None
    published: bool | None = None


class PublicSubmissionIn(BaseModel):
    form_type: Literal["lapor_bencana", "saran_aduan", "kesiapsiagaan_keluarga"]
    nama: str = ""
    telepon: str = ""
    email: str = ""
    pesan: str = ""
    jenis_bencana: str = ""
    tanggal_kejadian: str = ""
    waktu_kejadian: str = ""
    lokasi: str = ""
    wilayah_daerah: str = ""
    lat: str = ""
    lng: str = ""
    jenis_masukkan: str = ""
    kk_data: dict[str, Any] = Field(default_factory=dict)
    foto_url: str = ""


class PublicSubmissionOut(BaseModel):
    id: str
    form_type: str
    created_at: str
    read: bool
    preview: str


class KesiapsiagaanMapPointOut(BaseModel):
    submission_id: str
    wilayah_daerah: str = ""
    head_name: str = ""
    location_label: str = ""
    question_key: Literal["alamat_rumah", "q2", "q3", "q6"]
    question_label: str = ""
    row_index: int | None = None
    institution_name: str | None = None
    lat: float
    lng: float
    created_at: str


class SubmissionReadPatch(BaseModel):
    read: bool = True


class UploadResponse(BaseModel):
    url: str
    name: str


# --- Video ML (YouTube) + asesmen ---

MlVideoCategory = Literal["asesmen_ai", "belajar_plus"]


class MlVideoCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    youtube_url: str = Field(min_length=4, max_length=500)
    video_script: str = ""
    explanation: str = ""
    sort_order: int = 0
    published: bool = True
    category: MlVideoCategory = "asesmen_ai"
    """Hanya Belajar++: slug topik, mis. banjir, gempa_bumi. Kosong = semua/umum."""
    belajar_topic: str = Field(default="", max_length=80)


class MlVideoUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    youtube_url: str | None = None
    video_script: str | None = None
    explanation: str | None = None
    sort_order: int | None = None
    published: bool | None = None
    category: MlVideoCategory | None = None
    belajar_topic: str | None = None


class MlVideoOut(BaseModel):
    id: str
    title: str
    description: str = ""
    youtube_url: str
    video_script: str = ""
    explanation: str = ""
    sort_order: int = 0
    published: bool = True
    category: MlVideoCategory = "asesmen_ai"
    belajar_topic: str = ""


class MlVideoPublicOut(BaseModel):
    id: str
    title: str
    description: str = ""
    youtube_id: str
    sort_order: int = 0
    category: MlVideoCategory = "asesmen_ai"
    belajar_topic: str = ""


class MlPdfChapterPublic(BaseModel):
    """Satu bab / segmen PDF: rentang halaman untuk konteks baca & ujian."""

    title: str
    page_start: int = Field(ge=1, le=99_999)
    page_end: int = Field(ge=1, le=99_999)

    @model_validator(mode="after")
    def _pages_ok(self):
        if self.page_end < self.page_start:
            raise ValueError("page_end harus >= page_start")
        return self


class MlPdfChapterAdmin(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    page_start: int = Field(ge=1, le=99_999)
    page_end: int = Field(ge=1, le=99_999)
    """Naskah / ringkasan isi bab (untuk asesmen AI), setara video_script."""
    content: str = ""
    explanation: str = ""

    @model_validator(mode="after")
    def _page_order(self):
        if self.page_end < self.page_start:
            raise ValueError("page_end harus >= page_start")
        return self


class MlPdfPublicOut(BaseModel):
    id: str
    title: str
    description: str = ""
    drive_url: str
    sort_order: int = 0
    category: MlVideoCategory = "asesmen_ai"
    belajar_topic: str = ""
    chapters: list[MlPdfChapterPublic] = Field(default_factory=list)


class MlPdfCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    drive_url: str = Field(min_length=8, max_length=800)
    sort_order: int = 0
    published: bool = True
    category: MlVideoCategory = "asesmen_ai"
    belajar_topic: str = Field(default="", max_length=80)
    chapters: list[MlPdfChapterAdmin] = Field(
        min_length=1,
        description="Minimal satu bab; rentang halaman diisi admin.",
    )


class MlPdfUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    drive_url: str | None = None
    sort_order: int | None = None
    published: bool | None = None
    category: MlVideoCategory | None = None
    belajar_topic: str | None = None
    chapters: list[MlPdfChapterAdmin] | None = None


class MlPdfOut(BaseModel):
    id: str
    title: str
    description: str = ""
    drive_url: str
    sort_order: int = 0
    published: bool = True
    category: MlVideoCategory = "asesmen_ai"
    belajar_topic: str = ""
    chapters: list[MlPdfChapterAdmin] = Field(default_factory=list)


class MlPdfSessionStartIn(BaseModel):
    pdf_id: str


class MlPdfSessionStartOut(BaseModel):
    id: str
    pdf: MlPdfPublicOut


class MlPdfEngagementPatchIn(BaseModel):
    seconds: float = Field(ge=0, le=12 * 3600)


class MlBelajarTopicItem(BaseModel):
    slug: str
    label: str


class MlBelajarTopicsOut(BaseModel):
    topics: list[MlBelajarTopicItem]


class MlBelajarExtraSlugsIn(BaseModel):
    extra_slugs: list[str] = Field(
        default_factory=list,
        max_length=32,
        description="Slug topik tambahan (huruf kecil, angka, _)",
    )


class MlBelajarTopicsAdminOut(BaseModel):
    topics: list[MlBelajarTopicItem]
    extra_slugs: list[str]


class MlSessionStartIn(BaseModel):
    video_id: str


class MlSessionStartOut(BaseModel):
    id: str
    video: MlVideoPublicOut
    message: str = ""


class MlWatchPatchIn(BaseModel):
    seconds: float = Field(ge=0, le=12 * 3600)
    duration_seconds: float | None = Field(
        default=None,
        ge=30,
        le=12 * 3600,
        description="Durasi total video dari pemutar (YouTube iframe); menyetel kontrol pembukaan asesmen.",
    )
class MlQuestionOut(BaseModel):
    id: str
    question: str
    choices: list[str] = Field(
        default_factory=list,
        description="Pilihan ganda (4 opsi); kosong untuk format asesmen lama.",
    )


class MlRemedialItemOut(BaseModel):
    """Teks soal + jawaban peserta untuk modul remedial setelah asesmen selesai."""

    question_id: str = ""
    question: str = ""
    user_answer: str = ""


class MlLipiParameterOut(BaseModel):
    """Satu parameter LIPI (KA / RD / SP / MS) untuk tampilan profil."""

    code: str
    short: str
    label: str
    assessed: bool
    index_pct: float | None = None
    display: str


class MlGradingItemOut(BaseModel):
    """Satu soal: skor, Bloom, pita kepercayaan, transparansi (proxy LLM / kalibrasi nanti)."""

    question_id: str = ""
    p_correct: float | None = None
    correctness_score: float = 0.0
    confidence_band: str = ""
    bloom_level: float = 0.0
    norm_score: float = 0.0
    rationale: str = ""
    feedback_educatif: str = ""
    expected_answer_summary: str = ""
    bloom_distribution: dict[str, float] | None = None


class MlAssessmentSummaryOut(BaseModel):
    """Ringkasan LIPI-lite: kebenaran × Bloom → IKS & rata-rata Bloom."""

    indeks_ka_pct: float = 0.0
    iks_bencana_pct: float = 0.0
    iks_margin_95_pct: float = 0.0
    bloom_avg: float = 0.0
    bloom_label: str = ""
    readiness_label: str = ""
    readiness_key: str = ""
    recommendation: str = ""
    lipi_lite: bool = True
    disaster_slug: str = ""
    disaster_label: str = ""
    parameters: list[MlLipiParameterOut] = Field(default_factory=list)
    per_answer: list[MlGradingItemOut] = Field(default_factory=list)
    note: str = ""


class MlMcqQuestionPublic(BaseModel):
    id: str
    question: str
    choices: list[str]
    chapter_index: int = 0


class MlMcqAnswerIn(BaseModel):
    question_id: str
    choice_index: int = Field(ge=0, le=3)


class MlPdfQuizChapterStartIn(BaseModel):
    chapter_index: int = Field(ge=0, le=500)


class MlPdfQuizStepOut(BaseModel):
    question: MlMcqQuestionPublic | None = None
    done: bool
    current_step: int
    total_steps: int
    chapter_quiz_done: bool = False
    next_chapter_index: int | None = None
    report: str = ""
    knowledge_level: str = ""
    seconds_pdf: float = 0
    assessment: MlAssessmentSummaryOut | None = None
    remedial_items: list[MlRemedialItemOut] = Field(default_factory=list)


class MlQuizStepOut(BaseModel):
    question: MlQuestionOut | None = None
    done: bool
    current_step: int
    total_steps: int
    report: str = ""
    knowledge_level: str = ""
    seconds_watched: float = 0
    assessment: MlAssessmentSummaryOut | None = None
    remedial_items: list[MlRemedialItemOut] = Field(default_factory=list)


class MlQuizCompletionOut(BaseModel):
    """Remedial + konteks soal yang tersimpan setelah sesi selesai (untuk hydrate UI)."""

    remedial_items: list[MlRemedialItemOut] = Field(default_factory=list)


class MlAnswerIn(BaseModel):
    question_id: str
    text: str = ""
    choice_index: int | None = Field(default=None, ge=0, le=3)


class MlSubmitIn(BaseModel):
    answers: list[MlAnswerIn] = Field(default_factory=list)


class MlReportOut(BaseModel):
    report: str
    knowledge_level: str
    seconds_watched: float


class MlSessionLogRow(BaseModel):
    id: str
    username: str
    video_id: str
    video_title: str
    created_at: str
    seconds_watched: float
    knowledge_level: str = ""
    report: str = ""
    status: str


class MlStaffUnderstandingOut(BaseModel):
    """Satu baris asesmen video ML selesai, untuk tab Profil masyarakat."""

    session_id: str
    video_id: str
    video_title: str
    category: MlVideoCategory
    knowledge_level: str
    report: str
    completed_at: str
    seconds_watched: float
    assessment: MlAssessmentSummaryOut | None = None
    remedial_items: list[MlRemedialItemOut] = Field(default_factory=list)
    youtube_id: str = ""
    source: Literal["video", "pdf"] = "video"
    drive_url: str = ""


class MlPdfSessionLogRow(BaseModel):
    id: str
    username: str
    pdf_id: str
    pdf_title: str
    created_at: str
    seconds_pdf: float
    knowledge_level: str = ""
    report: str = ""
    status: str


# ── SiAP-PKM: Puskesmas, Kepala, Pelatihan, Notifikasi ────────────────────────

class PuskesmasOut(BaseModel):
    id: str
    nama: str
    alamat: str = ""
    kode: str = ""
    has_kapus: bool = False
    kapus_username: str | None = None
    staff_count: int = 0


class PuskesmasCreate(BaseModel):
    nama: str = Field(min_length=2, max_length=120)
    alamat: str = ""
    kode: str = ""


class PuskesmasUpdate(BaseModel):
    nama: str | None = Field(default=None, min_length=2, max_length=120)
    alamat: str | None = None
    kode: str | None = None


class KapusCreateBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    puskesmas_id: str
    display_name: str = ""


class StaffCreateByAdminBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    puskesmas_id: str
    display_name: str = ""
    wa_phone: str = ""


class StaffCreateByKapusBody(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=6, max_length=128)
    display_name: str = ""
    wa_phone: str = ""


class StaffOut(BaseModel):
    username: str
    role: str
    display_name: str | None = None
    wa_phone: str | None = None
    puskesmas_id: str | None = None
    puskesmas_nama: str | None = None


class StaffUpdateBody(BaseModel):
    display_name: str | None = None
    wa_phone: str | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    puskesmas_id: str | None = None


class PelatihanOut(BaseModel):
    id: str
    judul: str
    deskripsi: str = ""
    tanggal: str
    waktu_mulai: str = ""
    waktu_selesai: str = ""
    lokasi: str = ""
    narasumber: str = ""
    kapasitas: int = 0
    created_at: str = ""
    peserta_count: int = 0
    flyer_url: str = ""


class PelatihanCreate(BaseModel):
    judul: str = Field(min_length=2, max_length=200)
    deskripsi: str = ""
    tanggal: str
    waktu_mulai: str = ""
    waktu_selesai: str = ""
    lokasi: str = ""
    narasumber: str = ""
    kapasitas: int = 0
    flyer_url: str = ""


class PelatihanUpdate(BaseModel):
    judul: str | None = Field(default=None, min_length=2, max_length=200)
    deskripsi: str | None = None
    tanggal: str | None = None
    waktu_mulai: str | None = None
    waktu_selesai: str | None = None
    lokasi: str | None = None
    narasumber: str | None = None
    kapasitas: int | None = None
    flyer_url: str | None = None


class AbsensiOut(BaseModel):
    id: str
    pelatihan_id: str
    pelatihan_judul: str = ""
    username: str
    display_name: str | None = None
    hadir: bool = False
    waktu_absen: str | None = None
    via_qr: bool = False


class AbsensiUpsert(BaseModel):
    username: str
    hadir: bool


class QRScanIn(BaseModel):
    pelatihan_id: str
    token: str


class PesertaToggleIn(BaseModel):
    username: str
    terdaftar: bool


class NotifikasiJenis(BaseModel):
    id: str
    label: str
    deskripsi: str = ""
    aktif: bool = True
    jadwal_tipe: Literal["sekali", "harian", "mingguan", "tahunan", "instant"] = "sekali"
    tanggal: str | None = None
    jam: str = "08:00"
    terakhir_kirim: str | None = None
    next_kirim: str | None = None
    countdown: str | None = None
    wa_enabled: bool = True


class NotifikasiSettings(BaseModel):
    puskesmas_id: str
    notifikasi: list[NotifikasiJenis] = Field(default_factory=list)


class NotifikasiUpdate(BaseModel):
    notifikasi: list[NotifikasiJenis]


class StaffSkorOut(BaseModel):
    username: str
    display_name: str | None = None
    lipi_skor: float | None = None
    lipi_label: str | None = None
    lipi_tanggal: str | None = None
    ml_video_count: int = 0
    ml_pdf_count: int = 0
    indeks_ka_pct: float | None = None


class StaffBelumPelatihanOut(BaseModel):
    username: str
    display_name: str | None = None
    wa_phone: str | None = None
    terakhir_hadir: str | None = None
    pernah_hadir: bool = False


class KapusDashboardOut(BaseModel):
    puskesmas_id: str
    puskesmas_nama: str
    staff_count: int = 0
    pelatihan_count: int = 0
    staff_hadir_bulan_ini: int = 0
    notif_pending: int = 0
    staff_belum_pelatihan_1tahun: int = 0
