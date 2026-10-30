import { Link2, Link2Off, MessageCircle, Smartphone } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'

import {
  fetchAuthMe,
  pollWaStaffLogin,
  startWaStaffLogin,
  unlinkWaStaffPhone,
  type AuthMe,
} from '../api/client'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'

type WaStaffMagicLinkFormProps = {
  /** Otomatis isi username (mis. saat sudah login sebagai masyarakat / staff). */
  defaultUsername?: string
  /** Suffix unik supaya id input tidak bentrok bila halaman punya elemen lain (mis. "staff" → <input id="wa-user-staff" />). */
  idSuffix?: string
  /** Teks bantuan: halaman login vs ruang masyarakat. */
  variant?: 'login' | 'staff'
  /** Jika diset, dipanggil setelah JWT magic link tersimpan (default: hanya perbarui sesi). */
  onSuccess?: (me: AuthMe) => void
}

function formatWaPhone(digits: string): string {
  const d = digits.replace(/\D/g, '')
  if (d.startsWith('62') && d.length >= 11) {
    const rest = d.slice(2)
    if (rest.length >= 10) {
      return `+62 ${rest.slice(0, 3)}-${rest.slice(3, 7)}-${rest.slice(7)}`
    }
    return `+62 ${rest}`
  }
  if (d.startsWith('0')) return d
  return digits
}

function formatLinkedAt(iso: string | null | undefined): string | null {
  if (!iso) return null
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return null
  return dt.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Alur start + poll login petugas lewat WA, sama di halaman Login dan Ruang petugas.
 */
export function WaStaffMagicLinkForm({
  defaultUsername,
  idSuffix,
  variant = 'login',
  onSuccess,
}: WaStaffMagicLinkFormProps) {
  const su = idSuffix ? `-${idSuffix}` : ''
  const idUser = `wa-user${su}`
  const idPhone = `wa-phone${su}`
  const { applyAccessToken, refreshMe, me } = useAuth()
  const { theme } = useTheme()
  const day = theme === 'day'

  const [waUser, setWaUser] = useState(defaultUsername ?? '')
  const [waPhone, setWaPhone] = useState('')
  const [waLoading, setWaLoading] = useState(false)
  const [unlinkLoading, setUnlinkLoading] = useState(false)
  const [waErr, setWaErr] = useState<string | null>(null)
  const [waSessionId, setWaSessionId] = useState<string | null>(null)
  const [waMessage, setWaMessage] = useState<string | null>(null)
  const [waMeUrl, setWaMeUrl] = useState<string | null>(null)
  const [staffLinkOk, setStaffLinkOk] = useState(false)
  const [showConnectForm, setShowConnectForm] = useState(false)
  const waDoneRef = useRef(false)

  const linkedPhone = me?.wa_phone?.trim() || null
  const linkedAtLabel = formatLinkedAt(me?.wa_phone_linked_at)
  const isStaffPanel = variant === 'staff'
  const connectVisible = !isStaffPanel || !linkedPhone || showConnectForm || !!waSessionId

  useEffect(() => {
    if (defaultUsername) setWaUser(defaultUsername)
  }, [defaultUsername])

  useEffect(() => {
    if (isStaffPanel && linkedPhone && !waSessionId) {
      setShowConnectForm(false)
    }
  }, [isStaffPanel, linkedPhone, waSessionId])

  useEffect(() => {
    if (!waSessionId || waDoneRef.current) return
    const tick = async () => {
      try {
        const r = await pollWaStaffLogin(waSessionId)
        if (r.status === 'ready' && r.access_token) {
          waDoneRef.current = true
          applyAccessToken(r.access_token)
          const m = await fetchAuthMe()
          await refreshMe()
          onSuccess?.(m)
          setWaSessionId(null)
          setWaMessage(null)
          setWaMeUrl(null)
          setShowConnectForm(false)
          if (isStaffPanel) setStaffLinkOk(true)
        } else if (r.status === 'error' && r.detail) {
          setWaErr(r.detail)
          waDoneRef.current = true
        }
      } catch {
        /* keep polling */
      }
    }
    void tick()
    const id = window.setInterval(() => void tick(), 2500)
    return () => window.clearInterval(id)
  }, [waSessionId, applyAccessToken, onSuccess, isStaffPanel, refreshMe])

  async function onWaStart(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setWaErr(null)
    setStaffLinkOk(false)
    setWaLoading(true)
    waDoneRef.current = false
    try {
      const u = waUser.trim()
      const p = waPhone.trim()
      const out = await startWaStaffLogin(u, p)
      setWaSessionId(out.session_id)
      setWaMessage(out.message_text)
      setWaMeUrl(out.wa_me_url)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Gagal memulai verifikasi WhatsApp. Periksa username dan nomor, atau coba lagi.'
      setWaErr(typeof msg === 'string' ? msg : 'Gagal memulai verifikasi WhatsApp.')
    } finally {
      setWaLoading(false)
    }
  }

  async function onUnlink() {
    setWaErr(null)
    setStaffLinkOk(false)
    setUnlinkLoading(true)
    try {
      await unlinkWaStaffPhone()
      await refreshMe()
      setShowConnectForm(true)
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ||
        'Gagal memutus sambungan WhatsApp.'
      setWaErr(typeof msg === 'string' ? msg : 'Gagal memutus sambungan WhatsApp.')
    } finally {
      setUnlinkLoading(false)
    }
  }

  function resetConnectFlow() {
    setWaSessionId(null)
    setWaMessage(null)
    setWaMeUrl(null)
    setWaErr(null)
    waDoneRef.current = false
  }

  const inputClass = day
    ? 'mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-theme transition duration-200 placeholder:text-slate-400 focus:border-health-500/50 focus:outline-none focus:ring-[3px] focus:ring-cyan-500/30'
    : 'mt-1.5 w-full rounded-xl border border-white/15 bg-black/30 px-4 py-3 text-base text-theme transition duration-200 placeholder:text-theme-soft focus:border-cyan-500/40 focus:outline-none focus:ring-[3px] focus:ring-cyan-400/30'

  const statusCardClass = linkedPhone
    ? day
      ? 'border-emerald-200 bg-emerald-50/80'
      : 'border-emerald-500/30 bg-emerald-500/10'
    : day
      ? 'border-slate-200 bg-slate-50/80'
      : 'border-white/10 bg-black/20'

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-2 ${day ? 'text-health-600' : 'text-cyan-300/95'}`}>
        <MessageCircle className="h-5 w-5 shrink-0" aria-hidden />
        <h2 className="text-base font-semibold text-theme">
          {isStaffPanel ? 'WhatsApp & asisten chat' : 'Login masyarakat lewat WhatsApp'}
        </h2>
      </div>

      <p className="text-sm text-theme-muted">
        {isStaffPanel ? (
          <>
            Hubungkan nomor WhatsApp pribadi Anda ke akun ini. Setelah terverifikasi, Anda bisa bertanya materi
            kesiapsiagaan langsung lewat chat layanan WhatsApp resmi (jawaban dari data asesmen & materi sistem).
          </>
        ) : (
          <>
            Masukkan username akun <strong className="font-medium text-theme">masyarakat</strong> dan nomor WhatsApp
            yang sama. Anda mendapat teks <code className="rounded bg-[var(--panel-bg)] px-1">SBP …</code> untuk
            dikirim ke chat layanan WhatsApp resmi. Setelah terkirim, halaman ini melanjutkan login otomatis.
          </>
        )}
      </p>

      {staffLinkOk ? (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            day ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
          }`}
          role="status"
        >
          Verifikasi berhasil - nomor WhatsApp sudah tertaut ke akun Anda.
        </p>
      ) : null}

      {isStaffPanel && linkedPhone && !connectVisible ? (
        <button
          type="button"
          onClick={() => {
            setShowConnectForm(true)
            resetConnectFlow()
          }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-4 py-3 text-sm font-semibold text-theme transition duration-200 hover:bg-health-500/5 focus-ring"
        >
          <Smartphone className="h-4 w-4 shrink-0" aria-hidden />
          Sambungkan perangkat / nomor lain
        </button>
      ) : null}

      {connectVisible ? (
        <form onSubmit={onWaStart} className="space-y-3">
          {!isStaffPanel || !defaultUsername ? (
            <div>
              <label htmlFor={idUser} className="block text-sm font-medium text-theme-muted">
                Username masyarakat
              </label>
              <input
                id={idUser}
                autoComplete="username"
                value={waUser}
                onChange={(e) => setWaUser(e.target.value)}
                className={inputClass}
                placeholder="masyarakat"
                required
                disabled={!!waSessionId && !waErr}
              />
            </div>
          ) : null}
          <div>
            <label htmlFor={idPhone} className="block text-sm font-medium text-theme-muted">
              Nomor WhatsApp {isStaffPanel && linkedPhone ? 'baru' : ''}
            </label>
            <input
              id={idPhone}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={waPhone}
              onChange={(e) => setWaPhone(e.target.value)}
              className={inputClass}
              placeholder="0812… atau 62812…"
              required
              disabled={!!waSessionId && !waErr}
            />
          </div>
          {waErr ? <p className={`text-sm ${day ? 'text-merah' : 'text-merah-bright/80'}`}>{waErr}</p> : null}
          {!waSessionId || waErr ? (
            <button
              type="submit"
              disabled={waLoading}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] py-3 text-sm font-semibold text-theme transition duration-200 hover:bg-health-500/5 disabled:cursor-not-allowed disabled:opacity-60 focus-ring"
            >
              <Link2 className="h-4 w-4 shrink-0" aria-hidden />
              {waLoading ? 'Menyiapkan kode…' : 'Dapatkan kode verifikasi & buka WhatsApp'}
            </button>
          ) : null}
          {isStaffPanel && linkedPhone && showConnectForm && !waSessionId ? (
            <button
              type="button"
              onClick={() => setShowConnectForm(false)}
              className="cursor-pointer text-xs font-medium text-theme-muted underline-offset-2 transition hover:underline"
            >
              Batal - gunakan nomor yang sudah tertaut
            </button>
          ) : null}
        </form>
      ) : null}

      {waMessage && waMeUrl ? (
        <div className="space-y-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 text-sm">
          <p className="font-medium text-theme">Langkah verifikasi</p>
          <p className="text-theme-muted">
            Kirim teks berikut dari nomor yang Anda masukkan. Tombol di bawah mengisi chat WhatsApp layanan resmi.
          </p>
          <p className="select-all break-all font-mono text-xs text-theme">{waMessage}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(waMessage)}
              className="cursor-pointer rounded-lg border border-[var(--panel-border)] px-3 py-1.5 text-xs font-medium text-theme transition duration-200 focus-ring hover:bg-health-500/10"
            >
              Salin teks
            </button>
            <a
              href={waMeUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex cursor-pointer items-center rounded-lg bg-merah px-3 py-1.5 text-xs font-semibold text-white transition duration-200 focus-ring hover:brightness-105"
            >
              Buka WhatsApp
            </a>
          </div>
          <p className={`text-xs ${day ? 'text-health-600' : 'text-cyan-300/90'}`}>
            Menunggu konfirmasi dari server… jangan tutup halaman ini.
          </p>
          <button
            type="button"
            onClick={resetConnectFlow}
            className="cursor-pointer text-xs font-medium text-theme-muted underline-offset-2 transition hover:underline"
          >
            Batalkan & buat kode baru
          </button>
        </div>
      ) : null}

      {isStaffPanel ? (
        <div
          className={`rounded-xl border p-4 ${statusCardClass}`}
          role="region"
          aria-label="Status tautan WhatsApp"
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                linkedPhone
                  ? day
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-emerald-500/20 text-emerald-200'
                  : day
                    ? 'bg-slate-100 text-slate-500'
                    : 'bg-white/10 text-theme-muted'
              }`}
            >
              {linkedPhone ? <Link2 className="h-4 w-4" aria-hidden /> : <Link2Off className="h-4 w-4" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-theme-muted">Status tautan</p>
                {linkedPhone ? (
                  <>
                    <p className="mt-1 text-sm font-semibold text-theme">{formatWaPhone(linkedPhone)}</p>
                    <p className="text-xs text-theme-muted">
                      Nomor ini menerima balasan asisten chat setelah Anda mengirim pesan ke layanan WhatsApp resmi.
                    </p>
                    {linkedAtLabel ? (
                      <p className="mt-1 text-xs text-theme-muted">Tertaut sejak {linkedAtLabel}</p>
                    ) : null}
                  </>
                ) : (
                  <p className="mt-1 text-sm text-theme-muted">
                    Belum ada nomor WhatsApp tertaut. Verifikasi dengan kode di atas agar chat & asisten aktif.
                  </p>
                )}
              </div>
              {linkedPhone ? (
                <button
                  type="button"
                  onClick={() => void onUnlink()}
                  disabled={unlinkLoading || !!waSessionId}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-merah/30 px-3 py-1.5 text-xs font-semibold text-merah transition duration-200 hover:bg-merah/[0.05] disabled:cursor-not-allowed disabled:opacity-60 focus-ring dark:border-merah/35 dark:text-merah-bright/70 dark:hover:bg-merah/[0.08]"
                >
                  <Link2Off className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {unlinkLoading ? 'Memutus…' : 'Putuskan sambungan'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
