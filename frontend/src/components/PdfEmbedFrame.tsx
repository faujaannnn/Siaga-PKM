import { ExternalLink, FileText, FolderOpen } from 'lucide-react'

import {
  appendPdfPageFragment,
  googleDriveChapterViewSrc,
  googleDriveFileIdFromAny,
  mediaUrl,
  resolvePdfInlineDisplay,
} from '@dr-diah/siaga-frontend-core'

type Props = {
  url: string
  title: string
  compact?: boolean
  /** Halaman awal (embed Google Drive / viewer). */
  startPage?: number
  /**
   * Ubah saat bab/halaman berubah agar iframe benar-benar memuat ulang (hash #page= sering diabaikan
   * bila elemen iframe sama).
   */
  reloadKey?: string | number
  /**
   * Modul ML: pakai URL /view + cache-bust (bukan /preview). Bilah halaman di viewer tetap total file Drive.
   */
  chapterMode?: boolean
}

export function PdfEmbedFrame({ url, title, compact, startPage, reloadKey, chapterMode }: Props) {
  const abs = mediaUrl(url)
  const driveId = googleDriveFileIdFromAny(abs)
  let resolved = resolvePdfInlineDisplay(abs)

  if (resolved.kind === 'iframe' && chapterMode && driveId) {
    const src =
      googleDriveChapterViewSrc(abs, startPage, reloadKey) ??
      appendPdfPageFragment(resolved.src, startPage)
    const frameKey = reloadKey != null ? String(reloadKey) : src
    /* Lebih tinggi = area baca lebih panjang; viewer Drive menggulir di dalam iframe. */
    const h = compact ? 'min(58vh, 440px)' : 'min(82vh, 880px)'
    return (
      <div className="space-y-3">
        <div
          className="relative w-full rounded-xl border border-[var(--panel-border)] bg-black/12 shadow-inner"
          style={{ minHeight: h }}
        >
          <iframe
            key={frameKey}
            title={title}
            src={src}
            className="absolute inset-0 h-full min-h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <a
            href={abs}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-merah-bright hover:underline focus-ring rounded-lg"
          >
            Buka sumber di tab baru
            <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
          </a>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-theme-muted hover:text-merah-bright hover:underline focus-ring rounded-lg"
          >
            Buka halaman bab ini di tab baru
            <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
          </a>
        </div>
      </div>
    )
  }

  if (resolved.kind === 'iframe') {
    /* Lebih tinggi = area baca lebih panjang; viewer Drive menggulir di dalam iframe. */
    const h = compact ? 'min(58vh, 440px)' : 'min(82vh, 880px)'
    const src = appendPdfPageFragment(resolved.src, startPage)
    const frameKey = reloadKey != null ? String(reloadKey) : src
    return (
      <div className="space-y-3">
        <div
          className="relative w-full rounded-xl border border-[var(--panel-border)] bg-black/12 shadow-inner"
          style={{ minHeight: h }}
        >
          <iframe
            key={frameKey}
            title={title}
            src={src}
            className="absolute inset-0 h-full min-h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
        <a
          href={abs}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-merah-bright hover:underline focus-ring rounded-lg"
        >
          Buka sumber di tab baru
          <ExternalLink className="h-3 w-3 opacity-80" aria-hidden />
        </a>
      </div>
    )
  }

  const isDriveFolder = /drive\.google\.com\/(?:drive\/)?folders\//i.test(abs)
  const Icon = isDriveFolder ? FolderOpen : FileText
  const label = isDriveFolder ? 'Buka folder Drive' : 'Buka dokumen'
  const btnClass = isDriveFolder
    ? 'inline-flex items-center gap-2 rounded-xl bg-health-500/12 px-4 py-2.5 text-sm font-semibold text-health-700 ring-1 ring-health-500/30 transition hover:bg-health-500/16 dark:text-health-300 focus-ring'
    : 'inline-flex items-center gap-2 rounded-xl bg-merah/12 px-4 py-2.5 text-sm font-semibold text-merah-bright ring-1 ring-merah/25 transition hover:bg-merah/18 focus-ring'

  return (
    <a href={resolved.href} target="_blank" rel="noreferrer" className={btnClass}>
      <Icon className="h-4 w-4" aria-hidden />
      {label}
      <ExternalLink className="h-3.5 w-3.5 opacity-70" aria-hidden />
    </a>
  )
}
