import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EDUCATION_CATEGORY_IDS, EDUCATION_CATEGORY_LABELS } from '@dr-diah/siaga-frontend-core'
import type { EducationCategory } from '../types'

type Props = {
  subcategories: Record<string, string[]>
  onChange: (next: Record<string, string[]>) => void
  onSave: () => void
  saving: boolean
  fieldClass: string
}

export function EducationSubcategoryPanel({ subcategories, onChange, onSave, saving, fieldClass }: Props) {
  const [activeCat, setActiveCat] = useState<EducationCategory>('peraturan')
  const [newLabel, setNewLabel] = useState('')

  const list = useMemo(() => subcategories[activeCat] ?? [], [subcategories, activeCat])

  function addSub() {
    const label = newLabel.trim()
    if (!label) return
    const prev = subcategories[activeCat] ?? []
    if (prev.includes(label)) {
      setNewLabel('')
      return
    }
    onChange({ ...subcategories, [activeCat]: [...prev, label] })
    setNewLabel('')
  }

  function removeSub(label: string) {
    const prev = subcategories[activeCat] ?? []
    onChange({ ...subcategories, [activeCat]: prev.filter((x) => x !== label) })
  }

  return (
    <div className="glass-panel mb-6 space-y-4 border border-[var(--panel-border)] p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-health-600">Subkategori</p>
        <h2 className="mt-1 text-base font-bold text-theme">Kategori tambahan per kategori utama</h2>
        <p className="mt-1 text-xs text-theme-muted">
          Mempermudah penyaringan di bahan bacaan. Pilih kategori utama, lalu tambah subkategori.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {EDUCATION_CATEGORY_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveCat(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus-ring ${
              activeCat === id
                ? 'bg-merah text-white shadow-sm'
                : 'border border-[var(--panel-border)] text-theme-muted hover:bg-[var(--panel-bg)]'
            }`}
          >
            {EDUCATION_CATEGORY_LABELS[id]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className={`min-w-[12rem] flex-1 ${fieldClass}`}
          placeholder="Nama subkategori baru"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addSub()
            }
          }}
        />
        <button
          type="button"
          onClick={addSub}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-[var(--panel-border)] px-3 py-2 text-sm font-medium text-theme focus-ring hover:bg-black/5 dark:hover:bg-white/5"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Tambah
        </button>
      </div>
      {list.length ? (
        <ul className="flex flex-wrap gap-2">
          {list.map((label) => (
            <li
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--panel-border)] bg-[var(--panel-bg)] pl-3 pr-1 py-1 text-xs font-medium text-theme"
            >
              {label}
              <button
                type="button"
                onClick={() => removeSub(label)}
                className="rounded-full p-1 text-theme-muted hover:bg-merah/[0.08] hover:text-merah focus-ring"
                aria-label={`Hapus subkategori ${label}`}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-theme-muted">Belum ada subkategori untuk {EDUCATION_CATEGORY_LABELS[activeCat]}.</p>
      )}
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded-xl bg-gradient-to-r from-merah to-merah-bright px-5 py-2 text-sm font-semibold text-white shadow-sm transition focus-ring disabled:opacity-50"
      >
        {saving ? 'Menyimpan…' : 'Simpan subkategori'}
      </button>
    </div>
  )
}
