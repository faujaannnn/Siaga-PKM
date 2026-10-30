import { Brain, FileText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { fetchPublicMlPdfs } from '../api/client'
import type { MlPdfPublic } from '../types'

export function MlPdfListPage() {
  const [items, setItems] = useState<MlPdfPublic[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let c = false
    setLoading(true)
    setErr(null)
    fetchPublicMlPdfs({ category: 'belajar_plus' })
      .then((d) => {
        if (!c) setItems(d)
      })
      .catch(() => {
        if (!c) setErr('Gagal memuat daftar buku.')
      })
      .finally(() => {
        if (!c) setLoading(false)
      })
    return () => {
      c = true
    }
  }, [])

  const sortedItems = useMemo(() => [...items].sort((a, b) => a.sort_order - b.sort_order), [items])

  return (
    <div className="relative space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/petugas" className="text-sm font-medium text-theme transition hover:underline focus-ring">
          ← Kembali ke ruang masyarakat
        </Link>
      </div>
      <div className="pointer-events-none absolute inset-x-0 -top-4 h-72 max-w-6xl rounded-b-[3rem] bg-gradient-to-b from-sky-500/10 via-health-500/5 to-transparent blur-2xl md:left-1/2 md:-translate-x-1/2" aria-hidden />

      <div className="relative overflow-hidden rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-xl md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-sky-400/20 to-merah/20 blur-3xl dark:from-sky-500/25 dark:to-merah/25" />
        <div className="pointer-events-none absolute -bottom-12 left-6 h-36 w-36 rounded-full bg-health-600/12 blur-3xl dark:bg-health-500/18" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/35 to-merah/40 text-merah-bright ring-1 ring-sky-500/20">
            <FileText className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-health-800 dark:text-health-300">
              Belajar++ · Buku &amp; asesmen
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-theme md:text-3xl">
              Baca modul buku, ujian pilihan ganda per bab - tampil di situs kami
            </h1>
          </div>
        </div>
      </div>

      {err ? <p className="text-sm text-rose-700">{err}</p> : null}
      {loading ? <p className="text-sm text-theme-muted">Memuat…</p> : null}

      {!loading && sortedItems.length === 0 ? (
        <p className="text-sm text-theme-muted">Belum ada modul buku.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedItems.map((p) => (
            <li key={p.id}>
              <Link
                to={`/petugas/pdf-ml/${encodeURIComponent(p.id)}`}
                className="flex h-full flex-col rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-5 shadow-md transition hover:border-health-500/35 hover:shadow-lg focus-ring"
              >
                <div className="mb-3 flex items-center gap-2 text-merah-bright">
                  <Brain className="h-4 w-4" aria-hidden />
                  <span className="text-xs font-semibold uppercase tracking-wide">Buku</span>
                </div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-theme">{p.title}</h2>
                {p.description ? <p className="mt-2 line-clamp-3 text-sm text-theme-muted">{p.description}</p> : null}
                <p className="mt-3 text-xs text-theme-muted">{p.chapters.length} bab</p>
                <span className="mt-4 text-sm font-semibold text-merah-bright">Buka modul →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
