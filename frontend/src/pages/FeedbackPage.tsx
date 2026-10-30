import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CheckCircle } from 'lucide-react'

import { postPublicSubmission } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import { easeOutExpo } from '@dr-diah/siaga-frontend-core'

export function FeedbackPage() {
  const { theme } = useTheme()
  const day = theme === 'day'
  const fieldBase =
    'w-full rounded-lg border px-3 py-2.5 text-sm text-theme transition duration-200 focus:outline-none focus:ring-[3px] ' +
    (day
      ? 'border-slate-200 bg-white focus:border-health-500/50 focus:ring-cyan-500/25'
      : 'border-white/15 bg-black/30 focus:border-cyan-400/40 focus:ring-cyan-400/22')

  const TELEPON_REGEX = /^(\+62|62|0)\d{8,12}$/

  const [jenis, setJenis] = useState<'saran' | 'aduan' | ''>('')
  const [tanggal, setTanggal] = useState('')
  const [nama, setNama] = useState('')
  const [telepon, setTelepon] = useState('')
  const [teleponError, setTeleponError] = useState<string | null>(null)
  const [teleponWarning, setTeleponWarning] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [pesan, setPesan] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)

  useEffect(() => {
    setTanggal(new Date().toISOString().split('T')[0])
  }, [])

  function resetForm() {
    setJenis('')
    setTanggal(new Date().toISOString().split('T')[0])
    setNama('')
    setTelepon('')
    setTeleponError(null)
    setTeleponWarning(null)
    setEmail('')
    setPesan('')
    setMsg(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (jenis !== 'saran' && jenis !== 'aduan') {
      setErr('Pilih jenis saran atau aduan.')
      return
    }
    setSending(true)
    try {
      await postPublicSubmission({
        form_type: 'saran_aduan',
        jenis_masukkan: jenis,
        tanggal_kejadian: tanggal,
        nama,
        telepon,
        email,
        pesan,
      })
      setMsg('Masukan Anda sudah terkirim. Terima kasih atas masukannya.')
      setShowSuccessModal(true)
      setTimeout(() => setShowSuccessModal(false), 8000)
    } catch {
      setErr('Gagal mengirim. Periksa isian atau coba lagi.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setShowSuccessModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-md overflow-hidden rounded-3xl border border-emerald-400/40 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex flex-col items-center px-8 pt-10 pb-6 text-center">
                <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 shadow-lg">
                  <CheckCircle className="h-12 w-12" />
                </div>
                <h2 className="text-2xl font-bold">Masukan Terkirim!</h2>
                <p className="mt-2 text-sm text-white/80">
                  Terima kasih. Pihak terkait dapat menindaklanjutinya.
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 px-8 pb-8">
                <button
                  onClick={() => {
                    setShowSuccessModal(false)
                    resetForm()
                  }}
                  className="flex-1 rounded-xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                >
                  Kirim Masukan Lain
                </button>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <p>
        <Link to="/" className="text-sm font-medium text-merah-bright hover:underline focus-ring">
          ← Beranda
        </Link>
      </p>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: easeOutExpo }}
        className="glass-panel border border-[var(--panel-border)] p-6 md:p-8"
      >
        <h1 className="text-2xl font-bold text-theme">Saran & Aduan</h1>
        {msg ? (
          <p className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-theme">
            {msg}
          </p>
        ) : null}
        {err ? <p className="mt-4 text-sm text-merah-bright">{err}</p> : null}
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-theme-muted">Jenis *</label>
              <select
                className={`mt-1 ${fieldBase}`}
                value={jenis}
                onChange={(e) => setJenis(e.target.value as 'saran' | 'aduan' | '')}
                required
              >
                <option value="">- Pilih -</option>
                <option value="saran">Saran</option>
                <option value="aduan">Aduan</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-theme-muted">Tanggal kejadian / tanggal masukan</label>
              <input
                type="date"
                className={`mt-1 ${fieldBase}`}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-theme-muted">Nama *</label>
              <input className={`mt-1 ${fieldBase}`} value={nama} onChange={(e) => setNama(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs text-theme-muted">Telepon</label>
              <input
                type="tel"
                className={`mt-1 ${fieldBase}`}
                value={telepon}
                onChange={(e) => {
                  let val = e.target.value.replace(/\s/g, '')
                  // Auto-konversi: 08xxx → +628xxx
                  if (val.startsWith('0') && val.length >= 1) {
                    val = '+62' + val.slice(1)
                  }
                  setTelepon(val)
                  setTeleponError(null)
                  setTeleponWarning(null)
                  if (val && !TELEPON_REGEX.test(val)) {
                    setTeleponError('Format nomor tidak valid. Gunakan format +62xxx (8-12 digit).')
                  }
                }}
              />
              {teleponError ? (
                <p className="mt-1 text-xs text-merah-bright">{teleponError}</p>
              ) : teleponWarning ? (
                <p className="mt-1 text-xs text-amber-400">{teleponWarning}</p>
              ) : null}
            </div>
          </div>
          <div>
            <label className="text-xs text-theme-muted">Email</label>
            <input
              type="email"
              className={`mt-1 ${fieldBase}`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-theme-muted">Saran atau aduan *</label>
            <textarea
              className={`mt-1 ${fieldBase}`}
              rows={5}
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-gradient-to-r from-merah to-merah-bright py-3 text-sm font-semibold text-white disabled:opacity-50 focus-ring"
          >
            {sending ? 'Mengirim…' : 'Kirim'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
