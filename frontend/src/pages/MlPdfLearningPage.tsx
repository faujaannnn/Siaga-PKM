import { motion } from 'framer-motion'
import { ArrowRight, BookOpen, FileText, LayoutList } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import axios from 'axios'

import {
  fetchMlPdfSessionCompletion,
  patchMlPdfEngagement,
  postMlPdfMcqAnswer,
  startMlPdfChapterQuiz,
  startMlPdfSession,
} from '../api/client'
import { PdfJsChapterViewer } from '../components/PdfJsChapterViewer'
import { KembangkanPengetahuanPanel } from '../components/ml/KembangkanPengetahuanPanel'
import { LaporanAsesmenIsi, RingkasanSkorStrip } from './MlVideoLearningPage'
import type { MlAssessmentSummary, MlRemedialItem, MlPdfPublic, MlVideoCategory } from '../types'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

const REFLECT_LS = 'kembangkan-pengetahuan:'

type Phase =
  | 'load'
  | 'reading'
  | 'quiz'
  | 'chapter_turn'
  | 'score_options'
  | 'kembangkan'
  | 'done'
  | 'error'

type KembangkanPath = 'skipped' | 'completed' | null

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
  return 'Gagal memproses permintaan. Coba lagi.'
}

type Mcq = { id: string; question: string; choices: string[]; chapter_index: number }

export function MlPdfLearningPage() {
  const { pdfId } = useParams()

  const [phase, setPhase] = useState<Phase>('load')
  const [err, setErr] = useState<string | null>(null)
  const [pdf, setPdf] = useState<MlPdfPublic | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [chapterIndex, setChapterIndex] = useState(0)
  const [maxUnlockedChapter, setMaxUnlockedChapter] = useState(0)
  const [category, setCategory] = useState<MlVideoCategory>('asesmen_ai')

  const [activeQuestion, setActiveQuestion] = useState<Mcq | null>(null)
  const [pickedChoice, setPickedChoice] = useState<number | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [totalSteps, setTotalSteps] = useState(4)

  const [report, setReport] = useState('')
  const [level, setLevel] = useState('')
  const [secPdf, setSecPdf] = useState(0)
  const [assessment, setAssessment] = useState<MlAssessmentSummary | null>(null)
  const [remedialItems, setRemedialItems] = useState<MlRemedialItem[]>([])
  const [loadingQuiz, setLoadingQuiz] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [kembangkanPath, setKembangkanPath] = useState<KembangkanPath>(null)
  const [reflectionByQuestionId, setReflectionByQuestionId] = useState<Record<string, string>>({})

  const [nextChapterAfterQuiz, setNextChapterAfterQuiz] = useState<number | null>(null)

  const start = useCallback(async () => {
    if (!pdfId) return
    setErr(null)
    setPhase('load')
    try {
      const s = await startMlPdfSession(pdfId)
      setSessionId(s.id)
      setPdf(s.pdf)
      setCategory(s.pdf.category ?? 'asesmen_ai')
      setChapterIndex(0)
      setMaxUnlockedChapter(0)
      setRemedialItems([])
      setKembangkanPath(null)
      setReflectionByQuestionId({})
      setNextChapterAfterQuiz(null)
      setPhase('reading')
    } catch {
      setErr('Tidak dapat memulai sesi. Periksa login dan ID buku.')
      setPhase('error')
    }
  }, [pdfId])

  useEffect(() => {
    void start()
  }, [start])

  useEffect(() => {
    if (!sessionId) return
    if (!['done', 'score_options', 'kembangkan'].includes(phase)) return
    if (remedialItems.length > 0) return
    let cancelled = false
    void fetchMlPdfSessionCompletion(sessionId)
      .then(({ remedial_items }) => {
        if (cancelled || !remedial_items.length) return
        setRemedialItems(remedial_items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [phase, sessionId, remedialItems.length])

  useEffect(() => {
    if (phase !== 'reading' || !sessionId) return
    const id = window.setInterval(() => {
      setSecPdf((s) => {
        const n = s + 4
        void patchMlPdfEngagement(sessionId, n).catch(() => {})
        return n
      })
    }, 4000)
    return () => clearInterval(id)
  }, [phase, sessionId])

  useEffect(() => {
    if (phase !== 'done') return
    const t = window.setTimeout(() => {
      document.getElementById('laporan-asesmen-utama')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 120)
    return () => clearTimeout(t)
  }, [phase])

  async function goChapterQuiz() {
    if (!sessionId) return
    setLoadingQuiz(true)
    setErr(null)
    try {
      const q = await startMlPdfChapterQuiz(sessionId, chapterIndex)
      if (!q.question) {
        setErr('Soal tidak tersedia. Coba lagi atau hubungi admin.')
        return
      }
      setChapterIndex(q.question.chapter_index)
      setActiveQuestion(q.question)
      setPickedChoice(null)
      setCurrentStep(q.current_step)
      setTotalSteps(q.total_steps)
      setPhase('quiz')
    } catch (e) {
      setErr(readApiDetail(e))
    } finally {
      setLoadingQuiz(false)
    }
  }

  async function sendMcq() {
    if (!sessionId || !activeQuestion || pickedChoice == null) return
    setSubmitting(true)
    setErr(null)
    try {
      const r = await postMlPdfMcqAnswer(sessionId, {
        question_id: activeQuestion.id,
        choice_index: pickedChoice,
      })
      if (r.done) {
        setReport(r.report)
        setLevel(r.knowledge_level)
        setSecPdf(r.seconds_pdf)
        setAssessment(r.assessment ?? null)
        setRemedialItems(r.remedial_items ?? [])
        setActiveQuestion(null)
        setKembangkanPath(null)
        setReflectionByQuestionId({})
        setPhase('score_options')
        return
      }
      if (r.chapter_quiz_done && r.next_chapter_index != null) {
        setMaxUnlockedChapter((prev) => Math.max(prev, r.next_chapter_index!))
        setNextChapterAfterQuiz(r.next_chapter_index)
        setActiveQuestion(null)
        setCurrentStep(r.current_step)
        setTotalSteps(r.total_steps)
        setPhase('chapter_turn')
        return
      }
      if (r.question) {
        setChapterIndex(r.question.chapter_index)
        setActiveQuestion(r.question)
        setPickedChoice(null)
        setCurrentStep(r.current_step)
        setTotalSteps(r.total_steps)
      } else {
        setErr('Respons tidak valid. Muat ulang halaman.')
      }
    } catch (e) {
      setErr(readApiDetail(e) || 'Gagal mengirim jawaban.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!pdfId) {
    return <p className="text-sm text-theme-muted">ID buku tidak valid.</p>
  }

  const isPlus = category === 'belajar_plus'
  const ch = pdf?.chapters[chapterIndex]
  const panelClass = isPlus
    ? 'relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-zinc-950/30 p-5 shadow-lg shadow-fuchsia-500/10 ring-1 ring-white/10 backdrop-blur-sm md:p-6 dark:bg-zinc-950/40'
    : 'glass-panel border border-[var(--panel-border)] p-5 md:p-6'
  const panelClassQuiz = isPlus
    ? 'relative space-y-4 overflow-hidden rounded-2xl border border-rose-500/25 bg-gradient-to-b from-fuchsia-950/20 to-[var(--panel-bg)] p-5 ring-1 ring-fuchsia-500/15 md:p-6'
    : 'glass-panel space-y-4 border border-[var(--panel-border)] p-5 md:p-6'
  const panelClassDone = isPlus
    ? 'relative space-y-3 rounded-2xl border border-amber-500/20 bg-[var(--panel-bg)] p-5 shadow-md shadow-amber-500/5 ring-1 ring-amber-400/20 md:p-6'
    : 'glass-panel space-y-3 border border-[var(--panel-border)] p-5 md:p-6'
  const btnPrimary = isPlus
    ? 'rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-500/25 transition hover:brightness-105 focus-ring disabled:opacity-50'
    : 'rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 focus-ring'
  const btnGatePrimary = isPlus
    ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-rose-500/25 transition hover:brightness-105 focus-ring sm:flex-1'
    : 'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-3 text-sm font-semibold text-white transition hover:brightness-105 focus-ring sm:flex-1'
  const btnGateSecondary = isPlus
    ? 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-fuchsia-500/40 bg-fuchsia-950/20 px-4 py-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/10 focus-ring sm:flex-1'
    : 'inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-[var(--panel-bg)] px-4 py-3 text-sm font-semibold text-theme transition hover:bg-white/5 focus-ring sm:flex-1'
  const panelClassGate = isPlus
    ? 'relative space-y-4 overflow-hidden rounded-2xl border border-teal-500/25 bg-gradient-to-b from-teal-950/25 to-[var(--panel-bg)] p-5 ring-1 ring-emerald-500/20 md:p-6'
    : 'glass-panel space-y-4 border border-[var(--panel-border)] p-5 md:p-6'
  const panelClassKembang = isPlus
    ? 'relative space-y-4 overflow-hidden rounded-2xl border border-sky-500/25 bg-gradient-to-b from-fuchsia-950/15 to-[var(--panel-bg)] p-5 ring-1 ring-sky-500/15 md:p-6'
    : 'glass-panel space-y-4 border border-[var(--panel-border)] p-5 md:p-6'
  const isLastQuizStep = phase === 'quiz' && totalSteps > 0 && currentStep === totalSteps
  const quizChapterLabel = (activeQuestion?.chapter_index ?? chapterIndex) + 1

  return (
    <div className="relative space-y-6">
      {isPlus ? (
        <div
          className="pointer-events-none absolute inset-x-0 -top-6 h-56 rounded-[2rem] bg-gradient-to-b from-fuchsia-500/20 via-rose-500/10 to-transparent blur-2xl"
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
          <Link to="/petugas/pdf-ml" className="text-sm text-merah-bright hover:underline focus-ring">
            Daftar buku
          </Link>
        </div>
        <span className="text-xs text-theme-muted">Sesi: {sessionId ? sessionId.slice(-8) : '…'}</span>
      </motion.div>

      {err ? <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-theme">{err}</p> : null}

      {phase === 'load' || phase === 'reading' ? (
        <div className={panelClass}>
          {pdf && ch ? (
            <>
              {isPlus ? (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-fuchsia-600/90 to-rose-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-md shadow-rose-500/20">
                  Belajar ++ · Buku
                </div>
              ) : null}
              <h1 className={`text-xl font-bold ${isPlus ? 'bg-gradient-to-r from-fuchsia-600 via-rose-600 to-merah bg-clip-text text-transparent' : 'text-theme'}`}>
                {pdf.title}
              </h1>
              <p className="mt-2 text-sm font-semibold text-theme">
                Bab {chapterIndex + 1}: {ch.title}{' '}
                <span className="font-normal text-theme-muted">
                  (hal. {ch.page_start}–{ch.page_end})
                </span>
              </p>
              {pdf.description ? <p className="mt-1 text-sm text-theme-muted">{pdf.description}</p> : null}
              {pdf.chapters.length > 1 ? (
                <nav aria-label="Peta bab" className="mt-4 flex flex-wrap gap-2">
                  {pdf.chapters.map((c, i) => {
                    const active = i === chapterIndex
                    const locked = i > maxUnlockedChapter
                    const stepClass = isPlus
                      ? active
                        ? 'rounded-xl border border-fuchsia-400/40 bg-gradient-to-br from-fuchsia-600/25 to-rose-500/15 px-3 py-2 text-left text-xs shadow-sm ring-2 ring-fuchsia-400/35 transition focus-ring disabled:opacity-50'
                        : locked
                          ? 'rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-xs opacity-45 transition focus-ring disabled:opacity-50'
                          : 'rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs transition hover:bg-fuchsia-500/10 focus-ring disabled:opacity-50'
                      : active
                        ? 'rounded-xl border border-merah/30 bg-merah/12 px-3 py-2 text-left text-xs ring-2 ring-merah/35 transition focus-ring disabled:opacity-50'
                        : locked
                          ? 'rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/50 px-3 py-2 text-left text-xs opacity-45 transition focus-ring disabled:opacity-50'
                          : 'rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-left text-xs transition hover:bg-white/5 focus-ring disabled:opacity-50'
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={phase !== 'reading' || locked}
                        title={locked ? 'Selesaikan ujian bab sebelumnya dulu' : undefined}
                        onClick={() => setChapterIndex(i)}
                        className={stepClass}
                      >
                        <span className="font-semibold text-theme">Bab {i + 1}</span>
                        <span className="mt-0.5 block text-[10px] text-theme-muted">
                          hal. {c.page_start}–{c.page_end}
                        </span>
                      </button>
                    )
                  })}
                </nav>
              ) : null}
              <div className="mt-4">
                <PdfJsChapterViewer
                  pdfId={pdf.id}
                  pageStart={Math.max(1, ch.page_start)}
                  pageEnd={Math.max(ch.page_start, ch.page_end)}
                  fallbackDriveUrl={pdf.drive_url}
                />
              </div>
              <p className="mt-2 text-xs text-theme-muted">
                Pembaca menampilkan halaman dalam rentang bab (bukan embed Google Drive), dengan penghitung{' '}
                <strong className="font-medium text-theme/90">halaman dalam bab</strong>. Nomor halaman buku penuh tetap
                ditampilkan sebagai rujukan. Perlu unduhan langsung dari Drive jika pratinjau gagal. Durasi membaca dikirim ke
                server sebagai minat belajar.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  disabled={loadingQuiz || !sessionId}
                  onClick={() => void goChapterQuiz()}
                  className={btnPrimary}
                >
                  {loadingQuiz ? 'Menyiapkan asesmen (memanggil AI)…' : 'Lanjut ke asesmen bab ini'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-theme-muted">Memuat…</p>
          )}
        </div>
      ) : null}

      {phase === 'chapter_turn' && pdf && nextChapterAfterQuiz != null ? (
        <div className={panelClass}>
          <h2 className="text-lg font-semibold text-theme">Bab selesai</h2>
          <p className="mt-2 text-sm text-theme-muted">
            Lanjut membaca <strong className="text-theme">bab {nextChapterAfterQuiz + 1}</strong>, lalu kerjakan ujian
            bab berikutnya.
          </p>
          <button
            type="button"
            className={`mt-4 ${btnPrimary}`}
            onClick={() => {
              setChapterIndex(nextChapterAfterQuiz)
              setMaxUnlockedChapter((prev) => Math.max(prev, nextChapterAfterQuiz))
              setNextChapterAfterQuiz(null)
              setPhase('reading')
            }}
          >
            Lanjut ke bab berikutnya
          </button>
        </div>
      ) : null}

      {phase === 'quiz' && activeQuestion ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={panelClassQuiz}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">
            Asesmen pilihan ganda (AI) · bab {quizChapterLabel} · langkah {currentStep} / {totalSteps}
          </p>
          <h2 className="mt-3 text-balance text-lg font-semibold leading-snug text-theme md:text-xl">{activeQuestion.question}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {activeQuestion.choices.map((label, i) => {
              const selected = pickedChoice === i
              return (
                <li key={i}>
                  <label
                    className={`flex cursor-pointer gap-2 rounded-xl border px-3 py-3 text-left text-sm transition focus-within:ring-2 focus-within:ring-health-500/30 ${
                      selected
                        ? isPlus
                          ? 'border-fuchsia-500 bg-fuchsia-950/30 text-theme'
                          : 'border-health-500 bg-cyan-500/10 text-theme'
                        : 'border-[var(--panel-border)] bg-[var(--panel-bg)] text-theme hover:border-health-500/30'
                    } ${submitting ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <input
                      type="radio"
                      name={`ml-pdf-mcq-${activeQuestion.id}`}
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={selected}
                      onChange={() => setPickedChoice(i)}
                      disabled={submitting}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="font-bold tabular-nums text-merah-bright">{String.fromCharCode(65 + i)}. </span>
                      {label}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
          <button
            type="button"
            disabled={submitting || pickedChoice == null}
            onClick={() => void sendMcq()}
            className={`mt-4 w-full max-w-md py-2.5 text-sm font-semibold disabled:opacity-50 focus-ring ${isPlus ? 'rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white' : 'rounded-xl bg-gradient-to-r from-merah to-merah-bright text-white'}`}
          >
            {submitting
              ? 'Memproses…'
              : isLastQuizStep
                ? 'Kirim & lihat hasil'
                : 'Kirim & lanjut'}
          </button>
        </motion.div>
      ) : null}

      {phase === 'score_options' ? (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={panelClassGate}>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-theme-muted">Hasil asesmen</p>
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-theme md:text-2xl">Skor siap</h2>
          <p className="text-sm leading-relaxed text-theme-muted">
            Semua bab dan ujian pilihan ganda selesai. Anda dapat memperdalam dengan modul refleksi atau langsung membuka
            laporan.
          </p>
          <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 p-4">
            <p className="text-xs font-semibold text-theme">Ringkasan cepat</p>
            <div className="mt-2">
              <RingkasanSkorStrip assessment={assessment} level={level} secWatched={secPdf} engagementLabel="baca" />
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" className={btnGatePrimary} onClick={() => setPhase('kembangkan')}>
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
        </motion.div>
      ) : null}

      {phase === 'kembangkan' ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={panelClassKembang}>
          <KembangkanPengetahuanPanel
            isPlus={isPlus}
            videoTitle={pdf?.title ?? ''}
            videoPageLink={`/petugas/pdf-ml/${encodeURIComponent(pdfId)}`}
            assessment={assessment}
            remedialItems={remedialItems}
            narrativeReport={report}
            variant="inline"
            allowUserRewrite
            sessionId={sessionId}
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
            className={`flex w-full items-center justify-center gap-2 py-2.5 text-sm font-semibold focus-ring ${isPlus ? 'rounded-xl bg-gradient-to-r from-fuchsia-600 to-rose-500 text-white' : 'rounded-xl bg-gradient-to-r from-merah to-merah-bright text-white'}`}
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
          <h2 className="text-lg font-semibold text-theme">Laporan asesmen buku</h2>
          <section className="mt-4 space-y-2 rounded-2xl border border-health-500/20 bg-cyan-500/[0.04] p-4 md:p-5">
            <h3 className="text-base font-bold text-theme md:text-lg">1. Setelah kuis</h3>
            <LaporanAsesmenIsi
              assessment={assessment}
              report={report}
              level={level}
              secWatched={secPdf}
              detailsKeyPrefix="pdf-sebelum"
            />
          </section>
          <section className="mt-6 space-y-3 rounded-2xl border border-amber-500/20 bg-amber-500/[0.04] p-4 md:p-5">
            <h3 className="text-base font-bold text-theme md:text-lg">2. Refleksi / pengembangan</h3>
            {kembangkanPath === 'skipped' ? (
              <p className="text-sm text-theme-muted">
                Anda melewati modul pengembangan. Angka dan narasi mengacu pada bagian 1.
              </p>
            ) : (
              <ol className="space-y-3 text-sm">
                {Object.entries(reflectionByQuestionId)
                  .filter(([, t]) => t.trim().length > 0)
                  .map(([qid, text]) => (
                    <li key={qid} className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 p-3">
                      <p className="text-[11px] font-mono text-theme/70">{qid}</p>
                      <p className="mt-1 whitespace-pre-wrap text-theme">{text}</p>
                    </li>
                  ))}
              </ol>
            )}
          </section>
        </motion.div>
      ) : null}

      {phase === 'error' ? (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/petugas" className="font-medium text-theme underline">
            Kembali
          </Link>
          <Link to="/petugas/pdf-ml" className="text-merah-bright underline">
            Daftar buku
          </Link>
        </div>
      ) : null}
    </div>
  )
}
