import { ArrowLeft, Code2, Home, LogOut } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import { fetchDeveloperEducation } from '../api/client'
import { EducationFeed } from '../components/EducationFeed'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'
import { useAuth } from '../context/AuthContext'
import type { EducationItem } from '../types'

export function DeveloperPage() {
  const { token, me, ready, logout } = useAuth()
  const [items, setItems] = useState<EducationItem[]>([])
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    let c = false
    void fetchDeveloperEducation()
      .then((d) => {
        if (!c) {
          setErr(null)
          setItems(d)
        }
      })
      .catch(() => {
        if (!c) setErr('Gagal memuat dokumentasi developer. Pastikan backend jalan dan Anda login sebagai developer atau admin.')
      })
    return () => {
      c = true
    }
  }, [token])

  if (!ready) {
    return (
      <div className="flex min-h-svh items-center justify-center text-theme-muted">Memuat…</div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace />
  }

  if (!me) {
    return (
      <div className="flex min-h-svh items-center justify-center text-theme-muted">Memuat sesi…</div>
    )
  }

  if (me.role !== 'developer' && me.role !== 'admin') {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-10">
      <a className="skip-to-content" href="#developer-main">
        Lewati ke isi
      </a>
      <main className="mx-auto flex max-w-3xl flex-col gap-8 outline-none" id="developer-main" tabIndex={-1}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.38, ease: easeOutExpo }}
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <Link
            to="/"
            className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-theme-muted transition duration-200 hover:text-theme focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Beranda
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {me.role === 'admin' ? (
              <Link
                to="/admin"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm font-medium text-emerald-800 transition duration-200 focus-ring hover:bg-emerald-500/10"
              >
                Admin
              </Link>
            ) : null}
            <Link
              to="/"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm text-theme-muted transition duration-200 focus-ring hover:text-theme"
            >
              <Home className="h-4 w-4" aria-hidden />
              Situs
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-800 transition duration-200 hover:bg-rose-50 focus-ring"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Keluar
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo, delay: 0.04 }}
          className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
        >
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-health-600">
            <Code2 className="h-4 w-4" aria-hidden />
            Ruang developer
          </p>
          <h1 className="mt-2 text-2xl font-bold text-theme md:text-3xl">Dokumentasi & uji fungsional</h1>
          <p className="mt-2 text-sm text-theme-muted">
            Isi di bawah disinkronkan dari basis data (materi edukasi dengan audiens Developer). Admin dapat
            menyuntingnya di panel Admin seperti item edukasi lain. Akun contoh:{' '}
            <span className="font-mono text-theme">sutra</span> / <span className="font-mono text-theme">sutra</span>{' '}
            (ubah lewat variabel lingkungan <span className="font-mono">DEFAULT_DEVELOPER_*</span>).
          </p>
        </motion.div>

        {err ? (
          <p className="text-sm text-rose-700">{err}</p>
        ) : (
          <EducationFeed
            items={items}
            emptyLabel="Belum ada dokumen developer. Jalankan backend agar seed mengisi handbook (seed_key developer_handbook)."
          />
        )}
      </main>
    </div>
  )
}
