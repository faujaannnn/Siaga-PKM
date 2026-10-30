import {
  ArrowLeft,
  BookOpen,
  Brain,
  HeartPulse,
  Home,
  LogOut,
  MessageCircle,
  PlayCircle,
  Route,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { fetchLipiEligibility, fetchStaffEducation, fetchStaffMlUnderstanding } from '../api/client'
import type { LipiEligibility } from '../api/client'
import { EducationFeed } from '../components/EducationFeed'
import { HomeOnboardingOverlay } from '../components/HomeOnboardingOverlay'
import { KembangkanPengetahuanPanel } from '../components/ml/KembangkanPengetahuanPanel'
import { WaStaffMagicLinkForm } from '../components/WaStaffMagicLinkForm'
import {
  EDUCATION_CATEGORY_IDS,
  EDUCATION_CATEGORY_LABELS,
  easeOutExpo,
} from '@dr-diah/siaga-frontend-core'
import { useAuth } from '../context/AuthContext'
import type {
  EducationCategory,
  EducationItem,
  MlAssessmentSummary,
  MlStaffUnderstandingRow,
  MlVideoCategory,
} from '../types'

const EDU_CATEGORY_CHIPS: { param: string | null; label: string }[] = [
  { param: null, label: 'Semua' },
  ...EDUCATION_CATEGORY_IDS.map((id) => ({
    param: id,
    label: EDUCATION_CATEGORY_LABELS[id],
  })),
]

type StaffTab = 'materi' | 'profil' | 'wa'

function formatWatchSeconds(s: number): string {
  if (!s || s < 0) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function categoryLabel(c: MlVideoCategory): string {
  return c === 'belajar_plus' ? 'Belajar ++' : 'Asesmen AI'
}

function levelClass(level: string): string {
  const t = (level || '').toLowerCase()
  if (t.includes('tinggi')) {
    return 'bg-emerald-100 text-emerald-900 ring-emerald-200'
  }
  if (t.includes('rendah')) {
    return 'bg-rose-100 text-rose-900 ring-rose-200'
  }
  return 'bg-amber-100 text-amber-900 ring-amber-200'
}

function quizCorrectPctFromAssessment(a: MlAssessmentSummary): number | null {
  const pa = a.per_answer
  if (!pa?.length) return null
  let s = 0
  for (const g of pa) {
    const p = g.p_correct != null ? g.p_correct : g.correctness_score
    if (typeof p !== 'number' || Number.isNaN(p)) return null
    s += Math.max(0, Math.min(1, p))
  }
  return Math.round((s / pa.length) * 100)
}

/** Tingkat pengetahuan terbaru per topik atau per materi untuk ringkas profil. */
function pemahamanStatsFromRows(rows: MlStaffUnderstandingRow[]) {
  const seen = new Set<string>()
  const out: { key: string; label: string; levelLabel: string; pgPct: number | null }[] = []
  for (const row of rows) {
    const a = row.assessment
    if (!a) continue
    const slug = (a.disaster_slug || '').trim()
    const dlab = (a.disaster_label || '').trim()
    let key: string
    let label: string
    if (slug || (dlab && dlab !== 'Materi standar')) {
      key = slug || dlab
      label = dlab || slug.replace(/_/g, ' ') || 'Materi'
    } else {
      const prefix = row.source === 'pdf' ? 'pdf' : 'video'
      key = `${prefix}:${row.video_id}`
      label = row.video_title.trim() || (row.source === 'pdf' ? 'Buku' : 'Video')
    }
    if (seen.has(key)) continue
    seen.add(key)
    const short = label.length > 48 ? `${label.slice(0, 45)}…` : label
    const lvl = (row.knowledge_level || '').trim() || '-'
    out.push({
      key,
      label: short,
      levelLabel: lvl,
      pgPct: quizCorrectPctFromAssessment(a),
    })
  }
  out.sort((x, y) => x.label.localeCompare(y.label, 'id', { sensitivity: 'base' }))
  return out
}

function chipClass(active: boolean) {
  return `cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition duration-200 focus-ring ${
    active
      ? 'bg-merah text-white shadow-sm'
      : 'border border-slate-200 bg-white text-theme-muted hover:border-health-500/40'
  }`
}

export function StaffPage() {
  const { token, me, ready, logout, refreshMe } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryParam = searchParams.get('kategori')
  const activeCategoryFilter =
    categoryParam && EDU_CATEGORY_CHIPS.some((c) => c.param === categoryParam)
      ? (categoryParam as EducationCategory)
      : null
  const [eduItems, setEduItems] = useState<EducationItem[]>([])
  const [eduErr, setEduErr] = useState<string | null>(null)
  const [tab, setTab] = useState<StaffTab>('materi')
  const [profilRows, setProfilRows] = useState<MlStaffUnderstandingRow[]>([])
  const [profilErr, setProfilErr] = useState<string | null>(null)
  const [profilLoading, setProfilLoading] = useState(false)
  const [lipiEligibility, setLipiEligibility] = useState<LipiEligibility | null>(null)
  const [guideOpen, setGuideOpen] = useState(true)

  const profilPemahamanStats = useMemo(() => pemahamanStatsFromRows(profilRows), [profilRows])

  const kuisCardStyle = useMemo(() => {
    const status = lipiEligibility?.kuis_status ?? 'belum'
    if (status === 'lengkap') {
      return {
        shell: 'from-emerald-50/95 via-white to-emerald-50/40 dark:from-emerald-950/25 dark:via-cosmic-900/45 dark:to-emerald-900/15',
        icon: 'bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-200',
        label: 'text-emerald-800 dark:text-emerald-300',
        btn: 'border-emerald-400/55 bg-emerald-500/12 text-emerald-950 hover:border-emerald-400/80 hover:bg-emerald-500/18 dark:border-emerald-500/40 dark:bg-emerald-900/25 dark:text-emerald-100',
        hint: 'Pre-test & post-test selesai',
        cta: 'Lihat hasil',
      }
    }
    if (status === 'post_menunggu') {
      return {
        shell: 'from-rose-50/95 via-white to-rose-50/40 dark:from-rose-950/25 dark:via-cosmic-900/45 dark:to-rose-900/15',
        icon: 'bg-rose-500/15 text-rose-800 ring-rose-500/35 dark:text-rose-200',
        label: 'text-rose-800 dark:text-rose-300',
        btn: 'border-rose-400/60 bg-rose-500/12 text-rose-950 hover:border-rose-400/85 hover:bg-rose-500/18 dark:border-rose-500/45 dark:bg-rose-900/25 dark:text-rose-100',
        hint: 'Pre-test selesai · isi post-test sekarang',
        cta: 'Mulai post-test',
      }
    }
    return {
      shell: 'from-amber-50/95 via-white to-merah/[0.08] dark:from-amber-950/25 dark:via-cosmic-900/45 dark:to-merah/12',
      icon: 'bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-200',
      label: 'text-amber-800 dark:text-amber-300',
      btn: 'border-amber-400/55 bg-amber-500/12 text-amber-950 hover:border-amber-400/80 hover:bg-amber-500/18 dark:border-amber-500/40 dark:bg-amber-900/25 dark:text-amber-100',
      hint: 'Mulai dengan pre-test',
      cta: 'Mulai pre-test',
    }
  }, [lipiEligibility])

  const isStaff = me?.role === 'staff'
  const showWaTab = isStaff

  useEffect(() => {
    if (!showWaTab && tab === 'wa') {
      setTab('materi')
    }
  }, [showWaTab, tab])

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t === 'wa' && showWaTab) setTab('wa')
    else if (t === 'profil') setTab('profil')
    else if (t === 'materi') setTab('materi')
  }, [searchParams, showWaTab])

  const filteredEduItems = useMemo(() => {
    if (!activeCategoryFilter) return eduItems
    return eduItems.filter((item) => item.category === activeCategoryFilter)
  }, [eduItems, activeCategoryFilter])

  useEffect(() => {
    if (!token || !isStaff) return
    let cancelled = false
    void fetchLipiEligibility()
      .then((data) => {
        if (!cancelled) setLipiEligibility(data)
      })
      .catch(() => {
        if (!cancelled) setLipiEligibility(null)
      })
    return () => {
      cancelled = true
    }
  }, [token, isStaff])

  useEffect(() => {
    if (!token) return
    let cancelled = false
    setEduErr(null)
    void fetchStaffEducation()
      .then((data) => {
        if (!cancelled) setEduItems(data)
      })
      .catch(() => {
        if (!cancelled) setEduErr('Gagal memuat bahan bacaan.')
      })
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!token || tab !== 'wa' || !showWaTab) return
    void refreshMe()
  }, [token, tab, showWaTab, refreshMe])

  useEffect(() => {
    if (!token || tab !== 'profil') return
    let c = false
    setProfilLoading(true)
    setProfilErr(null)
    void fetchStaffMlUnderstanding()
      .then((d) => {
        if (!c) setProfilRows(d)
      })
      .catch(() => {
        if (!c) setProfilErr('Gagal memuat laporan asesmen video. Coba lagi.')
      })
      .finally(() => {
        if (!c) setProfilLoading(false)
      })
    return () => {
      c = true
    }
  }, [token, tab])

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-theme-muted">Memuat…</div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!me) {
    return (
      <div className="flex min-h-svh items-center justify-center text-theme-muted">Memuat sesi…</div>
    )
  }

  if (me.role === 'developer') {
    return <Navigate to="/developer" replace />
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-10">
      <HomeOnboardingOverlay open={guideOpen} onClose={() => setGuideOpen(false)} />
      <a className="skip-to-content" href="#staff-main">
        Lewati ke isi
      </a>
      <main className="mx-auto flex max-w-2xl flex-col gap-8 outline-none" id="staff-main" tabIndex={-1}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: easeOutExpo }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Link
            to="/"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-theme-muted transition duration-200 hover:text-theme focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Beranda
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {me.role === 'admin' ? (
              <Link
                to="/admin"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm font-medium text-emerald-800 transition duration-200 focus-ring hover:bg-emerald-500/10"
              >
                <Shield className="h-4 w-4" aria-hidden />
                Admin
              </Link>
            ) : null}
            <Link
              to="/"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm text-theme-muted transition duration-200 focus-ring hover:text-theme"
            >
              <Home className="h-4 w-4" aria-hidden />
              Situs
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-800 transition duration-200 focus-ring hover:bg-rose-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Keluar
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo, delay: 0.04 }}
          className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-health-600">Ruang petugas</p>
          <h1 className="mt-2 text-2xl font-bold text-theme md:text-3xl">
            {me.display_name?.trim() ? `Halo, ${me.display_name.trim()}` : 'Materi, profil, dan login WhatsApp'}
          </h1>
          {me.display_name?.trim() ? (
            <p className="mt-2 text-sm text-theme-muted">
              Username login: <span className="font-medium text-theme">{me.username}</span>
              {me.research_wilayah ? (
                <>
                  {' '}
                  · Wilayah: <span className="font-medium text-theme">{me.research_wilayah}</span>
                </>
              ) : null}
            </p>
          ) : null}
        </motion.div>

        <div className="space-y-2">
          <div className="md:hidden">
            <label htmlFor="staff-tab" className="mb-1 block text-xs font-medium text-theme-muted">
              Bagian ruang masyarakat
            </label>
            <select
              id="staff-tab"
              className="focus-ring w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-sm font-medium text-theme"
              value={tab}
              onChange={(e) => setTab(e.target.value as StaffTab)}
            >
              <option value="materi">Materi petugas</option>
              <option value="profil">Profil - pemahaman video</option>
              {showWaTab ? <option value="wa">WhatsApp</option> : null}
            </select>
          </div>
          <div
            className={`hidden gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1 md:grid ${
              showWaTab ? 'md:grid-cols-3' : 'md:grid-cols-2'
            }`}
          >
            <button
              type="button"
              onClick={() => setTab('materi')}
              className={`flex w-full min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-ring ${
                tab === 'materi' ? 'bg-merah/15 text-theme ring-1 ring-merah/25' : 'text-theme-muted hover:text-theme'
              }`}
            >
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-center leading-tight">Materi petugas</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('profil')}
              className={`flex w-full min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-ring ${
                tab === 'profil' ? 'bg-merah/15 text-theme ring-1 ring-merah/25' : 'text-theme-muted hover:text-theme'
              }`}
            >
              <User className="h-4 w-4 shrink-0" aria-hidden />
              <span className="text-center leading-tight">Profil - video</span>
            </button>
            {showWaTab ? (
              <button
                type="button"
                onClick={() => setTab('wa')}
                className={`flex w-full min-h-[3.25rem] cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition focus-ring ${
                  tab === 'wa' ? 'bg-merah/15 text-theme ring-1 ring-merah/25' : 'text-theme-muted hover:text-theme'
                }`}
              >
                <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
                <span className="text-center leading-tight">WhatsApp</span>
              </button>
            ) : null}
          </div>
        </div>

        {tab === 'materi' ? (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: easeOutExpo }}
              className={`overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-gradient-to-r p-5 shadow-sm md:p-6 ${kuisCardStyle.shell}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${kuisCardStyle.icon}`}
                    aria-hidden
                  >
                    <ShieldCheck className="h-6 w-6" strokeWidth={1.85} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className={`text-xs font-semibold uppercase tracking-wider ${kuisCardStyle.label}`}>
                      Kuesioner Gempa
                    </p>
                    <p className="text-sm font-semibold leading-snug text-theme md:text-base">
                      Kesiapsiagaan gempa untuk staf puskesmas
                    </p>
                    <p className="text-sm leading-relaxed text-theme-muted">
                      Efikasi diri, pengetahuan, sikap (HBM-TPB), dan tindakan — pre-test lalu post-test.
                    </p>
                    <p className={`text-xs font-medium ${kuisCardStyle.label}`}>{kuisCardStyle.hint}</p>
                  </div>
                </div>
                <Link
                  to="/petugas/kuis-lipi"
                  className={`inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border-2 px-5 text-sm font-semibold shadow-sm transition focus-ring sm:w-auto ${kuisCardStyle.btn}`}
                >
                  {kuisCardStyle.cta}
                  <ShieldCheck className="h-4 w-4 opacity-90" aria-hidden />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: easeOutExpo }}
              className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-gradient-to-r from-sky-50/90 via-white to-cyan-500/[0.06] p-5 shadow-sm dark:from-sky-950/30 dark:via-cosmic-900/45 dark:to-cyan-900/15 md:p-6"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 gap-3">
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-800 ring-1 ring-sky-500/25 dark:text-sky-200"
                    aria-hidden
                  >
                    <Route className="h-6 w-6" strokeWidth={1.85} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-300">
                      Simulasi di peta
                    </p>
                    <p className="text-sm font-semibold leading-snug text-theme md:text-base">
                      Perkiraan jalur ke titik evakuasi wilayah penelitian
                    </p>
                    <p className="text-sm leading-relaxed text-theme-muted">
                      Pakai lokasi Anda pada peta (OSM/OSRM); admin mengisi titik tujuan. Bukan rute darurat pemerintah.
                    </p>
                  </div>
                </div>
                <Link
                  to="/petugas/simulasi-evakuasi"
                  className="inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-sky-500/45 bg-sky-500/10 px-5 text-sm font-semibold text-sky-900 shadow-sm transition hover:border-sky-500/70 hover:bg-sky-500/15 focus-ring dark:border-sky-400/40 dark:bg-sky-950/30 dark:text-sky-100 sm:w-auto"
                >
                  Buka simulasi
                  <Route className="h-4 w-4 opacity-90" aria-hidden />
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.34, ease: easeOutExpo }}
              className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-gradient-to-br from-cyan-50/95 via-white to-merah/[0.06] shadow-sm ring-1 ring-health-500/10 dark:from-cyan-950/25 dark:via-cosmic-900/45 dark:to-merah/12"
            >
              <div className="relative p-5 md:p-7">
                <div
                  className="pointer-events-none absolute -right-20 top-0 h-44 w-44 rounded-full bg-gradient-to-br from-health-500/12 to-cyan-400/10 blur-3xl dark:from-health-500/18 dark:to-cyan-500/10"
                  aria-hidden
                />
                <div className="relative flex flex-col gap-6 lg:flex-row lg:items-stretch lg:gap-8">
                  <div className="min-w-0 flex-1 space-y-5">
                    <div className="flex gap-4">
                      <div
                        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-health-500/30 to-merah/25 text-merah shadow-inner ring-1 ring-health-500/25 dark:ring-health-500/20"
                        aria-hidden
                      >
                        <Brain className="h-7 w-7" strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-xs font-semibold uppercase tracking-wider text-health-800 dark:text-health-300">
                          Video &amp; asesmen
                        </p>
                        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold leading-tight text-theme md:text-2xl">
                          Tonton video, kerjakan kuis, terima ringkasan
                        </h2>
                        <p className="max-w-prose text-sm leading-relaxed text-theme-muted md:text-base">
                          Di ruang masyarakat: putar video YouTube, kerjakan kuis pilihan ganda tiap langkah, lalu lihat{' '}
                          <span className="font-medium text-theme">ringkasan tingkat pengetahuan</span> ketika selesai.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full shrink-0 flex-col gap-3 lg:w-[min(100%,288px)] lg:border-l lg:border-[var(--panel-border)] lg:pl-8">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted lg:text-center">
                      Modul belajar (masyarakat)
                    </p>
                    <Link
                      to="/petugas/video-ml"
                      className="inline-flex min-h-[3.25rem] w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-5 text-base font-semibold text-white shadow-md shadow-merah/25 transition duration-200 hover:brightness-105 focus-ring"
                    >
                      <PlayCircle className="h-5 w-5 opacity-95" aria-hidden />
                      Video
                    </Link>
                    <Link
                      to="/petugas/latihan-triase"
                      className="inline-flex min-h-[3.25rem] w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-health-500/45 bg-[var(--panel-bg)] px-5 text-base font-semibold text-theme shadow-sm transition duration-200 hover:border-health-500/70 hover:bg-health-500/[0.06] focus-ring dark:border-health-500/35 dark:hover:bg-health-500/10"
                    >
                      <HeartPulse className="h-5 w-5 text-health-700 dark:text-health-300" aria-hidden />
                      Latihan Triase
                    </Link>
                    <p className="text-center text-xs leading-relaxed text-theme-muted lg:px-1">
                      Triase: kasus acak, pilih kategori HIJAU/KUNING/MERAH/HITAM - skor kecepatan &amp; streak.
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="space-y-4">
              <p className="text-sm font-semibold text-theme md:text-base">Bahan Bacaan</p>
              <div className="sticky top-16 z-20 -mx-1 space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/95 p-3 shadow-sm backdrop-blur-md md:static md:mx-0 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none">
                <p className="text-xs font-medium text-theme-muted md:sr-only">Kategori</p>
                <div className="md:hidden">
                  <label htmlFor="edu-category" className="sr-only">
                    Pilih kategori
                  </label>
                  <select
                    id="edu-category"
                    className="focus-ring w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-sm font-medium text-theme"
                    value={activeCategoryFilter ?? ''}
                    onChange={(e) => {
                      const v = e.target.value
                      if (v === '') {
                        searchParams.delete('kategori')
                        searchParams.delete('jenis')
                        setSearchParams(searchParams, { replace: true })
                      } else {
                        searchParams.delete('jenis')
                        setSearchParams({ kategori: v }, { replace: true })
                      }
                    }}
                  >
                    {EDU_CATEGORY_CHIPS.map((c) => (
                      <option key={c.label} value={c.param ?? ''}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="hidden min-h-12 flex-wrap gap-2 md:flex">
                  {EDU_CATEGORY_CHIPS.map((chip) => {
                    const isActive =
                      chip.param === null
                        ? !activeCategoryFilter
                        : activeCategoryFilter === (chip.param as EducationCategory)
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        className={chipClass(isActive)}
                        onClick={() => {
                          if (chip.param === null) {
                            searchParams.delete('kategori')
                            searchParams.delete('jenis')
                            setSearchParams(searchParams, { replace: true })
                          } else {
                            setSearchParams({ kategori: chip.param }, { replace: true })
                          }
                        }}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              {eduErr ? (
                <p className="text-sm text-rose-700">{eduErr}</p>
              ) : (
                <EducationFeed
                  items={filteredEduItems}
                  emptyLabel="Belum ada konten untuk kategori ini. Admin dapat menambah di Admin → Edukasi (audiens Masyarakat)."
                />
              )}
            </div>
          </div>
        ) : null}

        {tab === 'wa' && showWaTab ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easeOutExpo }}
            className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-cta-600">WhatsApp</p>
            <p className="mt-1 text-sm text-theme-muted">
              Hubungkan nomor WhatsApp ke akun Anda untuk verifikasi dan asisten chat. Untuk login tanpa password di
              perangkat lain, gunakan alur yang sama di halaman{' '}
              <Link to="/login" className="font-medium text-merah-bright underline-offset-2 hover:underline">
                Login
              </Link>
              ).
            </p>
            <div className="my-6 flex items-center gap-3 text-zinc-400" role="separator">
              <div className="h-px flex-1 bg-[var(--panel-border)]" />
            </div>
            <WaStaffMagicLinkForm
              variant="staff"
              idSuffix="staff"
              defaultUsername={me.username}
              onSuccess={() => void refreshMe()}
            />
          </motion.div>
        ) : null}

        {tab === 'profil' ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: easeOutExpo }}
            className="space-y-4"
          >
            <p className="text-sm text-theme-muted">
              Ringkasan asesmen pilihan ganda (video atau buku). Tab ini menampilkan tingkat pengetahuan dan skor PG.{' '}
              <Link
                to="/petugas/video-ml"
                className="font-medium text-merah-bright underline-offset-2 hover:underline"
              >
                Buka daftar video
              </Link>
            </p>
            {!profilLoading && !profilErr && profilPemahamanStats.length > 0 ? (
              <div
                className="glass-panel space-y-3 border border-[var(--panel-border)] bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-merah/[0.06] p-4 md:p-5"
                role="region"
                aria-label="Ringkasan tingkat pengetahuan per materi"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-health-800">Ringkas per materi</p>
                  <p className="mt-1 text-sm text-theme-muted">
                    Satu kartu untuk tiap topik atau video (menggunakan asesmen PG terbaru). Angka kedua ialah persentase
                    jawaban PG benar dalam sesi itu.
                  </p>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {profilPemahamanStats.map((s) => (
                    <li
                      key={s.key}
                      className="flex flex-col rounded-2xl border border-health-500/20 bg-white/70 px-4 py-3 shadow-sm ring-1 ring-health-500/10 dark:bg-zinc-900/50"
                    >
                      <span className="text-sm font-semibold leading-snug text-theme">{s.label}</span>
                      <span className="mt-2 text-2xl font-bold capitalize leading-tight text-theme">{s.levelLabel}</span>
                      {s.pgPct != null ? (
                        <span className="mt-1 text-sm text-theme-muted">
                          Skor PG: <strong className="tabular-nums text-theme">{s.pgPct}%</strong>
                        </span>
                      ) : (
                        <span className="mt-1 text-xs text-theme-muted">Skor PG belum tercatat di ringkasan.</span>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="text-xs leading-relaxed text-theme-muted">
                  Topik berasal dari pengaturan modul di Admin; jika kosong kartu menggunakan judul materi Anda.
                </p>
              </div>
            ) : null}
            {!profilLoading && !profilErr && profilRows.length > 0 && profilPemahamanStats.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-bg)]/80 px-4 py-3 text-sm text-theme-muted">
                Belum ada ringkasan tingkat pengetahuan yang bisa dikelompokkan. Selesaikan kuis sampai laporan utama
                tampil, lalu kembali ke sini.
              </p>
            ) : null}
            {profilLoading ? (
              <p className="text-sm text-theme-muted">Memuat laporan…</p>
            ) : profilErr ? (
              <p className="text-sm text-rose-700">{profilErr}</p>
            ) : profilRows.length === 0 ? (
              <div className="glass-panel border border-dashed border-[var(--panel-border)] p-8 text-center text-sm text-theme-muted">
                Belum ada asesmen yang selesai. Selesaikan alur video, lalu kembali ke halaman ini.
              </div>
            ) : (
              <ul className="space-y-4">
                {profilRows.map((row) => (
                  <li
                    key={row.session_id}
                    className="glass-panel space-y-3 border border-[var(--panel-border)] p-4 md:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold text-theme">{row.video_title}</p>
                        <p className="mt-0.5 text-xs text-theme-muted">
                          {row.completed_at ? `Selesai: ${row.completed_at.replace('T', ' ')
                            .replace('Z', ' UTC')}` : ''}
                          {row.completed_at ? ' · ' : ''}
                          {row.source === 'pdf' ? 'Baca' : 'Tonton'} ~{formatWatchSeconds(row.seconds_watched)}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-900 ring-1 ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-500/30">
                          {row.source === 'pdf' ? 'Buku' : 'Video'}
                        </span>
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800 ring-1 ring-zinc-200">
                          {categoryLabel(row.category)}
                        </span>
                        {(() => {
                          const pgPct = row.assessment ? quizCorrectPctFromAssessment(row.assessment) : null
                          return (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${levelClass(row.knowledge_level)}`}
                        >
                          Pengetahuan: {row.knowledge_level.trim() ? row.knowledge_level : '-'}
                          {pgPct != null ? ` · PG ${pgPct}%` : ''}
                        </span>
                          )
                        })()}
                      </div>
                    </div>
                    {row.assessment ? (
                      <div className="space-y-2 rounded-lg border border-health-500/20 bg-cyan-500/[0.05] p-3 text-sm">
                        <p className="leading-relaxed text-theme-muted">
                          <span className="font-medium text-theme/90">Saran remedial ringkas: </span>
                          {row.assessment.recommendation}
                        </p>
                      </div>
                    ) : null}
                    {row.assessment != null ||
                    row.report.trim().length > 0 ||
                    row.remedial_items.length > 0 ? (
                      <KembangkanPengetahuanPanel
                        isPlus={row.category === 'belajar_plus'}
                        videoTitle={row.video_title}
                        youtubeId={row.source === 'pdf' ? '' : row.youtube_id}
                        videoPageLink={`/petugas/video-ml/${encodeURIComponent(row.video_id)}`}
                        assessment={row.assessment}
                        remedialItems={row.remedial_items}
                        narrativeReport={row.report}
                        sessionId={row.session_id}
                        allowUserRewrite={false}
                      />
                    ) : null}
                    {row.report ? (
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-theme-muted">{row.report}</div>
                    ) : (
                      <p className="text-sm text-theme-muted">Tidak ada teks laporan tersimpan.</p>
                    )}
                    {row.source !== 'pdf' ? (
                      <div className="pt-1">
                        <Link
                          to={`/petugas/video-ml/${encodeURIComponent(row.video_id)}`}
                          className="text-sm font-medium text-merah-bright underline-offset-2 hover:underline"
                        >
                          Buka video ini lagi
                        </Link>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ) : null}
      </main>
    </div>
  )
}
