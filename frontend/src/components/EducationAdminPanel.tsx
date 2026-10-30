import { BookOpen, Plus, Trash2, Upload } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

import {
  createEducationItem,
  deleteEducationItem,
  fetchAdminEducation,
  updateEducationItem,
  uploadAdminFile,
} from '../api/client'
import type { EducationCategory, EducationItemAdmin, EducationKind } from '../types'
import {
  EDUCATION_CATEGORY_IDS,
  EDUCATION_CATEGORY_LABELS,
  educationKindForCategory,
  parseYoutubeId,
  youtubeEmbedUrl,
} from '@dr-diah/siaga-frontend-core'

const emptyDraft = (): Omit<EducationItemAdmin, 'id'> => ({
  kind: 'pdf',
  title: '',
  description: '',
  url: '',
  thumbnail_url: '',
  cover_url: '',
  body: '',
  attachments: [],
  audience: 'staff',
  category: 'peraturan',
  subcategory: '',
  sort_order: 0,
  published: true,
})

function applyCategory(category: EducationCategory): Pick<EducationItemAdmin, 'category' | 'kind'> {
  return { category, kind: educationKindForCategory(category) }
}

type Props = {
  field: string
  day: boolean
}

export function EducationAdminPanel({ field, day }: Props) {
  const [items, setItems] = useState<EducationItemAdmin[]>([])
  const [editing, setEditing] = useState<EducationItemAdmin | null>(null)
  const [draft, setDraft] = useState<Omit<EducationItemAdmin, 'id'>>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const rows = await fetchAdminEducation()
      setItems(
        rows.sort((a, b) => a.sort_order - b.sort_order),
      )
    } catch {
      setErr('Gagal memuat materi edukasi.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const previewYoutubeId = draft.kind === 'video' ? parseYoutubeId(draft.url) : null

  function startNew() {
    setEditing(null)
    setDraft(emptyDraft())
    setErr(null)
  }

  function startEdit(row: EducationItemAdmin) {
    const category = (EDUCATION_CATEGORY_IDS.includes(row.category as EducationCategory)
      ? row.category
      : 'peraturan') as EducationCategory
    const kind = educationKindForCategory(category)
    setEditing(row)
    setDraft({
      kind,
      title: row.title,
      description: row.description ?? '',
      url: row.url,
      thumbnail_url: row.thumbnail_url ?? '',
      cover_url: row.cover_url ?? '',
      body: row.body ?? '',
      attachments: row.attachments ?? [],
      audience: 'staff',
      category,
      subcategory: '',
      sort_order: row.sort_order,
      published: row.published,
    })
    setErr(null)
  }

  function canSave(): boolean {
    if (!draft.title.trim()) return false
    if (draft.kind === 'video') return Boolean(parseYoutubeId(draft.url))
    if (draft.kind === 'artikel') return Boolean(draft.body?.trim())
    return Boolean(draft.url?.trim())
  }

  async function pickThumbnail(file: File | null) {
    if (!file) return
    setUploading(true)
    setErr(null)
    try {
      const { url } = await uploadAdminFile(file)
      setDraft((d) => ({ ...d, thumbnail_url: url }))
    } catch {
      setErr('Gagal mengunggah berkas.')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    if (!canSave()) return
    setSaving(true)
    setErr(null)
    try {
      const kind: EducationKind = educationKindForCategory(draft.category ?? 'peraturan')
      const payload = {
        kind,
        title: draft.title.trim(),
        description: '',
        url: draft.url?.trim() ?? '',
        thumbnail_url: kind === 'video' ? (draft.thumbnail_url ?? '').trim() : '',
        cover_url: editing?.cover_url ?? '',
        body: draft.body?.trim() ?? '',
        attachments: editing?.attachments ?? [],
        audience: 'staff' as const,
        category: draft.category ?? 'peraturan',
        subcategory: '',
        sort_order: draft.sort_order,
        published: draft.published,
      }
      if (editing) {
        const u = await updateEducationItem(editing.id, payload)
        setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)).sort((a, b) => a.sort_order - b.sort_order))
      } else {
        const c = await createEducationItem(payload)
        setItems((prev) => [...prev, c].sort((a, b) => a.sort_order - b.sort_order))
      }
      startNew()
    } catch {
      setErr('Gagal menyimpan item.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Hapus item ini?')) return
    try {
      await deleteEducationItem(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
      if (editing?.id === id) startNew()
    } catch {
      setErr('Gagal menghapus.')
    }
  }

  function categoryLabel(cat: string | undefined): string {
    if (cat && cat in EDUCATION_CATEGORY_LABELS) {
      return EDUCATION_CATEGORY_LABELS[cat as EducationCategory]
    }
    return cat || 'peraturan'
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="glass-panel border border-[var(--panel-border)] p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-health-600">Bahan Bacaan</p>
        <h2 className="mt-1 text-base font-bold text-theme">Materi di ruang masyarakat</h2>
        <p className="mt-1 text-sm text-theme-muted">
          Kategori: <strong className="text-theme">Peraturan</strong>, <strong className="text-theme">Buku</strong>,{' '}
          <strong className="text-theme">Artikel</strong>, <strong className="text-theme">Video</strong>, dan lainnya.
          Buku, artikel, peraturan, PPT, SOP memakai format PDF Google Drive (1 tautan + sampul). Video memakai YouTube.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="glass-panel space-y-3 border border-[var(--panel-border)] p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-theme">{editing ? 'Edit materi' : 'Materi baru'}</h2>
            <button
              type="button"
              onClick={startNew}
              className={`inline-flex items-center gap-1 rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${
                day ? 'hover:bg-black/5' : 'hover:bg-white/10'
              }`}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Baru
            </button>
          </div>

          {err ? <p className="text-sm text-merah-bright">{err}</p> : null}

          <label className="block text-xs text-theme-muted">Kategori</label>
          <select
            value={draft.category ?? 'peraturan'}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                ...applyCategory(e.target.value as EducationCategory),
                url: '',
                thumbnail_url: '',
              }))
            }
            className={field}
          >
            {EDUCATION_CATEGORY_IDS.map((value) => (
              <option key={value} value={value}>
                {EDUCATION_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>

          <p className="text-[11px] leading-snug text-theme-soft">
            Format:{' '}
            <span className="font-medium text-theme">
              {draft.kind === 'video'
                ? 'Video YouTube'
                : draft.category === 'artikel'
                  ? 'Artikel PDF (Google Drive)'
                  : 'Buku / PDF (Google Drive)'}
            </span>
          </p>

          <label className="block text-xs text-theme-muted">Judul</label>
          <input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            className={field}
          />

          {draft.kind === 'video' ? (
            <>
              <label className="block text-xs text-theme-muted">URL / ID YouTube</label>
              <input
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                className={field}
                placeholder="https://www.youtube.com/watch?v=… atau https://youtu.be/…"
              />
              {!previewYoutubeId && draft.url.trim() ? (
                <p className="text-xs text-amber-700 dark:text-amber-300">URL YouTube tidak dikenali. Periksa tautannya.</p>
              ) : null}
              {previewYoutubeId ? (
                <div className="space-y-1">
                  <p className="text-xs text-theme-muted">Pratinjau</p>
                  <div className="aspect-video w-full overflow-hidden rounded-lg border border-[var(--panel-border)]">
                    <iframe
                      className="h-full w-full"
                      title="Pratinjau video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      src={youtubeEmbedUrl(previewYoutubeId)}
                    />
                  </div>
                </div>
              ) : null}
              <label className="block text-xs text-theme-muted">Thumbnail kustom (opsional)</label>
              <input
                value={draft.thumbnail_url}
                onChange={(e) => setDraft((d) => ({ ...d, thumbnail_url: e.target.value }))}
                className={field}
                placeholder="Kosongkan - thumbnail YouTube otomatis"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-xs font-medium text-theme-muted">
                <Upload className="h-3.5 w-3.5" aria-hidden />
                {uploading ? 'Mengunggah…' : 'Unggah thumbnail'}
                <input
                  type="file"
                  className="sr-only"
                  accept=".png,.jpg,.jpeg,.webp,.gif"
                  onChange={(e) => void pickThumbnail(e.target.files?.[0] ?? null)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="block text-xs text-theme-muted">
                {draft.category === 'artikel' ? 'Tautan Google Drive (artikel PDF)' : 'Tautan Google Drive (buku / PDF)'}
              </label>
              <input
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                className={field}
                placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
              />
              <p className="text-[11px] leading-snug text-theme-soft">
                Set berbagi ke <span className="font-medium">Siapa saja dengan tautan</span>, lalu tempel URL atau ID berkas.
                Sampul otomatis dari Drive.
              </p>
            </>
          )}

          <label className="block text-xs text-theme-muted">Urutan</label>
          <input
            type="number"
            value={draft.sort_order}
            onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
            className={field}
          />

          <label className="flex items-center gap-2 text-sm text-theme-muted">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))}
              className="rounded border-[var(--panel-border)]"
            />
            Tampil untuk pengguna
          </label>

          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !canSave()}
            className="w-full cursor-pointer rounded-xl bg-gradient-to-r from-merah to-merah-bright py-2.5 text-sm font-semibold text-white transition duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            {editing ? 'Perbarui' : 'Tambah materi'}
          </button>
        </div>

        <div className="glass-panel border border-[var(--panel-border)] p-5 lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-theme">
              <BookOpen className="h-4 w-4 text-merah-bright" aria-hidden />
              Daftar ({items.length})
            </h2>
            <button
              type="button"
              onClick={() => void load()}
              className={`rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${
                day ? 'hover:bg-black/5' : 'hover:bg-white/10'
              }`}
            >
              Muat ulang
            </button>
          </div>
          <ul className="mt-4 max-h-[70vh] space-y-2 overflow-y-auto pr-1">
            {items.length === 0 ? (
              <li className="text-sm text-theme-muted">Belum ada materi.</li>
            ) : (
              items.map((row) => (
                <li
                  key={row.id}
                  className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 border-[var(--panel-border)] ${
                    day ? 'bg-white/80' : 'bg-black/25'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-theme">{row.title}</p>
                    <p className="text-xs text-theme-soft">
                      {categoryLabel(row.category)} ·{' '}
                      {row.category === 'artikel'
                        ? 'artikel PDF'
                        : row.kind === 'pdf'
                          ? 'buku PDF'
                          : row.kind === 'video'
                            ? 'video'
                            : row.kind}{' '}
                      · urut {row.sort_order} · {row.published ? 'tampil' : 'draf'}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(row)}
                      className={`rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs text-theme-muted focus-ring ${
                        day ? 'hover:bg-black/5' : 'hover:bg-white/10'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(row.id)}
                      className="rounded-lg border border-merah/30 p-1.5 text-merah-bright/70 hover:bg-merah/[0.1] focus-ring"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </motion.div>
  )
}
