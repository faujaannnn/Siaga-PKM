import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CloudLightning,
  FileText,
  Headphones,
} from 'lucide-react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { Link } from 'react-router-dom'

import { useTheme } from '../context/ThemeContext'
import { easeOutExpo, staggerLight } from '@dr-diah/siaga-frontend-core'
import { DisasterHeroIllustration } from './DisasterHeroIllustration'

const topicChips = [
  { label: 'Gempa bumi', hint: 'Simulasi & titik kumpul' },
  { label: 'Banjir & tsunami', hint: 'Waspadai saluran & rumah' },
  { label: 'Tanah longsor', hint: 'Hindari lereng saat hujan' },
] as const

const trustPoints = [
  'Akses layanan kesehatan dan informasi fasilitas di satu tempat',
  'Formulir laporan bencana jelas, mengarah ke petugas',
  'Materi edukasi masyarakat setelah autentikasi yang aman',
] as const

const bentoItems = [
  {
    kicker: 'Kesehatan',
    title: 'Garis depan pasca-bencana',
    body: 'Dari layanan dasar hingga cek kesehatan warga saat kondisi tidak stabil - tetap tegas pada protokol kesehatan dan siaga bencana.',
    icon: Activity,
    accent: 'health' as const,
    href: '/profil',
  },
  {
    kicker: 'Koordinasi',
    title: 'Laporan terstruktur',
    body: 'Kolom waktu, lokasi, dan jenis kejadian membantu prioritas, tanpa melewati pihak yang berwenang.',
    icon: FileText,
    accent: 'merah' as const,
    href: '/lapor-bencana',
  },
  {
    kicker: 'Akses warga',
    title: 'Saluran Saran & Aduan',
    body: 'Bukan hanya bencana: saran warga memperkuat fasilitas sebelum bencana datang.',
    icon: Headphones,
    accent: 'amber' as const,
    href: '/saran-aduan',
  },
] as const

const quickLinks = [
  { label: 'Lapor bencana', href: '/lapor-bencana', icon: AlertTriangle, accent: 'merah' as const },
  { label: 'Saran & aduan', href: '/saran-aduan', icon: Headphones, accent: 'amber' as const },
] as const

const stagger: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: staggerLight,
  },
}

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: easeOutExpo },
  },
}

/**
 * Beranda bawaan - tema bencana alam: hierarki jelas, kontras teks,
 * animasi Framer (stagger / whileInView) + hormati prefers-reduced-motion.
 * Referensi irama layout: panel status & peta bacaan dari proyek krisis open-source
 * (mis. peta bacaan crisismap, crisis dashboard) disederhanakan untuk layanan publik.
 */
export function DefaultHomeWelcome() {
  const { theme } = useTheme()
  const isDay = theme === 'day'
  const reduceMotion = useReducedMotion()

  return (
    <motion.div
      className="space-y-10 md:space-y-12"
      variants={stagger}
      initial={reduceMotion ? 'show' : 'hidden'}
      animate="show"
    >
      <motion.section
        variants={fadeUp}
        aria-labelledby="home-welcome-heading"
        className="home-hero-shell relative overflow-hidden rounded-3xl border border-[var(--panel-border)] shadow-[0_24px_80px_-20px_rgba(8,145,178,0.2)] dark:shadow-[0_28px_90px_-24px_rgba(0,0,0,0.55)]"
      >
        <div
          className="absolute inset-0 z-[1] bg-gradient-to-br from-white/95 via-cyan-50/60 to-amber-50/35 dark:from-cosmic-950/90 dark:via-merah/14 dark:to-cosmic-900/85"
          aria-hidden
        />
        <div className="absolute inset-0 z-[2] border border-white/30 ring-1 ring-amber-500/10 dark:border-white/6 dark:ring-amber-500/8" />

        <div className="relative z-10 px-5 py-9 sm:px-8 sm:py-11 md:px-11 md:py-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-amber-950 shadow-sm dark:border-amber-400/25 dark:bg-cosmic-800/80 dark:text-amber-100/95">
            <CloudLightning className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" aria-hidden />
            Kesiapsiagaan bencana &amp; koordinasi puskesmas
          </div>

          <div className="mt-8 grid items-start gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="min-w-0 space-y-7 lg:col-span-7">
              <div className="space-y-4">
                <h1
                  id="home-welcome-heading"
                  className="font-[family-name:var(--font-heading)] text-[1.75rem] font-bold leading-[1.12] tracking-tight text-theme sm:text-4xl md:text-[2.65rem] md:leading-[1.08]"
                >
                  <span className="block text-base font-semibold uppercase tracking-[0.14em] text-theme-muted sm:text-sm">
                    Selamat datang
                  </span>
                  <span
                    className={
                      isDay
                        ? 'mt-2 block bg-gradient-to-r from-slate-900 via-health-700 to-amber-800 bg-clip-text text-transparent dark:from-white dark:via-cyan-100 dark:to-amber-100'
                        : 'mt-2 block bg-gradient-to-r from-white via-cyan-100 to-amber-100/90 bg-clip-text text-transparent'
                    }
                  >
                    Sistem Aplikasi Kesiapsiagaan Puskesmas
                  </span>
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-theme-muted sm:text-lg">
                  SiAP-PKM adalah portal digital untuk petugas puskesmas - edukasi kesiapsiagaan bencana,
                  penilaian LIPI, pelatihan, dan koordinasi antar puskesmas.
                </p>
              </div>

              <ul
                className="flex flex-wrap gap-2"
                aria-label="Jenis bencana yang perlu kesiapsiagaan lokal (edukasi)"
              >
                {topicChips.map((c) => (
                  <li key={c.label}>
                    <span
                      className="inline-flex min-h-11 cursor-default flex-col justify-center rounded-2xl border border-[var(--panel-border)] bg-white/86 px-4 py-2 text-left shadow-sm dark:bg-cosmic-800/60"
                    >
                      <span className="text-xs font-semibold text-theme">{c.label}</span>
                      <span className="text-[11px] text-theme-muted">{c.hint}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <ul className="flex max-w-2xl flex-col gap-3" aria-label="Nilai layanan">
                {trustPoints.map((label) => (
                  <li key={label} className="flex items-start gap-3 text-sm text-theme sm:text-base">
                    <CheckCircle2
                      className="mt-0.5 h-5 w-5 shrink-0 text-cta-600 dark:text-emerald-400"
                      aria-hidden
                    />
                    <span>{label}</span>
                  </li>
                ))}
              </ul>

              <blockquote className="max-w-xl border-l-4 border-amber-600 py-1 pl-5 text-sm italic leading-relaxed text-theme-muted dark:border-amber-500/80 sm:text-base">
                Siap sebelum bencana, tanggap saat kejadian, pulih setelahnya.
              </blockquote>
            </div>

            <div className="flex flex-col items-center justify-center gap-4 lg:col-span-5 lg:pt-1">
              <div className="w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-white/92 p-4 shadow-lg ring-1 ring-amber-500/12 dark:bg-cosmic-800/78 dark:ring-amber-400/10 sm:p-5">
                <DisasterHeroIllustration className="mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Quick-access chips */}
      <motion.div variants={fadeUp} className="flex flex-wrap gap-2" aria-label="Akses cepat">
        {quickLinks.map((q) => {
          const Icon = q.icon
          const cls =
            q.accent === 'merah'
              ? 'border-merah/20 bg-merah/[0.05] text-merah hover:bg-merah/[0.09]'
              : 'border-amber-500/30 bg-amber-50 text-amber-800 hover:bg-amber-100/80'
          return (
            <Link
              key={q.href}
              to={q.href}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition duration-200 focus-ring ${cls}`}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {q.label}
            </Link>
          )
        })}
      </motion.div>

      <motion.section
        variants={fadeUp}
        className="space-y-4"
        aria-labelledby="home-bento-heading"
      >
        <div className="max-w-2xl">
          <h2
            id="home-bento-heading"
            className="font-[family-name:var(--font-heading)] text-xl font-semibold tracking-tight text-theme md:text-2xl"
          >
            Fokus kami saat bencana
          </h2>
          <p className="mt-1.5 text-sm leading-relaxed text-theme-muted md:text-base">
            Tiga pilar sederhana agar warga, layanan kesehatan, dan fasilitas saling memahami peran
            masing-masing.
          </p>
        </div>
        <ul className="grid gap-4 md:grid-cols-3">
          {bentoItems.map((b) => {
            const Icon = b.icon
            const iconBg =
              b.accent === 'health'
                ? 'bg-health-100/90 text-health-800 dark:bg-health-500/15 dark:text-health-300'
                : b.accent === 'merah'
                  ? 'bg-merah/[0.09] text-merah dark:bg-merah/[0.14]'
                  : 'bg-amber-100/90 text-amber-900 dark:bg-amber-500/12 dark:text-amber-200'
            const kickerColor =
              b.accent === 'health'
                ? 'text-health-700 dark:text-health-400'
                : b.accent === 'merah'
                  ? 'text-merah dark:text-merah-bright'
                  : 'text-amber-700 dark:text-amber-300'
            return (
              <li key={b.title}>
                <Link
                  to={b.href}
                  className="group relative flex h-full cursor-pointer flex-col rounded-2xl border border-[var(--panel-border)] bg-white/82 p-5 shadow-sm transition-all duration-200 hover:border-opacity-60 hover:shadow-md focus-ring dark:bg-cosmic-800/50 card-lift"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${iconBg}`}
                      aria-hidden
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.1} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] font-semibold uppercase tracking-wide ${kickerColor}`}>
                        {b.kicker}
                      </p>
                      <h3 className="mt-0.5 text-sm font-semibold text-theme md:text-base">{b.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-theme-muted sm:text-sm">{b.body}</p>
                  <div className={`mt-4 text-xs font-semibold ${kickerColor} opacity-0 transition-opacity duration-200 group-hover:opacity-100`}>
                    Lihat →
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </motion.section>
    </motion.div>
  )
}
