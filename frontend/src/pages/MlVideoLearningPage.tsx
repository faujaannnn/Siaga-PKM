import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, FileText, LayoutList, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'

import { fetchMlSessionCompletion, patchMlWatch, postMlQuizAnswer, startMlQuiz, startMlSession } from '../api/client'
import { KembangkanPengetahuanPanel } from '../components/ml/KembangkanPengetahuanPanel'
import type { MlAssessmentSummary, MlRemedialItem, MlVideoCategory } from '../types'

const REFLECT_LS = 'kembangkan-pengetahuan:'
/** Minimal fraksi durasi sebelum asesmen bisa dibuka - jangan sebut angka ke pengguna. */
const ML_MIN_WATCH_FOR_QUIZ_RATIO = 0.7
import { useTheme } from '../context/ThemeContext'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

type YtPlayer = {
  getCurrentTime: () => number
  getDuration: () => number
  seekTo: (seconds: number, allowSeekAhead: boolean) => void
  playVideo: () => void
  destroy: () => void
}

type YtGlobal = {
  Player: new (id: string | HTMLElement, opts: Record<string, unknown>) => YtPlayer
}

declare global {
  interface Window {
    YT?: YtGlobal
    onYouTubeIframeAPIReady?: (() => void) | null
  }
}

function loadYoutubeIframeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    const done = () => resolve()
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') {
        try {
          prev()
        } catch {
          /* */
        }
      }
      done()
    }
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const s = document.createElement('script')
      s.src = 'https://www.youtube.com/iframe_api'
      s.async = true
      document.body.appendChild(s)
    }
  })
}

type Phase = 'load' | 'video' | 'quiz' | 'score_options' | 'kembangkan' | 'done' | 'error'

type KembangkanPath = 'skipped' | 'completed' | null

function quizCorrectPercent(assessment: MlAssessmentSummary | null): number | null {
  const pa = assessment?.per_answer
  if (!pa?.length) return null
  let s = 0
  for (const g of pa) {
    const p = g.p_correct != null ? g.p_correct : g.correctness_score
    if (typeof p !== 'number' || Number.isNaN(p)) return null
    s += Math.max(0, Math.min(1, p))
  }
  return Math.round((s / pa.length) * 100)
}

function readApiDetail(e: unknown): string {
  if (axios.isAxiosError(e)) {
    if (e.code === 'ECONNABORTED') {
      return 'Koneksi ke server terlalu lama. Coba lagi.'
    }
    const d = e.response?.data
    if (d && typeof d === 'object' && d !== null && 'detail' in d) {
      const m = (d as { detail?: unknown }).detail
      if (typeof m === 'string' && m.trim()) return m.trim()
    }
    if (e.response?.status === 504) {
      return 'Permintaan ke server melebihi batas waktu. Coba lagi dalam beberapa saat.'
    }
  }
  return 'Gagal memuat video. Coba lagi sebentar lagi.'
}

export function RingkasanSkorStrip({
  assessment,
  level,
  secWatched,
  engagementLabel = 'tonton',
}: {
  assessment: MlAssessmentSummary | null
  level: string
  secWatched: number
  engagementLabel?: 'tonton' | 'baca'
}) {
  const pct = quizCorrectPercent(assessment)
  if (!assessment) {
    return (
      <p className="text-sm text-theme-muted">
        Tingkat pengetahuan: <strong className="text-theme">{level}</strong>
        {' · '}
        Estimasi {engagementLabel}: <strong className="text-theme">{Math.round(secWatched)} dtk</strong>
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-1 text-sm leading-relaxed text-theme md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2">
      <span>
        Tingkat pengetahuan: <strong className="capitalize text-theme">{level}</strong>
      </span>
      {pct != null ? (
        <span>
          Skor pilihan ganda: <strong className="tabular-nums">{pct}%</strong>
          <span className="text-theme-muted"> (proporsi benar)</span>
        </span>
      ) : null}
      <span className="text-theme-muted md:tabular-nums">±{Math.round(secWatched)} dtk {engagementLabel}</span>
    </div>
  )
}

type LaporanIsiProps = {
  assessment: MlAssessmentSummary | null
  report: string
  level: string
  secWatched: number
  detailsKeyPrefix: string
}

export function LaporanAsesmenIsi({ assessment, report, level, secWatched, detailsKeyPrefix }: LaporanIsiProps) {
  const pct = quizCorrectPercent(assessment)
  return (
    <>
      {assessment ? (
        <div className="mt-3 space-y-3 rounded-xl border border-health-500/20 bg-cyan-500/[0.06] p-4 text-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-health-800 dark:text-health-300">
            Ringkasan tingkat pengetahuan
          </p>
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
            <div>
              <p className="text-xs text-theme-muted">Tingkat pengetahuan (perkiraan gabungan)</p>
              <p className="text-2xl font-bold capitalize tracking-tight text-theme">{level}</p>
            </div>
            <div>
              <p className="text-xs text-theme-muted">Skor pilihan ganda</p>
              <p className="text-2xl font-bold tabular-nums text-theme">
                {pct != null ? `${pct}% benar` : '-'}
              </p>
              {pct != null ? (
                <p className="mt-1 text-xs text-theme-muted">Dari semua soal pilihan ganda pada sesi ini.</p>
              ) : null}
            </div>
          </div>
          {assessment.recommendation.trim() ? (
            <p className="text-theme-muted">
              <span className="font-medium text-theme">Saran singkat: </span>
              {assessment.recommendation}
            </p>
          ) : null}
          {assessment.per_answer && assessment.per_answer.length > 0 ? (
            <details className="group rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)]/50 p-3">
              <summary className="cursor-pointer text-sm font-medium text-theme outline-none">
                Detail umpan balik per soal (opsional)
              </summary>
              <ul className="mt-3 space-y-3 text-xs text-theme-muted">
                {assessment.per_answer.map((g) => (
                  <li
                    key={`${detailsKeyPrefix}-${g.question_id}`}
                    className="space-y-1.5 border-l-2 border-health-500/30 pl-3"
                  >
                    <p className="font-mono text-[11px] text-theme/80">{g.question_id}</p>
                    {g.rationale ? (
                      <p>
                        <span className="font-medium text-theme/90">Alasan: </span>
                        {g.rationale}
                      </p>
                    ) : null}
                    {g.expected_answer_summary ? (
                      <p>
                        <span className="font-medium text-theme/90">Opsi rujukan (kunci): </span>
                        {g.expected_answer_summary}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
      <p className="mt-2 text-sm text-theme-muted">
        Estimasi lama tonton (dari pemutar): <strong className="text-theme">{Math.round(secWatched)} dtk</strong>
        {' · '}
        Tingkat pengetahuan: <strong className="text-theme">{level}</strong>
      </p>
      <div className="prose prose-sm max-w-none text-sm whitespace-pre-wrap leading-relaxed text-theme">
        {report}
      </div>
    </>
  )
}

export function MlVideoLearningPage() {
  const { videoId } = useParams()
  const { theme } = useTheme()
  const day = theme === 'day'
  const field = `mt-1 w-full rounded-lg border px-3 py-2.5 text-sm text-theme transition duration-200 focus:outline-none focus:ring-[3px] ${
    day
      ? 'border-slate-200 bg-white focus:border-health-500/50 focus:ring-cyan-500/25'
      : 'border-white/15 bg-black/30 focus:border-cyan-400/40 focus:ring-cyan-400/22'
  }`

  const [phase, setPhase] = useState<Phase>('load')
  const [err, setErr] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [youtubeId, setYoutubeId] = useState('')
  const [category, setCategory] = useState<MlVideoCategory>('asesmen_ai')

  const [activeQuestion, setActiveQuestion] = useState<{
    id: string
    question: string
    choices?: string[]
  } | null>(null)
  const [pickedChoice, setPickedChoice] = useState<number | null>(null)
  const [answerText, setAnswerText] = useState('')
  const [currentStep, setCurrentStep] = useState(1)
  const [totalSteps, setTotalSteps] = useState(4)

  const [report, setReport] = useState('')
  const [level, setLevel] = useState('')
  const [secWatched, setSecWatched] = useState(0)
  const [assessment, setAssessment] = useState<MlAssessmentSummary | null>(null)
  const [remedialItems, setRemedialItems] = useState<MlRemedialItem[]>([])
  const [loadingQuiz, setLoadingQuiz] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [youtubeVideoDurationSec, setYoutubeVideoDurationSec] = useState(0)
  const [furthestWatchSec, setFurthestWatchSec] = useState(0)

  /** Setelah kuis: apakah pengguna melewati atau menyelesaikan modul kembangkan pengetahuan */
  const [kembangkanPath, setKembangkanPath] = useState<KembangkanPath>(null)
  const [reflectionByQuestionId, setReflectionByQuestionId] = useState<Record<string, string>>({})

  const playerRef = useRef<YtPlayer | null>(null)
  const maxSecRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const playerContainerId = useRef(`yt-ml-${Math.random().toString(36).slice(2, 9)}`).current

  const canOpenAssessment = useMemo(() => {
    const dur = youtubeVideoDurationSec
    if (dur <= 0) return false
    return furthestWatchSec + 0.35 >= dur * ML_MIN_WATCH_FOR_QUIZ_RATIO
  }, [youtubeVideoDurationSec, furthestWatchSec])

  useEffect(() => {
    setPickedChoice(null)
  }, [activeQuestion?.id])

  useEffect(() => {
    if (!sessionId) return
    if (!['done', 'score_options', 'kembangkan'].includes(phase)) return
    if (remedialItems.length > 0) return
    let cancelled = false
    void fetchMlSessionCompletion(sessionId)
      .then(({ remedial_items }) => {
        if (cancelled || !remedial_items.length) return
        setRemedialItems(remedial_items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [phase, sessionId, remedialItems.length])

  const start = useCallback(async () => {
    if (!videoId) return
    setErr(null)
    setPhase('load')
    try {
      const s = await startMlSession(videoId)
      setSessionId(s.id)
      setYoutubeId(s.video.youtube_id)
      setTitle(s.video.title)
      setDesc(s.video.description)
      setCategory(s.video.category ?? 'asesmen_ai')
      setRemedialItems([])
      setKembangkanPath(null)
      setReflectionByQuestionId({})
      setYoutubeVideoDurationSec(0)
      setFurthestWatchSec(0)
      setPhase('video')
    } catch {
      setErr('Tidak dapat memulai sesi. Periksa login dan ID video.')
      setPhase('error')
    }
  }, [videoId])

  useEffect(() => {
    void start()
  }, [start])

  useEffect(() => {
    if (phase !== 'done') return
    const t = window.setTimeout(() => {
      document.getElementById('laporan-asesmen-utama')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => clearTimeout(t)
  }, [phase])

  useEffect(() => {
    if (phase !== 'video' || !sessionId || !youtubeId) return
    let cancelled = false
    const sid = sessionId
    const yid = youtubeId

    const tick = () => {
      try {
        const p = playerRef.current
        if (!p) return
        let dur: number | undefined
        try {
          const d = p.getDuration()
          if (typeof d === 'number' && d > 0 && Number.isFinite(d)) {
            dur = d
            setYoutubeVideoDurationSec((prev) => (d > prev ? d : prev))
          }
        } catch {
          /* */
        }
        const t = p.getCurrentTime()
        if (t > maxSecRef.current) maxSecRef.current = t
        setFurthestWatchSec((prev) => Math.max(prev, maxSecRef.current))
        void patchMlWatch(sid, maxSecRef.current, dur)
      } catch {
        /* */
      }
    }

    void (async () => {
      try {
        await loadYoutubeIframeApi()
        if (cancelled || !window.YT?.Player) {
          setErr('Pemutar YouTube tidak tersedia. Muat ulang halaman.')
          return
        }
        playerRef.current = new window.YT.Player(playerContainerId, {
          width: '100%',
          height: '100%',
          videoId: yid,
          playerVars: { rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              if (cancelled) return
              maxSecRef.current = 0
              setFurthestWatchSec(0)
              try {
                const p = playerRef.current
                if (p) {
                  const d = p.getDuration()
                  if (typeof d === 'number' && d > 0 && Number.isFinite(d)) {
                    setYoutubeVideoDurationSec(d)
                  }
                }
              } catch {
                /* */
              }
              tickRef.current = setInterval(tick, 2500)
            },
          },
        })
      } catch {
        if (!cancelled) setErr('Gagal memuat pemutar video.')
      }
    })()

    return () => {
      cancelled = true
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      try {
        playerRef.current?.destroy()
      } catch {
        /* */
      }
      playerRef.current = null
    }
  }, [phase, sessionId, youtubeId, playerContainerId])

  async function goQuiz() {
    if (!sessionId) return
    const dur = youtubeVideoDurationSec
    if (dur > 0 && maxSecRef.current + 0.25 < dur * ML_MIN_WATCH_FOR_QUIZ_RATIO) {
      setErr('Silakan nonton video sampai habis agar asesmen dibuka.')
      return
    }
    setLoadingQuiz(true)
    setErr(null)
    try {
      if (maxSecRef.current > 0) {
        await patchMlWatch(sessionId, maxSecRef.current, dur > 0 ? dur : undefined)
        setSecWatched(maxSecRef.current)
      }
      const q = await startMlQuiz(sessionId)
      if (!q.question) {
        setErr('Pertanyaan tidak ditemukan. Coba ulang.')
        return
      }
      setActiveQuestion(q.question)
      setCurrentStep(q.current_step)
      setTotalSteps(q.total_steps)
      setAnswerText('')
      setPickedChoice(null)
      if (tickRef.current) {
        clearInterval(tickRef.current)
        tickRef.current = null
      }
      setPhase('quiz')
    } catch (e) {
      setErr(readApiDetail(e))
    } finally {
      setLoadingQuiz(false)
    }
  }

  async function sendCurrentAnswer() {
    if (!sessionId || !activeQuestion) return
    setSubmitting(true)
    setErr(null)
    try {
      const choices = activeQuestion.choices
      const mcq = Array.isArray(choices) && choices.length >= 4
      if (!mcq && !answerText.trim()) {
        setErr('Isi jawaban terlebih dahulu.')
        setSubmitting(false)
        return
      }
      if (mcq && (pickedChoice === null || pickedChoice < 0 || pickedChoice > 3)) {
        setErr('Silakan pilih salah satu jawaban.')
        setSubmitting(false)
        return
      }
      const r = mcq
        ? await postMlQuizAnswer(sessionId, {
            question_id: activeQuestion.id,
            text: '',
            choice_index: pickedChoice!,
          })
        : await postMlQuizAnswer(sessionId, {
            question_id: activeQuestion.id,
            text: answerText.trim(),
          })

      if (r.done) {
        setReport(r.report)
        setLevel(r.knowledge_level)
        setSecWatched(r.seconds_watched)
        setAssessment(r.assessment ?? null)
        setRemedialItems(r.remedial_items ?? [])
        setActiveQuestion(null)
        setKembangkanPath(null)
        setReflectionByQuestionId({})
        setPhase('score_options')
        return
      }
      if (r.question) {
        setActiveQuestion(r.question)
        setCurrentStep(r.current_step)
        setTotalSteps(r.total_steps)
        setAnswerText('')
      } else {
        setErr('Mengalih ke pertanyaan berikutnya gagal. Muat ulang dan coba lagi.')
      }
    } catch (e) {
      setErr(readApiDetail(e) || 'Gagal mengirim jawaban. Coba sesaat lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!videoId) {
    return <p className="text-sm text-theme-muted">ID video tidak valid.</p>
  }

  const isPlus = category === 'belajar_plus'
  const panelClass = isPlus
    ? 'relative overflow-hidden rounded-2xl border border-merah/25 bg-gradient-to-br from-merah/[0.05] via-transparent to-health-500/[0.04] p-5 shadow-lg shadow-merah/8 ring-1 ring-merah/10 backdrop-blur-sm md:p-6'
    : 'glass-panel border border-[var(--panel-border)] p-5 md:p-6'
  const panelClassQuiz = isPlus
    ? 'relative space-y-4 overflow-hidden rounded-2xl border border-merah/20 bg-gradient-to-b from-merah/[0.06] to-[var(--panel-bg)] p-5 ring-1 ring-merah/10 md:p-6'
    : 'glass-panel space-y-4 border border-[var(--panel-border)] p-5 md:p-6'
  const panelClassDone = isPlus
    ? 'relative space-y-3 rounded-2xl border border-amber-500/20 bg-[var(--panel-bg)] p-5 shadow-md shadow-amber-500/5 ring-1 ring-amber-400/20 md:p-6'
    : 'glass-panel space-y-3 border border-[var(--panel-border)] p-5 md:p-6'
  const btnPrimary = isPlus
    ? 'rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-merah/25 transition hover:brightness-105 focus-ring disabled:opacity-50'
    : 'rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 focus-ring'
  const panelClassGate = isPlus
    ? 'relative space-y-4 overflow-hidden rounded-2xl border border-health-500/25 bg-gradient-to-b from-health-700/[0.08] to-[var(--panel-bg)] p-5 ring-1 ring-health-500/15 md:p-6'
    : 'glass-panel space-y-4 border border-[var(--panel-border)] p-5 md:p-6'
  const panelClassKembang = isPlus
    ? 'relative space-y-4 overflow-hidden rounded-2xl border border-health-500/25 bg-gradient-to-b from-health-500/[0.06] to-[var(--panel-bg)] p-5 ring-1 ring-health-500/15 md:p-6'
    : 'glass-panel space-y-4 border border-[var(--panel-border)] p-5 md:p-6'
  const btnGatePrimary = isPlus
    ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-3 text-sm font-semibold text-white shadow-md shadow-merah/25 transition hover:brightness-105 focus-ring sm:flex-1'
    : 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-ring sm:flex-1'
  const btnGateSecondary = isPlus
    ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-health-500/35 bg-health-50/90 px-4 py-3 text-sm font-semibold text-health-800 transition hover:bg-health-100 focus-ring sm:flex-1'
    : 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-semibold text-theme transition hover:bg-white/5 focus-ring sm:flex-1'

  return (
    <div className="relative space-y-6">
      {isPlus ? (
        <div
          className="pointer-events-none absolute inset-x-0 -top-6 h-56 rounded-[2rem] bg-gradient-to-b from-merah/15 via-merah/5 to-transparent blur-2xl"
          aria-hidden
        />
      ) : null}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.38, ease: easeOutExpo }}
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/petugas" className="text-sm font-medium text-theme hover:underline focus-ring">
            ← Kembali ke ruang masyarakat
          </Link>
          <Link
            to="/petugas/video-ml"
            className="text-sm text-merah-bright hover:underline focus-ring"
          >
            Daftar video
          </Link>
        </div>
        <span className="text-xs text-theme-muted">Sesi: {sessionId ? sessionId.slice(-8) : '…'}</span>
      </motion.div>

      {err ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-theme">{err}</p> : null}

      {phase === 'load' || phase === 'video' ? (
        <div className={panelClass}>
          {isPlus && phase === 'video' ? (
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-merah to-merah-bright px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-merah/20">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Belajar ++
            </div>
          ) : null}
          <h1
            className={`text-xl font-bold ${
              isPlus
                ? 'bg-gradient-to-r from-merah via-health-700 to-health-600 bg-clip-text text-transparent'
                : 'text-theme'
            }`}
          >
            {title || 'Memuat…'}
          </h1>
          {desc ? <p className="mt-2 text-sm text-theme-muted">{desc}</p> : null}
          {phase === 'video' && youtubeId ? (
            <>
              <div
                className={`mt-4 aspect-video w-full max-w-3xl overflow-hidden bg-black shadow-lg ${
                  isPlus ? 'rounded-xl ring-2 ring-merah/25 ring-offset-2 ring-offset-black' : 'rounded-xl'
                }`}
              >
                <div id={playerContainerId} className="h-full w-full" />
              </div>
              <p className="mt-2 text-xs text-theme-muted">
                Posisi tonton dilaporkan ke server. Asesmen memakai pilihan ganda dari naskah; sistem meminta AI menyusun
                soal (biasanya kurang satu menit; layanan lambat bisa memakai paket cadangan).
              </p>
              {youtubeVideoDurationSec > 0 && !canOpenAssessment ? (
                <p className="mt-2 text-xs font-medium leading-relaxed text-amber-800 dark:text-amber-200">
                  Silakan nonton video sampai habis agar asesmen dibuka.
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href={`https://www.youtube.com/watch?v=${encodeURIComponent(youtubeId)}`}
                  rel="noreferrer"
                  target="_blank"
                  className="text-xs text-merah-bright underline"
                >
                  Buka di YouTube
                </a>
                <button
                  type="button"
                  onClick={() => void goQuiz()}
                  disabled={loadingQuiz || !sessionId || !canOpenAssessment}
                  className={btnPrimary}
                >
                  {loadingQuiz
                    ? 'Menyiapkan asesmen (memanggil AI)…'
                    : 'Lanjut ke asesmen pengetahuan'}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {phase === 'quiz' ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={panelClassQuiz}
        >
          {isPlus ? (
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-merah/15 blur-2xl" aria-hidden />
          ) : null}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">
            Asesmen pilihan ganda (AI)
          </p>
          {activeQuestion ? (
            <div className="mt-4 space-y-4">
              <h2 className="text-balance font-[family-name:var(--font-heading)] text-xl font-semibold leading-snug tracking-tight text-theme md:text-2xl md:leading-tight">
                {activeQuestion.question}
              </h2>
              {Array.isArray(activeQuestion.choices) && activeQuestion.choices.length >= 4 ? (
                <ul className="space-y-2.5" role="list">
                  {activeQuestion.choices.map((label, i) => {
                    const selected = pickedChoice === i
                    return (
                      <li key={i}>
                        <label
                          className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-3 text-sm leading-snug transition duration-200 ${
                            selected
                              ? isPlus
                                ? 'border-health-500/50 bg-cyan-500/10 text-theme'
                                : 'border-health-500/50 bg-cyan-500/10 text-theme'
                              : isPlus
                                ? 'border-[var(--panel-border)] bg-[var(--panel-bg)]/60 text-theme hover:border-health-500/35'
                                : 'border-[var(--panel-border)] bg-[var(--panel-bg)]/60 text-theme hover:border-health-500/35'
                          } ${submitting ? 'pointer-events-none opacity-60' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`ml-mcq-${activeQuestion.id}`}
                            className="mt-1 h-4 w-4 shrink-0"
                            checked={selected}
                            onChange={() => setPickedChoice(i)}
                            disabled={submitting}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold tabular-nums text-theme-muted">{String.fromCharCode(65 + i)}. </span>
                            {label}
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <div>
                  <label htmlFor="ml-quiz-answer" className="sr-only">
                    Jawaban Anda
                  </label>
                  <textarea
                    id="ml-quiz-answer"
                    className={`${field} min-h-[7.5rem] text-base`}
                    rows={5}
                    placeholder="Tulis jawaban singkat di sini…"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => void sendCurrentAnswer()}
            disabled={
              submitting ||
              !activeQuestion ||
              (Array.isArray(activeQuestion?.choices) && activeQuestion.choices.length >= 4 ? pickedChoice === null : false)
            }
            className={`w-full max-w-md py-2.5 text-sm font-semibold disabled:opacity-50 focus-ring ${isPlus ? 'rounded-xl bg-gradient-to-r from-merah to-merah-bright text-white shadow-md shadow-merah/20' : 'rounded-xl bg-gradient-to-r from-merah to-merah-bright text-white'}`}
          >
            {submitting
              ? 'Memproses…'
              : currentStep < totalSteps
                ? 'Kirim & lanjut'
                : 'Kirim & lihat hasil'}
          </button>
        </motion.div>
      ) : null}

      {phase === 'score_options' ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={panelClassGate}
        >
          {isPlus ? (
            <div className="absolute -left-10 -top-10 h-28 w-28 rounded-full bg-health-500/15 blur-2xl" aria-hidden />
          ) : null}
          <div className="relative space-y-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">Hasil asesmen</p>
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-theme md:text-2xl">
              Skor siap ditampilkan
            </h2>
            <p className="text-sm leading-relaxed text-theme-muted">
              Jawaban pilihan ganda sudah diproses. Anda dapat memperdalam dengan modul refleksi atau langsung membuka
              laporan ringkas (tingkat pengetahuan dan skor PG). Jika Anda melewati refleksi, isi laporan tetap sama
              seperti di bawah ini.
            </p>
            <div
              className={`rounded-xl border p-4 ${
                isPlus ? 'border-[var(--panel-border)] bg-[var(--panel-bg)]/80' : 'border-[var(--panel-border)] bg-[var(--panel-bg)]/80'
              }`}
            >
              <p className="text-xs font-semibold text-theme">Ringkasan cepat</p>
              <div className="mt-2">
                <RingkasanSkorStrip assessment={assessment} level={level} secWatched={secWatched} />
              </div>
            </div>
            <p className="text-xs text-theme-muted">Pilih langkah berikut:</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <button
                type="button"
                className={btnGatePrimary}
                onClick={() => setPhase('kembangkan')}
              >
                <BookOpen className="h-4 w-4" aria-hidden />
                Pengembangan kemampuan
              </button>
              <button
                type="button"
                className={btnGateSecondary}
                onClick={() => {
                  setKembangkanPath('skipped')
                  setPhase('done')
                }}
              >
                <FileText className="h-4 w-4" aria-hidden />
                Langsung ke laporan
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}

      {phase === 'kembangkan' ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={panelClassKembang}
        >
          {isPlus ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-merah dark:text-merah-bright">
              Modul pengembangan kemampuan
            </p>
          ) : (
            <p className="text-xs font-semibold uppercase tracking-wider text-theme-muted">Modul pengembangan kemampuan</p>
          )}
          <KembangkanPengetahuanPanel
            isPlus={isPlus}
            videoTitle={title}
            youtubeId={youtubeId}
            sessionId={sessionId}
            assessment={assessment}
            remedialItems={remedialItems}
            narrativeReport={report}
            variant="inline"
            allowUserRewrite
            onReflectionMapChange={setReflectionByQuestionId}
          />
          <button
            type="button"
            onClick={() => {
              if (sessionId) {
                try {
                  const raw = localStorage.getItem(`${REFLECT_LS}${sessionId}`)
                  if (raw) {
                    const p = JSON.parse(raw) as unknown
                    if (p && typeof p === 'object' && p !== null && !Array.isArray(p)) {
                      setReflectionByQuestionId(p as Record<string, string>)
                    }
                  }
                } catch {
                  /* */
                }
              }
              setKembangkanPath('completed')
              setPhase('done')
            }}
            className={`flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold focus-ring ${isPlus ? 'rounded-xl bg-gradient-to-r from-merah to-merah-bright text-white shadow-md shadow-merah/20' : 'rounded-xl bg-gradient-to-r from-merah to-merah-bright text-white'}`}
          >
            <LayoutList className="h-4 w-4" aria-hidden />
            Selesai &amp; lihat laporan
          </button>
        </motion.div>
      ) : null}

      {phase === 'done' ? (
        <motion.div
          id="laporan-asesmen-utama"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={panelClassDone}
        >
          {isPlus ? (
            <p className="text-xs font-semibold uppercase tracking-wider text-merah dark:text-merah-bright">
              Belajar ++ · selesai
            </p>
          ) : null}
          <h2 className="text-lg font-semibold text-theme">Laporan asesmen</h2>
          <p className="text-sm text-theme-muted">
            Laporan utama menampilkan tingkat pengetahuan setelah asesmen pilihan ganda; bagian kedua menyimpan jejak
            Anda setelah modul pengembangan kemampuan (refleksi atau tulisan perbaikan).
          </p>

          <section
            className="mt-5 space-y-2 rounded-2xl border border-health-500/20 bg-cyan-500/[0.04] p-4 md:p-5"
            aria-labelledby="laporan-sblm-heading"
            id="laporan-sebelum"
          >
            <h3
              id="laporan-sblm-heading"
              className="text-base font-bold text-theme md:text-lg"
            >
              1. Sebelum pengembangan kemampuan
            </h3>
            <p className="text-sm text-theme-muted">
              Snapshot resmi setelah soal terakhir dikirim (belum modul refleksi mandiri).
            </p>
            <LaporanAsesmenIsi
              assessment={assessment}
              report={report}
              level={level}
              secWatched={secWatched}
              detailsKeyPrefix="sebelum"
            />
          </section>

          <section
            className="mt-6 space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 md:p-5"
            aria-labelledby="laporan-ssdh-heading"
            id="laporan-sesudah"
          >
            <h3 id="laporan-ssdh-heading" className="text-base font-bold text-theme md:text-lg">
              2. Setelah pengembangan kemampuan
            </h3>
            {kembangkanPath === 'skipped' ? (
              <div className="space-y-3 text-sm">
                <p className="leading-relaxed text-theme-muted">
                  Anda memilih <strong className="text-theme">langsung ke laporan</strong> tanpa menjalani modul
                  pengembangan kemampuan. Ringkasan tingkat pengetahuan dan skor PG di bawah mengacu pada{' '}
                  <a href="#laporan-sebelum" className="font-medium text-merah-bright underline-offset-2 hover:underline">
                    bagian 1
                  </a>
                  ; tidak ada koreksi reflektif baru di sini.
                </p>
                <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/70 p-3">
                  <p className="text-xs font-semibold text-theme">Ringkasan (sama dengan saat asesmen selesai)</p>
                  <div className="mt-1">
                    <RingkasanSkorStrip assessment={assessment} level={level} secWatched={secWatched} />
                  </div>
                </div>
                <p className="text-xs text-theme-muted">
                  Untuk memperdalam, Anda tetap dapat membuka video di daftar lalu fokus pada materi bila tersedia.
                </p>
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <p className="leading-relaxed text-theme-muted">
                  Anda menyelesaikan modul pengembangan kemampuan. <strong className="text-theme">Skor otomatis tidak
                  berubah</strong> (tetap seperti bagian 1). Bagian ini menyimpan tulisan perbaikan Anda; gunakan
                  sebagai jejak belajar, bukan nilai ujian baru.
                </p>
                {(() => {
                  const entries = Object.entries(reflectionByQuestionId).filter(([, t]) => t.trim().length > 0)
                  if (entries.length === 0) {
                    return (
                      <p className="rounded-xl border border-dashed border-amber-500/30 bg-amber-500/10 px-3 py-2 text-theme-muted">
                        Belum ada teks perbaikan tercatat. Jika Anda sempat mengetik nanti, muat ulang halaman; refleksi
                        disimpan sementara di peramban.
                      </p>
                    )
                  }
                  return (
                    <ol className="space-y-4">
                      {entries.map(([qid, text], j) => {
                        const it = remedialItems.find((r) => r.question_id === qid)
                        return (
                          <li
                            key={qid}
                            className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 p-3 md:p-4"
                          >
                            <p className="text-[11px] font-mono text-theme/70">{qid}</p>
                            {it?.question ? (
                              <p className="mt-1 text-xs text-theme-muted line-clamp-4">{it.question}</p>
                            ) : null}
                            <p className="mt-0.5 text-xs font-semibold text-theme">Jawaban versi perbaikan Anda</p>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-theme">{text}</p>
                            <span className="mt-2 inline-block text-[10px] text-theme-muted">#{j + 1}</span>
                          </li>
                        )
                      })}
                    </ol>
                  )
                })()}
                {assessment ? (
                  <div className="rounded-xl border border-health-500/20 bg-cyan-500/[0.05] p-3">
                    <p className="text-xs font-semibold text-theme">Arah belajar (tetap berlaku)</p>
                    <p className="mt-1 text-sm text-theme-muted">{assessment.recommendation}</p>
                  </div>
                ) : null}
                <a
                  href="#laporan-sebelum"
                  className="inline-flex text-xs font-medium text-merah-bright underline-offset-2 hover:underline"
                >
                  Lihat kembali laporan 1 (penilaian otomatis)
                </a>
              </div>
            )}
          </section>
        </motion.div>
      ) : null}

      {phase === 'error' ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/petugas" className="font-medium text-theme underline">
            Kembali ke ruang masyarakat
          </Link>
          <Link to="/petugas/video-ml" className="text-merah-bright underline">
            Kembali ke daftar video
          </Link>
        </div>
      ) : null}
    </div>
  )
}
