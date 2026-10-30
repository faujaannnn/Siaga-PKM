import axios from 'axios'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Brain,
  FileText,
  Film,
  Home,
  Inbox,
  Layers,
  LayoutDashboard,
  MapPin,
  Navigation,
  Phone,
  Plus,
  Trash2,
  Upload,
  Users,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'

import {
  createAdminPage,
  createStaffUser,
  deleteAdminPage,
  deleteStaffUser,
  fetchAdminContact,
  fetchAdminHomepage,
  downloadAdminLipiExport,
  fetchAdminLipiSettings,
  fetchAdminPages,
  fetchAdminProfile,
  fetchAdminSubmissions,
  fetchAdminSubmissionDetail,
  fetchAdminUsers,
  fetchResearchSampleAccounts,
  patchSubmissionRead,
  saveAdminContact,
  saveAdminHomepage,
  saveAdminLipiSettings,
  saveAdminProfile,
  updateAdminPage,
  uploadAdminFile,
} from '../api/client'
import type { LipiSettings, ResearchSampleAccountRow } from '../api/client'
import { MapLocationPicker } from '../components/MapLocationPicker'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { AdminInboxSubmissionDetail, submissionFormTypeLabel, easeOutExpo } from '@dr-diah/siaga-frontend-core'

import { EvacSimAdminPanel } from '../components/EvacSimAdminPanel'
import { btnGhost, panelCard } from '../components/RoleWorkspaceShell'
import { EducationAdminPanel } from '../components/EducationAdminPanel'
import { HomepageBuilder } from '../components/HomepageBuilder'
import { MlVideoAdminPanel } from '../components/MlVideoAdminPanel'
import { PelatihanAdminPanel } from '../components/PelatihanAdminPanel'
import { PuskesmasAdminPanel } from '../components/PuskesmasAdminPanel'
import type {
  ContactPhotoRow,
  HomepageSection,
  ProfileMemberRow,
  PublicSubmissionRow,
  SitePageAdmin,
} from '../types'

const emptyProfMember = (): ProfileMemberRow => ({ photo_url: '', name: '', subtitle: '' })
const emptyContactPhoto = (): ContactPhotoRow => ({ url: '', caption: '' })
const emptyProfilePhoto = emptyContactPhoto

type Tab =
  | 'homepage'
  | 'profile'
  | 'contact'
  | 'education'
  | 'ml'
  | 'evakuasi'
  | 'staff'
  | 'pages'
  | 'inbox'
  | 'puskesmas'
  | 'pelatihan'

const emptyPageDraft = (): Omit<SitePageAdmin, 'id'> => ({
  slug: '',
  title: '',
  body: '',
  nav_label: '',
  sort_order: 0,
  published: true,
})

export function AdminPage() {
  const { token, me, ready, logout } = useAuth()
  const { theme } = useTheme()
  const day = theme === 'day'
  const fieldBase =
    'w-full rounded-lg border px-3 py-2.5 text-sm text-theme transition duration-200 focus:outline-none focus:ring-[3px] ' +
    (day
      ? 'border-slate-200 bg-white focus:border-health-500/50 focus:ring-cyan-500/25'
      : 'border-white/15 bg-black/30 focus:border-cyan-400/40 focus:ring-cyan-400/22')
  const field = `mt-1 ${fieldBase}`

  const [tab, setTab] = useState<Tab>('homepage')
  const [mlSubTab, setMlSubTab] = useState<'video' | 'lipi'>('video')
  const [lipiSettings, setLipiSettings] = useState<LipiSettings>({ min_videos: 0, min_pdfs: 0, enabled: true })
  const [lipiLoading, setLipiLoading] = useState(false)
  const [lipiSaving, setLipiSaving] = useState(false)
  const [lipiMsg, setLipiMsg] = useState<string | null>(null)
  const [lipiExporting, setLipiExporting] = useState(false)
  const [homeSections, setHomeSections] = useState<HomepageSection[]>([])
  const [homeErr, setHomeErr] = useState<string | null>(null)
  const [homeOk, setHomeOk] = useState<string | null>(null)
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<string | null>(null)
  const [staffList, setStaffList] = useState<{ username: string; role: string }[]>([])
  const [researchSamples, setResearchSamples] = useState<ResearchSampleAccountRow[]>([])
  const [researchSampleErr, setResearchSampleErr] = useState<string | null>(null)
  const [staffErr, setStaffErr] = useState<string | null>(null)
  const [newStaffUser, setNewStaffUser] = useState('')
  const [newStaffPass, setNewStaffPass] = useState('')

  const [sitePages, setSitePages] = useState<SitePageAdmin[]>([])
  const [pageEditing, setPageEditing] = useState<SitePageAdmin | null>(null)
  const [pageDraft, setPageDraft] = useState<Omit<SitePageAdmin, 'id'>>(emptyPageDraft())
  const [submissions, setSubmissions] = useState<PublicSubmissionRow[]>([])
  const [subDetail, setSubDetail] = useState<Record<string, unknown> | null>(null)
  const [subDetailErr, setSubDetailErr] = useState<string | null>(null)

  const [profileMembers, setProfileMembers] = useState<ProfileMemberRow[]>([emptyProfMember()])
  const [profilePhotos, setProfilePhotos] = useState<ContactPhotoRow[]>([])
  const [profileErr, setProfileErr] = useState<string | null>(null)
  const [profileOk, setProfileOk] = useState<string | null>(null)

  const [contactIntro, setContactIntro] = useState('')
  const [contactAddress, setContactAddress] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactMapsUrl, setContactMapsUrl] = useState('')
  const [contactPhotos, setContactPhotos] = useState<ContactPhotoRow[]>([emptyContactPhoto()])
  const [contactTeamLat, setContactTeamLat] = useState('')
  const [contactTeamLng, setContactTeamLng] = useState('')
  const [contactTeamLabel, setContactTeamLabel] = useState('')
  const [contactErr, setContactErr] = useState<string | null>(null)
  const [contactOk, setContactOk] = useState<string | null>(null)

  const isAdmin = me?.role === 'admin'

  const load = useCallback(async () => {
    if (!token || !isAdmin) return
    setLoadErr(null)
    try {
      const h = await fetchAdminHomepage()
      setHomeSections(Array.isArray(h.sections) ? h.sections : [])
    } catch {
      setLoadErr('Gagal memuat data. Periksa backend, MongoDB, atau login ulang.')
    }
  }, [token, isAdmin])

  useEffect(() => {
    if (ready && token && me && isAdmin) void load()
  }, [ready, token, me, isAdmin, load])

  const loadStaff = useCallback(async () => {
    if (!token || !me?.can_manage_users) return
    setStaffErr(null)
    setResearchSampleErr(null)
    try {
      const [rows, samples] = await Promise.all([fetchAdminUsers(), fetchResearchSampleAccounts()])
      setStaffList(rows)
      setResearchSamples(samples)
    } catch {
      setStaffErr('Gagal memuat daftar akun petugas.')
      setResearchSampleErr('Gagal memuat akun sampel penelitian.')
    }
  }, [token, me?.can_manage_users])

  useEffect(() => {
    if (ready && token && me?.can_manage_users && tab === 'staff') void loadStaff()
  }, [ready, token, me?.can_manage_users, tab, loadStaff])

  const loadPages = useCallback(async () => {
    if (!token || !isAdmin) return
    try {
      const rows = await fetchAdminPages()
      setSitePages(rows)
    } catch {
      setLoadErr('Gagal memuat halaman situs.')
    }
  }, [token, isAdmin])

  const loadInbox = useCallback(async () => {
    if (!token || !isAdmin) return
    try {
      const rows = await fetchAdminSubmissions()
      setSubmissions(rows.filter((s) => s.form_type !== 'kesiapsiagaan_keluarga'))
    } catch {
      setLoadErr('Gagal memuat kotak masuk.')
    }
  }, [token, isAdmin])

  useEffect(() => {
    if (ready && token && isAdmin && tab === 'pages') void loadPages()
  }, [ready, token, isAdmin, tab, loadPages])

  useEffect(() => {
    if (ready && token && isAdmin && tab === 'inbox') void loadInbox()
  }, [ready, token, isAdmin, tab, loadInbox])

  useEffect(() => {
    if (!ready || !token || !isAdmin || tab !== 'ml' || mlSubTab !== 'lipi') return
    setLipiLoading(true)
    void fetchAdminLipiSettings()
      .then((s) => setLipiSettings(s))
      .catch(() => {})
      .finally(() => setLipiLoading(false))
  }, [ready, token, isAdmin, tab, mlSubTab])

  const loadProfile = useCallback(async () => {
    if (!token || !isAdmin) return
    setProfileErr(null)
    try {
      const d = await fetchAdminProfile()
      const rows = Array.isArray(d.members) ? d.members : []
      const norm = rows.map((m) => ({
        photo_url: (m.photo_url ?? '').trim(),
        name: (m.name ?? '').trim(),
        subtitle: (m.subtitle ?? '').trim(),
      }))
      setProfileMembers(norm.length ? norm : [emptyProfMember()])
      const photoRows = Array.isArray(d.photos) ? d.photos : []
      const normPhotos = photoRows.map((p) => ({
        url: (p.url ?? '').trim(),
        caption: (p.caption ?? '').trim(),
      }))
      setProfilePhotos(normPhotos)
    } catch {
      setProfileErr('Gagal memuat pengaturan profil.')
    }
  }, [token, isAdmin])

  useEffect(() => {
    if (ready && token && isAdmin && tab === 'profile') void loadProfile()
  }, [ready, token, isAdmin, tab, loadProfile])

  const loadContact = useCallback(async () => {
    if (!token || !isAdmin) return
    setContactErr(null)
    try {
      const d = await fetchAdminContact()
      setContactIntro(d.intro ?? '')
      setContactAddress(d.address ?? '')
      setContactPhone(d.phone ?? '')
      setContactEmail(d.email ?? '')
      setContactMapsUrl(d.maps_url ?? '')
      const rows = Array.isArray(d.photos) ? d.photos : []
      const norm = rows.map((p) => ({
        url: (p.url ?? '').trim(),
        caption: (p.caption ?? '').trim(),
      }))
      setContactPhotos(norm.length ? norm : [emptyContactPhoto()])
      const tl = d.team_location
      setContactTeamLat(tl && tl.lat != null ? String(tl.lat) : '')
      setContactTeamLng(tl && tl.lng != null ? String(tl.lng) : '')
      setContactTeamLabel(tl?.label ?? '')
    } catch {
      setContactErr('Gagal memuat kontak kami.')
    }
  }, [token, isAdmin])

  useEffect(() => {
    if (ready && token && isAdmin && tab === 'contact') void loadContact()
  }, [ready, token, isAdmin, tab, loadContact])

  async function saveHomepage() {
    setHomeErr(null)
    setHomeOk(null)
    setSaving(true)
    try {
      await saveAdminHomepage(homeSections)
      setHomeOk('Beranda disimpan.')
    } catch {
      setHomeErr('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  async function saveProfileHero() {
    setProfileErr(null)
    setProfileOk(null)
    setSaving(true)
    try {
      const members = profileMembers.filter((m) => (m.photo_url ?? '').trim() || (m.name ?? '').trim())
      const photos = profilePhotos.filter((p) => (p.url ?? '').trim())
      await saveAdminProfile({ youtube_url: '', members, photos })
      setProfileOk('Halaman Profil disimpan.')
    } catch {
      setProfileErr('Gagal menyimpan profil.')
    } finally {
      setSaving(false)
    }
  }

  async function saveContactPanel() {
    setContactErr(null)
    setContactOk(null)
    setSaving(true)
    try {
      const photos = contactPhotos.filter((p) => (p.url ?? '').trim())
      const teamLoc = contactTeamLat.trim() && contactTeamLng.trim()
        ? { lat: parseFloat(contactTeamLat), lng: parseFloat(contactTeamLng), label: contactTeamLabel.trim() }
        : null
      await saveAdminContact({
        intro: contactIntro.trim(),
        address: contactAddress.trim(),
        phone: contactPhone.trim(),
        email: contactEmail.trim(),
        maps_url: contactMapsUrl.trim(),
        photos,
        team_location: teamLoc,
      })
      setContactOk('Kontak kami disimpan.')
    } catch {
      setContactErr('Gagal menyimpan kontak.')
    } finally {
      setSaving(false)
    }
  }

  async function uploadProfileMemberPhoto(index: number, file: File | null) {
    if (!file) return
    const slot = `profile-${index}`
    setUploading(slot)
    try {
      const { url } = await uploadAdminFile(file)
      setProfileMembers((prev) => prev.map((m, i) => (i === index ? { ...m, photo_url: url } : m)))
    } catch (e) {
      const detail =
        axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { detail?: unknown }).detail === 'string'
          ? (e.response.data as { detail: string }).detail
          : null
      setProfileErr(detail ?? 'Gagal mengunggah foto anggota.')
    } finally {
      setUploading(null)
    }
  }

  function moveProfileMember(index: number, delta: -1 | 1) {
    setProfileMembers((prev) => {
      const j = index + delta
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const cur = next[index]
      const sw = next[j]
      if (!cur || !sw) return prev
      next[index] = sw
      next[j] = cur
      return next
    })
  }

  async function uploadProfileGalleryPhoto(index: number, file: File | null) {
    if (!file) return
    const slot = `profile-gallery-${index}`
    setUploading(slot)
    try {
      const { url } = await uploadAdminFile(file)
      setProfilePhotos((prev) => prev.map((m, i) => (i === index ? { ...m, url } : m)))
    } catch (e) {
      const detail =
        axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { detail?: unknown }).detail === 'string'
          ? (e.response.data as { detail: string }).detail
          : null
      setProfileErr(detail ?? 'Gagal mengunggah foto galeri.')
    } finally {
      setUploading(null)
    }
  }

  function moveProfileGalleryPhoto(index: number, delta: -1 | 1) {
    setProfilePhotos((prev) => {
      const j = index + delta
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const cur = next[index]
      const sw = next[j]
      if (!cur || !sw) return prev
      next[index] = sw
      next[j] = cur
      return next
    })
  }

  async function uploadContactPhoto(index: number, file: File | null) {
    if (!file) return
    const slot = `contact-${index}`
    setUploading(slot)
    try {
      const { url } = await uploadAdminFile(file)
      setContactPhotos((prev) => prev.map((m, i) => (i === index ? { ...m, url } : m)))
    } catch (e) {
      const detail =
        axios.isAxiosError(e) && e.response?.data && typeof (e.response.data as { detail?: unknown }).detail === 'string'
          ? (e.response.data as { detail: string }).detail
          : null
      setContactErr(detail ?? 'Gagal mengunggah foto kontak.')
    } finally {
      setUploading(null)
    }
  }

  function moveContactPhoto(index: number, delta: -1 | 1) {
    setContactPhotos((prev) => {
      const j = index + delta
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      const cur = next[index]
      const sw = next[j]
      if (!cur || !sw) return prev
      next[index] = sw
      next[j] = cur
      return next
    })
  }

  function startNewPage() {
    setPageEditing(null)
    setPageDraft(emptyPageDraft())
  }

  function startEditPage(row: SitePageAdmin) {
    setPageEditing(row)
    setPageDraft({
      slug: row.slug,
      title: row.title,
      body: row.body,
      nav_label: row.nav_label,
      sort_order: row.sort_order,
      published: row.published,
    })
  }

  async function savePage() {
    if (!pageDraft.slug.trim() || !pageDraft.title.trim()) return
    setSaving(true)
    try {
      if (pageEditing) {
        const u = await updateAdminPage(pageEditing.id, {
          slug: pageDraft.slug.trim(),
          title: pageDraft.title.trim(),
          body: pageDraft.body,
          nav_label: pageDraft.nav_label?.trim() ?? '',
          sort_order: pageDraft.sort_order,
          published: pageDraft.published,
        })
        setSitePages((prev) => prev.map((x) => (x.id === u.id ? u : x)).sort((a, b) => a.sort_order - b.sort_order))
      } else {
        const c = await createAdminPage({
          slug: pageDraft.slug.trim(),
          title: pageDraft.title.trim(),
          body: pageDraft.body,
          nav_label: pageDraft.nav_label?.trim() ?? '',
          sort_order: pageDraft.sort_order,
          published: pageDraft.published,
        })
        setSitePages((prev) => [...prev, c].sort((a, b) => a.sort_order - b.sort_order))
      }
      startNewPage()
    } catch {
      setLoadErr('Gagal menyimpan halaman.')
    } finally {
      setSaving(false)
    }
  }

  async function removePage(id: string) {
    if (!confirm('Hapus halaman ini dari situs?')) return
    try {
      await deleteAdminPage(id)
      setSitePages((prev) => prev.filter((x) => x.id !== id))
      if (pageEditing?.id === id) startNewPage()
    } catch {
      setLoadErr('Gagal menghapus halaman.')
    }
  }

  async function openSubmission(id: string) {
    setSubDetail(null)
    setSubDetailErr(null)
    try {
      const d = await fetchAdminSubmissionDetail(id)
      setSubDetail(d)
    } catch {
      setSubDetailErr('Gagal memuat detail.')
    }
  }

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

  if (!isAdmin) {
    return <Navigate to={me.role === 'developer' ? '/developer' : '/petugas'} replace />
  }

  return (
    <div className="min-h-svh px-4 py-6 sm:px-5 md:py-8">
      <a className="skip-to-content" href="#admin-main">
        Lewati ke isi
      </a>
      <main className="mx-auto max-w-5xl space-y-6 outline-none" id="admin-main" tabIndex={-1}>
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
          <div className="flex flex-wrap gap-2">
            <Link to="/monitor" className={btnGhost}>
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Monitor
            </Link>
            <Link to="/petugas" className={btnGhost}>
              Materi petugas
            </Link>
            <Link to="/" className={btnGhost}>
              <Home className="h-4 w-4" aria-hidden />
              Lihat situs
            </Link>
            <button
              type="button"
              onClick={() => logout()}
              className={`${btnGhost} border-rose-200 text-rose-800 hover:bg-rose-50`}
            >
              Keluar
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: easeOutExpo, delay: 0.04 }}
          className={panelCard()}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-health-600">Panel admin · SiAP-PKM</p>
          <h1 className="mt-2 text-2xl font-bold text-theme md:text-3xl">Kelola situs &amp; konten</h1>
          <p className="mt-2 text-sm text-theme-muted">
            {me.can_manage_users ? (
              <>
                <span className={day ? 'font-medium text-cta-600' : 'font-medium text-emerald-400/95'}>Admin utama</span>
                {' '}- termasuk mengelola akun masyarakat. Log masuk:{' '}
                <span className="font-medium text-theme">{me.username}</span>
              </>
            ) : (
              <>
                Admin konten (tanpa mengelola akun petugas). Log masuk:{' '}
                <span className="font-medium text-theme">{me.username}</span>
              </>
            )}
          </p>
          <p className="mt-2 text-sm text-theme-muted">
            Beranda, edukasi, video ML, halaman situs, kotak masuk, puskesmas, dan pelatihan
            {me.can_manage_users ? ', serta akun petugas' : ''}.
          </p>
        </motion.div>

        <div className="space-y-2">
          <div className="md:hidden">
            <label htmlFor="admin-tab" className="mb-1 block text-xs font-medium text-theme-muted">
              Buka panel
            </label>
            <select
              id="admin-tab"
              className="focus-ring w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2.5 text-sm font-medium text-theme"
              value={tab}
              onChange={(e) => setTab(e.target.value as Tab)}
            >
              <option value="homepage">Beranda (konten situs)</option>
              <option value="profile">Profil (video YouTube &amp; slider tim)</option>
              <option value="contact">Kontak kami</option>
              <option value="education">Edukasi</option>
              <option value="ml">Video ML &amp; asesmen</option>
              <option value="evakuasi">Jalur evakuasi</option>
              <option value="pages">Halaman situs</option>
              <option value="inbox">Kotak masuk</option>
              <option value="puskesmas">Puskesmas</option>
              <option value="pelatihan">Pelatihan</option>
              {me.can_manage_users ? <option value="staff">Akun masyarakat</option> : null}
            </select>
          </div>
        <div className="hidden flex-wrap gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1 md:flex">
          <button
            type="button"
            onClick={() => setTab('homepage')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'homepage'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Layers className="h-4 w-4" aria-hidden />
            Beranda
          </button>
          <button
            type="button"
            onClick={() => setTab('profile')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'profile'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Film className="h-4 w-4" aria-hidden />
            Profil
          </button>
          <button
            type="button"
            onClick={() => setTab('contact')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'contact'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Phone className="h-4 w-4" aria-hidden />
            Kontak
          </button>
          <button
            type="button"
            onClick={() => setTab('education')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'education'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            Edukasi
          </button>
          <button
            type="button"
            onClick={() => setTab('ml')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'ml'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Brain className="h-4 w-4" aria-hidden />
            Video ML
          </button>
          <button
            type="button"
            onClick={() => setTab('evakuasi')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'evakuasi'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Navigation className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Jalur evakuasi</span>
            <span className="sm:hidden">Evakuasi</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pages')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'pages'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <FileText className="h-4 w-4" aria-hidden />
            Halaman
          </button>
          <button
            type="button"
            onClick={() => setTab('inbox')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'inbox'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Inbox className="h-4 w-4" aria-hidden />
            Kotak masuk
          </button>
          <button
            type="button"
            onClick={() => setTab('puskesmas')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'puskesmas'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Layers className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Puskesmas</span>
            <span className="sm:hidden">PKM</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('pelatihan')}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
              tab === 'pelatihan'
                ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                : 'text-theme-muted hover:text-theme'
            }`}
          >
            <Brain className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Pelatihan</span>
            <span className="sm:hidden">Latih</span>
          </button>
          {me.can_manage_users ? (
            <button
              type="button"
              onClick={() => setTab('staff')}
              className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-ring sm:flex-none sm:px-4 ${
                tab === 'staff'
                  ? 'bg-merah/15 text-theme ring-1 ring-merah/25'
                  : 'text-theme-muted hover:text-theme'
              }`}
            >
              <Users className="h-4 w-4" aria-hidden />
              Akun masyarakat
            </button>
          ) : null}
        </div>
        </div>

        {loadErr ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-theme">
            {loadErr}
          </p>
        ) : null}

        {tab === 'staff' && me.can_manage_users ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            <div className="glass-panel space-y-3 border border-[var(--panel-border)] p-5 md:p-6">
              <h2 className="font-semibold text-theme">Tambah masyarakat</h2>
              <p className="text-sm text-theme-muted">
                Akun masyarakat dapat login, membaca bacaan tambahan di ruang masyarakat, menonton Video ML (tab Video ML
                &amp; asesmen), dan melihat ringkasan pemahaman asesmen di tab Profil.
              </p>
              <label className="block text-xs text-theme-muted">Username baru</label>
              <input
                value={newStaffUser}
                onChange={(e) => setNewStaffUser(e.target.value)}
                className={field}
                autoComplete="off"
              />
              <label className="block text-xs text-theme-muted">Password (min. 6 karakter)</label>
              <input
                type="password"
                value={newStaffPass}
                onChange={(e) => setNewStaffPass(e.target.value)}
                className={field}
                autoComplete="new-password"
              />
              {staffErr ? (
                <p className={`text-sm ${day ? 'text-merah' : 'text-merah-bright'}`}>{staffErr}</p>
              ) : null}
              <button
                type="button"
                disabled={
                  saving ||
                  !newStaffUser.trim() ||
                  newStaffPass.trim().length < 6
                }
                onClick={() => {
                  void (async () => {
                    setSaving(true)
                    setStaffErr(null)
                    try {
                      const row = await createStaffUser({
                        username: newStaffUser.trim(),
                        password: newStaffPass.trim(),
                      })
                      setStaffList((prev) =>
                        [...prev, row].sort((a, b) => a.username.localeCompare(b.username)),
                      )
                      setNewStaffUser('')
                      setNewStaffPass('')
                    } catch {
                      setStaffErr('Gagal menambah (username mungkin sudah dipakai).')
                    } finally {
                      setSaving(false)
                    }
                  })()
                }}
                className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-merah to-merah-bright py-2.5 text-sm font-semibold text-white transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
              >
                Tambah masyarakat
              </button>
            </div>
            <div className="glass-panel border border-[var(--panel-border)] p-5 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-theme">Daftar akun ({staffList.length})</h2>
                <button
                  type="button"
                  onClick={() => void loadStaff()}
                  className={`rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  Muat ulang
                </button>
              </div>
              <ul className="mt-4 space-y-2">
                {staffList.map((row) => (
                  <li
                    key={row.username}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 border-[var(--panel-border)] ${day ? 'bg-zinc-50/80' : 'bg-black/25'}`}
                  >
                    <div>
                      <p className="text-sm font-medium text-theme">{row.username}</p>
                      <p className="text-xs text-theme-soft">{row.role}</p>
                    </div>
                    {row.username !== me.username ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm(`Hapus akun ${row.username}?`)) return
                          void (async () => {
                            try {
                              await deleteStaffUser(row.username)
                              setStaffList((prev) => prev.filter((x) => x.username !== row.username))
                            } catch {
                              setStaffErr('Gagal menghapus akun.')
                            }
                          })()
                        }}
                        className="rounded-lg border border-merah/30 px-2 py-1 text-xs text-merah-bright/80 hover:bg-merah/[0.1] focus-ring"
                      >
                        Hapus
                      </button>
                    ) : (
                      <span className="text-xs text-theme-muted">Akun Anda</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass-panel border border-[var(--panel-border)] p-5 md:p-6 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-theme">Akun sampel penelitian ({researchSamples.length})</h2>
                  <p className="mt-1 text-sm text-theme-muted">
                    30 akun petugas untuk penelitian: 10 Talise, 10 Kab. Donggala, 10 Kab. Sigi. Peserta login
                    pertama kali mengisi nama sendiri; username tetap.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadStaff()}
                  className={`rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  Muat ulang
                </button>
              </div>
              {researchSampleErr ? (
                <p className={`mt-3 text-sm ${day ? 'text-merah' : 'text-merah-bright'}`}>{researchSampleErr}</p>
              ) : null}
              <div className="mt-4 overflow-x-auto rounded-xl border border-[var(--panel-border)]">
                <table className="w-full min-w-[36rem] text-left text-sm">
                  <thead className={`text-xs uppercase tracking-wide text-theme-muted ${day ? 'bg-zinc-100/90' : 'bg-black/30'}`}>
                    <tr>
                      <th className="px-3 py-2.5 font-semibold">No</th>
                      <th className="px-3 py-2.5 font-semibold">Username</th>
                      <th className="px-3 py-2.5 font-semibold">Password awal</th>
                      <th className="px-3 py-2.5 font-semibold">Wilayah</th>
                      <th className="px-3 py-2.5 font-semibold">Nama (isi peserta)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {researchSamples.map((row) => (
                      <tr
                        key={row.username}
                        className={`border-t border-[var(--panel-border)] ${day ? 'hover:bg-zinc-50/80' : 'hover:bg-white/5'}`}
                      >
                        <td className="px-3 py-2 tabular-nums text-theme-muted">{row.sort_order}</td>
                        <td className="px-3 py-2 font-medium text-theme">{row.username}</td>
                        <td className="px-3 py-2 font-mono text-xs text-theme">{row.password_plain}</td>
                        <td className="px-3 py-2 text-theme-muted">{row.wilayah}</td>
                        <td className="px-3 py-2 text-theme">{row.display_name?.trim() || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        ) : null}

        {tab === 'homepage' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-[var(--panel-border)] p-5 md:p-6"
          >
            <HomepageBuilder
              sections={homeSections}
              onChange={setHomeSections}
              onSave={() => void saveHomepage()}
              saving={saving}
              day={day}
              fieldClass={field}
              homeErr={homeErr}
              homeOk={homeOk}
            />
          </motion.div>
        ) : tab === 'profile' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-[var(--panel-border)] p-5 md:p-6"
          >
            <h2 className="font-semibold text-theme">Halaman Profil publik</h2>
            <p className="mt-2 text-sm text-theme-muted">
              Atur slider anggota (coverflow) dan galeri foto di halaman{' '}
              <code className="text-xs">/profil</code>. Urutan foto = urutan tampil di situs.
            </p>

            <div className="mt-6 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-theme">Slide anggota</h3>
                <button
                  type="button"
                  onClick={() => setProfileMembers((prev) => [...prev, emptyProfMember()])}
                  className={`inline-flex items-center gap-1 rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Tambah
                </button>
              </div>

              {profileMembers.map((m, idx) => (
                <div
                  key={`pm-${idx}`}
                  className={`space-y-2 rounded-xl border border-[var(--panel-border)] p-4 ${day ? 'bg-zinc-50/60' : 'bg-black/20'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-theme-muted">Anggota #{idx + 1}</span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveProfileMember(idx, -1)}
                        className="rounded-lg border border-[var(--panel-border)] p-1.5 text-theme-muted hover:text-theme disabled:opacity-40 focus-ring"
                        aria-label="Naikkan urutan"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx >= profileMembers.length - 1}
                        onClick={() => moveProfileMember(idx, 1)}
                        className="rounded-lg border border-[var(--panel-border)] p-1.5 text-theme-muted hover:text-theme disabled:opacity-40 focus-ring"
                        aria-label="Turunkan urutan"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileMembers((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-lg border border-merah/30 p-1.5 text-merah-bright/80 hover:bg-merah/[0.1] focus-ring"
                        aria-label="Hapus anggota"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {m.photo_url ? (
                    <div className="overflow-hidden rounded-lg border border-[var(--panel-border)] bg-black/10">
                      <img src={m.photo_url} alt="" className="max-h-40 w-full object-cover" />
                    </div>
                  ) : null}
                  <label className="block text-[11px] text-theme-muted">URL foto atau unggah</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={m.photo_url}
                      onChange={(e) =>
                        setProfileMembers((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, photo_url: e.target.value } : row)),
                        )
                      }
                      className={`${fieldBase} flex-1 min-w-[160px]`}
                      placeholder="/api/uploads/…"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs text-theme focus-ring hover:brightness-[1.02]">
                      <Upload className="h-4 w-4 shrink-0" aria-hidden />
                      {uploading === `profile-${idx}` ? 'Mengunggah…' : 'Unggah'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={(ev) =>
                          void uploadProfileMemberPhoto(idx, ev.target.files?.[0] ?? null).finally(() => {
                            ev.target.value = ''
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="block text-[11px] text-theme-muted">Nama</label>
                  <input
                    value={m.name}
                    onChange={(e) =>
                      setProfileMembers((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row)),
                      )
                    }
                    className={fieldBase}
                  />
                  <label className="block text-[11px] text-theme-muted">Jabatan / keterangan singkat</label>
                  <input
                    value={m.subtitle}
                    onChange={(e) =>
                      setProfileMembers((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, subtitle: e.target.value } : row)),
                      )
                    }
                    className={fieldBase}
                  />
                </div>
              ))}
            </div>

            <div className="mt-10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-medium text-theme">Galeri foto profil</h3>
                  <p className="mt-0.5 text-xs text-theme-muted">
                    Grid foto di bawah slider tim. Gunakan panah untuk mengubah urutan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfilePhotos((prev) => [...prev, emptyProfilePhoto()])}
                  className={`inline-flex items-center gap-1 rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Tambah foto
                </button>
              </div>

              {profilePhotos.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--panel-border)] px-4 py-6 text-center text-sm text-theme-muted">
                  Belum ada foto galeri. Klik &quot;Tambah foto&quot; lalu unggah atau tempel URL.
                </p>
              ) : null}

              {profilePhotos.map((m, idx) => (
                <div
                  key={`pg-${idx}`}
                  className={`space-y-2 rounded-xl border border-[var(--panel-border)] p-4 ${day ? 'bg-zinc-50/60' : 'bg-black/20'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-theme-muted">Foto #{idx + 1}</span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveProfileGalleryPhoto(idx, -1)}
                        className="rounded-lg border border-[var(--panel-border)] p-1.5 text-theme-muted hover:text-theme disabled:opacity-40 focus-ring"
                        aria-label="Naikkan urutan"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx >= profilePhotos.length - 1}
                        onClick={() => moveProfileGalleryPhoto(idx, 1)}
                        className="rounded-lg border border-[var(--panel-border)] p-1.5 text-theme-muted hover:text-theme disabled:opacity-40 focus-ring"
                        aria-label="Turunkan urutan"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfilePhotos((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded-lg border border-merah/30 p-1.5 text-merah-bright/80 hover:bg-merah/[0.1] focus-ring"
                        aria-label="Hapus foto"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {m.url ? (
                    <div className="overflow-hidden rounded-lg border border-[var(--panel-border)] bg-black/10">
                      <img src={m.url} alt="" className="max-h-40 w-full object-cover" />
                    </div>
                  ) : null}
                  <label className="block text-[11px] text-theme-muted">URL gambar atau unggah</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={m.url}
                      onChange={(e) =>
                        setProfilePhotos((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, url: e.target.value } : row)),
                        )
                      }
                      className={`${fieldBase} min-w-[160px] flex-1`}
                      placeholder="/api/uploads/…"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs text-theme focus-ring hover:brightness-[1.02]">
                      <Upload className="h-4 w-4 shrink-0" aria-hidden />
                      {uploading === `profile-gallery-${idx}` ? 'Mengunggah…' : 'Unggah'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={(ev) =>
                          void uploadProfileGalleryPhoto(idx, ev.target.files?.[0] ?? null).finally(() => {
                            ev.target.value = ''
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="block text-[11px] text-theme-muted">Keterangan (opsional)</label>
                  <input
                    value={m.caption}
                    onChange={(e) =>
                      setProfilePhotos((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, caption: e.target.value } : row)),
                      )
                    }
                    className={fieldBase}
                  />
                </div>
              ))}
            </div>

            {profileErr ? (
              <p className={`mt-4 text-sm ${day ? 'text-merah' : 'text-merah-bright'}`}>{profileErr}</p>
            ) : null}
            {profileOk ? <p className="mt-4 text-sm text-emerald-500 dark:text-emerald-300">{profileOk}</p> : null}

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveProfileHero()}
              className="mt-6 w-full cursor-pointer rounded-xl bg-gradient-to-r from-merah to-merah-bright py-2.5 text-sm font-semibold text-white transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
            >
              Simpan profil
            </button>
          </motion.div>
        ) : tab === 'contact' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-[var(--panel-border)] p-5 md:p-6"
          >
            <h2 className="font-semibold text-theme">Kontak kami</h2>
            <p className="mt-2 text-sm text-theme-muted">
              Tampil di halaman <code className="text-xs">/profil</code> dan <code className="text-xs">/kontak</code>.
              Unggah foto gedung, peta lokasi, atau kegiatan - galeri menyesuaikan lebar layar.
            </p>

            <label htmlFor="contact-intro" className="mt-6 block text-xs font-semibold text-theme">
              Pengantar singkat (opsional)
            </label>
            <textarea
              id="contact-intro"
              value={contactIntro}
              onChange={(e) => setContactIntro(e.target.value)}
              rows={4}
              className={field}
              placeholder="Jam layanan, informasi umum…"
            />

            <label htmlFor="contact-address" className="mt-4 block text-xs font-medium text-theme-muted">
              Alamat
            </label>
            <textarea
              id="contact-address"
              value={contactAddress}
              onChange={(e) => setContactAddress(e.target.value)}
              rows={3}
              className={field}
            />

            <label htmlFor="contact-phone" className="mt-4 block text-xs font-medium text-theme-muted">
              Telepon
            </label>
            <input
              id="contact-phone"
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={field}
              autoComplete="tel"
            />

            <label htmlFor="contact-email" className="mt-4 block text-xs font-medium text-theme-muted">
              Email
            </label>
            <input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={field}
              autoComplete="email"
            />

            <label htmlFor="contact-maps" className="mt-4 block text-xs font-medium text-theme-muted">
              Tautan peta (mis. Google Maps)
            </label>
            <input
              id="contact-maps"
              type="url"
              value={contactMapsUrl}
              onChange={(e) => setContactMapsUrl(e.target.value)}
              className={field}
              placeholder="https://maps.google.com/…"
              autoComplete="off"
            />

            <div className="mt-6 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-5 w-5 text-health-600" aria-hidden />
                  <h3 className="font-semibold text-theme">Lokasi Tim</h3>
                </div>
                <p className="text-xs text-theme-muted">
                  Klik di peta untuk memilih lokasi kantor/posko. Koordinat akan terisi otomatis.
                </p>
              </div>
              <MapLocationPicker
                lat={contactTeamLat}
                lng={contactTeamLng}
                label={contactTeamLabel}
                onLatChange={setContactTeamLat}
                onLngChange={setContactTeamLng}
                onLabelChange={setContactTeamLabel}
              />
            </div>

            <div className="mt-8 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium text-theme">Galeri foto</h3>
                <button
                  type="button"
                  onClick={() => setContactPhotos((prev) => [...prev, emptyContactPhoto()])}
                  className={`inline-flex items-center gap-1 rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Tambah foto
                </button>
              </div>

              {contactPhotos.map((m, idx) => (
                <div
                  key={`cf-${idx}`}
                  className={`space-y-2 rounded-xl border border-[var(--panel-border)] p-4 ${day ? 'bg-zinc-50/60' : 'bg-black/20'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-theme-muted">Foto #{idx + 1}</span>
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => moveContactPhoto(idx, -1)}
                        className="rounded-lg border border-[var(--panel-border)] p-1.5 text-theme-muted hover:text-theme disabled:opacity-40 focus-ring"
                        aria-label="Naikkan urutan"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={idx >= contactPhotos.length - 1}
                        onClick={() => moveContactPhoto(idx, 1)}
                        className="rounded-lg border border-[var(--panel-border)] p-1.5 text-theme-muted hover:text-theme disabled:opacity-40 focus-ring"
                        aria-label="Turunkan urutan"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setContactPhotos((prev) =>
                            prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx),
                          )
                        }
                        className="rounded-lg border border-merah/30 p-1.5 text-merah-bright/80 hover:bg-merah/[0.1] focus-ring"
                        aria-label="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  {m.url ? (
                    <div className="overflow-hidden rounded-lg border border-[var(--panel-border)] bg-black/10">
                      <img src={m.url} alt="" className="max-h-40 w-full object-cover" />
                    </div>
                  ) : null}
                  <label className="block text-[11px] text-theme-muted">URL gambar atau unggah</label>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={m.url}
                      onChange={(e) =>
                        setContactPhotos((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, url: e.target.value } : row)),
                        )
                      }
                      className={`${fieldBase} flex-1 min-w-[160px]`}
                      placeholder="/api/uploads/…"
                    />
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs text-theme focus-ring hover:brightness-[1.02]">
                      <Upload className="h-4 w-4 shrink-0" aria-hidden />
                      {uploading === `contact-${idx}` ? 'Mengunggah…' : 'Unggah'}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        className="sr-only"
                        onChange={(ev) =>
                          void uploadContactPhoto(idx, ev.target.files?.[0] ?? null).finally(() => {
                            ev.target.value = ''
                          })
                        }
                      />
                    </label>
                  </div>
                  <label className="block text-[11px] text-theme-muted">Keterangan (opsional)</label>
                  <input
                    value={m.caption}
                    onChange={(e) =>
                      setContactPhotos((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, caption: e.target.value } : row)),
                      )
                    }
                    className={fieldBase}
                  />
                </div>
              ))}
            </div>

            {contactErr ? (
              <p className={`mt-4 text-sm ${day ? 'text-merah' : 'text-merah-bright'}`}>{contactErr}</p>
            ) : null}
            {contactOk ? <p className="mt-4 text-sm text-emerald-500 dark:text-emerald-300">{contactOk}</p> : null}

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveContactPanel()}
              className="mt-6 w-full cursor-pointer rounded-xl bg-gradient-to-r from-merah to-merah-bright py-2.5 text-sm font-semibold text-white transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
            >
              Simpan kontak
            </button>
          </motion.div>
        ) : tab === 'ml' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMlSubTab('video')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-ring ${
                  mlSubTab === 'video'
                    ? 'bg-merah text-white shadow-sm'
                    : 'border border-[var(--panel-border)] text-theme-muted hover:bg-[var(--panel-bg)]'
                }`}
              >
                Video ML (YouTube)
              </button>
              <button
                type="button"
                onClick={() => setMlSubTab('lipi')}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition focus-ring ${
                  mlSubTab === 'lipi'
                    ? 'bg-merah text-white shadow-sm'
                    : 'border border-[var(--panel-border)] text-theme-muted hover:bg-[var(--panel-bg)]'
                }`}
              >
                Kuis LIPI
              </button>
            </div>
            {mlSubTab === 'video' ? (
              <MlVideoAdminPanel field={field} day={day} />
            ) : (
              <div className="glass-panel space-y-5 border border-[var(--panel-border)] p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-health-600">Kuesioner Gempa</p>
                  <h2 className="mt-1 text-base font-bold text-theme">Pengaturan Kuesioner Staf</h2>
                  <p className="mt-1 text-xs text-theme-muted">
                    Aktifkan atau nonaktifkan kuesioner kesiapsiagaan gempa untuk staf puskesmas.
                  </p>
                </div>
                {lipiLoading ? (
                  <p className="text-sm text-theme-muted">Memuat pengaturan…</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-medium text-theme-muted">
                        Aktifkan Kuesioner Gempa
                      </label>
                      <div className="mt-1.5 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setLipiSettings((s) => ({ ...s, enabled: !s.enabled }))}
                          className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition duration-200 focus-ring ${lipiSettings.enabled ? 'bg-health-500' : 'bg-slate-300'}`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${lipiSettings.enabled ? 'translate-x-6' : 'translate-x-1'}`}
                          />
                        </button>
                        <span className="text-sm text-theme">
                          {lipiSettings.enabled ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </div>
                    </div>
                    {lipiMsg ? (
                      <p
                        className={`rounded-lg px-3 py-2 text-sm ${
                          lipiMsg.startsWith('❌')
                            ? 'bg-merah/[0.05] text-merah'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {lipiMsg}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={lipiSaving}
                        onClick={async () => {
                          setLipiSaving(true)
                          setLipiMsg(null)
                          try {
                            await saveAdminLipiSettings(lipiSettings)
                            setLipiMsg('✅ Pengaturan Kuis LIPI berhasil disimpan.')
                          } catch {
                            setLipiMsg('❌ Gagal menyimpan. Coba lagi.')
                          } finally {
                            setLipiSaving(false)
                          }
                        }}
                        className="rounded-xl bg-health-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition duration-200 hover:bg-health-700 focus-ring disabled:opacity-50"
                      >
                        {lipiSaving ? 'Menyimpan…' : 'Simpan Pengaturan'}
                      </button>
                      <button
                        type="button"
                        disabled={lipiExporting}
                        onClick={async () => {
                          setLipiExporting(true)
                          setLipiMsg(null)
                          try {
                            await downloadAdminLipiExport()
                            setLipiMsg('✅ File Excel kuesioner berhasil diunduh.')
                          } catch {
                            setLipiMsg('❌ Gagal mengunduh Excel kuesioner.')
                          } finally {
                            setLipiExporting(false)
                          }
                        }}
                        className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] px-5 py-2.5 text-sm font-semibold text-theme shadow-sm transition duration-200 hover:bg-[var(--panel-bg-hover)] focus-ring disabled:opacity-50"
                      >
                        {lipiExporting ? 'Mengekspor…' : 'Ekspor Excel Kuesioner'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : tab === 'evakuasi' ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <EvacSimAdminPanel fieldClassName={fieldBase} />
          </motion.div>
        ) : tab === 'education' ? (
          <EducationAdminPanel field={field} day={day} />
        ) : tab === 'pages' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 lg:grid-cols-5"
          >
            <div className="glass-panel space-y-3 border border-[var(--panel-border)] p-5 lg:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-theme">{pageEditing ? 'Edit halaman' : 'Halaman baru'}</h2>
                <button
                  type="button"
                  onClick={startNewPage}
                  className={`inline-flex items-center gap-1 rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Baru
                </button>
              </div>
              <label className="block text-xs text-theme-muted">Slug URL (mis. visi-misi)</label>
              <input
                value={pageDraft.slug}
                onChange={(e) => setPageDraft((d) => ({ ...d, slug: e.target.value }))}
                className={field}
                placeholder="visi-misi"
              />
              <label className="block text-xs text-theme-muted">Judul</label>
              <input
                value={pageDraft.title}
                onChange={(e) => setPageDraft((d) => ({ ...d, title: e.target.value }))}
                className={field}
              />
              <label className="block text-xs text-theme-muted">Label menu (opsional)</label>
              <input
                value={pageDraft.nav_label}
                onChange={(e) => setPageDraft((d) => ({ ...d, nav_label: e.target.value }))}
                className={field}
              />
              <label className="block text-xs text-theme-muted">Isi (teks biasa / paragraf)</label>
              <textarea
                value={pageDraft.body}
                onChange={(e) => setPageDraft((d) => ({ ...d, body: e.target.value }))}
                rows={10}
                className={field}
              />
              <label className="block text-xs text-theme-muted">Urutan</label>
              <input
                type="number"
                value={pageDraft.sort_order}
                onChange={(e) =>
                  setPageDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))
                }
                className={field}
              />
              <label className="flex items-center gap-2 text-sm text-theme-muted">
                <input
                  type="checkbox"
                  checked={pageDraft.published}
                  onChange={(e) => setPageDraft((d) => ({ ...d, published: e.target.checked }))}
                  className="rounded border-[var(--panel-border)]"
                />
                Publikasikan
              </label>
              <button
                type="button"
                disabled={saving || !pageDraft.slug.trim() || !pageDraft.title.trim()}
                onClick={() => void savePage()}
                className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-merah to-merah-bright py-2.5 text-sm font-semibold text-white transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
              >
                {pageEditing ? 'Perbarui halaman' : 'Tambah halaman'}
              </button>
            </div>
            <div className="glass-panel border border-[var(--panel-border)] p-5 lg:col-span-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-theme">Daftar halaman ({sitePages.length})</h2>
                <button
                  type="button"
                  onClick={() => void loadPages()}
                  className={`rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  Muat ulang
                </button>
              </div>
              <ul className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {sitePages.map((row) => (
                  <li
                    key={row.id}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 border-[var(--panel-border)] ${day ? 'bg-zinc-50/80' : 'bg-black/25'}`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-theme">{row.title}</p>
                      <p className="text-xs text-theme-soft">
                        /halaman/{row.slug} · urut {row.sort_order} · {row.published ? 'publik' : 'draf'}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEditPage(row)}
                        className={`rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void removePage(row.id)}
                        className="rounded-lg border border-merah/30 p-1.5 text-merah-bright/80 hover:bg-merah/[0.1] focus-ring"
                        aria-label="Hapus"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        ) : tab === 'inbox' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-6 lg:grid-cols-2"
          >
            <div className="glass-panel border border-[var(--panel-border)] p-5 md:p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-theme">Laporan & masukan ({submissions.length})</h2>
                <button
                  type="button"
                  onClick={() => void loadInbox()}
                  className={`rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${day ? 'hover:bg-black/5' : 'hover:bg-white/10'}`}
                >
                  Muat ulang
                </button>
              </div>
              <ul className="mt-4 max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                {submissions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => void openSubmission(s.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition border-[var(--panel-border)] ${day ? 'bg-zinc-50/80 hover:bg-zinc-100' : 'bg-black/25 hover:bg-black/40'} focus-ring`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-merah-bright">
                          {submissionFormTypeLabel(s.form_type)}
                        </span>
                        {!s.read ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/70 dark:text-sky-200">
                            Baru
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-theme-soft">{s.preview}</p>
                      <p className="mt-1 text-[10px] text-theme-muted">{s.created_at}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass-panel border border-[var(--panel-border)] p-5 md:p-6">
              <h2 className="font-semibold text-theme">Detail</h2>
              {subDetailErr ? (
                <p className="mt-3 text-sm text-merah-bright">{subDetailErr}</p>
              ) : null}
              {subDetail ? (
                <div className="mt-4 max-h-[min(70vh,720px)] space-y-4 overflow-y-auto pr-1">
                  <AdminInboxSubmissionDetail detail={subDetail} />
                  <button
                    type="button"
                    onClick={() => {
                      const id = String(subDetail._id ?? '')
                      if (!id) return
                      void (async () => {
                        try {
                          await patchSubmissionRead(id, true)
                          setSubmissions((prev) =>
                            prev.map((x) => (x.id === id ? { ...x, read: true } : x)),
                          )
                          setSubDetail((d) => (d ? { ...d, read: true } : d))
                        } catch {
                          setLoadErr('Gagal menandai sudah dibaca.')
                        }
                      })()
                    }}
                    className="rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm text-theme-muted focus-ring hover:bg-white/5"
                  >
                    Tandai sudah dibaca
                  </button>
                </div>
              ) : (
                <p className="mt-4 text-sm text-theme-muted">Pilih satu entri di kiri.</p>
              )}
            </div>
          </motion.div>
        ) : tab === 'puskesmas' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-[var(--panel-border)] p-5 md:p-7"
          >
            <PuskesmasAdminPanel />
          </motion.div>
        ) : tab === 'pelatihan' ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-[var(--panel-border)] p-5 md:p-7"
          >
            <PelatihanAdminPanel />
          </motion.div>
        ) : null}
      </main>
    </div>
  )
}
