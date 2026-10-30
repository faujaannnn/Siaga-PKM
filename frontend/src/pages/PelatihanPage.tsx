import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BookOpen,
  CalendarDays,
  Clock,
  GraduationCap,
  MapPin,
  Mic2,
  Users,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { fetchPublicPelatihanList } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import { easeOutExpo, imageMediaUrl } from '@dr-diah/siaga-frontend-core'
import type { PelatihanOut } from '../types'

type FilterTab = 'all' | 'upcoming' | 'past'

const ID_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
]

function parsePelatihanDate(tanggal: string): Date | null {
  const iso = tanggal.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  }
  const d = new Date(tanggal)
  return Number.isNaN(d.getTime()) ? null : d
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function pelatihanTiming(item: PelatihanOut): 'upcoming' | 'today' | 'past' {
  const d = parsePelatihanDate(item.tanggal)
  if (!d) return 'upcoming'
  const today = startOfDay(new Date())
  const eventDay = startOfDay(d)
  if (eventDay.getTime() === today.getTime()) return 'today'
  if (eventDay.getTime() < today.getTime()) return 'past'
  return 'upcoming'
}

function formatTimeRange(mulai: string, selesai: string): string {
  if (!mulai && !selesai) return ''
  if (mulai && selesai) return `${mulai} – ${selesai}`
  return mulai || selesai
}

function PelatihanDetailModal({
  item,
  day,
  onClose,
}: {
  item: PelatihanOut
  day: boolean
  onClose: () => void
}) {
  const timing = pelatihanTiming(item)
  const timeLabel = formatTimeRange(item.waktu_mulai, item.waktu_selesai)
  const full = item.kapasitas > 0 && item.peserta_count >= item.kapasitas
  const flyerSrc = item.flyer_url ? imageMediaUrl(item.flyer_url) : ''

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const statusLabel = timing === 'today' ? 'Hari ini' : timing === 'past' ? 'Selesai' : 'Akan datang'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pelatihan-detail-title"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.25, ease: easeOutExpo }}
        className={`flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border shadow-2xl ${
          day ? 'border-slate-200/90 bg-white' : 'border-white/12 bg-[var(--panel-bg)]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`flex shrink-0 items-start justify-between gap-3 border-b px-5 py-4 ${
            day ? 'border-slate-200/80 bg-white' : 'border-white/10 bg-[var(--panel-bg)]'
          }`}
        >
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-muted">{statusLabel}</p>
            <h2
              id="pelatihan-detail-title"
              className="font-[family-name:var(--font-heading)] text-lg font-bold leading-snug text-theme sm:text-xl"
            >
              {item.judul}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`shrink-0 rounded-xl p-2 transition-colors focus-ring ${
              day ? 'text-slate-500 hover:bg-slate-100' : 'text-theme-muted hover:bg-white/10'
            }`}
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {flyerSrc ? (
            <div className={`border-b ${day ? 'border-slate-200/80 bg-slate-50' : 'border-white/10 bg-black/20'}`}>
              <img
                src={flyerSrc}
                alt={`Poster ${item.judul}`}
                className="mx-auto block max-h-[min(70vh,640px)] w-full object-contain"
              />
            </div>
          ) : null}

          <div className="space-y-4 p-5 sm:p-6">
            {item.deskripsi ? (
              <div>
                <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-theme-muted">Deskripsi</h3>
                <p className="text-sm leading-relaxed text-theme whitespace-pre-wrap">{item.deskripsi}</p>
              </div>
            ) : null}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-theme-muted">Informasi</h3>
              <ul className="space-y-2.5 text-sm text-theme">
                {item.tanggal ? (
                  <li className="flex items-start gap-2.5">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                    <span>{item.tanggal}</span>
                  </li>
                ) : null}
                {timeLabel ? (
                  <li className="flex items-start gap-2.5">
                    <Clock className="mt-0.5 h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                    <span>{timeLabel}</span>
                  </li>
                ) : null}
                {item.lokasi ? (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                    <span>{item.lokasi}</span>
                  </li>
                ) : null}
                {item.narasumber ? (
                  <li className="flex items-start gap-2.5">
                    <Mic2 className="mt-0.5 h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                    <span>{item.narasumber}</span>
                  </li>
                ) : null}
                {item.kapasitas > 0 ? (
                  <li className="flex items-start gap-2.5">
                    <Users className="mt-0.5 h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                    <span>
                      {item.peserta_count}/{item.kapasitas} peserta
                      {full ? ' · Penuh' : ''}
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

function PelatihanScheduleCard({
  item,
  index,
  day,
  onOpenDetail,
}: {
  item: PelatihanOut
  index: number
  day: boolean
  onOpenDetail: () => void
}) {
  const timing = pelatihanTiming(item)
  const dateObj = parsePelatihanDate(item.tanggal)
  const dayNum = dateObj ? String(dateObj.getDate()).padStart(2, '0') : '-'
  const monthLabel = dateObj ? ID_MONTHS[dateObj.getMonth()] : ''
  const yearLabel = dateObj ? String(dateObj.getFullYear()) : ''
  const timeLabel = formatTimeRange(item.waktu_mulai, item.waktu_selesai)
  const full = item.kapasitas > 0 && item.peserta_count >= item.kapasitas

  const statusStyles =
    timing === 'today'
      ? day
        ? 'bg-emerald-100 text-emerald-800 ring-emerald-500/25'
        : 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30'
      : timing === 'past'
        ? day
          ? 'bg-slate-100 text-slate-600 ring-slate-300/40'
          : 'bg-white/10 text-theme-soft ring-white/10'
        : day
          ? 'bg-health-100 text-health-800 ring-health-500/25'
          : 'bg-cyan-500/15 text-cyan-100 ring-cyan-400/25'

  const statusLabel = timing === 'today' ? 'Hari ini' : timing === 'past' ? 'Selesai' : 'Akan datang'

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, delay: index * 0.06, ease: easeOutExpo }}
      className={`group relative overflow-hidden rounded-2xl border transition-colors duration-200 ${
        day
          ? 'border-slate-200/90 bg-white/90 shadow-sm hover:border-health-500/35 hover:shadow-md hover:shadow-health-500/10'
          : 'border-white/12 bg-[var(--panel-bg)] hover:border-cyan-400/30 hover:shadow-lg hover:shadow-cyan-500/5'
      }`}
    >
      {/* Flyer image */}
      {item.flyer_url && (
        <div className="relative w-full aspect-video overflow-hidden flex-shrink-0">
          <img
            src={imageMediaUrl(item.flyer_url)}
            alt={`Flyer ${item.judul}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}

      <div
        className={`absolute inset-y-0 left-0 w-1 ${
          timing === 'today'
            ? 'bg-gradient-to-b from-emerald-400 to-emerald-600'
            : timing === 'past'
              ? 'bg-gradient-to-b from-slate-300 to-slate-400'
              : 'bg-gradient-to-b from-merah to-merah-bright'
        }`}
        aria-hidden
      />

      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:gap-5 md:p-6">
        <div
          className={`flex shrink-0 flex-row items-center gap-3 sm:w-[88px] sm:flex-col sm:items-center sm:gap-0 sm:rounded-xl sm:px-3 sm:py-4 ${
            day ? 'sm:bg-slate-50 sm:ring-1 sm:ring-slate-200/80' : 'sm:bg-black/25 sm:ring-1 sm:ring-white/10'
          }`}
        >
          <span
            className={`font-[family-name:var(--font-heading)] text-3xl font-bold leading-none sm:text-4xl ${
              timing === 'past' ? 'text-theme-soft' : 'text-theme'
            }`}
          >
            {dayNum}
          </span>
          <div className="sm:mt-1 sm:text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">{monthLabel}</p>
            <p className="text-[11px] text-theme-soft">{yearLabel}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="font-[family-name:var(--font-heading)] text-lg font-semibold leading-snug text-theme sm:text-xl">
              {item.judul}
            </h2>
            <span
              className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ${statusStyles}`}
            >
              {statusLabel}
            </span>
          </div>

          {item.deskripsi ? (
            <p className="text-sm leading-relaxed text-theme-muted line-clamp-3">{item.deskripsi}</p>
          ) : null}

          <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-theme-muted">
            {item.tanggal ? (
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                <span>{item.tanggal}</span>
              </li>
            ) : null}
            {timeLabel ? (
              <li className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                <span>{timeLabel}</span>
              </li>
            ) : null}
            {item.lokasi ? (
              <li className="inline-flex items-center gap-1.5">
                <MapPin className="h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                <span>{item.lokasi}</span>
              </li>
            ) : null}
            {item.narasumber ? (
              <li className="inline-flex items-center gap-1.5">
                <Mic2 className="h-4 w-4 shrink-0 text-health-600 dark:text-cyan-400" aria-hidden />
                <span>{item.narasumber}</span>
              </li>
            ) : null}
          </ul>

          {item.kapasitas > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ${
                  full
                    ? day
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200/80'
                      : 'bg-amber-500/15 text-amber-100 ring-1 ring-amber-400/25'
                    : day
                      ? 'bg-health-50 text-health-800 ring-1 ring-health-200/80'
                      : 'bg-cyan-500/10 text-cyan-100 ring-1 ring-cyan-400/20'
                }`}
              >
                <Users className="h-3.5 w-3.5" aria-hidden />
                {item.peserta_count}/{item.kapasitas} peserta
                {full ? ' · Penuh' : ''}
              </span>
            </div>
          ) : null}

          <div className="pt-1">
            <button
              type="button"
              onClick={onOpenDetail}
              className={`cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition-colors duration-200 focus-ring ${
                day
                  ? 'border border-health-500/30 bg-health-50 text-health-700 hover:border-health-500/50 hover:bg-health-100'
                  : 'border border-cyan-400/25 bg-cyan-500/10 text-cyan-100 hover:border-cyan-400/40 hover:bg-cyan-500/15'
              }`}
            >
              Lihat detail
            </button>
          </div>
        </div>
      </div>
    </motion.article>
  )
}

export function PelatihanPage() {
  const { theme } = useTheme()
  const day = theme === 'day'
  const [items, setItems] = useState<PelatihanOut[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterTab>('upcoming')
  const [detailItem, setDetailItem] = useState<PelatihanOut | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPublicPelatihanList()
      .then((data) => {
        if (!cancelled) setItems(data)
      })
      .catch(() => {
        if (!cancelled) setErr('Gagal memuat jadwal pelatihan.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const list = items.filter((item) => {
      const t = pelatihanTiming(item)
      if (filter === 'all') return true
      if (filter === 'upcoming') return t === 'upcoming' || t === 'today'
      return t === 'past'
    })
    return list.sort((a, b) => {
      const da = parsePelatihanDate(a.tanggal)?.getTime() ?? 0
      const db = parsePelatihanDate(b.tanggal)?.getTime() ?? 0
      return filter === 'past' ? db - da : da - db
    })
  }, [items, filter])

  const counts = useMemo(() => {
    let upcoming = 0
    let past = 0
    for (const item of items) {
      const t = pelatihanTiming(item)
      if (t === 'past') past += 1
      else upcoming += 1
    }
    return { all: items.length, upcoming, past }
  }, [items])

  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'upcoming', label: 'Akan datang', count: counts.upcoming },
    { id: 'all', label: 'Semua', count: counts.all },
    { id: 'past', label: 'Riwayat', count: counts.past },
  ]

  return (
    <div className="space-y-8">
      <p>
        <Link
          to="/"
          className={`cursor-pointer text-sm font-medium transition duration-200 hover:underline focus-ring ${
            day ? 'text-health-600 hover:text-health-700' : 'text-cyan-300 hover:text-cyan-200'
          }`}
        >
          ← Beranda
        </Link>
      </p>

      <motion.header
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOutExpo }}
        className="glass-panel relative overflow-hidden border border-[var(--panel-border)] p-6 md:p-8"
      >
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gradient-to-br from-merah/15 to-health-500/10 blur-2xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-merah/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-merah dark:bg-merah/20 dark:text-merah-bright">
              <GraduationCap className="h-3.5 w-3.5" aria-hidden />
              Edukasi petugas
            </div>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-theme md:text-3xl">
              Jadwal Pelatihan
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-theme-muted">
              Informasi kegiatan pelatihan kesiapsiagaan bencana untuk petugas puskesmas. Hubungi admin atau
              kepala puskesmas untuk pendaftaran dan absensi.
            </p>
          </div>
          <div
            className={`flex shrink-0 items-center gap-3 rounded-2xl px-4 py-3 ${
              day ? 'bg-health-50 ring-1 ring-health-200/70' : 'bg-cyan-500/10 ring-1 ring-cyan-400/20'
            }`}
          >
            <BookOpen className={`h-8 w-8 ${day ? 'text-health-600' : 'text-cyan-300'}`} aria-hidden />
            <div>
              <p className="text-2xl font-bold tabular-nums text-theme">{counts.upcoming}</p>
              <p className="text-xs text-theme-muted">kegiatan mendatang</p>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter jadwal">
        {tabs.map((tab) => {
          const active = filter === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(tab.id)}
              className={`cursor-pointer rounded-xl px-4 py-2.5 text-sm font-medium transition-colors duration-200 focus-ring ${
                active
                  ? day
                    ? 'bg-gradient-to-r from-merah to-merah-bright text-white shadow-md shadow-merah/20'
                    : 'bg-gradient-to-r from-merah to-merah-bright text-white shadow-md shadow-merah/25'
                  : day
                    ? 'border border-slate-200/90 bg-white/80 text-theme-muted hover:border-health-500/30 hover:text-theme'
                    : 'border border-white/12 bg-[var(--panel-bg)] text-theme-muted hover:border-cyan-400/30 hover:text-theme'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 tabular-nums ${active ? 'opacity-90' : 'opacity-60'}`}>({tab.count})</span>
            </button>
          )
        })}
      </div>

      {err ? <p className={`text-sm ${day ? 'text-merah' : 'text-merah-bright'}`}>{err}</p> : null}

      {loading ? (
        <div className="flex min-h-[35vh] flex-col items-center justify-center gap-4" aria-busy="true">
          <div className="mp-loader-wrap">
            <div className="mp-loader-ring h-16 w-16">
              <div className="mp-loader-inner" />
            </div>
          </div>
          <p className="text-sm text-theme-muted">Memuat jadwal…</p>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel border border-[var(--panel-border)] px-6 py-14 text-center"
        >
          <CalendarDays className="mx-auto h-12 w-12 text-theme-soft opacity-60" aria-hidden />
          <p className="mt-4 font-medium text-theme">
            {filter === 'past' ? 'Belum ada riwayat pelatihan.' : 'Belum ada jadwal pelatihan yang diumumkan.'}
          </p>
          <p className="mt-2 text-sm text-theme-muted">
            Silakan cek kembali nanti atau hubungi admin puskesmas.
          </p>
        </motion.div>
      ) : (
        <div className="grid gap-4 md:gap-5">
          {filtered.map((item, index) => (
            <PelatihanScheduleCard
              key={item.id}
              item={item}
              index={index}
              day={day}
              onOpenDetail={() => setDetailItem(item)}
            />
          ))}
        </div>
      )}

      {detailItem ? (
        <PelatihanDetailModal item={detailItem} day={day} onClose={() => setDetailItem(null)} />
      ) : null}
    </div>
  )
}
