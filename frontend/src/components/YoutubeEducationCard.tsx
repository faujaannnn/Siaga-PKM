import { Play } from 'lucide-react'
import { motion } from 'framer-motion'
import { useState } from 'react'

import { easeOutExpo, imageMediaUrl, parseYoutubeId, youtubeDefaultThumbnail, youtubeEmbedUrl } from '@dr-diah/siaga-frontend-core'
import type { EducationItem } from '../types'

type Props = {
  item: EducationItem
  compact?: boolean
  /** Judul/deskripsi sudah ditampilkan di header kartu induk */
  showMeta?: boolean
}

export function YoutubeEducationCard({ item, compact, showMeta = true }: Props) {
  const [playing, setPlaying] = useState(false)
  const id = parseYoutubeId(item.url)
  const thumb =
    item.thumbnailUrl?.trim() ||
    item.coverUrl?.trim() ||
    (id ? youtubeDefaultThumbnail(id) : '')

  if (!id) {
    return (
      <div className="glass-panel border border-amber-500/35 p-4 text-sm text-theme-muted">
        URL YouTube tidak valid: {item.title}
      </div>
    )
  }

  if (playing) {
    return (
      <motion.div
        className="glass-panel overflow-hidden border border-[var(--panel-border)]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28, ease: easeOutExpo }}
      >
        <div className="relative aspect-video w-full bg-black">
          <iframe
            title={item.title}
            src={youtubeEmbedUrl(id)}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </motion.div>
    )
  }

  const scaleHover = compact ? 1.008 : 1.012

  return (
    <motion.button
      type="button"
      onClick={() => setPlaying(true)}
      className="group glass-panel relative w-full cursor-pointer overflow-hidden border border-[var(--panel-border)] text-left transition-[border-color,box-shadow] duration-200 hover:border-health-500/40 focus-ring"
      whileHover={{ scale: scaleHover }}
      whileTap={{ scale: 0.992 }}
      transition={{ duration: 0.2, ease: easeOutExpo }}
    >
      <div className="relative aspect-video w-full bg-black/85">
        {thumb ? (
          <img
            src={imageMediaUrl(thumb)}
            alt=""
            className="h-full w-full object-cover opacity-95 transition-opacity duration-200 group-hover:opacity-100"
            loading="lazy"
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-merah/90 text-white shadow-lg ring-4 ring-white/15 transition-transform duration-200 group-hover:scale-105 group-hover:bg-merah">
            <Play className="ml-1 h-7 w-7 fill-current" aria-hidden />
          </span>
        </span>
      </div>
      {showMeta ? (
        <div className="space-y-1 p-4">
          <h3 className="font-semibold text-theme">{item.title}</h3>
          {item.description ? (
            <p className="line-clamp-2 text-sm text-theme-muted">{item.description}</p>
          ) : null}
          <p className="text-xs text-theme-soft">Putar memakai pemutar YouTube (embed resmi)</p>
        </div>
      ) : null}
    </motion.button>
  )
}
