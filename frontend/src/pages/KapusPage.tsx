import { useState, useEffect, useCallback } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import {
  Users, BookOpen, Bell, BarChart2,
  Plus, Pencil, Trash2, QrCode, CheckCircle,
  Calendar, Clock, MapPin, Save,
  RefreshCw, Send, X, Phone, AlertTriangle,
  Shield, Activity,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  RoleWorkspaceShell,
  btnGhost,
  btnPrimary,
  btnSecondary,
  fieldClass,
  panelCard,
} from '../components/RoleWorkspaceShell'
import {
  fetchKapusDashboard, fetchKapusStaffList, createStaffByKapus,
  updateStaffByKapus, deleteStaffByKapus, fetchKapusStaffSkor,
  fetchKapusPelatihanStaff, fetchPelatihanList, fetchPelatihanPeserta,
  togglePesertaPelatihan, updateAbsensi, fetchPelatihanQrToken,
  regeneratePelatihanQr, fetchNotifikasiSettings, saveNotifikasiSettings,
  testKirimNotifikasi, fetchStaffBelumPelatihan1Tahun, kirimPengingatPelatihan,
} from '../api/client'
import type {
  KapusDashboardOut, StaffOut, PelatihanOut, AbsensiOut,
  StaffSkorOut, NotifikasiJenis, PelatihanStaffRekap, StaffBelumPelatihanOut,
} from '../types'

type TabId = 'dashboard' | 'staff' | 'pelatihan' | 'skor' | 'notifikasi'

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
  { id: 'staff', label: 'Kelola Staff', icon: <Users className="w-4 h-4" /> },
  { id: 'pelatihan', label: 'Pelatihan', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'skor', label: 'Skor Staff', icon: <BarChart2 className="w-4 h-4" /> },
  { id: 'notifikasi', label: 'Notifikasi', icon: <Bell className="w-4 h-4" /> },
]

function StatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string | number
  icon: React.ReactNode
  tone: 'merah' | 'health' | 'cta' | 'amber'
}) {
  const cardTone = {
    merah: 'border-merah/20 bg-gradient-to-br from-merah/[0.08] to-transparent',
    health: 'border-health-500/25 bg-gradient-to-br from-health-500/[0.1] to-transparent',
    cta: 'border-cta-500/25 bg-gradient-to-br from-cta-500/[0.1] to-transparent',
    amber: 'border-amber-400/30 bg-gradient-to-br from-amber-400/[0.12] to-transparent',
  }[tone]
  const iconTone = {
    merah: 'text-merah bg-merah/10',
    health: 'text-health-600 bg-health-500/10',
    cta: 'text-cta-600 bg-cta-500/10',
    amber: 'text-amber-700 bg-amber-500/15',
  }[tone]

  return (
    <div className={`rounded-2xl border p-4 transition duration-200 card-lift ${cardTone}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-xl p-2.5 ${iconTone}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-2xl font-bold tabular-nums text-theme">{value}</p>
          <p className="mt-0.5 text-xs font-medium text-theme-muted">{label}</p>
        </div>
      </div>
    </div>
  )
}

// ── TAB: Dashboard ─────────────────────────────────────────────────────────────

const PENGINGAT_PELATIHAN_TEXT = (nama: string) =>
  `Halo ${nama}, Anda belum mengikuti pelatihan kesiapsiagaan bencana dalam 1 tahun terakhir. Mohon segera ikuti pelatihan berikutnya untuk meningkatkan kesiapsiagaan Anda. SiAP-PKM`

function normalizeWaDigits(phone: string): string {
  let s = phone.replace(/\D/g, '')
  if (s.startsWith('0')) s = '62' + s.slice(1)
  else if (s.startsWith('8')) s = '62' + s
  return s
}

function waMeUrl(phone: string, text: string): string {
  return `https://wa.me/${normalizeWaDigits(phone)}?text=${encodeURIComponent(text)}`
}

function formatTerakhirHadir(iso: string | null, pernah: boolean): string {
  if (!iso) return pernah ? '-' : 'Belum pernah hadir'
  try {
    return new Date(iso).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

function LaporanTahunanSection() {
  const [list, setList] = useState<StaffBelumPelatihanOut[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setList(await fetchStaffBelumPelatihan1Tahun())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleKirimPengingat(u: StaffBelumPelatihanOut) {
    setSending(u.username)
    setMsg(null)
    try {
      const r = await kirimPengingatPelatihan(u.username)
      setMsg(r.message)
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || 'Gagal kirim pengingat')
    } finally {
      setSending(null)
    }
  }

  return (
    <div className={`${panelCard()} overflow-hidden !p-0 border-amber-200/60`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-theme">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Laporan Tahunan - Belum Pelatihan 1 Tahun
          </h3>
          <p className="mt-1 text-sm text-theme-muted">
            Staff berikut akan menerima notifikasi WA otomatis (sama seperti pengaturan notifikasi tahunan).
          </p>
        </div>
        <button type="button" onClick={load} className={`${btnSecondary} px-3 py-1.5 text-xs text-amber-800 border-amber-300`}>
          <RefreshCw className="h-3.5 w-3.5" /> Muat ulang
        </button>
      </div>

      {msg && (
        <div className={`mx-5 mt-4 rounded-xl px-4 py-2.5 text-sm ${msg.includes('Gagal') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {msg}
        </div>
      )}

      {loading ? (
        <p className="py-10 text-center text-sm text-theme-muted">Memuat daftar...</p>
      ) : list.length === 0 ? (
        <p className="py-10 text-center text-sm text-emerald-700">Semua staff sudah mengikuti pelatihan dalam 1 tahun terakhir.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-[var(--panel-bg)] text-left text-xs uppercase tracking-wide text-theme-muted">
                <th className="px-5 py-3 font-semibold">Staff</th>
                <th className="px-5 py-3 font-semibold">Terakhir hadir</th>
                <th className="px-5 py-3 font-semibold">WhatsApp</th>
                <th className="px-5 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {list.map(u => {
                const nama = u.display_name || u.username
                const hasWa = Boolean(u.wa_phone?.trim())
                const pengingatText = PENGINGAT_PELATIHAN_TEXT(nama)
                return (
                  <tr key={u.username} className="border-b last:border-0 hover:bg-amber-50/40">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-theme">{nama}</div>
                      <div className="text-xs text-theme-muted">@{u.username}</div>
                    </td>
                    <td className="px-5 py-3 text-theme-muted">
                      {formatTerakhirHadir(u.terakhir_hadir, u.pernah_hadir)}
                    </td>
                    <td className="px-5 py-3 text-theme-muted">
                      {hasWa ? u.wa_phone : <span className="text-red-500">Belum diisi</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-2">
                        {hasWa ? (
                          <>
                            <a
                              href={waMeUrl(u.wa_phone!, pengingatText)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100"
                            >
                              <Phone className="h-3.5 w-3.5" /> Hubungi
                            </a>
                            <button
                              type="button"
                              disabled={sending === u.username}
                              onClick={() => handleKirimPengingat(u)}
                              className="inline-flex items-center gap-1 rounded-lg border border-merah/30 bg-merah/[0.06] px-2.5 py-1.5 text-xs font-semibold text-merah hover:bg-merah/[0.1] disabled:opacity-60"
                            >
                              <Send className="h-3.5 w-3.5" />
                              {sending === u.username ? 'Mengirim...' : 'Kirim pengingat WA'}
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-theme-muted">Isi nomor WA di tab Kelola Staff</span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function DashboardTab({ dashboard }: { dashboard: KapusDashboardOut | null }) {
  if (!dashboard) return <div className="py-10 text-center text-theme-muted">Memuat...</div>
  const belum = dashboard.staff_belum_pelatihan_1tahun ?? dashboard.notif_pending ?? 0
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Total Staff" value={dashboard.staff_count} icon={<Users className="h-5 w-5" />} tone="health" />
        <StatCard label="Jml Pelatihan" value={dashboard.pelatihan_count} icon={<BookOpen className="h-5 w-5" />} tone="cta" />
        <StatCard label="Hadir Bulan Ini" value={dashboard.staff_hadir_bulan_ini} icon={<CheckCircle className="h-5 w-5" />} tone="merah" />
        <StatCard label="Belum Pelatihan 1 Thn" value={belum} icon={<AlertTriangle className="h-5 w-5" />} tone="amber" />
      </div>
      <LaporanTahunanSection />
    </div>
  )
}

// ── TAB: Kelola Staff ─────────────────────────────────────────────────────────

function StaffTab({ puskesmasId: _puskesmasId }: { puskesmasId: string }) {
  const [staff, setStaff] = useState<StaffOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StaffOut | null>(null)
  const [form, setForm] = useState({ username: '', password: '', display_name: '', wa_phone: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setStaff(await fetchKapusStaffList()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleSave() {
    setErr(null); setSaving(true)
    try {
      if (editing) {
        await updateStaffByKapus(editing.username, {
          display_name: form.display_name || null,
          wa_phone: form.wa_phone || null,
          password: form.password || null,
        })
      } else {
        await createStaffByKapus({
          username: form.username,
          password: form.password,
          display_name: form.display_name,
          wa_phone: form.wa_phone,
        })
      }
      setShowForm(false); setEditing(null)
      setForm({ username: '', password: '', display_name: '', wa_phone: '' })
      await load()
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  async function handleDelete(u: StaffOut) {
    if (!confirm(`Hapus akun ${u.username}?`)) return
    try { await deleteStaffByKapus(u.username); await load() }
    catch (e: any) { alert(e?.response?.data?.detail || 'Gagal menghapus') }
  }

  function openEdit(u: StaffOut) {
    setEditing(u)
    setForm({ username: u.username, password: '', display_name: u.display_name || '', wa_phone: u.wa_phone || '' })
    setShowForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-theme">Staff Puskesmas</h2>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ username: '', password: '', display_name: '', wa_phone: '' }) }}
          className={btnPrimary}>
          <Plus className="w-4 h-4" /> Tambah Staff
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-merah/15 bg-merah/[0.05] p-5 space-y-3">
          <h3 className="font-semibold text-theme">{editing ? 'Edit Staff' : 'Tambah Staff Baru'}</h3>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {!editing && (
            <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="Username" className="w-full rounded-xl border px-3 py-2 text-sm" />
          )}
          <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="Nama tampilan" className="w-full rounded-xl border px-3 py-2 text-sm" />
          <input value={form.wa_phone} onChange={e => setForm(f => ({ ...f, wa_phone: e.target.value }))}
            placeholder="No. WhatsApp (628...)" className="w-full rounded-xl border px-3 py-2 text-sm" />
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder={editing ? 'Password baru (kosongkan jika tidak diubah)' : 'Password'} className="w-full rounded-xl border px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className={btnPrimary}>
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={() => { setShowForm(false); setEditing(null) }}
              className={btnSecondary}>Batal</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-theme-muted">Memuat...</div> : (
        <div className="space-y-2">
          {staff.length === 0 && <p className="py-8 text-center text-theme-muted">Belum ada staff</p>}
          {staff.map(u => (
            <div key={u.username} className={`flex items-center justify-between rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 card-lift`}>
              <div>
                <div className="font-semibold text-theme">{u.display_name || u.username}</div>
                <div className="text-sm text-theme-muted">@{u.username} {u.wa_phone ? `· WA: ${u.wa_phone}` : ''}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => openEdit(u)} className="rounded-lg border p-2 text-theme-muted hover:bg-[var(--panel-bg)]">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(u)} className="rounded-lg border p-2 text-red-500 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── TAB: Pelatihan + Absensi ──────────────────────────────────────────────────

function AbsensiModal({ pelatihan, onClose }: { pelatihan: PelatihanOut; onClose: () => void }) {
  const [peserta, setPeserta] = useState<AbsensiOut[]>([])
  const [allStaff, setAllStaff] = useState<StaffOut[]>([])
  const [loading, setLoading] = useState(true)
  const [qrToken, setQrToken] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, s] = await Promise.all([fetchPelatihanPeserta(pelatihan.id), fetchKapusStaffList()])
    setPeserta(p); setAllStaff(s); setLoading(false)
  }, [pelatihan.id])

  useEffect(() => { load() }, [load])

  async function loadQr() {
    const r = await fetchPelatihanQrToken(pelatihan.id)
    setQrToken(r.qr_token); setShowQr(true)
  }

  async function regenQr() {
    const r = await regeneratePelatihanQr(pelatihan.id)
    setQrToken(r.qr_token)
  }

  async function toggleDaftar(uname: string, terdaftar: boolean) {
    await togglePesertaPelatihan(pelatihan.id, uname, terdaftar)
    await load()
  }

  async function toggleHadir(uname: string, hadir: boolean) {
    await updateAbsensi(pelatihan.id, uname, hadir)
    await load()
  }

  const pesertaMap = Object.fromEntries(peserta.map(p => [p.username, p]))
  const terdaftar = peserta.map(p => p.username)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--panel-border)] bg-[var(--panel-bg)] p-5">
          <div>
            <h3 className="font-bold text-theme">{pelatihan.judul}</h3>
            <p className="text-sm text-theme-muted">{pelatihan.tanggal} · {pelatihan.lokasi}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-theme-muted hover:bg-merah/[0.06]"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* QR Code */}
          <div className="flex items-center gap-3">
            <button onClick={loadQr} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2 text-sm font-semibold text-white">
              <QrCode className="w-4 h-4" /> Tampilkan QR Absen
            </button>
            {showQr && qrToken && (
              <div className="flex-1 rounded-xl border bg-[var(--panel-bg)] p-3">
                <p className="text-xs text-theme-muted mb-1">Token QR (scan oleh staff):</p>
                <code className="text-sm font-mono font-bold text-merah break-all">{qrToken}</code>
                <button onClick={regenQr} className="mt-2 flex items-center gap-1 text-xs text-theme-muted hover:text-theme">
                  <RefreshCw className="w-3 h-3" /> Regenerate
                </button>
              </div>
            )}
          </div>

          {/* Daftar semua staff: centang untuk daftarkan, centang hadir */}
          {loading ? <div className="py-4 text-center text-theme-muted">Memuat...</div> : (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-theme">Staff Puskesmas ({allStaff.length} orang)</p>
              {allStaff.map(s => {
                const ps = pesertaMap[s.username]
                const isTerdaftar = terdaftar.includes(s.username)
                return (
                  <div key={s.username} className="flex items-center justify-between rounded-xl border bg-[var(--panel-bg)] px-4 py-3">
                    <div>
                      <div className="font-medium text-theme">{s.display_name || s.username}</div>
                      <div className="text-xs text-theme-muted">@{s.username}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-sm text-theme-muted">
                        <input type="checkbox" checked={isTerdaftar}
                          onChange={e => toggleDaftar(s.username, e.target.checked)}
                          className="h-4 w-4 rounded accent-merah" />
                        Terdaftar
                      </label>
                      {isTerdaftar && (
                        <label className="flex items-center gap-1.5 text-sm text-theme-muted">
                          <input type="checkbox" checked={ps?.hadir ?? false}
                            onChange={e => toggleHadir(s.username, e.target.checked)}
                            className="h-4 w-4 rounded accent-emerald-600" />
                          {ps?.via_qr ? '✓QR' : 'Hadir'}
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PelatihanTab() {
  const [pelatihan, setPelatihan] = useState<PelatihanOut[]>([])
  const [rekap, setRekap] = useState<PelatihanStaffRekap[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<PelatihanOut | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [p, r] = await Promise.all([fetchPelatihanList(), fetchKapusPelatihanStaff()])
    setPelatihan(p); setRekap(r); setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const rekapMap = Object.fromEntries(rekap.map(r => [r.pelatihan_id, r]))

  if (loading) return <div className="py-10 text-center text-theme-muted">Memuat...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-theme">Jadwal Pelatihan</h2>
      {pelatihan.length === 0 && <p className="py-8 text-center text-theme-muted">Belum ada jadwal pelatihan</p>}
      {pelatihan.map(p => {
        const r = rekapMap[p.id]
        return (
          <div key={p.id} className={`${panelCard()} space-y-3 card-lift`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-theme">{p.judul}</h3>
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-theme-muted">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{p.tanggal}</span>
                  {p.waktu_mulai && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{p.waktu_mulai}{p.waktu_selesai ? `–${p.waktu_selesai}` : ''}</span>}
                  {p.lokasi && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{p.lokasi}</span>}
                </div>
                {p.deskripsi && <p className="mt-2 text-sm text-theme-muted">{p.deskripsi}</p>}
              </div>
              {r && (
                <div className="text-right text-sm">
                  <div className="font-semibold text-emerald-600">{r.staff_hadir}/{r.staff_terdaftar} hadir</div>
                  <div className="text-theme-muted text-xs">dari {r.total_staff_puskesmas} staff</div>
                </div>
              )}
            </div>
            <button onClick={() => setSelected(p)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2 text-sm font-semibold text-white hover:brightness-105">
              <Users className="w-4 h-4" /> Kelola Peserta & Absensi
            </button>
          </div>
        )
      })}
      {selected && <AbsensiModal pelatihan={selected} onClose={() => { setSelected(null); load() }} />}
    </div>
  )
}

// ── TAB: Skor Staff ───────────────────────────────────────────────────────────

function SkorTab() {
  const [skor, setSkor] = useState<StaffSkorOut[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchKapusStaffSkor().then(setSkor).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="py-10 text-center text-theme-muted">Memuat...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-theme">Skor Staff</h2>
      {skor.length === 0 && <p className="py-8 text-center text-theme-muted">Belum ada data skor</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-theme-muted">
              <th className="pb-3 pr-4 font-semibold">Staff</th>
              <th className="pb-3 pr-4 font-semibold">Skor Pengetahuan</th>
              <th className="pb-3 pr-4 font-semibold">Kategori</th>
              <th className="pb-3 pr-4 font-semibold">Indeks KA</th>
              <th className="pb-3 pr-4 font-semibold">Video ML</th>
              <th className="pb-3 font-semibold">PDF ML</th>
            </tr>
          </thead>
          <tbody>
            {skor.map(s => (
              <tr key={s.username} className="border-b last:border-0">
                <td className="py-3 pr-4">
                  <div className="font-medium text-theme">{s.display_name || s.username}</div>
                  <div className="text-xs text-theme-muted">@{s.username}</div>
                </td>
                <td className="py-3 pr-4">
                  {s.lipi_skor != null ? (
                    <span className="font-semibold text-health-600">{s.lipi_skor.toFixed(1)}%</span>
                  ) : <span className="text-theme-soft">-</span>}
                </td>
                <td className="py-3 pr-4">
                  {s.lipi_label ? (
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold
                      ${s.lipi_label === 'Baik' ? 'bg-emerald-100 text-emerald-700' : s.lipi_label === 'Cukup' ? 'bg-amber-100 text-amber-800' : 'bg-orange-100 text-orange-700'}`}>
                      {s.lipi_label}
                    </span>
                  ) : <span className="text-theme-soft">-</span>}
                </td>
                <td className="py-3 pr-4">
                  {s.indeks_ka_pct != null ? `${s.indeks_ka_pct.toFixed(1)}%` : <span className="text-theme-soft">-</span>}
                </td>
                <td className="py-3 pr-4">{s.ml_video_count}</td>
                <td className="py-3">{s.ml_pdf_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── TAB: Notifikasi ───────────────────────────────────────────────────────────

const JADWAL_LABEL: Record<string, string> = {
  sekali: 'Sekali (tanggal tertentu)',
  harian: 'Harian',
  mingguan: 'Mingguan',
  tahunan: 'Tahunan',
}

const TANGGAL_HINT: Record<string, string> = {
  sekali: 'Tanggal kirim',
  mingguan: 'Hari acuan (ulang tiap minggu)',
  tahunan: 'Tanggal acuan (ulang tiap tahun)',
}

function needsTanggal(tipe: NotifikasiJenis['jadwal_tipe']) {
  return tipe === 'sekali' || tipe === 'mingguan' || tipe === 'tahunan'
}

/** Pratinjau countdown lokal (WIB) - selaras logika backend. */
function previewCountdown(n: NotifikasiJenis): string | null {
  if (!n.aktif || n.jadwal_tipe === 'instant') return null
  const nextIso = previewNextKirimIso(n)
  if (!nextIso) return null
  const diff = new Date(nextIso).getTime() - Date.now()
  if (diff <= 0) return 'Segera terkirim'
  const totalMin = Math.floor(diff / 60000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const minutes = totalMin % 60
  const parts: string[] = []
  if (days) parts.push(`${days} hari`)
  if (hours) parts.push(`${hours} jam`)
  if (minutes || !parts.length) parts.push(`${minutes} menit`)
  return parts.join(' ')
}

function previewNextKirimIso(n: NotifikasiJenis): string | null {
  if (!n.aktif || n.jadwal_tipe === 'instant') return null
  const [hour, minute] = (n.jam || '08:00').split(':').map(x => parseInt(x, 10) || 0)
  const nowWib = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }))

  const atTime = (y: number, mo: number, d: number) => {
    const local = new Date(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+08:00`)
    return local.toISOString()
  }

  if (n.jadwal_tipe === 'sekali') {
    if (!n.tanggal) return null
    const [y, mo, d] = n.tanggal.split('-').map(Number)
    const iso = atTime(y, mo, d)
    return new Date(iso) > new Date() ? iso : null
  }

  if (n.jadwal_tipe === 'harian') {
    let target = new Date(nowWib)
    target.setHours(hour, minute, 0, 0)
    if (target <= nowWib) target.setDate(target.getDate() + 1)
    const y = target.getFullYear(), mo = target.getMonth() + 1, d = target.getDate()
    return atTime(y, mo, d)
  }

  if (n.jadwal_tipe === 'mingguan') {
    let weekday = nowWib.getDay() === 0 ? 6 : nowWib.getDay() - 1
    if (n.tanggal) {
      const anchor = new Date(n.tanggal + 'T12:00:00+08:00')
      weekday = anchor.getDay() === 0 ? 6 : anchor.getDay() - 1
    }
    const cur = nowWib.getDay() === 0 ? 6 : nowWib.getDay() - 1
    let daysAhead = (weekday - cur + 7) % 7
    let target = new Date(nowWib)
    target.setHours(hour, minute, 0, 0)
    target.setDate(target.getDate() + daysAhead)
    if (target <= nowWib) target.setDate(target.getDate() + 7)
    return atTime(target.getFullYear(), target.getMonth() + 1, target.getDate())
  }

  if (n.jadwal_tipe === 'tahunan') {
    if (!n.tanggal) return null
    const [, mo, d] = n.tanggal.split('-').map(Number)
    let y = nowWib.getFullYear()
    let iso = atTime(y, mo, d)
    if (new Date(iso) <= new Date()) iso = atTime(y + 1, mo, d)
    return iso
  }

  return null
}

function NotifikasiTab({ puskesmasId }: { puskesmasId: string }) {
  const [settings, setSettings] = useState<NotifikasiJenis[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [, tick] = useState(0)

  useEffect(() => {
    if (!puskesmasId) return
    fetchNotifikasiSettings(puskesmasId)
      .then(d => setSettings(d.notifikasi))
      .finally(() => setLoading(false))
  }, [puskesmasId])

  useEffect(() => {
    const t = setInterval(() => tick(x => x + 1), 30000)
    return () => clearInterval(t)
  }, [])

  function update(id: string, patch: Partial<NotifikasiJenis>) {
    setSettings(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n))
  }

  async function handleSave() {
    setSaving(true); setMsg(null)
    try {
      const saved = await saveNotifikasiSettings(puskesmasId, settings)
      setSettings(saved.notifikasi)
      setMsg('Pengaturan notifikasi disimpan!')
    } catch { setMsg('Gagal menyimpan') } finally { setSaving(false) }
  }

  async function handleTest(id: string) {
    setTesting(id); setMsg(null)
    try {
      const r = await testKirimNotifikasi(puskesmasId, id)
      setMsg(r.message)
    } catch (e: any) {
      setMsg(e?.response?.data?.detail || 'Gagal test kirim')
    } finally { setTesting(null) }
  }

  if (loading) return <div className="py-10 text-center text-theme-muted">Memuat...</div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-theme">Pengaturan Notifikasi</h2>
        <button onClick={handleSave} disabled={saving}
          className={btnPrimary}>
          <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan Semua'}
        </button>
      </div>
      {msg && <div className={`rounded-xl px-4 py-3 text-sm ${msg.includes('Gagal') ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>{msg}</div>}

      {settings.map(n => {
        const isInstant = n.jadwal_tipe === 'instant'
        const countdown = n.countdown || previewCountdown(n)
        const nextPreview = n.next_kirim || previewNextKirimIso(n)
        const jadwalOptions = n.id === 'pelatihan_belum_1tahun'
          ? ['tahunan', 'sekali', 'harian', 'mingguan']
          : Object.keys(JADWAL_LABEL)

        return (
        <div key={n.id} className={`rounded-2xl border p-5 space-y-4 ${n.aktif ? 'border-merah/20 bg-merah/[0.06]' : 'border-[var(--panel-border)] bg-[var(--panel-bg)]'}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${n.aktif ? 'bg-merah' : 'bg-slate-300'}`} />
                <h3 className="font-semibold text-theme">{n.label}</h3>
              </div>
              <p className="mt-1 text-sm text-theme-muted">{n.deskripsi}</p>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <span className="text-sm text-theme-muted">Aktif</span>
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={n.aktif}
                  onChange={e => update(n.id, { aktif: e.target.checked })} />
                <div className={`h-6 w-11 rounded-full transition-colors ${n.aktif ? 'bg-merah' : 'bg-slate-300'}`} />
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${n.aktif ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </div>
            </label>
          </div>

          {n.aktif && isInstant && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Notifikasi ini otomatis terkirim ke staff saat admin membuat jadwal pelatihan baru.
            </div>
          )}

          {n.aktif && !isInstant && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide">Jadwal</label>
                <select value={n.jadwal_tipe} onChange={e => update(n.id, { jadwal_tipe: e.target.value as NotifikasiJenis['jadwal_tipe'] })}
                  className={`${fieldClass} mt-1`}>
                  {jadwalOptions.map(v => (
                    <option key={v} value={v}>{JADWAL_LABEL[v]}</option>
                  ))}
                </select>
              </div>
              {needsTanggal(n.jadwal_tipe) && (
                <div>
                  <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide">
                    {TANGGAL_HINT[n.jadwal_tipe] || 'Tanggal'}
                  </label>
                  <input type="date" value={n.tanggal || ''} onChange={e => update(n.id, { tanggal: e.target.value })}
                    className={`${fieldClass} mt-1`} />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide">Jam (WIB)</label>
                <input type="time" value={n.jam} onChange={e => update(n.id, { jam: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white" />
              </div>
              <div>
                <label className="text-xs font-semibold text-theme-muted uppercase tracking-wide">Via WhatsApp</label>
                <label className="mt-2 flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={n.wa_enabled} onChange={e => update(n.id, { wa_enabled: e.target.checked })} className="h-4 w-4 accent-merah" />
                  <span className="text-sm text-theme-muted">Kirim ke WA</span>
                </label>
              </div>
            </div>
          )}

          {n.aktif && !isInstant && countdown && (
            <p className="text-sm font-medium text-health-700">
              Pesan terkirim dalam: {countdown}
            </p>
          )}

          {n.terakhir_kirim && (
            <p className="text-xs text-theme-muted">Terakhir dikirim: {new Date(n.terakhir_kirim).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}</p>
          )}
          {nextPreview && n.aktif && !isInstant && (
            <p className="text-xs text-health-600">
              Jadwal kirim berikutnya: {new Date(nextPreview).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
            </p>
          )}

          <div className="flex gap-2">
            <button onClick={() => handleTest(n.id)} disabled={testing === n.id}
              className="flex items-center gap-1.5 rounded-xl border border-merah/30 bg-white px-3 py-1.5 text-xs font-semibold text-merah hover:bg-merah/[0.06] disabled:opacity-60">
              <Send className="w-3.5 h-3.5" /> {testing === n.id ? 'Mengirim...' : 'Test Kirim Sekarang'}
            </button>
          </div>
        </div>
        )
      })}
    </div>
  )
}

// ── Main KapusPage ─────────────────────────────────────────────────────────────

export function KapusPage() {
  const { me, logout, ready, token } = useAuth()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('dashboard')
  const [dashboard, setDashboard] = useState<KapusDashboardOut | null>(null)

  useEffect(() => {
    fetchKapusDashboard().then(setDashboard).catch(() => {})
  }, [])

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const puskesmasId = me?.puskesmas_id || dashboard?.puskesmas_id || ''

  if (!ready) {
    return <div className="flex min-h-svh items-center justify-center text-theme-muted">Memuat…</div>
  }
  if (!token) return <Navigate to="/login" replace />
  if (!me) {
    return <div className="flex min-h-svh items-center justify-center text-theme-muted">Memuat sesi…</div>
  }
  if (me.role !== 'kepala_puskesmas') return <Navigate to="/login" replace />

  return (
    <RoleWorkspaceShell
      mainId="kapus-main"
      roleEyebrow="Kepala puskesmas · SiAP-PKM"
      title={dashboard?.puskesmas_nama || 'Dashboard Puskesmas'}
      subtitle="Kelola staff, pelatihan, skor kesiapsiagaan, dan notifikasi WhatsApp puskesmas Anda."
      displayName={me.display_name ?? undefined}
      username={me.username}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onLogout={handleLogout}
      extraActions={
        <Link to="/petugas" className={btnGhost}>
          <Shield className="h-4 w-4" aria-hidden />
          Ruang petugas
        </Link>
      }
    >
      {activeTab === 'dashboard' && <DashboardTab dashboard={dashboard} />}
      {activeTab === 'staff' && <StaffTab puskesmasId={puskesmasId} />}
      {activeTab === 'pelatihan' && <PelatihanTab />}
      {activeTab === 'skor' && <SkorTab />}
      {activeTab === 'notifikasi' && <NotifikasiTab puskesmasId={puskesmasId} />}
    </RoleWorkspaceShell>
  )
}
