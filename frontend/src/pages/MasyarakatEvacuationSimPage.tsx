import { Route } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EvacuationRouteSimulator } from '@dr-diah/siaga-frontend-core'

/** Simulasi jalur evakuasi - ruang masyarakat (login), terpisah dari Video ML. Pengaturan titik hanya di Admin. */
export function MasyarakatEvacuationSimPage() {
  return (
    <div className="relative space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <Link to="/petugas" className="text-sm font-medium text-theme transition hover:underline focus-ring">
          ← Kembali ke ruang masyarakat
        </Link>
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 -top-4 h-72 max-w-6xl rounded-b-[3rem] bg-gradient-to-b from-sky-500/12 via-health-500/5 to-transparent blur-2xl md:left-1/2 md:-translate-x-1/2"
        aria-hidden
      />

      <div className="relative overflow-hidden rounded-3xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 shadow-xl md:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-gradient-to-br from-sky-400/25 to-cyan-500/15 blur-3xl dark:from-sky-500/30" />
        <div className="pointer-events-none absolute -bottom-12 left-6 h-36 w-36 rounded-full bg-health-600/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/35 to-cyan-600/35 text-sky-800 ring-1 ring-sky-500/25 dark:text-sky-100">
            <Route className="h-6 w-6" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-sky-800 dark:text-sky-200">
              Kesiapsiagaan · simulasi peta
            </p>
            <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold tracking-tight text-theme md:text-3xl">
              Jalur menuju titik evakuasi
            </h1>
            <p className="max-w-prose text-base leading-relaxed text-theme md:text-lg">
              Coba lokasi Anda (atau pakai lokasi perangkat) dan lihat <strong className="font-semibold text-theme">perkiraan</strong>{' '}
              rute di peta dari jalan umum - alat edukasi, bukan aplikasi pengumuman resmi. Titik dan pengaturan aktivasi dikelola
              admin.
            </p>
          </div>
        </div>
      </div>

      <EvacuationRouteSimulator isPlus />
    </div>
  )
}
