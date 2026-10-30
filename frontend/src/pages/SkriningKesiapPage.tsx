import {
  Activity,
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock,
  Download,
  FileText,
  History,
  Info,
  Lightbulb,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  downloadSkriningPdf,
  fetchSkriningAiReport,
  fetchSkriningDetail,
  fetchSkriningHistory,
  fetchSkriningSummary,
  type SkriningAiReport,
  type SkriningDetail,
  type SkriningHistorySession,
  type SkriningIndex,
  type SkriningSummary,
} from '../api/client'
import { useToast } from '../components/ToastProvider'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function levelColor(level: string | null): string {
  if (level === 'Tinggi') return 'text-emerald-600'
  if (level === 'Menengah') return 'text-amber-600'
  return 'text-rose-600'
}
function levelBadge(level: string | null): string {
  if (level === 'Tinggi') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
  if (level === 'Menengah') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  if (level === 'Rendah') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
  return 'bg-slate-100 text-slate-600'
}
function levelRgb(level: string | null): [number, number, number] {
  if (level === 'Tinggi') return [39, 174, 96]
  if (level === 'Menengah') return [243, 156, 18]
  if (level === 'Rendah') return [231, 76, 60]
  return [189, 195, 199]
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return '—'
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

function ScoreBar({ value, max = 100, color = '#1F4E79' }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  )
}

// ─── Circular Gauge SVG ────────────────────────────────────────────────────────

function IndexGauge({ score, level, size = 180 }: { score: number | null; level: string | null; size?: number }) {
  const [r, g, b] = levelRgb(level)
  const pct = Math.min(100, Math.max(0, score ?? 0))
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (pct / 100) * circumference
  const cx = size / 2
  const cy = size / 2

  if (score === null) {
    return (
      <div className="flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <AlertCircle className="h-12 w-12 text-slate-300" />
        <p className="mt-2 text-sm text-slate-400">Belum ada data</p>
      </div>
    )
  }

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="14"
        />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke={`rgb(${r},${g},${b})`}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-4xl font-black tabular-nums"
          style={{ color: `rgb(${r},${g},${b})` }}
        >
          {score.toFixed(0)}
        </span>
        <span className="mt-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">Indeks</span>
        <span
          className={`mt-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide ${levelBadge(level)}`}
        >
          {level ?? '—'}
        </span>
      </div>
    </div>
  )
}

// ─── Dimension Mini Card ──────────────────────────────────────────────────────

function maknaSkor(kind: 'pg' | 'sk' | 'td', score: number | null): string | null {
  if (score === null) return null
  if (kind === 'td') return score >= 50 ? 'Baik' : 'Buruk'
  if (score >= 76) return 'Baik'
  if (score >= 56) return 'Cukup'
  return 'Kurang'
}

function DimCard({
  label,
  score,
  kind,
  icon: Icon,
  color,
}: {
  label: string
  score: number | null
  kind: 'pg' | 'sk' | 'td'
  icon: typeof Brain
  color: string
}) {
  const makna = maknaSkor(kind, score)
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ backgroundColor: color + '20' }}>
        <Icon className="h-5 w-5" style={{ color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-lg font-bold tabular-nums text-slate-800">
          {score !== null ? `${score.toFixed(0)}%` : '—'}
        </p>
        {makna ? <p className="text-[10px] font-semibold text-slate-500">{makna}</p> : null}
      </div>
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────

interface DetailModalProps {
  username: string
  userHistory: SkriningIndex[]
  onClose: () => void
}

function DetailModal({ username, userHistory, onClose }: DetailModalProps) {
  const { toast } = useToast()
  const [sessions, setSessions] = useState<SkriningHistorySession[] | null>(null)
  const [detail, setDetail] = useState<SkriningDetail | null>(null)
  const [aiReport, setAiReport] = useState<SkriningAiReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingAi, setLoadingAi] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'ai' | 'pdf' | 'history'>('overview')

  useEffect(() => {
    setLoading(true)
    setError(null)
    setDetail(null)
    setAiReport(null)
    setSessions(null)
    fetchSkriningDetail(username)
      .then((row) => {
        setDetail(row)
        if (row.ai_report) setAiReport(row.ai_report)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
    fetchSkriningHistory(username)
      .then((res) => setSessions(res.sessions))
      .catch(() => {
        setSessions(null)
        toast('Gagal memuat riwayat', 'Daftar skrining sebelumnya tidak bisa dibuka.', 'error')
      })
  }, [username, toast])

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      await downloadSkriningPdf(username)
      toast('PDF berhasil diunduh', `${username} - Laporan Skrining Kesiapsiagaan`, 'success')
    } catch (e) {
      console.error('PDF download failed', e)
      toast('Gagal mengunduh PDF', e instanceof Error ? e.message : 'Silakan coba lagi.', 'error')
    } finally {
      setDownloading(false)
    }
  }

  const handleGetAiReport = async () => {
    if (aiReport) return
    setLoadingAi(true)
    try {
      const report = await fetchSkriningAiReport(username)
      setAiReport(report)
    } catch (e) {
      console.error('AI report failed', e)
    } finally {
      setLoadingAi(false)
    }
  }

  const level = detail?.index_level ?? null
  const [r, g, b] = levelRgb(level)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="glass-panel max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200/60 shadow-2xl"
      >
        {/* Modal Header */}
        <div
          className="flex items-start justify-between px-6 py-5"
          style={{ backgroundColor: `rgb(${r},${g},${b})` }}
        >
          <div className="text-white">
            <p className="text-xs font-medium uppercase tracking-wide text-white/70">Detail Skrining</p>
            <h2 className="mt-1 text-xl font-bold">{detail?.display_name || username}</h2>
            <p className="mt-0.5 text-sm text-white/80">{detail?.puskesmas_nama || '—'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/20 p-2 text-white transition hover:bg-white/30 focus-ring"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-100 bg-slate-50/50 px-4 pt-3">
          {([
            ['overview', 'Ringkasan'],
            ['history', 'Riwayat'],
            ['ai', 'Analisis AI'],
            ['pdf', 'Download PDF'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`mb-[-1px] rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'border-health-600 text-health-700'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6" style={{ maxHeight: 'calc(90vh - 160px)' }}>
          {activeTab === 'overview' && (
            <>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-health-500 border-t-transparent" />
                </div>
              ) : error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  <AlertCircle className="mb-1 inline h-4 w-4" /> {error}
                </div>
              ) : detail ? (
                <div className="space-y-6">
                  {/* Index Gauge */}
                  <div className="flex flex-col items-center">
                    <IndexGauge score={detail.index_score} level={detail.index_level} size={160} />
                    <p className="mt-3 text-center text-sm text-slate-500">
                      Indeks Kesiapsiagaan ·{' '}
                      {detail.attempt_type?.replace('_', ' ').replace('test', 'test ').trim()
                        ? `(${detail.attempt_type?.replace('_', ' ')})`
                        : ''}
                    </p>
                    <p className="mt-1 text-center text-xs text-slate-400">
                      {formatRelativeTime(detail.submitted_at)}
                    </p>
                  </div>

                  {/* Dimension scores */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Pengetahuan</p>
                      <p className="mt-1 text-2xl font-bold text-slate-800">
                        {detail.pg_score !== null ? `${detail.pg_score.toFixed(0)}%` : '—'}
                      </p>
                      <div className="mt-2">
                        <ScoreBar
                          value={detail.pg_score ?? 0}
                          color={detail.pg_score !== null && detail.pg_score >= 76 ? '#27AE60' : detail.pg_score !== null && detail.pg_score >= 56 ? '#F39C12' : '#E74C3C'}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Kategori: <span className={levelColor(detail.pg_level !== '-' ? (detail.pg_score !== null && detail.pg_score >= 76 ? 'Tinggi' : detail.pg_score !== null && detail.pg_score >= 56 ? 'Menengah' : 'Rendah') : null)}>{detail.pg_level}</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Sikap</p>
                      <p className="mt-1 text-2xl font-bold text-slate-800">
                        {detail.sk_score !== null ? `${detail.sk_score.toFixed(0)}%` : '—'}
                      </p>
                      <div className="mt-2">
                        <ScoreBar
                          value={detail.sk_score ?? 0}
                          color={detail.sk_score !== null && detail.sk_score >= 76 ? '#27AE60' : detail.sk_score !== null && detail.sk_score >= 56 ? '#F39C12' : '#E74C3C'}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Kategori: <span className={levelColor(detail.sk_level ?? null)}>{detail.sk_level ?? 'Pre-test'}</span>
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-100 bg-white p-4 text-center shadow-sm">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Tindakan</p>
                      <p className="mt-1 text-2xl font-bold text-slate-800">
                        {detail.td_score !== null ? `${detail.td_score.toFixed(0)}%` : '—'}
                      </p>
                      <div className="mt-2">
                        <ScoreBar
                          value={detail.td_score ?? 0}
                          color={detail.td_score !== null && detail.td_score >= 50 ? '#27AE60' : '#E74C3C'}
                        />
                      </div>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Kategori: <span className={levelColor(detail.td_score !== null && detail.td_score >= 50 ? 'Tinggi' : 'Rendah')}>{detail.td_level}</span>
                      </p>
                    </div>
                    </div>

                  {detail.ai_recommendation ? (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
                        <Sparkles className="h-3.5 w-3.5" /> Analisis AI
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">{detail.ai_recommendation}</p>
                    </div>
                  ) : null}

                  {/* Rumus */}
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <Info className="h-3.5 w-3.5" /> Rumus Perhitungan
                    </p>
                    <p className="text-sm text-slate-600">
                      <strong>Indeks = Rata-rata</strong> skor dimensi yang tersedia
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      <li>• Pre-test (PG + TD): Indeks = (PG% + TD%) / 2</li>
                      <li>• Post-test (PG + SK + TD): Indeks = (PG% + SK% + TD%) / 3</li>
                      <li>• Tinggi ≥80 · Menengah 60–79 · Rendah &lt;60</li>
                    </ul>
                  </div>

                  {/* Wrong items */}
                  {detail.wrong_items && detail.wrong_items.length > 0 ? (
                    <div>
                      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <XCircle className="h-3.5 w-3.5 text-rose-500" /> Soal Pengetahuan yang Salah ({detail.wrong_items.length})
                      </p>
                      <ul className="space-y-2">
                        {detail.wrong_items.map((item, i) => (
                          <li key={i} className="rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                            <p className="text-xs font-medium text-slate-700">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-rose-200 text-[10px] font-bold text-rose-600">
                                {i + 1}
                              </span>
                              {' '}{item.question?.slice(0, 120)}{item.question && item.question.length > 120 ? '…' : ''}
                            </p>
                            <p className="mt-1.5 flex flex-wrap gap-3 text-xs">
                              <span className="text-slate-400">
                                Jawaban Anda: <span className="font-medium text-rose-600">{item.your_answer_text || item.your_answer || '—'}</span>
                              </span>
                              <span className="text-slate-400">
                                Benar: <span className="font-medium text-emerald-600">{item.correct_answer_text || item.correct_answer || '—'}</span>
                              </span>
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      Semua jawaban pengetahuan benar!
                    </div>
                  )}
                </div>
              ) : null}
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              {(sessions ?? userHistory).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <History className="h-12 w-12 text-slate-300" />
                  <p className="mt-3 text-sm text-slate-500">Belum ada riwayat skrining.</p>
                </div>
              ) : (
                <>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-sm font-medium text-slate-600">
                      {(sessions ?? userHistory).length} skrining ditemukan
                    </p>
                  </div>
                  <div className="space-y-3">
                    {(sessions ?? userHistory)
                      .slice()
                      .sort((a, b) => {
                        const dateA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0
                        const dateB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0
                        return dateB - dateA
                      })
                      .map((item, idx) => {
                        const isLatest = idx === 0
                        return (
                          <div
                            key={item.session_id ?? idx}
                            className={`relative rounded-xl border p-4 transition-shadow ${
                              isLatest
                                ? 'border-health-200 bg-health-50/40 shadow-sm'
                                : 'border-slate-100 bg-white shadow-sm'
                            }`}
                          >
                            {isLatest && (
                              <span className="absolute -top-2.5 left-3 rounded-full bg-health-500 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                Terbaru
                              </span>
                            )}
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-slate-800">
                                    {item.index_score !== null ? `${item.index_score.toFixed(0)}%` : '—'}
                                  </p>
                                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold uppercase ${levelBadge(item.index_level)}`}>
                                    {item.index_level ?? '—'}
                                  </span>
                                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                                    {item.attempt_type?.replace(/_/g, ' ').trim() ?? '—'}
                                  </span>
                                </div>
                                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
                                  <Clock className="h-3 w-3" />
                                  {item.submitted_at
                                    ? new Date(item.submitted_at).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })
                                    : '—'}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-3">
                                  <span className="text-xs text-slate-500">
                                    PG: <span className="font-medium text-slate-700">{item.pg_score !== null ? `${item.pg_score.toFixed(0)}%` : '—'}</span>
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    SK: <span className="font-medium text-slate-700">{item.sk_score !== null ? `${item.sk_score.toFixed(0)}%` : '—'}</span>
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    TD: <span className="font-medium text-slate-700">{item.td_score !== null ? `${item.td_score.toFixed(0)}%` : '—'}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-4">
              {!aiReport && (
                <button
                  type="button"
                  onClick={handleGetAiReport}
                  disabled={loadingAi}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-health-300 bg-health-50 px-4 py-5 text-sm font-medium text-health-700 transition hover:border-health-400 hover:bg-health-100 disabled:opacity-60 focus-ring"
                >
                  <Sparkles className="h-5 w-5" />
                  {loadingAi ? 'Menghasilkan analisis…' : 'Hasilkan Analisis AI'}
                </button>
              )}

              {loadingAi && (
                <div className="flex items-center justify-center gap-3 py-8">
                  <div className="h-6 w-6 animate-spin rounded-full border-3 border-health-500 border-t-transparent" />
                  <p className="text-sm text-slate-500">AI sedang menganalisis…</p>
                </div>
              )}

              {aiReport && (
                <div className="space-y-4">
                  {aiReport.overall_analysis && (
                    <div className="rounded-xl border border-violet-100 bg-violet-50/50 p-4">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
                        <Lightbulb className="h-3.5 w-3.5" /> Analisis Keseluruhan
                      </p>
                      <p className="text-sm leading-relaxed text-slate-700">{aiReport.overall_analysis}</p>
                    </div>
                  )}

                  {aiReport.key_findings && aiReport.key_findings.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <BarChart3 className="h-3.5 w-3.5" /> Temuan Kunci
                      </p>
                      <ul className="space-y-1.5">
                        {aiReport.key_findings.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-health-500" />
                            {f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiReport.research_implications && aiReport.research_implications.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <BookOpen className="h-3.5 w-3.5" /> Implikasi Penelitian
                      </p>
                      <ul className="space-y-1.5">
                        {aiReport.research_implications.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiReport.recommendations && aiReport.recommendations.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <Brain className="h-3.5 w-3.5" /> Rekomendasi
                      </p>
                      <ul className="space-y-1.5">
                        {aiReport.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                            <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {aiReport.commonly_wrong_questions && aiReport.commonly_wrong_questions.length > 0 && (
                    <div>
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <XCircle className="h-3.5 w-3.5 text-rose-500" /> Soal Sering Keliru
                      </p>
                      <ul className="space-y-1.5">
                        {aiReport.commonly_wrong_questions.map((q, i) => (
                          <li key={i} className="rounded-lg border border-rose-100 bg-rose-50/50 p-3 text-xs text-slate-600">
                            {q}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pdf' && (
            <div className="flex flex-col items-center py-8">
              <FileText className="h-16 w-16 text-slate-300" />
              <h3 className="mt-4 text-lg font-bold text-slate-700">Download Laporan PDF</h3>
              <p className="mt-2 max-w-sm text-center text-sm text-slate-500">
                PDF berisi pre-test, post-test, video, triase, pelatihan, dan analisis AI.
                Unduh terbuka setelah analisis AI dihasilkan.
              </p>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading || !aiReport}
                className="mt-6 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-health-600 px-6 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:opacity-60 focus-ring"
              >
                <Download className="h-4 w-4" />
                {downloading ? 'Mengunduh…' : aiReport ? 'Download PDF' : 'Hasilkan analisis AI dulu'}
              </button>
              {!aiReport ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('ai')}
                  className="mt-3 cursor-pointer text-sm font-semibold text-health-700 underline-offset-2 hover:underline focus-ring"
                >
                  Buka analisis AI
                </button>
              ) : (
                <p className="mt-3 text-xs text-slate-400">Analisis AI sudah tergabung di PDF.</p>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── User Row ─────────────────────────────────────────────────────────────────

function UserRow({
  user,
  onDetail,
  onDownload,
}: {
  user: SkriningIndex
  onDetail: (username: string) => void
  onDownload: (username: string) => void
}) {
  const [dl, setDl] = useState(false)
  const handleDownload = () => {
    setDl(true)
    onDownload(user.username)
    setTimeout(() => setDl(false), 2000)
  }
  return (
    <tr className="border-b border-slate-100/80 transition-colors duration-150 hover:bg-health-50/40">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-800">{user.display_name || user.username}</p>
        <p className="text-xs text-slate-400">{user.username}</p>
      </td>
      <td className="px-3 py-3 text-sm text-slate-600">
        {user.puskesmas_nama || <span className="text-slate-300">—</span>}
      </td>
      <td className="px-3 py-3 text-center">
        <span
          className={`text-lg font-black tabular-nums ${levelColor(user.index_level)}`}
        >
          {user.index_score !== null ? user.index_score.toFixed(0) : '—'}
        </span>
      </td>
      <td className="px-3 py-3 text-center">
        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold uppercase ${levelBadge(user.index_level)}`}>
          {user.index_level ?? '—'}
        </span>
      </td>
      <td className="px-3 py-3 text-center text-sm tabular-nums text-slate-600">
        {user.pg_score !== null ? `${user.pg_score.toFixed(0)}%` : '—'}
        {maknaSkor('pg', user.pg_score) ? (
          <p className="text-[10px] font-semibold">{maknaSkor('pg', user.pg_score)}</p>
        ) : null}
      </td>
      <td className="px-3 py-3 text-center text-sm tabular-nums text-slate-600">
        {user.sk_score !== null ? `${user.sk_score.toFixed(0)}%` : '—'}
        {maknaSkor('sk', user.sk_score) ? (
          <p className="text-[10px] font-semibold">{maknaSkor('sk', user.sk_score)}</p>
        ) : null}
      </td>
      <td className="px-3 py-3 text-center text-sm tabular-nums text-slate-600">
        {user.td_score !== null ? `${user.td_score.toFixed(0)}%` : '—'}
        {maknaSkor('td', user.td_score) ? (
          <p className="text-[10px] font-semibold">{maknaSkor('td', user.td_score)}</p>
        ) : null}
      </td>
      <td className="px-3 py-3 text-center text-xs text-slate-400">
        {formatRelativeTime(user.submitted_at)}
      </td>
      <td className="px-3 py-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={dl}
            title="Download PDF"
            className="cursor-pointer rounded-lg border border-[var(--panel-border)] bg-white/80 p-1.5 text-xs font-medium text-health-700 transition hover:bg-health-50 focus-ring disabled:opacity-50"
          >
            {dl ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-health-400 border-t-transparent" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => onDetail(user.username)}
            className="cursor-pointer rounded-lg border border-[var(--panel-border)] bg-white/80 px-3 py-1.5 text-xs font-medium text-health-700 transition hover:bg-health-50 focus-ring"
          >
            Detail
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SkriningKesiapPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [summary, setSummary] = useState<SkriningSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [detailUser, setDetailUser] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const handleDownloadPdf = useCallback(async (username: string) => {
    try {
      await downloadSkriningPdf(username)
      toast('PDF berhasil diunduh', `${username} — Laporan Skrining Kesiapsiagaan`, 'success')
    } catch (e) {
      toast('Gagal mengunduh PDF', e instanceof Error ? e.message : 'Silakan coba lagi.', 'error')
    }
  }, [toast])

  const userHistory = useMemo(() => {
    if (!detailUser || !summary?.users) return []
    return summary.users.filter((u) => u.username === detailUser)
  }, [detailUser, summary?.users])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchSkriningSummary()
      setSummary(data)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Gagal memuat data skrining'
      setError(msg)
      toast('Gagal memuat data skrining', msg, 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const filteredUsers = useMemo(() => {
    if (!summary?.users) return []
    if (!search.trim()) return summary.users
    const q = search.toLowerCase()
    return summary.users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.display_name && u.display_name.toLowerCase().includes(q)) ||
        (u.puskesmas_nama && u.puskesmas_nama.toLowerCase().includes(q)),
    )
  }, [summary, search])

  const insights = useMemo(() => {
    if (!summary) return null
    const dims: { label: string; score: number | null }[] = [
      { label: 'Pengetahuan', score: summary.avg_pg },
      { label: 'Sikap', score: summary.avg_sk },
      { label: 'Tindakan', score: summary.avg_td },
    ]
    const dimsNeedingWork = dims.filter((d) => d.score !== null && d.score < 70).length
    const lowestDim = dims.reduce<{ label: string; score: number | null } | null>((min, d) => {
      if (d.score === null) return min
      if (!min || min.score === null || d.score < min.score) return d
      return min
    }, null)
    const mostRecent = summary.users
      .map((u) => u.submitted_at)
      .filter(Boolean)
      .sort((a, b) => (b && a ? new Date(b).getTime() - new Date(a).getTime() : 0))[0] ?? null
    return {
      dimsNeedingWork,
      lowestDim,
      mostRecent,
      unscreenedCount: summary.tanpa_index_count,
    }
  }, [summary])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-health-500 border-t-transparent" />
          <p className="mt-4 text-theme-muted">Memuat data skrining…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center px-4">
        <div className="glass-panel max-w-md rounded-2xl border border-rose-200/80 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
          <p className="mt-3 font-medium text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 cursor-pointer rounded-xl bg-merah px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-105 focus-ring"
          >
            Coba lagi
          </button>
        </div>
      </div>
    )
  }

  const avgLevel = summary?.avg_index !== null && summary?.avg_index !== undefined
    ? (summary.avg_index >= 80 ? 'Tinggi' : summary.avg_index >= 60 ? 'Menengah' : 'Rendah')
    : null

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* Header */}
        <div className="glass-panel overflow-hidden rounded-2xl border border-[var(--panel-border)]">
          <div
            className="bg-gradient-to-r from-health-700 to-health-600 px-5 py-5 sm:px-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="rounded-lg bg-white/15 p-1.5 text-white transition hover:bg-white/25 focus-ring"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90">
                    <BarChart3 className="h-3.5 w-3.5" />
                    Dashboard Admin
                  </div>
                </div>
                <h1 className="mt-3 text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Skrining Tingkat Kesiapsiagaan
                </h1>
                <p className="mt-1 max-w-2xl text-sm text-white/80">
                  Akumulasi skor Pengetahuan, Sikap, dan Tindakan dari kuesioner kesiapsiagaan
                  gempa. Indeks dihitung dari rata-rata dimensi yang tersedia.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/25 focus-ring"
              >
                <Activity className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--panel-border)] bg-white/60 px-5 py-3 text-xs text-theme-muted">
            <span>Total: {summary?.total_users ?? 0} petugas · {summary?.with_index_count ?? 0} sudah mengisi kuesioner</span>
            <span>Indeks = rata-rata (PG + SK + TD) · Adil: setiap dimensi berbobot sama</span>
          </div>
        </div>

        {/* Index Overview */}
        <div className="grid gap-4 md:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_280px]">
          {/* Gauge */}
          <div className="glass-panel flex flex-col items-center justify-center rounded-2xl border border-[var(--panel-border)] p-6">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Indeks Rata-rata</p>
            <IndexGauge score={summary?.avg_index ?? null} level={avgLevel} size={180} />
            <p className="mt-3 text-center text-xs text-slate-500">
              {summary?.with_index_count ?? 0} petugas terukur
            </p>
          </div>

          {/* Stats */}
          <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-theme">
              <BarChart3 className="h-4 w-4 text-health-600" />
              Distribusi Tingkat Kesiapsiagaan
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-4 text-center">
                <p className="text-3xl font-black tabular-nums text-emerald-600">{summary?.high_count ?? 0}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-500">Tinggi (≥80)</p>
                <div className="mt-2">
                  <ScoreBar value={summary?.high_count ?? 0} max={summary?.with_index_count || 1} color="#27AE60" />
                </div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-4 text-center">
                <p className="text-3xl font-black tabular-nums text-amber-600">{summary?.medium_count ?? 0}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-amber-500">Menengah (60–79)</p>
                <div className="mt-2">
                  <ScoreBar value={summary?.medium_count ?? 0} max={summary?.with_index_count || 1} color="#F39C12" />
                </div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-4 text-center">
                <p className="text-3xl font-black tabular-nums text-rose-600">{summary?.low_count ?? 0}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-rose-500">Rendah (&lt;60)</p>
                <div className="mt-2">
                  <ScoreBar value={summary?.low_count ?? 0} max={summary?.with_index_count || 1} color="#E74C3C" />
                </div>
              </div>
            </div>
            {summary?.tanpa_index_count ? (
              <p className="mt-3 text-center text-xs text-amber-600">
                ⚠ {summary.tanpa_index_count} petugas belum mengisi kuesioner
              </p>
            ) : null}
          </div>

          {/* Dimension averages */}
          <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-theme">
              <Activity className="h-4 w-4 text-health-600" />
              Rata-rata per Dimensi
            </p>
            <div className="space-y-4">
              <DimCard label="Pengetahuan" kind="pg" score={summary?.avg_pg ?? null} icon={BookOpen} color="#1F4E79" />
              <DimCard label="Sikap" kind="sk" score={summary?.avg_sk ?? null} icon={Brain} color="#27AE60" />
              <DimCard label="Tindakan" kind="td" score={summary?.avg_td ?? null} icon={Activity} color="#F39C12" />
            </div>
          </div>
        </div>

        {/* Interpretasi Hasil Pre-test & Post-test */}
        <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-theme">
            <Info className="h-4 w-4 text-health-600" />
            Makna Hasil Pre-test &amp; Post-test
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Indeks Keseluruhan */}
            <div className="rounded-xl border border-slate-100 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Indeks Kesiapsiagaan Keseluruhan
              </p>
              {summary?.avg_index !== null && summary?.avg_index !== undefined ? (
                <>
                  <p className={`text-2xl font-black tabular-nums ${levelColor(avgLevel)}`}>
                    {summary.avg_index.toFixed(0)}
                  </p>
                  <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${levelBadge(avgLevel)}`}>
                    {avgLevel ?? '—'}
                  </span>
                  <p className="mt-2 text-xs text-slate-500">
                    {summary.avg_index >= 80
                      ? 'Petugas menunjukkan kesiapsiagaan tinggi — siap menghadapi gempa.'
                      : summary.avg_index >= 60
                      ? 'Kesiapsiagaan menengah — perlu penguatan pada dimensi tertentu.'
                      : 'Kesiapsiagaan rendah — butuh intervensi segera.'}
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-400">Belum ada data.</p>
              )}
            </div>

            {/* Pre-test */}
            <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600">
                <BookOpen className="h-3.5 w-3.5" /> Pre-test
              </p>
              <p className="text-xs text-slate-600">
                Pre-test mengukur <strong>Pengetahuan (PG)</strong> dan{' '}
                <strong>Tindakan (TD)</strong>. Tidak mengukur sikap.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                <span className="font-medium text-blue-700">Indeks Pre-test = (PG + TD) / 2</span>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                <li>• PG ≥76% = Baik · 56–75% = Cukup · &lt;56% = Kurang</li>
                <li>• TD ≥50% = Baik · &lt;50% = Buruk</li>
                <li>• Indeks ≥80 = Tinggi · 60–79 = Menengah · &lt;60 = Rendah</li>
              </ul>
            </div>

            {/* Post-test */}
            <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-600">
                <Brain className="h-3.5 w-3.5" /> Post-test
              </p>
              <p className="text-xs text-slate-600">
                Post-test mengukur <strong>Pengetahuan (PG)</strong>,{' '}
                <strong>Sikap (SK)</strong>, dan <strong>Tindakan (TD)</strong>.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                <span className="font-medium text-violet-700">Indeks Post-test = (PG + SK + TD) / 3</span>
              </p>
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                <li>• PG dan SK ≥76% = Baik · 56–75% = Cukup · &lt;56% = Kurang</li>
                <li>• TD ≥50% = Baik · &lt;50% = Buruk</li>
                <li>• Peningkatan skor vs pre-test menunjukkan efektivitas pelatihan</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Insight Cards */}
        {insights && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div
              className={`rounded-xl border p-4 shadow-sm ${
                insights.dimsNeedingWork > 0
                  ? 'border-rose-200 bg-gradient-to-br from-rose-50 to-white'
                  : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    insights.dimsNeedingWork > 0 ? 'bg-rose-100' : 'bg-emerald-100'
                  }`}
                >
                  {insights.dimsNeedingWork > 0 ? (
                    <TrendingDown className="h-4 w-4 text-rose-500" />
                  ) : (
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  )}
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Perlu Diperbaiki
                </p>
              </div>
              <p
                className={`mt-2 text-2xl font-black tabular-nums ${
                  insights.dimsNeedingWork > 0 ? 'text-rose-600' : 'text-emerald-600'
                }`}
              >
                {insights.dimsNeedingWork}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">aspek</p>
            </div>

            <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                  <TrendingDown className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Skor Terendah
                </p>
              </div>
              <p className="mt-2 text-lg font-black text-amber-600">
                {insights.lowestDim?.score !== null ? insights.lowestDim?.score?.toFixed(0) : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">{insights.lowestDim?.label ?? '—'}</p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Clock className="h-4 w-4 text-blue-500" />
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Skrining Terakhir
                </p>
              </div>
              <p className="mt-2 text-sm font-bold text-blue-600">
                {insights.mostRecent
                  ? new Date(insights.mostRecent).toLocaleDateString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '—'}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">tanggal</p>
            </div>

            <div
              className={`rounded-xl border p-4 shadow-sm ${
                insights.unscreenedCount > 0
                  ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
                  : 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    insights.unscreenedCount > 0 ? 'bg-amber-100' : 'bg-emerald-100'
                  }`}
                >
                  <Users
                    className={`h-4 w-4 ${insights.unscreenedCount > 0 ? 'text-amber-500' : 'text-emerald-500'}`}
                  />
                </div>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                  Belum Skrining
                </p>
              </div>
              <p
                className={`mt-2 text-2xl font-black tabular-nums ${
                  insights.unscreenedCount > 0 ? 'text-amber-600' : 'text-emerald-600'
                }`}
              >
                {insights.unscreenedCount ?? 0}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">petugas</p>
            </div>
          </div>
        )}

        {/* User Table */}
        <div className="glass-panel overflow-hidden rounded-2xl border border-[var(--panel-border)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--panel-border)] bg-white/60 px-4 py-3">
            <p className="text-sm text-theme-muted">
              Menampilkan <strong className="text-theme">{filteredUsers.length}</strong> dari{' '}
              {summary?.users.length ?? 0} petugas
            </p>
            <div className="relative w-full sm:w-72">
              <input
                type="search"
                placeholder="Cari petugas…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-[var(--panel-border)] bg-white/90 py-2.5 pl-10 pr-4 text-sm text-theme outline-none transition focus:border-health-500/50 focus:ring-[3px] focus:ring-health-500/20"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-[var(--panel-border)] bg-slate-50/60 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Petugas</th>
                  <th className="px-3 py-3">Puskesmas</th>
                  <th className="px-3 py-3 text-center">Indeks</th>
                  <th className="px-3 py-3 text-center">Tingkat</th>
                  <th className="px-3 py-3 text-center">PG (%)</th>
                  <th className="px-3 py-3 text-center">SK (%)</th>
                  <th className="px-3 py-3 text-center">TD (%)</th>
                  <th className="px-3 py-3 text-center">Terakhir</th>
                  <th className="px-3 py-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-16 text-center">
                      <Users className="mx-auto h-10 w-10 text-slate-300" />
                      <p className="mt-3 text-slate-500">Tidak ada petugas yang cocok.</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <UserRow key={u.username} user={u} onDetail={setDetailUser} onDownload={handleDownloadPdf} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Legenda & Interpretasi Skala */}
        <div className="glass-panel rounded-2xl border border-[var(--panel-border)] p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-theme">
            <Info className="h-4 w-4 text-health-600" />
            Legenda &amp; Interpretasi Skala
          </div>
          <div className="grid gap-5 text-sm md:grid-cols-2 xl:grid-cols-4">

            {/* Indeks Kesiapsiagaan */}
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 font-semibold text-slate-700">Indeks Kesiapsiagaan</p>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-700">T</span>
                  <span><strong className="text-emerald-700">Tinggi ≥80:</strong> Kesiapsiagaan kuat — petugas siap menghadapi gempa</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700">M</span>
                  <span><strong className="text-amber-700">Menengah 60–79:</strong> Perlu penguatan pada dimensi tertentu</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-700">R</span>
                  <span><strong className="text-rose-700">Rendah &lt;60:</strong> Butuh intervensi segera</span>
                </div>
                <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-400">
                  Pre-test: (PG+TD)/2 · Post-test: (PG+SK+TD)/3
                </div>
              </div>
            </div>

            {/* Pengetahuan */}
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 font-semibold text-slate-700">Pengetahuan (PG)</p>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div><span className="font-semibold text-emerald-600">Baik ≥76%</span> — Pemahaman konsep kesiapsiagaan gempa baik</div>
                <div><span className="font-semibold text-amber-600">Cukup 56–75%</span> — Pemahaman cukup, perlu penguatan</div>
                <div><span className="font-semibold text-rose-600">Kurang &lt;56%</span> — Pemahaman kurang, perlu edukasi segera</div>
                <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-400">
                  8 soal pilihan ganda · Benar = 1, Salah = 0
                </div>
              </div>
            </div>

            {/* Sikap */}
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 flex items-center gap-2 font-semibold text-slate-700">
                Sikap (SK)
                <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-medium uppercase text-violet-700">hanya post-test</span>
              </p>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div><span className="font-semibold text-emerald-600">Baik ≥76%</span> — Sikap positif terhadap kesiapsiagaan</div>
                <div><span className="font-semibold text-amber-600">Cukup 56–75%</span> — Sikap cukup positif, perlu konsolidasi</div>
                <div><span className="font-semibold text-rose-600">Kurang &lt;56%</span> — Sikap kurang positif, perlu motivasi</div>
                <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-400">
                  15 butir Likert SS–STS · Skala HBM-TPB
                </div>
              </div>
            </div>

            {/* Tindakan */}
            <div className="rounded-xl border border-slate-100 bg-white p-3">
              <p className="mb-2 font-semibold text-slate-700">Tindakan (TD)</p>
              <div className="space-y-1.5 text-xs text-slate-500">
                <div><span className="font-semibold text-emerald-600">Baik ≥50%</span> — Sudah melakukan tindakan kesiapsiagaan</div>
                <div><span className="font-semibold text-rose-600">Buruk &lt;50%</span> — Perlu peningkatan tindakan nyata</div>
                <div className="mt-2 rounded bg-slate-50 p-2 text-[11px] text-slate-400">
                  Pre-test: Likert 1–4 · Post-test: Likert SS–STS
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {detailUser ? (
          <DetailModal username={detailUser} userHistory={userHistory} onClose={() => setDetailUser(null)} />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

