import { motion, useReducedMotion } from 'framer-motion'
import {
  BookOpen,
  ChevronDown,
  PencilLine,
  Sparkles,
  Sprout,
  Wand2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { MlAssessmentSummary, MlGradingItem, MlRemedialItem } from '../../types'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

const LS_PREFIX = 'kembangkan-pengetahuan:'

type KnowledgeRow = {
  question_id: string
  question: string
  user_answer: string
  grade: MlGradingItem | null
}

function mergeRows(items: MlRemedialItem[], assessment: MlAssessmentSummary | null): KnowledgeRow[] {
  const byId = new Map<string, MlGradingItem>()
  for (const g of assessment?.per_answer ?? []) {
    byId.set(g.question_id, g)
  }
  if (items.length > 0) {
    return items.map((it) => ({
      question_id: it.question_id,
      question: it.question,
      user_answer: it.user_answer,
      grade: byId.get(it.question_id) ?? null,
    }))
  }
  const pa = assessment?.per_answer
  if (pa?.length) {
    return pa.map((g) => ({
      question_id: g.question_id,
      question: '',
      user_answer: '',
      grade: g,
    }))
  }
  return []
}

function PengetahuanHero({ isPlus }: { isPlus: boolean }) {
  const reduce = useReducedMotion()
  const pulse = reduce
    ? undefined
    : { scale: [1, 1.03, 1], transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' as const } }
  const a = isPlus ? '#c026d3' : '#0891b2'
  const b = isPlus ? '#f43f5e' : '#10b981'

  return (
    <div
      className="relative mx-auto w-full max-w-[240px] shrink-0"
      role="img"
      aria-hidden
    >
      <svg viewBox="0 0 220 150" className="h-auto w-full" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="kp-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={a} stopOpacity="0.45" />
            <stop offset="100%" stopColor={b} stopOpacity="0.2" />
          </linearGradient>
          <filter id="kp-blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
        </defs>
        <circle cx="110" cy="78" r="64" fill="url(#kp-glow)" filter="url(#kp-blur)" opacity="0.75" />
        <motion.g animate={pulse}>
          <rect x="40" y="40" width="140" height="90" rx="16" className="fill-white/90 dark:fill-cosmic-800/90" />
          <path
            d="M55 60h90M55 75h60M55 90h75"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="text-slate-300 dark:text-slate-500"
          />
          <circle cx="152" cy="55" r="12" fill={b} fillOpacity="0.35" />
          <path
            d="M145 55l4 4 8-8"
            fill="none"
            stroke={b}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.g>
        <circle cx="188" cy="32" r="4" fill={a} fillOpacity="0.55" />
        <path d="M32 110l6 6" stroke={b} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </svg>
    </div>
  )
}

export type KembangkanPengetahuanPanelProps = {
  isPlus: boolean
  videoTitle: string
  youtubeId?: string
  videoPageLink?: string
  assessment: MlAssessmentSummary | null
  remedialItems: MlRemedialItem[]
  /** Fallback bila belum ada baris soal per pertanyaan */
  narrativeReport?: string
  defaultOpen?: boolean
  variant?: 'accordion' | 'inline'
  /** Jika false (mis. riwayat staff), hanya tampilkan penjelasan tanpa area menulis. */
  allowUserRewrite?: boolean
  sessionId?: string | null
  /** Sinkronisasi peta refleksi ke parent (untuk laporan pasca-modul). */
  onReflectionMapChange?: (map: Record<string, string>) => void
}

export function KembangkanPengetahuanPanel({
  isPlus,
  videoTitle,
  youtubeId = '',
  videoPageLink,
  assessment,
  remedialItems,
  narrativeReport = '',
  defaultOpen = false,
  variant = 'accordion',
  allowUserRewrite = true,
  sessionId = null,
  onReflectionMapChange,
}: KembangkanPengetahuanPanelProps) {
  const reduceMotion = useReducedMotion()
  const isInline = variant === 'inline'
  const [open, setOpen] = useState(() => Boolean(defaultOpen))
  const [rewriteById, setRewriteById] = useState<Record<string, string>>({})

  const rows = useMemo(() => mergeRows(remedialItems, assessment), [remedialItems, assessment])
  const hasNarrativeFallback = rows.length === 0 && narrativeReport.trim().length > 0

  const storageKey = sessionId && allowUserRewrite ? `${LS_PREFIX}${sessionId}` : null

  useEffect(() => {
    if (!storageKey) return
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setRewriteById((prev) => {
          const n = { ...((parsed as Record<string, string>) || {}), ...prev }
          onReflectionMapChange?.(n)
          return n
        })
      }
    } catch {
      /* */
    }
  }, [onReflectionMapChange, storageKey])

  const persist = useCallback(
    (next: Record<string, string>) => {
      if (!storageKey) return
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* */
      }
    },
    [storageKey],
  )

  const setLine = useCallback(
    (qid: string, text: string) => {
      setRewriteById((prev) => {
        const n = { ...prev, [qid]: text }
        persist(n)
        onReflectionMapChange?.(n)
        return n
      })
    },
    [onReflectionMapChange, persist],
  )

  const shell = isPlus
    ? 'relative overflow-hidden rounded-2xl border border-violet-500/30 bg-gradient-to-br from-fuchsia-950/35 via-[var(--panel-bg)] to-rose-950/25 p-5 shadow-[0_0_40px_-12px_rgba(192,38,211,0.45)] ring-1 ring-fuchsia-500/20 md:p-6'
    : 'relative overflow-hidden rounded-2xl border border-health-500/30 bg-gradient-to-br from-cyan-500/[0.1] via-[var(--panel-bg)] to-emerald-500/[0.08] p-5 shadow-lg shadow-cyan-500/10 ring-1 ring-health-500/15 md:p-6'

  const ctaBtn = isPlus
    ? 'inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md shadow-rose-500/30 transition hover:brightness-105 focus-ring sm:w-auto'
    : 'inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus-ring sm:w-auto'

  const showBody = isInline || open

  const field = isPlus
    ? 'mt-1.5 w-full min-h-[5.5rem] rounded-xl border border-fuchsia-500/25 bg-black/20 px-3 py-2.5 text-sm text-theme ring-0 transition placeholder:text-theme-muted/70 focus:border-fuchsia-400/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-500/25'
    : 'mt-1.5 w-full min-h-[5.5rem] rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-theme transition placeholder:text-theme-muted/70 focus:border-health-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/20'

  return (
    <section className={shell} aria-labelledby="kembangkan-pengetahuan-heading">
      {isPlus ? (
        <div
          className="pointer-events-none absolute -right-12 -top-20 h-40 w-40 rounded-full bg-fuchsia-500/25 blur-3xl"
          aria-hidden
        />
      ) : (
        <div
          className="pointer-events-none absolute -left-8 -top-16 h-36 w-36 rounded-full bg-cyan-500/20 blur-3xl"
          aria-hidden
        />
      )}
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                isPlus
                  ? 'bg-gradient-to-r from-fuchsia-500/20 to-rose-500/20 text-fuchsia-200 ring-1 ring-fuchsia-500/30'
                  : 'bg-health-500/15 text-health-900 dark:text-cyan-100 ring-1 ring-health-500/25'
              }`}
            >
              {isPlus ? <Wand2 className="h-3 w-3" aria-hidden /> : <Sprout className="h-3 w-3" aria-hidden />}
              Refleksi aktif
            </span>
            {isPlus ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-fuchsia-100/80 ring-1 ring-white/10">
                <Sparkles className="h-3 w-3" aria-hidden />
                Belajar ++
              </span>
            ) : null}
          </div>
          <h3
            id="kembangkan-pengetahuan-heading"
            className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-theme md:text-2xl"
          >
            Pengembangan kemampuan
          </h3>
          <p className="max-w-prose text-sm leading-relaxed text-theme-muted">
            Sistem meringkas alasan penilaian untuk jawaban Anda, lalu memberi ruang menulis versi jawaban yang menurut
            Anda paling benar setelah memahami penjelasannya. Gunakan modul ini untuk menguatkan kemampuan dan pemahaman,
            bukan sekadar membaca skor.
          </p>
          {!isInline ? (
            <button type="button" onClick={() => setOpen((v) => !v)} className={ctaBtn}>
              <BookOpen className="h-4 w-4 shrink-0" aria-hidden />
              {open ? 'Sembunyikan langkah' : 'Buka pengembangan kemampuan'}
              <ChevronDown
                className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
                aria-hidden
              />
            </button>
          ) : null}
        </div>
        <PengetahuanHero isPlus={isPlus} />
      </div>

      {showBody ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
          className="relative mt-6 space-y-6 border-t border-[var(--panel-border)] pt-6"
        >
          {youtubeId ? (
            <div
              className={`rounded-xl border p-4 ${
                isPlus
                  ? 'border-fuchsia-500/20 bg-black/20'
                  : 'border-[var(--panel-border)] bg-[var(--panel-bg)]/80'
              }`}
            >
              <p className="text-sm font-semibold text-theme">Materi audiovisual</p>
              <p className="mt-0.5 text-xs text-theme-muted">
                {videoTitle ? videoTitle : 'Putar di halaman ini untuk menguatkan ingatan sebelum menulis ulang.'}
              </p>
              <div
                className={`mt-3 aspect-video w-full max-w-3xl overflow-hidden rounded-xl bg-black shadow-inner ${
                  isPlus ? 'ring-2 ring-fuchsia-500/25' : 'ring-1 ring-health-500/20'
                }`}
              >
                <iframe
                  title={videoTitle ? `Materi: ${videoTitle}` : 'Materi video'}
                  src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}?rel=0&modestbranding=1&playsinline=1`}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
            </div>
          ) : videoPageLink ? (
            <p className="text-sm text-theme-muted">
              <Link to={videoPageLink} className="font-medium text-merah-bright underline-offset-2 hover:underline">
                Buka halaman materi
              </Link>
            </p>
          ) : null}

          {rows.length > 0 ? (
            <ol className="space-y-5">
              {rows.map((row, idx) => {
                const g = row.grade
                const hasExplain =
                  (g?.rationale && g.rationale.trim()) ||
                  (g?.expected_answer_summary && g.expected_answer_summary.trim()) ||
                  (g?.feedback_educatif && g.feedback_educatif.trim())

                return (
                  <motion.li
                    key={row.question_id}
                    initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 * idx, duration: 0.38, ease: easeOutExpo }}
                    className={`relative overflow-hidden rounded-2xl border p-4 ring-1 md:p-5 ${
                      isPlus
                        ? 'border-fuchsia-500/20 bg-gradient-to-b from-fuchsia-950/20 to-transparent ring-fuchsia-500/10'
                        : 'border-health-500/20 bg-cyan-500/[0.04] ring-health-500/10'
                    }`}
                  >
                    {isPlus ? (
                      <div
                        className="pointer-events-none absolute -right-6 top-0 h-24 w-24 rounded-full bg-rose-500/15 blur-2xl"
                        aria-hidden
                      />
                    ) : null}
                    <div className="relative space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`flex h-8 min-w-8 items-center justify-center rounded-lg text-xs font-bold tabular-nums ${
                            isPlus
                              ? 'bg-fuchsia-500/20 text-fuchsia-100'
                              : 'bg-cyan-500/10 text-cyan-100'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-theme-muted">
                          Pertanyaan
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-relaxed text-theme">
                        {row.question.trim()
                          ? row.question
                          : `Pertanyaan ${row.question_id} - naskah lengkap tersimpan di riwayat asesmen saat tersedia.`}
                      </p>
                      <div
                        className={`rounded-xl border border-dashed px-3 py-2.5 ${
                          isPlus
                            ? 'border-fuchsia-500/30 bg-fuchsia-950/15'
                            : 'border-cyan-500/25 bg-black/10'
                        }`}
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-muted">Jawaban Anda</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-theme/95">
                          {row.user_answer.trim() || '-'}
                        </p>
                      </div>

                      <div
                        className={`space-y-3 rounded-xl border p-3 ${
                          isPlus
                            ? 'border-violet-500/25 bg-violet-950/20'
                            : 'border-emerald-500/20 bg-emerald-500/[0.05]'
                        }`}
                      >
                        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-theme">
                          <PencilLine className="h-3.5 w-3.5" aria-hidden />
                          Penjelasan untuk jawaban Anda
                        </p>
                        {g && hasExplain ? (
                          <div className="space-y-2.5 text-sm">
                            {g.rationale ? (
                              <p className="leading-relaxed text-theme-muted">
                                <span className="font-medium text-theme/90">Mengapa jawaban benar seperti itu: </span>
                                {g.rationale}
                              </p>
                            ) : null}
                            {g.expected_answer_summary ? (
                              <p className="leading-relaxed text-theme-muted">
                                <span className="font-medium text-theme/90">Poin rujukan (ringkas): </span>
                                {g.expected_answer_summary}
                              </p>
                            ) : null}
                            {g.feedback_educatif ? (
                              <p className="leading-relaxed text-theme-muted">
                                <span className="font-medium text-theme/90">Saran memperkuat: </span>
                                {g.feedback_educatif}
                              </p>
                            ) : null}
                            <p className="text-xs text-theme-muted/90">
                              Skor p:{' '}
                              <span className="font-mono text-theme/90">
                                {g.p_correct != null ? g.p_correct.toFixed(2) : g.correctness_score.toFixed(2)}
                              </span>
                            </p>
                          </div>
                        ) : g ? (
                          <p className="text-sm text-theme-muted">
                            Ringkasan penilaian: p{' '}
                            {g.p_correct != null ? g.p_correct.toFixed(2) : g.correctness_score.toFixed(2)}. Lihat pula
                            kotak ringkasan IKS/Indeks KA di halaman ini.
                          </p>
                        ) : (
                          <p className="text-sm text-theme-muted">
                            Penilaian rinci per soal belum tersedia. Bandingkan jawaban dengan narasi laporan di bawah
                            bagian ringkasan.
                          </p>
                        )}
                      </div>

                      {allowUserRewrite ? (
                        <div>
                          <label
                            htmlFor={`kp-rewrite-${row.question_id}`}
                            className="text-sm font-semibold text-theme"
                          >
                            Tulis jawaban menurut Anda paling benar
                          </label>
                          <p className="mt-0.5 text-xs text-theme-muted">
                            Setelah membaca penjelasan, uangkan jawaban versi diperbaiki di sini (tidak dinilai ulang
                            otomatis).
                          </p>
                          <textarea
                            id={`kp-rewrite-${row.question_id}`}
                            className={field}
                            rows={4}
                            placeholder="Contoh: Saya kembali merumuskan jawaban karena…"
                            value={rewriteById[row.question_id] ?? ''}
                            onChange={(e) => setLine(row.question_id, e.target.value)}
                          />
                        </div>
                      ) : null}
                    </div>
                  </motion.li>
                )
              })}
            </ol>
          ) : hasNarrativeFallback ? (
            <div
              className={`rounded-xl border p-4 text-sm leading-relaxed ${
                isPlus ? 'border-fuchsia-500/20 bg-fuchsia-950/10' : 'border-[var(--panel-border)] bg-[var(--panel-bg)]/60'
              }`}
            >
              <p className="font-semibold text-theme">Bahan baca sambil menulis</p>
              <p className="mt-2 whitespace-pre-wrap text-theme-muted">{narrativeReport.trim()}</p>
            </div>
          ) : (
            <p className="text-sm text-theme-muted">
              Penjelasan per soal akan muncul bila data penilaian tersedia. Periksa ringkasan IKS/Indeks KA.
            </p>
          )}

          {assessment?.recommendation ? (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                isPlus
                  ? 'border-fuchsia-500/20 bg-fuchsia-500/[0.07]'
                  : 'border-health-500/25 bg-cyan-500/[0.06]'
              }`}
            >
              <span className="font-semibold text-theme">Arah belajar: </span>
              <span className="text-theme-muted">{assessment.recommendation}</span>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </section>
  )
}
