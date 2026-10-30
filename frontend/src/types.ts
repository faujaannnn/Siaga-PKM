export type HeroImageItem = {
  url: string
  caption?: string
}

export type HeroSection = {
  type: 'hero'
  id: string
  title: string
  subtitle?: string
  badge?: string
  highlight?: string
  images?: string[]
  heroImages?: HeroImageItem[]
}

export type TextSection = {
  type: 'text'
  id: string
  title?: string
  body?: string
}

export type CardItem = {
  title: string
  description?: string
  href?: string
}

export type CardsSection = {
  type: 'cards'
  id: string
  title?: string
  items?: CardItem[]
}

export type HomepageSection = HeroSection | TextSection | CardsSection

export type EducationKind = 'pdf' | 'video' | 'banner' | 'artikel' | 'gambar'

export type EducationAudience = 'public' | 'staff' | 'developer'

export type EducationCategory = 'video' | 'buku' | 'ppt' | 'peraturan' | 'sop' | 'artikel' | 'poster'

export type EducationSubcategoriesMap = Record<string, string[]>

export type EducationAttachment = {
  url: string
  name: string
}

export type EducationItem = {
  id: string
  kind: EducationKind
  title: string
  description: string
  url: string
  thumbnailUrl: string
  coverUrl: string
  body: string
  attachments: EducationAttachment[]
  category: EducationCategory
  subcategory: string
  sortOrder: number
}

export type EducationItemAdmin = {
  id: string
  kind: EducationKind
  title: string
  description: string
  url: string
  thumbnail_url: string
  cover_url: string
  body: string
  attachments: EducationAttachment[]
  audience: EducationAudience
  category: EducationCategory
  subcategory: string
  sort_order: number
  published: boolean
}

export type SitePagePublic = {
  slug: string
  title: string
  body: string
  nav_label: string
}

export type SitePageAdmin = {
  id: string
  slug: string
  title: string
  body: string
  nav_label: string
  sort_order: number
  published: boolean
}

/** Anggota tim di slider atas halaman /profil (admin & API publik). */
export type ProfileMemberRow = {
  photo_url: string
  name: string
  subtitle: string
}

export type SiteProfilePayload = {
  youtube_url: string
  members: ProfileMemberRow[]
  /** Galeri foto di halaman /profil (urutan = tampilan). */
  photos: ContactPhotoRow[]
}

/** Foto galeri di halaman Kontak kami (admin & API publik). */
export type ContactPhotoRow = {
  url: string
  caption: string
}

/** Lokasi tim untuk tombol Open Maps di halaman publik */
export type TeamLocationRow = {
  lat: number
  lng: number
  label: string
}

export type SiteContactPayload = {
  intro: string
  address: string
  phone: string
  email: string
  maps_url: string
  photos: ContactPhotoRow[]
  team_location: TeamLocationRow | null
}

export type PublicSubmissionRow = {
  id: string
  form_type: string
  created_at: string
  read: boolean
  preview: string
}

export type MlVideoCategory = 'asesmen_ai' | 'belajar_plus'

export type MlVideoPublic = {
  id: string
  title: string
  description: string
  youtube_id: string
  sort_order: number
  category: MlVideoCategory
  /** Slug topik bencana (Belajar++), mis. banjir, gempa_bumi */
  belajar_topic: string
}

export type MlVideoAdmin = {
  id: string
  title: string
  description: string
  youtube_url: string
  video_script: string
  explanation: string
  sort_order: number
  published: boolean
  category: MlVideoCategory
  belajar_topic: string
}

export type MlPdfChapterPublic = {
  title: string
  page_start: number
  page_end: number
}

export type MlPdfChapterAdmin = MlPdfChapterPublic & {
  content: string
  explanation: string
}

export type MlPdfPublic = {
  id: string
  title: string
  description: string
  drive_url: string
  sort_order: number
  category: MlVideoCategory
  belajar_topic: string
  chapters: MlPdfChapterPublic[]
}

export type MlPdfAdmin = {
  id: string
  title: string
  description: string
  drive_url: string
  sort_order: number
  published: boolean
  category: MlVideoCategory
  belajar_topic: string
  chapters: MlPdfChapterAdmin[]
}

export type MlPdfSessionLogRow = {
  id: string
  username: string
  pdf_id: string
  pdf_title: string
  created_at: string
  seconds_pdf: number
  knowledge_level: string
  report: string
  status: string
}

export type MlBelajarTopicItem = { slug: string; label: string }

export type MlSessionLogRow = {
  id: string
  username: string
  video_id: string
  video_title: string
  created_at: string
  seconds_watched: number
  knowledge_level: string
  report: string
  status: string
}

/** @deprecated API mengembalikan array kosong - hanya skor KA; tidak ada baris RD/SP/MS */
export type MlLipiParameter = {
  code: string
  short: string
  label: string
  assessed: boolean
  index_pct: number | null
  display: string
}

/** Soal + jawaban peserta untuk modul remedial setelah asesmen */
export type MlRemedialItem = {
  question_id: string
  question: string
  user_answer: string
}

/** Satu soal: skor, Bloom, transparansi (proxy LLM) */
export type MlGradingItem = {
  question_id: string
  p_correct: number | null
  correctness_score: number
  confidence_band: string
  bloom_level: number
  norm_score: number
  rationale: string
  feedback_educatif: string
  expected_answer_summary: string
  bloom_distribution: Record<string, number> | null
}

/** Ringkasan skor (server); UI publik kini menampilkan fokus ke tingkat pengetahuan + skor PG. */
export type MlAssessmentSummary = {
  indeks_ka_pct: number
  iks_bencana_pct: number
  /** Aproksimasi margin 95% untuk indeks (poin); 0 jika tidak tersedia / satu soal */
  iks_margin_95_pct?: number
  bloom_avg: number
  bloom_label: string
  readiness_label: string
  readiness_key: string
  recommendation: string
  lipi_lite: boolean
  disaster_slug: string
  disaster_label: string
  parameters?: MlLipiParameter[]
  per_answer?: MlGradingItem[]
  note: string
}

/** Asesmen video ML selesai - baris riwayat profil (role staff) */
export type MlStaffUnderstandingRow = {
  session_id: string
  video_id: string
  video_title: string
  category: MlVideoCategory
  knowledge_level: string
  report: string
  completed_at: string
  seconds_watched: number
  assessment: MlAssessmentSummary | null
  remedial_items: MlRemedialItem[]
  youtube_id: string
  source?: 'video' | 'pdf'
  drive_url?: string
}

/** Ringkasan kunjungan publik (GET /public/analytics/summary) */
export type PublicVisitStatsSummary = {
  total: number
  today: number
  this_month: number
  last_30_days: number
  daily_last_7: { date: string; count: number }[]
}

// ── SiAP-PKM: tipe baru ────────────────────────────────────────────────────────

export type PuskesmasOut = {
  id: string
  nama: string
  alamat: string
  kode: string
  has_kapus: boolean
  kapus_username: string | null
  staff_count: number
}

export type StaffOut = {
  username: string
  role: string
  display_name: string | null
  wa_phone: string | null
  puskesmas_id: string | null
  puskesmas_nama: string | null
}

export type PelatihanOut = {
  id: string
  judul: string
  deskripsi: string
  tanggal: string
  waktu_mulai: string
  waktu_selesai: string
  lokasi: string
  narasumber: string
  kapasitas: number
  created_at: string
  peserta_count: number
  flyer_url: string
}

export type AbsensiOut = {
  id: string
  pelatihan_id: string
  pelatihan_judul: string
  username: string
  display_name: string | null
  hadir: boolean
  waktu_absen: string | null
  via_qr: boolean
}

export type NotifikasiJenis = {
  id: string
  label: string
  deskripsi: string
  aktif: boolean
  jadwal_tipe: 'sekali' | 'harian' | 'mingguan' | 'tahunan' | 'instant'
  tanggal: string | null
  jam: string
  terakhir_kirim: string | null
  next_kirim: string | null
  countdown: string | null
  wa_enabled: boolean
}

export type NotifikasiSettings = {
  puskesmas_id: string
  notifikasi: NotifikasiJenis[]
}

export type StaffSkorOut = {
  username: string
  display_name: string | null
  lipi_skor: number | null
  lipi_label: string | null
  lipi_tanggal: string | null
  ml_video_count: number
  ml_pdf_count: number
  indeks_ka_pct: number | null
}

export type KapusDashboardOut = {
  puskesmas_id: string
  puskesmas_nama: string
  staff_count: number
  pelatihan_count: number
  staff_hadir_bulan_ini: number
  notif_pending: number
  staff_belum_pelatihan_1tahun: number
}

export type StaffBelumPelatihanOut = {
  username: string
  display_name: string | null
  wa_phone: string | null
  terakhir_hadir: string | null
  pernah_hadir: boolean
}

export type PelatihanStaffRekap = {
  pelatihan_id: string
  judul: string
  tanggal: string
  total_staff_puskesmas: number
  staff_terdaftar: number
  staff_hadir: number
}
