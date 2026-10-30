import { useEffect, useState } from 'react'


import {
  EVACUATION_SCOPE_LABELS,
  EVACUATION_SCOPE_REGION_IDS,
  type EvacuationScopeRegionId,
  EvacSimOverviewMap,
  ReportLocationPicker,
} from '@dr-diah/siaga-frontend-core'

import type { EvacSimRegionId } from '../api/client'
import { fetchAdminEvacSimSettings, saveAdminEvacSimSettings } from '../api/client'

type LocalEvacRow = {
  /** Kunci stabil baris (biasanya sama dengan id server setelah simpan). */
  rowKey: string
  region_id: EvacSimRegionId
  title: string
  lat: number | null
  lng: number | null
}

function newRowKey(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `r-${Math.random().toString(36).slice(2, 12)}`
  }
}

function coordsLabel(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return 'Belum dipilih di peta'
  }
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
}

/** Ekstrak lat,lng dari Google Maps share link atau coordinates dalam string */
function parseGoogleMapsInput(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  // Format 1: coordinates dalam format "lat,lng" atau "lat, lng"
  const coordMatch = trimmed.match(/(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)/)
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1])
    const lng = parseFloat(coordMatch[2])
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }

  // Format 2: Google Maps share link (maps.google.com atau google.com/maps)
  const mapsMatch = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (mapsMatch) {
    const lat = parseFloat(mapsMatch[1])
    const lng = parseFloat(mapsMatch[2])
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }

  // Format 3: URL dengan query "q=lat,lng"
  const qMatch = trimmed.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (qMatch) {
    const lat = parseFloat(qMatch[1])
    const lng = parseFloat(qMatch[2])
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }

  // Format 4: place ID atau link dengan /data=... (extract dari @lat,lng)
  const atMatch = trimmed.match(/(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/)
  if (atMatch) {
    const lat = parseFloat(atMatch[1])
    const lng = parseFloat(atMatch[2])
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng }
    }
  }

  return null
}

type Props = { fieldClassName: string }

export function EvacSimAdminPanel({ fieldClassName }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [enabled, setEnabled] = useState(false)
  const [points, setPoints] = useState<LocalEvacRow[]>([])
  /** Baris yang sedang menampilkan peta inline (bukan popup). */
  const [expandedMapRowKey, setExpandedMapRowKey] = useState<string | null>(null)

  function hydrateFromPayload(payload: { enabled?: boolean; destinations?: unknown }) {
    setEnabled(!!payload.enabled)
    const raw = payload.destinations
    if (!Array.isArray(raw)) {
      setPoints([])
      return
    }
    const next: LocalEvacRow[] = []
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue
      const o = item as Record<string, unknown>
      const rid = String(o.region_id ?? '')
      if (!(EVACUATION_SCOPE_REGION_IDS as readonly string[]).includes(rid)) continue
      const id = typeof o.id === 'string' && o.id.trim() ? o.id.trim() : newRowKey()
      const title = typeof o.title === 'string' ? o.title : ''
      let lat: number | null = null
      let lng: number | null = null
      if (typeof o.lat === 'number' && typeof o.lng === 'number' && !Number.isNaN(o.lat) && !Number.isNaN(o.lng)) {
        lat = o.lat
        lng = o.lng
      }
      next.push({ rowKey: id, region_id: rid as EvacSimRegionId, title, lat, lng })
    }
    setPoints(next)
  }

  useEffect(() => {
    setLoading(true)
    setMsg(null)
    void fetchAdminEvacSimSettings()
      .then((payload) => hydrateFromPayload(payload))
      .catch(() => setMsg('❌ Gagal memuat pengaturan.'))
      .finally(() => setLoading(false))
  }, [])

  function addPoint(region_id: EvacSimRegionId) {
    setPoints((prev) => [
      ...prev,
      { rowKey: newRowKey(), region_id, title: '', lat: null, lng: null },
    ])
  }

  function removePoint(rowKey: string) {
    setPoints((prev) => prev.filter((p) => p.rowKey !== rowKey))
    setExpandedMapRowKey((k) => (k === rowKey ? null : k))
  }

  async function persist() {
    setSaving(true)
    setMsg(null)
    try {
      const destinations = points
        .filter((p) => p.lat != null && p.lng != null)
        .map((p) => ({
          id: p.rowKey,
          region_id: p.region_id,
          title: p.title.trim(),
          lat: p.lat as number,
          lng: p.lng as number,
        }))
      const saved = await saveAdminEvacSimSettings({ enabled, destinations })
      hydrateFromPayload(saved)
      setMsg('✅ Pengaturan simulasi evakuasi disimpan.')
    } catch {
      setMsg('❌ Gagal menyimpan. Pastikan setiap titik sudah dipilih di peta.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="glass-panel space-y-5 border border-[var(--panel-border)] p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-health-600">Materi petugas</p>
        <h2 className="mt-1 text-base font-bold text-theme">Simulasi jalur evakuasi - Titik kumpul</h2>
        <p className="mt-1 text-xs leading-relaxed text-theme-muted">
          Tambahkan <strong>sebanyak apapun titik kumpul</strong> di tiap wilayah (Seluruh / Palu / Donggala / Talise).
          Untuk blok &laquo;Seluruh wilayah&raquo;: titik bisa di luar kotak kawasan penelitian. Tombol{' '}
          <strong>Pilih di peta</strong> membuka peta pemilih tepat di bawah baris.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-theme-muted">Memuat…</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition duration-200 focus-ring ${
                enabled ? 'bg-health-500' : 'bg-slate-300 dark:bg-zinc-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-theme">{enabled ? 'Aktif untuk masyarakat' : 'Nonaktif'}</span>
          </div>

          {points.filter((p) => p.lat != null && p.lng != null).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-theme-muted">Peta semua titik kumpul tersimpan</p>
              <EvacSimOverviewMap
                points={points
                  .filter((p) => p.lat != null && p.lng != null)
                  .map((p) => ({ id: p.rowKey, region_id: p.region_id, title: p.title, lat: p.lat as number, lng: p.lng as number }))}
              />
            </div>
          )}

          <div className="space-y-6">
            {EVACUATION_SCOPE_REGION_IDS.map((rid) => {
              const block = points.filter((p) => p.region_id === rid)
              return (
                <div
                  key={rid}
                  className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)]/80 px-4 py-3 md:px-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-theme-muted">
                        {EVACUATION_SCOPE_LABELS[rid]}
                      </p>
                      {block.length > 0 && (
                        <p className="text-[10px] text-theme-muted">{block.length} titik</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => addPoint(rid)}
                      className="rounded-lg border border-health-500/35 bg-health-500/10 px-3 py-1.5 text-xs font-semibold text-theme transition hover:bg-health-500/15 focus-ring"
                    >
                      + Tambah titik
                    </button>
                  </div>

                  {block.length === 0 ? (
                    <p className="mt-3 text-xs text-theme-muted">
                      Belum ada titik. Gunakan «Tambah titik» lalu buka peta di bawah baris.
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-3">
                      {block.map((p) => {
                        const mapOpen = expandedMapRowKey === p.rowKey
                        return (
                          <li
                            key={p.rowKey}
                            className="rounded-lg border border-[var(--panel-border)] bg-black/[0.03] p-3 dark:bg-white/[0.04]"
                          >
                            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                              <div>
                                <label className="block text-xs font-medium text-theme-muted">Nama titik</label>
                                <input
                                  type="text"
                                  value={p.title}
                                  onChange={(e) =>
                                    setPoints((prev) =>
                                      prev.map((x) => (x.rowKey === p.rowKey ? { ...x, title: e.target.value } : x)),
                                    )
                                  }
                                  placeholder="mis. Shelter Kelurahan / Masjid ..."
                                  className={fieldClassName}
                                />
                                <p className="mt-1.5 text-[11px] tabular-nums text-theme-muted">
                                  Posisi peta: <span className="font-medium text-theme">{coordsLabel(p.lat, p.lng)}</span>
                                </p>
                              </div>
                              <div>
                                <label className="block text-xs font-medium text-theme-muted">
                                  Link / Koordinat Google Maps
                                </label>
                                <input
                                  type="text"
                                  placeholder="Tempel link atau koordinat..."
                                  className={fieldClassName}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const input = e.currentTarget.value
                                      const coords = parseGoogleMapsInput(input)
                                      if (coords) {
                                        setPoints((prev) =>
                                          prev.map((x) =>
                                            x.rowKey === p.rowKey
                                              ? { ...x, lat: coords.lat, lng: coords.lng }
                                              : x,
                                          ),
                                        )
                                        e.currentTarget.value = ''
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const input = e.target.value
                                    if (!input.trim()) return
                                    const coords = parseGoogleMapsInput(input)
                                    if (coords) {
                                      setPoints((prev) =>
                                        prev.map((x) =>
                                          x.rowKey === p.rowKey
                                            ? { ...x, lat: coords.lat, lng: coords.lng }
                                            : x,
                                        ),
                                      )
                                      e.target.value = ''
                                    }
                                  }}
                                />
                                <p className="mt-1 text-[10px] text-theme-soft">
                                  Tekan Enter atau keluar dari kolom untuk apply
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                <button
                                  type="button"
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-ring ${
                                    mapOpen
                                      ? 'border-health-500/40 bg-health-500/15 text-theme'
                                      : 'border-[var(--panel-border)] text-theme hover:bg-white/5'
                                  }`}
                                  onClick={() =>
                                    setExpandedMapRowKey((k) => (k === p.rowKey ? null : p.rowKey))
                                  }
                                >
                                  {mapOpen ? 'Tutup peta' : 'Pilih di peta'}
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-merah/30 px-3 py-1.5 text-xs font-semibold text-merah transition hover:bg-merah/[0.05]0/10 focus-ring dark:text-merah-bright/80"
                                  onClick={() => removePoint(p.rowKey)}
                                >
                                  Hapus
                                </button>
                              </div>
                            </div>

                            {mapOpen ? (
                              <div className="mt-4 rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 sm:p-4">
                                <p className="text-xs font-medium text-theme">
                                  Peta · {EVACUATION_SCOPE_LABELS[p.region_id as EvacuationScopeRegionId]}
                                </p>
                                <p className="mt-1 text-[11px] text-theme-muted">
                                  Ketuk peta atau tempel link/koordinat. Area tidak dibatasi.
                                </p>
                                <div className="mt-3">
                                  <ReportLocationPicker
                                    key={`${p.rowKey}-${p.region_id}`}
                                    lat={p.lat != null ? String(p.lat) : ''}
                                    lng={p.lng != null ? String(p.lng) : ''}
                                    suggestAddressFromPin
                                    onAddressSuggestion={(addr) => {
                                      setPoints((prev) =>
                                        prev.map((x) =>
                                          x.rowKey === p.rowKey && !x.title.trim()
                                            ? { ...x, title: addr.slice(0, 120) }
                                            : x,
                                        ),
                                      )
                                    }}
                                    onChange={(la, lo) => {
                                      const a = Number.parseFloat(la.replace(',', '.'))
                                      const b = Number.parseFloat(lo.replace(',', '.'))
                                      if (Number.isNaN(a) || Number.isNaN(b)) return
                                      setPoints((prev) =>
                                        prev.map((x) =>
                                          x.rowKey === p.rowKey ? { ...x, lat: a, lng: b } : x,
                                        ),
                                      )
                                    }}
                                  />
                                </div>
                              </div>
                            ) : null}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>

          {msg ? (
            <p
              className={`rounded-lg px-3 py-2 text-sm ${msg.startsWith('❌') ? 'bg-merah/[0.05] text-merah dark:bg-merah/[0.1] dark:text-white' : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/35 dark:text-emerald-100'}`}
            >
              {msg}
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving}
            onClick={() => void persist()}
            className="rounded-xl bg-health-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-health-700 focus-ring disabled:opacity-50"
          >
            {saving ? 'Menyimpan…' : 'Simpan titik evakuasi'}
          </button>
        </div>
      )}
    </div>
  )
}
