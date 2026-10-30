import { BarChart3, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { fetchPublicVisitStats, postPublicVisitPing } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import type { PublicVisitStatsSummary } from '../types'

const VISIT_SESSION_KEY = 'siaga_public_visit_ping_v1'
const VISIT_THROTTLE_MS = 25 * 60 * 1000

const LOGOS = {
  untad: '/images/logos/untad.png',
  bnpb: '/images/logos/bnpb.png',
  bmkg: '/images/logos/bmkg.png',
  kemenkes: '/images/logos/kemenkes.png',
  dinkesSulteng: '/images/logos/dinkes-sulteng.png',
  inarisk: '/images/logos/inarisk.png',
  geospasial: '/images/logos/geospasial.png',
  dataBnpb: '/images/logos/data-bnpb.png',
} as const

/**
 * Mitra resmi - logo dilayani dari aset lokal (public/images/logos/).
 * Fallback ke Google Favicon API jika file lokal belum tersedia.
 */
const DISASTER_RELATED_ORGS = [
  {
    name: 'Universitas Tadulako (UNTAD)',
    short: 'UNTAD',
    href: 'https://untad.ac.id/',
    logoUrls: [LOGOS.untad, 'https://www.google.com/s2/favicons?domain=untad.ac.id&sz=64'],
  },
  {
    name: 'Badan Nasional Penanggulangan Bencana',
    short: 'BNPB',
    href: 'https://www.bnpb.go.id/',
    logoUrls: [LOGOS.bnpb, 'https://www.google.com/s2/favicons?domain=www.bnpb.go.id&sz=64'],
  },
  {
    name: 'Badan Meteorologi, Klimatologi, dan Geofisika',
    short: 'BMKG',
    href: 'https://www.bmkg.go.id/',
    logoUrls: [LOGOS.bmkg, 'https://www.google.com/s2/favicons?domain=www.bmkg.go.id&sz=64'],
  },
  {
    name: 'Pusat Krisis Kesehatan - Kemenkes RI',
    short: 'Krisis Kemenkes',
    href: 'https://pusatkrisis.kemkes.go.id/',
    logoUrls: [LOGOS.kemenkes, 'https://www.google.com/s2/favicons?domain=pusatkrisis.kemkes.go.id&sz=64'],
  },
  {
    name: 'Dinas Kesehatan Provinsi Sulawesi Tengah',
    short: 'Dinkes Sulteng',
    href: 'https://dinkes.sultengprov.go.id/',
    logoUrls: [LOGOS.dinkesSulteng, 'https://www.google.com/s2/favicons?domain=dinkes.sultengprov.go.id&sz=64'],
  },
  {
    name: 'INA-RISK - BNPB',
    short: 'INA-RISK',
    href: 'https://inarisk.bnpb.go.id/',
    logoUrls: [LOGOS.inarisk, LOGOS.bnpb],
  },
  {
    name: 'Geospasial Kebencanaan - BNPB',
    short: 'Geospasial BNPB',
    href: 'https://geospasial.bnpb.go.id/',
    logoUrls: [LOGOS.geospasial, 'https://www.google.com/s2/favicons?domain=geospasial.bnpb.go.id&sz=64'],
  },
  {
    name: 'Portal Data Kebencanaan - BNPB',
    short: 'Data BNPB',
    href: 'https://data.bnpb.go.id/',
    logoUrls: [LOGOS.dataBnpb, 'https://www.google.com/s2/favicons?domain=data.bnpb.go.id&sz=64'],
  },
] as const

function PartnerBrandImage({ urls, shortLabel }: { urls: readonly string[]; shortLabel: string }) {
  const [idx, setIdx] = useState(0)
  const failedAll = idx >= urls.length
  const src = urls[idx] ?? ''

  if (failedAll || !src) {
    const monogram = shortLabel.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || '·'
    return (
      <span
        className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-health-500/25 to-merah/25 text-[9px] font-bold leading-none text-theme"
        aria-hidden
      >
        {monogram}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      width={40}
      height={40}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="h-8 w-8 object-contain"
      onError={() => setIdx((i) => (i + 1 < urls.length ? i + 1 : urls.length))}
    />
  )
}

function tryRecordVisitSession(): void {
  try {
    const now = Date.now()
    const raw = sessionStorage.getItem(VISIT_SESSION_KEY)
    if (raw) {
      const t = Number.parseInt(raw, 10)
      if (Number.isFinite(t) && now - t < VISIT_THROTTLE_MS) return
    }
    sessionStorage.setItem(VISIT_SESSION_KEY, String(now))
    void postPublicVisitPing().catch(() => {
      sessionStorage.removeItem(VISIT_SESSION_KEY)
    })
  } catch {
    /* private mode / non-browser */
  }
}

function MiniWeekBars({ series }: { series: { date: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((d) => d.count))
  return (
    <div className="mt-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-theme-muted">Tren 7 hari</p>
      <div className="mt-2 flex h-14 items-end justify-between gap-1.5" role="img" aria-label="Batang kunjungan 7 hari terakhir">
        {series.map((d) => {
          const hPx = Math.max(3, Math.round((d.count / max) * 48))
          const day = d.date.slice(8)
          return (
            <div key={d.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div
                className="w-full max-w-[2.25rem] rounded-t-md bg-gradient-to-t from-merah/55 via-health-600/70 to-cyan-400/85 shadow-sm dark:from-merah/40 dark:via-cyan-700/60 dark:to-cyan-300/75"
                style={{ height: `${hPx}px` }}
                title={`${d.date}: ${d.count}`}
              />
              <span className="text-[10px] tabular-nums text-theme-muted">{day}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

type Props = {
  copyrightLine: string
}

export function SiteStatsPartnersFooter({ copyrightLine }: Props) {
  const { theme } = useTheme()
  const day = theme === 'day'
  const nf = new Intl.NumberFormat('id-ID')
  const [stats, setStats] = useState<PublicVisitStatsSummary | null>(null)
  const [statsErr, setStatsErr] = useState(false)

  useEffect(() => {
    tryRecordVisitSession()
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetchPublicVisitStats()
      .then((s) => {
        if (!cancelled) {
          setStats(s)
          setStatsErr(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatsErr(true)
          setStats(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.4 }}
        className={`grid gap-8 rounded-2xl border p-5 shadow-[0_20px_48px_-24px_rgba(8,145,178,0.2)] md:gap-10 md:p-7 lg:grid-cols-2 ${
          day
            ? 'border-slate-200/80 bg-gradient-to-br from-white via-cyan-50/35 to-white'
            : 'border-[var(--panel-border)] bg-gradient-to-br from-cosmic-900/80 via-cosmic-950/60 to-black/35'
        }`}
      >
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                day ? 'bg-health-100 text-health-800' : 'bg-cyan-500/15 text-cyan-200'
              }`}
            >
              <BarChart3 className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-theme md:text-base">Statistik kunjungan</h2>
            </div>
          </div>

          {statsErr ? (
            <p className="mt-4 text-sm text-merah-bright">Statistik tidak dapat dimuat. Coba muat ulang halaman.</p>
          ) : !stats ? (
            <p className="mt-4 text-sm text-theme-muted">Memuat angka…</p>
          ) : (
            <>
              <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: 'Hari ini', value: stats.today },
                  { label: 'Bulan ini', value: stats.this_month },
                  { label: '30 hari', value: stats.last_30_days },
                  { label: 'Total', value: stats.total },
                ].map((cell) => (
                  <li
                    key={cell.label}
                    className={`rounded-xl border px-3 py-2.5 transition-shadow duration-200 ${
                      day ? 'border-slate-200/90 bg-white/90 hover:shadow-sm hover:border-health-500/25' : 'border-white/10 bg-white/[0.04] hover:border-white/15'
                    }`}
                  >
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-theme-muted">{cell.label}</p>
                    <p className="mt-0.5 font-[family-name:var(--font-heading)] text-lg font-bold tabular-nums text-theme sm:text-xl">
                      {nf.format(cell.value)}
                    </p>
                  </li>
                ))}
              </ul>
              {stats.daily_last_7?.length ? <MiniWeekBars series={stats.daily_last_7} /> : null}
            </>
          )}
        </div>

        <div className="lg:border-l lg:border-[var(--panel-border)] lg:pl-8">
          <h2 className="text-sm font-semibold text-theme md:text-base">Terkait bencana</h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {DISASTER_RELATED_ORGS.map((org) => (
              <li key={org.href}>
                <a
                  href={org.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group flex min-h-[4.25rem] flex-col items-center justify-center gap-2 rounded-xl border px-2 py-3 text-center transition duration-200 focus-ring ${
                    day
                      ? 'border-slate-200/80 bg-white/85 hover:border-health-500/35 hover:shadow-md'
                      : 'border-white/10 bg-white/[0.04] hover:border-cyan-400/25 hover:bg-white/[0.07]'
                  }`}
                >
                  <span className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-black/5 dark:bg-white/95">
                    <PartnerBrandImage urls={org.logoUrls} shortLabel={org.short} />
                  </span>
                  <span className="flex items-center gap-0.5 text-[11px] font-semibold leading-tight text-theme">
                    <span className="line-clamp-2">{org.short}</span>
                    <ExternalLink
                      className="h-3 w-3 shrink-0 opacity-40 group-hover:opacity-70"
                      aria-hidden
                    />
                  </span>
                  <span className="sr-only">{org.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      <p
        className="mx-auto max-w-2xl px-2 text-center text-xs leading-relaxed"
        style={{ color: 'var(--footer-fg)' }}
      >
        {copyrightLine}
      </p>
    </div>
  )
}
