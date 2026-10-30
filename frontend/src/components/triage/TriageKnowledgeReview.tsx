import { motion, useReducedMotion } from 'framer-motion'
import { BookOpen, ChevronDown, Loader2, PencilLine, Sprout } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { fetchTriageReview, type TriageReviewItem } from '../../api/client'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

const LS_PREFIX = 'triage-review-reflect:'

const CAT_BADGE: Record<string, string> = {
  merah: 'bg-merah/15 text-merah border-merah/30',
  kuning: 'bg-amber-500/15 text-amber-900 border-amber-400/35',
  hijau: 'bg-health-500/12 text-health-800 border-health-500/30',
  hitam: 'bg-slate-500/15 text-slate-800 border-slate-400/30 dark:text-slate-200',
}

type Props = {
  sessionId: string
  defaultOpen?: boolean
}

export function TriageKnowledgeReview({ sessionId, defaultOpen = false }: Props) {
  const reduceMotion = useReducedMotion()
  const [open, setOpen] = useState(defaultOpen)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [items, setItems] = useState<TriageReviewItem[]>([])
  const [recommendation, setRecommendation] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [rewriteById, setRewriteById] = useState<Record<string, string>>({})

  const storageKey = `${LS_PREFIX}${sessionId}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as unknown
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        setRewriteById(parsed as Record<string, string>)
      }
    } catch {
      /* */
    }
  }, [storageKey])

  const persist = useCallback(
    (next: Record<string, string>) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(next))
      } catch {
        /* */
      }
    },
    [storageKey],
  )

  const loadReview = useCallback(async () => {
    if (loaded || loading) return
    setLoading(true)
    setErr(null)
    try {
      const data = await fetchTriageReview(sessionId)
      setItems(data.items)
      setRecommendation(data.recommendation)
      setLoaded(true)
      setOpen(true)
    } catch {
      setErr('Gagal memuat penjelasan AI. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }, [loaded, loading, sessionId])

  const setLine = useCallback(
    (caseId: number, text: string) => {
      const key = String(caseId)
      setRewriteById((prev) => {
        const n = { ...prev, [key]: text }
        persist(n)
        return n
      })
    },
    [persist],
  )

  return (
    <section className="relative overflow-hidden rounded-2xl border border-health-500/30 bg-gradient-to-br from-cyan-500/[0.08] via-[var(--panel-bg)] to-emerald-500/[0.06] p-5 shadow-lg shadow-cyan-500/10 ring-1 ring-health-500/15 md:p-6">
      <div className="pointer-events-none absolute -left-8 -top-16 h-36 w-36 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden />
      <div className="relative space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-health-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-health-900 ring-1 ring-health-500/25 dark:text-cyan-100">
            <Sprout className="h-3 w-3" aria-hidden />
            Pengembangan pengetahuan
          </span>
        </div>
        <h3 className="font-[family-name:var(--font-heading)] text-xl font-bold tracking-tight text-theme">
          Mengapa jawaban benar seperti itu?
        </h3>
        <p className="max-w-prose text-sm leading-relaxed text-theme-muted">
          Setiap kasus dijelaskan langkah demi langkah menurut protokol START (AMAN → NAPAS → PERFUSI → MENTAL)
          - termasuk mengapa kategori tertentu dipilih dan di langkah mana penilaian Anda menyimpang.
        </p>
        {!loaded ? (
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadReview()}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-3.5 text-sm font-semibold text-white shadow-md transition hover:brightness-105 focus-ring disabled:opacity-60 sm:w-auto"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <BookOpen className="h-4 w-4" aria-hidden />
            )}
            {loading ? 'Menyusun penjelasan…' : 'Buka tinjauan & penjelasan START'}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-health-500/30 bg-health-500/10 px-4 py-3 text-sm font-semibold text-theme transition hover:bg-health-500/15 focus-ring sm:w-auto"
          >
            {open ? 'Sembunyikan tinjauan' : 'Tampilkan tinjauan'}
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          </button>
        )}
        {err ? (
          <p className="rounded-xl border border-merah/25 bg-merah/[0.05] px-3 py-2 text-sm text-merah">{err}</p>
        ) : null}
      </div>

      {open && loaded ? (
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
          className="relative mt-6 space-y-5 border-t border-[var(--panel-border)] pt-6"
        >
          {recommendation ? (
            <div className="rounded-xl border border-health-500/25 bg-cyan-500/[0.06] px-4 py-3 text-sm">
              <span className="font-semibold text-theme">Arah belajar: </span>
              <span className="text-theme-muted">{recommendation}</span>
            </div>
          ) : null}

          <ol className="space-y-5">
            {items.map((row, idx) => {
              const yourBadge = CAT_BADGE[row.your_answer] ?? ''
              const correctBadge = CAT_BADGE[row.correct_answer] ?? ''
              return (
                <motion.li
                  key={row.case_id}
                  initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * idx, duration: 0.35, ease: easeOutExpo }}
                  className="rounded-2xl border border-health-500/20 bg-cyan-500/[0.04] p-4 ring-1 ring-health-500/10 md:p-5"
                >
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-xs font-bold tabular-nums text-cyan-100">
                        {idx + 1}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${
                          row.correct ? 'border-health-500/35 bg-health-500/10 text-health-800' : 'border-merah/30 bg-merah/10 text-merah'
                        }`}
                      >
                        {row.correct ? 'Benar' : 'Perlu diulang'}
                      </span>
                    </div>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-theme">{row.case_text}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className={`rounded-lg border px-2.5 py-1 font-semibold ${yourBadge}`}>
                        Anda: {row.your_answer_label}
                      </span>
                      {!row.correct ? (
                        <span className={`rounded-lg border px-2.5 py-1 font-semibold ${correctBadge}`}>
                          Benar: {row.correct_answer_label}
                        </span>
                      ) : null}
                    </div>

                    <div className="space-y-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.05] p-3">
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-theme">
                        <PencilLine className="h-3.5 w-3.5" aria-hidden />
                        Penjelasan alur START
                      </p>
                      {row.rationale ? (
                        <p className="text-sm leading-relaxed text-theme-muted">
                          <span className="font-medium text-theme/90">Mengapa jawaban benar: </span>
                          {row.rationale}
                        </p>
                      ) : null}
                      {row.protocol_steps ? (
                        <p className="text-sm leading-relaxed text-theme-muted">
                          <span className="font-medium text-theme/90">Langkah kunci: </span>
                          {row.protocol_steps}
                        </p>
                      ) : null}
                      {row.feedback_educatif ? (
                        <p className="text-sm leading-relaxed text-theme-muted">
                          <span className="font-medium text-theme/90">Tips praktis: </span>
                          {row.feedback_educatif}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label htmlFor={`tr-reflect-${row.case_id}`} className="text-sm font-semibold text-theme">
                        Catatan Anda setelah memahami penjelasan
                      </label>
                      <textarea
                        id={`tr-reflect-${row.case_id}`}
                        className="mt-1.5 w-full min-h-[4.5rem] rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-theme transition placeholder:text-theme-muted/70 focus:border-health-500/40 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                        rows={3}
                        placeholder="Contoh: Saya awalnya lupa cek perfusi sebelum mental…"
                        value={rewriteById[String(row.case_id)] ?? ''}
                        onChange={(e) => setLine(row.case_id, e.target.value)}
                      />
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </ol>
        </motion.div>
      ) : null}
    </section>
  )
}
