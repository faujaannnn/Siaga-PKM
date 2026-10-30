import axios from 'axios'

import type {
  EducationItem,
  EducationItemAdmin,
  HomepageSection,
  MlAssessmentSummary,
  MlBelajarTopicItem,
  MlGradingItem,
  MlRemedialItem,
  MlSessionLogRow,
  MlStaffUnderstandingRow,
  MlVideoAdmin,
  MlVideoCategory,
  MlVideoPublic,
  MlPdfAdmin,
  MlPdfPublic,
  MlPdfSessionLogRow,
  PublicSubmissionRow,
  PublicVisitStatsSummary,
  SitePageAdmin,
  SitePagePublic,
  SiteProfilePayload,
  SiteContactPayload,
  ProfileMemberRow,
} from '../types'
import type { KesiapsiagaanMapPoint, KkDataPayload } from '@dr-diah/siaga-frontend-core'

function numField(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    if (!Number.isNaN(n)) return n
  }
  return fallback
}

function strField(v: unknown): string {
  return v == null ? '' : String(v)
}

function normBloomDist(v: unknown): Record<string, number> | null {
  if (!v || typeof v !== 'object') return null
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    const n = numField(val, NaN)
    if (!Number.isNaN(n)) out[k] = n
  }
  return Object.keys(out).length ? out : null
}

/** Satu item penilaian - dukung camelCase dari proxy / serialisasi. */
export function normalizeMlGradingItem(raw: unknown): MlGradingItem | null {
  if (!raw || typeof raw !== 'object') return null
  const g = raw as Record<string, unknown>
  const question_id = strField(g.question_id ?? g.questionId).trim()
  if (!question_id) return null
  const pRaw = g.p_correct ?? g.pCorrect
  let p_correct: number | null = null
  if (pRaw != null && pRaw !== '') {
    const n = numField(pRaw, NaN)
    p_correct = Number.isNaN(n) ? null : n
  }
  return {
    question_id,
    p_correct,
    correctness_score: numField(g.correctness_score ?? g.correctnessScore),
    confidence_band: strField(g.confidence_band ?? g.confidenceBand),
    bloom_level: numField(g.bloom_level ?? g.bloomLevel),
    norm_score: numField(g.norm_score ?? g.normScore),
    rationale: strField(g.rationale),
    feedback_educatif: strField(g.feedback_educatif ?? g.feedbackEducatif),
    expected_answer_summary: strField(g.expected_answer_summary ?? g.expectedAnswerSummary),
    bloom_distribution: normBloomDist(g.bloom_distribution ?? g.bloomDistribution),
  }
}

/** Ringkasan asesmen - map perAnswer → per_answer dan field snake/camel. */
export function normalizeMlAssessment(raw: unknown): MlAssessmentSummary | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const perRaw = o.per_answer ?? o.perAnswer
  let per_answer: MlGradingItem[] | undefined
  if (Array.isArray(perRaw)) {
    per_answer = perRaw.map(normalizeMlGradingItem).filter((x): x is MlGradingItem => x != null)
  }
  return {
    indeks_ka_pct: numField(o.indeks_ka_pct ?? o.indeksKaPct),
    iks_bencana_pct: numField(o.iks_bencana_pct ?? o.iksBencanaPct),
    iks_margin_95_pct: numField(o.iks_margin_95_pct ?? o.iksMargin95Pct, 0),
    bloom_avg: numField(o.bloom_avg ?? o.bloomAvg),
    bloom_label: strField(o.bloom_label ?? o.bloomLabel),
    readiness_label: strField(o.readiness_label ?? o.readinessLabel),
    readiness_key: strField(o.readiness_key ?? o.readinessKey),
    recommendation: strField(o.recommendation),
    lipi_lite: Boolean(o.lipi_lite ?? o.lipiLite ?? true),
    disaster_slug: strField(o.disaster_slug ?? o.disasterSlug),
    disaster_label: strField(o.disaster_label ?? o.disasterLabel),
    note: strField(o.note),
    parameters: (o.parameters as MlAssessmentSummary['parameters']) ?? undefined,
    per_answer,
  }
}

export const TOKEN_KEY = 'sbp_token'

/** Jangan set Content-Type default ke application/json: axios akan mengubah FormData jadi JSON. */
export const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const t = localStorage.getItem(TOKEN_KEY)
  if (t) {
    config.headers.Authorization = `Bearer ${t}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const status = err.response?.status as number | undefined
    const url = String(err.config?.url ?? '')
    if (
      status === 401 &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/wa-staff/poll') &&
      !url.includes('/auth/wa-staff/start')
    ) {
      localStorage.removeItem(TOKEN_KEY)
      window.dispatchEvent(new CustomEvent('sbp:auth-lost'))
    }
    return Promise.reject(err)
  },
)

export async function fetchPublicHomepage(): Promise<{ sections: HomepageSection[] }> {
  const { data } = await api.get<{ sections: HomepageSection[] }>('/public/homepage')
  return data
}

export async function fetchPublicEducation(filters?: {
  category?: string | null
  subcategory?: string | null
  kind?: string | null
}): Promise<EducationItem[]> {
  const params: Record<string, string> = {}
  if (filters?.category) params.category = filters.category
  if (filters?.subcategory) params.subcategory = filters.subcategory
  if (filters?.kind) params.kind = filters.kind
  const { data } = await api.get<EducationItem[]>('/public/education', {
    params: Object.keys(params).length ? params : undefined,
  })
  return data.map((row) => ({
    ...row,
    category: row.category ?? 'umum',
    subcategory: row.subcategory ?? '',
  }))
}

export async function fetchPublicEducationMeta(): Promise<{ subcategories: Record<string, string[]> }> {
  const { data } = await api.get<{ subcategories: Record<string, string[]> }>('/public/education-meta')
  return { subcategories: data.subcategories ?? {} }
}

export async function fetchPublicPages(): Promise<SitePagePublic[]> {
  const { data } = await api.get<SitePagePublic[]>('/public/pages')
  return data
}

export async function fetchPublicProfile(): Promise<SiteProfilePayload> {
  const { data } = await api.get<SiteProfilePayload>('/public/profile')
  const photos = Array.isArray(data.photos)
    ? data.photos.map((p) => ({
        url: (p.url ?? '').trim(),
        caption: (p.caption ?? '').trim(),
      }))
    : []
  return {
    youtube_url: data.youtube_url ?? '',
    members: Array.isArray(data.members) ? data.members : [],
    photos,
  }
}

export async function fetchPublicContact(): Promise<SiteContactPayload> {
  const { data } = await api.get<SiteContactPayload>('/public/contact')
  const photos = Array.isArray(data.photos)
    ? data.photos.map((p) => ({
        url: (p.url ?? '').trim(),
        caption: (p.caption ?? '').trim(),
      }))
    : []
  const teamLoc = data.team_location
  return {
    intro: data.intro ?? '',
    address: data.address ?? '',
    phone: data.phone ?? '',
    email: data.email ?? '',
    maps_url: data.maps_url ?? '',
    photos,
    team_location: teamLoc && typeof teamLoc === 'object' && teamLoc.lat != null && teamLoc.lng != null
      ? { lat: teamLoc.lat, lng: teamLoc.lng, label: (teamLoc.label ?? '').trim() || 'Lokasi tim' }
      : null,
  }
}

export async function fetchPublicPage(slug: string): Promise<SitePagePublic> {
  const { data } = await api.get<SitePagePublic>(`/public/pages/${encodeURIComponent(slug)}`)
  return data
}

export async function postPublicSubmission(body: {
  form_type: 'lapor_bencana' | 'saran_aduan' | 'kesiapsiagaan_keluarga'
  nama?: string
  telepon?: string
  email?: string
  pesan?: string
  jenis_bencana?: string
  tanggal_kejadian?: string
  waktu_kejadian?: string
  lokasi?: string
  wilayah_daerah?: string
  lat?: string
  lng?: string
  jenis_masukkan?: string
  kk_data?: KkDataPayload
  foto_url?: string
}): Promise<void> {
  await api.post('/public/submissions', body)
}

export async function postPublicVisitPing(): Promise<void> {
  await api.post('/public/analytics/visit')
}

export async function fetchPublicVisitStats(): Promise<PublicVisitStatsSummary> {
  const { data } = await api.get<PublicVisitStatsSummary>('/public/analytics/summary')
  return data
}

export async function fetchStaffEducation(): Promise<EducationItem[]> {
  const { data } = await api.get<EducationItem[]>('/staff/education')
  return data.map((row) => ({
    ...row,
    category: row.category ?? 'umum',
  }))
}

export async function fetchStaffMlUnderstanding(): Promise<MlStaffUnderstandingRow[]> {
  const { data } = await api.get<MlStaffUnderstandingRow[]>('/staff/ml-understanding')
  return data.map((row) => ({
    ...row,
    remedial_items: row.remedial_items ?? [],
    youtube_id: row.youtube_id ?? '',
    assessment: row.assessment ? normalizeMlAssessment(row.assessment) : null,
  }))
}

export async function fetchDeveloperEducation(): Promise<EducationItem[]> {
  const { data } = await api.get<EducationItem[]>('/developer/education')
  return data.map((row) => ({
    ...row,
    category: row.category ?? 'umum',
  }))
}

export async function login(username: string, password: string): Promise<string> {
  const { data } = await api.post<{ access_token: string }>('/auth/login', { username, password })
  return data.access_token
}

export type WaStaffLoginStart = {
  session_id: string
  message_text: string
  wa_me_url: string
  wa_me_ready: boolean
  expires_at: string
  webhook_url: string
  expected_phone: string
}

export async function startWaStaffLogin(username: string, phone: string): Promise<WaStaffLoginStart> {
  const { data } = await api.post<WaStaffLoginStart>('/auth/wa-staff/start', { username, phone })
  return data
}

export type WaStaffPoll = {
  status: 'pending' | 'ready' | 'error'
  access_token?: string | null
  detail?: string | null
}

export async function pollWaStaffLogin(sessionId: string): Promise<WaStaffPoll> {
  const { data } = await api.get<WaStaffPoll>('/auth/wa-staff/poll', {
    params: { session_id: sessionId },
  })
  return data
}

export async function unlinkWaStaffPhone(): Promise<{ ok: boolean; wa_phone: string | null }> {
  const { data } = await api.post<{ ok: boolean; wa_phone: string | null }>('/auth/wa-staff/unlink')
  return data
}

export type AuthMe = {
  username: string
  role: string
  can_manage_users: boolean
  wa_phone?: string | null
  wa_phone_linked_at?: string | null
  display_name?: string | null
  needs_profile_setup?: boolean
  research_wilayah?: string | null
  puskesmas_id?: string | null
  puskesmas_nama?: string | null
}

export async function fetchAuthMe(): Promise<AuthMe> {
  const { data } = await api.get<AuthMe>('/auth/me')
  return data
}

export async function setupStaffProfile(displayName: string): Promise<{ display_name: string }> {
  const { data } = await api.post<{ display_name: string }>('/auth/profile-setup', {
    display_name: displayName,
  })
  return data
}

export type ResearchSampleAccountRow = {
  username: string
  password_plain: string
  wilayah: string
  display_name?: string | null
  sort_order: number
}

export async function fetchResearchSampleAccounts(): Promise<ResearchSampleAccountRow[]> {
  const { data } = await api.get<ResearchSampleAccountRow[]>('/admin/research-sample-accounts')
  return data
}

export type AdminUserRow = { username: string; role: string }

export async function fetchAdminUsers(): Promise<AdminUserRow[]> {
  const { data } = await api.get<AdminUserRow[]>('/admin/users')
  return data
}

export async function createStaffUser(body: {
  username: string
  password: string
}): Promise<AdminUserRow> {
  const { data } = await api.post<AdminUserRow>('/admin/users', body)
  return data
}

export async function deleteStaffUser(username: string): Promise<void> {
  await api.delete(`/admin/users/${encodeURIComponent(username)}`)
}

export async function fetchAdminHomepage(): Promise<{ sections: HomepageSection[] }> {
  const { data } = await api.get<{ sections: HomepageSection[] }>('/admin/homepage')
  return data
}

export async function saveAdminHomepage(sections: HomepageSection[]): Promise<void> {
  await api.put('/admin/homepage', { sections })
}

export async function fetchAdminProfile(): Promise<SiteProfilePayload> {
  const { data } = await api.get<SiteProfilePayload>('/admin/profile')
  const photos = Array.isArray(data.photos)
    ? data.photos.map((p) => ({
        url: (p.url ?? '').trim(),
        caption: (p.caption ?? '').trim(),
      }))
    : []
  return {
    youtube_url: data.youtube_url ?? '',
    members: Array.isArray(data.members) ? data.members : [],
    photos,
  }
}

export async function saveAdminProfile(payload: SiteProfilePayload): Promise<void> {
  const members: ProfileMemberRow[] = (payload.members ?? []).map((m) => ({
    photo_url: (m.photo_url ?? '').trim(),
    name: (m.name ?? '').trim(),
    subtitle: (m.subtitle ?? '').trim(),
  }))
  const photos = (payload.photos ?? [])
    .map((p) => ({
      url: (p.url ?? '').trim(),
      caption: (p.caption ?? '').trim(),
    }))
    .filter((p) => p.url)
  await api.put('/admin/profile', {
    youtube_url: (payload.youtube_url ?? '').trim(),
    members,
    photos,
  })
}

export async function fetchAdminContact(): Promise<SiteContactPayload> {
  const { data } = await api.get<SiteContactPayload>('/admin/contact')
  const photos = Array.isArray(data.photos)
    ? data.photos.map((p) => ({
        url: (p.url ?? '').trim(),
        caption: (p.caption ?? '').trim(),
      }))
    : []
  const teamLoc = data.team_location
  return {
    intro: data.intro ?? '',
    address: data.address ?? '',
    phone: data.phone ?? '',
    email: data.email ?? '',
    maps_url: data.maps_url ?? '',
    photos,
    team_location: teamLoc && typeof teamLoc === 'object' && 'lat' in teamLoc && 'lng' in teamLoc
      ? { lat: teamLoc.lat as number, lng: teamLoc.lng as number, label: String(teamLoc.label ?? '').trim() }
      : null,
  }
}

export async function saveAdminContact(payload: SiteContactPayload): Promise<void> {
  const photos = (payload.photos ?? [])
    .map((p) => ({
      url: (p.url ?? '').trim(),
      caption: (p.caption ?? '').trim(),
    }))
    .filter((p) => p.url)
  await api.put('/admin/contact', {
    intro: (payload.intro ?? '').trim(),
    address: (payload.address ?? '').trim(),
    phone: (payload.phone ?? '').trim(),
    email: (payload.email ?? '').trim(),
    maps_url: (payload.maps_url ?? '').trim(),
    photos,
    team_location: payload.team_location,
  })
}

export async function fetchAdminEducation(): Promise<EducationItemAdmin[]> {
  const { data } = await api.get<EducationItemAdmin[]>('/admin/education')
  return data.map((row) => ({ ...row, subcategory: row.subcategory ?? '' }))
}

export async function fetchAdminEducationMeta(): Promise<{ subcategories: Record<string, string[]> }> {
  const { data } = await api.get<{ subcategories: Record<string, string[]> }>('/admin/education-meta')
  return { subcategories: data.subcategories ?? {} }
}

export async function saveAdminEducationMeta(body: {
  subcategories: Record<string, string[]>
}): Promise<{ subcategories: Record<string, string[]> }> {
  const { data } = await api.put<{ subcategories: Record<string, string[]> }>('/admin/education-meta', body)
  return { subcategories: data.subcategories ?? {} }
}

export async function uploadAdminFile(file: File): Promise<{ url: string; name: string }> {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post<{ url: string; name: string }>('/admin/upload', fd)
  return data
}

export async function createEducationItem(body: {
  kind: EducationItem['kind']
  title: string
  description?: string
  url?: string
  thumbnail_url?: string
  cover_url?: string
  body?: string
  attachments?: { url: string; name: string }[]
  audience?: EducationItemAdmin['audience']
  category?: EducationItemAdmin['category']
  subcategory?: string
  sort_order?: number
  published?: boolean
}): Promise<EducationItemAdmin> {
  const { data } = await api.post<EducationItemAdmin>('/admin/education', body)
  return data
}

export async function updateEducationItem(
  id: string,
  patch: Partial<{
    kind: EducationItem['kind']
    title: string
    description: string
    url: string
    thumbnail_url: string
    cover_url: string
    body: string
    attachments: { url: string; name: string }[]
    audience: EducationItemAdmin['audience']
    category: EducationItemAdmin['category']
    subcategory: string
    sort_order: number
    published: boolean
  }>,
): Promise<EducationItemAdmin> {
  const { data } = await api.put<EducationItemAdmin>(`/admin/education/${id}`, patch)
  return data
}

export async function deleteEducationItem(id: string): Promise<void> {
  await api.delete(`/admin/education/${id}`)
}

export async function fetchAdminPages(): Promise<SitePageAdmin[]> {
  const { data } = await api.get<SitePageAdmin[]>('/admin/pages')
  return data
}

export async function createAdminPage(body: {
  slug: string
  title: string
  body?: string
  nav_label?: string
  sort_order?: number
  published?: boolean
}): Promise<SitePageAdmin> {
  const { data } = await api.post<SitePageAdmin>('/admin/pages', body)
  return data
}

export async function updateAdminPage(
  id: string,
  patch: Partial<{
    slug: string
    title: string
    body: string
    nav_label: string
    sort_order: number
    published: boolean
  }>,
): Promise<SitePageAdmin> {
  const { data } = await api.put<SitePageAdmin>(`/admin/pages/${id}`, patch)
  return data
}

export async function deleteAdminPage(id: string): Promise<void> {
  await api.delete(`/admin/pages/${id}`)
}

export async function fetchAdminSubmissions(): Promise<PublicSubmissionRow[]> {
  const { data } = await api.get<PublicSubmissionRow[]>('/admin/submissions')
  return data
}

export async function fetchAdminSubmissionDetail(id: string): Promise<Record<string, unknown>> {
  const { data } = await api.get<Record<string, unknown>>(`/admin/submissions/${id}`)
  return data
}

export async function fetchAdminKesiapsiagaanMapPoints(): Promise<KesiapsiagaanMapPoint[]> {
  const { data } = await api.get<KesiapsiagaanMapPoint[]>(
    '/admin/submissions/kesiapsiagaan-keluarga/map-points',
  )
  return data
}

export async function patchSubmissionRead(id: string, read: boolean): Promise<PublicSubmissionRow> {
  const { data } = await api.patch<PublicSubmissionRow>(`/admin/submissions/${id}`, { read })
  return data
}

export async function fetchPublicMlBelajarTopics(): Promise<{ topics: MlBelajarTopicItem[] }> {
  const { data } = await api.get<{ topics: MlBelajarTopicItem[] }>('/public/ml-belajar-topics')
  return data
}

export type MlBelajarTopicsAdmin = { topics: MlBelajarTopicItem[]; extra_slugs: string[] }

export async function fetchAdminMlBelajarTopics(): Promise<MlBelajarTopicsAdmin> {
  const { data } = await api.get<MlBelajarTopicsAdmin>('/admin/ml-belajar-topics')
  return data
}

export async function putAdminMlBelajarExtraSlugs(extra_slugs: string[]): Promise<MlBelajarTopicsAdmin> {
  const { data } = await api.put<MlBelajarTopicsAdmin>('/admin/ml-belajar-topics', { extra_slugs })
  return data
}

export async function fetchPublicMlVideos(
  opts?: { category?: MlVideoCategory | null; topik?: string | null },
): Promise<MlVideoPublic[]> {
  const { category, topik } = opts ?? {}
  const params: Record<string, string> = {}
  if (category) params.category = category
  if (topik) params.topik = topik
  const { data } = await api.get<MlVideoPublic[]>('/public/ml-videos', {
    params: Object.keys(params).length ? params : undefined,
  })
  return data.map((x) => ({
    ...x,
    category: x.category ?? 'asesmen_ai',
    belajar_topic: x.belajar_topic ?? '',
  }))
}

export async function startMlSession(videoId: string): Promise<{ id: string; video: MlVideoPublic }> {
  const { data } = await api.post<{ id: string; video: MlVideoPublic }>('/public/ml-sessions', { video_id: videoId })
  return data
}

export async function patchMlWatch(
  sessionId: string,
  seconds: number,
  durationSeconds?: number,
): Promise<void> {
  const body: { seconds: number; duration_seconds?: number } = { seconds }
  if (typeof durationSeconds === 'number' && durationSeconds > 0) {
    body.duration_seconds = durationSeconds
  }
  await api.patch(`/public/ml-sessions/${encodeURIComponent(sessionId)}/watch`, body)
}

export type MlQuizStepResponse = {
  question: { id: string; question: string; choices?: string[] } | null
  done: boolean
  current_step: number
  total_steps: number
  report: string
  knowledge_level: string
  seconds_watched: number
  assessment: MlAssessmentSummary | null
  remedial_items?: MlRemedialItem[]
}

/** Ekstrak remedial dari respons API (snake_case / camelCase / proxy). */
export function parseRemedialItemsFromQuizResponse(r: unknown): MlRemedialItem[] {
  if (!r || typeof r !== 'object') return []
  const o = r as Record<string, unknown>
  const raw = o.remedial_items ?? o.remedialItems
  if (!Array.isArray(raw)) return []
  const out: MlRemedialItem[] = []
  for (const x of raw) {
    if (!x || typeof x !== 'object') continue
    const row = x as Record<string, unknown>
    const question_id = String(row.question_id ?? row.questionId ?? '').trim()
    if (!question_id) continue
    out.push({
      question_id,
      question: String(row.question ?? '').trim(),
      user_answer: String(row.user_answer ?? row.userAnswer ?? '').trim(),
    })
  }
  return out
}

/** Backend: pertanyaan pertama memakai timeout read ~42s + cadangan; 90s cukup sebelum client putus. */
const ML_AI_TIMEOUT_MS = 90_000

export async function startMlQuiz(sessionId: string): Promise<MlQuizStepResponse> {
  const { data } = await api.post<MlQuizStepResponse>(
    `/public/ml-sessions/${encodeURIComponent(sessionId)}/quiz`,
    {},
    { timeout: ML_AI_TIMEOUT_MS },
  )
  return {
    ...data,
    remedial_items: parseRemedialItemsFromQuizResponse(data),
    assessment: normalizeMlAssessment(data.assessment),
  }
}

export async function postMlQuizAnswer(
  sessionId: string,
  body: { question_id: string; text?: string; choice_index?: number },
): Promise<MlQuizStepResponse> {
  const { data } = await api.post<MlQuizStepResponse>(
    `/public/ml-sessions/${encodeURIComponent(sessionId)}/quiz/answer`,
    body,
    { timeout: ML_AI_TIMEOUT_MS },
  )
  return {
    ...data,
    remedial_items: parseRemedialItemsFromQuizResponse(data),
    assessment: normalizeMlAssessment(data.assessment),
  }
}

/** Isi remedial dari DB setelah sesi status done (jika respons kuis tidak membawa remedial_items). */
export async function fetchMlSessionCompletion(sessionId: string): Promise<{ remedial_items: MlRemedialItem[] }> {
  const { data } = await api.get<{ remedial_items?: MlRemedialItem[] }>(
    `/public/ml-sessions/${encodeURIComponent(sessionId)}/completion`,
  )
  const remedial_items = parseRemedialItemsFromQuizResponse({ remedial_items: data.remedial_items })
  return { remedial_items }
}

export async function fetchAdminMlVideos(): Promise<MlVideoAdmin[]> {
  const { data } = await api.get<MlVideoAdmin[]>('/admin/ml-videos')
  return data
}

export async function createAdminMlVideo(body: {
  title: string
  description?: string
  youtube_url: string
  video_script?: string
  explanation?: string
  sort_order?: number
  published?: boolean
  category?: MlVideoCategory
  belajar_topic?: string
}): Promise<MlVideoAdmin> {
  const { data } = await api.post<MlVideoAdmin>('/admin/ml-videos', body)
  return data
}

export async function updateAdminMlVideo(
  id: string,
  patch: Partial<{
    title: string
    description: string
    youtube_url: string
    video_script: string
    explanation: string
    sort_order: number
    published: boolean
    category: MlVideoCategory
    belajar_topic: string
  }>,
): Promise<MlVideoAdmin> {
  const { data } = await api.put<MlVideoAdmin>(`/admin/ml-videos/${encodeURIComponent(id)}`, patch)
  return data
}

export async function deleteAdminMlVideo(id: string): Promise<void> {
  await api.delete(`/admin/ml-videos/${encodeURIComponent(id)}`)
}

export async function fetchAdminMlSessions(videoId?: string | null): Promise<MlSessionLogRow[]> {
  const { data } = await api.get<MlSessionLogRow[]>('/admin/ml-sessions', {
    params: videoId ? { video_id: videoId } : {},
  })
  return data
}

export async function fetchPublicMlPdfs(
  opts?: { category?: MlVideoCategory | null; topik?: string | null },
): Promise<MlPdfPublic[]> {
  const { category, topik } = opts ?? {}
  const params: Record<string, string> = {}
  if (category) params.category = category
  if (topik) params.topik = topik
  const { data } = await api.get<MlPdfPublic[]>('/public/ml-pdfs', {
    params: Object.keys(params).length ? params : undefined,
  })
  return data.map((x) => ({
    ...x,
    category: x.category ?? 'asesmen_ai',
    belajar_topic: x.belajar_topic ?? '',
    chapters: x.chapters ?? [],
  }))
}

export async function startMlPdfSession(pdfId: string): Promise<{ id: string; pdf: MlPdfPublic }> {
  const { data } = await api.post<{ id: string; pdf: MlPdfPublic }>('/public/ml-pdf-sessions', {
    pdf_id: pdfId,
  })
  return data
}

export async function patchMlPdfEngagement(sessionId: string, seconds: number): Promise<void> {
  await api.patch(`/public/ml-pdf-sessions/${encodeURIComponent(sessionId)}/engagement`, { seconds })
}

export type MlPdfQuizStepResponse = {
  question: {
    id: string
    question: string
    choices: string[]
    chapter_index: number
  } | null
  done: boolean
  current_step: number
  total_steps: number
  chapter_quiz_done: boolean
  next_chapter_index: number | null
  report: string
  knowledge_level: string
  seconds_pdf: number
  assessment: MlAssessmentSummary | null
  remedial_items?: MlRemedialItem[]
}

export async function startMlPdfChapterQuiz(
  sessionId: string,
  chapterIndex: number,
): Promise<MlPdfQuizStepResponse> {
  const { data } = await api.post<MlPdfQuizStepResponse>(
    `/public/ml-pdf-sessions/${encodeURIComponent(sessionId)}/quiz/chapter`,
    { chapter_index: chapterIndex },
    { timeout: ML_AI_TIMEOUT_MS },
  )
  return {
    ...data,
    remedial_items: parseRemedialItemsFromQuizResponse(data),
    assessment: normalizeMlAssessment(data.assessment),
  }
}

export async function postMlPdfMcqAnswer(
  sessionId: string,
  body: { question_id: string; choice_index: number },
): Promise<MlPdfQuizStepResponse> {
  const { data } = await api.post<MlPdfQuizStepResponse>(
    `/public/ml-pdf-sessions/${encodeURIComponent(sessionId)}/quiz/answer`,
    body,
    { timeout: ML_AI_TIMEOUT_MS },
  )
  return {
    ...data,
    remedial_items: parseRemedialItemsFromQuizResponse(data),
    assessment: normalizeMlAssessment(data.assessment),
  }
}

export async function fetchMlPdfSessionCompletion(sessionId: string): Promise<{ remedial_items: MlRemedialItem[] }> {
  const { data } = await api.get<{ remedial_items?: MlRemedialItem[] }>(
    `/public/ml-pdf-sessions/${encodeURIComponent(sessionId)}/completion`,
  )
  const remedial_items = parseRemedialItemsFromQuizResponse({ remedial_items: data.remedial_items })
  return { remedial_items }
}

export async function fetchAdminMlPdfs(): Promise<MlPdfAdmin[]> {
  const { data } = await api.get<MlPdfAdmin[]>('/admin/ml-pdfs')
  return data
}

export async function createAdminMlPdf(body: {
  title: string
  description?: string
  drive_url: string
  sort_order?: number
  published?: boolean
  category?: MlVideoCategory
  belajar_topic?: string
  chapters: Array<{
    title: string
    page_start: number
    page_end: number
    content?: string
    explanation?: string
  }>
}): Promise<MlPdfAdmin> {
  const { data } = await api.post<MlPdfAdmin>('/admin/ml-pdfs', body)
  return data
}

export async function updateAdminMlPdf(
  id: string,
  patch: Partial<{
    title: string
    description: string
    drive_url: string
    sort_order: number
    published: boolean
    category: MlVideoCategory
    belajar_topic: string
    chapters: Array<{
      title: string
      page_start: number
      page_end: number
      content?: string
      explanation?: string
    }>
  }>,
): Promise<MlPdfAdmin> {
  const { data } = await api.put<MlPdfAdmin>(`/admin/ml-pdfs/${encodeURIComponent(id)}`, patch)
  return data
}

export async function deleteAdminMlPdf(id: string): Promise<void> {
  await api.delete(`/admin/ml-pdfs/${encodeURIComponent(id)}`)
}

export async function fetchAdminMlPdfSessions(pdfId?: string | null): Promise<MlPdfSessionLogRow[]> {
  const { data } = await api.get<MlPdfSessionLogRow[]>('/admin/ml-pdf-sessions', {
    params: pdfId ? { pdf_id: pdfId } : {},
  })
  return data
}

// ── LIPI Quiz ──────────────────────────────────────────────────────────────

export interface LipiChoice {
  id: string
  text: string
}

export interface LipiQuestion {
  id: string
  section: 'dm' | 'ed' | 'pg' | 'sk' | 'td'
  number: number
  text: string
  type: 'likert_4' | 'likert_5' | 'mcq' | 'text'
  options: string[]
  choices?: LipiChoice[]
  note: string
  placeholder?: string
  input_mode?: 'text' | 'number'
}

export type LipiAttemptType = 'pre_test' | 'post_test'
export type LipiKuisStatus = 'belum' | 'post_menunggu' | 'lengkap'

export interface LipiEligibility {
  eligible: boolean
  completed_videos: number
  required_videos: number
  completed_pdfs: number
  required_pdfs: number
  quiz_enabled: boolean
  can_submit?: boolean
  next_attempt_type?: LipiAttemptType | null
  has_pre_test?: boolean
  has_post_test?: boolean
  kuis_status?: LipiKuisStatus
}

export interface LipiSectionReview {
  category: string
  label: string
  score: number
  score_unit?: 'pct' | 'ed_scale'
}

export interface LipiWrongItem {
  sub_id: string
  question: string
  sub_text: string
  section: string
  your_answer: string
  correct_answer: string
  your_answer_text?: string
  correct_answer_text?: string
}

export interface LipiResult {
  session_id: string
  questionnaire_version?: string
  attempt_type?: LipiAttemptType
  attempt_label?: string
  total_score: number
  level: string
  level_color: string
  pengetahuan_score?: number
  pengetahuan_earned?: number
  pengetahuan_max?: number
  pengetahuan_level?: string
  efikasi_diri_raw?: number
  efikasi_diri_score?: number
  efikasi_diri_level?: string
  efikasi_diri_level_color?: string
  sikap_score?: number
  sikap_raw?: number
  sikap_max?: number
  sikap_level?: string
  sikap_level_color?: string
  tindakan_score?: number
  tindakan_raw?: number
  tindakan_max?: number
  tindakan_level?: string
  tindakan_level_color?: string
  kap_score: number
  ep_score: number | null
  ws_score: number | null
  rmc_score: number | null
  kap_max: number
  ep_max: number | null
  ws_max: number | null
  rmc_max: number | null
  ed_scored?: boolean
  sk_scored?: boolean
  td_scored?: boolean
  wrong_items: LipiWrongItem[]
  ai_recommendation: string
  sections_to_review: LipiSectionReview[]
  submitted_at: string
}

export interface LipiSettings {
  min_videos: number
  min_pdfs: number
  enabled: boolean
}

export async function fetchLipiQuestions(
  attemptType: LipiAttemptType = 'pre_test',
): Promise<{
  demographics: LipiQuestion[]
  questions: LipiQuestion[]
  demographic_total: number
  total: number
  attempt_type?: LipiAttemptType
  likert_mode?: string
}> {
  const { data } = await api.get<{
    demographics: LipiQuestion[]
    questions: LipiQuestion[]
    demographic_total: number
    total: number
    attempt_type?: LipiAttemptType
    likert_mode?: string
  }>('/public/lipi-quiz/questions', { params: { attempt_type: attemptType } })
  return data
}

export async function fetchLipiEligibility(): Promise<LipiEligibility> {
  const { data } = await api.get<LipiEligibility>('/public/lipi-quiz/eligibility')
  return data
}

export async function submitLipiQuiz(
  demographics: Record<string, string>,
  answers: Record<string, string>,
): Promise<LipiResult> {
  const { data } = await api.post<LipiResult>('/public/lipi-quiz/submit', { demographics, answers })
  return data
}

export async function fetchMyLipiResults(): Promise<{ results: LipiResult[] }> {
  const { data } = await api.get<{ results: LipiResult[] }>('/public/lipi-quiz/my-results')
  return data
}

export async function sendLipiReportWa(sessionId: string): Promise<{ ok: boolean; detail: string }> {
  const { data } = await api.post<{ ok: boolean; detail: string }>('/public/lipi-quiz/send-report-wa', {
    session_id: sessionId,
  })
  return data
}

export async function fetchAdminLipiSettings(): Promise<LipiSettings> {
  const { data } = await api.get<LipiSettings>('/admin/lipi-quiz/settings')
  return data
}

export async function saveAdminLipiSettings(settings: LipiSettings): Promise<LipiSettings> {
  const { data } = await api.put<LipiSettings>('/admin/lipi-quiz/settings', settings)
  return data
}

export async function fetchAdminLipiAllResults(): Promise<{ results: LipiResult[]; total: number }> {
  const { data } = await api.get<{ results: LipiResult[]; total: number }>('/admin/lipi-quiz/all-results')
  return data
}

export async function downloadAdminLipiExport(params?: {
  from?: string
  to?: string
  username?: string
}): Promise<void> {
  const qs = new URLSearchParams()
  if (params?.from) qs.set('from', params.from)
  if (params?.to) qs.set('to', params.to)
  if (params?.username) qs.set('username', params.username)
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const { data } = await api.get<Blob>(`/admin/lipi-quiz/export${suffix}`, { responseType: 'blob' })
  const blob = new Blob([data], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `kuesioner-gempa-${stamp}.xlsx`
  a.click()
  URL.revokeObjectURL(a.href)
}

/** Simulasi evakuasi (materi masyarakat) - wilayah admin sama seperti peta wilayah penelitian. */
export type EvacSimRegionId = 'all' | 'talise' | 'wani' | 'jonooge'

export type EvacSimAdminPoint = {
  id: string
  region_id: EvacSimRegionId
  title: string
  lat: number | null
  lng: number | null
}

export type EvacSimAdminPayload = {
  enabled: boolean
  destinations: EvacSimAdminPoint[]
}

export async function fetchAdminEvacSimSettings(): Promise<EvacSimAdminPayload> {
  const { data } = await api.get<EvacSimAdminPayload>('/admin/evacuation-sim')
  return data
}

export async function saveAdminEvacSimSettings(body: EvacSimAdminPayload): Promise<EvacSimAdminPayload> {
  const { data } = await api.put<EvacSimAdminPayload>('/admin/evacuation-sim', body)
  return data
}

// ── SiAP-PKM: Puskesmas, Pelatihan, Kapus, Notifikasi ────────────────────────

import type {
  PuskesmasOut,
  StaffOut,
  PelatihanOut,
  AbsensiOut,
  NotifikasiSettings,
  NotifikasiJenis,
  StaffSkorOut,
  KapusDashboardOut,
  PelatihanStaffRekap,
  StaffBelumPelatihanOut,
} from '../types'

// Puskesmas
export async function fetchPuskesmasList(): Promise<PuskesmasOut[]> {
  const { data } = await api.get<PuskesmasOut[]>('/puskesmas/all-public')
  return data
}

export async function fetchAdminPuskesmasList(): Promise<PuskesmasOut[]> {
  const { data } = await api.get<PuskesmasOut[]>('/puskesmas')
  return data
}

export async function createPuskesmas(body: { nama: string; alamat: string; kode: string }): Promise<PuskesmasOut> {
  const { data } = await api.post<PuskesmasOut>('/puskesmas', body)
  return data
}

export async function updatePuskesmas(id: string, body: Partial<{ nama: string; alamat: string; kode: string }>): Promise<PuskesmasOut> {
  const { data } = await api.patch<PuskesmasOut>(`/puskesmas/${id}`, body)
  return data
}

export async function deletePuskesmas(id: string): Promise<void> {
  await api.delete(`/puskesmas/${id}`)
}

// Admin: akun staff & kapus
export async function fetchAdminStaffList(): Promise<StaffOut[]> {
  const { data } = await api.get<StaffOut[]>('/admin/staff-list')
  return data
}

export async function createStaffByAdmin(body: {
  username: string; password: string; puskesmas_id: string; display_name?: string; wa_phone?: string
}): Promise<StaffOut> {
  const { data } = await api.post<StaffOut>('/admin/staff-puskesmas', body)
  return data
}

export async function updateStaffByAdmin(username: string, body: {
  display_name?: string | null; wa_phone?: string | null; password?: string | null; puskesmas_id?: string | null
}): Promise<StaffOut> {
  const { data } = await api.patch<StaffOut>(`/admin/staff-puskesmas/${username}`, body)
  return data
}

export async function fetchAdminKapusList(): Promise<StaffOut[]> {
  const { data } = await api.get<StaffOut[]>('/admin/kapus-list')
  return data
}

export async function createKapus(body: {
  username: string; password: string; puskesmas_id: string; display_name?: string
}): Promise<StaffOut> {
  const { data } = await api.post<StaffOut>('/admin/kapus', body)
  return data
}

export async function deleteKapus(username: string): Promise<void> {
  await api.delete(`/admin/kapus/${username}`)
}

export async function fetchPublicPelatihanList(): Promise<PelatihanOut[]> {
  const { data } = await api.get<PelatihanOut[]>('/public/pelatihan')
  return data
}

// Pelatihan
export async function fetchPelatihanList(): Promise<PelatihanOut[]> {
  const { data } = await api.get<PelatihanOut[]>('/pelatihan')
  return data
}

export async function fetchPelatihan(id: string): Promise<PelatihanOut> {
  const { data } = await api.get<PelatihanOut>(`/pelatihan/${id}`)
  return data
}

export async function createPelatihan(body: {
  judul: string; deskripsi?: string; tanggal: string; waktu_mulai?: string; waktu_selesai?: string; lokasi?: string; narasumber?: string; kapasitas?: number; flyer_url?: string
}): Promise<PelatihanOut> {
  const { data } = await api.post<PelatihanOut>('/pelatihan', body)
  return data
}

export async function updatePelatihan(id: string, body: Partial<{
  judul: string; deskripsi: string; tanggal: string; waktu_mulai: string; waktu_selesai: string; lokasi: string; narasumber: string; kapasitas: number; flyer_url: string
}>): Promise<PelatihanOut> {
  const { data } = await api.patch<PelatihanOut>(`/pelatihan/${id}`, body)
  return data
}

export async function deletePelatihan(id: string): Promise<void> {
  await api.delete(`/pelatihan/${id}`)
}

export async function uploadFlyer(file: File): Promise<{ url: string }> {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post<{ url: string }>('/admin/upload-flyer', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data
}

export async function fetchPelatihanQrToken(id: string): Promise<{ pelatihan_id: string; qr_token: string; judul: string }> {
  const { data } = await api.get(`/pelatihan/${id}/qr-token`)
  return data
}

export async function regeneratePelatihanQr(id: string): Promise<{ qr_token: string }> {
  const { data } = await api.post(`/pelatihan/${id}/regenerate-qr`)
  return data
}

export async function fetchPelatihanPeserta(pelId: string): Promise<AbsensiOut[]> {
  const { data } = await api.get<AbsensiOut[]>(`/pelatihan/${pelId}/peserta`)
  return data
}

export async function togglePesertaPelatihan(pelId: string, username: string, terdaftar: boolean): Promise<void> {
  await api.post(`/pelatihan/${pelId}/peserta/toggle`, { username, terdaftar })
}

export async function updateAbsensi(pelId: string, username: string, hadir: boolean): Promise<void> {
  await api.patch(`/pelatihan/${pelId}/absensi`, { username, hadir })
}

export async function scanQrAbsen(pelatihan_id: string, token: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.post('/pelatihan/scan-qr', { pelatihan_id, token })
  return data
}

export async function fetchRiwayatPelatihanSaya(): Promise<AbsensiOut[]> {
  const { data } = await api.get<AbsensiOut[]>('/pelatihan/saya/riwayat')
  return data
}

// Kapus
export async function fetchKapusDashboard(): Promise<KapusDashboardOut> {
  const { data } = await api.get<KapusDashboardOut>('/kapus/dashboard')
  return data
}

export async function fetchStaffBelumPelatihan1Tahun(): Promise<StaffBelumPelatihanOut[]> {
  const { data } = await api.get<StaffBelumPelatihanOut[]>('/kapus/laporan-tahunan/staff-belum-pelatihan')
  return data
}

export async function kirimPengingatPelatihan(username: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.post(`/kapus/laporan-tahunan/kirim-pengingat/${username}`)
  return data
}

export async function fetchKapusStaffList(): Promise<StaffOut[]> {
  const { data } = await api.get<StaffOut[]>('/kapus/staff')
  return data
}

export async function createStaffByKapus(body: {
  username: string; password: string; display_name?: string; wa_phone?: string
}): Promise<StaffOut> {
  const { data } = await api.post<StaffOut>('/kapus/staff', body)
  return data
}

export async function updateStaffByKapus(username: string, body: {
  display_name?: string | null; wa_phone?: string | null; password?: string | null
}): Promise<StaffOut> {
  const { data } = await api.patch<StaffOut>(`/kapus/staff/${username}`, body)
  return data
}

export async function deleteStaffByKapus(username: string): Promise<void> {
  await api.delete(`/kapus/staff/${username}`)
}

export async function fetchKapusStaffSkor(): Promise<StaffSkorOut[]> {
  const { data } = await api.get<StaffSkorOut[]>('/kapus/staff-skor')
  return data
}

export async function fetchKapusPelatihanStaff(): Promise<PelatihanStaffRekap[]> {
  const { data } = await api.get<PelatihanStaffRekap[]>('/kapus/pelatihan-staff')
  return data
}

// Notifikasi
export async function fetchNotifikasiSettings(pkId: string): Promise<NotifikasiSettings> {
  const { data } = await api.get<NotifikasiSettings>(`/notifikasi/${pkId}`)
  return data
}

export async function saveNotifikasiSettings(pkId: string, notifikasi: NotifikasiJenis[]): Promise<NotifikasiSettings> {
  const { data } = await api.put<NotifikasiSettings>(`/notifikasi/${pkId}`, { notifikasi })
  return data
}

export async function testKirimNotifikasi(pkId: string, notifId: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.post(`/notifikasi/${pkId}/test-kirim/${notifId}`)
  return data
}

// Latihan Triase START
export interface TriageCategory {
  id: string
  label: string
  subtitle: string
  hint: string
}

export interface TriageCasePublic {
  index: number
  id: number
  text: string
}

export interface TriageGameConfig {
  time_limit_sec: number
  total_cases: number
  categories: TriageCategory[]
  protocol_steps: string[]
}

export interface TriageSessionStart {
  session_id: string
  time_limit_sec: number
  total_cases: number
  categories: TriageCategory[]
  case: TriageCasePublic
}

export interface TriageAnswerResult {
  correct: boolean
  correct_answer: string
  correct_label: string
  your_answer: string
  points_earned: number
  breakdown: { base: number; speed: number; streak: number; total: number }
  streak: number
  best_streak: number
  total_score: number
  correct_count: number
  answered: number
  total_cases: number
  finished: boolean
  next_case: TriageCasePublic | null
}

export interface TriageReviewItem {
  case_id: number
  case_text: string
  your_answer: string
  your_answer_label: string
  correct_answer: string
  correct_answer_label: string
  correct: boolean
  rationale: string
  protocol_steps: string
  feedback_educatif: string
}

export interface TriageReviewResponse {
  items: TriageReviewItem[]
  recommendation: string
  cached: boolean
}

export async function fetchTriageConfig(): Promise<TriageGameConfig> {
  const { data } = await api.get<TriageGameConfig>('/public/triage-game/config')
  return data
}

export async function startTriageSession(): Promise<TriageSessionStart> {
  const { data } = await api.post<TriageSessionStart>('/public/triage-game/sessions')
  return data
}

export async function submitTriageAnswer(
  sessionId: string,
  answer: string,
  elapsedMs: number,
): Promise<TriageAnswerResult> {
  const { data } = await api.post<TriageAnswerResult>('/public/triage-game/answer', {
    session_id: sessionId,
    answer,
    elapsed_ms: elapsedMs,
  })
  return data
}

export async function fetchMyBestTriage(): Promise<{
  best: {
    session_id: string
    score: number
    correct_count: number
    total_cases: number
    best_streak: number
    completed_at: string
  } | null
}> {
  const { data } = await api.get('/public/triage-game/my-best')
  return data
}

export async function fetchTriageReview(sessionId: string): Promise<TriageReviewResponse> {
  const { data } = await api.post<TriageReviewResponse>(
    `/public/triage-game/sessions/${encodeURIComponent(sessionId)}/review`,
  )
  return data
}

// ===========================================================================
// Skrining Kesiapsiagaan API
// ===========================================================================

export interface SkriningIndex {
  username: string
  display_name: string | null
  puskesmas_nama: string | null
  index_score: number | null
  index_level: string | null
  pg_score: number | null
  sk_score: number | null
  td_score: number | null
  session_id: string | null
  submitted_at: string | null
  attempt_type: string | null
}

export interface SkriningSummary {
  total_users: number
  with_index_count: number
  tanpa_index_count: number
  avg_index: number | null
  high_count: number
  medium_count: number
  low_count: number
  avg_pg: number | null
  avg_sk: number | null
  avg_td: number | null
  users: SkriningIndex[]
}

export interface SkriningWrongItem {
  sub_id: string
  question: string
  your_answer: string
  correct_answer: string
  your_answer_text: string
  correct_answer_text: string
}

export interface SkriningDetail {
  username: string
  display_name: string | null
  puskesmas_nama: string | null
  index_score: number
  index_level: string
  pg_score: number
  pg_level: string
  sk_score: number | null
  sk_level: string | null
  td_score: number
  td_level: string
  wrong_items: SkriningWrongItem[]
  attempt_type: string
  submitted_at: string
  ai_recommendation?: string | null
  ai_report?: SkriningAiReport | null
}

export interface SkriningAiReport {
  overall_analysis: string
  key_findings: string[]
  commonly_wrong_questions: string[]
  research_implications: string[]
  recommendations: string[]
}

export async function fetchSkriningSummary(): Promise<SkriningSummary> {
  const { data } = await api.get<SkriningSummary>('/admin/lipi-quiz/skrining/summary')
  return data
}

export async function fetchSkriningDetail(username: string): Promise<SkriningDetail> {
  const { data } = await api.get<SkriningDetail>(`/admin/lipi-quiz/skrining/${encodeURIComponent(username)}`)
  return data
}

export async function fetchSkriningAiReport(username: string): Promise<SkriningAiReport> {
  const { data } = await api.get<SkriningAiReport>(
    `/admin/lipi-quiz/skrining/${encodeURIComponent(username)}/ai-report`,
  )
  return data
}

async function pdfErrorMessage(data: unknown): Promise<string> {
  if (!(data instanceof Blob)) return 'Gagal mengunduh PDF.'
  try {
    const text = await data.text()
    const parsed = JSON.parse(text) as { detail?: unknown }
    if (typeof parsed.detail === 'string' && parsed.detail.trim()) return parsed.detail
  } catch {
    /* respons bukan JSON */
  }
  return 'Gagal mengunduh PDF.'
}

export async function downloadSertifikatPelatihan(nama: string): Promise<void> {
  try {
    const response = await api.post('/sertifikat/unduh', { nama }, { responseType: 'blob' })
    const raw = response.data as Blob
    const type = String(response.headers['content-type'] || raw.type || '')
    if (type.includes('application/json')) {
      throw new Error(await pdfErrorMessage(raw))
    }
    const blob = new Blob([raw], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const disposition = String(response.headers['content-disposition'] || '')
    const named = /filename="([^"]+)"/.exec(disposition)?.[1]
    const a = document.createElement('a')
    a.href = url
    a.download = named || 'sertifikat-pelatihan.pdf'
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new Error(await pdfErrorMessage(err.response?.data))
    }
    throw err
  }
}

export async function downloadMySkriningPdf(): Promise<void> {
  try {
    const response = await api.get('/public/lipi-quiz/laporan', { responseType: 'blob' })
    const raw = response.data as Blob
    const type = String(response.headers['content-type'] || raw.type || '')
    if (type.includes('application/json')) {
      throw new Error(await pdfErrorMessage(raw))
    }
    const blob = new Blob([raw], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const disposition = String(response.headers['content-disposition'] || '')
    const named = /filename="([^"]+)"/.exec(disposition)?.[1]
    const a = document.createElement('a')
    a.href = url
    a.download = named || 'laporan-skrining.pdf'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new Error(await pdfErrorMessage(err.response?.data))
    }
    throw err
  }
}

export async function downloadSkriningPdf(username: string): Promise<void> {
  try {
    const response = await api.get(
      `/admin/lipi-quiz/skrining/${encodeURIComponent(username)}/download-pdf`,
      { responseType: 'blob' },
    )
    const raw = response.data as Blob
    const type = String(response.headers['content-type'] || raw.type || '')
    if (type.includes('application/json')) {
      throw new Error(await pdfErrorMessage(raw))
    }
    const blob = new Blob([raw], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `skrining-kesiapsiagaan-${username}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (err) {
    if (axios.isAxiosError(err)) {
      throw new Error(await pdfErrorMessage(err.response?.data))
    }
    throw err
  }
}

export interface SkriningHistorySession {
  session_id: string
  index_score: number | null
  index_level: string | null
  pg_score: number | null
  pg_level: string | null
  sk_score: number | null
  sk_level: string | null
  td_score: number | null
  td_level: string | null
  attempt_type: string | null
  submitted_at: string | null
}

export interface SkriningHistoryResponse {
  sessions: SkriningHistorySession[]
  total: number
}

export async function fetchSkriningHistory(username: string): Promise<SkriningHistoryResponse> {
  const { data } = await api.get<SkriningHistoryResponse>(
    `/public/lipi-quiz/history/${encodeURIComponent(username)}`,
  )
  return data
}

export async function deleteSkriningSession(sessionId: string): Promise<{ ok: boolean; message: string }> {
  const { data } = await api.delete<{ ok: boolean; message: string }>(
    `/admin/lipi-quiz/session/${encodeURIComponent(sessionId)}`,
  )
  return data
}

export interface AuditLogEntry {
  action: string
  username: string
  timestamp: string
  detail: Record<string, unknown>
}

export interface AuditLogResponse {
  logs: AuditLogEntry[]
  total: number
  skip: number
  limit: number
}

export async function fetchAuditLog(
  limit = 50,
  skip = 0,
): Promise<AuditLogResponse> {
  const { data } = await api.get<AuditLogResponse>(
    `/admin/lipi-quiz/audit-log?limit=${limit}&skip=${skip}`,
  )
  return data
}
