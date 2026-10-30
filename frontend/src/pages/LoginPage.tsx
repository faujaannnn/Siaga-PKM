import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { fetchAuthMe } from '../api/client'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'
import { useAuth } from '../context/AuthContext'

const inputClass =
  'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-theme placeholder:text-slate-400 transition duration-200 focus:border-health-500/50 focus:outline-none focus:ring-[3px] focus:ring-cyan-500/30'

export function LoginPage() {
  const { login, token, me, ready } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function staffHome(meRole: string, needsSetup?: boolean) {
    if (meRole === 'admin') return '/monitor'
    if (meRole === 'developer') return '/developer'
    if (meRole === 'kepala_puskesmas') return '/kapus'
    if (needsSetup) return '/petugas/atur-profil'
    return '/petugas'
  }

  useEffect(() => {
    if (ready && token && me) {
      navigate(staffHome(me.role, me.needs_profile_setup), { replace: true })
    }
  }, [ready, token, me, navigate])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      await login(username.trim(), password.trim())
      const m = await fetchAuthMe()
      navigate(staffHome(m.role, m.needs_profile_setup), { replace: true })
    } catch {
      setErr('Username atau password salah.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-10">
      <a className="skip-to-content" href="#login-main">
        Lewati ke isi
      </a>
      <div className="mx-auto max-w-6xl pb-4">
        <Link
          to="/"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1 text-sm text-theme-muted transition duration-200 hover:text-theme focus-ring"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Kembali ke beranda
        </Link>
      </div>
      <main className="mx-auto max-w-md outline-none" id="login-main" tabIndex={-1}>
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo }}
          className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
        >
          <div className="flex flex-col items-center text-center">
            <img
              src="/images/puskesmas-logo.png"
              alt="Logo Puskesmas"
              className="h-24 w-24 object-contain"
            />
            <h1 className="mt-4 text-lg font-bold leading-snug tracking-tight text-theme sm:text-xl">
              Sistem Aplikasi
              <br />
              Kesiapsiagaan Bencana
              <br />
              Puskesmas (SiAP PKM)
            </h1>
          </div>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <label htmlFor="user" className="block text-sm font-medium text-theme-muted">
                Username
              </label>
              <input
                id="user"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={inputClass}
                placeholder="Masukkan username"
                required
              />
            </div>
            <div>
              <label htmlFor="pass" className="block text-sm font-medium text-theme-muted">
                Password
              </label>
              <input
                id="pass"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                required
              />
            </div>
            {err ? <p className="text-sm text-rose-700">{err}</p> : null}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright py-3.5 text-sm font-semibold text-white shadow-lg shadow-merah/20 transition duration-200 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
            >
              {loading ? 'Memproses…' : 'Masuk'}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  )
}
