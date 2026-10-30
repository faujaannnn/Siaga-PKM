import {
  ArrowRight,
  ClipboardCheck,
  FileCheck2,
  HeartPulse,
  HelpCircle,
  LogIn,
  Phone,
  PlayCircle,
  Shield,
  X,
} from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Fragment, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'

type FlowNode = {
  num: string
  title: string
  lines: string[]
  icon: typeof LogIn
  tone: 'health' | 'merah' | 'sky' | 'amber' | 'emerald' | 'rose'
}

const FLOW: FlowNode[] = [
  {
    num: '0',
    title: 'Masuk',
    lines: ['Login petugas', '→ Ruang /petugas', '3 tab: Materi · Profil · WA'],
    icon: LogIn,
    tone: 'health',
  },
  {
    num: '1',
    title: 'Pre-test',
    lines: ['Kuesioner Gempa', '5 bagian · validasi', '/petugas/kuis-lipi'],
    icon: ClipboardCheck,
    tone: 'merah',
  },
  {
    num: '2',
    title: 'Belajar',
    lines: ['Bahan bacaan', 'Video Belajar++', 'Tonton → asesmen → cek jawaban'],
    icon: PlayCircle,
    tone: 'sky',
  },
  {
    num: '3',
    title: 'Triase',
    lines: ['Latihan START', 'H · K · M · Hitam', '60 dtk · review AI'],
    icon: HeartPulse,
    tone: 'amber',
  },
  {
    num: '4',
    title: 'Post-test',
    lines: ['Kuesioner Gempa', 'Likert SS–STS', 'Setelah materi selesai'],
    icon: ClipboardCheck,
    tone: 'rose',
  },
  {
    num: '5',
    title: 'Hasil',
    lines: ['Indeks 0–100', 'Unduh PDF · WA', 'Profil video'],
    icon: FileCheck2,
    tone: 'emerald',
  },
]

const TONE: Record<FlowNode['tone'], string> = {
  health: 'border-health-500/35 bg-gradient-to-br from-health-500/12 to-cyan-500/8 ring-health-500/20',
  merah: 'border-merah/30 bg-gradient-to-br from-merah/10 to-rose-500/8 ring-merah/15',
  sky: 'border-sky-500/35 bg-gradient-to-br from-sky-500/12 to-cyan-400/8 ring-sky-500/20',
  amber: 'border-amber-500/40 bg-gradient-to-br from-amber-500/12 to-orange-500/8 ring-amber-500/20',
  emerald: 'border-emerald-500/35 bg-gradient-to-br from-emerald-500/12 to-health-500/8 ring-emerald-500/20',
  rose: 'border-rose-400/35 bg-gradient-to-br from-rose-500/10 to-merah/8 ring-rose-400/20',
}

const ICON_TONE: Record<FlowNode['tone'], string> = {
  health: 'bg-health-600 text-white shadow-health-600/30',
  merah: 'bg-merah text-white shadow-merah/30',
  sky: 'bg-sky-600 text-white shadow-sky-600/25',
  amber: 'bg-amber-500 text-amber-950 shadow-amber-500/25',
  emerald: 'bg-emerald-600 text-white shadow-emerald-600/25',
  rose: 'bg-rose-600 text-white shadow-rose-600/25',
}

function FlowArrow({ className }: { className?: string }) {
  return (
    <div className={`flex shrink-0 items-center justify-center text-health-600/70 ${className ?? ''}`} aria-hidden>
      <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 md:h-6 md:w-6" strokeWidth={2.5} />
    </div>
  )
}

function FlowArrowDown({ className }: { className?: string }) {
  return (
    <div className={`flex justify-center text-health-600/70 ${className ?? ''}`} aria-hidden>
      <ArrowRight className="h-4 w-4 rotate-90 sm:h-5 sm:w-5" strokeWidth={2.5} />
    </div>
  )
}

function FlowNodeCard({ node }: { node: FlowNode }) {
  const Icon = node.icon
  return (
    <article
      className={`relative flex h-full min-h-0 w-full flex-col items-center justify-center rounded-2xl border px-2 pb-2.5 pt-5 text-center shadow-md ring-1 sm:rounded-3xl sm:px-3 sm:pb-3 sm:pt-6 md:px-3 md:pb-3 md:pt-6 lg:px-4 lg:pb-4 lg:pt-7 ${TONE[node.tone]}`}
    >
      <span
        className={`absolute left-1/2 top-0 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-black shadow-md sm:h-7 sm:w-7 sm:text-xs ${ICON_TONE[node.tone]}`}
      >
        {node.num}
      </span>
      <span
        className={`mb-1.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-inner sm:mb-2 sm:h-10 sm:w-10 md:h-11 md:w-11 ${ICON_TONE[node.tone]}`}
        aria-hidden
      >
        <Icon className="h-4 w-4 sm:h-[1.15rem] sm:w-[1.15rem] md:h-5 md:w-5" strokeWidth={2.1} />
      </span>
      <h3 className="text-[11px] font-bold leading-tight text-theme sm:text-xs md:text-sm">{node.title}</h3>
      <ul className="mt-1 flex min-h-[2.75rem] w-full flex-col justify-center space-y-0.5 sm:min-h-[3rem] md:min-h-[3.25rem]">
        {node.lines.map((line) => (
          <li key={line} className="text-[9px] leading-snug text-theme-muted sm:text-[10px] md:text-[11px]">
            {line}
          </li>
        ))}
      </ul>
    </article>
  )
}

type Props = {
  open: boolean
  onClose: () => void
}

export function HomeOnboardingOverlay({ open, onClose }: Props) {
  const reduceMotion = useReducedMotion()
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="fixed inset-0 z-[9999] flex h-[100dvh] max-h-[100dvh] w-full flex-col overflow-hidden bg-gradient-to-br from-cyan-50 via-white to-amber-50 dark:from-cosmic-950 dark:via-cosmic-900 dark:to-merah/12"
          style={{
            paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
            paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
            paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
            paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(8,145,178,0.14),transparent_45%),radial-gradient(circle_at_80%_100%,rgba(196,30,58,0.08),transparent_40%)]"
            aria-hidden
          />

          {/* Satu frame — tanpa scroll, isi penuh layar */}
          <div className="relative z-10 flex h-full min-h-0 w-full flex-col px-3 py-2 sm:px-5 sm:py-3 md:px-8 md:py-4 lg:px-10">
            <header className="grid shrink-0 grid-cols-[2.5rem_minmax(0,1fr)_2.5rem] items-start gap-1 pb-1 sm:pb-2">
              <div aria-hidden className="h-10 w-10" />
              <div className="min-w-0 text-center">
                <h2
                  id={titleId}
                  className="font-[family-name:var(--font-heading)] text-sm font-bold leading-snug text-theme sm:text-lg md:text-xl"
                >
                  Alur Skrining Kesiapsiagaan Bencana Kepada Staf Puskesmas
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Tutup panduan"
                className="inline-flex h-10 w-10 cursor-pointer items-center justify-center justify-self-end rounded-xl border border-[var(--panel-border)] bg-white/90 text-theme shadow-sm transition hover:bg-black/[0.04] focus-ring dark:bg-cosmic-800/80"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </header>

            {/* Infografis — desktop: satu baris simetris; mobile: grid 3×2 */}
            <figure className="relative flex min-h-0 w-full flex-1 flex-col items-center justify-center py-1 sm:py-2">
              <div className="mx-auto hidden w-full max-w-[84rem] items-stretch md:flex">
                {FLOW.map((node, i) => (
                  <Fragment key={node.num}>
                    <div className="flex min-w-0 flex-1 basis-0">
                      <FlowNodeCard node={node} />
                    </div>
                    {i < FLOW.length - 1 ? (
                      <FlowArrow className="w-6 shrink-0 self-center lg:w-7" />
                    ) : null}
                  </Fragment>
                ))}
              </div>

              <div className="mx-auto grid w-full max-w-sm grid-cols-3 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-x-2 gap-y-1 sm:max-w-md sm:gap-x-2.5 sm:gap-y-1.5 md:hidden">
                {FLOW.slice(0, 3).map((node) => (
                  <FlowNodeCard key={node.num} node={node} />
                ))}
                <div className="col-span-3 flex items-center justify-center py-0.5">
                  <FlowArrowDown />
                </div>
                {FLOW.slice(3).map((node) => (
                  <FlowNodeCard key={node.num} node={node} />
                ))}
              </div>

              <figcaption className="sr-only">
                Alur petugas SiAP-PKM: masuk login ke ruang petugas, pre-test kuesioner gempa, belajar materi
                dan video dengan asesmen, latihan triase START, post-test, lalu lihat hasil indeks dan PDF.
              </figcaption>
            </figure>

            <footer className="mt-auto flex shrink-0 flex-col items-center gap-2 pt-1 sm:gap-2.5 sm:pt-2">
              <nav
                className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs"
                aria-label="Tautan bantuan"
              >
                <Link
                  to="/bantuan"
                  className="inline-flex items-center gap-1 text-theme-muted transition hover:text-health-700 focus-ring dark:hover:text-health-300"
                >
                  <HelpCircle className="h-3.5 w-3.5" aria-hidden />
                  Bantuan &amp; Panduan
                </Link>
                <span className="text-theme-soft" aria-hidden>
                  ·
                </span>
                <Link
                  to="/privasi"
                  className="inline-flex items-center gap-1 text-theme-muted transition hover:text-health-700 focus-ring dark:hover:text-health-300"
                >
                  <Shield className="h-3.5 w-3.5" aria-hidden />
                  Kebijakan Privasi
                </Link>
                <span className="text-theme-soft" aria-hidden>
                  ·
                </span>
                <Link
                  to="/kontak"
                  className="inline-flex items-center gap-1 text-theme-muted transition hover:text-health-700 focus-ring dark:hover:text-health-300"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  Kontak
                </Link>
              </nav>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-10 w-full max-w-xs cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-merah to-merah-bright px-5 text-sm font-semibold text-white shadow-md shadow-merah/20 transition hover:brightness-105 focus-ring sm:max-w-sm"
              >
                Mengerti, tutup
              </button>
            </footer>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return overlay

  return createPortal(overlay, document.body)
}
