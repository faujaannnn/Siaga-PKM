import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  HeartPulse,
  RefreshCw,
  Timer,
  Trophy,
  XCircle,
  Zap,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  fetchMyBestTriage,
  fetchTriageConfig,
  startTriageSession,
  submitTriageAnswer,
} from '../api/client'
import type { TriageAnswerResult, TriageCasePublic, TriageCategory, TriageGameConfig } from '../api/client'
import { TriageKnowledgeReview } from '../components/triage/TriageKnowledgeReview'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

type Phase = 'intro' | 'playing' | 'feedback' | 'finished'

const CAT_UI: Record<string, { card: string; glow: string; badge: string }> = {
  hijau: {
    card: 'border-health-500/40 bg-gradient-to-br from-health-600 to-health-500 text-white shadow-md shadow-health-500/15 hover:brightness-105',
    glow: 'ring-health-400/40',
    badge: 'bg-health-500/12 text-health-800 border-health-500/30',
  },
  kuning: {
    card: 'border-amber-400/45 bg-gradient-to-br from-amber-500/95 to-amber-600 text-amber-950 shadow-md shadow-amber-500/15 hover:brightness-105',
    glow: 'ring-amber-400/40',
    badge: 'bg-amber-500/15 text-amber-900 border-amber-400/35',
  },
  merah: {
    card: 'border-merah/35 bg-gradient-to-br from-merah/90 to-merah-bright text-white shadow-md shadow-merah/20 hover:brightness-105',
    glow: 'ring-merah/40',
    badge: 'bg-merah/15 text-merah border-merah/30',
  },
  hitam: {
    card: 'border-slate-500/40 bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md shadow-slate-900/25 hover:brightness-110 dark:from-slate-800 dark:to-slate-950',
    glow: 'ring-slate-400/35',
    badge: 'bg-slate-500/15 text-slate-800 border-slate-400/30 dark:text-slate-200',
  },
}

function TimerRing({ secondsLeft, total }: { secondsLeft: number; total: number }) {
  const pct = total > 0 ? secondsLeft / total : 0
  const urgent = secondsLeft <= 10
  const color = urgent ? '#c41e3a' : '#0891b2'
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - pct * circ
  return (
    <div className="relative flex h-16 w-16 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(6,182,212,0.12)" strokeWidth="5" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.35s ease, stroke 0.3s' }}
        />
      </svg>
      <span className={`text-lg font-bold tabular-nums ${urgent ? 'text-merah' : 'text-health-700'}`}>
        {secondsLeft}
      </span>
    </div>
  )
}

export function TriageGamePage() {
  const [config, setConfig] = useState<TriageGameConfig | null>(null)
  const [bestScore, setBestScore] = useState<number | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const [sessionId, setSessionId] = useState('')
  const [currentCase, setCurrentCase] = useState<TriageCasePublic | null>(null)
  const [categories, setCategories] = useState<TriageCategory[]>([])
  const [totalCases, setTotalCases] = useState(25)
  const [timeLimit, setTimeLimit] = useState(60)

  const [secondsLeft, setSecondsLeft] = useState(60)
  const [totalScore, setTotalScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [answered, setAnswered] = useState(0)
  const [feedback, setFeedback] = useState<TriageAnswerResult | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const caseStartRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittingRef = useRef(false)

  useEffect(() => {
    Promise.all([fetchTriageConfig(), fetchMyBestTriage()])
      .then(([cfg, best]) => {
        setConfig(cfg)
        setBestScore(best.best?.score ?? null)
        setLoading(false)
      })
      .catch(() => {
        setErr('Gagal memuat latihan triase.')
        setLoading(false)
      })
  }, [])

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const startCaseTimer = useCallback(
    (limit: number) => {
      clearTimer()
      setSecondsLeft(limit)
      caseStartRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setSecondsLeft((s) => {
          if (s <= 1) {
            clearTimer()
            return 0
          }
          return s - 1
        })
      }, 1000)
    },
    [clearTimer],
  )

  useEffect(() => () => clearTimer(), [clearTimer])

  const handleAnswer = useCallback(
    async (answer: string) => {
      if (submittingRef.current || !sessionId || !currentCase) return
      submittingRef.current = true
      setSubmitting(true)
      clearTimer()

      const elapsed = Date.now() - caseStartRef.current
      try {
        const res = await submitTriageAnswer(sessionId, answer, elapsed)
        setFeedback(res)
        setTotalScore(res.total_score)
        setStreak(res.streak)
        setBestStreak(res.best_streak)
        setCorrectCount(res.correct_count)
        setAnswered(res.answered)
        setPhase('feedback')

        window.setTimeout(() => {
          if (res.finished) {
            setPhase('finished')
            setFeedback(null)
          } else if (res.next_case) {
            setCurrentCase(res.next_case)
            setFeedback(null)
            setPhase('playing')
            startCaseTimer(timeLimit)
          }
          submittingRef.current = false
          setSubmitting(false)
        }, 1600)
      } catch {
        setErr('Gagal mengirim jawaban. Coba lagi.')
        submittingRef.current = false
        setSubmitting(false)
        startCaseTimer(secondsLeft || timeLimit)
      }
    },
    [sessionId, currentCase, clearTimer, timeLimit, startCaseTimer, secondsLeft],
  )

  useEffect(() => {
    if (phase !== 'playing' || secondsLeft > 0 || submittingRef.current) return
    void handleAnswer('timeout')
  }, [phase, secondsLeft, handleAnswer])

  const startGame = async () => {
    setErr(null)
    setLoading(true)
    try {
      const sess = await startTriageSession()
      setSessionId(sess.session_id)
      setCurrentCase(sess.case)
      setCategories(sess.categories)
      setTotalCases(sess.total_cases)
      setTimeLimit(sess.time_limit_sec)
      setTotalScore(0)
      setStreak(0)
      setBestStreak(0)
      setCorrectCount(0)
      setAnswered(0)
      setPhase('playing')
      startCaseTimer(sess.time_limit_sec)
    } catch {
      setErr('Gagal memulai sesi latihan.')
    } finally {
      setLoading(false)
    }
  }

  const progressPct = totalCases > 0 ? (answered / totalCases) * 100 : 0

  if (loading && !config) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-theme-muted">
        Memuat latihan triase…
      </div>
    )
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-10">
      <main className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link
          to="/petugas"
          className="inline-flex items-center gap-2 text-sm text-theme-muted transition hover:text-theme focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Ruang Masyarakat
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel overflow-hidden rounded-2xl border border-[var(--panel-border)]"
        >
          <div className="border-b border-[var(--panel-border)] bg-gradient-to-r from-health-500/[0.08] via-transparent to-merah/[0.06] px-5 py-4 md:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-merah/10 ring-1 ring-merah/20">
                  <HeartPulse className="h-5 w-5 text-merah" aria-hidden />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-health-700">ML · Latihan Triase</p>
                  <h1 className="text-lg font-bold text-theme md:text-xl">Triage START - Game Kasus</h1>
                </div>
              </div>
              {bestScore != null ? (
                <div className="flex items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-900 dark:text-amber-200">
                  <Trophy className="h-3.5 w-3.5" aria-hidden />
                  Rekor: {bestScore}
                </div>
              ) : null}
            </div>
          </div>

          <div className="p-5 md:p-6">
            {err ? (
              <p className="mb-4 rounded-xl border border-merah/25 bg-merah/[0.05] px-3 py-2 text-sm text-merah">
                {err}
              </p>
            ) : null}

            <AnimatePresence mode="wait">
              {phase === 'intro' ? (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="space-y-5"
                >
                  <p className="text-sm leading-relaxed text-theme-muted">
                    Kasus diacak. Tiap soal <strong className="text-theme">60 detik</strong> - pilih kategori triase
                    yang tepat. Poin dari jawaban benar, bonus kecepatan, dan streak benar beruntun.
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(config?.categories ?? []).map((cat) => (
                      <div
                        key={cat.id}
                        className={`rounded-xl border px-2 py-2 text-center text-xs font-semibold ${CAT_UI[cat.id]?.badge ?? ''}`}
                      >
                        {cat.label}
                        <p className="mt-0.5 text-[10px] font-normal opacity-80">{cat.subtitle}</p>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void startGame()}
                    className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-5 py-3.5 text-base font-semibold text-white shadow-md shadow-merah/20 transition hover:brightness-105 focus-ring disabled:opacity-50"
                  >
                    <Zap className="h-5 w-5" aria-hidden />
                    Mulai Latihan
                  </button>
                </motion.div>
              ) : null}

              {phase === 'playing' || phase === 'feedback' ? (
                <motion.div
                  key="game"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-theme-muted">
                      <span>
                        Kasus {(currentCase?.index ?? 0) + 1} / {totalCases}
                      </span>
                      <span className="flex items-center gap-3">
                        <span className="flex items-center gap-1">
                          <Flame className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                          Streak {streak}
                        </span>
                        <span className="font-semibold tabular-nums text-theme">{totalScore} poin</span>
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-health-500/10">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-health-600 to-merah-bright"
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.4, ease: easeOutExpo }}
                      />
                    </div>
                  </div>

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2">
                      <Timer className="h-4 w-4 text-health-600" aria-hidden />
                      <span className="text-xs text-theme-muted">Waktu</span>
                    </div>
                    {phase === 'playing' ? (
                      <TimerRing secondsLeft={secondsLeft} total={timeLimit} />
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 p-4 md:p-5">
                    <p className="whitespace-pre-line text-sm leading-relaxed text-theme md:text-base">
                      {currentCase?.text}
                    </p>
                  </div>

                  {phase === 'feedback' && feedback ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className={`rounded-xl border px-4 py-3 ${
                        feedback.correct
                          ? 'border-health-500/35 bg-health-500/[0.08]'
                          : 'border-merah/30 bg-merah/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {feedback.correct ? (
                          <CheckCircle2 className="h-5 w-5 text-health-700" aria-hidden />
                        ) : (
                          <XCircle className="h-5 w-5 text-merah" aria-hidden />
                        )}
                        <p className="text-sm font-semibold text-theme">
                          {feedback.correct ? 'Benar!' : 'Belum tepat'}
                          {!feedback.correct ? ` - jawaban: ${feedback.correct_label}` : ''}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-theme-muted">
                        +{feedback.points_earned} poin
                        {feedback.breakdown.speed > 0 ? ` (cepat +${feedback.breakdown.speed}` : ''}
                        {feedback.breakdown.streak > 0
                          ? `${feedback.breakdown.speed > 0 ? ', ' : ' ('}streak +${feedback.breakdown.streak}`
                          : ''}
                        {(feedback.breakdown.speed > 0 || feedback.breakdown.streak > 0) ? ')' : ''}
                      </p>
                    </motion.div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {categories.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          disabled={submitting || phase === 'feedback'}
                          onClick={() => void handleAnswer(cat.id)}
                          className={`cursor-pointer rounded-2xl border-2 px-4 py-4 text-left transition duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-60 ${CAT_UI[cat.id]?.card ?? ''}`}
                        >
                          <p className="text-lg font-bold tracking-wide">{cat.label}</p>
                          <p className="text-xs opacity-90">{cat.subtitle}</p>
                          <p className="mt-1 text-[11px] opacity-75">{cat.hint}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : null}

              {phase === 'finished' ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-5 text-center"
                >
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-health-500/20 to-merah/15 ring-1 ring-health-500/25">
                    <Trophy className="h-8 w-8 text-amber-600" aria-hidden />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-theme">{totalScore} poin</h2>
                    <p className="mt-1 text-sm text-theme-muted">
                      {correctCount}/{totalCases} benar · streak terbaik {bestStreak}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPhase('intro')
                        void startGame()
                      }}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-5 py-2.5 text-sm font-semibold text-white shadow-sm focus-ring"
                    >
                      <RefreshCw className="h-4 w-4" aria-hidden />
                      Main lagi
                    </button>
                    <Link to="/petugas" className="btn-secondary px-5 py-2.5 text-sm">
                      Kembali
                    </Link>
                  </div>
                  {sessionId ? (
                    <div className="mt-6 text-left">
                      <TriageKnowledgeReview sessionId={sessionId} />
                    </div>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
