import { useRef, useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Camera, CheckCircle, X } from 'lucide-react'

import { postPublicSubmission, uploadAdminFile } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import {
  easeOutExpo,
  JENIS_BENCANA_EOC_LABELS,
  parseCoordString,
  ReportLocationPicker,
} from '@dr-diah/siaga-frontend-core'

export function ReportDisasterPage() {
  const { theme } = useTheme()
  const day = theme === 'day'
  const fieldBase =
    'w-full rounded-lg border px-3 py-2.5 text-sm text-theme transition duration-200 focus:outline-none focus:ring-[3px] ' +
    (day
      ? 'border-slate-200 bg-white focus:border-health-500/50 focus:ring-cyan-500/25'
      : 'border-white/15 bg-black/30 focus:border-cyan-400/40 focus:ring-cyan-400/22')
  const [jenis, setJenis] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [waktu, setWaktu] = useState('')
  const [lokasi, setLokasi] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [pesan, setPesan] = useState('')
  const [nama, setNama] = useState('')
  const [telepon, setTelepon] = useState('')
  const [teleponError, setTeleponError] = useState<string | null>(null)
  const [teleponWarning, setTeleponWarning] = useState<string | null>(null)
  const [addressSuggestion, setAddressSuggestion] = useState('')
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoUrl, setFotoUrl] = useState('')
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const now = new Date()
    setTanggal(now.toISOString().split('T')[0])
    setWaktu(now.toTimeString().slice(0, 5))
  }, [])

  const TELEPON_REGEX = /^(\+62|62|0)\d{8,12}$/

  function resetForm() {
    setJenis('')
    setTanggal(new Date().toISOString().split('T')[0])
    setWaktu(new Date().toTimeString().slice(0, 5))
    setLokasi('')
    setLat('')
    setLng('')
    setPesan('')
    setNama('')
    setTelepon('')
    setTeleponError(null)
    setTeleponWarning(null)
    setAddressSuggestion('')
    setFotoUrl('')
    setFotoFile(null)
    setMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    setErr(null)
    if (telepon && !TELEPON_REGEX.test(telepon)) {
      setTeleponError('Format nomor tidak valid. Gunakan format +62xxx atau 08xxx (8-12 digit).')
      return
    }
    if (parseCoordString(lat) == null || parseCoordString(lng) == null) {
      setErr('Pilih lokasi kejadian di peta (ketuk peta, penanda, atau tombol "Lokasi saya").')
      return
    }
    setSending(true)
    try {
      await postPublicSubmission({
        form_type: 'lapor_bencana',
        wilayah_daerah: '',
        jenis_bencana: jenis,
        tanggal_kejadian: tanggal,
        waktu_kejadian: waktu,
        lokasi,
        lat,
        lng,
        pesan,
        nama,
        telepon,
        foto_url: fotoUrl,
      })
      setMsg('Laporan Anda sudah terkirim. Pihak terkait dapat meninjaunya.')
      setShowSuccessModal(true)
      setTimeout(() => setShowSuccessModal(false), 8000)
    } catch {
      setErr('Gagal mengirim. Periksa isian wajib atau coba lagi.')
    } finally {
      setSending(false)
    }
  }

  async function handleFotoChange(file: File | null) {
    if (!file) return
    setUploadingFoto(true)
    try {
      const { url } = await uploadAdminFile(file)
      setFotoUrl(url)
      setFotoFile(file)
    } catch {
      setErr('Gagal mengunggah foto.')
    } finally {
      setUploadingFoto(false)
    }
  }

  const optionalBtn =
    'inline-flex items-center rounded-xl border border-slate-200/90 bg-white/80 px-3.5 py-2 text-xs font-semibold text-theme-muted transition hover:border-health-500/35 hover:text-theme focus-ring dark:border-white/15 dark:bg-black/25 dark:hover:border-cyan-500/35'

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
                <h2 className="text-2xl font-bold">Laporan Terkirim!</h2>
                <p className="mt-2 text-sm text-white/80">
                  Laporan Anda sudah terkirim. Tim terkait dapat meninjaunya beserta titik lokasi di peta.
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
                  Lapor Lagi
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
        <h1 className="text-2xl font-bold text-theme">Lapor bencana</h1>
        <p className="mt-2 text-sm text-theme-muted">
          Isi formulir di bawah untuk melaporkan kejadian bencana. Lokasi bisa dipilih di seluruh Indonesia.
        </p>
        {msg ? (
          <p className="mt-4 rounded-lg border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-sm text-theme">
            {msg}
          </p>
        ) : null}
        {err ? <p className="mt-4 text-sm text-merah-bright">{err}</p> : null}
        <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs text-theme-muted" htmlFor="jenis-bencana-select">
                Jenis bencana
              </label>
              <select
                id="jenis-bencana-select"
                className={`mt-1 ${fieldBase}`}
                value={jenis}
                onChange={(e) => setJenis(e.target.value)}
                required
              >
                <option value="">Pilih jenis</option>
                {JENIS_BENCANA_EOC_LABELS.map((label) => (
                  <option key={label} value={label}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs text-theme-muted">Tanggal kejadian</label>
              <input
                type="date"
                className={`mt-1 ${fieldBase}`}
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-theme-muted">Waktu</label>
              <input
                type="time"
                className={`mt-1 ${fieldBase}`}
                value={waktu}
                onChange={(e) => setWaktu(e.target.value)}
              />
            </div>
          </div>
          <ReportLocationPicker
            lat={lat}
            lng={lng}
            onChange={(la, lo) => {
              setLat(la)
              setLng(lo)
            }}
            onAddressSuggestion={setAddressSuggestion}
            defaultCenter={[-0.8477, 119.8621]}
            className="pt-0.5"
          />
          <div>
            <p className="text-xs font-medium text-theme-muted">Isi alamat (opsional)</p>
            <label className="mt-2 block text-xs text-theme-muted">
              Keterangan lokasi / alamat (opsional)
            </label>
            <input
              className={`mt-1 ${fieldBase}`}
              value={lokasi}
              onChange={(e) => setLokasi(e.target.value)}
              placeholder="Contoh: jalan, RT/RW, nama lingkungan"
            />
            {addressSuggestion.trim() && !lokasi.trim() ? (
              <button
                type="button"
                className={`mt-2 ${optionalBtn}`}
                onClick={() => setLokasi(addressSuggestion)}
              >
                Isi dari peta
              </button>
            ) : null}
            <p className="mt-1 text-[11px] text-theme-muted">
              Anda bisa mengetik sendiri atau memakai tombol &quot;Isi dari peta&quot; setelah menandai lokasi.
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-theme-muted">Isi keterangan (opsional)</p>
            <label className="mt-2 block text-xs text-theme-muted">Keterangan (opsional)</label>
            <textarea
              className={`mt-1 ${fieldBase}`}
              rows={5}
              value={pesan}
              onChange={(e) => setPesan(e.target.value)}
              placeholder="Ceritakan kondisi kejadian, kerusakan, atau kebutuhan bantuan"
            />
          </div>
          <div>
            <p className="text-xs font-medium text-theme-muted">Unggah foto (opsional)</p>
            <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 px-3 py-2.5 text-xs text-theme-muted transition hover:border-health-500/40 hover:bg-slate-100/50 dark:border-white/15 dark:bg-white/[0.03] dark:hover:border-cyan-500/40">
              {uploadingFoto ? (
                <span className="animate-pulse">Mengunggah…</span>
              ) : (
                <>
                  <Camera className="h-4 w-4 flex-shrink-0" />
                  {fotoUrl ? (
                    <span className="truncate">✓ {fotoFile?.name}</span>
                  ) : (
                    <span>Pilih foto dari perangkat</span>
                  )}
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                disabled={uploadingFoto}
                onChange={(e) => handleFotoChange(e.target.files?.[0] ?? null)}
              />
            </label>
            {fotoUrl ? (
              <div className="relative mt-2">
                <img
                  src={fotoUrl}
                  alt="Pratinjau foto"
                  className="max-h-48 rounded-lg border border-slate-200/60 object-contain"
                />
                <button
                  type="button"
                  onClick={() => {
                    setFotoUrl('')
                    setFotoFile(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                  aria-label="Hapus foto"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
            <p className="mt-1 text-[11px] text-theme-muted">
              Foto bisa membantu pihak terkait melihat kondisi di lokasi kejadian.
            </p>
          </div>
          <div className="space-y-4">
            <p className="text-xs font-medium text-theme-muted">Isi data pelapor (opsional)</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-theme-muted">Nama pelapor (opsional)</label>
                <input
                  className={`mt-1 ${fieldBase}`}
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-theme-muted">Telepon (opsional)</label>
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
                    if (val && !TELEPON_REGEX.test(val)) {
                      setTeleponError('Format nomor tidak valid. Gunakan format +62xxx (8-12 digit).')
                    } else {
                      setTeleponError(null)
                      setTeleponWarning(null)
                    }
                  }}
                />
                {teleponError && <p className="mt-1 text-xs text-red-500">{teleponError}</p>}
                {teleponWarning && !teleponError && <p className="mt-1 text-xs text-amber-500">{teleponWarning}</p>}
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={sending}
            className="w-full rounded-xl bg-gradient-to-r from-merah to-merah-bright py-3 text-sm font-semibold text-white disabled:opacity-50 focus-ring"
          >
            {sending ? 'Mengirim…' : 'Kirim laporan'}
          </button>
        </form>
      </motion.div>
    </div>
  )
}
