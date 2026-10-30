import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

import { fetchPublicProfile } from '../api/client'
import { useTheme } from '../context/ThemeContext'
import { easeOutExpo, mapProfileMembersApi, ProfileHeroShowcase, SiteContactShowcase } from '@dr-diah/siaga-frontend-core'
import type { SiteProfilePayload } from '../types'

export function ProfileIndexPage() {
  const { theme } = useTheme()
  const day = theme === 'day'
  const [profile, setProfile] = useState<SiteProfilePayload | null>(null)
  const [profileErr, setProfileErr] = useState<string | null>(null)

  useEffect(() => {
    let c = false
    fetchPublicProfile()
      .then((d) => {
        if (!c) setProfile(d)
      })
      .catch(() => {
        if (!c) setProfileErr('Gagal memuat slider tim.')
      })
    return () => {
      c = true
    }
  }, [])

  const showcaseMembers = profile ? mapProfileMembersApi(profile.members) : []
  const galleryPhotos = (profile?.photos ?? []).filter((p) => (p.url ?? '').trim())
  const hasShowcase = showcaseMembers.some((m) => m.photoUrl || m.name)
  const hasGallery = galleryPhotos.length > 0

  return (
    <div className="space-y-10">
      {profileErr ? (
        <p className={`text-sm ${day ? 'text-merah' : 'text-merah-bright'}`}>{profileErr}</p>
      ) : null}
      {profile && hasShowcase ? (
        <ProfileHeroShowcase youtubeUrl="" members={showcaseMembers} />
      ) : null}
      {profile && hasGallery ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: easeOutExpo }}
        >
          <SiteContactShowcase
            title="Galeri profil"
            intro=""
            address=""
            phone=""
            email=""
            mapsUrl=""
            photos={galleryPhotos.map((p) => ({ url: p.url, caption: p.caption }))}
          />
        </motion.div>
      ) : null}
    </div>
  )
}
