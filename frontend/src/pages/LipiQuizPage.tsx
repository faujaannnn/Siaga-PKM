import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  downloadMySkriningPdf,
  downloadSertifikatPelatihan,
  fetchLipiEligibility,
  fetchLipiQuestions,
  fetchMyLipiResults,
  sendLipiReportWa,
  submitLipiQuiz,
} from '../api/client'
import type {
  LipiEligibility,
  LipiKuisStatus,
  LipiQuestion,
  LipiResult,
} from '../api/client'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'
import { useAuth } from '../context/AuthContext'
import { ConfirmDialog, useToast } from '../components/ToastProvider'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SECTION_META: Record<string, { label: string; color: string; desc: string }> = {
  dm: {
    label: 'Data Diri',
    color: 'health',
    desc: 'Informasi demografi dan latar belakang responden',
  },
  ed: {
    label: 'Efikasi Diri',
    color: 'health',
    desc: 'Keyakinan kemampuan diri menghadapi gempa di puskesmas',
  },
  pg: {
    label: 'Pengetahuan',
    color: 'cta',
    desc: 'Pengetahuan kesiapsiagaan gempa bumi (dinilai)',
  },
  sk: {
    label: 'Sikap',
    color: 'amber',
    desc: 'Sikap terhadap kesiapsiagaan bencana',
  },
  td: {
    label: 'Tindakan',
    color: 'merah',
    desc: 'Tindakan kesiapsiagaan yang sudah dilakukan',
  },
}

const SECTION_ORDER: string[] = ['dm', 'ed', 'pg', 'sk', 'td']

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
  }
  return arr
}

function buildSectionQuestionOrders(
  demographicQuestions: LipiQuestion[],
  mainQuestions: LipiQuestion[],
): Record<string, LipiQuestion[]> {
  const orders: Record<string, LipiQuestion[]> = {
    dm: [...demographicQuestions].sort((a, b) => a.number - b.number),
  }
  for (const sec of SECTION_ORDER) {
    if (sec === 'dm') continue
    orders[sec] = shuffleArray(mainQuestions.filter((q) => q.section === sec))
  }
  return orders
}

function sectionAnswerValue(
  q: LipiQuestion,
  demographics: Record<string, string>,
  answers: Record<string, string>,
): string | undefined {
  return q.section === 'dm' ? demographics[q.id] : answers[q.id]
}

function isSectionComplete(
  sec: string,
  sectionOrders: Record<string, LipiQuestion[]>,
  demographics: Record<string, string>,
  answers: Record<string, string>,
): boolean {
  const qs = sectionOrders[sec] ?? []
  if (qs.length === 0) return true
  return qs.every((q) => isQuestionAnswered(q, sectionAnswerValue(q, demographics, answers)))
}

function isSectionUnlocked(
  secIdx: number,
  sectionOrders: Record<string, LipiQuestion[]>,
  demographics: Record<string, string>,
  answers: Record<string, string>,
): boolean {
  if (secIdx <= 0) return true
  for (let i = 0; i < secIdx; i += 1) {
    const sec = SECTION_ORDER[i]
    if (!sec || !isSectionComplete(sec, sectionOrders, demographics, answers)) return false
  }
  return true
}

const LEVEL_CONFIG: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  Baik: {
    bg: 'bg-cta-500/[0.07]',
    text: 'text-cta-700',
    border: 'border-cta-600/30',
    icon: '✅',
  },
  Cukup: {
    bg: 'bg-amber-500/[0.07]',
    text: 'text-amber-800',
    border: 'border-amber-500/35',
    icon: '🟡',
  },
  Kurang: {
    bg: 'bg-merah/[0.06]',
    text: 'text-merah',
    border: 'border-merah/25',
    icon: '🔴',
  },
  Buruk: {
    bg: 'bg-merah/[0.06]',
    text: 'text-merah',
    border: 'border-merah/25',
    icon: '🔴',
  },
}

const ED_LEVEL_CONFIG: Record<string, { bg: string; text: string }> = {
  Tinggi: { bg: 'bg-cta-500/[0.09]', text: 'text-cta-700' },
  Sedang: { bg: 'bg-amber-500/[0.09]', text: 'text-amber-800' },
  Rendah: { bg: 'bg-merah/[0.06]', text: 'text-merah' },
}

function getEdLevelConfig(level: string) {
  return ED_LEVEL_CONFIG[level] ?? ED_LEVEL_CONFIG['Sedang']
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function getLevelConfig(level: string) {
  return LEVEL_CONFIG[level] ?? LEVEL_CONFIG['Cukup']
}

function formatSectionReviewScore(sec: LipiResult['sections_to_review'][number]) {
  if (sec.score_unit === 'ed_scale') {
    return `${sec.score.toFixed(0)}/40`
  }
  return `${sec.score.toFixed(0)}/100`
}

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const r = size * 0.4
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
  const color =
    score >= 76
      ? '#059669'
      : score >= 56
        ? '#d97706'
        : '#c41e3a'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(6,182,212,0.15)"
        strokeWidth={size * 0.07}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.07}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 1s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size * 0.2}
        fontWeight="700"
        fill={color}
      >
        {score.toFixed(0)}
      </text>
    </svg>
  )
}

function IndexBadge({ score, size = 120 }: { score: number; size?: number }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const pct = Math.min(100, Math.max(0, score))
  const offset = circ - (pct / 100) * circ
  const color = score >= 80 ? '#27AE60' : score >= 60 ? '#F39C12' : '#E74C3C'
  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={size * 0.08} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.08}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black" style={{ color }}>{score.toFixed(0)}</span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Indeks</span>
      </div>
    </div>
  )
}

function CategoryBar({
  label,
  score,
  color,
}: {
  label: string
  score: number
  color: string
}) {
  const barColor =
    color === 'health'
      ? 'from-health-600 to-health-500'
      : color === 'cta'
        ? 'from-cta-700 to-cta-500'
        : color === 'amber'
          ? 'from-amber-700 to-amber-500'
          : 'from-merah to-merah-bright'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-theme">{label}</span>
        <span className="tabular-nums font-semibold text-theme">{score.toFixed(0)}/100</span>
      </div>
      <div className="progress-bar-track">
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r ${barColor}`}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, ease: easeOutExpo, delay: 0.2 }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Results Panel (for individual pre/post test results)
// ---------------------------------------------------------------------------

function ResultsPanel({
  result,
  onRetake,
  canRetake = false,
  retakeLabel = 'Ikuti tes ulang',
  waLinked,
  onSendWaReport,
  waSending,
  waSendOk,
  waSendErr,
}: {
  result: LipiResult
  onRetake: () => void
  canRetake?: boolean
  retakeLabel?: string
  waLinked: boolean
  onSendWaReport?: () => void
  waSending?: boolean
  waSendOk?: string | null
  waSendErr?: string | null
}) {
  const pgLevel = result.pengetahuan_level ?? result.level
  const lvlCfg = getLevelConfig(pgLevel)
  const pgScore = result.pengetahuan_score ?? result.kap_score ?? result.total_score
  const pgEarned = result.pengetahuan_earned
  const pgMax = result.pengetahuan_max ?? result.kap_max ?? 8
  const edScore = result.efikasi_diri_score
  const edLevel = result.efikasi_diri_level
  const skScore = result.sikap_score
  const skLevel = result.sikap_level
  const tdScore = result.tindakan_score
  const tdLevel = result.tindakan_level
  const tdScored = result.td_scored !== false && tdScore != null

  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: easeOutExpo }}
      className="space-y-5"
    >
      {/* Score Hero */}
      <div
        className={`rounded-2xl border-2 ${lvlCfg.border} ${lvlCfg.bg} p-6 shadow-sm`}
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col items-center gap-1">
            <ScoreRing score={pgScore} size={110} />
            <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">
              Skor Pengetahuan
            </p>
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">
              Kategori Pengetahuan
            </p>
            <h2 className={`mt-1 text-3xl font-bold ${lvlCfg.text}`}>
              {pgLevel}
            </h2>
            {pgEarned != null ? (
              <p className="mt-1 text-sm text-theme-muted">
                {pgEarned}/{pgMax} jawaban benar ({pgScore.toFixed(0)}%)
              </p>
            ) : null}
            <p className="mt-1 text-sm text-theme-muted">
              {result.attempt_label ?? 'Pre-test'} · selesai pada{' '}
              {result.submitted_at
                ? new Date(result.submitted_at).toLocaleString('id-ID', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })
                : '-'}
            </p>
            {canRetake ? (
              <button
                type="button"
                onClick={onRetake}
                className="btn-ghost mt-3 px-3 py-1.5 text-sm"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                {retakeLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Pengetahuan score + pending Likert sections */}
      <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-health-600" aria-hidden />
          <h3 className="text-sm font-semibold text-theme">Hasil Penilaian</h3>
        </div>
        <CategoryBar label="Pengetahuan" score={pgScore} color="cta" />
        {skScore != null ? (
          <div className="mt-4">
            <CategoryBar label="Sikap (HBM-TPB)" score={skScore} color="health" />
            {skLevel ? (
              <p className="mt-1 text-xs text-theme-muted">Kategori sikap: <strong>{skLevel}</strong></p>
            ) : null}
          </div>
        ) : null}
        {tdScored && tdScore != null ? (
          <div className="mt-4">
            <CategoryBar label="Tindakan" score={tdScore} color="merah" />
            {tdLevel ? (
              <p className="mt-1 text-xs text-theme-muted">
                Kategori tindakan: <strong>{tdLevel}</strong>
                {' '}(Baik ≥50%, Buruk di bawah 50%)
              </p>
            ) : null}
          </div>
        ) : null}
        {edScore != null ? (
          <div className="mt-4 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-theme">Efikasi Diri (GSES)</span>
              <span className="tabular-nums font-semibold text-theme">
                {edScore.toFixed(0)}/40
              </span>
            </div>
            {edLevel ? (
              <p className={`mt-1 text-xs font-semibold ${getEdLevelConfig(edLevel).text}`}>
                {edLevel}
                {result.efikasi_diri_raw != null
                  ? ` (jumlah mentah ${result.efikasi_diri_raw}/60)`
                  : ''}
              </p>
            ) : null}
          </div>
        ) : null}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(['ed', 'sk', 'td'] as const).map((sec) => {
            const meta = SECTION_META[sec]
            if (sec === 'ed' && edScore != null && edLevel) {
              const edCfg = getEdLevelConfig(edLevel)
              return (
                <div
                  key={sec}
                  className={`rounded-xl border p-2.5 text-center text-xs ${edCfg.bg} border-[var(--panel-border)]`}
                >
                  <div className={`font-bold tabular-nums ${edCfg.text}`}>{edScore.toFixed(0)}/40</div>
                  <div className="leading-tight text-[10px] mt-0.5">{meta.label}</div>
                  <div className={`text-[10px] mt-0.5 ${edCfg.text}`}>{edLevel}</div>
                </div>
              )
            }
            if (sec === 'sk' && skScore != null && skLevel) {
              const skCfg = getLevelConfig(skLevel)
              return (
                <div
                  key={sec}
                  className={`rounded-xl border p-2.5 text-center text-xs ${skCfg.bg} border-[var(--panel-border)]`}
                >
                  <div className={`font-bold tabular-nums ${skCfg.text}`}>{skScore.toFixed(0)}%</div>
                  <div className="leading-tight text-[10px] mt-0.5">{meta.label}</div>
                  <div className={`text-[10px] mt-0.5 ${skCfg.text}`}>{skLevel}</div>
                </div>
              )
            }
            if (sec === 'td') {
              if (tdScored && tdScore != null && tdLevel) {
                const tdCfg = getLevelConfig(tdLevel)
                return (
                  <div
                    key={sec}
                    className={`rounded-xl border p-2.5 text-center text-xs ${tdCfg.bg} border-[var(--panel-border)]`}
                  >
                    <div className={`font-bold tabular-nums ${tdCfg.text}`}>{tdScore.toFixed(0)}%</div>
                    <div className="leading-tight text-[10px] mt-0.5">{meta.label}</div>
                    <div className={`text-[10px] mt-0.5 ${tdCfg.text}`}>{tdLevel}</div>
                  </div>
                )
              }
              return (
                <div
                  key={sec}
                  className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-2.5 text-center text-xs text-theme-muted"
                >
                  <div className="font-bold text-theme-soft">-</div>
                  <div className="leading-tight text-[10px] mt-0.5">{meta.label}</div>
                  <div className="text-[10px] text-theme-soft">Belum dinilai</div>
                </div>
              )
            }
            return null
          })}
        </div>
      </div>

      {/* AI Recommendation */}
      {result.ai_recommendation ? (
        <div className="glass-panel rounded-2xl border border-health-500/30 bg-gradient-to-br from-cyan-500/[0.07] via-transparent to-health-500/[0.05] p-5">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-health-600" aria-hidden />
            <h3 className="text-sm font-semibold text-theme">Rekomendasi</h3>
            <span className="ml-auto rounded-full bg-health-100 px-2 py-0.5 text-[10px] font-medium text-health-800">
              Dipersonalisasi
            </span>
          </div>
          <p className="text-sm leading-relaxed text-theme-muted">{result.ai_recommendation}</p>
        </div>
      ) : null}

      {/* Sections to Review */}
      {result.sections_to_review.length > 0 ? (
        <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600" aria-hidden />
            <h3 className="text-sm font-semibold text-theme">Materi yang Perlu Dipelajari Ulang</h3>
          </div>
          <p className="mb-3 text-xs text-theme-muted">
            Berdasarkan hasil tes, pelajari kembali materi berikut untuk meningkatkan skor:
          </p>
          <ul className="space-y-2">
            {result.sections_to_review.map((sec) => {
              const meta = SECTION_META[sec.category]
              return (
                <li
                  key={sec.category}
                  className="flex items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50/50 px-3 py-2.5"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-amber-900">{sec.label}</p>
                    <p className="text-xs text-amber-700">{meta?.desc}</p>
                  </div>
                  <span className="rounded-full bg-amber-200/70 px-2 py-0.5 text-xs font-bold tabular-nums text-amber-900">
                    {formatSectionReviewScore(sec)}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/petugas/video-ml"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-health-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition duration-200 hover:bg-health-700 focus-ring"
            >
              <FileText className="h-4 w-4" aria-hidden />
              Buka Video
            </Link>
          </div>
        </div>
      ) : null}

      {/* Wrong Answers Breakdown */}
      {result.wrong_items.length > 0 ? (
        <details className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]">
          <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-5 py-4 text-sm font-medium text-theme focus-ring rounded-2xl">
            <XCircle className="h-4 w-4 text-merah" aria-hidden />
            Jawaban yang Perlu Diperbaiki ({result.wrong_items.length} item)
            <ChevronRight className="ml-auto h-4 w-4 text-theme-muted transition duration-200 group-open:rotate-90" />
          </summary>
          <div className="space-y-2 px-5 pb-5">
            {result.wrong_items.map((item) => {
              const secLabel = SECTION_META[item.section]?.label ?? item.section.toUpperCase()
              return (
                <div
                  key={item.sub_id}
                  className="rounded-xl border border-merah/20 bg-merah/[0.04] px-3 py-2.5 text-xs"
                >
                  <p className="mb-0.5 font-medium text-theme">{item.sub_text}</p>
                  <p className="text-merah/90">
                    Jawaban Anda:{' '}
                    <strong>{item.your_answer_text ?? item.your_answer}</strong>
                    {' · '}
                    Seharusnya:{' '}
                    <strong className="text-cta-700">
                      {item.correct_answer_text ?? item.correct_answer}
                    </strong>
                  </p>
                  <p className="mt-0.5 text-theme-soft">[{secLabel}]</p>
                </div>
              )
            })}
          </div>
        </details>
      ) : null}

      <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-emerald-600" aria-hidden />
          <h3 className="text-sm font-semibold text-theme">Kirim ke WhatsApp</h3>
        </div>
        {waLinked ? (
          <>
            <p className="mb-3 text-xs text-theme-muted">
              Kirim ringkasan hasil kuis ke nomor WhatsApp yang sudah tertaut ke akun Anda.
            </p>
            <button
              type="button"
              onClick={onSendWaReport}
              disabled={waSending}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-emerald-700 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {waSending ? 'Mengirim…' : 'Kirim laporan ke WhatsApp'}
            </button>
            {waSendOk ? (
              <p className="mt-2 text-sm text-cta-700">{waSendOk}</p>
            ) : null}
            {waSendErr ? (
              <p className="mt-2 text-sm text-merah">{waSendErr}</p>
            ) : null}
          </>
        ) : (
          <>
            <p className="mb-3 text-xs text-theme-muted">
              Hubungkan nomor WhatsApp terlebih dahulu agar laporan bisa dikirim otomatis.
            </p>
            <Link
              to="/petugas?tab=wa"
              className="btn-secondary"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              Hubungkan WhatsApp
            </Link>
          </>
        )}
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// HasilPanel — shown when post-test is done (replaces quiz button)
// ---------------------------------------------------------------------------

function DimensionBar({ label, score, max = 100, icon: Icon }: { label: string; score: number; max?: number; icon: typeof Brain }) {
  const pct = Math.min(100, (score / max) * 100)
  const color =
    pct >= 76 ? '#27AE60' : pct >= 56 ? '#F39C12' : '#E74C3C'
  return (
    <div className="flex items-start gap-3 rounded-xl border border-emerald-100/60 bg-emerald-50/40 px-4 py-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
        <Icon className="h-4 w-4 text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="font-medium text-emerald-800">{label}</span>
          <span className="font-bold tabular-nums text-emerald-700">{pct.toFixed(0)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: color }}
          />
        </div>
        <p className="mt-1 text-xs text-emerald-600">
          {pct >= 76 ? '✓ Baik' : pct >= 56 ? '⚠ Cukup' : '✗ Kurang'} · {score.toFixed(0)}/{max}
        </p>
      </div>
    </div>
  )
}

function AiSection({ recommendation }: { recommendation: string }) {
  if (!recommendation) return null
  let parsed: Record<string, unknown> | null = null
  if (recommendation.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(recommendation)
    } catch {
      // not JSON
    }
  }
  if (parsed) {
    const sections: Array<{ key: string; label: string; color: string; icon: typeof Brain }> = [
      { key: 'overall_analysis', label: 'Analisis Keseluruhan', color: 'emerald', icon: Brain },
      { key: 'key_findings', label: 'Temuan Kunci', color: 'health', icon: TrendingUp },
      { key: 'recommendations', label: 'Rekomendasi', color: 'amber', icon: ShieldCheck },
    ]
    return (
      <div className="space-y-3">
        {sections.map(({ key, label, icon: Icon }) => {
          const content = parsed?.[key]
          if (!content) return null
          const items = Array.isArray(content) ? content : [content]
          return (
            <div key={key} className="rounded-xl border border-slate-100 bg-white px-4 py-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <Icon className="h-3.5 w-3.5" /> {label}
              </p>
              {items.map((item, i) => (
                <p key={i} className="text-sm leading-relaxed text-slate-600">{String(item)}</p>
              ))}
            </div>
          )
        })}
      </div>
    )
  }
  // Plain text
  return (
    <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/40 px-4 py-3">
      <p className="text-sm leading-relaxed text-slate-600">{recommendation}</p>
    </div>
  )
}

function parseCompositeIndex(result: LipiResult): number {
  const pg = result.pengetahuan_score ?? 0
  const sk = result.sikap_score ?? 0
  const td = result.tindakan_score ?? 0
  const hasSk = result.sikap_score != null && result.sikap_score > 0
  if (hasSk) {
    return (pg + sk + td) / 3
  }
  return (pg + td) / 2
}

function indexLevel(score: number): string {
  if (score >= 80) return 'Tinggi'
  if (score >= 60) return 'Menengah'
  return 'Rendah'
}

function indexLevelBadge(level: string): string {
  if (level === 'Tinggi') return 'bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300'
  if (level === 'Menengah') return 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
  return 'bg-rose-100 text-rose-700 ring-1 ring-rose-300'
}

function QuizFlowSteps({ status }: { status?: LipiKuisStatus }) {
  const s = status ?? 'belum'
  const steps: { key: string; label: string; state: 'todo' | 'current' | 'done' }[] = [
    { key: 'awal', label: 'Kuesioner awal', state: s === 'belum' ? 'current' : 'done' },
    {
      key: 'post',
      label: 'Post-test',
      state: s === 'lengkap' ? 'done' : s === 'post_menunggu' ? 'current' : 'todo',
    },
    { key: 'hasil', label: 'Hasil', state: s === 'lengkap' ? 'done' : 'todo' },
  ]
  return (
    <div className="grid grid-cols-3 gap-2" role="list" aria-label="Alur kuesioner">
      {steps.map((step) => {
        const hasil = step.key === 'hasil' && step.state === 'done'
        const current = step.state === 'current'
        const done = step.state === 'done'
        return (
          <div
            key={step.key}
            role="listitem"
            className={`rounded-xl border px-2 py-2.5 text-center text-xs font-semibold ${
              hasil
                ? 'border-emerald-500 bg-emerald-600 text-white'
                : current
                  ? 'border-health-500 bg-health-600 text-white'
                  : done
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-[var(--panel-border)] bg-[var(--panel-bg)] text-theme-muted'
            }`}
          >
            {step.label}
          </div>
        )
      })}
    </div>
  )
}

function certificateOffer(me: {
  username?: string
  display_name?: string | null
  puskesmas_nama?: string | null
  research_wilayah?: string | null
} | null | undefined): { label: string; initialName: string } | null {
  const blob = `${me?.puskesmas_nama ?? ''} ${me?.research_wilayah ?? ''} ${me?.username ?? ''}`.toLowerCase()
  const label = blob.includes('pantoloan')
    ? 'Puskesmas Pantoloan'
    : blob.includes('talise')
      ? 'Puskesmas Talise'
      : null
  if (!label) return null
  return { label, initialName: me?.display_name?.trim() ?? '' }
}

function SertifikatCard({
  puskesmasLabel,
  initialName,
}: {
  puskesmasLabel: string
  initialName: string
}) {
  const [nama, setNama] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  const unduh = async () => {
    const trimmed = nama.trim()
    if (trimmed.length < 2) {
      setErr('Isi nama lengkap, minimal 2 karakter.')
      setOk(false)
      return
    }
    setBusy(true)
    setErr(null)
    setOk(false)
    try {
      await downloadSertifikatPelatihan(trimmed)
      setOk(true)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Gagal mengunduh sertifikat.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-2xl border border-sky-200/80 bg-gradient-to-br from-sky-50/90 via-white to-white p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Award className="h-4 w-4 text-sky-700" aria-hidden />
        <h3 className="text-sm font-semibold text-sky-900">Sertifikat pelatihan</h3>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-slate-600">
        Isi nama lengkap. Nama itu langsung tercetak di kolom “Diberikan kepada” pada sertifikat {puskesmasLabel}.
      </p>
      <label className="block text-xs font-semibold text-slate-700" htmlFor="sertifikat-nama">
        Nama di sertifikat
        <input
          id="sertifikat-nama"
          value={nama}
          maxLength={80}
          autoComplete="name"
          onChange={(e) => {
            setNama(e.target.value)
            setOk(false)
            setErr(null)
          }}
          className="mt-1.5 w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
          placeholder="Nama lengkap peserta"
        />
      </label>
      <button
        type="button"
        onClick={() => void unduh()}
        disabled={busy}
        className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
      >
        <Award className="h-4 w-4" aria-hidden />
        {busy ? 'Menyiapkan sertifikat…' : 'Unduh sertifikat'}
      </button>
      {ok ? (
        <p className="mt-2 text-sm text-emerald-700">Sertifikat terunduh. Periksa nama di bagian “Diberikan kepada”.</p>
      ) : null}
      {err ? <p className="mt-2 text-sm text-rose-600">{err}</p> : null}
    </div>
  )
}

function HasilPanel({
  result,
  waLinked,
  onSendWaReport,
  certificate,
}: {
  result: LipiResult
  waLinked: boolean
  onSendWaReport?: () => void
  certificate?: { label: string; initialName: string } | null
}) {
  const [downloading, setDownloading] = useState(false)
  const [downloadErr, setDownloadErr] = useState<string | null>(null)
  const index = parseCompositeIndex(result)
  const lvl = indexLevel(index)

  const pgScore = result.pengetahuan_score ?? 0
  const skScore = result.sikap_score
  const tdScore = result.tindakan_score ?? 0
  const edScore = result.efikasi_diri_score
  const edLevel = result.efikasi_diri_level

  const handleDownloadPdf = async () => {
    setDownloading(true)
    setDownloadErr(null)
    try {
      await downloadMySkriningPdf()
    } catch (e) {
      setDownloadErr(e instanceof Error ? e.message : 'Gagal mengunduh laporan.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Hero Hijau */}
      <div
        className="rounded-2xl border-2 border-emerald-300/60 bg-gradient-to-br from-emerald-500 to-emerald-700 p-6 text-white shadow-lg"
      >
        <div className="mb-4 flex flex-col items-center gap-4 sm:flex-row">
          <IndexBadge score={index} size={140} />
          <div className="flex-1 text-center sm:text-left">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-100">Hasil Skrining</p>
            <h2 className="mt-1 text-2xl font-black">Tingkat Kesiapsiagaan</h2>
            <p className="mt-1 text-sm text-emerald-100">
              {result.attempt_label ?? 'Post-test'} ·{' '}
              {result.submitted_at
                ? new Date(result.submitted_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
                : '-'}
            </p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5">
              <span className="text-sm font-medium text-white">Tingkat:</span>
              <span
                className={`rounded-full px-3 py-0.5 text-sm font-bold uppercase tracking-wide ${indexLevelBadge(lvl)}`}
              >
                {lvl}
              </span>
            </div>
          </div>
        </div>
        <p className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-center text-sm text-emerald-50">
          Indeks = rata-rata (Pengetahuan + Sikap + Tindakan) / 3 · Adil: setiap dimensi berbobot sama
        </p>
      </div>

      {/* Skor Dimensi */}
      <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-emerald-700">Skor per Dimensi</h3>
        </div>
        <div className="space-y-3">
          <DimensionBar label="Pengetahuan (PG)" score={pgScore} icon={Brain} />
          {skScore != null && skScore > 0 ? (
            <DimensionBar label="Sikap (SK)" score={skScore} icon={ShieldCheck} />
          ) : (
            <div className="flex items-start gap-3 rounded-xl border border-amber-100/60 bg-amber-50/40 px-4 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <ShieldCheck className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-amber-800">Sikap (SK)</p>
                <p className="text-xs text-amber-600">Belum terukur (pre-test tidak mencakup sikap)</p>
              </div>
            </div>
          )}
          <DimensionBar label="Tindakan (TD)" score={tdScore} icon={Activity} />
        </div>

        {/* Efikasi Diri */}
        {edScore != null ? (
          <div className="mt-3 rounded-xl border border-violet-100/60 bg-violet-50/40 px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-violet-800">Efikasi Diri (GSES)</span>
              <span className="font-bold tabular-nums text-violet-700">{edScore.toFixed(0)}/40</span>
            </div>
            {edLevel ? (
              <p className="mt-1 text-xs text-violet-600">
                Kategori: <strong>{edLevel}</strong>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Analisis AI */}
      {result.ai_recommendation ? (
        <div className="glass-panel rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50/60 via-white to-emerald-50/40 p-5">
          <div className="mb-3 flex items-center gap-2">
            <Brain className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-emerald-700">Analisis &amp; Rekomendasi AI</h3>
            <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
              DeepSeek
            </span>
          </div>
          <AiSection recommendation={result.ai_recommendation} />
        </div>
      ) : null}

      {/* Titik Penting Penelitian */}
      <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
        <div className="mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-amber-600" />
          <h3 className="text-sm font-semibold text-amber-700">Titik Penting Penelitian</h3>
        </div>
        <div className="space-y-2 text-sm text-slate-600">
          {(() => {
            const dims = [
              { label: 'Pengetahuan', score: pgScore, threshold: 76, desc: 'pemahaman konsep kesiapsiagaan gempa' },
              { label: 'Sikap', score: skScore ?? 0, threshold: 76, desc: 'sikap terhadap kesiapsiagaan', skip: skScore == null || skScore === 0 },
              { label: 'Tindakan', score: tdScore, threshold: 50, desc: 'tindakan nyata kesiapsiagaan' },
            ].filter(d => !d.skip)

            const lowest = dims.reduce((a, b) => (a.score / a.threshold < b.score / b.threshold ? a : b))
            const dimsNeedingWork = dims.filter(d => (d.score / d.threshold) < 1)

            return (
              <>
                <p>
                  Dimensi dengan skor relatif terendah:{' '}
                  <strong className="text-amber-700">{lowest.label}</strong> ({lowest.score.toFixed(0)}% dari
                  ambang {lowest.threshold}%). Perlu penguatan pada {lowest.desc}.
                </p>
                {dimsNeedingWork.length > 0 ? (
                  <p>
                    Perlu penguatan pada:{' '}
                    {dimsNeedingWork.map(d => d.label).join(', ')}.
                  </p>
                ) : (
                  <p className="text-emerald-600">
                    ✓ Semua dimensi sudah di atas ambang kategori baik.
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    to="/petugas/video-ml"
                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-health-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-health-700 focus-ring"
                  >
                    <FileText className="h-4 w-4" />
                    Tonton Video ML
                  </Link>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* Jawaban Salah */}
      {result.wrong_items && result.wrong_items.length > 0 ? (
        <details className="group rounded-2xl border border-rose-200/60 bg-rose-50/30">
          <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-5 py-4 text-sm font-semibold text-rose-700 focus-ring">
            <XCircle className="h-4 w-4 shrink-0 text-rose-500" />
            Jawaban yang Perlu Diperbaiki ({result.wrong_items.length} butir)
            <ChevronRight className="ml-auto h-4 w-4 text-rose-400 transition group-open:rotate-90" />
          </summary>
          <div className="space-y-2 px-5 pb-5">
            {result.wrong_items.map((item) => (
              <div
                key={item.sub_id}
                className="rounded-xl border border-rose-100 bg-white px-3.5 py-3 text-xs shadow-sm"
              >
                <p className="mb-1.5 font-medium text-slate-700">
                  {item.sub_text}
                </p>
                <div className="flex flex-wrap gap-4 text-slate-500">
                  <span>
                    Jawaban Anda:{' '}
                    <strong className="font-semibold text-rose-600">
                      {item.your_answer_text || item.your_answer}
                    </strong>
                  </span>
                  <span>
                    Seharusnya:{' '}
                    <strong className="font-semibold text-emerald-600">
                      {item.correct_answer_text || item.correct_answer}
                    </strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Semua jawaban pengetahuan benar! Skor {pgScore.toFixed(0)}%.
        </div>
      )}

      {certificate ? (
        <SertifikatCard puskesmasLabel={certificate.label} initialName={certificate.initialName} />
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleDownloadPdf}
          disabled={downloading}
          className="inline-flex cursor-pointer items-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:border-emerald-400 hover:bg-emerald-700 disabled:opacity-60 focus-ring"
        >
          <FileText className="h-4 w-4" />
          {downloading ? 'Mengunduh…' : 'Unduh PDF Laporan'}
        </button>
        {downloadErr ? (
          <p className="w-full text-sm text-rose-600">{downloadErr}</p>
        ) : null}
        {waLinked ? (
          <button
            type="button"
            onClick={onSendWaReport}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-ring"
          >
            <MessageCircle className="h-4 w-4" />
            Kirim ke WhatsApp
          </button>
        ) : (
          <Link
            to="/petugas?tab=wa"
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-ring"
          >
            <MessageCircle className="h-4 w-4" />
            Hubungkan WhatsApp
          </Link>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Answer Button
// ---------------------------------------------------------------------------

function AnswerButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-xl border px-3 py-2 text-sm font-medium transition duration-200 focus-ring ${
        selected
          ? 'border-health-500/50 bg-health-500/[0.1] text-health-800 ring-2 ring-health-400/30'
          : 'border-[var(--panel-border)] bg-[var(--panel-bg)] text-theme-muted hover:border-health-400/60 hover:text-theme'
      }`}
    >
      {label}
    </button>
  )
}

const ANSWER_LABELS: Record<string, string> = {
  ss: 'SS',
  s: 'S',
  ks: 'KS',
  ts: 'TS',
  sts: 'STS',
  a: 'A',
  b: 'B',
  c: 'C',
  d: 'D',
  '1': '1',
  '2': '2',
  '3': '3',
  '4': '4',
}


const LIKERT_4_LABELS: Record<string, string> = {
  '1': '1 · Sangat setuju',
  '2': '2 · Setuju',
  '3': '3 · Kurang setuju',
  '4': '4 · Tidak setuju',
}

const LIKERT_5_LABELS: Record<string, string> = {
  ss: 'SS · Sangat setuju',
  s: 'S · Setuju',
  ks: 'KS · Kurang setuju',
  ts: 'TS · Tidak setuju',
  sts: 'STS · Sangat tidak setuju',
}

function Likert4ScaleGuide({ scoringNote }: { scoringNote?: string }) {
  return (
    <div className="mt-3 rounded-xl border border-violet-200/80 bg-violet-50/70 px-4 py-3 text-xs text-theme-muted">
      <p className="font-semibold text-violet-900">Petunjuk skala jawaban (Likert 1-4)</p>
      <p className="mt-1.5 leading-relaxed">
        Setiap pernyataan dinilai seberapa sesuai dengan kondisi Anda. Angka <strong>1</strong> berarti{' '}
        <strong>paling setuju</strong>; angka <strong>4</strong> berarti <strong>paling tidak setuju</strong>. Jangan
        terbalik: bukan semakin besar angka semakin baik.
      </p>
      <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
        <li>
          <strong className="text-theme">1</strong> · Sangat setuju
        </li>
        <li>
          <strong className="text-theme">2</strong> · Setuju
        </li>
        <li>
          <strong className="text-theme">3</strong> · Kurang setuju
        </li>
        <li>
          <strong className="text-theme">4</strong> · Tidak setuju
        </li>
      </ul>
      {scoringNote ? <p className="mt-2 text-[11px] leading-relaxed text-theme-soft">{scoringNote}</p> : null}
    </div>
  )
}

function Likert5ScaleGuide({ scoringNote, title }: { scoringNote?: string; title?: string }) {
  return (
    <div className="mt-3 rounded-xl border border-amber-200/80 bg-amber-50/70 px-4 py-3 text-xs text-theme-muted">
      <p className="font-semibold text-amber-900">
        {title ?? 'Petunjuk skala jawaban (Likert SS–STS)'}
      </p>
      <p className="mt-1.5 leading-relaxed">
        Bagian ini mengukur sikap Anda terhadap kesiapsiagaan gempa (HBM-TPB). Pilih seberapa setuju Anda dengan
        setiap pernyataan. <strong>SS (sangat setuju)</strong> berarti paling positif;{' '}
        <strong>STS (sangat tidak setuju)</strong> berarti paling negatif.
      </p>
      <ul className="mt-2 space-y-1.5">
        <li>
          <strong className="text-theme">SS</strong> · Sangat setuju <span className="text-theme-soft">(5 poin)</span>
        </li>
        <li>
          <strong className="text-theme">S</strong> · Setuju <span className="text-theme-soft">(4 poin)</span>
        </li>
        <li>
          <strong className="text-theme">KS</strong> · Kurang setuju <span className="text-theme-soft">(3 poin)</span>
        </li>
        <li>
          <strong className="text-theme">TS</strong> · Tidak setuju <span className="text-theme-soft">(2 poin)</span>
        </li>
        <li>
          <strong className="text-theme">STS</strong> · Sangat tidak setuju{' '}
          <span className="text-theme-soft">(1 poin)</span>
        </li>
      </ul>
      {scoringNote ? (
        <p className="mt-2 text-[11px] leading-relaxed text-theme-soft">{scoringNote}</p>
      ) : (
        <p className="mt-2 text-[11px] leading-relaxed text-theme-soft">
          Penilaian: jumlah poin dibagi 75 (15 soal × 5) × 100%. Kategori: Baik ≥76%, Cukup 56–75%, Kurang di
          bawah 56%.
        </p>
      )}
    </div>
  )
}

function SikapScaleGuide() {
  return (
    <Likert5ScaleGuide
      title="Petunjuk skala jawaban sikap (Likert SS–STS)"
      scoringNote="Penilaian: jumlah poin dibagi 75 (15 soal × 5) × 100%. Kategori: Baik ≥76%, Cukup 56–75%, Kurang di bawah 56%."
    />
  )
}

function likertLabel(opt: string, type: LipiQuestion['type']) {
  if (type === 'likert_4') {
    return LIKERT_4_LABELS[opt] ?? opt
  }
  if (type === 'likert_5') {
    return LIKERT_5_LABELS[opt] ?? ANSWER_LABELS[opt] ?? opt
  }
  return opt
}

function isQuestionAnswered(q: LipiQuestion, value: string | undefined) {
  if (value === undefined) return false
  if (q.type === 'text') return value.trim().length > 0
  return true
}

// ---------------------------------------------------------------------------
// Quiz Section
// ---------------------------------------------------------------------------

function QuizSection({
  section,
  sectionQuestions,
  answers,
  onAnswer,
  attemptType,
  highlightedIds,
  validationErrors,
}: {
  section: string
  sectionQuestions: LipiQuestion[]
  answers: Record<string, string>
  onAnswer: (questionId: string, value: string) => void
  attemptType: 'pre_test' | 'post_test'
  highlightedIds?: Set<string>
  validationErrors?: Record<string, string>
}) {
  const isPostTest = attemptType === 'post_test'
  const meta = SECTION_META[section]

  const answeredCount = sectionQuestions.filter((q) => isQuestionAnswered(q, answers[q.id])).length
  const totalCount = sectionQuestions.length
  const shuffleNote =
    section !== 'dm' ? (
      <p className="mt-1 text-xs text-theme-soft">Urutan soal di bagian ini diacak khusus untuk Anda.</p>
    ) : null

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p
            className={`text-xs font-semibold uppercase tracking-wide ${
              meta.color === 'health'
                ? 'text-health-600'
                : meta.color === 'cta'
                  ? 'text-cta-600'
                  : meta.color === 'amber'
                    ? 'text-amber-600'
                    : 'text-merah'
            }`}
          >
            {meta.label}
          </p>
          <p className="text-sm text-theme-muted">{meta.desc}</p>
          {shuffleNote}
          {section === 'dm' ? (
            <p className="mt-1 text-xs text-theme-muted">Isi data diri Anda sebelum melanjutkan ke kuesioner utama.</p>
          ) : section === 'pg' ? (
            <p className="mt-1 text-xs text-cta-700">Bagian ini dinilai (benar/salah).</p>
          ) : section === 'td' ? (
            isPostTest ? (
              <Likert5ScaleGuide
                title="Petunjuk skala jawaban tindakan (post-test)"
                scoringNote="Penilaian tindakan: SS=5 … STS=1. Persentase = (jumlah poin / 75) × 100%. Baik ≥50%, Buruk di bawah 50%."
              />
            ) : (
              <Likert4ScaleGuide scoringNote="Penilaian tindakan: poin = 5 − jawaban. Persentase = (jumlah poin / 60) × 100%. Baik ≥50%, Buruk di bawah 50%." />
            )
          ) : section === 'ed' ? (
            isPostTest ? (
              <Likert5ScaleGuide
                title="Petunjuk skala jawaban efikasi diri (post-test)"
                scoringNote="Penilaian efikasi diri: SS=5 … STS=1, jumlah 15–75 dinormalkan ke skala 10–40 (Tinggi 30–40, Sedang 20–29, Rendah 10–19)."
              />
            ) : (
              <Likert4ScaleGuide scoringNote="Penilaian efikasi diri: poin = 5 − jawaban, jumlah 15–60 dinormalkan ke skala 10–40 (Tinggi 30–40, Sedang 20–29, Rendah 10–19)." />
            )
          ) : section === 'sk' ? (
            <SikapScaleGuide />
          ) : (
            <p className="mt-1 text-xs text-theme-muted">Skala Likert SS-STS (HBM-TPB), dinilai persentase.</p>
          )}
        </div>
        <span className="chip shrink-0">
          {answeredCount}/{totalCount} dijawab
        </span>
      </div>

      {sectionQuestions.map((q, idx) => {
        const current = answers[q.id]
        const displayNumber = section === 'dm' ? q.number : idx + 1
        const isUnanswered = !isQuestionAnswered(q, current)
        const isHighlighted = highlightedIds?.has(q.id) && isUnanswered
        return (
          <div
            key={q.id}
            className={`rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 p-4 shadow-sm transition-colors ${
              isHighlighted ? 'border-l-4 border-l-rose-500' : ''
            }`}
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <p className="text-sm font-semibold leading-snug text-theme">
                <span className="mr-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-health-100 text-[11px] font-bold text-health-800">
                  {displayNumber}
                </span>
                {q.text}
              </p>
              {isHighlighted ? (
                <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                  Wajib dijawab
                </span>
              ) : null}
            </div>
            {q.note ? (
              <p className="mb-3 rounded-lg border border-amber-500/25 bg-amber-50/80 px-3 py-1.5 text-xs text-amber-800">
                {q.note}
              </p>
            ) : null}

            {q.type === 'mcq' && q.choices ? (
              <div className="space-y-2">
                {q.choices.map((choice) => (
                  <button
                    key={choice.id}
                    type="button"
                    onClick={() => onAnswer(q.id, choice.id)}
                    className={`w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left text-sm transition duration-200 focus-ring ${
                      current === choice.id
                        ? 'border-health-500/50 bg-health-500/[0.1] text-health-900 ring-2 ring-health-400/30'
                        : 'border-[var(--panel-border)] bg-[var(--panel-bg)] text-theme-muted hover:border-health-400/60'
                    }`}
                  >
                    <span className="font-semibold uppercase">{choice.id}.</span> {choice.text}
                  </button>
                ))}
              </div>
            ) : q.type === 'text' ? (
              <div className="space-y-1.5">
                <input
                  type={q.input_mode === 'number' ? 'number' : 'text'}
                  inputMode={q.input_mode === 'number' ? 'numeric' : 'text'}
                  min={q.input_mode === 'number' ? 17 : undefined}
                  max={q.input_mode === 'number' ? 80 : undefined}
                  value={current ?? ''}
                  onChange={(e) => onAnswer(q.id, e.target.value)}
                  placeholder={q.placeholder || 'Ketik jawaban Anda…'}
                  className={`w-full rounded-xl border bg-[var(--panel-bg)] px-3 py-2.5 text-sm text-theme placeholder:text-theme-soft focus:outline-none focus:ring-2 ${
                    validationErrors?.[q.id]
                      ? 'border-rose-400 focus:border-rose-500/50 focus:ring-rose-400/30'
                      : 'border-[var(--panel-border)] focus:border-health-500/50 focus:ring-health-400/30'
                  }`}
                />
                {validationErrors?.[q.id] ? (
                  <p className="flex items-center gap-1 text-xs text-rose-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    {validationErrors[q.id]}
                  </p>
                ) : null}
              </div>
            ) : q.type === 'likert_4' ? (
              <div className="space-y-2">
                <p className="text-[11px] text-theme-soft">Pilih 1 (sangat setuju) s/d 4 (tidak setuju).</p>
                <div className="flex flex-wrap gap-2">
                  {q.options.map((opt) => (
                    <AnswerButton
                      key={opt}
                      label={likertLabel(opt, q.type)}
                      selected={current === opt}
                      onClick={() => onAnswer(q.id, opt)}
                    />
                  ))}
                </div>
              </div>
            ) : q.type === 'likert_5' ? (
              <div className="space-y-2">
                <p className="text-[11px] text-theme-soft">
                  Pilih SS (sangat setuju) s/d STS (sangat tidak setuju).
                </p>
                <div className="grid gap-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => onAnswer(q.id, opt)}
                      className={`w-full cursor-pointer rounded-xl border px-3 py-2.5 text-left text-sm font-medium transition duration-200 focus-ring ${
                        current === opt
                          ? 'border-amber-500/50 bg-amber-500/[0.1] text-amber-900 ring-2 ring-amber-400/30'
                          : 'border-[var(--panel-border)] bg-[var(--panel-bg)] text-theme-muted hover:border-amber-400/60 hover:text-theme'
                      }`}
                    >
                      {likertLabel(opt, q.type)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => (
                  <AnswerButton
                    key={opt}
                    label={likertLabel(opt, q.type)}
                    selected={current === opt}
                    onClick={() => onAnswer(q.id, opt)}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Progress Indicator
// ---------------------------------------------------------------------------

function ProgressBar({
  answered,
  total,
}: {
  answered: number
  total: number
}) {
  const pct = total > 0 ? (answered / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-theme-muted">
        <span>Kemajuan pengisian</span>
        <span className="tabular-nums font-semibold">
          {answered}/{total} jawaban
        </span>
      </div>
      <div className="progress-bar-track">
        <motion.div
          className="progress-bar-fill"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function LipiQuizPage() {
  const { me } = useAuth()
  const { toast } = useToast()
  const waLinked = Boolean(me?.wa_phone?.trim())
  const [eligibility, setEligibility] = useState<LipiEligibility | null>(null)
  const [demographicQuestions, setDemographicQuestions] = useState<LipiQuestion[]>([])
  const [questions, setQuestions] = useState<LipiQuestion[]>([])
  const [demographics, setDemographics] = useState<Record<string, string>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [activeSection, setActiveSection] = useState<string>('dm')
  const [result, setResult] = useState<LipiResult | null>(null)
  const [previousResults, setPreviousResults] = useState<LipiResult[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [waSending, setWaSending] = useState(false)
  const [waSendOk, setWaSendOk] = useState<string | null>(null)
  const [waSendErr, setWaSendErr] = useState<string | null>(null)
  const [quizMode, setQuizMode] = useState<'idle' | 'quiz' | 'result'>('idle')
  const [sectionQuestionOrders, setSectionQuestionOrders] = useState<Record<string, LipiQuestion[]>>({})
  const [activeAttemptType, setActiveAttemptType] = useState<'pre_test' | 'post_test'>('pre_test')
  const [quizLoading, setQuizLoading] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [unansweredCount, setUnansweredCount] = useState(0)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)

  const loadQuestionsForAttempt = useCallback(async (attemptType: 'pre_test' | 'post_test') => {
    const qs = await fetchLipiQuestions(attemptType)
    setDemographicQuestions(qs.demographics ?? [])
    setQuestions(qs.questions)
    setActiveAttemptType(attemptType)
    return qs
  }, [])

  const beginQuizSession = useCallback(async () => {
    const attemptType = eligibility?.next_attempt_type ?? 'pre_test'
    setQuizLoading(true)
    setSubmitErr(null)
    setValidationErrors({})
    setUnansweredCount(0)
    setShowConfirmDialog(false)
    try {
      const qs = await loadQuestionsForAttempt(attemptType)
      setSectionQuestionOrders(
        buildSectionQuestionOrders(qs.demographics ?? [], qs.questions),
      )
      setDemographics({})
      setAnswers({})
      setActiveSection('dm')
      setQuizMode('quiz')
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Gagal memuat soal kuesioner.'
      setSubmitErr(typeof msg === 'string' ? msg : 'Gagal memuat soal kuesioner.')
    } finally {
      setQuizLoading(false)
    }
  }, [eligibility, loadQuestionsForAttempt])

  const allQuestions = [...demographicQuestions, ...questions]
  const totalQuestions = allQuestions.length
  const answeredQuestions = allQuestions.filter((q) => {
    const value = q.section === 'dm' ? demographics[q.id] : answers[q.id]
    return isQuestionAnswered(q, value)
  }).length

  const handleQuestionAnswer = useCallback((q: LipiQuestion, value: string) => {
    if (q.section === 'dm') {
      setDemographics((prev) => ({ ...prev, [q.id]: value }))
      return
    }
    setAnswers((prev) => ({ ...prev, [q.id]: value }))
  }, [])

  const validateAll = useCallback(() => {
    const errors: Record<string, string> = {}
    let unanswered = 0

    for (const q of allQuestions) {
      const value = q.section === 'dm' ? demographics[q.id] : answers[q.id]
      if (!isQuestionAnswered(q, value)) {
        unanswered += 1
      }
      if (q.section === 'dm' && q.id === 'dm2' && value) {
        const age = parseInt(value, 10)
        if (isNaN(age) || age < 17 || age > 80) {
          errors['dm2'] = 'Usia harus berupa angka antara 17–80'
        }
      }
    }

    setValidationErrors(errors)
    setUnansweredCount(unanswered)
    return { unanswered, errors }
  }, [allQuestions, demographics, answers])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setErr(null)
    Promise.all([fetchLipiEligibility(), fetchMyLipiResults()]).then(async ([elig, prev]) => {
      if (cancelled) return
      setEligibility(elig)
      setPreviousResults(prev.results)
      const attemptType = elig.next_attempt_type ?? 'pre_test'
      try {
        await loadQuestionsForAttempt(attemptType)
      } catch {
        if (!cancelled) setErr('Gagal memuat bank soal kuesioner.')
      }
      if (!cancelled) setLoading(false)
    }).catch((e) => {
      if (cancelled) return
      setErr(e?.response?.data?.detail ?? 'Gagal memuat data kuis.')
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [loadQuestionsForAttempt])

  const handleAnswer = useCallback((questionId: string, value: string) => {
    const q = allQuestions.find((item) => item.id === questionId)
    if (q) {
      handleQuestionAnswer(q, value)
      return
    }
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }, [allQuestions, handleQuestionAnswer])

  const handleSubmit = async () => {
    setSubmitErr(null)
    setSubmitting(true)
    try {
      const res = await submitLipiQuiz(demographics, answers)
      setResult(res)
      setQuizMode('result')
      const [elig, prev] = await Promise.all([fetchLipiEligibility(), fetchMyLipiResults()])
      setEligibility(elig)
      setPreviousResults(prev.results)
      setShowConfirmDialog(false)
      setUnansweredCount(0)
      setValidationErrors({})
      toast(
        'Skrining berhasil disimpan!',
        `Indeks Kesiapsiagaan: ${res.total_score?.toFixed(0) ?? 0}%`,
        'success',
      )
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? 'Gagal mengirim jawaban. Coba lagi.'
      setSubmitErr(msg)
      setShowConfirmDialog(false)
      toast('Gagal mengirim jawaban', msg, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetake = () => {
    setResult(null)
    setDemographics({})
    setAnswers({})
    setSubmitErr(null)
    setWaSendOk(null)
    setWaSendErr(null)
    setValidationErrors({})
    setUnansweredCount(0)
    setShowConfirmDialog(false)
    setSectionQuestionOrders(buildSectionQuestionOrders(demographicQuestions, questions))
    setActiveSection('dm')
    setQuizMode('quiz')
  }

  const handleSendWaReport = async (sessionId: string) => {
    setWaSendOk(null)
    setWaSendErr(null)
    setWaSending(true)
    try {
      const out = await sendLipiReportWa(sessionId)
      setWaSendOk(out.detail || 'Laporan terkirim ke WhatsApp Anda.')
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Gagal mengirim laporan ke WhatsApp. Coba lagi.'
      setWaSendErr(typeof msg === 'string' ? msg : 'Gagal mengirim laporan ke WhatsApp.')
    } finally {
      setWaSending(false)
    }
  }

  const currentSectionIdx = SECTION_ORDER.indexOf(activeSection)
  const isLastSection = currentSectionIdx === SECTION_ORDER.length - 1
  const canSubmit = answeredQuestions === totalQuestions && totalQuestions > 0
  const activeSectionComplete = isSectionComplete(
    activeSection,
    sectionQuestionOrders,
    demographics,
    answers,
  )
  const orderedActiveQuestions =
    sectionQuestionOrders[activeSection] ??
    (activeSection === 'dm'
      ? [...demographicQuestions].sort((a, b) => a.number - b.number)
      : questions.filter((q) => q.section === activeSection))
  const activeSectionAnswers = activeSection === 'dm' ? demographics : answers
  const startLabel =
    eligibility?.next_attempt_type === 'post_test' ? 'Mulai Post-test' : 'Mulai Pre-test'
  const retakeLabel =
    eligibility?.next_attempt_type === 'post_test' ? 'Lanjut ke post-test' : 'Isi ulang pre-test'
  const canRetake = Boolean(eligibility?.can_submit)
  const kuisDone = eligibility?.kuis_status === 'lengkap'
  const postPending = eligibility?.kuis_status === 'post_menunggu'

  // Hero — only shown when kuisDone is false
  const heroSection = !kuisDone ? (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 }}
      className="glass-panel rounded-2xl border border-[var(--panel-border)] p-6 md:p-8"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-merah/10">
          <ShieldCheck className="h-5 w-5 text-merah" aria-hidden />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-merah">Kesiapsiagaan Gempa</p>
          <h1 className="text-xl font-bold text-theme md:text-2xl">Kuesioner Staf Puskesmas</h1>
        </div>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-theme-muted">
        Kuesioner penelitian kesiapsiagaan gempa bumi untuk staf puskesmas: efikasi diri (GSES), pengetahuan, sikap (HBM-TPB), dan tindakan.
      </p>
      <div className="mt-4 space-y-3">
        {eligibility?.next_attempt_type === 'post_test' ? (
          <Likert5ScaleGuide
            title="Post-test: semua bagian Likert memakai skala SS–STS (5 poin)"
            scoringNote="Efikasi diri, sikap, dan tindakan di post-test menggunakan SS (5 poin) sampai STS (1 poin). Bagian pengetahuan tetap pilihan ganda."
          />
        ) : (
          <>
            <Likert4ScaleGuide />
            <p className="text-xs text-theme-muted">
              Bagian <strong className="text-theme">sikap</strong> memakai skala SS–STS (5 poin). Post-test
              nanti memakai skala SS–STS untuk <strong className="text-theme">semua</strong> bagian Likert.
            </p>
          </>
        )}
      </div>
      {eligibility ? (
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-theme-muted">
          <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-0.5">
            {totalQuestions || 61} butir pertanyaan
          </span>
          <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-0.5">
            5 bagian
          </span>
          <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2.5 py-0.5">
            Data diri + kuesioner utama
          </span>
        </div>
      ) : null}
    </motion.div>
  ) : null

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-sm text-theme-muted">
        Memuat kuis…
      </div>
    )
  }

  if (err) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="inline-error">
          {err}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-10">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 outline-none">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Link
            to="/petugas"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-theme-muted transition duration-200 hover:text-theme focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Ruang Masyarakat
          </Link>
        </motion.div>

        {quizMode !== 'quiz' ? <QuizFlowSteps status={eligibility?.kuis_status} /> : null}

        {heroSection}

        {postPending && quizMode === 'idle' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border-2 border-rose-300/70 bg-rose-50/90 px-4 py-3 text-sm text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-100"
          >
            <strong>Pre-test selesai.</strong> Silakan isi <strong>post-test</strong> untuk menyelesaikan kuesioner
            penelitian.
          </motion.div>
        ) : null}

        {kuisDone && quizMode === 'idle' ? (
          (() => {
            const postResult = previousResults.find(r => r.attempt_type === 'post_test') ?? previousResults[0]
            if (!postResult) return null
            return (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <motion.div
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: easeOutExpo }}
                >
                  <HasilPanel
                    result={postResult}
                    waLinked={waLinked}
                    onSendWaReport={() => void handleSendWaReport(postResult.session_id)}
                    certificate={certificateOffer(me)}
                  />
                </motion.div>
              </motion.div>
            )
          })()
        ) : null}

        {/* Previous Results — hidden when kuisDone (HasilPanel takes over) */}
        {quizMode === 'idle' && previousResults.length > 0 && !result && !kuisDone ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-3"
            ref={resultRef}
          >
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" aria-hidden />
              <p className="text-sm font-semibold text-theme">Riwayat Hasil Kuesioner</p>
            </div>
            {previousResults.map((prev) => (
              <ResultsPanel
                key={prev.session_id}
                result={prev}
                onRetake={handleRetake}
                canRetake={canRetake}
                retakeLabel={retakeLabel}
                waLinked={waLinked}
                onSendWaReport={() => void handleSendWaReport(prev.session_id)}
                waSending={waSending}
                waSendOk={waSendOk}
                waSendErr={waSendErr}
              />
            ))}
          </motion.div>
        ) : null}

        {eligibility && !eligibility.quiz_enabled ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-6 text-center">
              <p className="text-sm text-theme-muted">Kuesioner saat ini tidak aktif.</p>
            </div>
          </motion.div>
        ) : null}

        {/* Start Quiz Button — hidden when kuisDone (HasilPanel takes over) */}
        {eligibility?.eligible && quizMode === 'idle' && !result && !kuisDone ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
            <button
              type="button"
              disabled={quizLoading}
              onClick={() => void beginQuizSession()}
              className={`w-full cursor-pointer rounded-2xl border px-6 py-4 text-base font-semibold text-white shadow-md transition duration-200 focus-ring disabled:cursor-not-allowed disabled:opacity-60 ${
                postPending
                  ? 'border-rose-400/50 bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800'
                  : 'border-health-500/40 bg-gradient-to-r from-health-600 to-health-700 hover:from-health-700 hover:to-health-800'
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                <ClipboardCheck className="h-5 w-5" aria-hidden />
                {quizLoading ? 'Memuat soal…' : startLabel}
              </span>
            </button>
            {submitErr && quizMode === 'idle' ? (
              <p className="mt-2 text-center text-xs text-rose-600">{submitErr}</p>
            ) : null}
          </motion.div>
        ) : null}

        {/* Quiz Mode */}
        {quizMode === 'quiz' && eligibility?.eligible ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {/* Section + overall progress indicator */}
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
              <div className="mb-2 flex items-center justify-between text-xs text-theme-muted">
                <span className="font-semibold">
                  Bagian {currentSectionIdx + 1} dari {SECTION_ORDER.length} •{' '}
                  {totalQuestions > 0 ? Math.round(((currentSectionIdx + 1) / SECTION_ORDER.length) * 100) : 0}%
                  selesai
                </span>
                <span className="tabular-nums">
                  {answeredQuestions}/{totalQuestions} pertanyaan dijawab
                </span>
              </div>
              <ProgressBar answered={answeredQuestions} total={totalQuestions} />
            </div>

            {/* Validation error summary */}
            {unansweredCount > 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <div>
                  <strong>{unansweredCount} pertanyaan belum dijawab.</strong>{' '}
                  Scroll ke atas dan jawab semua pertanyaan bertanda merah sebelum mengirim.
                </div>
              </div>
            ) : null}

            <p className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs text-theme-muted">
              Isi bagian <strong className="text-theme">berurutan</strong> dari 1 sampai 5. Selesaikan semua soal di
              bagian aktif sebelum lanjut. Bagian 1 (Data Diri) urut tetap; bagian 2-5 urutan soal diacak per akun.
            </p>

            {/* Section tabs */}
            <div className="flex overflow-x-auto gap-1 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1">
              {SECTION_ORDER.map((sec, idx) => {
                const meta = SECTION_META[sec]
                const secQs = sectionQuestionOrders[sec] ?? []
                const secAnswered = secQs.filter((q) =>
                  isQuestionAnswered(q, sectionAnswerValue(q, demographics, answers)),
                ).length
                const secTotal = secQs.length
                const done = secAnswered === secTotal && secTotal > 0
                const active = activeSection === sec
                const unlocked = isSectionUnlocked(idx, sectionQuestionOrders, demographics, answers)
                return (
                  <button
                    key={sec}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => {
                      if (unlocked) setActiveSection(sec)
                    }}
                    className={`flex min-w-0 flex-1 shrink-0 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-center text-xs font-medium transition duration-200 focus-ring ${
                      !unlocked
                        ? 'cursor-not-allowed opacity-45'
                        : active
                          ? 'cursor-pointer bg-health-600 text-white shadow-sm'
                          : done
                            ? 'cursor-pointer bg-cta-500/[0.09] text-cta-700 hover:bg-cta-500/[0.14]'
                            : 'cursor-pointer text-theme-muted hover:bg-health-50/70 hover:text-theme'
                    }`}
                  >
                    {done && !active ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-cta-600" />
                    ) : (
                      <span className="text-[10px]">{idx + 1}</span>
                    )}
                    <span className="hidden sm:block">{meta.label.split(' ')[0]}</span>
                    <span className="sm:hidden">{sec.toUpperCase()}</span>
                  </button>
                )
              })}
            </div>

            {/* Section Questions */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: easeOutExpo }}
              >
                <QuizSection
                  section={activeSection}
                  sectionQuestions={orderedActiveQuestions}
                  answers={activeSectionAnswers}
                  onAnswer={handleAnswer}
                  attemptType={activeAttemptType}
                  highlightedIds={
                    unansweredCount > 0
                      ? new Set(
                          allQuestions
                            .filter((q) => !isQuestionAnswered(q, q.section === 'dm' ? demographics[q.id] : answers[q.id]))
                            .map((q) => q.id),
                        )
                      : undefined
                  }
                  validationErrors={Object.keys(validationErrors).length > 0 ? validationErrors : undefined}
                />
              </motion.div>
            </AnimatePresence>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={currentSectionIdx === 0}
                onClick={() => setActiveSection(SECTION_ORDER[currentSectionIdx - 1])}
                className="btn-ghost disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Sebelumnya
              </button>

              {isLastSection ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    const { unanswered } = validateAll()
                    if (unanswered > 0) {
                      toast(`Masih ada ${unanswered} pertanyaan belum dijawab.`, 'Silakan jawab semua pertanyaan sebelum mengirim.', 'warning')
                      return
                    }
                    setShowConfirmDialog(true)
                  }}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-health-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-health-700 focus-ring disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" aria-hidden />
                      Memproses…
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="h-4 w-4" aria-hidden />
                      Kirim Jawaban
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!activeSectionComplete}
                  onClick={() => {
                    if (activeSectionComplete) {
                      setActiveSection(SECTION_ORDER[currentSectionIdx + 1]!)
                    }
                  }}
                  className="btn-secondary disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Lanjut
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              )}
            </div>

            {!activeSectionComplete && !isLastSection ? (
              <p className="text-center text-xs text-amber-800">
                Jawab semua soal di bagian {currentSectionIdx + 1} ({SECTION_META[activeSection]?.label}) untuk
                membuka bagian berikutnya.
              </p>
            ) : null}

            {!canSubmit && isLastSection ? (
              <p className="text-center text-xs text-theme-muted">
                Masih ada {totalQuestions - answeredQuestions} pertanyaan belum dijawab
              </p>
            ) : null}

            {submitErr ? (
              <p className="inline-error">
                {submitErr}
              </p>
            ) : null}

            {/* Confirmation dialog */}
            <ConfirmDialog
              open={showConfirmDialog}
              title="Konfirmasi Kirim Jawaban"
              message={
                <div className="space-y-2">
                  <p>
                    <strong>{answeredQuestions} pertanyaan dijawab</strong> dari {totalQuestions} total.
                  </p>
                  <p className="text-slate-500">Pastikan semua jawaban sudah benar sebelum dikirim.</p>
                </div>
              }
              confirmLabel="Kirim Jawaban"
              cancelLabel="Batal"
              type="info"
              loading={submitting}
              onConfirm={handleSubmit}
              onCancel={() => setShowConfirmDialog(false)}
            />
          </motion.div>
        ) : null}

        {/* Result Mode */}
        {quizMode === 'result' && result ? (
          <div ref={resultRef}>
            {result.attempt_type === 'post_test' ? (
              <HasilPanel
                result={result}
                waLinked={waLinked}
                onSendWaReport={() => void handleSendWaReport(result.session_id)}
                certificate={certificateOffer(me)}
              />
            ) : (
              <ResultsPanel
                result={result}
                onRetake={handleRetake}
                canRetake={canRetake}
                retakeLabel={retakeLabel}
                waLinked={waLinked}
                onSendWaReport={() => void handleSendWaReport(result.session_id)}
                waSending={waSending}
                waSendOk={waSendOk}
                waSendErr={waSendErr}
              />
            )}
          </div>
        ) : null}
      </main>
    </div>
  )
}
