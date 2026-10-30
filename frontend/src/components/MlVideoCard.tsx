import { motion } from 'framer-motion'
import { Brain, ChevronRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

import { easeOutExpo, youtubeDefaultThumbnail } from '@dr-diah/siaga-frontend-core'
import type { MlVideoPublic } from '../types'

type Props = {
  item: MlVideoPublic
  index: number
  /** Label tampilan topik bencana (Belajar++), jika ada */
  topicLabel?: string
}

const badgeBase =
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide'

export function MlVideoCard({ item, index, topicLabel }: Props) {
  const isPlus = item.category === 'belajar_plus'
  const thumb = youtubeDefaultThumbnail(item.youtube_id)

  if (isPlus) {
    return (
      <motion.li
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.06 * index, ease: easeOutExpo }}
        className="group relative"
      >
        <div
          className="pointer-events-none absolute -inset-1 rounded-3xl bg-gradient-to-br from-cyan-500/35 via-health-500/45 to-merah/40 opacity-80 blur-sm transition duration-500 group-hover:opacity-100"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -inset-px rounded-[1.4rem] bg-gradient-to-br from-health-500/90 via-merah to-cyan-400/75 p-[1px] shadow-lg shadow-merah/20"
          aria-hidden
        >
          <div className="h-full w-full rounded-[1.35rem] bg-zinc-950/10" />
        </div>
        <Link
          to={`/petugas/video-ml/${item.id}`}
          className="relative block cursor-pointer overflow-hidden rounded-2xl border border-white/20 bg-zinc-950/40 shadow-xl ring-1 ring-cyan-200/35 backdrop-blur-sm transition duration-200 focus-ring"
        >
          <div className="absolute left-3 top-3 z-10 flex max-w-[min(100%-1.5rem,20rem)] flex-wrap gap-1.5">
            <span
              className={`${badgeBase} bg-gradient-to-r from-health-600/95 to-merah-bright/95 text-white shadow-md shadow-merah/25`}
            >
              <Sparkles className="h-3 w-3" aria-hidden />
              Belajar ++
            </span>
            {topicLabel ? (
              <span
                className={`${badgeBase} border border-white/30 bg-black/40 text-white backdrop-blur-sm`}
                title={topicLabel}
              >
                {topicLabel}
              </span>
            ) : null}
          </div>
          <div className="absolute right-0 top-0 z-10 h-32 w-32 rounded-full bg-amber-400/15 blur-3xl" aria-hidden />
          <div className="absolute bottom-0 left-0 z-10 h-24 w-24 rounded-full bg-cyan-500/12 blur-2xl" aria-hidden />
          <div className="relative aspect-video w-full overflow-hidden bg-zinc-900/90">
            <motion.img
              src={thumb}
              alt=""
              className="h-full w-full object-cover"
              whileHover={{ scale: 1.04 }}
              transition={{ duration: 0.4, ease: easeOutExpo }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 p-4">
              <p className="line-clamp-2 text-base font-bold leading-snug text-white drop-shadow-sm">{item.title}</p>
              <motion.span
                className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/25 text-white ring-1 ring-white/30 backdrop-blur"
                whileHover={{ scale: 1.08, backgroundColor: 'rgba(255,255,255,0.35)' }}
              >
                <ChevronRight className="h-4 w-4" />
              </motion.span>
            </div>
          </div>
          <p className="p-3 text-sm text-zinc-200/90 line-clamp-2">
            {item.description || 'Pengalaman belajar & asesmen AI - tap untuk mulai.'}
          </p>
        </Link>
      </motion.li>
    )
  }

  return (
    <motion.li
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.04 * index, ease: easeOutExpo }}
    >
      <Link
        to={`/petugas/video-ml/${item.id}`}
        className="group block cursor-pointer overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-white/90 shadow-sm transition duration-200 hover:border-health-500/30 hover:shadow-md focus-ring"
      >
        <div className="flex items-center justify-between border-b border-[var(--panel-border)] bg-black/20 px-3 py-2">
          <span className={`${badgeBase} bg-zinc-200/80 text-zinc-800`}>
            <Brain className="h-3 w-3" aria-hidden />
            Asesmen AI
          </span>
        </div>
        <div className="relative aspect-video w-full overflow-hidden bg-zinc-900/90">
          <img src={thumb} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          <div className="absolute inset-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/80 to-transparent p-3">
            <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
            <span className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white">
              <ChevronRight className="h-4 w-4" />
            </span>
          </div>
        </div>
        <p className="p-3 text-xs text-theme-muted line-clamp-2">{item.description || '-'}</p>
      </Link>
    </motion.li>
  )
}
