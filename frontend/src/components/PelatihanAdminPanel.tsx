import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Save, X, Calendar, Clock, MapPin, User, BookOpen } from 'lucide-react'
import {
  fetchPelatihanList,
  createPelatihan,
  updatePelatihan,
  deletePelatihan,
  uploadFlyer,
} from '../api/client'
import type { PelatihanOut } from '../types'

type FormState = {
  judul: string
  deskripsi: string
  tanggal: string
  waktu_mulai: string
  waktu_selesai: string
  lokasi: string
  narasumber: string
  kapasitas: string
  flyer_url: string
}

const emptyForm = (): FormState => ({
  judul: '', deskripsi: '', tanggal: '', waktu_mulai: '', waktu_selesai: '',
  lokasi: '', narasumber: '', kapasitas: '0', flyer_url: '',
})

export function PelatihanAdminPanel() {
  const [items, setItems] = useState<PelatihanOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PelatihanOut | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [uploadingFlyer, setUploadingFlyer] = useState(false)
  const [flyerPreview, setFlyerPreview] = useState<string>('')
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await fetchPelatihanList()) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setShowForm(true)
  }

  function openEdit(item: PelatihanOut) {
    setEditing(item)
    setForm({
      judul: item.judul,
      deskripsi: item.deskripsi,
      tanggal: item.tanggal,
      waktu_mulai: item.waktu_mulai,
      waktu_selesai: item.waktu_selesai,
      lokasi: item.lokasi,
      narasumber: item.narasumber,
      kapasitas: String(item.kapasitas),
      flyer_url: item.flyer_url || '',
    })
    setFlyerPreview(item.flyer_url || '')
    setShowForm(true)
  }

  async function handleSave() {
    setErr(null); setSaving(true)
    try {
      const body = {
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim(),
        tanggal: form.tanggal,
        waktu_mulai: form.waktu_mulai,
        waktu_selesai: form.waktu_selesai,
        lokasi: form.lokasi.trim(),
        narasumber: form.narasumber.trim(),
        kapasitas: parseInt(form.kapasitas) || 0,
        flyer_url: form.flyer_url,
      }
      if (editing) {
        await updatePelatihan(editing.id, body)
      } else {
        await createPelatihan(body)
      }
      setShowForm(false)
      await load()
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Gagal menyimpan')
    } finally { setSaving(false) }
  }

  async function handleDelete(item: PelatihanOut) {
    if (!confirm(`Hapus pelatihan "${item.judul}"?`)) return
    try { await deletePelatihan(item.id); await load() }
    catch (e: any) { alert(e?.response?.data?.detail || 'Gagal menghapus') }
  }

  const inputCls = 'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" /> Pelatihan Bencana
        </h2>
        <button onClick={openCreate}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Tambah Pelatihan
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{editing ? 'Edit Pelatihan' : 'Tambah Pelatihan Baru'}</h3>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500">Judul Pelatihan *</label>
              <input value={form.judul} onChange={e => setForm(f => ({ ...f, judul: e.target.value }))}
                placeholder="Nama pelatihan" className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500">Deskripsi</label>
              <textarea value={form.deskripsi} onChange={e => setForm(f => ({ ...f, deskripsi: e.target.value }))}
                placeholder="Deskripsi singkat pelatihan" rows={3} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Tanggal *</label>
              <input type="date" value={form.tanggal} onChange={e => setForm(f => ({ ...f, tanggal: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Lokasi</label>
              <input value={form.lokasi} onChange={e => setForm(f => ({ ...f, lokasi: e.target.value }))}
                placeholder="Gedung / alamat" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Waktu Mulai</label>
              <input type="time" value={form.waktu_mulai} onChange={e => setForm(f => ({ ...f, waktu_mulai: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Waktu Selesai</label>
              <input type="time" value={form.waktu_selesai} onChange={e => setForm(f => ({ ...f, waktu_selesai: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Narasumber</label>
              <input value={form.narasumber} onChange={e => setForm(f => ({ ...f, narasumber: e.target.value }))}
                placeholder="Nama narasumber" className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500">Kapasitas (0 = tidak dibatasi)</label>
              <input type="number" min={0} value={form.kapasitas} onChange={e => setForm(f => ({ ...f, kapasitas: e.target.value }))} className={inputCls} />
            </div>

            {/* Flyer Image Upload */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500">Gambar Flyer</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                id="flyer-upload"
                onChange={async e => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setUploadingFlyer(true)
                  try {
                    const { url } = await uploadFlyer(file)
                    setForm(f => ({ ...f, flyer_url: url }))
                    setFlyerPreview(url)
                  } catch {
                    alert('Gagal mengunggah flyer')
                  } finally {
                    setUploadingFlyer(false)
                  }
                }}
              />
              <label
                htmlFor="flyer-upload"
                className="flex items-center gap-2 rounded-xl border border-dashed border-blue-300 px-4 py-3 text-sm text-blue-600 cursor-pointer hover:bg-blue-50 transition-colors mt-1"
              >
                {uploadingFlyer ? '⏳ Mengunggah...' : '📷 Pilih Gambar Flyer'}
              </label>
              {flyerPreview && (
                <div className="mt-2 relative inline-block group">
                  <img
                    src={flyerPreview}
                    alt="Preview flyer"
                    className="h-28 rounded-lg object-cover border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => { setForm(f => ({ ...f, flyer_url: '' })); setFlyerPreview('') }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow hover:bg-red-600"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-gray-600 hover:bg-gray-100">Batal</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-gray-400">Memuat...</div> : (
        <div className="space-y-3">
          {items.length === 0 && <p className="py-8 text-center text-gray-400">Belum ada pelatihan</p>}
          {items.map(item => (
            <div key={item.id} className="rounded-2xl border bg-white p-5">
              <div className="flex items-start justify-between gap-4">
                {item.flyer_url ? (
                  <img
                    src={item.flyer_url}
                    alt={`Flyer ${item.judul}`}
                    className="h-20 w-28 shrink-0 rounded-lg border border-gray-200 object-cover"
                  />
                ) : null}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{item.judul}</h3>
                  <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.tanggal}</span>
                    {item.waktu_mulai && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.waktu_mulai}{item.waktu_selesai ? `–${item.waktu_selesai}` : ''}</span>}
                    {item.lokasi && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{item.lokasi}</span>}
                    {item.narasumber && <span className="flex items-center gap-1"><User className="w-3 h-3" />{item.narasumber}</span>}
                  </div>
                  {item.deskripsi && <p className="mt-2 text-sm text-gray-600">{item.deskripsi}</p>}
                  <p className="mt-1.5 text-xs text-gray-400">{item.peserta_count} peserta terdaftar</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(item)} className="rounded-lg border p-2 text-gray-500 hover:bg-gray-50">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item)} className="rounded-lg border p-2 text-red-500 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
