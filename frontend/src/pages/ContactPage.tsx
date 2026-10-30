import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import { fetchPublicContact } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import { easeOutExpo, SiteContactShowcase } from '@dr-diah/siaga-frontend-core'
import type { SiteContactPayload } from '../types'

export function ContactPage() {
  const { theme } = useTheme()
  const day = theme === 'day'
  const [contact, setContact] = useState<SiteContactPayload | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    fetchPublicContact()
      .then((d) => {
        if (!c) setContact(d)
      })
      .catch(() => {
        if (!c) setErr('Gagal memuat kontak kami.')
      })
    return () => {
      c = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <p>
        <Link
          to="/profil"
          className={`cursor-pointer text-sm font-medium transition duration-200 hover:underline focus-ring ${
            day ? 'text-health-600 hover:text-health-700' : 'text-cyan-300 hover:text-cyan-200'
          }`}
        >
          ← Kembali ke profil
        </Link>
      </p>
      {err ? <p className={`text-sm ${day ? 'text-merah' : 'text-merah-bright'}`}>{err}</p> : null}
      {contact ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeOutExpo }}
        >
          <SiteContactShowcase
            intro={contact.intro}
            address={contact.address}
            phone={contact.phone}
            email={contact.email}
            mapsUrl={contact.maps_url}
            photos={contact.photos.map((p) => ({ url: p.url, caption: p.caption }))}
            teamLocation={contact.team_location}
          />
        </motion.div>
      ) : !err ? (
        <div className="flex min-h-[30vh] items-center justify-center">
          <div className="loader-ring" aria-busy />
        </div>
      ) : null}
    </div>
  )
}
