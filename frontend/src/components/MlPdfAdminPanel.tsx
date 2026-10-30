import { BookOpen, FileText, Plus, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

import {
  createAdminMlPdf,
  deleteAdminMlPdf,
  fetchAdminMlPdfSessions,
  fetchAdminMlBelajarTopics,
  fetchAdminMlPdfs,
  putAdminMlBelajarExtraSlugs,
  updateAdminMlPdf,
} from '../api/client'
import type { MlBelajarTopicItem, MlPdfAdmin, MlPdfSessionLogRow, MlVideoCategory } from '../types'
import { googleDriveFileIdFromAny } from '@dr-diah/siaga-frontend-core'

type ChapterDraft = {
  title: string
  page_start: number
  page_end: number
  content: string
  explanation: string
}

type Draft = {
  title: string
  description: string
  drive_url: string
  sort_order: number
  published: boolean
  category: MlVideoCategory
  belajar_topic: string
  chapters: ChapterDraft[]
}

const emptyChapter = (): ChapterDraft => ({
  title: '',
  page_start: 1,
  page_end: 1,
  content: '',
  explanation: '',
})

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  drive_url: '',
  sort_order: 0,
  published: true,
  category: 'asesmen_ai',
  belajar_topic: '',
  chapters: [emptyChapter()],
})

type Props = { field: string; day: boolean }

export function MlPdfAdminPanel({ field, day }: Props) {
  const [items, setItems] = useState<MlPdfAdmin[]>([])
  const [logs, setLogs] = useState<MlPdfSessionLogRow[]>([])
  const [editing, setEditing] = useState<MlPdfAdmin | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft())
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [belajarTopics, setBelajarTopics] = useState<MlBelajarTopicItem[]>([])
  const [extraSlugs, setExtraSlugs] = useState<string[]>([])
  const [newTopicSlug, setNewTopicSlug] = useState('')
  const [savingTopic, setSavingTopic] = useState(false)

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [p, s, t] = await Promise.all([
        fetchAdminMlPdfs(),
        fetchAdminMlPdfSessions(null),
        fetchAdminMlBelajarTopics(),
      ])
      setItems(p)
      setLogs(s)
      setBelajarTopics(t.topics)
      setExtraSlugs(t.extra_slugs)
    } catch {
      setErr('Gagal memuat Buku ML atau log.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const previewId = googleDriveFileIdFromAny(draft.drive_url)

  function startNew() {
    setEditing(null)
    setDraft(emptyDraft())
  }

  function startEdit(row: MlPdfAdmin) {
    setEditing(row)
    setDraft({
      title: row.title,
      description: row.description,
      drive_url: row.drive_url,
      sort_order: row.sort_order,
      published: row.published,
      category: row.category ?? 'asesmen_ai',
      belajar_topic: row.belajar_topic ?? '',
      chapters:
        row.chapters?.length > 0
          ? row.chapters.map((c) => ({
              title: c.title,
              page_start: c.page_start,
              page_end: c.page_end,
              content: c.content ?? '',
              explanation: c.explanation ?? '',
            }))
          : [emptyChapter()],
    })
  }

  async function save() {
    if (!draft.title.trim() || !previewId) {
      setErr('Judul dan URL berkas Google Drive wajib valid (bukan folder).')
      return
    }
    const chs = draft.chapters
      .filter((c) => c.title.trim())
      .map((c) => ({
        title: c.title.trim(),
        page_start: Math.max(1, Number(c.page_start) || 1),
        page_end: Math.max(1, Number(c.page_end) || 1),
        content: (c.content ?? '').trim(),
        explanation: (c.explanation ?? '').trim(),
      }))
    for (const c of chs) {
      if (c.page_end < c.page_start) {
        setErr(`Bab «${c.title}»: halaman akhir harus ≥ halaman awal.`)
        return
      }
    }
    if (!chs.length) {
      setErr('Isi minimal satu bab dengan judul.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        title: draft.title.trim(),
        description: (draft.description ?? '').trim(),
        drive_url: draft.drive_url.trim(),
        sort_order: draft.sort_order,
        published: draft.published,
        category: draft.category,
        belajar_topic: draft.category === 'belajar_plus' ? draft.belajar_topic : '',
        chapters: chs,
      }
      if (editing) {
        const u = await updateAdminMlPdf(editing.id, body)
        setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)).sort((a, b) => a.sort_order - b.sort_order))
      } else {
        const c = await createAdminMlPdf(body)
        setItems((prev) => [...prev, c].sort((a, b) => a.sort_order - b.sort_order))
      }
      startNew()
    } catch {
      setErr('Gagal menyimpan.')
    } finally {
      setSaving(false)
    }
  }

  function normalizeTopicSlug(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
  }

  async function addExtraTopic() {
    const n = normalizeTopicSlug(newTopicSlug)
    if (n.length < 2) {
      setErr('Slug topik minimal 2 karakter.')
      return
    }
    setSavingTopic(true)
    setErr(null)
    try {
      const next = Array.from(new Set([...extraSlugs, n]))
      const r = await putAdminMlBelajarExtraSlugs(next)
      setExtraSlugs(r.extra_slugs)
      setBelajarTopics(r.topics)
      setNewTopicSlug('')
    } catch {
      setErr('Gagal menambah topik.')
    } finally {
      setSavingTopic(false)
    }
  }

  async function removeExtraTopic(slug: string) {
    if (!confirm(`Hapus topik “${slug}”?`)) return
    setSavingTopic(true)
    setErr(null)
    try {
      const next = extraSlugs.filter((s) => s !== slug)
      const r = await putAdminMlBelajarExtraSlugs(next)
      setExtraSlugs(r.extra_slugs)
      setBelajarTopics(r.topics)
    } catch {
      setErr('Gagal menghapus topik.')
    } finally {
      setSavingTopic(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Hapus buku beserta log sesi?')) return
    try {
      await deleteAdminMlPdf(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
      if (editing?.id === id) startNew()
      setLogs((prev) => prev.filter((l) => l.pdf_id !== id))
    } catch {
      setErr('Gagal menghapus.')
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid gap-6 lg:grid-cols-5"
    >
      <div className="glass-panel space-y-3 border border-[var(--panel-border)] p-5 lg:col-span-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-semibold text-theme">
            <FileText className="h-4 w-4" aria-hidden />
            Buku ML (Drive)
          </h2>
          <button
            type="button"
            onClick={startNew}
            className={`inline-flex items-center gap-1 rounded-lg border border-[var(--panel-border)] px-2 py-1 text-xs focus-ring ${day ? 'text-theme-muted hover:bg-black/5' : 'text-theme-muted hover:bg-white/10'}`}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Baru
          </button>
        </div>
        <p className="text-xs text-theme-muted">
          Tautan <strong className="text-theme/90">berkas</strong> Google Drive (bukan folder). Tiap bab: rentang
          halaman untuk pembumian baca + naskah untuk AI menyusun soal pilihan ganda.
        </p>
        {err ? <p className="text-sm text-merah dark:text-merah/80">{err}</p> : null}

        <label className="block text-xs text-theme-muted">Judul</label>
        <input className={field} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />

        <label className="block text-xs text-theme-muted">Deskripsi singkat</label>
        <textarea
          className={field}
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />

        <label className="block text-xs text-theme-muted">URL berkas Google Drive</label>
        <input
          className={field}
          value={draft.drive_url}
          onChange={(e) => setDraft((d) => ({ ...d, drive_url: e.target.value }))}
          placeholder="https://drive.google.com/file/d/…"
        />
        {previewId ? (
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400">ID berkas terdeteksi: {previewId.slice(0, 12)}…</p>
        ) : (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">Tempel tautan share /preview berkas buku.</p>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-theme-muted">Urutan</label>
            <input
              type="number"
              className={field}
              value={draft.sort_order}
              onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
            />
          </div>
          <label className="mt-5 flex items-center gap-2 text-xs text-theme">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(e) => setDraft((d) => ({ ...d, published: e.target.checked }))}
            />
            Terbit
          </label>
        </div>

        <label className="block text-xs text-theme-muted">Kategori</label>
        <select
          className={field}
          value={draft.category}
          onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value as MlVideoCategory }))}
        >
          <option value="asesmen_ai">Asesmen AI</option>
          <option value="belajar_plus">Belajar++</option>
        </select>

        {draft.category === 'belajar_plus' ? (
          <>
            <label className="block text-xs text-theme-muted">Topik (slug)</label>
            <select
              className={field}
              value={draft.belajar_topic}
              onChange={(e) => setDraft((d) => ({ ...d, belajar_topic: e.target.value }))}
            >
              <option value="">- pilih -</option>
              {belajarTopics.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <input
                className={field + ' min-w-[8rem] flex-1'}
                value={newTopicSlug}
                onChange={(e) => setNewTopicSlug(e.target.value)}
                placeholder="slug_topik_baru"
              />
              <button type="button" disabled={savingTopic} className="rounded-lg border border-[var(--panel-border)] px-3 py-2 text-xs font-medium focus-ring" onClick={() => void addExtraTopic()}>
                + Topik
              </button>
            </div>
            {extraSlugs.length ? (
              <ul className="flex flex-wrap gap-1 text-[11px] text-theme-muted">
                {extraSlugs.map((s) => (
                  <li key={s} className="inline-flex items-center gap-1 rounded-full bg-black/10 px-2 py-0.5 dark:bg-white/10">
                    {s}
                    <button type="button" className="text-merah" onClick={() => void removeExtraTopic(s)} aria-label={`Hapus ${s}`}>
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        <div className="space-y-4 border-t border-[var(--panel-border)] pt-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-theme">Bab / segmen halaman</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-merah-bright hover:underline focus-ring"
              onClick={() => setDraft((d) => ({ ...d, chapters: [...d.chapters, emptyChapter()] }))}
            >
              <Plus className="h-3 w-3" aria-hidden />
              Bab
            </button>
          </div>
          {draft.chapters.map((c, idx) => (
            <div key={idx} className="space-y-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-theme-muted">Bab {idx + 1}</span>
                {draft.chapters.length > 1 ? (
                  <button
                    type="button"
                    className="text-merah"
                    aria-label="Hapus bab"
                    onClick={() => setDraft((d) => ({ ...d, chapters: d.chapters.filter((_, j) => j !== idx) }))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
              <input
                className={field}
                placeholder="Judul bab"
                value={c.title}
                onChange={(e) =>
                  setDraft((d) => {
                    const ch = [...d.chapters]
                    ch[idx] = { ...ch[idx]!, title: e.target.value }
                    return { ...d, chapters: ch }
                  })
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-theme-muted">Hal. mulai</label>
                  <input
                    type="number"
                    min={1}
                    className={field}
                    value={c.page_start}
                    onChange={(e) =>
                      setDraft((d) => {
                        const ch = [...d.chapters]
                        ch[idx] = { ...ch[idx]!, page_start: Number(e.target.value) || 1 }
                        return { ...d, chapters: ch }
                      })
                    }
                  />
                </div>
                <div>
                  <label className="text-[10px] text-theme-muted">Hal. akhir</label>
                  <input
                    type="number"
                    min={1}
                    className={field}
                    value={c.page_end}
                    onChange={(e) =>
                      setDraft((d) => {
                        const ch = [...d.chapters]
                        ch[idx] = { ...ch[idx]!, page_end: Number(e.target.value) || 1 }
                        return { ...d, chapters: ch }
                      })
                    }
                  />
                </div>
              </div>
              <label className="text-[10px] text-theme-muted">Naskah / ringkasan isi (untuk AI)</label>
              <textarea
                className={field}
                rows={3}
                value={c.content}
                onChange={(e) =>
                  setDraft((d) => {
                    const ch = [...d.chapters]
                    ch[idx] = { ...ch[idx]!, content: e.target.value }
                    return { ...d, chapters: ch }
                  })
                }
              />
              <label className="text-[10px] text-theme-muted">Penjelasan tambahan (opsional)</label>
              <textarea
                className={field}
                rows={2}
                value={c.explanation}
                onChange={(e) =>
                  setDraft((d) => {
                    const ch = [...d.chapters]
                    ch[idx] = { ...ch[idx]!, explanation: e.target.value }
                    return { ...d, chapters: ch }
                  })
                }
              />
            </div>
          ))}
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="w-full rounded-xl bg-gradient-to-r from-merah to-merah-bright py-2.5 text-sm font-semibold text-white disabled:opacity-50 focus-ring"
        >
          {saving ? 'Menyimpan…' : editing ? 'Perbarui buku' : 'Simpan buku baru'}
        </button>
      </div>

      <div className="glass-panel space-y-3 border border-[var(--panel-border)] p-5 lg:col-span-3">
        <h3 className="font-semibold text-theme">Daftar terbit</h3>
        <ul className="divide-y divide-[var(--panel-border)] text-sm">
          {items.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
              <div className="min-w-0">
                <p className="font-medium text-theme">{row.title}</p>
                <p className="text-xs text-theme-muted">
                  {row.chapters?.length ?? 0} bab · urutan {row.sort_order} · {row.published ? 'terbit' : 'draf'}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="text-xs font-medium text-merah-bright hover:underline focus-ring" onClick={() => startEdit(row)}>
                  Edit
                </button>
                <button type="button" className="text-xs text-merah hover:underline focus-ring" onClick={() => void remove(row.id)}>
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>

        <h3 className="flex items-center gap-2 border-t border-[var(--panel-border)] pt-4 font-semibold text-theme">
          <BookOpen className="h-4 w-4" aria-hidden />
          Log sesi (300 terakhir)
        </h3>
        <div className="max-h-72 overflow-auto text-xs">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0 bg-[var(--panel-bg)] text-theme-muted">
              <tr>
                <th className="p-2">Waktu</th>
                <th className="p-2">Pengguna</th>
                <th className="p-2">Buku</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-[var(--panel-border)]">
                  <td className="p-2 tabular-nums text-theme-muted">{l.created_at?.slice(0, 16) ?? '-'}</td>
                  <td className="p-2">{l.username}</td>
                  <td className="p-2">{l.pdf_title}</td>
                  <td className="p-2">{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  )
}
