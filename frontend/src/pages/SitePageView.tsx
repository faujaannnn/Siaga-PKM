import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'

import { fetchPublicPage } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'
import type { SitePagePublic } from '../types'

export function SitePageView() {
  const { theme } = useTheme()
  const day = theme === 'day'
  const { slug = '' } = useParams<{ slug: string }>()
  const [page, setPage] = useState<SitePagePublic | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    let c = false
    setErr(null)
    fetchPublicPage(slug)
      .then((d) => {
        if (!c) setPage(d)
      })
      .catch(() => {
        if (!c) {
          setPage(null)
          setErr('Halaman tidak ditemukan atau belum dipublikasikan.')
        }
      })
    return () => {
      c = true
    }
  }, [slug])

  return (
    <div className="space-y-6">
      <p>
        <Link
          to="/profil"
          className={`cursor-pointer text-sm font-medium transition duration-200 hover:underline focus-ring ${
            day ? 'text-health-600 hover:text-health-700' : 'text-cyan-300 hover:text-cyan-200'
          }`}
        >
          ← Kembali ke daftar profil
        </Link>
      </p>
      {err ? (
        <p className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-theme">{err}</p>
      ) : null}
      {page ? (
        <motion.article
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeOutExpo }}
          className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
        >
          <h1 className="text-2xl font-bold text-theme md:text-3xl">{page.title}</h1>
          <div className="prose prose-sm mt-6 max-w-none whitespace-pre-wrap text-theme-muted dark:prose-invert">
            {page.body}
          </div>
        </motion.article>
      ) : !err ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="loader-ring" aria-busy />
        </div>
      ) : null}
    </div>
  )
}
