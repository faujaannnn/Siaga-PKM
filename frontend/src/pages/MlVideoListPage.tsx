import { Brain } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { MlVideoCard } from '../components/MlVideoCard'
import { fetchPublicMlBelajarTopics, fetchPublicMlVideos } from '../api/client'
import type { MlBelajarTopicItem, MlVideoPublic } from '../types'

const REMOVED_TOPIK = new Set(['banjir', 'gempa_bumi', 'tanah_longsor'])

function chipClass(active: boolean, featured?: boolean) {
  if (featured && active) {
    return 'cursor-pointer rounded-full bg-gradient-to-r from-health-600 to-merah-bright px-3 py-1.5 text-xs font-medium text-white shadow-md shadow-merah/25 ring-1 ring-white/15'
  }
  return `cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium transition duration-200 focus-ring ${
    active
      ? 'bg-merah text-white shadow-sm'
      : 'border border-slate-200 bg-white text-theme-muted hover:border-health-500/40'
  }`
}

export function MlVideoListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const rawTopik = searchParams.get('topik')?.trim() || null
  const topikParam = rawTopik && REMOVED_TOPIK.has(rawTopik) ? null : rawTopik

  const [topics, setTopics] = useState<MlBelajarTopicItem[]>([])
  const [items, setItems] = useState<MlVideoPublic[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadTopics = useCallback(async () => {
    const d = await fetchPublicMlBelajarTopics()
    setTopics(d.topics.filter((t) => !REMOVED_TOPIK.has(t.slug)))
  }, [])

  useEffect(() => {
    void loadTopics().catch(() => setTopics([]))
  }, [loadTopics])

  useEffect(() => {
    if (rawTopik && REMOVED_TOPIK.has(rawTopik)) {
      searchParams.delete('topik')
      setSearchParams(searchParams, { replace: true })
    }
  }, [rawTopik, searchParams, setSearchParams])

  const queryKey = topikParam ?? ''

  useEffect(() => {
    let c = false
    setLoading(true)
    setErr(null)
    fetchPublicMlVideos({
      category: 'belajar_plus',
      topik: topikParam || null,
    })
      .then((d) => {
        if (!c) setItems(d)
      })
      .catch(() => {
        if (!c) setErr('Gagal memuat daftar video.')
      })
      .finally(() => {
        if (!c) setLoading(false)
      })
    return () => {
      c = true
    }
  }, [queryKey, topikParam])

  const topicLabelBySlug = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of topics) m.set(t.slug, t.label)
    return m
  }, [topics])

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => a.sort_order - b.sort_order)
  }, [items])

  const filterChips: { param: string | null; label: string; featured?: boolean }[] = [
    { param: null, label: 'Semua', featured: true },
    ...topics.map((t) => ({ param: t.slug, label: t.label, featured: true })),
  ]

  return (
    <div className="relative space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/petugas" className="text-sm font-medium text-theme transition hover:underline focus-ring">
          ← Kembali ke ruang masyarakat
        </Link>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 -top-4 h-72 max-w-6xl rounded-b-[3rem] bg-gradient-to-b from-cyan-500/12 via-health-500/5 to-transparent blur-2xl md:left-1/2 md:-translate-x-1/2"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-xl md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-gradient-to-br from-cyan-500/25 to-merah/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-8 h-40 w-40 rounded-full bg-health-600/15 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-health-500/35 to-merah/40 text-merah-bright ring-1 ring-cyan-500/20">
            <Brain className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-health-800">Belajar++ · video &amp; asesmen</p>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-theme md:text-3xl">
              Belajar lewat video, uji pemahaman saat siap
            </h1>
            <p className="text-base leading-relaxed text-theme md:text-lg">
              Silakan tonton modul pilihan Anda. Jika merasa cukup memahami isinya, lanjut ke{' '}
              <strong className="font-semibold text-theme">asesmen pengetahuan</strong> guna menilai seberapa layak poin
              pembelajaran Anda diterapkan. Sistem mencatat durasi tonton, menyesuaikan tanya-jawab, lalu menyusun ringkasan
              pemahaman.
            </p>
          </div>
        </div>
      </div>

      {topics.length > 0 ? (
        <div className="sticky top-16 z-20 -mx-1 space-y-2 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/95 p-3 shadow-sm backdrop-blur-md md:static md:mx-0 md:rounded-3xl md:p-4 md:shadow-none">
          <p className="px-0.5 text-sm font-semibold text-theme">Topik (Belajar++)</p>
          <p className="text-xs font-medium text-theme-muted md:sr-only">Pilih topik</p>
          <div className="md:hidden">
            <label htmlFor="ml-topik" className="sr-only">
              Pilih topik modul
            </label>
            <select
              id="ml-topik"
              className="focus-ring w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-sm font-medium text-theme"
              value={topikParam ?? ''}
              onChange={(e) => {
                const v = e.target.value
                if (v === '') {
                  searchParams.delete('topik')
                  setSearchParams(searchParams, { replace: true })
                } else {
                  setSearchParams({ topik: v }, { replace: true })
                }
              }}
            >
              {filterChips.map((c) => (
                <option key={c.label} value={c.param ?? ''}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div className="hidden min-h-12 flex-wrap gap-2 md:flex">
            {filterChips.map((chip) => {
              const isActive = chip.param === null ? !topikParam : topikParam === chip.param
              return (
                <button
                  key={chip.label}
                  type="button"
                  className={chipClass(isActive, chip.featured)}
                  onClick={() => {
                    if (chip.param === null) {
                      searchParams.delete('topik')
                      setSearchParams(searchParams, { replace: true })
                    } else {
                      setSearchParams({ topik: chip.param! }, { replace: true })
                    }
                  }}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {err ? <p className="text-sm text-rose-700">{err}</p> : null}

      {loading ? (
        <p className="text-sm text-theme-muted">Memuat modul…</p>
      ) : (
        <ul className="relative grid gap-5 sm:grid-cols-2">
          {sortedItems.map((v, i) => (
            <MlVideoCard
              key={v.id}
              item={v}
              index={i}
              topicLabel={
                v.belajar_topic
                  ? topicLabelBySlug.get(v.belajar_topic) || v.belajar_topic.replace(/_/g, ' ')
                  : undefined
              }
            />
          ))}
        </ul>
      )}

      {!err && !loading && sortedItems.length === 0 ? (
        <p className="text-sm text-theme-muted">
          Belum ada modul Belajar++ yang dipublikasikan. Atur video di Admin (Video).
        </p>
      ) : null}
    </div>
  )
}
