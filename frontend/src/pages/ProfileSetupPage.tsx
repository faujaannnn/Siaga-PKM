import { ArrowLeft, UserRound } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { setupStaffProfile } from '../api/client'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-theme placeholder:text-slate-400 transition duration-200 focus:border-health-500/50 focus:outline-none focus:ring-[3px] focus:ring-cyan-500/30'

export function ProfileSetupPage() {
  const { token, me, ready, refreshMe } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (ready && (!token || !me)) return
    if (ready && me && me.role !== 'staff') {
      navigate('/petugas', { replace: true })
    }
    if (ready && me && !me.needs_profile_setup) {
      navigate('/petugas', { replace: true })
    }
  }, [ready, token, me, navigate])

  if (!ready) return null
  if (!token || !me) return <Navigate to="/login" replace />
  if (me.role !== 'staff') return <Navigate to="/petugas" replace />
  if (!me.needs_profile_setup) return <Navigate to="/petugas" replace />

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    const trimmed = name.trim()
    if (trimmed.length < 2) {
      setErr('Nama minimal 2 karakter.')
      return
    }
    setLoading(true)
    try {
      await setupStaffProfile(trimmed)
      await refreshMe()
      navigate('/petugas', { replace: true })
    } catch {
      setErr('Gagal menyimpan nama. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-10">
      <div className="mx-auto max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
          className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
        >
          <div className="mb-1 inline-flex items-center gap-2 text-merah-bright">
            <UserRound className="h-8 w-8" aria-hidden />
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-theme">Atur nama Anda</h1>
          <p className="mt-3 text-sm leading-relaxed text-theme-muted">
            Login pertama kali. Isi nama yang ingin dipakai di aplikasi dan asisten AI. Username login Anda tetap{' '}
            <strong className="text-theme">{me.username}</strong> dan tidak dapat diubah.
          </p>
          {me.research_wilayah ? (
            <p className="mt-2 text-sm text-theme-muted">
              Wilayah sampel: <span className="font-medium text-theme">{me.research_wilayah}</span>
            </p>
          ) : null}
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-sm font-medium text-theme-muted">
                Nama lengkap / panggilan
              </label>
              <input
                id="display-name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="Contoh: Budi Santoso"
                required
                minLength={2}
                maxLength={120}
              />
            </div>
            {err ? <p className="text-sm text-rose-700">{err}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright py-3.5 text-sm font-semibold text-white shadow-lg shadow-merah/20 transition duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
            >
              {loading ? 'Menyimpan…' : 'Simpan dan lanjut'}
            </button>
          </form>
          <p className="mt-4 text-center text-xs text-theme-muted">
            <Link to="/login" className="inline-flex items-center gap-1 hover:text-theme focus-ring">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Keluar
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
