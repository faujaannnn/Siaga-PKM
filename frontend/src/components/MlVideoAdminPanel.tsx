import { Brain, Plus, Trash2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'

import {
  createAdminMlVideo,
  deleteAdminMlVideo,
  fetchAdminMlBelajarTopics,
  fetchAdminMlSessions,
  fetchAdminMlVideos,
  putAdminMlBelajarExtraSlugs,
  updateAdminMlVideo,
} from '../api/client'
import type { MlBelajarTopicItem, MlSessionLogRow, MlVideoAdmin, MlVideoCategory } from '../types'
import { parseYoutubeId, youtubeEmbedUrl } from '@dr-diah/siaga-frontend-core'

type Draft = {
  title: string
  description: string
  youtube_url: string
  video_script: string
  explanation: string
  sort_order: number
  published: boolean
  category: MlVideoCategory
  belajar_topic: string
}

const emptyDraft = (): Draft => ({
  title: '',
  description: '',
  youtube_url: '',
  video_script: '',
  explanation: '',
  sort_order: 0,
  published: true,
  category: 'asesmen_ai',
  belajar_topic: '',
})

type Props = {
  field: string
  day: boolean
}

export function MlVideoAdminPanel({ field, day }: Props) {
  const [items, setItems] = useState<MlVideoAdmin[]>([])
  const [logs, setLogs] = useState<MlSessionLogRow[]>([])
  const [editing, setEditing] = useState<MlVideoAdmin | null>(null)
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
      const [v, s, t] = await Promise.all([
        fetchAdminMlVideos(),
        fetchAdminMlSessions(null),
        fetchAdminMlBelajarTopics(),
      ])
      setItems(v)
      setLogs(s)
      setBelajarTopics(t.topics)
      setExtraSlugs(t.extra_slugs)
    } catch {
      setErr('Gagal memuat video ML atau log.')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const previewId = parseYoutubeId(draft.youtube_url)

  function startNew() {
    setEditing(null)
    setDraft(emptyDraft())
  }

  function startEdit(row: MlVideoAdmin) {
    setEditing(row)
    setDraft({
      title: row.title,
      description: row.description,
      youtube_url: row.youtube_url,
      video_script: row.video_script,
      explanation: row.explanation,
      sort_order: row.sort_order,
      published: row.published,
      category: row.category ?? 'asesmen_ai',
      belajar_topic: row.belajar_topic ?? '',
    })
  }

  async function save() {
    if (!draft.title.trim() || !parseYoutubeId(draft.youtube_url)) {
      setErr('Judul dan URL YouTube wajib valid.')
      return
    }
    setSaving(true)
    setErr(null)
    try {
      const body = {
        title: draft.title.trim(),
        description: (draft.description ?? '').trim(),
        youtube_url: draft.youtube_url.trim(),
        video_script: (draft.video_script ?? '').trim(),
        explanation: (draft.explanation ?? '').trim(),
        sort_order: draft.sort_order,
        published: draft.published,
        category: draft.category,
        belajar_topic: draft.category === 'belajar_plus' ? draft.belajar_topic : '',
      }
      if (editing) {
        const u = await updateAdminMlVideo(editing.id, body)
        setItems((prev) => prev.map((x) => (x.id === u.id ? u : x)).sort((a, b) => a.sort_order - b.sort_order))
      } else {
        const c = await createAdminMlVideo(body)
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
      setErr('Slug topik minimal 2 karakter: huruf kecil, angka, ganti spasi jadi _')
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
    if (!confirm(`Hapus topik “${slug}” dari daftar? Video yang memakainya perlu disetel ulang topik jika perlu.`)) return
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
    if (!confirm('Hapus video beserta log sesi?')) return
    try {
      await deleteAdminMlVideo(id)
      setItems((prev) => prev.filter((x) => x.id !== id))
      if (editing?.id === id) startNew()
      setLogs((prev) => prev.filter((l) => l.video_id !== id))
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
            <Brain className="h-4 w-4 text-merah-bright" aria-hidden />
            {editing ? 'Edit video' : 'Video baru'}
          </h2>
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
        <p className="text-xs text-theme-muted">
          Tautan YouTube (embed penuh), naskah &amp; penjelasan untuk <strong className="text-theme">asesmen AI</strong>{' '}
          (bukan tampil ke pengguna; dipakai untuk tebak pertanyaan &amp; laporan).
        </p>

        {err ? <p className="text-sm text-merah-bright">{err}</p> : null}

        <label className="block text-xs text-theme-muted">Judul</label>
        <input
          className={field}
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        />

        <label className="block text-xs text-theme-muted">Deskripsi singkat (publik)</label>
        <textarea
          className={field}
          rows={2}
          value={draft.description}
          onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
        />

        <label className="block text-xs text-theme-muted">Kategori tampilan</label>
        <select
          className={field}
          value={draft.category}
          onChange={(e) =>
            setDraft((d) => {
              const c = e.target.value as MlVideoCategory
              return { ...d, category: c, belajar_topic: c === 'belajar_plus' ? d.belajar_topic : '' }
            })
          }
        >
          <option value="asesmen_ai">Asesmen AI - kartu standar</option>
          <option value="belajar_plus">Belajar ++ - kartu dan efek visual menarik</option>
        </select>

        {draft.category === 'belajar_plus' ? (
          <>
            <label className="block text-xs text-theme-muted">Topik (modul di halaman publik hanya memuat Belajar++)</label>
            <select
              className={field}
              value={draft.belajar_topic}
              onChange={(e) => setDraft((d) => ({ ...d, belajar_topic: e.target.value }))}
            >
              <option value="">- Umum (tanpa topik) -</option>
              {belajarTopics.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-theme-muted">
              Topik opsional untuk mengelompokkan modul Belajar++. Tambah slug baru di daftar topik di bawah.
            </p>
          </>
        ) : null}

        <label className="block text-xs text-theme-muted">URL / ID YouTube</label>
        <input
          className={field}
          value={draft.youtube_url}
          onChange={(e) => setDraft((d) => ({ ...d, youtube_url: e.target.value }))}
          placeholder="https://www.youtube.com/watch?v=…"
        />

        {previewId ? (
          <div className="space-y-1">
            <p className="text-xs text-theme-muted">Pratinjau</p>
            <div className="aspect-video w-full max-w-sm overflow-hidden rounded-lg border border-[var(--panel-border)]">
              <iframe
                className="h-full w-full"
                title="pratinjau"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                src={youtubeEmbedUrl(previewId)}
              />
            </div>
          </div>
        ) : null}

        <label className="block text-xs text-theme-muted">Naskah video (untuk AI - isi manual)</label>
        <textarea
          className={field}
          rows={6}
          value={draft.video_script}
          onChange={(e) => setDraft((d) => ({ ...d, video_script: e.target.value }))}
          placeholder="Tempel naskah yang Anda susun; dipakai untuk membuat soal pilihan ganda (1–4 seragam). Penanda waktu m:ss opsional hanya untuk membantu penyusunan naskah, bukan untuk soal."
        />

        <label className="block text-xs text-theme-muted">Penjelasan / catatan (opsional, untuk AI)</label>
        <textarea
          className={field}
          rows={4}
          value={draft.explanation}
          onChange={(e) => setDraft((d) => ({ ...d, explanation: e.target.value }))}
        />

        <label className="block text-xs text-theme-muted">Urutan</label>
        <input
          type="number"
          className={field}
          value={draft.sort_order}
          onChange={(e) => setDraft((d) => ({ ...d, sort_order: Number(e.target.value) || 0 }))}
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
          disabled={saving || !draft.title.trim() || !parseYoutubeId(draft.youtube_url)}
          onClick={() => void save()}
          className="w-full rounded-xl bg-gradient-to-r from-merah to-merah-bright py-2.5 text-sm font-semibold text-white disabled:opacity-50 focus-ring"
        >
          {editing ? 'Perbarui' : 'Tambah video'}
        </button>

        <div
          className="space-y-2 border-t border-[var(--panel-border)] pt-4"
          role="group"
          aria-label="Topik Belajar++ tambahan"
        >
          <h3 className="text-sm font-semibold text-theme">Topik Belajar++ (tambahan)</h3>
          <p className="text-xs text-theme-muted">
            Masukkan slug (huruf kecil, ganti spasi jadi <span className="font-mono">_</span>); contoh:{' '}
            <span className="font-mono">kebakaran_hutan</span>
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={field}
              value={newTopicSlug}
              onChange={(e) => setNewTopicSlug(e.target.value)}
              placeholder="slug_topik_tambahan"
            />
            <button
              type="button"
              disabled={savingTopic || !newTopicSlug.trim()}
              onClick={() => void addExtraTopic()}
              className="rounded-xl border border-[var(--panel-border)] px-3 py-2 text-sm font-medium text-theme focus-ring"
            >
              Simpan topik
            </button>
          </div>
          {extraSlugs.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {extraSlugs.map((s) => (
                <li
                  key={s}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-border)] bg-white/88 px-2 py-0.5 text-xs"
                >
                  <span className="font-mono text-theme">{s}</span>
                  <button
                    type="button"
                    onClick={() => void removeExtraTopic(s)}
                    className="text-merah hover:underline"
                    disabled={savingTopic}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="glass-panel space-y-3 border border-[var(--panel-border)] p-5 lg:col-span-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-theme">Terbit ({items.length})</h2>
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
        <ul className="max-h-[36vh] space-y-2 overflow-y-auto pr-1">
          {items.map((row) => (
            <li
              key={row.id}
              className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 border-[var(--panel-border)] ${
                day ? 'bg-white/80' : 'bg-black/25'
              }`}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-theme">{row.title}</p>
                <p className="text-xs text-theme-soft">
                  {row.category === 'belajar_plus' ? 'Belajar ++' : 'Asesmen AI'}
                  {row.category === 'belajar_plus' && row.belajar_topic ? ` · topik: ${row.belajar_topic}` : ''} · urut{' '}
                  {row.sort_order} · {row.published ? 'tampil' : 'draf'}
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
          ))}
        </ul>

        <h3 className="pt-2 text-sm font-semibold text-theme">Log sesi asesmen</h3>
        <p className="text-xs text-theme-muted">Pengguna login · ringkasan laporan tersimpan di server</p>
        <ul className="max-h-[32vh] space-y-2 overflow-y-auto pr-1 text-xs">
          {logs.length === 0 ? (
            <li className="text-theme-muted">Belum ada sesi</li>
          ) : (
            logs.map((l) => (
              <li
                key={l.id}
                className={`rounded-lg border border-[var(--panel-border)] px-2 py-2 ${
                  day ? 'bg-white/80' : 'bg-black/20'
                }`}
              >
                <p className="font-medium text-theme">{l.video_title}</p>
                <p className="text-theme-muted">
                  {l.username} · {l.created_at} · tonton ~{l.seconds_watched.toFixed(0)} dtk · {l.knowledge_level || l.status}
                </p>
                {l.report ? <p className="mt-1 line-clamp-3 text-theme-soft">{l.report}</p> : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </motion.div>
  )
}
