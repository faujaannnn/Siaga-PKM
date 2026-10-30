import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

interface MapLocationPickerProps {
  lat: string
  lng: string
  label: string
  onLatChange: (v: string) => void
  onLngChange: (v: string) => void
  onLabelChange: (v: string) => void
  placeholder?: string
}

const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

L.Marker.prototype.options.icon = DefaultIcon

export function MapLocationPicker({
  lat,
  lng,
  label,
  onLatChange,
  onLngChange,
  onLabelChange,
  placeholder = 'Klik peta untuk memilih lokasi',
}: MapLocationPickerProps) {
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [mapReady, setMapReady] = useState(false)

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Default center: Indonesia
    const initialLat = lat ? parseFloat(lat) : -2.5
    const initialLng = lng ? parseFloat(lng) : 118.0

    const map = L.map(containerRef.current, {
      center: [initialLat, initialLng],
      zoom: lat && lng ? 15 : 5,
      scrollWheelZoom: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    // Add marker if coordinates exist
    if (lat && lng) {
      const marker = L.marker([parseFloat(lat), parseFloat(lng)])
        .addTo(map)
        .bindPopup(label || 'Lokasi dipilih')
      markerRef.current = marker
    }

    // Click handler to set location
    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng
      onLatChange(clickLat.toFixed(6))
      onLngChange(clickLng.toFixed(6))

      // Update or create marker
      if (markerRef.current) {
        markerRef.current.setLatLng([clickLat, clickLng])
      } else {
        const newMarker = L.marker([clickLat, clickLng]).addTo(map)
        markerRef.current = newMarker
      }

      // Update popup
      if (markerRef.current) {
        markerRef.current.bindPopup(label || `Lokasi: ${clickLat.toFixed(6)}, ${clickLng.toFixed(6)}`).openPopup()
      }
    })

    mapRef.current = map
    setMapReady(true)

    return () => {
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Update marker position when lat/lng changes externally
  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    if (!lat || !lng) return

    const newLatLng = L.latLng(parseFloat(lat), parseFloat(lng))

    if (markerRef.current) {
      markerRef.current.setLatLng(newLatLng)
      markerRef.current.bindPopup(label || 'Lokasi dipilih').openPopup()
    } else {
      const marker = L.marker(newLatLng).addTo(mapRef.current)
      marker.bindPopup(label || 'Lokasi dipilih')
      markerRef.current = marker
    }

    mapRef.current.setView(newLatLng, 15)
  }, [lat, lng, label, mapReady])

  // Update popup content when label changes
  useEffect(() => {
    if (markerRef.current && lat && lng) {
      markerRef.current.bindPopup(label || 'Lokasi dipilih')
    }
  }, [label, lat, lng])

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-theme-muted">
            Label Lokasi
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm text-theme transition duration-200 focus:outline-none focus:ring-[3px]"
            placeholder="Contoh: Kantor Utama"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-theme-muted">
            Latitude, Longitude
          </label>
          <div className="mt-1 flex items-center gap-2 text-sm text-theme-muted">
            {lat && lng ? (
              <>
                <span className="font-mono">{parseFloat(lat).toFixed(4)}</span>
                <span>,</span>
                <span className="font-mono">{parseFloat(lng).toFixed(4)}</span>
              </>
            ) : (
              <span className="italic">{placeholder}</span>
            )}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div
        ref={containerRef}
        className="h-64 w-full overflow-hidden rounded-xl border border-[var(--panel-border)]"
        style={{ zIndex: 1 }}
      />

      <p className="text-xs text-theme-muted">
        💡 <strong>Klik di peta</strong> untuk memilih lokasi. Koordinat akan terisi otomatis.
      </p>
    </div>
  )
}
