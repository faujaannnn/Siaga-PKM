import {
  Activity,
  AlertCircle,
  BarChart3,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  FileSpreadsheet,
  Film,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  Phone,
  PhoneOff,
  RefreshCw,
  Search,
  Settings,
  Shield,
  UserRound,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { api, downloadAdminLipiExport, fetchSkriningSummary } from '../api/client'
import { useAuth } from '../context/AuthContext'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

interface VideoSession {
  id: string
  video_id: string
  video_title: string
  status: string
  knowledge_level: string
  seconds_watched: number
  updated_at: string
}

interface LipiResult {
  session_id: string
  attempt_type?: string
  attempt_label?: string
  total_score: number
  level: string
  level_color: string
  pengetahuan_score: number
  pengetahuan_level: string | null
  sikap_score: number | null
  sikap_level: string | null
  efikasi_diri_score: number | null
  efikasi_diri_level: string | null
  tindakan_score: number | null
  tindakan_level: string | null
  td_scored: boolean
  submitted_at: string
  ai_recommendation: string
}

interface TriageSession {
  id: string
  status: string
  score: number
  correct_count: number
  total_cases: number
  best_streak: number
  completed_at: string
}

interface PelatihanRow {
  id: string
  pelatihan_id: string
  judul: string
  hadir: boolean
  waktu_absen: string
}

type WaConnectionStatus = 'connected' | 'previously_connected' | 'never_connected'

interface WaChatTurn {
  role: string
  content: string
  kind: string
  at: string
  phone: string | null
}

interface WaChatHistory {
  username: string
  display_name: string | null
  wa_status: WaConnectionStatus
  wa_phone: string | null
  chat_count: number
  turns: WaChatTurn[]
}

interface UserProgress {
  username: string
  role: string
  display_name: string | null
  puskesmas_id: string | null
  puskesmas_nama: string | null
  published_video_total: number
  video_completed: number
  video_progress_pct: number
  video_avg_score: number | null
  video_sessions: VideoSession[]
  lipi_total: number
  kuis_status: string
  kuis_pengetahuan_score: number | null
  kuis_pengetahuan_level: string | null
  kuis_efikasi_score: number | null
  kuis_efikasi_level: string | null
  kuis_sikap_score: number | null
  kuis_sikap_level: string | null
  kuis_tindakan_score: number | null
  kuis_tindakan_level: string | null
  kuis_submitted_at: string | null
  kuis_pre_pengetahuan_score: number | null
  kuis_pre_efikasi_score: number | null
  kuis_pre_sikap_score: number | null
  kuis_pre_tindakan_score: number | null
  kuis_pre_submitted_at: string | null
  kuis_post_pengetahuan_score: number | null
  kuis_post_efikasi_score: number | null
  kuis_post_sikap_score: number | null
  kuis_post_tindakan_score: number | null
  kuis_post_submitted_at: string | null
  lipi_results: LipiResult[]
  triage_completed: boolean
  triage_session_count: number
  triage_best_score: number | null
  triage_first_score: number | null
  triage_first_correct: number | null
  triage_first_total: number | null
  triage_last_score: number | null
  triage_last_correct: number | null
  triage_last_total: number | null
  triage_sessions: TriageSession[]
  pelatihan_hadir_count: number
  pelatihan_last_hadir_at: string | null
  pelatihan_rows: PelatihanRow[]
  last_activity_at: string | null
  is_working: boolean
  wa_status: WaConnectionStatus
  wa_phone: string | null
  wa_chat_count: number
  wa_last_chat_at: string | null
}

interface MonitorSummary {
  total_staff: number
  working_count: number
  not_working_count: number
  published_video_total: number
  total_lipi_submissions: number
  kuis_pre_test_count: number
  kuis_post_test_count: number
  kuis_post_pending_count: number
  triage_completed_count: number
  triage_total_sessions: number
  triage_first_score: number | null
  triage_last_score: number | null
  pelatihan_hadir_staff_count: number
  wa_connected_count: number
  wa_previously_connected_count: number
  wa_never_connected_count: number
  wa_total_chats: number
  updated_at: string
}

interface MonitorDashboard {
  summary: MonitorSummary
  users: UserProgress[]
}

type FilterMode =
  | 'all'
  | 'working'
  | 'not-working'
  | 'triage-done'
  | 'triage-pending'
  | 'wa-connected'
  | 'wa-previous'
  | 'wa-never'

const REFRESH_MS = 10_000
const REQUIRED_VIDEOS = 2

function statusBadge(status: string): string {
  if (status === 'done' || status === 'completed') return 'bg-emerald-50 text-emerald-700'
  if (status === 'quiz') return 'bg-sky-50 text-sky-700'
  if (status === 'watching' || status === 'active') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function statusLabel(status: string): string {
  if (status === 'done' || status === 'completed') return 'Selesai'
  if (status === 'quiz') return 'Kuis'
  if (status === 'watching') return 'Menonton'
  if (status === 'active') return 'Berjalan'
  return status || '-'
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Belum ada aktivitas'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '-'
  const diffMs = Date.now() - dt.getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins} menit lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} jam lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} hari lalu`
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatClock(iso: string): string {
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '-'
  return dt.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function waStatusLabel(status: WaConnectionStatus | string | undefined): string {
  if (status === 'connected') return 'Terhubung'
  if (status === 'previously_connected') return 'Pernah terhubung'
  return 'Belum pernah terhubung'
}

function waStatusBadge(status: WaConnectionStatus | string | undefined): string {
  if (status === 'connected') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
  if (status === 'previously_connected') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/80'
  return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200/80'
}

function ProgressBar({ value, tone }: { value: number; tone: 'video' | 'triage' | 'lipi' }) {
  const bar =
    tone === 'video'
      ? 'bg-gradient-to-r from-health-500 to-health-600'
      : tone === 'triage'
        ? 'bg-gradient-to-r from-amber-500 to-amber-600'
        : 'bg-gradient-to-r from-cta-500 to-cta-600'
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof Users
  label: string
  value: string | number
  hint: string
  accent: 'green' | 'red' | 'cyan' | 'violet' | 'amber' | 'slate'
}) {
  const accents = {
    green: 'from-emerald-500/10 to-emerald-500/5 border-emerald-200/60 text-emerald-700',
    red: 'from-rose-500/10 to-rose-500/5 border-rose-200/60 text-rose-700',
    cyan: 'from-health-500/10 to-health-500/5 border-health-100 text-health-700',
    violet: 'from-violet-500/10 to-violet-500/5 border-violet-200/60 text-violet-700',
    amber: 'from-amber-500/10 to-amber-500/5 border-amber-200/60 text-amber-700',
    slate: 'from-slate-500/10 to-slate-500/5 border-slate-200/60 text-slate-600',
  }
  return (
    <div className={`glass-panel rounded-2xl border bg-gradient-to-br p-4 ${accents[accent]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{label}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums text-theme">{value}</p>
          <p className="mt-1 text-xs text-theme-muted">{hint}</p>
        </div>
        <div className="rounded-xl bg-white/70 p-2.5 shadow-sm">
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
    </div>
  )
}

function kuisStatusBadge(status: string): string {
  if (status === 'lengkap') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/80'
  if (status === 'post_menunggu') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/80'
  return 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
}

function kuisStatusLabel(status: string): string {
  if (status === 'lengkap') return 'Lengkap'
  if (status === 'post_menunggu') return 'Post menunggu'
  return 'Belum pre-test'
}

function KuisAttemptSnapshot({
  mode,
  pg,
  ed,
  sk,
  td,
  submittedAt,
}: {
  mode: 'pre' | 'post'
  pg: number | null
  ed: number | null
  sk: number | null
  td: number | null
  submittedAt: string | null
}) {
  if (pg === null && ed === null && sk === null && td === null) {
    return <span className="text-sm text-theme-soft">-</span>
  }
  const pgMakna = pg === null ? null : pg >= 76 ? 'Baik' : pg >= 56 ? 'Cukup' : 'Kurang'
  const edMakna = ed === null ? null : ed >= 30 ? 'Tinggi' : ed >= 20 ? 'Sedang' : 'Rendah'
  const skMakna = sk === null ? null : sk >= 76 ? 'Baik' : sk >= 56 ? 'Cukup' : 'Kurang'
  const tdMakna = td === null ? null : td >= 50 ? 'Baik' : 'Buruk'
  const indeksBagian = [pg, mode === 'post' && sk !== null ? sk : null, td].filter((n): n is number => n !== null)
  const indeksSiap = pg !== null && td !== null && (mode === 'pre' || sk !== null)
  const indeksSkor = indeksSiap ? indeksBagian.reduce((sum, n) => sum + n, 0) / indeksBagian.length : null
  const indeksLevel = indeksSkor === null ? null : indeksSkor >= 80 ? 'Tinggi' : indeksSkor >= 60 ? 'Menengah' : 'Rendah'
  const indeksTone = indeksLevel === 'Tinggi'
    ? 'bg-emerald-50 text-emerald-700'
    : indeksLevel === 'Menengah'
      ? 'bg-amber-50 text-amber-800'
      : 'bg-rose-50 text-rose-700'
  return (
    <div className="space-y-1 text-[10px] leading-snug text-theme-muted">
      <p><span className="font-semibold text-theme">PG</span> {pg ?? '-'}%{pgMakna ? ` · ${pgMakna}` : ''}</p>
      <p><span className="font-semibold text-theme">ED</span> {ed ?? '-'}/40{edMakna ? ` · ${edMakna}` : ''}</p>
      <p><span className="font-semibold text-theme">SK</span> {sk ?? '-'}%{skMakna ? ` · ${skMakna}` : ''}</p>
      <p><span className="font-semibold text-theme">TD</span> {td ?? '-'}%{tdMakna ? ` · ${tdMakna}` : ''}</p>
      {indeksLevel && indeksSkor !== null ? (
        <p className={`inline-flex rounded-full px-1.5 py-0.5 font-semibold ${indeksTone}`}>
          Kesiapsiagaan {indeksLevel} · {indeksSkor.toFixed(0)}
        </p>
      ) : null}
      {submittedAt ? <p className="text-theme-soft">{formatRelativeTime(submittedAt)}</p> : null}
    </div>
  )
}

function UserDetailPanel({
  user,
  onViewChats,
}: {
  user: UserProgress
  onViewChats: (user: UserProgress) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: easeOutExpo }}
      className="overflow-hidden"
    >
      <div className="space-y-4 border-t border-[var(--panel-border)] bg-health-50/30 p-4">
        <section className="rounded-xl border border-[var(--panel-border)] bg-white/80 p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-theme">
              <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden />
              Status WhatsApp
            </div>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${waStatusBadge(user.wa_status)}`}>
              {waStatusLabel(user.wa_status)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-theme-muted">
            <p>
              Nomor: <strong className="font-medium text-theme">{user.wa_phone || '-'}</strong>
            </p>
            <p>
              Jumlah chat: <strong className="font-semibold tabular-nums text-theme">{user.wa_chat_count}</strong>
            </p>
            <p>Chat terakhir: {formatRelativeTime(user.wa_last_chat_at)}</p>
          </div>
          <button
            type="button"
            onClick={() => onViewChats(user)}
            className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-health-600 px-3.5 py-2 text-sm font-semibold text-white transition duration-200 hover:brightness-105 focus-ring"
          >
            <MessageCircle className="h-4 w-4" aria-hidden />
            Lihat keseluruhan chat
          </button>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <section className="rounded-xl border border-[var(--panel-border)] bg-white/80 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-theme">
              <Film className="h-4 w-4 text-health-600" aria-hidden />
              Video ML
            </div>
            {user.video_sessions.length === 0 ? (
              <p className="text-sm text-theme-muted">Belum ada sesi video.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {user.video_sessions.map((s) => (
                  <li key={s.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                    <p className="font-medium text-theme">{s.video_title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-theme-muted">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${statusBadge(s.status)}`}>{statusLabel(s.status)}</span>
                      {s.knowledge_level ? <span>Level: {s.knowledge_level}</span> : null}
                      <span>{formatRelativeTime(s.updated_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-[var(--panel-border)] bg-white/80 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-theme">
              <Shield className="h-4 w-4 text-amber-600" aria-hidden />
              Latihan Triase
            </div>
            {user.triage_sessions.length === 0 ? (
              <p className="text-sm text-theme-muted">Belum ada sesi latihan triase.</p>
            ) : (
              <>
                <div className="mb-3 grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-theme-soft">Uji coba</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-theme">{user.triage_session_count}×</p>
                  </div>
                  <div className="rounded-lg bg-sky-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-sky-600">Skor pertama</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-theme">
                      {user.triage_first_score ?? '-'}
                      {user.triage_first_correct != null && user.triage_first_total
                        ? <span className="text-[10px] font-normal text-theme-muted"> · {user.triage_first_correct}/{user.triage_first_total}</span>
                        : ''}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 px-3 py-2 text-center">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600">Skor terakhir</p>
                    <p className="mt-0.5 text-lg font-bold tabular-nums text-theme">
                      {user.triage_last_score ?? '-'}
                      {user.triage_last_correct != null && user.triage_last_total
                        ? <span className="text-[10px] font-normal text-theme-muted"> · {user.triage_last_correct}/{user.triage_last_total}</span>
                        : ''}
                    </p>
                  </div>
                </div>
                <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                  {user.triage_sessions.map((s) => (
                    <li key={s.id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(s.status)}`}>
                          {statusLabel(s.status)}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-theme">{s.score} poin</span>
                      </div>
                      <p className="mt-2 text-xs text-theme-muted">
                        Benar {s.correct_count}/{s.total_cases || '-'} · streak {s.best_streak}
                      </p>
                      <p className="mt-1 text-xs text-theme-soft">{s.completed_at ? formatClock(s.completed_at) : '-'}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="rounded-xl border border-[var(--panel-border)] bg-white/80 p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-theme">
              <Brain className="h-4 w-4 text-cta-600" aria-hidden />
              Kuesioner Gempa
            </div>
            {user.lipi_results.length === 0 ? (
              <p className="text-sm text-theme-muted">Belum mengisi kuesioner.</p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {user.lipi_results.map((r) => (
                  <li key={r.session_id} className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.attempt_type === 'post_test' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'}`}>
                        {r.attempt_label ?? (r.attempt_type === 'post_test' ? 'Post-test' : 'Pre-test')}
                      </span>
                      <p className="text-xs font-medium text-theme-muted">{formatClock(r.submitted_at)}</p>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-theme-soft">Pengetahuan</p>
                        <p className="mt-0.5 text-xs font-semibold text-theme">
                          {r.pengetahuan_score}% · {r.pengetahuan_level || r.level || '-'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-theme-soft">Efikasi diri</p>
                        <p className="mt-0.5 text-xs font-semibold text-theme">
                          {r.efikasi_diri_score != null ? `${r.efikasi_diri_score}/40` : '-'} · {r.efikasi_diri_level || '-'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-theme-soft">Sikap</p>
                        <p className="mt-0.5 text-xs font-semibold text-theme">
                          {r.sikap_score != null ? `${r.sikap_score}%` : '-'} · {r.sikap_level || '-'}
                        </p>
                      </div>
                      <div className="rounded-lg bg-slate-50 px-2 py-1.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-theme-soft">Tindakan</p>
                        <p className="mt-0.5 text-xs font-semibold text-theme">
                          {r.tindakan_score != null ? `${r.tindakan_score}%` : '-'} · {r.tindakan_level || '-'}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </motion.div>
  )
}

function WaChatModal({
  username,
  displayName,
  onClose,
}: {
  username: string
  displayName: string | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<WaChatHistory | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await api.get<WaChatHistory>(`/admin/users/${encodeURIComponent(username)}/wa-chats`)
        if (!cancelled) setHistory(res.data)
      } catch (err: unknown) {
        console.error(err)
        if (!cancelled) setError('Gagal memuat riwayat chat WhatsApp.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [username])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const turns = history?.turns ?? []

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-3 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-chat-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--panel-border)] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Riwayat WhatsApp</p>
            <h2 id="wa-chat-title" className="mt-1 text-lg font-bold text-theme">
              {displayName || username}
            </h2>
            <p className="mt-0.5 text-xs text-theme-muted">
              {username}
              {history?.wa_phone ? ` · ${history.wa_phone}` : ''}
              {history ? ` · ${history.chat_count} chat` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer rounded-lg p-1.5 text-theme-muted transition hover:bg-slate-100 hover:text-theme focus-ring"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-theme-muted">Memuat percakapan…</p>
          ) : error ? (
            <p className="py-10 text-center text-sm text-rose-700">{error}</p>
          ) : turns.length === 0 ? (
            <p className="py-10 text-center text-sm text-theme-muted">Belum ada percakapan WhatsApp untuk petugas ini.</p>
          ) : (
            <ol className="space-y-3">
              {turns.map((t, i) => {
                const isUser = t.role === 'user'
                const isContext = t.kind === 'context'
                return (
                  <li key={`${t.at}-${i}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${
                        isContext
                          ? 'bg-slate-100 text-theme-muted'
                          : isUser
                            ? 'bg-health-600 text-white'
                            : 'bg-slate-50 text-theme ring-1 ring-slate-200/80'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{t.content}</p>
                      <p className={`mt-1 text-[10px] ${isUser && !isContext ? 'text-white/75' : 'text-theme-soft'}`}>
                        {isContext ? 'Konteks sistem · ' : isUser ? 'Petugas · ' : 'Asisten · '}
                        {t.at ? formatClock(t.at) : '-'}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}

export function MonitorPage() {
  const { me, logout } = useAuth()
  const [dashboard, setDashboard] = useState<MonitorDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>('all')
  const [search, setSearch] = useState('')
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [chatUser, setChatUser] = useState<UserProgress | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [exportingLipi, setExportingLipi] = useState(false)
  const [skriningSummary, setSkriningSummary] = useState<import('../api/client').SkriningSummary | null>(null)

  const handleExportLipi = useCallback(async () => {
    setExportingLipi(true)
    try {
      await downloadAdminLipiExport()
    } catch (err: unknown) {
      console.error(err)
      setError('Gagal mengunduh Excel kuesioner. Coba lagi.')
    } finally {
      setExportingLipi(false)
    }
  }, [])

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      const res = await api.get<MonitorDashboard>('/admin/user-progress', {
        params: { _t: Date.now() },
      })
      setDashboard(res.data)
      setLastUpdated(res.data.summary.updated_at)
    } catch (err: unknown) {
      console.error(err)
      setError('Gagal mengambil data. Pastikan Anda login sebagai admin.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchData(true)
    }, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [fetchData])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') {
        void fetchData(true)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [fetchData])

  useEffect(() => {
    fetchSkriningSummary().then(setSkriningSummary).catch(() => setSkriningSummary(null))
  }, [])

  const users = dashboard?.users ?? []
  const summary = dashboard?.summary

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.trim().toLowerCase()
      const matchSearch =
        q === '' ||
        u.username.toLowerCase().includes(q) ||
        (u.display_name && u.display_name.toLowerCase().includes(q)) ||
        (u.puskesmas_nama && u.puskesmas_nama.toLowerCase().includes(q))
      if (!matchSearch) return false
      if (filter === 'working') return u.is_working
      if (filter === 'not-working') return !u.is_working
      if (filter === 'triage-done') return u.triage_completed
      if (filter === 'triage-pending') return !u.triage_completed
      if (filter === 'wa-connected') return u.wa_status === 'connected'
      if (filter === 'wa-previous') return u.wa_status === 'previously_connected'
      if (filter === 'wa-never') return u.wa_status === 'never_connected'
      return true
    })
  }, [users, search, filter])

  const puskesmasGroups = useMemo(() => {
    const map = new Map<string, number>()
    for (const u of users) {
      const key = u.puskesmas_nama || 'Belum terhubung ke puskesmas'
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [users])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-health-500 border-t-transparent" />
          <p className="mt-4 text-theme-muted">Memuat data monitoring…</p>
        </div>
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="glass-panel max-w-md rounded-2xl border border-rose-200/80 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" aria-hidden />
          <p className="mt-3 font-medium text-rose-700">{error ?? 'Data tidak tersedia'}</p>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="mt-4 cursor-pointer rounded-xl bg-merah px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:brightness-105 focus-ring"
          >
            Coba lagi
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-8">
      <a className="skip-to-content" href="#monitor-main">
        Lewati ke isi
      </a>

      <main className="mx-auto max-w-7xl outline-none" id="monitor-main" tabIndex={-1}>
        <div className="glass-panel mb-6 overflow-hidden rounded-2xl border border-[var(--panel-border)]">
          <div className="bg-gradient-to-r from-merah to-merah-bright px-5 py-5 text-white sm:px-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                  <LayoutDashboard className="h-3.5 w-3.5" aria-hidden />
                  Dashboard Admin · SiAP-PKM
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Monitor Kesiapsiagaan Petugas</h1>
                <p className="mt-1 max-w-2xl text-sm text-white/85">
                  Progress real-time Video ML, latihan triase START, kuesioner gempa, dan status WhatsApp seluruh
                  petugas.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/admin"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium transition duration-200 hover:bg-white/25 focus-ring"
                >
                  <Settings className="h-4 w-4" aria-hidden />
                  Panel Admin
                </Link>
                <button
                  type="button"
                  onClick={() => void handleExportLipi()}
                  disabled={exportingLipi}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium transition duration-200 hover:bg-white/25 disabled:opacity-60 focus-ring"
                >
                  <FileSpreadsheet className="h-4 w-4" aria-hidden />
                  {exportingLipi ? 'Mengekspor…' : 'Ekspor Excel'}
                </button>
                <button
                  type="button"
                  onClick={() => void fetchData(true)}
                  disabled={refreshing}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium transition duration-200 hover:bg-white/25 disabled:opacity-60 focus-ring"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                  {refreshing ? 'Memperbarui…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium transition duration-200 hover:bg-white/25 focus-ring"
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  Keluar
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-border)] px-5 py-3 text-xs text-theme-muted sm:px-6">
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-health-600" aria-hidden />
              Login sebagai <strong className="text-theme">{me?.username}</strong>
            </span>
            <span>Diperbarui {formatRelativeTime(lastUpdated)} · auto-refresh 10 detik · sinkron langsung dari database</span>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard
            icon={CheckCircle2}
            label="Sudah memenuhi syarat"
            value={summary.working_count}
            hint="2 video ML · pre+post kuesioner · triase"
            accent="green"
          />
          <StatCard
            icon={XCircle}
            label="Belum memenuhi syarat"
            value={summary.not_working_count}
            hint={`Dari ${summary.total_staff} akun petugas`}
            accent="red"
          />
          <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-700">
              <Shield className="h-4 w-4" aria-hidden />
              Latihan Triase
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600">Ujicoba</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-amber-800">{summary.triage_total_sessions}</p>
                <p className="mt-0.5 text-[10px] text-amber-500">sesi total</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-sky-600">Skor pertama</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-sky-800">{summary.triage_first_score ?? '-'}</p>
                <p className="mt-0.5 text-[10px] text-sky-500">terakhir</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">Skor terakhir</p>
                <p className="mt-0.5 text-2xl font-bold tabular-nums text-emerald-800">{summary.triage_last_score ?? '-'}</p>
                <p className="mt-0.5 text-[10px] text-emerald-500">terakhir</p>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-amber-600">
              {summary.triage_completed_count} dari {summary.total_staff} petugas selesai
            </p>
          </div>
          <StatCard
            icon={Film}
            label="Materi Video ML"
            value={summary.published_video_total}
            hint="Video terpublikasi di sistem"
            accent="cyan"
          />
          <StatCard
            icon={Brain}
            label="Post-test menunggu"
            value={summary.kuis_post_pending_count ?? 0}
            hint={`Pre: ${summary.kuis_pre_test_count ?? 0} · Post: ${summary.kuis_post_test_count ?? 0} · Total submisi: ${summary.total_lipi_submissions}`}
            accent="violet"
          />
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-theme">Status WhatsApp</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={Phone}
              label="Terhubung"
              value={summary.wa_connected_count ?? 0}
              hint="Masih tertaut & sudah ada 1 chat + 1 balasan"
              accent="green"
            />
            <StatCard
              icon={PhoneOff}
              label="Pernah terhubung"
              value={summary.wa_previously_connected_count ?? 0}
              hint="Sudah pernah chat+balasan, nomor sudah diputus"
              accent="amber"
            />
            <StatCard
              icon={Users}
              label="Belum pernah terhubung"
              value={summary.wa_never_connected_count ?? 0}
              hint="Belum ada minimal 1 chat dan 1 balasan"
              accent="slate"
            />
            <StatCard
              icon={MessageCircle}
              label="Total chat WA"
              value={summary.wa_total_chats ?? 0}
              hint="Percakapan asisten seluruh petugas"
              accent="cyan"
            />
          </div>
        </div>

        {/* Skrining Kesiapsiagaan Widget */}
        {skriningSummary ? (
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border border-[var(--panel-border)] p-5 sm:flex-row sm:gap-6">
                <div className="flex flex-col items-center">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Indeks Rata-rata</p>
                  <div className="relative">
                    {(() => {
                      const score = skriningSummary.avg_index
                      const pct = Math.min(100, Math.max(0, score ?? 0))
                      const radius = 48
                      const circ = 2 * Math.PI * radius
                      const offset = circ - (pct / 100) * circ
                      const lvl = score != null ? (score >= 80 ? 'Tinggi' : score >= 60 ? 'Menengah' : 'Rendah') : null
                      const [r, g, b] = lvl === 'Tinggi' ? [39,174,96] : lvl === 'Menengah' ? [243,156,18] : [231,76,60]
                      return (
                        <svg width={120} height={120} className="-rotate-90">
                          <circle cx={60} cy={60} r={radius} fill="none" stroke="#E2E8F0" strokeWidth="10" />
                          <circle
                            cx={60} cy={60} r={radius} fill="none"
                            stroke={`rgb(${r},${g},${b})`} strokeWidth="10"
                            strokeLinecap="round"
                            strokeDasharray={circ} strokeDashoffset={offset}
                            style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
                          />
                        </svg>
                      )
                    })()}
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span
                        className="text-2xl font-black tabular-nums"
                        style={{
                          color: (() => {
                            const s = skriningSummary.avg_index
                            return s != null ? (s >= 80 ? '#27AE60' : s >= 60 ? '#F39C12' : '#E74C3C') : '#BDC1C7'
                          })(),
                        }}
                      >
                        {skriningSummary.avg_index != null ? skriningSummary.avg_index.toFixed(0) : '—'}
                      </span>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Indeks</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 sm:mt-0 sm:border-l sm:border-slate-100 sm:pl-6">
                  <div className="mb-3 text-center sm:text-left">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Tingkat Kesiapsiagaan</p>
                    <div className="mt-1 flex flex-wrap gap-2 sm:flex-nowrap">
                      {[['Tinggi', skriningSummary.high_count, '#27AE60'], ['Menengah', skriningSummary.medium_count, '#F39C12'], ['Rendah', skriningSummary.low_count, '#E74C3C']].map(([lvl, cnt, clr]) => (
                        <div key={String(lvl)} className="flex items-center gap-1.5 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 shadow-sm">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: String(clr) }} />
                          <span className="text-xs font-bold text-slate-700">{cnt ?? 0}</span>
                          <span className="text-[10px] text-slate-400">{String(lvl)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    {([
                      ['PG', skriningSummary.avg_pg, '#1F4E79'],
                      ['SK', skriningSummary.avg_sk, '#27AE60'],
                      ['TD', skriningSummary.avg_td, '#F39C12'],
                    ] as [string, number | null, string][]).map(([dim, val, clr]) => (
                      <div key={dim}>
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{dim}</p>
                        <p className="mt-0.5 text-base font-bold tabular-nums" style={{ color: clr }}>
                          {val != null ? `${(val as number).toFixed(0)}%` : '—'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border border-[var(--panel-border)] p-5 text-center">
              <Shield className="h-8 w-8 text-health-600" />
              <p className="mt-2 text-3xl font-black tabular-nums text-theme">{skriningSummary.with_index_count}</p>
              <p className="mt-1 text-xs text-theme-muted">petugas sudah mengisi kuesioner</p>
              <p className="mt-1 text-xs text-amber-500">
                {skriningSummary.tanpa_index_count > 0 ? `${skriningSummary.tanpa_index_count} belum` : '✓ semua sudah'}
              </p>
            </div>
            <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border border-[var(--panel-border)] p-5 text-center">
              <BarChart3 className="h-8 w-8 text-violet-600" />
              <p className="mt-2 text-3xl font-black tabular-nums text-theme">{skriningSummary.total_users}</p>
              <p className="mt-1 text-xs text-theme-muted">total petugas terdata</p>
              <Link
                to="/admin/skrining-kesiapsiagaan"
                className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 focus-ring"
              >
                Selengkapnya
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="mb-6 animate-pulse rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-slate-300" />
              <div>
                <div className="h-4 w-40 rounded bg-slate-200" />
                <div className="mt-1.5 h-3 w-24 rounded bg-slate-200" />
              </div>
            </div>
          </div>
        )}

        <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['all', `Semua (${users.length})`],
                    ['working', `Memenuhi (${summary.working_count})`],
                    ['not-working', `Belum (${summary.not_working_count})`],
                    ['triage-done', `Triase ✓ (${summary.triage_completed_count})`],
                    ['triage-pending', `Triase ✗ (${users.length - summary.triage_completed_count})`],
                    ['wa-connected', `WA terhubung (${summary.wa_connected_count ?? 0})`],
                    ['wa-previous', `WA pernah (${summary.wa_previously_connected_count ?? 0})`],
                    ['wa-never', `WA belum (${summary.wa_never_connected_count ?? 0})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilter(key)}
                    className={`cursor-pointer rounded-xl px-3.5 py-2 text-sm font-medium transition duration-200 focus-ring ${
                      filter === key
                        ? 'bg-health-600 text-white shadow-sm'
                        : 'border border-[var(--panel-border)] bg-white/80 text-theme-muted hover:text-theme'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-theme-soft" aria-hidden />
                <input
                  type="search"
                  placeholder="Cari username, nama, puskesmas…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-[var(--panel-border)] bg-white/90 py-2.5 pl-10 pr-4 text-sm text-theme outline-none transition duration-200 focus:border-health-500/50 focus:ring-[3px] focus:ring-health-500/20"
                />
              </div>
            </div>
            <p className="text-sm text-theme-muted">
              Menampilkan <strong className="text-theme">{filteredUsers.length}</strong> dari {users.length} petugas
            </p>
          </div>

          <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-theme">
              <MapPin className="h-4 w-4 text-health-600" aria-hidden />
              Sebaran Puskesmas
            </div>
            <ul className="space-y-2">
              {puskesmasGroups.slice(0, 6).map(([nama, count]) => (
                <li key={nama} className="flex items-center justify-between text-sm">
                  <span className="text-theme-muted">{nama}</span>
                  <span className="rounded-full bg-health-50 px-2.5 py-0.5 text-xs font-semibold text-health-700">{count}</span>
                </li>
              ))}
              {puskesmasGroups.length === 0 ? (
                <li className="text-sm text-theme-muted">Belum ada petugas.</li>
              ) : null}
            </ul>
          </div>
        </div>

        <div className="glass-panel overflow-hidden rounded-2xl border border-[var(--panel-border)]">
          <div className="border-b border-[var(--panel-border)] bg-violet-50/60 px-4 py-3 text-xs text-theme-muted sm:px-5">
            <p className="font-semibold text-violet-800">Skala Likert — Pre-test vs Post-test</p>
            <p className="mt-1">
              <strong>Pre-test (efikasi &amp; tindakan):</strong> 1=sangat setuju … 4=tidak setuju · poin = 5−jawaban
              (maks raw 60)
            </p>
            <p className="mt-1">
              <strong>Post-test (efikasi, sikap, tindakan):</strong> SS=5, S=4, KS=3, TS=2, STS=1 (maks raw 75 per
              bagian)
            </p>
            <p className="mt-1">
              <strong>Efikasi diri:</strong> raw dinormalkan ke skala 10–40 · Tinggi 30–40 · Sedang 20–29 · Rendah
              10–19
            </p>
            <p className="mt-1">
              <strong>Tindakan:</strong> (jumlah poin / maks raw) × 100% · Baik ≥50% · Buruk &lt;50%
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1280px]">
              <thead>
                <tr className="border-b border-[var(--panel-border)] bg-white/60 text-left text-xs font-semibold uppercase tracking-wide text-theme-muted">
                  <th className="px-4 py-3">Petugas</th>
                  <th className="px-3 py-3 text-center">Video ML</th>
                  <th className="px-3 py-3 text-center">Triase</th>
                  <th className="px-3 py-3 text-center">WhatsApp</th>
                  <th className="px-3 py-3 text-center">Status kuesioner</th>
                  <th className="px-3 py-3 text-center">Pre-test</th>
                  <th className="px-3 py-3 text-center">Post-test</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-center">Aktivitas</th>
                  <th className="px-3 py-3 text-center">Detail</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center">
                      <Users className="mx-auto h-10 w-10 text-theme-soft" aria-hidden />
                      <p className="mt-3 text-theme-muted">Tidak ada petugas yang cocok dengan filter.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((user) => {
                    const expanded = expandedUser === user.username
                    return (
                      <Fragment key={user.username}>
                        <tr className="border-b border-slate-100/80 transition-colors duration-200 hover:bg-health-50/40">
                          <td className="px-4 py-3">
                            <div className="flex items-start gap-2">
                              <div className="mt-0.5 rounded-lg bg-health-50 p-1.5">
                                <UserRound className="h-4 w-4 text-health-600" aria-hidden />
                              </div>
                              <div>
                                <p className="font-semibold text-theme">{user.username}</p>
                                {user.display_name ? <p className="text-xs text-theme-muted">{user.display_name}</p> : null}
                                {user.puskesmas_nama ? (
                                  <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-theme-soft">
                                    <MapPin className="h-3 w-3" aria-hidden />
                                    {user.puskesmas_nama}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="mx-auto max-w-[140px] text-center">
                              <p className="text-xs font-medium text-theme-muted">
                                {user.video_completed}/{REQUIRED_VIDEOS} selesai
                              </p>
                              <div className="mt-1.5">
                                <ProgressBar value={user.video_progress_pct} tone="video" />
                              </div>
                              <p className="mt-1 text-xs font-semibold tabular-nums text-theme">{user.video_progress_pct}%</p>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            {user.triage_completed ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                    {user.triage_session_count}×
                                  </span>
                                </div>
                                <p className="text-[10px] text-theme-soft">
                                  Pertama: <span className="font-semibold tabular-nums text-theme">{user.triage_first_score ?? '-'}</span> poin
                                  {user.triage_first_correct != null && user.triage_first_total
                                    ? ` · ${user.triage_first_correct}/${user.triage_first_total}`
                                    : ''}
                                </p>
                                {user.triage_best_score != null ? (
                                  <p className="text-[10px] text-amber-600">
                                    Terbaik: <span className="font-semibold tabular-nums text-theme">{user.triage_best_score}</span> poin
                                  </p>
                                ) : null}
                                <p className="text-[10px] text-theme-muted">
                                  Terakhir: <span className="font-semibold tabular-nums text-theme">{user.triage_last_score ?? '-'}</span> poin
                                  {user.triage_last_correct != null && user.triage_last_total
                                    ? ` · ${user.triage_last_correct}/${user.triage_last_total}`
                                    : ''}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                                Belum
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="space-y-1">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${waStatusBadge(user.wa_status)}`}>
                                {waStatusLabel(user.wa_status)}
                              </span>
                              <p className="text-[10px] font-medium tabular-nums text-theme-muted">{user.wa_chat_count} chat</p>
                              {user.wa_chat_count > 0 ? (
                                <button
                                  type="button"
                                  onClick={() => setChatUser(user)}
                                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-semibold text-health-700 underline-offset-2 hover:underline focus-ring"
                                >
                                  Lihat chat
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${kuisStatusBadge(user.kuis_status ?? 'belum')}`}>
                              {kuisStatusLabel(user.kuis_status ?? 'belum')}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <KuisAttemptSnapshot
                              mode="pre"
                              pg={user.kuis_pre_pengetahuan_score}
                              ed={user.kuis_pre_efikasi_score}
                              sk={user.kuis_pre_sikap_score}
                              td={user.kuis_pre_tindakan_score}
                              submittedAt={user.kuis_pre_submitted_at}
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            <KuisAttemptSnapshot
                              mode="post"
                              pg={user.kuis_post_pengetahuan_score}
                              ed={user.kuis_post_efikasi_score}
                              sk={user.kuis_post_sikap_score}
                              td={user.kuis_post_tindakan_score}
                              submittedAt={user.kuis_post_submitted_at}
                            />
                          </td>
                          <td className="px-3 py-3 text-center">
                            {user.is_working ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200/80">
                                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                                Memenuhi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200/80">
                                <XCircle className="h-3.5 w-3.5" aria-hidden />
                                Belum
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center text-xs text-theme-muted">{formatRelativeTime(user.last_activity_at)}</td>
                          <td className="px-3 py-3 text-center">
                            <button
                              type="button"
                              onClick={() => setExpandedUser(expanded ? null : user.username)}
                              className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--panel-border)] bg-white/90 px-3 py-1.5 text-xs font-medium text-health-700 transition duration-200 hover:bg-health-50 focus-ring"
                            >
                              {expanded ? (
                                <>
                                  Tutup
                                  <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                                </>
                              ) : (
                                <>
                                  Lihat
                                  <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                                </>
                              )}
                            </button>
                          </td>
                        </tr>
                        {expanded ? (
                          <tr key={`${user.username}-detail`}>
                            <td colSpan={11} className="p-0">
                              <UserDetailPanel user={user} onViewChats={setChatUser} />
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="glass-panel mt-4 rounded-2xl border border-[var(--panel-border)] p-5">
          <div className="mb-3 flex items-center gap-2 font-semibold text-theme">
            <BarChart3 className="h-4 w-4 text-health-600" aria-hidden />
            Kriteria &amp; keterangan
          </div>
            <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-5">
            <div>
              <p className="font-medium text-cta-700">Status Memenuhi</p>
              <ul className="mt-2 space-y-1 text-theme-muted">
                <li>Minimal 2 video ML selesai</li>
                <li>Sudah mengisi kuesioner gempa minimal 1 kali</li>
                <li>Latihan triase START selesai minimal 1 sesi</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-violet-700">Kuesioner (submisi terakhir)</p>
              <ul className="mt-2 space-y-1 text-theme-muted">
                <li>
                  <strong>Pre-test:</strong> efikasi &amp; tindakan Likert 1–4 (poin = 5−jawaban, maks 60)
                </li>
                <li>
                  <strong>Post-test:</strong> efikasi, sikap, tindakan Likert SS–STS (5 poin, maks 75)
                </li>
                <li>
                  <strong>Pengetahuan:</strong> Baik ≥76%, Cukup 56–75%, Kurang &lt;56%
                </li>
                <li>
                  <strong>Efikasi diri:</strong> raw → skala 10–40 · Tinggi 30–40, Sedang 20–29, Rendah 10–19
                </li>
                <li>
                  <strong>Sikap:</strong> Baik ≥76%, Cukup 56–75%, Kurang &lt;56%
                </li>
                <li>
                  <strong>Tindakan:</strong> (Σ poin / maks raw)×100% · Baik ≥50%, Buruk &lt;50%
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-amber-700">Latihan Triase</p>
              <ul className="mt-2 space-y-1 text-theme-muted">
                <li>Sesi START dengan status selesai</li>
                <li>Poin, jumlah benar, dan streak tampil di detail</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-emerald-700">WhatsApp</p>
              <ul className="mt-2 space-y-1 text-theme-muted">
                <li>
                  <strong>Terhubung:</strong> nomor tertaut + 1 chat + 1 balasan
                </li>
                <li>
                  <strong>Pernah:</strong> sudah chat, nomor sudah tidak tertaut
                </li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-health-700">Data real-time</p>
              <ul className="mt-2 space-y-1 text-theme-muted">
                <li>Sumber: sesi ML, kuesioner, triase, WA</li>
                <li>Hanya akun petugas (role staff), bukan admin/kapus</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
      {chatUser ? (
        <WaChatModal username={chatUser.username} displayName={chatUser.display_name} onClose={() => setChatUser(null)} />
      ) : null}
    </div>
  )
}
