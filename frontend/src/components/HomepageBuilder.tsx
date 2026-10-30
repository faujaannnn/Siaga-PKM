import { GripVertical, Plus, Save, Trash2, Upload, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'

import { uploadAdminFile } from '../api/client'
import type { CardsSection, HeroImageItem, HeroSection, HomepageSection, TextSection } from '../types'

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

type Props = {
  sections: HomepageSection[]
  onChange: (next: HomepageSection[]) => void
  onSave: () => void
  saving: boolean
  day: boolean
  fieldClass: string
  homeErr: string | null
  homeOk: string | null
}

export function HomepageBuilder({
  sections,
  onChange,
  onSave,
  saving,
  day,
  fieldClass,
  homeErr,
  homeOk,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null)

  const updateAt = useCallback(
    (id: string, fn: (s: HomepageSection) => HomepageSection) => {
      onChange(sections.map((s) => (s.id === id ? fn(s) : s)))
    },
    [onChange, sections],
  )

  const remove = (id: string) => {
    onChange(sections.filter((s) => s.id !== id))
  }

  const addHero = () => {
    const h: HeroSection = {
      type: 'hero',
      id: newId(),
      title: 'Judul hero',
      subtitle: '',
      badge: '',
      highlight: '',
      images: [],
      heroImages: [],
    }
    onChange([...sections, h])
  }

  const addText = () => {
    const t: TextSection = {
      type: 'text',
      id: newId(),
      title: '',
      body: '',
    }
    onChange([...sections, t])
  }

  const addCards = () => {
    const c: CardsSection = {
      type: 'cards',
      id: newId(),
      title: '',
      items: [{ title: 'Kartu 1', description: '', href: '' }],
    }
    onChange([...sections, c])
  }

  const onDropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null)
      return
    }
    const from = sections.findIndex((s) => s.id === dragId)
    const to = sections.findIndex((s) => s.id === targetId)
    if (from < 0 || to < 0) {
      setDragId(null)
      return
    }
    const next = [...sections]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
    setDragId(null)
  }

  const panel = `rounded-xl border p-4 border-[var(--panel-border)] ${day ? 'bg-white/90' : 'bg-black/25'}`

  return (
    <div className="space-y-4">
      <p className="text-sm text-theme-muted">
        Susun bagian beranda dengan drag-and-drop. Tambah blok Hero, Teks, atau Kartu - tanpa menulis JSON.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={addHero}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs font-medium text-theme focus-ring"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Hero
        </button>
        <button
          type="button"
          onClick={addText}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs font-medium text-theme focus-ring"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Teks
        </button>
        <button
          type="button"
          onClick={addCards}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-2 text-xs font-medium text-theme focus-ring"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Kartu
        </button>
      </div>

      <ul className="space-y-3">
        {sections.map((section) => (
          <li
            key={section.id}
            className={panel}
            draggable
            onDragStart={() => setDragId(section.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDropOn(section.id)}
          >
            <div className="mb-3 flex items-center justify-between gap-2 border-b border-[var(--panel-border)] pb-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-theme-soft">
                <span className="cursor-grab text-theme-muted active:cursor-grabbing" title="Seret untuk mengurutkan">
                  <GripVertical className="h-4 w-4" aria-hidden />
                </span>
                {section.type === 'hero' ? 'Hero' : section.type === 'text' ? 'Teks' : 'Kartu'}
              </div>
              <button
                type="button"
                onClick={() => remove(section.id)}
                className="rounded-lg border border-merah/30 p-1.5 text-merah-bright/70 hover:bg-merah/[0.1] focus-ring"
                aria-label="Hapus bagian"
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </button>
            </div>

            {section.type === 'hero' ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="text-xs text-theme-muted">Judul</span>
                  <input
                    value={section.title}
                    onChange={(e) =>
                      updateAt(section.id, (s) =>
                        s.type === 'hero' ? { ...s, title: e.target.value } : s,
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs text-theme-muted">Subjudul</span>
                  <input
                    value={section.subtitle ?? ''}
                    onChange={(e) =>
                      updateAt(section.id, (s) =>
                        s.type === 'hero' ? { ...s, subtitle: e.target.value } : s,
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-theme-muted">Lencana (badge)</span>
                  <input
                    value={section.badge ?? ''}
                    onChange={(e) =>
                      updateAt(section.id, (s) =>
                        s.type === 'hero' ? { ...s, badge: e.target.value } : s,
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-xs text-theme-muted">Sorotan (blockquote)</span>
                  <textarea
                    value={section.highlight ?? ''}
                    onChange={(e) =>
                      updateAt(section.id, (s) =>
                        s.type === 'hero' ? { ...s, highlight: e.target.value } : s,
                      )
                    }
                    rows={2}
                    className={fieldClass}
                  />
                </label>
                <div className="block sm:col-span-2">
                  <span className="text-xs text-theme-muted">Foto slide</span>
                  <HeroImageUploader
                    heroImages={(section as { heroImages?: HeroImageItem[] }).heroImages ?? (section as { images?: string[] }).images?.map((url) => ({ url })) ?? []}
                    onChange={(heroImages) =>
                      updateAt(section.id, (s) =>
                        s.type === 'hero' ? { ...s, heroImages, images: [] } : s,
                      )
                    }
                    day={day}
                  />
                </div>
              </div>
            ) : null}

            {section.type === 'text' ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-theme-muted">Judul (opsional)</span>
                  <input
                    value={section.title ?? ''}
                    onChange={(e) =>
                      updateAt(section.id, (s) =>
                        s.type === 'text' ? { ...s, title: e.target.value } : s,
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-theme-muted">Isi</span>
                  <textarea
                    value={section.body ?? ''}
                    onChange={(e) =>
                      updateAt(section.id, (s) =>
                        s.type === 'text' ? { ...s, body: e.target.value } : s,
                      )
                    }
                    rows={5}
                    className={fieldClass}
                  />
                </label>
              </div>
            ) : null}

            {section.type === 'cards' ? (
              <div className="space-y-3">
                <label className="block">
                  <span className="text-xs text-theme-muted">Judul blok</span>
                  <input
                    value={section.title ?? ''}
                    onChange={(e) =>
                      updateAt(section.id, (s) =>
                        s.type === 'cards' ? { ...s, title: e.target.value } : s,
                      )
                    }
                    className={fieldClass}
                  />
                </label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-theme-muted">Item kartu</span>
                    <button
                      type="button"
                      onClick={() =>
                        updateAt(section.id, (s) => {
                          if (s.type !== 'cards') return s
                          const items = [...(s.items ?? []), { title: 'Baru', description: '', href: '' }]
                          return { ...s, items }
                        })
                      }
                      className="text-xs font-medium text-merah-bright focus-ring rounded"
                    >
                      + Tambah kartu
                    </button>
                  </div>
                  {(section.items ?? []).map((card, idx) => (
                    <div
                      key={`${section.id}-c-${idx}`}
                      className={`rounded-lg border p-3 border-[var(--panel-border)] ${day ? 'bg-white/70' : 'bg-black/20'}`}
                    >
                      <div className="mb-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            updateAt(section.id, (s) => {
                              if (s.type !== 'cards') return s
                              const items = (s.items ?? []).filter((_, j) => j !== idx)
                              return { ...s, items }
                            })
                          }
                          className="text-xs text-merah-bright/80 hover:underline focus-ring"
                        >
                          Hapus
                        </button>
                      </div>
                      <label className="block">
                        <span className="text-xs text-theme-muted">Judul</span>
                        <input
                          value={card.title}
                          onChange={(e) =>
                            updateAt(section.id, (s) => {
                              if (s.type !== 'cards') return s
                              const items = [...(s.items ?? [])]
                              items[idx] = { ...items[idx], title: e.target.value }
                              return { ...s, items }
                            })
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="text-xs text-theme-muted">Deskripsi</span>
                        <input
                          value={card.description ?? ''}
                          onChange={(e) =>
                            updateAt(section.id, (s) => {
                              if (s.type !== 'cards') return s
                              const items = [...(s.items ?? [])]
                              items[idx] = { ...items[idx], description: e.target.value }
                              return { ...s, items }
                            })
                          }
                          className={fieldClass}
                        />
                      </label>
                      <label className="mt-2 block">
                        <span className="text-xs text-theme-muted">Tautan (/petugas atau https://…)</span>
                        <input
                          value={card.href ?? ''}
                          onChange={(e) =>
                            updateAt(section.id, (s) => {
                              if (s.type !== 'cards') return s
                              const items = [...(s.items ?? [])]
                              items[idx] = { ...items[idx], href: e.target.value }
                              return { ...s, items }
                            })
                          }
                          className={fieldClass}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      {homeErr ? (
        <p className={`text-sm ${day ? 'text-merah' : 'text-merah-bright/80'}`}>{homeErr}</p>
      ) : null}
      {homeOk ? (
        <p className={`text-sm ${day ? 'text-emerald-700' : 'text-emerald-300'}`}>{homeOk}</p>
      ) : null}

      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 focus-ring"
      >
        <Save className="h-4 w-4" aria-hidden />
        Simpan beranda
      </button>
    </div>
  )
}

// ── Hero Image Uploader ──────────────────────────────────────────────────────

type HeroImageUploaderProps = {
  heroImages: HeroImageItem[]
  onChange: (heroImages: HeroImageItem[]) => void
  day: boolean
}

function HeroImageUploader({ heroImages, onChange, day }: HeroImageUploaderProps) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return
      setError(null)
      setUploading(true)
      try {
        const newImages: HeroImageItem[] = []
        for (const file of Array.from(files)) {
          if (!file.type.startsWith('image/')) {
            setError('Hanya file gambar yang diizinkan.')
            continue
          }
          const result = await uploadAdminFile(file)
          // Ambil nama file sebagai caption default
          const defaultCaption = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
          newImages.push({ url: result.url, caption: defaultCaption })
        }
        if (newImages.length > 0) {
          onChange([...heroImages, ...newImages])
        }
      } catch {
        setError('Gagal mengunggah file.')
      } finally {
        setUploading(false)
      }
    },
    [heroImages, onChange],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      handleFiles(e.dataTransfer.files)
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOver(false)
  }, [])

  const removeImage = useCallback(
    (index: number) => {
      onChange(heroImages.filter((_, i) => i !== index))
    },
    [heroImages, onChange],
  )

  const addUrlManually = useCallback(() => {
    const url = window.prompt('Masukkan URL gambar:')
    if (url && url.trim()) {
      const caption = window.prompt('Masukkan judul foto (opsional):')?.trim() || ''
      onChange([...heroImages, { url: url.trim(), caption: caption || undefined }])
    }
  }, [heroImages, onChange])

  const updateCaption = useCallback(
    (index: number, caption: string) => {
      const updated = [...heroImages]
      updated[index] = { ...updated[index], caption: caption || undefined }
      onChange(updated)
    },
    [heroImages, onChange],
  )

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 transition-colors cursor-pointer ${
          dragOver
            ? 'border-merah-bright bg-merah/5'
            : 'border-[var(--panel-border)] hover:border-merah/40 hover:bg-[var(--panel-bg)]'
        } ${day ? 'bg-white/88' : 'bg-black/15'}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {uploading ? (
          <>
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-merah border-t-transparent" />
            <span className="text-xs text-theme-muted">Mengunggah...</span>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-theme-soft" />
            <span className="text-xs text-theme-muted">
              Klik atau seret file gambar ke sini
            </span>
            <span className="text-[10px] text-theme-soft">JPG, PNG, GIF, WEBP</span>
          </>
        )}
      </div>

      {/* Manual URL input */}
      <button
        type="button"
        onClick={addUrlManually}
        className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5 text-xs text-theme-soft hover:border-merah/40 focus-ring"
      >
        + Tambah dari URL
      </button>

      {/* Error message */}
      {error ? (
        <p className="text-xs text-merah/80">{error}</p>
      ) : null}

      {/* Image previews */}
      {heroImages.length > 0 && (
        <div className="space-y-2">
          {heroImages.map((img, i) => (
            <div
              key={`${img.url}-${i}`}
              className={`group relative rounded-lg border border-[var(--panel-border)] overflow-hidden ${
                day ? 'bg-white/90' : 'bg-black/25'
              }`}
            >
              <div className="flex items-start gap-2 p-2">
                <img
                  src={img.url}
                  alt={img.caption || `Slide ${i + 1}`}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect fill="%23ddd" width="100" height="100"/><text x="50" y="55" font-size="12" text-anchor="middle" fill="%23999">Error</text></svg>'
                  }}
                />
                <div className="min-w-0 flex-1">
                  <input
                    type="text"
                    value={img.caption ?? ''}
                    onChange={(e) => updateCaption(i, e.target.value)}
                    className={`w-full rounded border border-[var(--panel-border)] px-2 py-1 text-xs focus-ring ${
                      day ? 'bg-white' : 'bg-black/30 text-white border-white/20'
                    }`}
                    placeholder={`Judul foto ${i + 1}`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  className="shrink-0 rounded-lg border border-merah/30 p-1.5 text-merah-bright/70 hover:bg-merah/[0.1] focus-ring"
                  aria-label={`Hapus slide ${i + 1}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="absolute left-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white">
                {i + 1}
              </div>
            </div>
          ))}
        </div>
      )}

      {heroImages.length === 0 && (
        <p className="text-[10px] text-theme-soft">
          Kosongkan untuk sembunyikan slider.
        </p>
      )}
    </div>
  )
}
