import { useState, useEffect, useCallback } from 'react'
import { Plus, Pencil, Trash2, Save, X, Building2, Users, Shield, UserPlus } from 'lucide-react'
import {
  fetchAdminPuskesmasList,
  createPuskesmas,
  updatePuskesmas,
  deletePuskesmas,
  fetchAdminKapusList,
  createKapus,
  deleteKapus,
  fetchAdminStaffList,
  createStaffByAdmin,
  updateStaffByAdmin,
} from '../api/client'
import type { PuskesmasOut, StaffOut } from '../types'
import { fieldClass, tabBtn } from './RoleWorkspaceShell'

type SubTab = 'puskesmas' | 'kapus' | 'staff'

export function PuskesmasAdminPanel() {
  const [sub, setSub] = useState<SubTab>('puskesmas')
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-1">
        {(['puskesmas', 'kapus', 'staff'] as SubTab[]).map(t => (
          <button key={t} type="button" onClick={() => setSub(t)} className={`${tabBtn(sub === t)} flex-1 sm:flex-none capitalize`}>
            {t === 'puskesmas' ? 'Puskesmas' : t === 'kapus' ? 'Kepala Puskesmas' : 'Staff'}
          </button>
        ))}
      </div>
      {sub === 'puskesmas' && <PuskesmasTab />}
      {sub === 'kapus' && <KapusTab />}
      {sub === 'staff' && <StaffPuskesmasTab />}
    </div>
  )
}

// ── Puskesmas ─────────────────────────────────────────────────────────────────

function PuskesmasTab() {
  const [items, setItems] = useState<PuskesmasOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PuskesmasOut | null>(null)
  const [form, setForm] = useState({ nama: '', alamat: '', kode: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setItems(await fetchAdminPuskesmasList()) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function handleSave() {
    setErr(null); setSaving(true)
    try {
      if (editing) await updatePuskesmas(editing.id, form)
      else await createPuskesmas(form)
      setShowForm(false); setEditing(null)
      setForm({ nama: '', alamat: '', kode: '' })
      await load()
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Gagal') } finally { setSaving(false) }
  }

  async function handleDelete(item: PuskesmasOut) {
    if (!confirm(`Hapus puskesmas "${item.nama}"?\nSemua staff akan dilepas dari puskesmas ini.`)) return
    try { await deletePuskesmas(item.id); await load() }
    catch (e: any) { alert(e?.response?.data?.detail || 'Gagal menghapus') }
  }

  const inputCls = fieldClass

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-theme flex items-center gap-2"><Building2 className="w-5 h-5 text-merah" /> Daftar Puskesmas</h3>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm({ nama: '', alamat: '', kode: '' }) }}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2 text-sm font-semibold text-white hover:brightness-105">
          <Plus className="w-4 h-4" /> Tambah Puskesmas
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-merah/15 bg-merah/[0.05] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-theme">{editing ? 'Edit Puskesmas' : 'Tambah Puskesmas'}</h4>
            <button onClick={() => setShowForm(false)} className="text-theme-muted"><X className="w-5 h-5" /></button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <input value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))}
            placeholder="Nama puskesmas *" className={inputCls} />
          <input value={form.alamat} onChange={e => setForm(f => ({ ...f, alamat: e.target.value }))}
            placeholder="Alamat" className={inputCls} />
          <input value={form.kode} onChange={e => setForm(f => ({ ...f, kode: e.target.value }))}
            placeholder="Kode puskesmas (opsional)" className={inputCls} />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-gray-600">Batal</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-theme-muted">Memuat...</div> : (
        <div className="space-y-2">
          {items.length === 0 && <p className="py-8 text-center text-theme-muted">Belum ada puskesmas</p>}
          {items.map(item => (
            <div key={item.id} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-theme">{item.nama}</div>
                <div className="text-sm text-theme-muted space-x-3">
                  {item.kode && <span>Kode: {item.kode}</span>}
                  <span>{item.staff_count} staff</span>
                  {item.has_kapus ? <span className="text-emerald-600">✓ Ada Kepala Puskesmas</span> : <span className="text-orange-500">⚠ Belum ada Kapus</span>}
                </div>
                {item.alamat && <div className="text-xs text-theme-muted">{item.alamat}</div>}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(item); setForm({ nama: item.nama, alamat: item.alamat, kode: item.kode }); setShowForm(true) }}
                  className="rounded-lg border p-2 text-theme-muted hover:bg-gray-50"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => handleDelete(item)} className="rounded-lg border p-2 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Kepala Puskesmas ──────────────────────────────────────────────────────────

function KapusTab() {
  const [kapusList, setKapusList] = useState<StaffOut[]>([])
  const [puskesmasList, setPuskesmasList] = useState<PuskesmasOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ username: '', password: '', puskesmas_id: '', display_name: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [k, p] = await Promise.all([fetchAdminKapusList(), fetchAdminPuskesmasList()])
    setKapusList(k); setPuskesmasList(p); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function handleCreate() {
    setErr(null); setSaving(true)
    try {
      await createKapus(form)
      setShowForm(false); setForm({ username: '', password: '', puskesmas_id: '', display_name: '' })
      await load()
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Gagal') } finally { setSaving(false) }
  }

  async function handleDelete(u: StaffOut) {
    if (!confirm(`Hapus akun kepala puskesmas ${u.username}?`)) return
    try { await deleteKapus(u.username); await load() }
    catch (e: any) { alert(e?.response?.data?.detail || 'Gagal') }
  }

  const inputCls = fieldClass
  const availablePuskesmas = puskesmasList.filter(p => !p.has_kapus)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-theme flex items-center gap-2"><Shield className="w-5 h-5 text-merah" /> Akun Kepala Puskesmas</h3>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2 text-sm font-semibold text-white hover:brightness-105">
          <Plus className="w-4 h-4" /> Buat Akun Kapus
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-merah/15 bg-merah/[0.05] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-theme">Buat Akun Kepala Puskesmas</h4>
            <button onClick={() => setShowForm(false)} className="text-theme-muted"><X className="w-5 h-5" /></button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {availablePuskesmas.length === 0 && (
            <p className="text-sm text-orange-600">Semua puskesmas sudah memiliki kepala puskesmas. Tambah puskesmas baru dulu.</p>
          )}
          <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
            placeholder="Username *" className={inputCls} />
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder="Password (min. 6 karakter) *" className={inputCls} />
          <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
            placeholder="Nama tampilan" className={inputCls} />
          <select value={form.puskesmas_id} onChange={e => setForm(f => ({ ...f, puskesmas_id: e.target.value }))} className={inputCls}>
            <option value="">-- Pilih Puskesmas --</option>
            {availablePuskesmas.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.puskesmas_id}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-merah to-merah-bright px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Buat Akun'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-gray-600">Batal</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-theme-muted">Memuat...</div> : (
        <div className="space-y-2">
          {kapusList.length === 0 && <p className="py-8 text-center text-theme-muted">Belum ada akun kepala puskesmas</p>}
          {kapusList.map(u => (
            <div key={u.username} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-theme">{u.display_name || u.username}</div>
                <div className="text-sm text-theme-muted">@{u.username} · {u.puskesmas_nama || 'Puskesmas tidak ditemukan'}</div>
              </div>
              <button onClick={() => handleDelete(u)} className="rounded-lg border p-2 text-red-500 hover:bg-red-50"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Staff dengan Puskesmas ────────────────────────────────────────────────────

function StaffPuskesmasTab() {
  const [staff, setStaff] = useState<StaffOut[]>([])
  const [puskesmasList, setPuskesmasList] = useState<PuskesmasOut[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<StaffOut | null>(null)
  const [form, setForm] = useState({ username: '', password: '', puskesmas_id: '', display_name: '', wa_phone: '' })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [filterPk, setFilterPk] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [s, p] = await Promise.all([fetchAdminStaffList(), fetchAdminPuskesmasList()])
    setStaff(s); setPuskesmasList(p); setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  async function handleSave() {
    setErr(null); setSaving(true)
    try {
      if (editing) {
        await updateStaffByAdmin(editing.username, {
          display_name: form.display_name || null,
          wa_phone: form.wa_phone || null,
          password: form.password || null,
          puskesmas_id: form.puskesmas_id || null,
        })
      } else {
        await createStaffByAdmin({
          username: form.username, password: form.password,
          puskesmas_id: form.puskesmas_id,
          display_name: form.display_name, wa_phone: form.wa_phone,
        })
      }
      setShowForm(false); setEditing(null)
      setForm({ username: '', password: '', puskesmas_id: '', display_name: '', wa_phone: '' })
      await load()
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Gagal') } finally { setSaving(false) }
  }

  const inputCls = fieldClass
  const filtered = filterPk === 'all' ? staff : filterPk === 'none' ? staff.filter(s => !s.puskesmas_id) : staff.filter(s => s.puskesmas_id === filterPk)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold text-theme flex items-center gap-2"><Users className="w-5 h-5 text-emerald-600" /> Staff</h3>
        <div className="flex items-center gap-3">
          <select value={filterPk} onChange={e => setFilterPk(e.target.value)} className="rounded-xl border px-3 py-1.5 text-sm">
            <option value="all">Semua Puskesmas</option>
            <option value="none">Tanpa Puskesmas</option>
            {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          <button onClick={() => { setShowForm(true); setEditing(null); setForm({ username: '', password: '', puskesmas_id: '', display_name: '', wa_phone: '' }) }}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
            <UserPlus className="w-4 h-4" /> Tambah Staff
          </button>
        </div>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-theme">{editing ? 'Edit Staff' : 'Tambah Staff'}</h4>
            <button onClick={() => setShowForm(false)} className="text-theme-muted"><X className="w-5 h-5" /></button>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          {!editing && <input value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} placeholder="Username *" className={inputCls} />}
          <input value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="Nama tampilan" className={inputCls} />
          <input value={form.wa_phone} onChange={e => setForm(f => ({ ...f, wa_phone: e.target.value }))} placeholder="No. WhatsApp" className={inputCls} />
          <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            placeholder={editing ? 'Password baru (kosongkan jika tidak diubah)' : 'Password *'} className={inputCls} />
          <select value={form.puskesmas_id} onChange={e => setForm(f => ({ ...f, puskesmas_id: e.target.value }))} className={inputCls}>
            <option value="">-- Pilih Puskesmas --</option>
            {puskesmasList.map(p => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              <Save className="w-4 h-4" /> {saving ? 'Menyimpan...' : 'Simpan'}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-xl border px-4 py-2 text-sm text-gray-600">Batal</button>
          </div>
        </div>
      )}

      {loading ? <div className="py-8 text-center text-theme-muted">Memuat...</div> : (
        <div className="space-y-2">
          {filtered.length === 0 && <p className="py-8 text-center text-theme-muted">Tidak ada staff</p>}
          {filtered.map(u => (
            <div key={u.username} className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-theme">{u.display_name || u.username}</div>
                <div className="text-sm text-theme-muted">
                  @{u.username} · {u.puskesmas_nama || <span className="text-orange-500">Belum ada puskesmas</span>}
                  {u.wa_phone ? ` · WA: ${u.wa_phone}` : ''}
                </div>
              </div>
              <button onClick={() => { setEditing(u); setForm({ username: u.username, password: '', puskesmas_id: u.puskesmas_id || '', display_name: u.display_name || '', wa_phone: u.wa_phone || '' }); setShowForm(true) }}
                className="rounded-lg border p-2 text-theme-muted hover:bg-gray-50"><Pencil className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
