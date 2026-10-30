import { BookOpen, ChevronDown, ChevronUp, Download, ExternalLink, ImageIcon, Newspaper } from 'lucide-react'
import { motion, type Variants } from 'framer-motion'
import { useState } from 'react'

import { useTheme } from '../context/ThemeContext'
import {
  EDUCATION_CATEGORY_LABELS,
  easeOutExpo,
  EducationCoverThumbnail,
  educationCategoryLabel,
  educationFeedKindLabel,
  imageMediaUrl,
  mediaUrl,
  staggerLight,
} from '@dr-diah/siaga-frontend-core'
import type { EducationCategory, EducationItem } from '../types'

import { PdfEmbedFrame } from './PdfEmbedFrame'
import { YoutubeEducationCard } from './YoutubeEducationCard'

function categoryBadgeLabel(cat: EducationCategory | undefined, sub?: string): string | null {
  const main = educationCategoryLabel(cat)
  const subTrim = sub?.trim()
  if (main && subTrim) return `${main} · ${subTrim}`
  if (subTrim) return subTrim
  return main
}

const container: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: staggerLight,
  },
}

const itemIn: Variants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: easeOutExpo },
  },
}

function KindBadge({ kind, category }: { kind: string; category?: EducationCategory }) {
  const { theme } = useTheme()
  const day = theme === 'day'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
        day ? 'bg-zinc-200/90 text-zinc-700' : 'bg-white/12 text-theme-soft'
      }`}
    >
      {educationFeedKindLabel(kind, category)}
    </span>
  )
}

function CategoryBadge({ label }: { label: string }) {
  const { theme } = useTheme()
  const day = theme === 'day'
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        day ? 'bg-emerald-100 text-emerald-900' : 'bg-emerald-500/20 text-emerald-200'
      }`}
    >
      {label}
    </span>
  )
}

function PostShell({
  children,
  title,
  kind,
  category,
  description,
  compact,
  categoryLabel,
  showDescription,
}: {
  children: React.ReactNode
  title: string
  kind: string
  category?: EducationCategory
  description?: string
  compact?: boolean
  categoryLabel?: string | null
  showDescription?: boolean
}) {
  const { theme } = useTheme()
  const day = theme === 'day'
  const showDesc = showDescription !== false && description?.trim()
  return (
    <motion.article
      variants={itemIn}
      className={`overflow-hidden rounded-2xl border transition-shadow duration-300 border-[var(--panel-border)] ${
        day ? 'bg-white/85 shadow-sm shadow-zinc-900/5' : 'bg-[var(--panel-bg)] shadow-lg shadow-black/25'
      } ${compact ? '' : 'hover:shadow-md'}`}
    >
      <div className={`flex items-start gap-3 border-b px-4 py-3 border-[var(--panel-border)] ${compact ? 'py-2.5' : ''}`}>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ring-1 ${
            day
              ? 'from-health-500/20 to-merah/10 text-health-700 ring-health-500/25'
              : 'from-cyan-500/15 to-merah/15 text-cyan-300 ring-cyan-500/20'
          }`}
        >
          <Newspaper className="h-5 w-5 opacity-90" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-semibold leading-snug text-theme ${compact ? 'text-sm' : 'text-base'}`}>{title}</h3>
            <KindBadge kind={kind} category={category} />
            {categoryLabel ? <CategoryBadge label={categoryLabel} /> : null}
          </div>
          {showDesc ? (
            <p className={`mt-1 text-theme-muted ${compact ? 'line-clamp-2 text-xs' : 'text-sm'}`}>{description}</p>
          ) : null}
        </div>
      </div>
      <div className={compact ? 'p-3' : 'p-4'}>{children}</div>
    </motion.article>
  )
}

function PdfPreviewBlock({ item, compact }: { item: EducationItem; compact?: boolean }) {
  const { theme } = useTheme()
  const day = theme === 'day'
  const [open, setOpen] = useState(false)
  const isArtikel = item.category === 'artikel'
  const openLabel = isArtikel ? 'Buka artikel' : 'Buka buku'
  const closeLabel = isArtikel ? 'Tutup artikel' : 'Tutup buku'
  const ariaOpen = isArtikel ? `Buka artikel: ${item.title}` : `Buka buku: ${item.title}`

  const coverPlaceholder = (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-theme-muted">
      <BookOpen className="h-10 w-10 opacity-50" aria-hidden />
      <span className="text-xs">Pratinjau sampul</span>
    </div>
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`group relative w-full cursor-pointer overflow-hidden rounded-xl border text-left transition duration-200 focus-ring border-[var(--panel-border)] ${
          day ? 'bg-zinc-50 hover:border-health-500/35 hover:shadow-md' : 'bg-black/20 hover:border-cyan-500/30'
        }`}
        aria-label={ariaOpen}
      >
        <div
          className={`relative w-full bg-zinc-900/10 ${
            compact ? 'aspect-[4/3] min-h-[12rem]' : 'aspect-[3/4] min-h-[16rem] sm:min-h-[20rem] md:min-h-[24rem]'
          }`}
        >
          <EducationCoverThumbnail
            coverUrl={item.coverUrl}
            thumbnailUrl={item.thumbnailUrl}
            bookUrl={item.url}
            alt={`Sampul ${item.title}`}
            placeholder={coverPlaceholder}
          />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
          <span className="absolute bottom-3 left-3 right-3 inline-flex items-center justify-center gap-2 rounded-lg bg-white/92 px-3 py-2 text-sm font-semibold text-theme shadow-md backdrop-blur-sm dark:bg-cosmic-900/90">
            <BookOpen className="h-4 w-4 text-merah-bright" aria-hidden />
            {openLabel}
          </span>
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <PdfEmbedFrame url={item.url} title={item.title} compact={compact} />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className={`inline-flex cursor-pointer items-center gap-1 rounded-lg text-sm font-medium transition duration-200 focus-ring ${
          day ? 'text-health-600 hover:text-health-700' : 'text-cyan-300 hover:text-cyan-200'
        }`}
      >
        <ChevronUp className="h-4 w-4" aria-hidden />
        {closeLabel}
      </button>
    </div>
  )
}

function AttachmentList({ items, compact }: { items: EducationItem['attachments']; compact?: boolean }) {
  const { theme } = useTheme()
  const day = theme === 'day'
  if (!items?.length) return null
  return (
    <div className={`mt-3 space-y-2 border-t pt-3 border-[var(--panel-border)] ${compact ? 'mt-2 pt-2' : ''}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-theme-soft">Lampiran</p>
      <ul className="flex flex-col gap-2">
        {items.map((a, i) => (
          <li key={`${a.url}-${i}`}>
            <a
              href={mediaUrl(a.url)}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition duration-200 focus-ring ${
                day
                  ? 'border-slate-200 text-health-700 hover:border-health-500/35 hover:bg-health-500/8'
                  : 'border-white/15 text-cyan-300 hover:border-cyan-500/30 hover:bg-white/8'
              }`}
            >
              <Download className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
              <span className="truncate">{a.name || 'Unduh berkas'}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ArticleBlock({ item, compact }: { item: EducationItem; compact?: boolean }) {
  const { theme } = useTheme()
  const day = theme === 'day'
  const [open, setOpen] = useState(false)
  const body = item.body?.trim()
  if (!body) {
    return <p className="text-sm text-theme-muted">Belum ada isi artikel.</p>
  }
  const lineCount = body.split('\n').length
  const needToggle = body.length > 220 || lineCount > 4 || (compact && body.length > 80)

  return (
    <div>
      {item.coverUrl ? (
        <div className={`mb-3 overflow-hidden rounded-xl bg-zinc-900/20 ${open ? 'max-h-64' : 'max-h-40'}`}>
          <img src={imageMediaUrl(item.coverUrl)} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      ) : null}
      <div
        className={`whitespace-pre-wrap text-sm text-theme-muted ${!open ? (compact ? 'line-clamp-3' : 'line-clamp-4') : ''}`}
      >
        {body}
      </div>
      {needToggle ? (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={`mt-2 inline-flex cursor-pointer items-center gap-1 rounded-lg text-sm font-medium transition duration-200 focus-ring ${
            day ? 'text-health-600 hover:text-health-700' : 'text-cyan-300 hover:text-cyan-200'
          }`}
        >
          {open ? (
            <>
              <ChevronUp className="h-4 w-4" aria-hidden />
              Ringkas
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" aria-hidden />
              Baca selengkapnya
            </>
          )}
        </button>
      ) : null}
    </div>
  )
}

type Props = {
  items: EducationItem[]
  compact?: boolean
  emptyLabel?: string
}

export function EducationFeed({ items, compact, emptyLabel }: Props) {
  const visibleItems = items

  if (!visibleItems.length) {
    return (
      <p className="rounded-2xl border border-dashed px-4 py-10 text-center text-sm text-theme-muted border-[var(--panel-border)] bg-[var(--panel-bg)]">
        {emptyLabel ?? 'Belum ada konten.'}
      </p>
    )
  }

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className={compact ? 'grid gap-4 sm:grid-cols-2' : 'mx-auto flex max-w-xl flex-col gap-6'}
    >
      {visibleItems.map((item) => {
        const catLb = categoryBadgeLabel(item.category, item.subcategory)
        if (item.kind === 'video') {
          const merged: EducationItem = {
            ...item,
            thumbnailUrl: item.thumbnailUrl?.trim() || item.coverUrl?.trim() || item.thumbnailUrl,
          }
          return (
            <PostShell
              key={item.id}
              title={item.title}
              kind={item.kind}
              category={item.category}
              description={item.description}
              compact={compact}
              categoryLabel={catLb}
            >
              <YoutubeEducationCard item={merged} compact={compact} showMeta={false} />
              <AttachmentList items={item.attachments} compact={compact} />
            </PostShell>
          )
        }

        if (item.kind === 'pdf') {
          return (
            <PostShell
              key={item.id}
              title={item.title}
              kind={item.kind}
              category={item.category}
              description={item.description}
              compact={compact}
              categoryLabel={catLb}
              showDescription={false}
            >
              <PdfPreviewBlock item={item} compact={compact} />
            </PostShell>
          )
        }

        if (item.kind === 'gambar' || item.kind === 'banner') {
          const href = mediaUrl(item.url || item.coverUrl)
          const src = imageMediaUrl(item.url || item.coverUrl)
          const badge = item.kind === 'banner' ? 'Poster' : 'Gambar'
          return (
            <PostShell
              key={item.id}
              title={item.title}
              kind={item.kind}
              category={item.category}
              description={item.description}
              compact={compact}
              categoryLabel={catLb}
            >
              {src ? (
                <a href={href || src} target="_blank" rel="noopener noreferrer" className="block">
                  <div className="relative overflow-hidden rounded-xl bg-zinc-900/30">
                    <img src={src} alt={item.title} className="w-full object-cover" style={{ maxHeight: compact ? 160 : 480 }} loading="lazy" />
                    <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur-sm">
                      <ImageIcon className="h-3.5 w-3.5 text-emerald-300" aria-hidden />
                      {badge}
                    </div>
                  </div>
                </a>
              ) : href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-health-600 hover:text-health-700"
                >
                  Buka poster
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                </a>
              ) : (
                <p className="text-sm text-theme-muted italic">Gambar belum tersedia</p>
              )}
              <AttachmentList items={item.attachments} compact={compact} />
            </PostShell>
          )
        }

        if (item.kind === 'artikel') {
          return (
            <PostShell
              key={item.id}
              title={item.title}
              kind={item.kind}
              category={item.category}
              description={item.description}
              compact={compact}
              categoryLabel={catLb}
            >
              <ArticleBlock item={item} compact={compact} />
              <AttachmentList items={item.attachments} compact={compact} />
            </PostShell>
          )
        }

        return null
      })}
    </motion.div>
  )
}

export { EDUCATION_CATEGORY_LABELS }
