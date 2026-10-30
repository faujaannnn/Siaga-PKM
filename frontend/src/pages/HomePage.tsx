import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

import { fetchPublicHomepage } from '../api/client'
import { DefaultHomeWelcome } from '../components/DefaultHomeWelcome'
import { HomepageRenderer } from '../components/HomepageRenderer'
import { BmkgWeatherTab, easeOutExpo } from '@dr-diah/siaga-frontend-core'
import type { HomepageSection } from '../types'

export function HomePage() {
  const [sections, setSections] = useState<HomepageSection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchPublicHomepage()
      .then((data) => {
        if (!cancelled) setSections(data.sections ?? [])
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            'Maaf, halaman utama tidak bisa dimuat saat ini. Pastikan koneksi internet stabil dan coba refresh beberapa saat lagi.',
          )
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4" aria-busy="true" aria-label="Memuat">
        <div className="mp-loader-wrap">
          <div className="mp-loader-ring h-20 w-20">
            <div className="mp-loader-inner" />
          </div>
        </div>
        <p className="text-sm text-theme-muted">Memuat beranda…</p>
      </div>
    )
  }

  return (
    <div className="space-y-10 md:space-y-12">
      <BmkgWeatherTab />
      {error ? (
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: easeOutExpo }}
          className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-theme"
          role="alert"
        >
          {error}
        </motion.p>
      ) : null}
      {!error ? (
        <>
          {sections.length > 0 ? (
            <HomepageRenderer sections={sections} />
          ) : (
            <DefaultHomeWelcome />
          )}
        </>
      ) : null}
    </div>
  )
}
